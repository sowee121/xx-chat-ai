/**
 * SSE 客户端：fetch-event-source 封装 meta/delta/done/error
 */
import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { Provider, Role, StreamDelta } from '@/lib/chat-types'
import { STREAM_IDLE_TIMEOUT_MESSAGE, STREAM_IDLE_TIMEOUT_MS } from '@/lib/streamIdle'

export interface StreamMeta {
  sessionCode: string
  title: string
}

export interface StreamCallbacks {
  onMeta?: (meta: StreamMeta) => void
  onDelta: (delta: StreamDelta) => void
  onDone?: (info: { sessionCode: string; finishReason: string }) => void
  /** message 为中文主文案；detail 为上游 `type: message`（可选） */
  onError?: (message: string, detail?: string) => void
}

export interface StreamParams {
  query: string
  sessionCode?: string
  provider: Provider
  model?: string
  messages: { role: Role; content: string }[]
  signal: AbortSignal
  /** 重新生成：服务端按 keepMessageCount 截断后续后重拉，不追加 user */
  regenerate?: boolean
  /** 保留的消息条数（含触发重生前那条 user）；与前端截断对齐 */
  keepMessageCount?: number
}

/** 打开阶段的致命错误（非 SSE 响应 / 4xx）——不重试*/
class FatalError extends Error {}

/** 判断是否为 AbortError*/
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** 安全解析 SSE data；失败返回 null */
function safeParse<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T
  } catch {
    if (import.meta.env.DEV) {
      console.warn('[sseClient] invalid SSE JSON payload:', data)
    }
    return null
  }
}

/**
 * 通过 @microsoft/fetch-event-source 建立 SSE 流
 * 事件协议：meta / delta / done / error（与后端 routes/chat.ts 对应）
 * 收到 done/error 后主动 abort，避免 fetch-event-source 断线自动重连
 * 空闲超时：OpenAI 等真实 provider 超过 STREAM_IDLE_TIMEOUT_MS 无 SSE 事件则中止；Mock 不启用
 */
export async function streamChat(params: StreamParams, cb: StreamCallbacks): Promise<void> {
  const { signal, ...body } = params
  const idleEnabled = body.provider !== 'mock'

  const ctrl = new AbortController()
  const forwardAbort = () => ctrl.abort()
  if (signal.aborted) ctrl.abort()
  else signal.addEventListener('abort', forwardAbort, { once: true })

  let idleTimedOut = false
  let parseFailed = false
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  const bumpIdle = () => {
    if (!idleEnabled) return
    clearIdle()
    idleTimer = setTimeout(() => {
      idleTimedOut = true
      cb.onError?.(STREAM_IDLE_TIMEOUT_MESSAGE)
      ctrl.abort()
    }, STREAM_IDLE_TIMEOUT_MS)
  }

  const failParse = () => {
    parseFailed = true
    clearIdle()
    cb.onError?.('流式数据解析失败')
    ctrl.abort()
  }

  bumpIdle()

  try {
    await fetchEventSource('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      openWhenHidden: true,
      async onopen(res) {
        bumpIdle()
        const ct = res.headers.get('content-type') ?? ''
        if (res.ok && ct.includes('text/event-stream')) return
        const text = await res.text().catch(() => '')
        let message = `请求失败 (${res.status})`
        if (text) {
          const parsed = safeParse<{ error?: string; message?: string }>(text)
          if (parsed?.error || parsed?.message) {
            message = parsed.error ?? parsed.message ?? message
          } else {
            message = `${message}：${text}`
          }
        }
        throw new FatalError(message)
      },
      onmessage(ev) {
        if (!ev.event || !ev.data) return
        bumpIdle()
        switch (ev.event) {
          case 'meta': {
            const meta = safeParse<StreamMeta>(ev.data)
            if (!meta) {
              failParse()
              return
            }
            cb.onMeta?.(meta)
            break
          }
          case 'delta': {
            const parsed = safeParse<Partial<StreamDelta> & { content?: string }>(ev.data)
            if (!parsed) {
              failParse()
              return
            }
            const type = parsed.type === 'reasoning' ? 'reasoning' : 'text'
            if (parsed.content) cb.onDelta({ type, content: parsed.content })
            break
          }
          case 'done': {
            const done = safeParse<{ sessionCode: string; finishReason: string }>(ev.data)
            if (!done) {
              failParse()
              return
            }
            clearIdle()
            cb.onDone?.(done)
            ctrl.abort()
            break
          }
          case 'error': {
            const payload = safeParse<{ message?: string; detail?: string }>(ev.data)
            clearIdle()
            // error 事件解析失败时仍给明确文案，避免落到「网络错误」
            const message = payload?.message ?? (payload ? '生成出错' : '流式数据解析失败')
            const detail = payload?.detail?.trim() || undefined
            cb.onError?.(message, detail)
            ctrl.abort()
            break
          }
        }
      },
      onerror(err) {
        // 抛出以停止自动重连；交由外层 catch 处理
        throw err
      },
    })
  } catch (err) {
    // 空闲超时 / 解析失败已通过 onError 通知
    if (idleTimedOut || parseFailed) return
    // 正常结束（done 后 abort）或用户主动停止
    if (isAbortError(err)) return
    cb.onError?.(err instanceof Error ? err.message : '网络错误')
  } finally {
    clearIdle()
    signal.removeEventListener('abort', forwardAbort)
  }
}

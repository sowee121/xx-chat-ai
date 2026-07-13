/**
 * SSE 客户端：fetch-event-source 封装 meta/delta/done/error。
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
  onError?: (message: string) => void
}

export interface StreamParams {
  query: string
  sessionCode?: string
  provider: Provider
  model?: string
  messages: { role: Role; content: string }[]
  signal: AbortSignal
}

/** 打开阶段的致命错误（非 SSE 响应 / 4xx）——不重试。 */
class FatalError extends Error {}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * 通过 @microsoft/fetch-event-source 建立 SSE 流。
 * 事件协议：meta / delta / done / error（与后端 routes/chat.ts 对应）。
 * 收到 done/error 后主动 abort，避免 fetch-event-source 断线自动重连。
 * 空闲超时：OpenAI 等真实 provider 超过 STREAM_IDLE_TIMEOUT_MS 无 SSE 事件则中止；Mock 不启用。
 */
export async function streamChat(params: StreamParams, cb: StreamCallbacks): Promise<void> {
  const { signal, ...body } = params
  const idleEnabled = body.provider !== 'mock'

  const ctrl = new AbortController()
  const forwardAbort = () => ctrl.abort()
  if (signal.aborted) ctrl.abort()
  else signal.addEventListener('abort', forwardAbort, { once: true })

  let idleTimedOut = false
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
        throw new FatalError(`请求失败 (${res.status})${text ? `：${text}` : ''}`)
      },
      onmessage(ev) {
        if (!ev.event || !ev.data) return
        bumpIdle()
        switch (ev.event) {
          case 'meta':
            cb.onMeta?.(JSON.parse(ev.data))
            break
          case 'delta': {
            const parsed = JSON.parse(ev.data) as Partial<StreamDelta> & { content?: string }
            const type = parsed.type === 'reasoning' ? 'reasoning' : 'text'
            if (parsed.content) cb.onDelta({ type, content: parsed.content })
            break
          }
          case 'done':
            clearIdle()
            cb.onDone?.(JSON.parse(ev.data))
            ctrl.abort()
            break
          case 'error':
            clearIdle()
            cb.onError?.(JSON.parse(ev.data).message ?? '生成出错')
            ctrl.abort()
            break
        }
      },
      onerror(err) {
        // 抛出以停止自动重连；交由外层 catch 处理
        throw err
      },
    })
  } catch (err) {
    // 空闲超时已通过 onError 通知
    if (idleTimedOut) return
    // 正常结束（done 后 abort）或用户主动停止
    if (isAbortError(err)) return
    cb.onError?.(err instanceof Error ? err.message : '网络错误')
  } finally {
    clearIdle()
    signal.removeEventListener('abort', forwardAbort)
  }
}

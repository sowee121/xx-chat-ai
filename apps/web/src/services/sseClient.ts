import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { ChatMessage, Provider, Role, StreamDelta } from '@/lib/chat-types'

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
 */
export async function streamChat(params: StreamParams, cb: StreamCallbacks): Promise<void> {
  const { signal, ...body } = params

  const ctrl = new AbortController()
  const forwardAbort = () => ctrl.abort()
  if (signal.aborted) ctrl.abort()
  else signal.addEventListener('abort', forwardAbort, { once: true })

  try {
    await fetchEventSource('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      openWhenHidden: true,
      async onopen(res) {
        const ct = res.headers.get('content-type') ?? ''
        if (res.ok && ct.includes('text/event-stream')) return
        const text = await res.text().catch(() => '')
        throw new FatalError(`请求失败 (${res.status})${text ? `：${text}` : ''}`)
      },
      onmessage(ev) {
        if (!ev.event || !ev.data) return
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
            cb.onDone?.(JSON.parse(ev.data))
            ctrl.abort()
            break
          case 'error':
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
    if (isAbortError(err)) return // 正常结束（done 后 abort）或用户主动停止
    cb.onError?.(err instanceof Error ? err.message : '网络错误')
  } finally {
    signal.removeEventListener('abort', forwardAbort)
  }
}

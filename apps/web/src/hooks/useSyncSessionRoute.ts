/**
 * URL sessionCode ↔ chatStore 单向同步，避免路由死循环
 */
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { chatSessionPath } from '@/lib/chat-routes'
import { isPendingSessionCode } from '@/lib/pendingSession'
import { useChatStore } from '@/stores/chatStore'

/** URL param ↔ chatStore：加载 /chat/:sessionCode，首条消息后 replace 到带 code 的路径 */
export function useSyncSessionRoute() {
  const { sessionCode: routeCode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const loadSeqRef = useRef(0)

  const openSession = useChatStore((s) => s.openSession)
  const storeCode = useChatStore((s) => s.sessionCode)
  const hasMessages = useChatStore((s) => s.messages.length > 0)
  const sessionGoneSeq = useChatStore((s) => s.sessionGoneSeq)

  // /chat/:sessionCode → openSession（勿在首条消息 replace URL 时打断流式）
  useEffect(() => {
    if (!routeCode) return

    const state = useChatStore.getState()

    if (state.sessionCode === routeCode) {
      if (state.isStreaming) return
      if (state.messages.length > 0) return
    }

    // 流式中改 URL：abort + bump streamSeq，丢弃迟到 delta
    if (state.isStreaming) {
      state._abort?.abort()
      useChatStore.setState((s) => ({
        isStreaming: false,
        _abort: undefined,
        _streamSeq: s._streamSeq + 1,
      }))
    }

    const seq = ++loadSeqRef.current
    useChatStore.setState({ _routeLoadSeq: seq })

    void openSession(routeCode).then((ok) => {
      if (seq !== loadSeqRef.current) return
      if (!ok) navigate('/', { replace: true })
    })
  }, [routeCode, openSession, navigate])

  // 发送时会话已删：Toast 后回首页，避免 URL 仍挂着已删 code
  useEffect(() => {
    if (!routeCode || sessionGoneSeq === 0) return
    navigate('/', { replace: true })
  }, [sessionGoneSeq, routeCode, navigate])

  // 仅首页首条消息后：/ → /chat/:sessionCode（replace）；pending 不进 URL
  useEffect(() => {
    if (!storeCode || isPendingSessionCode(storeCode) || !hasMessages) return
    if (location.pathname !== '/') return
    navigate(chatSessionPath(storeCode), { replace: true })
  }, [storeCode, hasMessages, location.pathname, navigate])
}

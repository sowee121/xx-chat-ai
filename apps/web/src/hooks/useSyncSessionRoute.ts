/**
 * URL sessionCode ↔ chatStore 单向同步，避免路由死循环。
 */
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { chatSessionPath } from '@/lib/chat-routes'
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

  // /chat/:sessionCode → openSession（勿在首条消息 replace URL 时打断流式）
  useEffect(() => {
    if (!routeCode) return

    const state = useChatStore.getState()

    if (state.sessionCode === routeCode) {
      if (state.isStreaming) return
      if (state.messages.length > 0) return
    }

    // 流式中改 URL：先 abort 再加载目标会话
    if (state.isStreaming) {
      state._abort?.abort()
      useChatStore.setState({ isStreaming: false, _abort: undefined })
    }

    const seq = ++loadSeqRef.current
    useChatStore.setState({ _routeLoadSeq: seq })

    void openSession(routeCode).then((ok) => {
      if (seq !== loadSeqRef.current) return
      if (!ok) navigate('/', { replace: true })
    })
  }, [routeCode, openSession, navigate])

  // 仅首页首条消息后：/ → /chat/:sessionCode（replace）；切换侧栏会话时勿用旧 storeCode 改 URL
  useEffect(() => {
    if (!storeCode || !hasMessages) return
    if (location.pathname !== '/') return
    navigate(chatSessionPath(storeCode), { replace: true })
  }, [storeCode, hasMessages, location.pathname, navigate])
}

/**
 * 会话导航：新建对话 / 打开历史时同步 URL
 */
import { useNavigate, useParams } from 'react-router-dom'

import { chatSessionPath } from '@/lib/chat-routes'
import { useChatStore } from '@/stores/chatStore'

/** 会话路由导航封装*/
export function useSessionNavigation() {
  const navigate = useNavigate()
  const { sessionCode: routeCode } = useParams()
  const newChat = useChatStore((s) => s.newChat)

  const goHome = () => {
    useChatStore.setState((s) => ({ _routeLoadSeq: s._routeLoadSeq + 1 }))
    newChat()
    navigate('/')
  }

  const goSession = (sessionCode: string) => {
    if (routeCode === sessionCode) return
    navigate(chatSessionPath(sessionCode))
  }

  return { goHome, goSession }
}

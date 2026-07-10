/** 已有对话的路由前缀：`/chat/:sessionCode` */
export const CHAT_SESSION_PREFIX = '/chat'

export function chatSessionPath(sessionCode: string): string {
  return `${CHAT_SESSION_PREFIX}/${sessionCode}`
}

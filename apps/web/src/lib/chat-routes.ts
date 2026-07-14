/**
 * 聊天 URL 路径常量与构造
 */

/** 已有对话的路由前缀：`/chat/:sessionCode` */
export const CHAT_SESSION_PREFIX = '/chat'

/** 构造 /chat/:sessionCode 路径*/
export function chatSessionPath(sessionCode: string): string {
  return `${CHAT_SESSION_PREFIX}/${sessionCode}`
}

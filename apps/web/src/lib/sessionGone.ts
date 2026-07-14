/**
 * 会话已删除 / 不存在相关文案与判定
 */

export const SESSION_GONE_MESSAGE = '对话不存在或已删除'

/** 是否为会话已删除类错误文案*/
export function isSessionGoneMessage(message: string): boolean {
  return /对话不存在|已删除/.test(message)
}

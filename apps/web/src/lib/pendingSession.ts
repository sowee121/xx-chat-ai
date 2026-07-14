/**
 * 首条发送、meta 到达前的临时会话码
 * 勿写入真实 URL；仅用于 Keep-Alive 挂载与直播匹配
 */
export const PENDING_SESSION_CODE = '__pending__'

/** 是否为 pending 临时会话码*/
export function isPendingSessionCode(code: string | undefined): boolean {
  return code === PENDING_SESSION_CODE
}

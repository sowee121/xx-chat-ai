/**
 * 前端流式空闲超时常量（与后端 STREAM_IDLE_TIMEOUT_MS 对齐）
 */

/** 两次 SSE 事件之间的最长等待（毫秒）；Mock provider 不启用 */
export const STREAM_IDLE_TIMEOUT_MS = 60_000

/** 面向用户的超时文案 */
export const STREAM_IDLE_TIMEOUT_MESSAGE = '响应超时，请稍后重试或更换模型'

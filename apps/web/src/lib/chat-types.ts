/**
 * 前端聊天领域类型（消息、会话、Provider）
 */
export type Provider = 'mock' | 'openai'

export type Role = 'user' | 'assistant'

export interface ProviderInfo {
  id: Provider
  label: string
  available: boolean
  reason?: string
}

export interface ProvidersResponse {
  defaultProvider: Provider
  defaultModel?: string
  providers: ProviderInfo[]
}

export interface ModelsResponse {
  models: string[]
  defaultModel?: string
}

export type StreamChunkType = 'reasoning' | 'text'

export interface StreamDelta {
  type: StreamChunkType
  content: string
}

export interface ChatMessage {
  id: string
  role: Role
  content: string
  reasoning?: string
  /** 本轮失败中文说明；与 content 分离 */
  errorMessage?: string
  /** 上游明细 `type: message` */
  errorDetail?: string
  /** 软状态提示（如已停止生成） */
  statusMessage?: string
}

export interface SessionSummary {
  sessionCode: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface StoredMessage {
  id?: number
  role: Role
  content: string
  /** 思考过程；打开历史时展示，不回传上游 */
  reasoning?: string
  errorMessage?: string
  errorDetail?: string
  statusMessage?: string
  ts: number
}

export interface SessionDetail {
  sessionCode: string
  title: string
  createdAt: number
  updatedAt: number
  messages: StoredMessage[]
}

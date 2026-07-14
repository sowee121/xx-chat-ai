/**
 * 服务端共享类型：聊天请求体、SSE 分片等
 */
export type Provider = 'mock' | 'openai';

export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequestBody {
  query: string;
  sessionCode?: string;
  provider?: Provider;
  model?: string;
  messages?: ChatMessage[];
  /** 重新生成：截断该助手及后续消息后重拉，不重复写入 user */
  regenerate?: boolean;
  /**
   * 重新生成时保留的消息条数（按库内顺序，含触发重生前的那条 user）
   * 例如 messages=[u1,a1,u2,a2] 重生 a1 时 keepMessageCount=1
   */
  keepMessageCount?: number;
}

export interface StreamOptions {
  query: string;
  messages: ChatMessage[];
  signal: AbortSignal;
  model?: string;
}

export type StreamChunkType = 'reasoning' | 'text';

export interface StreamChunk {
  type: StreamChunkType;
  content: string;
}

/** 流式 provider：产出 reasoning / text 增量 */
export type ChatStream = AsyncGenerator<StreamChunk, void, unknown>;

export type ChatProvider = (opts: StreamOptions) => ChatStream;

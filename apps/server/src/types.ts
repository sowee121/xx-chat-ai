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

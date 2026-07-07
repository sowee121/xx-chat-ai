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

/** 流式 provider：产出文本增量（delta） */
export type ChatStream = AsyncGenerator<string, void, unknown>;

export type ChatProvider = (opts: StreamOptions) => ChatStream;

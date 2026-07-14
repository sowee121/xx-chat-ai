/**
 * Provider 工厂：按名称解析 mock / openai 流式实现
 */
import type { ChatProvider, Provider } from '../types.js';
import { mockStream } from './mock.js';
import { openaiStream } from './openai.js';

const providers: Record<Provider, ChatProvider> = {
  mock: mockStream,
  openai: openaiStream,
};

/** 按名称解析流式 Provider*/
export function getProvider(name: Provider | undefined): ChatProvider {
  return providers[name ?? 'mock'] ?? providers.mock;
}

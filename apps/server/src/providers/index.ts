import type { ChatProvider, Provider } from '../types.js';
import { mockStream } from './mock.js';
import { openaiStream } from './openai.js';

const providers: Record<Provider, ChatProvider> = {
  mock: mockStream,
  openai: openaiStream,
};

export function getProvider(name: Provider | undefined): ChatProvider {
  return providers[name ?? 'mock'] ?? providers.mock;
}

import type { Provider } from '../types.js';
import { getConfiguredDefaultProvider, getOpenaiCredentials } from '../config/local.js';

export interface ProviderInfo {
  id: Provider;
  label: string;
  available: boolean;
  reason?: string;
}

/** OpenAI API 是否已配置（环境变量优先，其次 config.local.json）。 */
export function isOpenaiConfigured(): boolean {
  return Boolean(getOpenaiCredentials().apiKey);
}

export function getOpenaiDefaultModel(): string | undefined {
  return getOpenaiCredentials().model;
}

export function listProviders(): ProviderInfo[] {
  const openaiReady = isOpenaiConfigured();
  return [
    { id: 'mock', label: 'Mock', available: true },
    {
      id: 'openai',
      label: 'OpenAI',
      available: openaiReady,
      reason: openaiReady
        ? undefined
        : '未配置 API Key（config.local.json 或环境变量 OPENAI_API_KEY）',
    },
  ];
}

export function getDefaultProvider(): Provider {
  const preferred = getConfiguredDefaultProvider();
  if (preferred === 'openai' && isOpenaiConfigured()) return 'openai';
  if (preferred === 'mock') return 'mock';
  return isOpenaiConfigured() ? 'openai' : 'mock';
}

/**
 * 解析本次请求实际使用的模型（与 openaiStream 一致）。
 */
import { getOpenaiCredentials } from '../config/local.js';
import type { Provider } from '../types.js';

/** 与 openaiStream 一致的模型解析，用于缓存键比对 */
export function resolveRequestModel(provider: Provider, modelOverride?: string): string {
  if (provider === 'mock') return 'mock';
  const creds = getOpenaiCredentials();
  return modelOverride || creds.model || 'DeepSeek-R1-0528-Qwen3-8B';
}

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Provider } from '../types.js';

export interface OpenaiLocalConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  systemPrompt?: string;
}

export interface LocalConfigFile {
  defaultProvider?: Provider;
  openai?: OpenaiLocalConfig;
}

const CONFIG_PATH = resolve(process.cwd(), 'config.local.json');

let cached: LocalConfigFile | null | undefined;

function loadFile(): LocalConfigFile | null {
  if (cached !== undefined) return cached;
  if (!existsSync(CONFIG_PATH)) {
    cached = null;
    return null;
  }
  try {
    cached = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as LocalConfigFile;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

/** 读取本地私有配置（config.local.json，已 gitignore，不进仓库）。 */
export function getLocalConfig(): LocalConfigFile | null {
  return loadFile();
}

export function getOpenaiCredentials(): {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  systemPrompt?: string;
} {
  const file = loadFile();
  const fromFile = file?.openai ?? {};
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || fromFile.apiKey?.trim(),
    baseURL: process.env.OPENAI_BASE_URL?.trim() || fromFile.baseURL?.trim(),
    model: process.env.OPENAI_MODEL?.trim() || fromFile.model?.trim(),
    systemPrompt: process.env.OPENAI_SYSTEM_PROMPT?.trim() || fromFile.systemPrompt?.trim(),
  };
}

export function getConfiguredDefaultProvider(): Provider | undefined {
  const env = process.env.XX_DEFAULT_PROVIDER as Provider | undefined;
  if (env === 'mock' || env === 'openai') return env;
  const file = loadFile();
  if (file?.defaultProvider === 'mock' || file?.defaultProvider === 'openai') {
    return file.defaultProvider;
  }
  return undefined;
}

/** 热重载配置（开发时改 config.local.json 后可用）。 */
export function reloadLocalConfig(): void {
  cached = undefined;
}

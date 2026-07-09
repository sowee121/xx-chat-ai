import OpenAI from 'openai';
import { getOpenaiCredentials } from '../config/local.js';
import { extractReasoningFromDelta } from '../lib/reasoningDelta.js';
import { ThinkingStreamParser } from '../lib/thinkingParser.js';
import type { ChatStream, StreamOptions } from '../types.js';
import { isOpenaiConfigured } from './config.js';

const DEFAULT_SYSTEM_PROMPT =
  '你是 XX Chat AI 的助手。回答使用简洁的中文 Markdown；' +
  '涉及代码时用带语言标注的代码块，涉及对比时可用表格，涉及流程时可用 Mermaid 图（graph、sequenceDiagram 等）；' +
  '数值对比图请用 xychart-beta，不要使用 barChart。';

let client: OpenAI | null = null;
let clientKey = '';

export function getOpenaiClient(): OpenAI {
  const { apiKey, baseURL } = getOpenaiCredentials();
  if (!apiKey) {
    throw new Error('未配置 API Key（config.local.json 或环境变量 OPENAI_API_KEY）');
  }
  const cacheKey = `${apiKey}|${baseURL ?? ''}`;
  if (client && clientKey === cacheKey) return client;
  client = new OpenAI({ apiKey, baseURL: baseURL || undefined });
  clientKey = cacheKey;
  return client;
}

function normalizeOpenaiError(err: unknown, model?: string): Error {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 401) {
      return new Error('API Key 无效，请检查 config.local.json 或环境变量');
    }
    if (err.status === 404) {
      return new Error(`模型或端点不存在（model: ${model ?? 'unknown'}）`);
    }
    if (err.status === 429) {
      return new Error('请求过于频繁或额度不足，请稍后重试');
    }
    const detail = err.message?.trim();
    return new Error(detail ? `请求失败：${detail}` : `请求失败（${err.status}）`);
  }
  if (err instanceof Error && err.name === 'AbortError') return err;
  if (err instanceof Error) return err;
  return new Error('OpenAI API 请求失败');
}

/** 过滤供应商返回的模型列表，保留适合对话的模型。 */
export function filterChatModels(ids: string[]): string[] {
  const deny =
    /^(text-embedding|embedding|whisper|tts|dall-e|davinci|babbage|curie|ada|moderation|omni-moderation|gpt-image|sora|computer-use|bge-|bge\/|reranker)/i;
  const allow =
    /^(gpt-|o[134]|deepseek|claude|gemini|qwen|glm|moonshot|yi-|llama|mistral|mixtral)/i;

  return [...new Set(ids)]
    .filter((id) => !deny.test(id))
    .filter((id) => !/bge|reranker|embedding/i.test(id))
    .filter((id) => allow.test(id) || (!id.includes('embedding') && !id.includes('whisper')))
    .sort((a, b) => a.localeCompare(b));
}

let modelsCache: { at: number; models: string[] } | null = null;
const MODELS_TTL_MS = 10 * 60 * 1000;

export async function listOpenaiModels(): Promise<string[]> {
  if (!isOpenaiConfigured()) return [];

  const now = Date.now();
  if (modelsCache && now - modelsCache.at < MODELS_TTL_MS) {
    return modelsCache.models;
  }

  const { model: fallbackModel } = getOpenaiCredentials();
  try {
    const page = await getOpenaiClient().models.list();
    const ids = page.data.map((m) => m.id);
    const models = filterChatModels(ids);
    if (models.length > 0) {
      modelsCache = { at: now, models };
      return models;
    }
  } catch {
    // 部分兼容端点 models 接口异常时，回退到配置默认模型
  }

  const fallback = fallbackModel ? [fallbackModel] : [];
  modelsCache = { at: now, models: fallback };
  return fallback;
}

type DeltaWithReasoning = {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
  thinking?: string | null;
  thinking_content?: string | null;
  thinking_blocks?: unknown;
};

function* emitParsed(parser: ThinkingStreamParser, text: string) {
  for (const part of parser.push(text)) {
    yield part;
  }
}

/**
 * OpenAI provider：通过 openai SDK 以流式方式代理到 OpenAI API（兼容端点）。
 * 优先从 delta 多字段提取推理；否则对 content 做思考标签流式解析。
 */
export async function* openaiStream(opts: StreamOptions): ChatStream {
  const { query, messages, signal, model: modelOverride } = opts;
  const creds = getOpenaiCredentials();
  const model = modelOverride || creds.model || 'DeepSeek-R1-0528-Qwen3-8B';
  const system = creds.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: query },
  ];

  const parser = new ThinkingStreamParser();

  try {
    const stream = await getOpenaiClient().chat.completions.create(
      { model, messages: chatMessages, stream: true },
      { signal },
    );

    for await (const chunk of stream) {
      if (signal.aborted) break;
      const delta = chunk.choices[0]?.delta as DeltaWithReasoning | undefined;
      if (!delta) continue;

      const reasoning = extractReasoningFromDelta(delta as Record<string, unknown>);
      if (reasoning) {
        yield { type: 'reasoning', content: reasoning };
      }

      const content = delta.content;
      if (content) {
        yield* emitParsed(parser, content);
      }
    }
  } catch (err) {
    throw normalizeOpenaiError(err, model);
  } finally {
    for (const part of parser.flush()) {
      yield part;
    }
  }
}

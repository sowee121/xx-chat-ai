/**
 * OpenAI 兼容协议流式代理，含推理字段归一化。
 */
import OpenAI from 'openai';
import { getOpenaiCredentials } from '../config/local.js';
import { extractReasoningFromDelta } from '../lib/reasoningDelta.js';
import { ThinkingStreamParser } from '../lib/thinkingParser.js';
import { DEFAULT_SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import type { ChatStream, StreamOptions } from '../types.js';
import { isOpenaiConfigured } from './config.js';

/** 按 apiKey+baseURL 缓存客户端，配置变更时重建 */
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

/** 将 SDK 错误转为面向用户的中文提示 */
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

/** 模型列表内存缓存（10 分钟） */
let modelsCache: { at: number; models: string[] } | null = null;
const MODELS_TTL_MS = 10 * 60 * 1000;

/** 拉取并过滤对话模型；接口失败时回退到配置默认模型 */
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

/** 将 content 片段推入思考标签解析器并产出 reasoning/text */
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

      // 优先走独立推理字段；否则再解析 content 内标签
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
    // 用户停止/断连时不再 flush，避免 abort 后仍 yield 残留 chunk（BUG-07）
    if (!signal.aborted) {
      for (const part of parser.flush()) {
        yield part;
      }
    }
  }
}

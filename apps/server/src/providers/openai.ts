/**
 * OpenAI 兼容协议流式代理，含推理字段归一化
 */
import OpenAI from 'openai';
import { getOpenaiCredentials } from '../config/local.js';
import { extractReasoningFromDelta } from '../lib/reasoningDelta.js';
import { stripThinkingTags, ThinkingStreamParser } from '../lib/thinkingParser.js';
import { normalizeUpstreamError } from '../lib/upstreamError.js';
import { DEFAULT_SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import type { ChatStream, StreamOptions } from '../types.js';
import { isOpenaiConfigured } from './config.js';

/** 按 apiKey+baseURL 缓存客户端，配置变更时重建 */
let client: OpenAI | null = null;
let clientKey = '';

/** 获取（或重建）OpenAI 客户端*/
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

/** 过滤供应商返回的模型列表，保留适合对话的模型*/
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
 * OpenAI provider：通过 openai SDK 以流式方式代理到 OpenAI API（兼容端点）
 * 优先从 delta 多字段提取推理；否则对 content 做思考标签流式解析
 * 一旦走字段推理，本流后续 content 只剥标签出正文，避免双通道重复
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
  /** 本轮是否已出现独立推理字段；为真则不再用标签解析 content */
  let usedFieldReasoning = false;

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
        usedFieldReasoning = true;
        yield { type: 'reasoning', content: reasoning };
      }

      const content = delta.content;
      if (!content) continue;

      if (usedFieldReasoning) {
        // 字段通道已承担 reasoning：content 内标签剥掉，只推正文
        const textOnly = stripThinkingTags(content);
        if (textOnly) yield { type: 'text', content: textOnly };
      } else {
        yield* emitParsed(parser, content);
      }
    }
  } catch (err) {
    throw normalizeUpstreamError(err, { model, source: 'openai' });
  } finally {
    // 用户停止/断连时不再 flush；已走字段推理时丢弃标签解析缓冲，避免重复
    if (!signal.aborted && !usedFieldReasoning) {
      for (const part of parser.flush()) {
        yield part;
      }
    }
  }
}

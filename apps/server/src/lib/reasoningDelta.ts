/** 网关/代理可能把推理放在 delta 的多个字段名里 */
const REASONING_FIELD_KEYS = [
  'reasoning_content',
  'reasoning',
  'thinking',
  'thinking_content',
] as const;

type ReasoningObject = Record<string, unknown>;

function textFromObject(obj: ReasoningObject): string | undefined {
  for (const key of ['text', 'content', 'thinking', 'reasoning'] as const) {
    const v = obj[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

/** 将 string / 对象形式的推理片段归一为纯文本 */
export function coerceReasoningValue(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return textFromObject(raw as ReasoningObject);
  }
  return undefined;
}

/** 从 thinking_blocks（LiteLLM / 部分网关）提取可展示的推理文本 */
function reasoningFromThinkingBlocks(blocks: unknown): string | undefined {
  if (!Array.isArray(blocks) || blocks.length === 0) return undefined;

  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const b = block as ReasoningObject;
    if (typeof b.thinking === 'string' && b.thinking.length > 0) {
      parts.push(b.thinking);
      continue;
    }
    const nested = textFromObject(b);
    if (nested) parts.push(nested);
  }

  return parts.length > 0 ? parts.join('') : undefined;
}

/**
 * 从 OpenAI 兼容流式 delta 中提取推理文本（P0）。
 * 支持多字段名、对象型 reasoning_content、thinking_blocks。
 */
export function extractReasoningFromDelta(delta: Record<string, unknown>): string | undefined {
  for (const key of REASONING_FIELD_KEYS) {
    const text = coerceReasoningValue(delta[key]);
    if (text) return text;
  }

  return reasoningFromThinkingBlocks(delta.thinking_blocks);
}

/**
 * SSE 防重回放：分片节奏回放与 delta 聚合
 */
import type { StreamChunk } from '../types.js';

/** 分片间隔，模拟真实 token 节奏 */
const REPLAY_DELAY_MS = 20;

/** 可取消的延迟等待*/
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 将大块 delta 切成小片，回放时更接近真实 token 流 */
function* splitDelta(delta: StreamChunk): Generator<StreamChunk> {
  const maxChunk = 8;
  if (delta.content.length <= maxChunk) {
    yield delta;
    return;
  }
  let i = 0;
  while (i < delta.content.length) {
    const size = 2 + Math.floor(Math.random() * 4);
    yield { type: delta.type, content: delta.content.slice(i, i + size) };
    i += size;
  }
}

/** 按节奏回放缓存 delta，避免同 tick 内刷完导致前端无法逐字渲染 */
export async function* pacedReplayStream(
  deltas: StreamChunk[],
  signal: AbortSignal,
): AsyncGenerator<StreamChunk, void, unknown> {
  for (const delta of deltas) {
    for (const part of splitDelta(delta)) {
      if (signal.aborted) return;
      yield part;
      await sleep(REPLAY_DELAY_MS);
    }
  }
}

/** 聚合 delta 为完整正文与推理，供落库与完成态判断 */
export function aggregateStreamChunks(deltas: StreamChunk[]): {
  fullText: string;
  fullReasoning: string;
  hadReasoning: boolean;
} {
  let fullText = '';
  let fullReasoning = '';
  for (const delta of deltas) {
    if (delta.type === 'reasoning') fullReasoning += delta.content;
    if (delta.type === 'text') fullText += delta.content;
  }
  return {
    fullText,
    fullReasoning,
    hadReasoning: fullReasoning.length > 0,
  };
}

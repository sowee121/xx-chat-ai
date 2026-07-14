/**
 * SSE delta 聚合（落库用）
 */
import type { StreamChunk } from '../types.js';

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

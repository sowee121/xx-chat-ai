/**
 * 流式解析 content 内思考标签，拆成 reasoning / text。
 */
export type StreamChunkType = 'reasoning' | 'text';

export interface StreamChunk {
  type: StreamChunkType;
  content: string;
}

interface TagPair {
  open: string;
  close: string;
}

const THINK = 'think';

const THINKING_TAG_PAIRS: TagPair[] = [
  { open: `<${THINK}>`, close: `</${THINK}>` },
  { open: '<think>', close: '</think>' },
  { open: '<reasoning>', close: '</reasoning>' },
  { open: '<cot>', close: '</cot>' },
  { open: '<|begin_of_thought|>', close: '<|end_of_thought|>' },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 最长后缀：可能是某个标签的前缀（用于流式分包时保留半标签） */
function longestPartialSuffix(s: string, candidates: string[]): number {
  let max = 0;
  for (const c of candidates) {
    const limit = Math.min(s.length, c.length - 1);
    for (let len = 1; len <= limit; len++) {
      if (c.startsWith(s.slice(-len))) max = Math.max(max, len);
    }
  }
  return max;
}

/**
 * 流式思考标签解析器：将混在 content 中的推理块拆为 reasoning / text。
 * 支持标签跨 chunk 切分；close 前内容归 reasoning，close 后归 text。
 */
export class ThinkingStreamParser {
  private buffer = '';
  private mode: StreamChunkType = 'text';
  private closeTag: string | null = null;

  push(input: string): StreamChunk[] {
    this.buffer += input;
    return this.drain(false);
  }

  flush(): StreamChunk[] {
    return this.drain(true);
  }

  private drain(finish: boolean): StreamChunk[] {
    const out: StreamChunk[] = [];

    while (this.buffer.length > 0) {
      if (this.mode === 'text') {
        let earliest = -1;
        let matched: TagPair | null = null;
        for (const pair of THINKING_TAG_PAIRS) {
          const idx = this.buffer.indexOf(pair.open);
          if (idx !== -1 && (earliest === -1 || idx < earliest)) {
            earliest = idx;
            matched = pair;
          }
        }

        if (matched && earliest !== -1) {
          if (earliest > 0) {
            out.push({ type: 'text', content: this.buffer.slice(0, earliest) });
          }
          this.buffer = this.buffer.slice(earliest + matched.open.length);
          this.mode = 'reasoning';
          this.closeTag = matched.close;
          continue;
        }

        if (!finish) {
          const hold = longestPartialSuffix(
            this.buffer,
            THINKING_TAG_PAIRS.map((p) => p.open),
          );
          if (hold > 0) {
            const safe = this.buffer.length - hold;
            if (safe > 0) {
              out.push({ type: 'text', content: this.buffer.slice(0, safe) });
              this.buffer = this.buffer.slice(safe);
            }
            break;
          }
        }

        if (this.buffer) {
          out.push({ type: 'text', content: this.buffer });
          this.buffer = '';
        }
        break;
      }

      const close = this.closeTag!;
      const idx = this.buffer.indexOf(close);

      if (idx !== -1) {
        if (idx > 0) {
          out.push({ type: 'reasoning', content: this.buffer.slice(0, idx) });
        }
        this.buffer = this.buffer.slice(idx + close.length);
        this.mode = 'text';
        this.closeTag = null;
        continue;
      }

      if (!finish) {
        const hold = longestPartialSuffix(this.buffer, [close]);
        if (hold > 0) {
          const safe = this.buffer.length - hold;
          if (safe > 0) {
            out.push({ type: 'reasoning', content: this.buffer.slice(0, safe) });
            this.buffer = this.buffer.slice(safe);
          }
          break;
        }
      }

      if (this.buffer) {
        out.push({ type: 'reasoning', content: this.buffer });
        this.buffer = '';
      }
      break;
    }

    return out;
  }
}

/** 从完整文本剥离思考块（历史兜底、中断落库清理） */
export function stripThinkingTags(text: string): string {
  let result = text;
  for (const { open, close } of THINKING_TAG_PAIRS) {
    const re = new RegExp(`${escapeRegExp(open)}[\\s\\S]*?${escapeRegExp(close)}`, 'g');
    result = result.replace(re, '');
  }
  for (const { open } of THINKING_TAG_PAIRS) {
    const idx = result.indexOf(open);
    if (idx !== -1) result = result.slice(0, idx);
  }
  return result.trim();
}

/**
 * SSE / provider 流空闲超时：两次产出间隔过长则中止
 */

/** 两次流式产出之间的最长等待（毫秒）；仅用于非 Mock provider */
export const STREAM_IDLE_TIMEOUT_MS = 60_000;

/** 面向用户的超时文案 */
export const STREAM_IDLE_TIMEOUT_MESSAGE = '响应超时，请稍后重试或更换模型';

/**
 * 包装异步迭代器：若 next() 超过 idleMs 未返回则先 abort 上游再抛错
 */
export async function* withStreamIdleTimeout<T>(
  source: AsyncIterable<T>,
  options: {
    idleMs?: number;
    signal: AbortSignal;
    /** 空闲超时时调用，用于立刻中断上游 provider */
    abort?: () => void;
    message?: string;
  },
): AsyncGenerator<T, void, unknown> {
  const idleMs = options.idleMs ?? STREAM_IDLE_TIMEOUT_MS;
  const message = options.message ?? STREAM_IDLE_TIMEOUT_MESSAGE;
  const { signal, abort } = options;
  const iterator = source[Symbol.asyncIterator]();

  while (!signal.aborted) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const nextPromise = iterator.next().then((result) => ({ kind: 'next' as const, result }));
    const idlePromise = new Promise<{ kind: 'idle' }>((resolve) => {
      timer = setTimeout(() => resolve({ kind: 'idle' }), idleMs);
    });

    let raced: { kind: 'next'; result: IteratorResult<T> } | { kind: 'idle' };
    try {
      raced = await Promise.race([nextPromise, idlePromise]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }

    if (raced.kind === 'idle') {
      abort?.();
      throw new Error(message);
    }

    if (raced.result.done) return;
    yield raced.result.value;
  }
}

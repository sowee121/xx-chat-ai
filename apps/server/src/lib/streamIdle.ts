/**
 * SSE / provider 流空闲超时：两次产出间隔过长则中止
 */

/** 两次流式产出之间的最长等待（毫秒）；仅用于非 Mock provider */
export const STREAM_IDLE_TIMEOUT_MS = 60_000;

/** 面向用户的超时文案 */
export const STREAM_IDLE_TIMEOUT_MESSAGE = '响应超时，请稍后重试或更换模型';

/** 是否为中止类错误（无 HTTP 响应体） */
function isAbortLikeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError' || err.name === 'APIUserAbortError') return true;
  return /aborted/i.test(err.message);
}

/**
 * 包装异步迭代器：若 next() 超过 idleMs 未返回则先 abort 上游再抛超时文案。
 * next() 因 abort 产生的拒绝转为「超时文案」或安静结束，避免盖住空闲超时。
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
    let idleFired = false;

    const nextPromise = iterator.next().then(
      (result) => ({ kind: 'next' as const, result }),
      (error: unknown) => ({ kind: 'error' as const, error }),
    );
    const idlePromise = new Promise<{ kind: 'idle' }>((resolve) => {
      timer = setTimeout(() => resolve({ kind: 'idle' }), idleMs);
    });

    let raced:
      | { kind: 'next'; result: IteratorResult<T> }
      | { kind: 'idle' }
      | { kind: 'error'; error: unknown };
    try {
      raced = await Promise.race([nextPromise, idlePromise]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }

    if (raced.kind === 'idle') {
      idleFired = true;
      abort?.();
      // abort 后 next() 通常会以 APIUserAbortError 拒绝，吞掉以免覆盖超时文案 / unhandledRejection
      void nextPromise.then(
        () => undefined,
        () => undefined,
      );
      throw new Error(message);
    }

    if (raced.kind === 'error') {
      if (signal.aborted || isAbortLikeError(raced.error)) {
        // 客户端断开 / 用户停止：结束生成即可
        return;
      }
      throw raced.error;
    }

    // 理论上 idle 后不应走到这里；防御性保留
    if (idleFired) throw new Error(message);

    if (raced.result.done) return;
    yield raced.result.value;
  }
}

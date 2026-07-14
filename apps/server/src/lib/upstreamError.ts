/**
 * 上游大模型 / 中转站错误归一化：用户见模糊中文，原始 type/message 另附 detail。
 * 综合 status、error.type、英文关键字启发式分类（跨供应商非精确契约）。
 */
import OpenAI from 'openai';
import { inspect } from 'node:util';

export type UpstreamErrorContext = {
  model?: string;
  /** 日志前缀，默认 upstream */
  source?: string;
};

/** 面向用户的上游错误：中文 message + 可选 `type: message` 明细 */
export class UpstreamUserError extends Error {
  readonly detail?: string;

  constructor(message: string, detail?: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'UpstreamUserError';
    this.detail = detail;
  }
}

/** 上游错误大类（仅用于选中文文案） */
export type UpstreamErrorCategory =
  | 'auth'
  | 'rate_quota'
  | 'not_found'
  | 'invalid_request'
  | 'server'
  | 'unknown';

const CATEGORY_USER_MESSAGE: Record<UpstreamErrorCategory, string> = {
  auth: '鉴权或权限有问题，请检查 API Key 配置',
  rate_quota: '请求过多或额度不足，请稍后重试',
  not_found: '模型或接口不可用，请检查模型名称或端点配置',
  invalid_request: '请求参数有误，请检查模型或内容后重试',
  server: '模型服务暂时不可用，请稍后重试',
  unknown: '请求失败，请稍后重试',
};

/** 正文里是否命中任一关键字（不区分大小写） */
function haystackHas(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * 综合 status / type / message 英文关键字判定大类。
 * 优先级：明确 type → message 关键字 → status 兜底。
 */
export function classifyUpstreamError(input: {
  status?: number;
  type?: string;
  message?: string;
}): UpstreamErrorCategory {
  const type = (input.type ?? '').trim().toLowerCase();
  const message = (input.message ?? '').trim().toLowerCase();
  const blob = `${type} ${message}`.trim();
  const status = input.status;

  // 1) 文档常见 error.type（白山等 OpenAI 兼容）
  if (
    type === 'authentication_error' ||
    type === 'permission_error' ||
    type === 'invalid_api_key'
  ) {
    return 'auth';
  }
  if (type === 'rate_limit_error' || type === 'insufficient_quota') {
    return 'rate_quota';
  }
  if (type === 'invalid_request' || type === 'invalid_request_error') {
    return 'invalid_request';
  }
  if (type === 'server_error' || type === 'api_error') {
    return 'server';
  }
  if (type === 'not_found_error' || type === 'model_not_found') {
    return 'not_found';
  }

  // 2) message / type 英文关键字
  if (
    haystackHas(blob, [
      'authentication',
      'unauthorized',
      'invalid api key',
      'incorrect api key',
      'invalid_api_key',
      'api key',
      'permission denied',
      'forbidden',
      'access denied',
    ])
  ) {
    return 'auth';
  }
  if (
    haystackHas(blob, [
      'rate limit',
      'rate_limit',
      'too many requests',
      'quota',
      'billing',
      'insufficient_quota',
      'exceeded your current quota',
    ])
  ) {
    return 'rate_quota';
  }
  if (
    haystackHas(blob, [
      'model_not_found',
      'does not exist',
      'not found',
      'no such model',
      'unknown model',
    ])
  ) {
    return 'not_found';
  }
  if (
    haystackHas(blob, [
      'invalid_request',
      'invalid request',
      'missing required',
      'bad request',
      'validation',
      'malformed',
      'unsupported',
    ])
  ) {
    return 'invalid_request';
  }
  if (
    haystackHas(blob, [
      'internal server',
      'server_error',
      'service unavailable',
      'overloaded',
      'temporarily unavailable',
      'bad gateway',
      'gateway timeout',
    ])
  ) {
    return 'server';
  }

  // 3) HTTP status 兜底（跨供应商语义不保证）
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_quota';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status != null && status >= 500) return 'server';

  return 'unknown';
}

/** 综合 status + 响应体字段给出大类中文提示 */
export function userMessageForUpstreamError(input: {
  status?: number;
  type?: string;
  message?: string;
}): string {
  return CATEGORY_USER_MESSAGE[classifyUpstreamError(input)];
}

/** 拼装上游明细：`type: message`；缺一则只返回有值的一侧 */
export function formatUpstreamDetail(type?: string, message?: string): string | undefined {
  const t = type?.trim();
  const m = message?.trim();
  if (t && m) return `${t}: ${m}`;
  if (m) return m;
  if (t) return t;
  return undefined;
}

type OpenaiApiError = InstanceType<typeof OpenAI.APIError>;

/** SDK / 本地 abort，无 HTTP 错误体 */
function isAbortLikeError(err: unknown): boolean {
  if (err instanceof OpenAI.APIUserAbortError) return true;
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError' || err.name === 'APIUserAbortError') return true;
  return /request was aborted/i.test(err.message);
}

/** 从 OpenAI SDK / 兼容错误中尽量取出 type 字段 */
function extractUpstreamType(err: OpenaiApiError): string | undefined {
  const anyErr = err as OpenaiApiError & {
    type?: string;
    code?: string;
    error?: { type?: string; code?: string; message?: string };
  };
  return anyErr.error?.type ?? anyErr.type ?? anyErr.error?.code ?? anyErr.code ?? undefined;
}

/** 优先用嵌套 error.message，否则用 SDK 扁平 message */
function extractUpstreamMessage(err: OpenaiApiError): string | undefined {
  const anyErr = err as OpenaiApiError & {
    error?: { message?: string };
  };
  const nested = anyErr.error?.message?.trim();
  if (nested) return nested;
  return err.message?.trim() || undefined;
}

/** SDK 错误上这些上游字段是否至少有一个有值 */
function hasUsefulUpstreamFields(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  return ['status', 'headers', 'requestID', 'error', 'code', 'param', 'type'].some(
    (k) => e[k] !== undefined && e[k] !== null,
  );
}

/** 有有效上游字段时才原样打印；全是 undefined 则跳过（如 APIUserAbortError） */
function logRawUpstream(err: unknown, ctx?: UpstreamErrorContext): void {
  const body =
    err && typeof err === 'object' && 'error' in err
      ? (err as { error?: unknown }).error
      : undefined;

  if (!hasUsefulUpstreamFields(err) && body === undefined) return;

  const source = ctx?.source ?? 'upstream';
  console.error(
    `[${source}] raw error\n${inspect(err, {
      depth: 8,
      colors: false,
      getters: true,
      showHidden: false,
    })}`,
  );

  if (body !== undefined) {
    console.error(`[${source}] upstream body\n${JSON.stringify(body, null, 2)}`);
  }

  if (ctx?.model) {
    console.error(`[${source}] model: ${ctx.model}`);
  }
}

/**
 * 将上游 SDK 错误转为 UpstreamUserError；中止类原样返回；
 * 真实 HTTP 错误写入全量日志与 Error.cause。
 */
export function normalizeUpstreamError(
  err: unknown,
  ctx?: UpstreamErrorContext,
): Error {
  if (isAbortLikeError(err)) {
    const abortErr = err instanceof Error ? err : new Error(String(err));
    logRawUpstream(abortErr, ctx);
    // 统一成 AbortError，便于上层按「用户/超时中止」处理
    if (abortErr.name === 'AbortError') return abortErr;
    const normalized = new Error(abortErr.message);
    normalized.name = 'AbortError';
    normalized.cause = abortErr;
    return normalized;
  }

  if (err instanceof OpenAI.APIError) {
    logRawUpstream(err, ctx);
    const type = extractUpstreamType(err);
    const rawMessage = extractUpstreamMessage(err);
    return new UpstreamUserError(
      userMessageForUpstreamError({ status: err.status, type, message: rawMessage }),
      formatUpstreamDetail(type, rawMessage),
      err,
    );
  }

  if (err instanceof Error) return err;
  return new Error('模型服务请求失败，请稍后重试');
}

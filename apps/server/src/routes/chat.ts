/**
 * 聊天 SSE 路由：流式推送与落库（重新生成按 keepMessageCount 截断后续，不追加 user）
 */
import type { FastifyInstance } from 'fastify';
import { withStreamIdleTimeout } from '../lib/streamIdle.js';
import { aggregateStreamChunks } from '../lib/streamAggregate.js';
import { stripThinkingTags } from '../lib/thinkingParser.js';
import { UpstreamUserError } from '../lib/upstreamError.js';
import { GENERATION_STOPPED_MESSAGE } from '../lib/generationStopped.js';
import { getDefaultProvider } from '../providers/config.js';
import { getProvider } from '../providers/index.js';
import { SessionNotFoundError } from '../store/history.js';
import { historyStore } from '../store/sqlite.js';
import type { ChatRequestBody, StreamChunk } from '../types.js';

/** 请求体 JSON Schema（Fastify 校验） */
const bodySchema = {
  type: 'object',
  required: ['query'],
  additionalProperties: false,
  properties: {
    query: { type: 'string', minLength: 1 },
    sessionCode: { type: 'string' },
    provider: { type: 'string', enum: ['mock', 'openai'] },
    model: { type: 'string', minLength: 1 },
    regenerate: { type: 'boolean' },
    keepMessageCount: { type: 'integer', minimum: 0 },
    messages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['system', 'user', 'assistant'] },
          content: { type: 'string' },
        },
      },
    },
  },
};

/** 仅有推理、无正文时落库占位，避免刷新后 assistant 行丢失
 * 文案须与前端 `apps/web/src/lib/reasoningPlaceholder.ts` 保持一致
 */
const REASONING_ONLY_PLACEHOLDER = '（本轮无正文输出）';

/** 决定 assistant 落库正文：有 text 用 text；仅推理则占位；皆无则不落库 */
function resolveAssistantContent(textToSave: string, hadReasoning: boolean): string | null {
  if (textToSave) return textToSave;
  if (hadReasoning) return REASONING_ONLY_PLACEHOLDER;
  return null;
}

/** 有可保存内容时写入 assistant（含可选 reasoning 列） */
function persistAssistantIfAny(
  sessionCode: string,
  fullText: string,
  fullReasoning: string,
  hadReasoning: boolean,
): number | null {
  const contentToSave = resolveAssistantContent(stripThinkingTags(fullText), hadReasoning);
  if (!contentToSave) return null;
  const reasoningToSave = fullReasoning.trim() ? fullReasoning : undefined;
  return historyStore.appendMessage(sessionCode, 'assistant', contentToSave, {
    reasoning: reasoningToSave,
  });
}

/**
 * 业务错误 / 超时：保留 user，写入 assistant（可含 partial）+ 独立错误字段
 * content 可为空串；errorMessage 为面向用户中文，errorDetail 为上游明细
 */
function persistAssistantOnError(
  sessionCode: string,
  fullText: string,
  fullReasoning: string,
  hadReasoning: boolean,
  errorMessage: string,
  errorDetail?: string,
): number {
  const stripped = stripThinkingTags(fullText);
  const contentToSave =
    stripped || (hadReasoning ? REASONING_ONLY_PLACEHOLDER : '');
  const reasoningToSave = fullReasoning.trim() ? fullReasoning : undefined;
  return historyStore.appendMessage(sessionCode, 'assistant', contentToSave, {
    reasoning: reasoningToSave,
    errorMessage,
    errorDetail,
  });
}

/** 注册聊天 SSE 路由*/
export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ChatRequestBody }>(
    '/api/chat',
    { schema: { body: bodySchema } },
    async (request, reply) => {
      const body = request.body;
      const provider = body.provider ?? getDefaultProvider();
      const regenerate = Boolean(body.regenerate);

      // 重新生成必须带已有 sessionCode，且不走新建会话
      if (regenerate && !body.sessionCode) {
        return reply.code(400).send({ error: '重新生成需要 sessionCode' });
      }
      if (regenerate && typeof body.keepMessageCount !== 'number') {
        return reply.code(400).send({ error: '重新生成需要 keepMessageCount' });
      }

      let session;
      try {
        session = historyStore.ensureSession(body.sessionCode, body.query);
      } catch (err) {
        // 传入已删除/不存在的 sessionCode：在 hijack 前返回 HTTP 404
        if (err instanceof SessionNotFoundError) {
          return reply.code(404).send({ error: '对话不存在或已删除' });
        }
        throw err;
      }

      if (regenerate) {
        // 截断：保留 keepMessageCount 条（含触发重生的 user），删除该助手及后续；不追加 user
        historyStore.truncateMessagesAfter(session.sessionCode, body.keepMessageCount!);
      } else {
        historyStore.appendMessage(session.sessionCode, 'user', body.query);
      }

      const ac = new AbortController();

      // 接管原始响应以手写 SSE；客户端断开时 abort provider
      reply.hijack();
      const raw = reply.raw;
      raw.on('close', () => {
        if (!raw.writableFinished) ac.abort();
      });
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const send = (event: string, data: unknown): boolean => {
        if (raw.writableEnded || raw.destroyed) return false;
        return raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      send('meta', { sessionCode: session.sessionCode, title: session.title });

      const streamedDeltas: StreamChunk[] = [];

      try {
        const stream = getProvider(provider)({
          query: body.query,
          messages: body.messages ?? [],
          signal: ac.signal,
          model: body.model,
        });

        const deltaSource =
          provider === 'mock'
            ? stream
            : withStreamIdleTimeout(stream, { signal: ac.signal, abort: () => ac.abort() });

        for await (const delta of deltaSource) {
          if (ac.signal.aborted) break;
          streamedDeltas.push(delta);
          send('delta', delta);
        }

        const { fullText, fullReasoning, hadReasoning } = aggregateStreamChunks(streamedDeltas);
        const completed = !ac.signal.aborted;

        const assistantId = persistAssistantIfAny(
          session.sessionCode,
          fullText,
          fullReasoning,
          hadReasoning,
        );
        // 用户停止且无任何产出：写入软提示，避免历史只剩 user
        if (!completed && assistantId == null) {
          historyStore.appendMessage(session.sessionCode, 'assistant', '', {
            statusMessage: GENERATION_STOPPED_MESSAGE,
          });
        }

        if (completed) {
          send('done', {
            sessionCode: session.sessionCode,
            finishReason: 'stop',
          });
        }
      } catch (err) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const { fullText, fullReasoning, hadReasoning } = aggregateStreamChunks(streamedDeltas);

        if (isAbort) {
          // 用户停止 / 客户端断开：有产出落 partial；无产出写「已停止生成」提示
          const assistantId = persistAssistantIfAny(
            session.sessionCode,
            fullText,
            fullReasoning,
            hadReasoning,
          );
          if (assistantId == null) {
            historyStore.appendMessage(session.sessionCode, 'assistant', '', {
              statusMessage: GENERATION_STOPPED_MESSAGE,
            });
          }
          ac.abort();
        } else {
          request.log.error(
            {
              err,
              upstreamCause: err instanceof Error ? err.cause : undefined,
            },
            'chat stream failed',
          );
          const message = err instanceof Error ? err.message : 'stream error';
          const detail = err instanceof UpstreamUserError ? err.detail : undefined;
          // 保留 user，失败态写入独立 error_* 字段（可带 partial 正文）
          persistAssistantOnError(
            session.sessionCode,
            fullText,
            fullReasoning,
            hadReasoning,
            message,
            detail,
          );
          ac.abort();
          send('error', detail ? { message, detail } : { message });
        }
      } finally {
        if (!raw.writableEnded) raw.end();
      }
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { stripThinkingTags } from '../lib/thinkingParser.js';
import { getDefaultProvider } from '../providers/config.js';
import { getProvider } from '../providers/index.js';
import { historyStore } from '../store/sqlite.js';
import type { ChatRequestBody } from '../types.js';

const bodySchema = {
  type: 'object',
  required: ['query'],
  additionalProperties: false,
  properties: {
    query: { type: 'string', minLength: 1 },
    sessionCode: { type: 'string' },
    provider: { type: 'string', enum: ['mock', 'openai'] },
    model: { type: 'string', minLength: 1 },
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

/** 仅有推理、无正文时落库占位，避免刷新后 assistant 行丢失（BUG-01） */
const REASONING_ONLY_PLACEHOLDER = '（本轮无正文输出）';

function resolveAssistantContent(textToSave: string, hadReasoning: boolean): string | null {
  if (textToSave) return textToSave;
  if (hadReasoning) return REASONING_ONLY_PLACEHOLDER;
  return null;
}

function persistAssistantIfAny(
  sessionCode: string,
  fullText: string,
  hadReasoning: boolean,
): void {
  const contentToSave = resolveAssistantContent(stripThinkingTags(fullText), hadReasoning);
  if (contentToSave) historyStore.appendMessage(sessionCode, 'assistant', contentToSave);
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ChatRequestBody }>(
    '/api/chat',
    { schema: { body: bodySchema } },
    async (request, reply) => {
      const body = request.body;
      const provider = body.provider ?? getDefaultProvider();

      const session = historyStore.ensureSession(body.sessionCode, body.query);
      historyStore.appendMessage(session.sessionCode, 'user', body.query);

      const ac = new AbortController();

      reply.hijack();
      const raw = reply.raw;
      // 客户端断开（如前端 AbortController 停止）时，响应 socket 关闭且未正常结束 → 中止生成
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

      let fullText = '';
      let hadReasoning = false;
      try {
        const stream = getProvider(provider)({
          query: body.query,
          messages: body.messages ?? [],
          signal: ac.signal,
          model: body.model,
        });

        for await (const delta of stream) {
          if (ac.signal.aborted) break;
          if (delta.type === 'reasoning') hadReasoning = true;
          if (delta.type === 'text') fullText += delta.content;
          send('delta', delta);
        }

        if (ac.signal.aborted) {
          // 客户端主动停止：连接已断，仅持久化已生成内容
          persistAssistantIfAny(session.sessionCode, fullText, hadReasoning);
        } else {
          persistAssistantIfAny(session.sessionCode, fullText, hadReasoning);
          send('done', { sessionCode: session.sessionCode, finishReason: 'stop' });
        }
      } catch (err) {
        request.log.error(err);
        // 流式中途报错：仍持久化已生成的 partial（BUG-03）
        persistAssistantIfAny(session.sessionCode, fullText, hadReasoning);
        send('error', { message: err instanceof Error ? err.message : 'stream error' });
      } finally {
        if (!raw.writableEnded) raw.end();
      }
    },
  );
}

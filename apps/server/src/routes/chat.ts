import type { FastifyInstance } from 'fastify';
import { resolveRequestModel } from '../lib/resolveModel.js';
import { aggregateStreamChunks, pacedReplayStream } from '../lib/streamReplay.js';
import { stripThinkingTags } from '../lib/thinkingParser.js';
import { getDefaultProvider } from '../providers/config.js';
import { getProvider } from '../providers/index.js';
import { historyStore } from '../store/sqlite.js';
import type { ChatRequestBody, StreamChunk } from '../types.js';

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
  fullReasoning: string,
  hadReasoning: boolean,
): number | null {
  const contentToSave = resolveAssistantContent(stripThinkingTags(fullText), hadReasoning);
  if (!contentToSave) return null;
  const reasoningToSave = fullReasoning.trim() ? fullReasoning : undefined;
  return historyStore.appendMessage(sessionCode, 'assistant', contentToSave, reasoningToSave);
}

function saveReplayCacheIfComplete(
  messageId: number | null,
  provider: string,
  model: string,
  deltas: StreamChunk[],
  completed: boolean,
): void {
  if (!completed || messageId == null || deltas.length === 0) return;
  historyStore.saveStreamCache(messageId, provider, model, deltas);
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ChatRequestBody }>(
    '/api/chat',
    { schema: { body: bodySchema } },
    async (request, reply) => {
      const body = request.body;
      const provider = body.provider ?? getDefaultProvider();
      const model = resolveRequestModel(provider, body.model);

      const session = historyStore.ensureSession(body.sessionCode, body.query);
      const replayDeltas = historyStore.findReplayDeltas(
        session.sessionCode,
        body.query,
        provider,
        model,
      );

      historyStore.appendMessage(session.sessionCode, 'user', body.query);

      const ac = new AbortController();

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
        if (replayDeltas) {
          for await (const delta of pacedReplayStream(replayDeltas, ac.signal)) {
            if (ac.signal.aborted) break;
            streamedDeltas.push(delta);
            send('delta', delta);
          }
        } else {
          const stream = getProvider(provider)({
            query: body.query,
            messages: body.messages ?? [],
            signal: ac.signal,
            model: body.model,
          });

          for await (const delta of stream) {
            if (ac.signal.aborted) break;
            streamedDeltas.push(delta);
            send('delta', delta);
          }
        }

        const { fullText, fullReasoning, hadReasoning } = aggregateStreamChunks(streamedDeltas);
        const completed = !ac.signal.aborted;

        const assistantId = persistAssistantIfAny(
          session.sessionCode,
          fullText,
          fullReasoning,
          hadReasoning,
        );
        saveReplayCacheIfComplete(
          assistantId,
          provider,
          model,
          replayDeltas ?? streamedDeltas,
          completed,
        );

        if (completed) {
          send('done', {
            sessionCode: session.sessionCode,
            finishReason: 'stop',
            replayed: Boolean(replayDeltas),
          });
        }
      } catch (err) {
        request.log.error(err);
        const { fullText, fullReasoning, hadReasoning } = aggregateStreamChunks(streamedDeltas);
        persistAssistantIfAny(session.sessionCode, fullText, fullReasoning, hadReasoning);
        send('error', { message: err instanceof Error ? err.message : 'stream error' });
      } finally {
        if (!raw.writableEnded) raw.end();
      }
    },
  );
}

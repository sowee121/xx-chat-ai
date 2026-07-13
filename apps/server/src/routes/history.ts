/**
 * 历史对话 CRUD：列表、详情、删除与批量删除。
 */
import type { FastifyInstance } from 'fastify';
import { historyStore } from '../store/sqlite.js';

export async function historyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/history', async () => {
    return { sessions: historyStore.listSessions() };
  });

  app.get<{ Params: { sessionCode: string } }>(
    '/api/history/:sessionCode',
    async (request, reply) => {
      const session = historyStore.getSession(request.params.sessionCode);
      if (!session) {
        return reply.code(404).send({ error: 'session not found' });
      }
      return session;
    },
  );

  app.delete<{ Params: { sessionCode: string } }>(
    '/api/history/:sessionCode',
    async (request) => {
      historyStore.deleteSession(request.params.sessionCode);
      return { ok: true };
    },
  );

  app.post<{ Body: { sessionCodes?: string[] } }>(
    '/api/history/batch-delete',
    async (request, reply) => {
      const sessionCodes = request.body?.sessionCodes;
      if (!Array.isArray(sessionCodes) || sessionCodes.length === 0) {
        return reply.code(400).send({ error: 'sessionCodes required' });
      }
      if (!sessionCodes.every((c) => typeof c === 'string' && c.length > 0)) {
        return reply.code(400).send({ error: 'invalid sessionCodes' });
      }
      historyStore.deleteSessions(sessionCodes);
      return { ok: true, deleted: sessionCodes.length };
    },
  );
}

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
}

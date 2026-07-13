/**
 * Provider / 模型列表 API。
 */
import type { FastifyInstance } from 'fastify';
import {
  getDefaultProvider,
  getOpenaiDefaultModel,
  isOpenaiConfigured,
  listProviders,
} from '../providers/config.js';
import { listOpenaiModels } from '../providers/openai.js';

export async function providerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/providers', async () => {
    return {
      defaultProvider: getDefaultProvider(),
      defaultModel: getOpenaiDefaultModel(),
      providers: listProviders(),
    };
  });

  app.get('/api/providers/openai/models', async (_request, reply) => {
    if (!isOpenaiConfigured()) {
      return reply.code(503).send({ error: 'OpenAI API 未配置' });
    }
    try {
      const models = await listOpenaiModels();
      return { models, defaultModel: getOpenaiDefaultModel() };
    } catch (err) {
      return reply.code(502).send({
        error: err instanceof Error ? err.message : '获取模型列表失败',
      });
    }
  });
}

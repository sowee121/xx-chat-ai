/**
 * Fastify 服务入口：注册路由、健康检查与静态资源（若有）
 */
import Fastify from 'fastify';
import { listProviders } from './providers/config.js';
import { chatRoutes } from './routes/chat.js';
import { historyRoutes } from './routes/history.js';
import { providerRoutes } from './routes/providers.js';

const PORT = Number(process.env.XX_PORT ?? 3001);
const isProd = process.env.NODE_ENV === 'production';

const app = Fastify({
  logger: isProd
    ? true
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      },
});

/** 健康检查，供本地与部署探活 */
app.get('/api/health', async () => {
  return { status: 'ok', service: 'xx-chat-ai', ts: Date.now() };
});

await app.register(chatRoutes);
await app.register(historyRoutes);
await app.register(providerRoutes);

/** 启动时打印各 Provider 可用性，便于排查配置 */
const providers = listProviders();
for (const p of providers) {
  app.log.info(
    `provider ${p.id}: ${p.available ? 'ready' : 'unavailable'}${p.reason ? ` (${p.reason})` : ''}`,
  );
}

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`XX Chat AI server listening at ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

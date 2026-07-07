import Fastify from 'fastify';
import { listProviders } from './providers/config.js';
import { chatRoutes } from './routes/chat.js';
import { historyRoutes } from './routes/history.js';
import { providerRoutes } from './routes/providers.js';

const PORT = Number(process.env.PORT ?? 3001);

const app = Fastify({ logger: true });

app.get('/api/health', async () => {
  return { status: 'ok', service: 'xx-chat-ai', ts: Date.now() };
});

await app.register(chatRoutes);
await app.register(historyRoutes);
await app.register(providerRoutes);

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

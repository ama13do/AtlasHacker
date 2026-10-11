import { serve } from '@hono/node-server';
import { app } from './app.js';
import { initEnv } from './config/env.js';
import { cerrarDb } from './db/client.js';

const e = await initEnv();

const servidor = serve({ fetch: app.fetch, port: e.PORT }, (info) => {
  console.log(`AtlasHacker API en http://localhost:${info.port}`);
  console.log(`Health:  http://localhost:${info.port}/health`);
  if (e.DOCS_ENABLED) console.log(`Swagger: http://localhost:${info.port}/docs  (usuario y contraseña del dashboard)`);
});

const apagar = async () => {
  servidor.close();
  await cerrarDb();
  process.exit(0);
};
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);

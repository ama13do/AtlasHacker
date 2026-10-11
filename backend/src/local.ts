import { serve } from '@hono/node-server';
import { app } from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 AtlasHacker Backend iniciado en modo local`);
console.log(`📍 URL: http://localhost:${port}`);
console.log(`🗺️ Healthcheck: http://localhost:${port}/health`);

serve({
  fetch: app.fetch,
  port,
});

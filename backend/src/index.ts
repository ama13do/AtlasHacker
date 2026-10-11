import { handle } from 'hono/aws-lambda';
import { app } from './app.js';

// Handler principal para AWS Lambda + API Gateway
export const handler = handle(app);

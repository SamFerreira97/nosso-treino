import { env } from 'cloudflare:workers';
import { handleSync } from '../../../lib/sync-server.mjs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleSync(request, env.DB);
export const POST = (request: Request) => handleSync(request, env.DB);

import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/apiApp.js';

const app = createApiApp();

export default function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    const vpath = parsed.searchParams.get('__vpath');
    if (vpath !== null) {
      parsed.searchParams.delete('__vpath');
      const qs = parsed.searchParams.toString();
      req.url = `/api/${vpath}${qs ? `?${qs}` : ''}`;
    }
  } catch {
    // Keep original req.url if parsing fails
  }

  return app(req as any, res as any);
}

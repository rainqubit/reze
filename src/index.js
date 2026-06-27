import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();

// Serve static files from /public
app.use('/*', serveStatic({ root: './src/public' }));

// GET /api/upload handler
app.get('/api/upload', (c) => {
  return c.json({
    message: 'Upload endpoint is ready',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

const port = 3000;
console.log(`Server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});


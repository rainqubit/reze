import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

import uploadRoutes from './routes/upload.js';
import writeRoutes from './routes/write.js';
import readingsRoutes from './routes/readings.js';

const app = new Hono();

// ── Logger middleware for all API calls ────────────────────────────
app.use('/api/*', async (c, next) => {
  const start = performance.now();
  const { method } = c.req;
  const path = c.req.path;

  try {
    await next();
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    console.error(`[${new Date().toISOString()}] ${method} ${path} → ERROR (${ms}ms):`, err);
    throw err; // re-throw so onError or route handler can produce the response
  }

  const ms = Math.round(performance.now() - start);
  console.log(`[${new Date().toISOString()}] ${method} ${path} → ${c.res.status} (${ms}ms)`);
});

// ── Global error handler for unhandled exceptions ──────────────────
app.onError((err, c) => {
  console.error(`[${new Date().toISOString()}] Unhandled error for ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Redirect old /dashboard.html to root
app.get('/dashboard.html', (c) => c.redirect('/'));

// Serve static files from /public
app.use('/*', serveStatic({ root: './src/public' }));

// API routes
app.route('/api', uploadRoutes);
app.route('/api', writeRoutes);
app.route('/api', readingsRoutes);

const port = 3000;
console.log(`[${new Date().toISOString()}] Server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});


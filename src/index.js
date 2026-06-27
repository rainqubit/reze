import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

import uploadRoutes from './routes/upload.js';
import writeRoutes from './routes/write.js';
import readingsRoutes from './routes/readings.js';

const app = new Hono();

// Redirect old /dashboard.html to root
app.get('/dashboard.html', (c) => c.redirect('/'));

// Serve static files from /public
app.use('/*', serveStatic({ root: './src/public' }));

// API routes
app.route('/api', uploadRoutes);
app.route('/api', writeRoutes);
app.route('/api', readingsRoutes);

const port = 3000;
console.log(`Server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});


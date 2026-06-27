import { Hono } from 'hono';

const router = new Hono();

// GET /api/upload — health-check / placeholder for future upload endpoint
router.get('/upload', (c) => {
  return c.json({
    message: 'Upload endpoint is ready',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;

import { readFile } from 'node:fs/promises';
import { resolve, normalize } from 'node:path';
import { existsSync } from 'node:fs';
import { Hono } from 'hono';

const router = new Hono();

// GET /api/readings?path=sensors.txt  — returns all parsed readings from a data file
router.get('/readings', async (c) => {
  try {
    const filePath = c.req.query('path') || 'sensors.txt';

    // Resolve the file path into the <project>/data/ directory
    const baseDir = resolve(process.cwd(), 'data');
    const fullPath = normalize(resolve(baseDir, filePath));

    // Security: prevent directory traversal
    if (!fullPath.startsWith(baseDir)) {
      return c.json({ error: 'Path traversal is not allowed' }, 403);
    }

    if (!existsSync(fullPath)) {
      return c.json({ readings: [], file: filePath, message: 'No data yet' });
    }

    const raw = await readFile(fullPath, 'utf-8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    const readings = lines.map((line) => {
      const parts = line.split('|');
      const time = parts.at(-1).trim();
      const fields = parts.slice(0, -1).map((seg) => {
        const spaceIdx = seg.indexOf(' ');
        if (spaceIdx === -1) {
          return { name: seg.trim(), value: '' };
        }
        return {
          name: seg.slice(0, spaceIdx).trim(),
          value: seg.slice(spaceIdx + 1).trim(),
        };
      });
      return { fields, time };
    });

    return c.json({
      file: filePath,
      total: readings.length,
      readings,
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default router;

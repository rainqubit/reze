import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import { Hono } from 'hono';

const router = new Hono();

// Read the data file path from config.json at startup
let dataFile = 'sensors.txt';
try {
  const configPath = resolve(process.cwd(), 'src', 'public', 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  if (config.dataFile) dataFile = config.dataFile;
} catch (_) {
  // Fall back to default if config cannot be read
}

// GET /api/readings?path=sensors.txt  — returns all parsed readings from a data file
// If no path query param is provided, the file configured in /config.json (dataFile) is used.
router.get('/readings', async (c) => {
  try {
    const filePath = c.req.query('path') || dataFile;
    const range = c.req.query('range') || '24h';
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const rangeSecs = {
      '6h': 21600,
      '12h': 43200,
      '24h': 86400,
      '72h': 259200,
      '168h': 604800,
      'all': Infinity
    };
    const maxAge = rangeSecs[range] || 86400;

    const baseDir = resolve(process.cwd(), 'data');
    const fullPath = normalize(resolve(baseDir, filePath));

    if (!fullPath.startsWith(baseDir)) {
      return c.json({ error: 'Path traversal is not allowed' }, 403);
    }

    if (!existsSync(fullPath)) {
      return c.json({ readings: [], file: filePath, message: 'No data yet' });
    }

    const raw = await readFile(fullPath, 'utf-8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    const allReadings = lines.map((line) => {
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

    // Filter by time range
    let filteredReadings = allReadings;
    if (filteredReadings.length > 0 && maxAge !== Infinity) {
      const latestTime = parseInt(filteredReadings[filteredReadings.length - 1].time, 10);
      filteredReadings = filteredReadings.filter((r) => {
        return (latestTime - parseInt(r.time, 10)) <= maxAge;
      });
    }

    const total = filteredReadings.length;

    // Apply pagination (newest first for slicing, but we want the returned page to be oldest-first for chart)
    filteredReadings.reverse();
    const paginatedReadings = filteredReadings.slice(offset, offset + limit);
    paginatedReadings.reverse();

    const hasMore = offset + limit < total;

    return c.json({
      file: filePath,
      total,
      hasMore,
      readings: paginatedReadings,
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default router;

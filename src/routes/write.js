import { writeFile, appendFile, mkdir } from 'node:fs/promises';
import { resolve, normalize, dirname } from 'node:path';
import { Hono } from 'hono';

const router = new Hono();

// POST /api/write — parses and writes sensor-style data to a file
//
// Expected data format:
//   name value|name value|name value|...|name value|time
//
// Examples:
//   "temp 25|humidity 80|zone 1|12:30"                   ← 3 fields + time
//   "temp 25|humidity 80|pressure 1013|zone 1|12:30"     ← 4 fields + time
//
// Body (JSON):  { "path": "sensors.txt", "data": "temp 25|humidity 80|pressure 1013|zone 1|12:30" }
// Query:       ?mode=append   (defaults to overwrite)
router.post('/write', async (c) => {
  try {
    const { path: filePath, data } = await c.req.json();

    // Validate required fields
    if (!filePath || typeof filePath !== 'string') {
      return c.json({ error: 'Missing or invalid "path" in request body' }, 400);
    }
    if (!data || typeof data !== 'string') {
      return c.json({ error: 'Missing or invalid "data" in request body (must be a string)' }, 400);
    }

    if (data.length === 0) {
      return c.json({ error: '"data" must not be empty' }, 400);
    }

    // ── Parse pipe-delimited data ──────────────────────────────────
    // Format:  field value|field value|...|field value|time
    const parts = data.split('|');
    if (parts.length < 3) {
      return c.json({
        error: '"data" must contain at least 2 name-value segments and a time segment separated by "|"',
        hint: 'Expected format: name value|name value|...|time  (e.g. "temp 25|zone 1|12:30")',
      }, 400);
    }

    // Last segment is the time, everything before it is name-value pairs
    const timeRaw = parts.at(-1).trim();
    const fields = parts.slice(0, -1);

    if (!timeRaw) {
      return c.json({ error: 'Time segment (last field) must not be empty' }, 400);
    }

    // Parse each name-value pair: must contain a space separating name from value
    const parsedFields = [];
    for (let i = 0; i < fields.length; i++) {
      const raw = fields[i];
      const spaceIdx = raw.indexOf(' ');
      if (spaceIdx === -1) {
        return c.json({
          error: `Segment ${i + 1} ("${raw}") is not a valid name-value pair`,
          hint: 'Each name-value segment must contain a space, e.g. "temp 25"',
        }, 400);
      }
      parsedFields.push({
        name: raw.slice(0, spaceIdx).trim(),
        value: raw.slice(spaceIdx + 1).trim(),
      });
    }

    // ── Build the line to write ────────────────────────────────────
    const fieldLine = parsedFields.map((f) => `${f.name} ${f.value}`).join('|');
    const content = `${fieldLine}|${timeRaw}\n`;

    // Resolve the file path into the <project>/data/ directory
    const baseDir = resolve(process.cwd(), 'data');
    const fullPath = normalize(resolve(baseDir, filePath));

    // Security: prevent directory traversal
    if (!fullPath.startsWith(baseDir)) {
      return c.json({ error: 'Path traversal is not allowed' }, 403);
    }

    // Ensure the parent directory exists
    await mkdir(dirname(fullPath), { recursive: true });

    // Write or append
    const mode = c.req.query('mode') || 'overwrite';

    if (mode === 'append') {
      await appendFile(fullPath, content, 'utf-8');
    } else {
      await writeFile(fullPath, content, 'utf-8');
    }

    return c.json({
      status: 'ok',
      path: filePath,
      mode,
      bytesWritten: content.length,
      fields: parsedFields,
      time: timeRaw,
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return c.json({ error: 'Invalid JSON in request body' }, 400);
    }
    return c.json({ error: err.message }, 500);
  }
});

export default router;

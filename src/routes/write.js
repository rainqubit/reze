import { writeFile, appendFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, normalize, dirname } from 'node:path';
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

// POST /api/write — parses 3 sensor fields and writes them with a server timestamp
//
// The output file path is configured via /config.json (dataFile field).
// Default: sensors.txt
//
// Expected data format:
//   name value|name value|name value
//
// The server always appends the current Unix epoch timestamp (seconds)
// before writing. The dashboard formats it as "day month year hh:mm:ss".
//
// Exactly 3 pipe-separated name-value pairs are expected (temp1–temp3).
// No timestamp is sent by the client.
//
// Example data:
//   "temp1 22.5|temp2 18.3|temp3 25.1"
//
// Field names are mapped to display labels by the client via /config.json.
//
// Body (JSON):  { "data": "temp1 22.5|temp2 18.3|temp3 25.1" }
// Query:       ?mode=append   (defaults to overwrite)
router.post('/write', async (c) => {
  try {
    const { data } = await c.req.json();

    // Validate required fields
    if (!data || typeof data !== 'string') {
      return c.json({ error: 'Missing or invalid "data" in request body (must be a string)' }, 400);
    }

    if (data.length === 0) {
      return c.json({ error: '"data" must not be empty' }, 400);
    }

    // ── Parse 3 pipe-delimited name-value pairs ────────────────────
    const parts = data.split('|');
    if (parts.length !== 3) {
      return c.json({
        error: '"data" must contain exactly 3 pipe-separated name-value pairs (e.g. "temp1 22.5|temp2 18.3|temp3 25.1")',
      }, 400);
    }

    // Parse each name-value pair: must contain a space separating name from value
    const parsedFields = [];
    for (let i = 0; i < parts.length; i++) {
      const raw = parts[i];
      const spaceIdx = raw.indexOf(' ');
      if (spaceIdx === -1) {
        return c.json({
          error: `Segment ${i + 1} ("${raw}") is not a valid name-value pair`,
          hint: 'Each segment must contain a space, e.g. "temp 25"',
        }, 400);
      }
      parsedFields.push({
        name: raw.slice(0, spaceIdx).trim(),
        value: raw.slice(spaceIdx + 1).trim(),
      });
    }

    // ── Server always fills the timestamp ───────────────────────────
    const time = String(Math.floor(Date.now() / 1000));

    // ── Build the line to write ────────────────────────────────────
    const fieldLine = parsedFields.map((f) => `${f.name} ${f.value}`).join('|');
    const content = `${fieldLine}|${time}\n`;

    // Resolve the file path into the <project>/data/ directory
    const baseDir = resolve(process.cwd(), 'data');
    const fullPath = normalize(resolve(baseDir, dataFile));

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
      path: dataFile,
      mode,
      bytesWritten: content.length,
      fields: parsedFields,
      time,
      timeIsServer: true,
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return c.json({ error: 'Invalid JSON in request body' }, 400);
    }
    return c.json({ error: err.message }, 500);
  }
});

export default router;

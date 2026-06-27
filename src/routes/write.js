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

// POST /api/write — parses and writes sensor-style data to a file
//
// The output file path is configured via /config.json (dataFile field).
// Default: sensors.txt
//
// Expected data format:
//   name value|name value|...|name value|unix_timestamp
//
// If data ends with a pipe (|), the last segment is treated as the
// timestamp slot (may be empty — server fills it with current time).
// If data does NOT end with a pipe and has 3+ segments, the last
// segment is treated as the timestamp.
// Otherwise, no timestamp is expected and the server auto-fills it.
//
// The timestamp is a Unix epoch (seconds). The dashboard formats it
// as "day month year hh:mm:ss" automatically.
//
// Examples:
//   "temp1 22.5|temp2 18.3|temp3 25.1|m 3|1782637200"    ← 4 fields + epoch
//   "temp1 22.5|temp2 18.3|1782637200"                     ← 2 fields + epoch
//   "temp1 22.5|temp2 18.3|"                                ← 2 fields, explicit empty time slot
//   "temp1 22.5|temp2 18.3"                                 ← 2 fields, no time sent
//
// Field names (temp1, temp2, temp3, m, ...) are mapped to display labels
// by the client via /config.json.
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

    // ── Parse pipe-delimited data ──────────────────────────────────
    // Format:  field value|field value|...|field value|time
    const parts = data.split('|');
    const hasTrailingPipe = data.endsWith('|');

    // Require at least one field segment
    if (parts.length < 1 || (parts.length === 1 && !parts[0].includes(' '))) {
      return c.json({
        error: '"data" must contain at least one "name value" pair',
        hint: 'Expected format: name value|name value|...|time  (e.g. "temp 25|zone 1|12:30")',
      }, 400);
    }

    let time;
    let timeIsServer;
    let fields;

    if (hasTrailingPipe) {
      // Data ends with "|" — the last (possibly empty) segment is the timestamp slot
      time = parts.at(-1).trim();
      timeIsServer = !time;
      if (timeIsServer) time = String(Math.floor(Date.now() / 1000));
      fields = parts.slice(0, -1);
    } else if (parts.length >= 3) {
      // Traditional format: …|…|timestamp  (last segment is the timestamp)
      time = parts.at(-1).trim();
      timeIsServer = false;
      fields = parts.slice(0, -1);
    } else {
      // No timestamp sent — all parts are fields, server fills the time
      time = String(Math.floor(Date.now() / 1000));
      timeIsServer = true;
      fields = parts;
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
      timeIsServer,
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return c.json({ error: 'Invalid JSON in request body' }, 400);
    }
    return c.json({ error: err.message }, 500);
  }
});

export default router;

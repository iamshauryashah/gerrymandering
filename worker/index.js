import { MAX_SAVE_BYTES, validateMap } from '../src/map-save.js';

const CANONICAL = 'https://gerry.shauryaswebsites.com';
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const error = (message, status) => json({ message }, status);
export const MAX_MAPS = 20;

async function readBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw error('Use JSON to save a map.', 415);
  if (Number(request.headers.get('content-length')) > MAX_SAVE_BYTES) throw error('This map is too large to save.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw error('A map is required.', 400);
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_SAVE_BYTES) { await reader.cancel(); throw error('This map is too large to save.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw error('Invalid map data.', 400); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // The legacy domain cannot share first-party login cookies with the platform.
    if (url.hostname === 'gerry.shauryaswebsite.com') {
      return Response.redirect(CANONICAL + url.pathname + url.search, 308);
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!/^\/api\/maps(?:\/[a-f0-9-]{36})?$/.test(url.pathname)) return error('Not found.', 404);
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) return error('Method not allowed.', 405);
    const origin = request.headers.get('origin');
    // No cross-origin API access, and mutations always require an exact origin.
    if ((origin && origin !== url.origin) || (request.method !== 'GET' && origin !== url.origin)) return error('Forbidden origin.', 403);
    try {
      // Identity always comes from the existing auth service, never a client ID.
      const response = await env.AUTH.fetch(new Request('https://auth.shauryaswebsites.com/api/me', {
        headers: { Cookie: request.headers.get('cookie') || '' },
      }));
      if (!response.ok) return error('Login is temporarily unavailable. Please try again.', 503);
      const user = await response.json();
      if (!user) return error('Log in to save and open your maps.', 401);
      if (typeof user.id !== 'string' || !user.id || user.id.length > 200) return error('Login is temporarily unavailable.', 503);
      const id = env.SAVED_MAPS.idFromName(user.id);
      // A separate object for each platform identity provides ownership isolation.
      return await env.SAVED_MAPS.get(id).fetch(request);
    } catch {
      return error('Your maps are temporarily unavailable. Please try again.', 503);
    }
  },
};

export class SavedMaps {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS maps (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, snapshot TEXT NOT NULL)');
    this.window = 0;
    this.requests = 0;
  }

  async fetch(request) {
    const minute = Math.floor(Date.now() / 60000);
    if (this.window !== minute) { this.window = minute; this.requests = 0; }
    if (++this.requests > 60) return error('Please wait a minute before trying again.', 429);
    const id = new URL(request.url).pathname.split('/')[3];
    if (request.method === 'GET') {
      if (!id) return json({ maps: this.sql.exec('SELECT id, name, created_at AS createdAt FROM maps ORDER BY created_at DESC, id DESC').toArray() });
      const row = this.sql.exec('SELECT id, name, created_at AS createdAt, snapshot FROM maps WHERE id = ?', id).toArray()[0];
      return row ? json({ ...row, snapshot: JSON.parse(row.snapshot) }) : error('This saved map was not found.', 404);
    }
    if (request.method === 'DELETE' && id) {
      this.sql.exec('DELETE FROM maps WHERE id = ?', id);
      return json({ ok: true });
    }
    if (request.method !== 'POST' || id) return error('Method not allowed.', 405);
    try {
      const body = await readBody(request);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 80) return error('Name your map using 1–80 characters.', 400);
      try { validateMap(body.snapshot); } catch { return error('This map could not be saved. Please reload and try again.', 400); }
      // Check the quota after reading the body. There is no await between check and insert.
      if (this.sql.exec('SELECT count(*) AS count FROM maps').toArray()[0].count >= MAX_MAPS) return error('You have 20 saved maps. Delete one to make room.', 409);
      const row = { id: crypto.randomUUID(), name, createdAt: Date.now() };
      this.sql.exec('INSERT INTO maps (id, name, created_at, snapshot) VALUES (?, ?, ?, ?)', row.id, name, row.createdAt, JSON.stringify(body.snapshot));
      return json(row, 201);
    } catch (failure) {
      if (failure instanceof Response) return failure;
      return error('Your map could not be saved. Please try again.', 503);
    }
  }
}

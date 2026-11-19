import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { generateState } from '../src/state-generator.js';
import { buildCustomState, createPlan, addCity } from '../src/custom-state.js';
import { captureMap, restoreMap, validateMap, MAX_SAVE_BYTES } from '../src/map-save.js';
import { applyElectionSwing } from '../src/election-swing.js';
import { summarizeDistricts } from '../src/districts.js';
import worker, { SavedMaps } from '../worker/index.js';

const state = generateState({ seed: 'profile-save-test' });
const snapshot = captureMap(state, state.precincts, -2.7, 'purple-orange');
const endpoint = 'https://gerry.shauryaswebsites.com';
function storage() {
  const db = new DatabaseSync(':memory:');
  return { sql: { exec(query, ...args) {
    if (query.startsWith('CREATE')) { db.exec(query); return { toArray: () => [] }; }
    const stmt = db.prepare(query);
    const rows = /^(SELECT|PRAGMA)/.test(query) ? stmt.all(...args) : (stmt.run(...args), []);
    return { toArray: () => rows };
  } } };
}
function context() {
  const objects = new Map();
  const env = {
    AUTH: { async fetch(req) {
      const cookie = req.headers.get('cookie');
      return Response.json(cookie?.startsWith('user=') ? { id: cookie.slice(5) } : null);
    } },
    SAVED_MAPS: { idFromName: name => name, get(id) {
      if (!objects.has(id)) objects.set(id, new SavedMaps({ storage: storage() }));
      return objects.get(id);
    } },
    ASSETS: { fetch: () => new Response('public game') },
  };
  return { env, objects };
}
const request = (path = '/api/maps', { user = 'alice', method = 'GET', body, origin = endpoint, headers = {} } = {}) => new Request(endpoint + path, {
  method, headers: { ...(user ? { Cookie: `user=${user}` } : {}), ...(origin ? { Origin: origin } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const save = (env, user = 'alice', name = 'My map') => worker.fetch(request('/api/maps', { user, method: 'POST', body: { name, snapshot } }), env);

test('full map survives serialization with districts, baseline voters and swing intact', () => {
  const drawn = { ...state, assignments: { ...state.referencePlan } };
  drawn.districts = summarizeDistricts(drawn);
  const shifted = applyElectionSwing(drawn, state.precincts, -2.7);
  const encoded = JSON.parse(JSON.stringify(captureMap(shifted, state.precincts, -2.7, 'purple-orange')));
  const loaded = restoreMap(encoded);
  const restored = applyElectionSwing(loaded.state, loaded.state.precincts, loaded.swing);
  assert.equal(loaded.matchup, 'purple-orange');
  assert.deepEqual(restored.precincts, shifted.precincts);
  assert.deepEqual(restored.assignments, drawn.assignments);
  assert.deepEqual(restored.grid.owner, drawn.grid.owner);
  assert.deepEqual(restored.districts, shifted.districts);
  assert.equal(restored.precinctsById.get(restored.precincts[0].id), restored.precincts[0]);
  assert(JSON.stringify(encoded).length < MAX_SAVE_BYTES);
});

test('custom built state opens without needing its generator or changing its outline', () => {
  const plan = addCity(createPlan({ outlineSeed: 'big0' }), { x: 400, y: 300 });
  const built = buildCustomState(plan);
  assert(built.ok);
  const saved = captureMap(built.state, built.state.precincts, 1.4, 'soc-lib');
  const result = restoreMap(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(result.state.outline, built.state.outline);
  assert.deepEqual(result.state.precincts, built.state.precincts);
  assert.deepEqual(result.state.plan, built.state.plan);
  assert(result.state.custom);
});

test('invalid version, votes, grid, geometry and district assignments are rejected', () => {
  for (const damage of [s => s.version = 99, s => s.map.grid.owner[0] = 99999, s => s.map.precincts[0].sideAVoters = -1, s => s.map.assignments[s.map.precincts[0].id] = 100, s => s.map.precincts[0].polygon = [], s => s.map.precincts[0].neighbors = ['missing'], s => s.map.totalVoters = 1]) {
    const copy = structuredClone(snapshot); damage(copy);
    assert.throws(() => validateMap(copy));
  }
});

test('guest can play but cannot list, save, open or delete private maps', async () => {
  const { env, objects } = context();
  assert.equal((await worker.fetch(request('/', { user: null }), env)).status, 200);
  for (const method of ['GET', 'POST', 'DELETE']) assert.equal((await worker.fetch(request('/api/maps', { user: null, method }), env)).status, 401);
  assert.equal(objects.size, 0);
});

test('map CRUD is isolated by the verified platform identity', async () => {
  const { env } = context();
  const response = await save(env);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const map = await response.json();
  assert.equal((await (await worker.fetch(request('/api/maps'), env)).json()).maps[0].name, 'My map');
  const opened = await worker.fetch(request(`/api/maps/${map.id}`), env);
  assert.deepEqual((await opened.json()).snapshot, snapshot);
  assert.equal((await worker.fetch(request(`/api/maps/${map.id}`, { user: 'bob' }), env)).status, 404);
  await worker.fetch(request(`/api/maps/${map.id}`, { user: 'bob', method: 'DELETE' }), env);
  assert.equal((await worker.fetch(request(`/api/maps/${map.id}`), env)).status, 200);
  // A supplied userId never chooses the owner.
  await worker.fetch(request('/api/maps', { user: 'bob', method: 'POST', body: { name: 'Bob map', snapshot, userId: 'alice' } }), env);
  assert.equal((await (await worker.fetch(request('/api/maps'), env)).json()).maps.length, 1);
  await worker.fetch(request(`/api/maps/${map.id}`, { method: 'DELETE' }), env);
  assert.equal((await worker.fetch(request(`/api/maps/${map.id}`), env)).status, 404);
});

test('mutations reject cross-site and absent origins and non-JSON bodies', async () => {
  const { env, objects } = context();
  for (const origin of ['https://attacker.example', 'https://feedback.shauryaswebsites.com', null]) assert.equal((await saveWithOrigin(origin)).status, 403);
  async function saveWithOrigin(origin) { return worker.fetch(request('/api/maps', { method: 'POST', origin, body: { name: 'Map', snapshot } }), env); }
  assert.equal(objects.size, 0);
  assert.equal((await worker.fetch(request('/api/maps', { method: 'POST', body: {}, headers: { 'Content-Type': 'text/plain' } }), env)).status, 415);
});

test('auth failures fail closed without allocating or exposing map storage', async () => {
  const { env, objects } = context();
  env.AUTH.fetch = async () => new Response('unavailable', { status: 503 });
  assert.equal((await save(env)).status, 503);
  assert.equal(objects.size, 0);
});

test('invalid names, oversized requests and malformed snapshots fail without saving', async () => {
  const { env } = context();
  assert.equal((await save(env, 'alice', ' ')).status, 400);
  assert.equal((await save(env, 'alice', 'x'.repeat(81))).status, 400);
  assert.equal((await worker.fetch(request('/api/maps', { method: 'POST', body: { name: 'Bad', snapshot: { version: 999 } } }), env)).status, 400);
  assert.equal((await worker.fetch(request('/api/maps', { method: 'POST', body: { name: 'Huge', pad: 'x'.repeat(MAX_SAVE_BYTES) } }), env)).status, 413);
  assert.equal((await (await worker.fetch(request('/api/maps'), env)).json()).maps.length, 0);
});

test('quota is enforced and deleting a save makes room', async () => {
  const { env } = context();
  let first;
  for (let i = 0; i < 20; i++) { const r = await save(env); assert.equal(r.status, 201); first ??= await r.json(); }
  assert.equal((await save(env)).status, 409);
  await worker.fetch(request(`/api/maps/${first.id}`, { method: 'DELETE' }), env);
  assert.equal((await save(env)).status, 201);
});

test('request limits are independent per user', async () => {
  const { env } = context();
  for (let i = 0; i < 60; i++) assert.equal((await worker.fetch(request(), env)).status, 200);
  assert.equal((await worker.fetch(request(), env)).status, 429);
  assert.equal((await worker.fetch(request('/api/maps', { user: 'bob' }), env)).status, 200);
});

test('legacy domain redirects to the first-party login domain preserving the map seed', async () => {
  const { env } = context();
  const r = await worker.fetch(new Request('https://gerry.shauryaswebsite.com/?seed=example'), env);
  assert.equal(r.status, 308);
  assert.equal(r.headers.get('location'), endpoint + '/?seed=example');
});

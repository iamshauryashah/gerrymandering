import { test, assert, assertEqual } from './test-runner.js';
import { createApp } from '../src/main.js';
import { createSavedMaps } from '../src/ui/saved-maps.js';
import { generateState } from './fixtures.js';

const q = (root, role) => root.querySelector(`[data-role="${role}"]`);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function mount(fetcher) {
  const originalUrl = location.href;
  const html = await (await fetch('../index.html')).text();
  const root = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-role="app"]');
  document.getElementById('fixture').append(root);
  const app = createApp(root, { seed: 'profile-save-test', makeState: generateState, confirm: () => true });
  const saves = createSavedMaps(root, app, { fetcher });
  await tick();
  return { root, app, cleanup() { saves.destroy(); app.destroy(); root.remove(); history.replaceState(null, '', originalUrl); } };
}
const auth = user => window.dispatchEvent(new CustomEvent('shaurya:auth-changed', { detail: { user } }));
const alice = { id: 'alice', email: 'alice@example.test' };
const fetcher = async path => Response.json(path.startsWith('https://auth.') ? alice : { maps: [] });

test('saved maps: opening restores the complete map, districts, matchup, and swing', async () => {
  const { root, app, cleanup } = await mount(fetcher);
  try {
    app.setAssignments(app.state.referencePlan);
    app.setSwing(3.4);
    q(root, 'matchup-toggle').click();
    const snapshot = app.captureSnapshot();
    const voters = app.state.precincts.map(p => p.sideAVoters);
    const districts = { ...app.state.assignments };
    app.load('demo-1');
    assert(app.openSnapshot(snapshot));
    assertEqual(app.state.precincts.map(p => p.sideAVoters), voters);
    assertEqual(app.state.assignments, districts);
    assertEqual(app.swing, 3.4);
    assertEqual(app.matchup.id, 'soc-lib');
    assertEqual(q(root, 'matchup-toggle').dataset.matchup, 'soc-lib');
    q(root, 'matchup-toggle').click();
    assertEqual(app.matchup.id, 'purple-orange', 'the next toggle follows the restored matchup');
  } finally { cleanup(); }
});

test('saved maps: guests use the existing login capability and never save anonymously', async () => {
  const { root, cleanup } = await mount(async path => Response.json(path.startsWith('https://auth.') ? null : { maps: [] }));
  let opened = 0;
  const listener = () => opened++;
  window.addEventListener('shaurya:auth-open', listener);
  try {
    q(root, 'save-map').click();
    assert(q(root, 'maps-dialog').open);
    assert(q(root, 'map-save-form').hidden);
    q(root, 'maps-login').click();
    assertEqual(opened, 1);
    assert(!q(root, 'maps-dialog').open);
  } finally { window.removeEventListener('shaurya:auth-open', listener); cleanup(); }
});

test('saved maps: Save sends original voters, drawn districts, swing and name to the private API', async () => {
  let sent = null;
  const { root, app, cleanup } = await mount(async (path, options) => {
    if (path.startsWith('https://auth.')) return Response.json(alice);
    if (options?.method === 'POST') { sent = JSON.parse(options.body); return Response.json({ id: 'saved' }, { status: 201 }); }
    return Response.json({ maps: [] });
  });
  try {
    app.setAssignments(app.state.referencePlan); app.setSwing(-4.2);
    q(root, 'save-map').click(); await tick();
    q(root, 'map-save-name').value = 'My district plan';
    q(root, 'map-save-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assertEqual(sent.name, 'My district plan');
    assertEqual(sent.snapshot.swing, -4.2);
    assertEqual(sent.snapshot.map.assignments, app.state.assignments);
    assert(q(root, 'maps-message').textContent.includes('Map saved'));
  } finally { cleanup(); }
});

test('saved maps: names render as text and signing out clears the private list', async () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const { root, cleanup } = await mount(async path => Response.json(path.startsWith('https://auth.') ? alice : { maps: [{ id: 'one', name: malicious, createdAt: 1 }] }));
  try {
    q(root, 'my-maps').click(); await tick();
    assertEqual(q(root, 'saved-map-list').querySelector('strong').textContent, malicious);
    assertEqual(q(root, 'saved-map-list').querySelector('img'), null);
    auth(null);
    assertEqual(q(root, 'saved-map-list').children.length, 0);
    assert(!q(root, 'maps-login').hidden);
  } finally { cleanup(); }
});

test('saved maps: responses from a previous account cannot repopulate the list', async () => {
  let resolve;
  const { root, cleanup } = await mount(async path => path.startsWith('https://auth.') ? Response.json(alice) : new Promise(r => resolve = r));
  try {
    q(root, 'my-maps').click(); await tick();
    auth(null);
    resolve(Response.json({ maps: [{ id: 'private', name: 'Alice secret map', createdAt: 1 }] }));
    await tick();
    assertEqual(q(root, 'saved-map-list').children.length, 0);
    assert(!q(root, 'maps-message').textContent.includes('Alice'));
  } finally { cleanup(); }
});

test('saved maps: failed saves remain retryable without reporting success', async () => {
  const { root, cleanup } = await mount(async path => path.startsWith('https://auth.') ? Response.json(alice) : Response.json({ message: 'Storage unavailable' }, { status: 503 }));
  try {
    q(root, 'save-map').click(); await tick();
    q(root, 'map-save-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assert(q(root, 'maps-message').textContent.includes('Storage unavailable'));
    assert(!q(root, 'map-save-form').hidden);
    assert(!q(root, 'map-save-submit').disabled);
  } finally { cleanup(); }
});

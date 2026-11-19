// The account widget owns sign-in. Gerry owns map storage and the saved-map UI.
export function createSavedMaps(root, app, { fetcher = fetch } = {}) {
  const q = role => root.querySelector(`[data-role="${role}"]`);
  const dialog = q('maps-dialog');
  if (!dialog) return;
  const save = q('save-map'), browse = q('my-maps'), login = q('maps-login');
  const form = q('map-save-form'), name = q('map-save-name'), submit = q('map-save-submit');
  const list = q('saved-map-list'), message = q('maps-message');
  let user = null, generation = 0, busy = false, pendingSave = null;
  const say = text => { message.textContent = text; };
  const signIn = () => window.dispatchEvent(new CustomEvent('shaurya:auth-open'));

  async function api(path, options = {}) {
    const response = await fetcher(path, { credentials: 'same-origin', cache: 'no-store', ...options });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) setUser(null);
      throw new Error(value.message || 'Your maps could not be loaded. Please try again.');
    }
    return value;
  }

  function setUser(next) {
    if (user?.id === next?.id) return;
    generation += 1;
    user = next;
    list.replaceChildren();
    pendingSave = null;
    form.hidden = true;
    login.hidden = !!user;
    say(user ? 'Your saved maps are private to this account.' : 'Log in with your website account to save and open your maps.');
    if (dialog.open && user) void refresh();
  }

  async function refresh() {
    if (!user) return;
    const token = generation;
    say('Loading your maps…');
    list.replaceChildren();
    try {
      const result = await api('/api/maps');
      if (token !== generation || !dialog.open) return;
      say(result.maps.length ? `${result.maps.length} of 20 maps saved to your profile.` : 'No saved maps yet. Give your current map a name to save it.');
      for (const map of result.maps) {
        const item = document.createElement('li');
        const title = document.createElement('strong');
        title.textContent = map.name;
        const date = document.createElement('small');
        date.textContent = new Date(map.createdAt).toLocaleString();
        const open = document.createElement('button');
        open.type = 'button'; open.textContent = 'Open';
        open.setAttribute('aria-label', `Open ${map.name}`);
        open.addEventListener('click', () => void run(async () => {
          const saved = await api(`/api/maps/${encodeURIComponent(map.id)}`);
          if (token !== generation) return;
          if (app.openSnapshot(saved.snapshot)) dialog.close();
        }));
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = 'Delete';
        remove.setAttribute('aria-label', `Delete ${map.name}`);
        remove.addEventListener('click', () => void run(async () => {
          if (!window.confirm(`Delete the saved map “${map.name}”?`)) return;
          await api(`/api/maps/${encodeURIComponent(map.id)}`, { method: 'DELETE' });
          if (token === generation) await refresh();
        }));
        const info = document.createElement('div'); info.append(title, date);
        item.append(info, open, remove); list.append(item);
      }
    } catch (error) { if (token === generation) say(error.message); }
  }

  async function run(action) {
    if (busy) return;
    busy = true;
    submit.disabled = true;
    list.setAttribute('aria-busy', 'true');
    try { await action(); }
    catch (error) { say(error.message); }
    finally { busy = false; submit.disabled = false; list.removeAttribute('aria-busy'); }
  }

  async function show(wantSave) {
    dialog.showModal();
    list.replaceChildren();
    form.hidden = true;
    login.hidden = !!user;
    if (!user) { say('Log in with your website account to save and open your maps.'); return; }
    if (wantSave) {
      try {
        pendingSave = app.captureSnapshot();
        name.value = app.state.name;
        form.hidden = false;
        name.focus(); name.select();
      } catch (error) { say(error.message); return; }
    }
    await refresh();
  }

  save.addEventListener('click', () => void show(true));
  browse.addEventListener('click', () => void show(false));
  q('maps-close').addEventListener('click', () => dialog.close());
  login.addEventListener('click', () => { dialog.close(); signIn(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!user || !pendingSave || !name.reportValidity()) return;
    const token = generation;
    void run(async () => {
      await api('/api/maps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.value.trim(), snapshot: pendingSave }) });
      if (token !== generation) return;
      pendingSave = null; form.hidden = true;
      await refresh();
      say('Map saved to your profile. Open it here whenever you want to continue.');
    });
  });
  dialog.addEventListener('close', () => { pendingSave = null; form.hidden = true; });
  const onAuth = event => setUser(event.detail?.user || null);
  window.addEventListener('shaurya:auth-changed', onAuth);
  // The widget may have finished its first refresh before Gerry initialized.
  const initial = generation;
  fetcher('https://auth.shauryaswebsites.com/api/me', { credentials: 'include', cache: 'no-store' })
    .then(r => r.ok ? r.json() : null).then(next => { if (generation === initial) setUser(next); }).catch(() => {});
  if (new URLSearchParams(location.search).get('maps') === '1') void show(false);
  return { destroy() { generation += 1; window.removeEventListener('shaurya:auth-changed', onAuth); if (dialog.open) dialog.close(); } };
}

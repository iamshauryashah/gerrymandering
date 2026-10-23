import { test, assert, assertEqual } from './test-runner.js';
import { closePage, drawnMap, insideWindow, openPage, pageWindow, rect, resizePage, scrollTop, seedWithDistricts, settle } from './layout-helpers.js';

const SIZES = [[1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080]];
const DISTRICT_COUNTS = [8, 14, 20];

const area = (r) => r.width * r.height;

// With a district selected and the brush on, everything needed for the editing loop is on the screen at once (010-style
// numbers: FR-001, FR-002, FR-002a, SC-001, SC-004).
test('the editing screen fits every laptop and desktop window, with the map as the main attraction (FR-001, FR-002, SC-001, SC-004)', async () => {
  for (const [width, height] of SIZES) {
    for (const count of DISTRICT_COUNTS) {
      const seed = seedWithDistricts(count);
      assert(seed, `a seed with ${count} districts`);
      const frame = await openPage(width, height, seed);
      try {
        const app = frame.contentWindow.gerryApp;
        assertEqual(app.state.districtCount, count);
        app.setEditing(1);
        app.setBrush({ on: true });
        await settle();
        const label = `${width} x ${height}, ${count} districts`;
        const parts = {
          picker: '[data-role="district-list"]',
          map: '[data-role="map"]',
          detail: '[data-role="district-detail"]',
          plan: '[data-role="plan-status"]',
          slot: '.message-slot',
          brush: '[data-role="brush-tool"]',
          matchup: '[data-role="matchup-toggle"]',
          editing: '[data-role="editing-status"]',
        };
        const column = frame.contentDocument.querySelector('[data-role="panels"]');
        assert(column.scrollHeight <= column.clientHeight + 1, `${label}: the panels column does not need to scroll (${column.scrollHeight} of ${column.clientHeight})`);
        for (const [name, selector] of Object.entries(parts)) {
          assert(insideWindow(rect(frame, selector), frame), `${label}: the ${name} is fully inside the window (${JSON.stringify(rect(frame, selector))})`);
        }
        for (const row of frame.contentDocument.querySelectorAll('.district-row')) {
          const r = row.getBoundingClientRect();
          assert(insideWindow({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }, frame), `${label}: district ${row.dataset.district} is inside the window`);
        }
        assertEqual(frame.contentDocument.querySelectorAll('.district-row').length, count, `${label}: every district is in the picker`);
        const drawn = drawnMap(frame);
        const win = pageWindow(frame);
        assert(drawn.width * drawn.height >= 0.4 * win.width * win.height, `${label}: the map covers ${Math.round((100 * drawn.width * drawn.height) / (win.width * win.height))}% of the window`);
        const mapArea = area(rect(frame, '.map-frame'));
        for (const [name, selector] of Object.entries({ panels: '[data-role="panels"]', brush: '[data-role="brush-tool"]', detail: parts.detail, plan: parts.plan, picker: parts.picker })) {
          assert(mapArea > area(rect(frame, selector)), `${label}: the map is larger than the ${name}`);
        }
        if (width === 1280) assert(drawn.width >= 560 && drawn.height >= 420, `${label}: the map is ${Math.round(drawn.width)} x ${Math.round(drawn.height)}`);
        if (width === 1920) assert(drawn.width >= 800, `${label}: the map is ${Math.round(drawn.width)} wide`);
        assertEqual(scrollTop(frame), 0, `${label}: the page has not scrolled`);
      } finally {
        closePage(frame);
      }
    }
  }
});

// Precinct ids in breadth-first order from a start precinct, so each one touches an earlier one.
function connectedOrder(state, startIndex, count) {
  const order = [state.precincts[startIndex].id];
  for (let i = 0; i < order.length && order.length < count; i += 1) {
    for (const n of state.precinctsById.get(order[i]).neighbors) if (!order.includes(n) && order.length < count) order.push(n);
  }
  return order;
}

const BOXES = ['.map-frame', '[data-role="panels"]', '[data-role="brush-tool"]', '[data-role="district-list"]', '[data-role="district-detail"]', '[data-role="plan-status"]', '.message-slot', '[data-role="matchup-toggle"]', '[data-role="state-totals"]', '[data-role="control-total"]', '[data-role="legend"]'];

// Select, edit, read, switch, edit again: the page never scrolls and no box moves (FR-003, FR-004, SC-002, SC-006).
async function walkthrough(width, height, count) {
  const frame = await openPage(width, height, seedWithDistricts(count));
  try {
    const app = frame.contentWindow.gerryApp;
    const label = `${width} x ${height}, ${count} districts`;
    app.setEditing(1);
    app.setBrush({ on: true, size: 60 });
    await settle();
    const base = BOXES.map((selector) => rect(frame, selector));
    const controlText = () => frame.contentDocument.querySelector('[data-role="control-total"]').textContent;
    const controlAtStart = controlText();
    let steps = 0;
    const check = (what) => {
      steps += 1;
      assertEqual(scrollTop(frame), 0, `${label}: the page did not scroll after ${what}`);
      assertEqual(BOXES.map((selector) => rect(frame, selector)), base, `${label}: nothing moved after ${what}`);
    };
    for (const district of [1, 2]) {
      app.setEditing(district);
      check(`picking district ${district}`);
      app.setBrush({ on: false });
      const order = connectedOrder(app.state, district === 1 ? 120 : 260, 40);
      // Five single-precinct clicks, each next to the last.
      for (let i = 0; i < 5; i += 1) {
        app.editPrecinct(order[i]);
        check(`click ${i + 1} in district ${district}`);
      }
      // A refused click: a precinct far from the district. Its message appears in its reserved place.
      const far = app.state.precincts.find((p) => p.neighbors.every((n) => app.state.assignments[n] === null) && app.state.assignments[p.id] === null);
      app.editPrecinct(far.id);
      assertEqual(frame.contentDocument.querySelector('[data-role="edit-message"]').hidden, false, `${label}: the refused click shows its message`);
      check(`a refused click in district ${district}`);
      // Five brush strokes along the same neighbors.
      app.setBrush({ on: true, size: 40 });
      for (let i = 5; i < 10; i += 1) {
        app.strokeAt(app.state.precinctsById.get(order[i]).center);
        check(`brush stroke ${i - 4} in district ${district}`);
      }
    }
    assert(steps >= 20, 'the walkthrough made at least 20 steps');
    assert(controlText() !== controlAtStart, `${label}: the district control block shows the edits (${frame.contentWindow.gerryApp.dock.docked} blocks docked)`);
  } finally {
    closePage(frame);
  }
}

test('ten clicks and strokes in one district, then ten in another, never scroll the page or move anything (FR-003, FR-004, SC-002, SC-006)', async () => {
  await walkthrough(1280, 720, 20);
  await walkthrough(1440, 900, 14);
  await walkthrough(1920, 1080, 14);
  await walkthrough(1440, 900, 8);
});

test('every district tile is visible at once without inner scrolling, and tiles stay big enough to use (FR-006, SC-005)', async () => {
  for (const [width, height] of [[1280, 720], [1366, 768], [1920, 1080]]) {
    for (const count of DISTRICT_COUNTS) {
      const frame = await openPage(width, height, seedWithDistricts(count));
      try {
        const label = `${width} x ${height}, ${count} districts`;
        const list = frame.contentDocument.querySelector('[data-role="district-list"]');
        assert(list.scrollHeight <= list.clientHeight + 1, `${label}: the list does not scroll inside itself`);
        const rows = [...frame.contentDocument.querySelectorAll('.district-row')];
        assertEqual(rows.length, count, `${label}: a tile for every district`);
        for (const row of rows) {
          const r = row.getBoundingClientRect();
          assert(insideWindow(r, frame) && r.width >= 90 && r.height >= 40, `${label}: tile ${row.dataset.district} is visible and big enough (${Math.round(r.width)} x ${Math.round(r.height)})`);
          const pen = row.querySelector('.pen').getBoundingClientRect();
          assert(pen.width >= 24 && pen.height >= 24, `${label}: the pen is at least 24 px`);
        }
        const columns = new Set(rows.map((row) => Math.round(row.getBoundingClientRect().left)));
        if (width === 1280 && count === 20) assertEqual(columns.size, 4, `${label}: the tiles use 4 columns`);
      } finally {
        closePage(frame);
      }
    }
  }
});

const PRESENT = ['[data-role="matchup-toggle"]', '[data-role="new-map"]', '[data-role="build-state"]', '[data-role="map"]', '[data-role="district-list"]', '[data-role="district-detail"]', '[data-role="plan-status"]', '[data-role="brush-tool"]', '[data-role="state-totals"]', '[data-role="control-total"]', '[data-role="legend"]', '.layout > .hint', '[data-role="notice"]'];
const isWorkbench = (frame) => frame.contentWindow.getComputedStyle(frame.contentDocument.querySelector('.layout')).gridTemplateRows.startsWith('48px');

test('every earlier part of the page is still there, nothing scrolls sideways, and only laptop-sized windows get the one-screen layout (FR-015, FR-017, FR-018, SC-007)', async () => {
  const sizes = [[320, 700], [480, 800], [768, 1024], [1024, 768], [1200, 720], [1280, 719], [1280, 720], [1920, 1080], [2560, 1440]];
  for (const [width, height] of sizes) {
    const frame = await openPage(width, height, seedWithDistricts(14));
    try {
      const label = `${width} x ${height}`;
      const doc = frame.contentDocument;
      assert(doc.documentElement.scrollWidth <= frame.contentWindow.innerWidth, `${label}: no sideways scrolling (${doc.documentElement.scrollWidth} > ${frame.contentWindow.innerWidth})`);
      for (const selector of PRESENT) {
        const r = rect(frame, selector);
        assert(r.width > 0 && r.height > 0, `${label}: ${selector} is on the page`);
        assert(r.left >= -0.5 && r.right <= frame.contentWindow.innerWidth + 0.5, `${label}: ${selector} is inside the window's width`);
      }
      assertEqual(isWorkbench(frame), width >= 1280 && height >= 720, `${label}: the one-screen layout applies only to laptop-sized windows`);
      if (!isWorkbench(frame)) assert(doc.documentElement.scrollHeight > frame.contentWindow.innerHeight, `${label}: the stacked layout scrolls`);
    } finally {
      closePage(frame);
    }
  }
});

test('resizing the window keeps the state, the selected district, the brush settings, and the picker (FR-019)', async () => {
  const frame = await openPage(1440, 900, seedWithDistricts(14));
  try {
    const app = frame.contentWindow.gerryApp;
    app.setEditing(2);
    app.setBrush({ on: true, size: 80, mode: 'erase' });
    app.setBrush({ mode: 'add' });
    await settle();
    app.strokeAt(app.state.precincts[200].center);
    const snapshot = () => JSON.stringify({ assignments: app.state.assignments, editing: app.editingDistrict, brush: app.brush, tiles: [...frame.contentDocument.querySelectorAll('.district-row')].map((r) => r.textContent), detail: frame.contentDocument.querySelector('[data-role="district-detail"]').textContent });
    const before = snapshot();
    for (const [width, height] of [[1000, 700], [700, 900], [320, 700], [1440, 900]]) {
      await resizePage(frame, width, height);
      assertEqual(snapshot(), before, `after resizing to ${width} x ${height}`);
    }
    for (const selector of ['[data-role="district-list"]', '[data-role="map"]', '[data-role="district-detail"]', '[data-role="plan-status"]', '[data-role="brush-tool"]']) {
      assert(insideWindow(rect(frame, selector), frame), `back at 1440 x 900 the ${selector} is on the screen again`);
    }
  } finally {
    closePage(frame);
  }
});

test('building a state keeps its own layout, and keyboard focus runs picker, brush, then map without scrolling (FR-020, FR-021)', async () => {
  const frame = await openPage(1440, 900, seedWithDistricts(14));
  try {
    const app = frame.contentWindow.gerryApp;
    const doc = frame.contentDocument;
    app.setEditing(1);
    const order = (a, b) => Boolean(a.compareDocumentPosition(b) & frame.contentWindow.Node.DOCUMENT_POSITION_FOLLOWING);
    const toggle = doc.querySelector('[data-role="matchup-toggle"]');
    const pen = doc.querySelector('.pen');
    const brush = doc.querySelector('[data-role="brush-toggle"]');
    const precinct = doc.querySelector('.precinct[tabindex="0"]');
    assert(order(toggle, pen) && order(pen, brush) && order(brush, precinct), 'focus order: matchup toggle, the picker, the brush, then the map');
    precinct.focus({ preventScroll: true });
    for (let i = 0; i < 6; i += 1) {
      doc.activeElement.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      assertEqual(scrollTop(frame), 0, 'arrow keys do not scroll the page');
    }
    app.setEditing(null);
    app.startBuilder();
    assertEqual(app.mode, 'build');
    assert(!doc.querySelector('[data-role="builder"]').hidden, 'the builder is shown');
    assertEqual(frame.contentWindow.getComputedStyle(doc.querySelector('[data-role="district-list"]').closest('.districts')).display, 'none', 'the picker is hidden while building');
    assertEqual(frame.contentWindow.getComputedStyle(doc.querySelector('[data-role="brush-tool"]')).display, 'none', 'the brush bar is hidden while building');
    assert(!isWorkbench(frame), 'the one-screen layout is off while building');
    assert(insideWindow(rect(frame, '[data-role="map"]'), frame) || rect(frame, '[data-role="map"]').width > 0, 'the map is still shown');
  } finally {
    closePage(frame);
  }
});

// ---- Feature 012: summary blocks that move up under the plan check ------------------------------------------------------

const BLOCKS = ['state-totals', 'control-total', 'legend'];
const blockNodes = (frame) => BLOCKS.map((role) => frame.contentDocument.querySelector(`[data-role="${role}"]`));
const dockOf = (frame) => frame.contentWindow.gerryApp.dock;
const DOCK_BOXES = ['.map-frame', '[data-role="district-list"]', '[data-role="district-detail"]', '[data-role="plan-status"]', '.message-slot', '[data-role="brush-tool"]'];

// Puts every block back below the map at once (no waiting), so boxes can be compared with nothing docked; `dockOf(frame).update()` restores.
function undockAll(frame) {
  const layout = frame.contentDocument.querySelector('[data-role="layout"]');
  const hint = layout.querySelector(':scope > .hint');
  layout.dataset.docked = '0';
  for (const block of blockNodes(frame)) layout.insertBefore(block, hint);
}

function columnOverflows(frame) {
  const column = frame.contentDocument.querySelector('[data-role="panels"]');
  return column.scrollHeight > column.clientHeight + 1;
}

// The docked blocks are exactly the ones that fit: in order, whole, inside the window, and one more would not fit (FR-001 to FR-005, SC-002, SC-003, SC-004).
async function checkDock(frame, label) {
  const doc = frame.contentDocument;
  const column = doc.querySelector('[data-role="panels"]');
  const docked = dockOf(frame).docked;
  const blocks = blockNodes(frame);
  blocks.forEach((block, i) => {
    assertEqual(doc.querySelectorAll(`[data-role="${BLOCKS[i]}"]`).length, 1, `${label}: ${BLOCKS[i]} exists once`);
    assertEqual(block.parentNode === column, i < docked, `${label}: ${BLOCKS[i]} is ${i < docked ? 'in the column' : 'below'} (docked ${docked})`);
  });
  assert(blocks[0].compareDocumentPosition(blocks[1]) & Node.DOCUMENT_POSITION_FOLLOWING && blocks[1].compareDocumentPosition(blocks[2]) & Node.DOCUMENT_POSITION_FOLLOWING, `${label}: the blocks stay in order`);
  assert(!columnOverflows(frame), `${label}: the column does not scroll (${column.scrollHeight} of ${column.clientHeight})`);
  let previous = rect(frame, '.message-slot');
  for (const block of blocks.slice(0, docked)) {
    const r = block.getBoundingClientRect();
    assert(insideWindow(r, frame), `${label}: a docked block is inside the window (${JSON.stringify(r)})`);
    assert(r.top >= previous.bottom - 0.5, `${label}: docked blocks do not overlap`);
    assert(block.scrollHeight <= block.clientHeight + 1, `${label}: a docked block has no inner scroll`);
    previous = r;
  }
  if (docked < blocks.length) {
    column.append(blocks[docked]);
    assert(columnOverflows(frame), `${label}: one more block would not fit`);
    dockOf(frame).update();
    assertEqual(dockOf(frame).docked, docked, `${label}: the same count after trying one more`);
  }
  const withDock = DOCK_BOXES.map((selector) => rect(frame, selector));
  undockAll(frame);
  assertEqual(DOCK_BOXES.map((selector) => rect(frame, selector)), withDock, `${label}: the map, picker, detail, plan check, message area and brush bar did not move`);
  dockOf(frame).update();
  assertEqual(dockOf(frame).docked, docked, `${label}: restored`);
  return docked;
}

test('the summary blocks fill the open room under the plan check, in order, whole, and move nothing else (012 FR-001 to FR-005, SC-002 to SC-004)', async () => {
  const counts = {};
  for (const [width, height] of SIZES) {
    for (const count of DISTRICT_COUNTS) {
      const frame = await openPage(width, height, seedWithDistricts(count));
      try {
        const app = frame.contentWindow.gerryApp;
        app.setEditing(1);
        app.setBrush({ on: true });
        await settle();
        counts[`${width}x${height}/${count}`] = await checkDock(frame, `${width} x ${height}, ${count} districts`);
      } finally {
        closePage(frame);
      }
    }
  }
  assertEqual(counts['1280x720/20'], 0, 'no room at 1280 x 720 with 20 districts');
  assert(counts['1920x1080/14'] >= 2, `a tall window docks at least two blocks (${JSON.stringify(counts)})`);
  assert(counts['1920x1080/8'] >= counts['1280x720/8'], 'a taller window never docks fewer blocks');
  console.info(`Docked blocks: ${JSON.stringify(counts)}`);
});

test('docking blocks shortens the page, and all three fit on the first screen of a tall window (012 SC-001, SC-005)', async () => {
  for (const [width, height, count] of [[1920, 1080, 14], [1440, 900, 8], [1440, 900, 14]]) {
    const frame = await openPage(width, height, seedWithDistricts(count));
    try {
      const app = frame.contentWindow.gerryApp;
      app.setEditing(1);
      app.setBrush({ on: true });
      await settle();
      const label = `${width} x ${height}, ${count} districts`;
      const doc = frame.contentDocument;
      const reach = () => doc.documentElement.scrollHeight - height;
      const docked = dockOf(frame).docked;
      const after = reach();
      undockAll(frame);
      const before = reach();
      dockOf(frame).update();
      if (docked > 0) assert(after < before, `${label}: the page scrolls less with ${docked} blocks docked (${after} against ${before})`);
      if (width === 1920) {
        assertEqual(docked, 3, `${label}: all three blocks are docked`);
        for (const block of blockNodes(frame)) assert(insideWindow(block.getBoundingClientRect(), frame), `${label}: a block is on the first screen`);
        const tail = ['.hint', '.notice'].reduce((sum, selector) => sum + doc.querySelector(selector).getBoundingClientRect().height + 12, 0);
        assert(after <= tail + 24, `${label}: only the help text and notice are left below (${after} px, tail ${Math.round(tail)} px)`);
      }
    } finally {
      closePage(frame);
    }
  }
});

// ---- Feature 012, story 2: the set of docked blocks follows every change ------------------------------------------------

test('the docked blocks follow the window up and down and an edit in progress survives the resizes (012 FR-006, SC-006)', async () => {
  const frame = await openPage(1920, 1080, seedWithDistricts(14));
  try {
    const app = frame.contentWindow.gerryApp;
    app.setEditing(2);
    app.setBrush({ on: true, size: 80 });
    const stroke = app.strokeAt(app.state.precincts[260].center);
    assert(stroke.added > 0, 'the stroke added precincts');
    const owned = () => Object.values(app.state.assignments).filter((d) => d === 2).length;
    const painted = owned();
    const seen = [];
    for (const [width, height] of [[1920, 1080], [1600, 900], [1440, 800], [1366, 740], [1280, 720], [1536, 864], [1920, 1080]]) {
      await resizePage(frame, width, height);
      await settle(160);
      seen.push(await checkDock(frame, `${width} x ${height}`));
      assertEqual(owned(), painted, `${width} x ${height}: the stroke is still there`);
    }
    assert(Math.max(...seen) === 3 && Math.min(...seen) < 3, `the count changed with the window (${JSON.stringify(seen)})`);
    assertEqual(seen[0], seen[seen.length - 1], 'the same window gives the same count after the round trip');
    const again = app.strokeAt(app.state.precincts[262].center);
    assert(again.covered > 0, 'a new stroke still works after the resizes');
  } finally {
    closePage(frame);
  }
});

test('loading a state with another number of districts, or editing the plan, re-flows the blocks (012 FR-006)', async () => {
  const frame = await openPage(1440, 900, seedWithDistricts(8));
  try {
    const app = frame.contentWindow.gerryApp;
    app.setEditing(1);
    await settle();
    const few = await checkDock(frame, '8 districts');
    app.load(seedWithDistricts(20));
    app.setEditing(1);
    await settle();
    assertEqual(app.state.districtCount, 20);
    const many = await checkDock(frame, '20 districts');
    assert(many <= few, `more districts never leave more room (${few} then ${many})`);
    app.editPrecinct(app.state.precincts[120].id);
    await settle();
    await checkDock(frame, 'after an edit');
  } finally {
    closePage(frame);
  }
});

test('building a state puts every block below, and leaving it brings the same blocks back; a hidden layout docks nothing (012 FR-012)', async () => {
  const frame = await openPage(1920, 1080, seedWithDistricts(14));
  try {
    const app = frame.contentWindow.gerryApp;
    const doc = frame.contentDocument;
    app.setEditing(1);
    await settle();
    const before = dockOf(frame).docked;
    assert(before > 0, 'blocks are docked before building');
    app.setEditing(null);
    app.startBuilder();
    await settle();
    assertEqual(dockOf(frame).docked, 0, 'nothing is docked while building');
    const column = doc.querySelector('[data-role="panels"]');
    for (const block of blockNodes(frame)) assert(block.parentNode !== column, 'a block stays out of the builder column');
    assert(!doc.querySelector('[data-role="builder"]').hidden, 'the builder is shown');
    app.cancelBuilder();
    app.setEditing(1);
    await settle();
    assertEqual(dockOf(frame).docked, before, 'the same blocks are back after building');
    const workspace = doc.querySelector('[data-role="map-layout"]');
    workspace.hidden = true;
    assertEqual(dockOf(frame).update(), 0, 'a hidden layout docks nothing');
    workspace.hidden = false;
    dockOf(frame).update();
    assertEqual(dockOf(frame).docked, before, 'and the blocks return with the layout');
  } finally {
    closePage(frame);
  }
});

test('placing the blocks twice moves nothing, and Tab visits the same controls whether blocks are docked or not (012 research R8, FR-011)', async () => {
  const frame = await openPage(1920, 1080, seedWithDistricts(14));
  try {
    const doc = frame.contentDocument;
    const app = frame.contentWindow.gerryApp;
    app.setEditing(1);
    await settle();
    const where = () => blockNodes(frame).map((block) => [block.parentNode.className, block.nextSibling?.nodeName ?? null, block.className]);
    const first = JSON.stringify(where());
    dockOf(frame).update();
    dockOf(frame).update();
    assertEqual(JSON.stringify(where()), first, 'a repeated pass moves no block');
    const tabbables = () => [...doc.querySelectorAll('button, input, [tabindex="0"], a[href]')].filter((n) => !n.disabled && n.offsetParent !== null).map((n) => n.dataset.role ?? n.className);
    const withDock = tabbables();
    undockAll(frame);
    assertEqual(tabbables(), withDock, 'the same focusable elements in the same order with the blocks docked or not');
    dockOf(frame).update();
    for (const block of blockNodes(frame)) assertEqual(block.querySelectorAll('button, input, [tabindex], a[href]').length, 0, 'a block holds nothing focusable');
  } finally {
    closePage(frame);
  }
});

// ---- Feature 012, story 3: the two-column and one-column layouts ---------------------------------------------------------

test('in the two-column layout the blocks that fit sit in the column beside the map, and nothing else moves (012 FR-008, SC-003)', async () => {
  for (const [width, height] of [[1000, 800], [1100, 900], [1200, 720], [1280, 719]]) {
    for (const count of DISTRICT_COUNTS) {
      const frame = await openPage(width, height, seedWithDistricts(count));
      try {
        const doc = frame.contentDocument;
        const label = `${width} x ${height}, ${count} districts`;
        const layout = doc.querySelector('[data-role="layout"]');
        assertEqual(frame.contentWindow.getComputedStyle(layout).getPropertyValue('--dock').trim(), 'beside', `${label}: the two-column layout`);
        const column = doc.querySelector('[data-role="panels"]');
        const docked = dockOf(frame).docked;
        const blocks = blockNodes(frame);
        blocks.forEach((block, i) => assertEqual(block.parentNode === column, i < docked, `${label}: block ${i} is ${i < docked ? 'docked' : 'below'}`));
        const left = doc.querySelector('.map-cell').offsetHeight + doc.querySelector('[data-role="brush-tool"]').offsetHeight + 12;
        const boxes = ['.map-frame', '[data-role="district-list"]', '[data-role="district-detail"]', '[data-role="plan-status"]', '[data-role="brush-tool"]'];
        if (docked > 0) assert(column.offsetHeight <= left + 1, `${label}: the column is no taller than the map and brush bar (${column.offsetHeight} of ${left})`);
        if (docked < blocks.length) {
          column.append(blocks[docked]);
          assert(column.offsetHeight > left + 1, `${label}: one more block would make the page longer`);
          dockOf(frame).update();
        }
        const withDock = boxes.map((selector) => rect(frame, selector));
        undockAll(frame);
        assertEqual(boxes.map((selector) => rect(frame, selector)), withDock, `${label}: nothing else moved`);
        dockOf(frame).update();
        assertEqual(frame.contentDocument.documentElement.scrollWidth <= width, true, `${label}: no sideways scrolling`);
      } finally {
        closePage(frame);
      }
    }
  }
});

test('on phones and narrow windows the blocks stay in one column in order, and nothing scrolls sideways (012 FR-009, FR-010)', async () => {
  for (const [width, height] of [[320, 700], [390, 800], [480, 800], [700, 900], [1920, 1080], [1280, 720]]) {
    const frame = await openPage(width, height, seedWithDistricts(14));
    try {
      const doc = frame.contentDocument;
      const label = `${width} x ${height}`;
      await settle();
      if (width < 760) {
        assertEqual(dockOf(frame).docked, 0, `${label}: nothing is docked on a narrow window`);
        const tops = blockNodes(frame).map((block) => block.getBoundingClientRect().top);
        assert(tops[0] < tops[1] && tops[1] < tops[2], `${label}: stacked in order (${JSON.stringify(tops)})`);
        assert(tops[0] >= doc.querySelector('[data-role="map"]').getBoundingClientRect().bottom - 1, `${label}: below the map`);
      }
      assert(doc.documentElement.scrollWidth <= width, `${label}: no sideways scrolling (${doc.documentElement.scrollWidth})`);
    } finally {
      closePage(frame);
    }
  }
});

// ---- Feature 013: the brush bar holds the "Only unclaimed precincts" box and its message in one row ---------------------

// District 1 painted around one precinct, district 2 started beside it, the option on, and one stroke that leaves a long message.
function leaveLongMessage(app) {
  app.setEditing(1);
  app.setBrush({ on: true, size: 50, mode: 'add', unclaimedOnly: false });
  const center = app.state.precincts[100].center ?? app.state.precincts[100].seedPoint;
  app.strokeAt(center);
  const owned = Object.keys(app.state.assignments).filter((id) => app.state.assignments[id] === 1);
  const touching = owned.flatMap((id) => app.state.precinctsById.get(id).neighbors).find((id) => app.state.assignments[id] === null);
  app.setEditing(2);
  app.setBrush({ on: false });
  app.editPrecinct(touching);
  app.setBrush({ on: true, unclaimedOnly: true, size: 150 });
  return app.strokeAt(center);
}

test('the brush bar keeps every control and the whole stroke message inside its one row, and nothing else moves (013 FR-011, SC-005)', async () => {
  for (const [width, height] of SIZES) {
    const frame = await openPage(width, height, seedWithDistricts(20));
    try {
      const doc = frame.contentDocument;
      const label = `${width} x ${height}`;
      const summary = leaveLongMessage(frame.contentWindow.gerryApp);
      await settle();
      assert(summary.message.length >= 50, `${label}: a long message (${summary.message})`);
      const bar = rect(frame, '[data-role="brush-tool"]');
      assert(bar.height <= 52.5, `${label}: the bar keeps its 52 px row (${bar.height})`);
      const parts = [...doc.querySelectorAll('[data-role="brush-tool"] .brush-toggle, [data-role="brush-tool"] .brush-mode label, [data-role="brush-tool"] .brush-unclaimed, [data-role="brush-tool"] .brush-size-field, [data-role="brush-tool"] .brush-notes, [data-role="brush-tool"] .brush-message')];
      assert(parts.length >= 7, `${label}: the bar's parts were found (${parts.length})`);
      for (const part of parts) {
        const r = part.getBoundingClientRect();
        assert(r.width > 0 && r.height > 0, `${label}: ${part.className} is shown`);
        assert(r.left >= bar.left - 0.5 && r.right <= bar.right + 0.5 && r.top >= bar.top - 0.5 && r.bottom <= bar.bottom + 0.5, `${label}: ${part.className} is inside the bar (${JSON.stringify(r)} in ${JSON.stringify(bar)})`);
        assert(insideWindow(r, frame), `${label}: ${part.className} is inside the window`);
      }
      const message = doc.querySelector('.brush-message');
      assert(message.scrollHeight <= message.clientHeight + 1 && message.textContent.length > 0, `${label}: the whole message is visible`);
      const withBox = DOCK_BOXES.filter((s) => s !== '[data-role="brush-tool"]').concat('.map-frame').map((selector) => rect(frame, selector));
      const box = doc.querySelector('.brush-unclaimed');
      box.style.display = 'none';
      assertEqual(DOCK_BOXES.filter((s) => s !== '[data-role="brush-tool"]').concat('.map-frame').map((selector) => rect(frame, selector)), withBox, `${label}: the map, picker, detail, plan check and message area are the same without the box`);
      box.style.display = '';
      assertEqual(scrollTop(frame), 0, `${label}: the page has not scrolled`);
    } finally {
      closePage(frame);
    }
  }
});

test('the box is visible and the bar wraps without clipping on mid-sized and narrow windows (013 FR-011)', async () => {
  for (const [width, height] of [[1000, 800], [768, 1024], [390, 800], [320, 700]]) {
    const frame = await openPage(width, height, seedWithDistricts(14));
    try {
      const doc = frame.contentDocument;
      const label = `${width} x ${height}`;
      leaveLongMessage(frame.contentWindow.gerryApp);
      await settle();
      const bar = rect(frame, '[data-role="brush-tool"]');
      for (const part of doc.querySelectorAll('[data-role="brush-tool"] .brush-toggle, .brush-unclaimed, .brush-size-field, .brush-notes')) {
        const r = part.getBoundingClientRect();
        assert(r.width > 0 && r.height > 0, `${label}: ${part.className} is shown`);
        assert(r.left >= bar.left - 0.5 && r.right <= bar.right + 0.5 && r.bottom <= bar.bottom + 0.5, `${label}: ${part.className} is inside the bar`);
        assert(r.left >= -0.5 && r.right <= width + 0.5, `${label}: ${part.className} is inside the window's width`);
      }
      assert(doc.documentElement.scrollWidth <= width, `${label}: no sideways scrolling`);
    } finally {
      closePage(frame);
    }
  }
});

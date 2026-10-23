import { MAP_HEIGHT, MAP_WIDTH, pathFromPolygon, sharedVoronoiEdge } from '../geometry.js';
import { getResultColor, getResult, getShadeIndex } from '../formatters.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BADGE_RADIUS = 13;

function svgEl(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function precomputeEdges(state) {
  const edges = [];
  for (const precinct of state.precincts) {
    for (const neighborId of precinct.neighbors) {
      if (neighborId <= precinct.id) continue;
      const other = state.precinctsById.get(neighborId);
      const segment = sharedVoronoiEdge(precinct.polygon, precinct.seedPoint, other.seedPoint, 0.05);
      if (segment) edges.push({ a: precinct.id, b: neighborId, segment });
    }
  }
  return edges;
}

function segmentsPath(segments) {
  return segments.map(([[x1, y1], [x2, y2]]) => `M${x1},${y1}L${x2},${y2}`).join('');
}

function textColorFor(status, marginPercent) {
  if (status === 'sideA' || status === 'sideB') return getShadeIndex(marginPercent) >= 2 ? '#ffffff' : '#1d2433';
  return '#1d2433';
}

// Nudges overlapping badges apart so every district number stays readable.
export function separateBadges(points, radius = BADGE_RADIUS, width = 800, height = 600) {
  const result = points.map((p) => [...p]);
  const minGap = radius * 2 + 2;
  for (let iteration = 0; iteration < 30; iteration += 1) {
    let moved = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const dx = result[j][0] - result[i][0];
        const dy = result[j][1] - result[i][1];
        const d = Math.hypot(dx, dy);
        if (d >= minGap) continue;
        const push = (minGap - d) / 2 + 0.1;
        const ux = d > 0.01 ? dx / d : 1;
        const uy = d > 0.01 ? dy / d : 0;
        result[i][0] -= ux * push;
        result[i][1] -= uy * push;
        result[j][0] += ux * push;
        result[j][1] += uy * push;
        moved = true;
      }
    }
    for (const p of result) {
      p[0] = Math.min(width - radius - 2, Math.max(radius + 2, p[0]));
      p[1] = Math.min(height - radius - 2, Math.max(radius + 2, p[1]));
    }
    if (!moved) break;
  }
  return result;
}

export function createMapView(svg, { onPrecinctEnter, onPrecinctMove, onPrecinctLeave, onPrecinctActivate, onBuildPoint, onCitySelect, onCityDelete, onStroke } = {}) {
  let state = null;
  let edges = [];
  let precinctPaths = new Map();
  // Only one precinct is a tab stop at a time; arrow keys move between neighbors (800 tab stops would be unusable).
  let tabStop = null;
  // The brush: its circle follows the pointer; a press starts a stroke that lasts until release.
  const brush = { active: false, radius: 50, mode: 'add' };
  let stroking = false;
  let strokePointer = null;
  let inspectedId = null;
  let layers = null;
  let lastRender = null;
  let matchupNow = null;
  // The district whose precincts currently show their own colors (hover, focus, list row, or a touch tap).
  let revealedDistrict = null;
  let stickyReveal = false;
  let lastPointerType = 'mouse';
  // Build mode turns clicks into city placement; the keyboard cursor stands in for the pointer.
  let mode = 'view';
  let cities = [];
  let selectedCity = null;
  let viewLabel = '';
  const cursor = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };

  // Enlarges badges on small screens so district numbers stay readable (at least ~10 px radius on screen).
  function badgeScale() {
    const width = svg.clientWidth || 800;
    return Math.min(2.2, Math.max(1, 10 / (BADGE_RADIUS * (width / 800))));
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (lastRender && state && Math.abs(badgeScale() - lastRender.scale) > 0.05) {
        renderDistricts(lastRender.matchup, lastRender.editingDistrict);
      }
    }).observe(svg);
  }

  function setupLayers() {
    svg.replaceChildren();
    const defs = svgEl('defs');
    const clip = svgEl('clipPath', { id: 'state-clip' });
    clip.append(svgEl('path', { 'data-role': 'clip-outline' }));
    const hatch = svgEl('pattern', { id: 'selected-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    hatch.append(svgEl('rect', { width: 3, height: 8, fill: '#ffffff', 'fill-opacity': 0.45 }));
    const dots = svgEl('pattern', { id: 'unassigned-dots', width: 6, height: 6, patternUnits: 'userSpaceOnUse' });
    dots.append(svgEl('circle', { cx: 3, cy: 3, r: 1.1, fill: '#1d2433', 'fill-opacity': 0.45 }));
    defs.append(clip, hatch, dots);
    const precincts = svgEl('g', { class: 'precincts', 'clip-path': 'url(#state-clip)', 'data-role': 'precincts' });
    const unassigned = svgEl('path', { class: 'unassigned-overlay', fill: 'url(#unassigned-dots)', 'clip-path': 'url(#state-clip)', 'pointer-events': 'none', 'data-role': 'unassigned' });
    const selected = svgEl('path', { class: 'selected-district', fill: 'url(#selected-hatch)', 'clip-path': 'url(#state-clip)', 'pointer-events': 'none', 'data-role': 'selected-district' });
    const borders = svgEl('path', { class: 'district-border', fill: 'none', 'clip-path': 'url(#state-clip)', 'pointer-events': 'none', 'data-role': 'district-borders' });
    const selectedBorders = svgEl('path', { class: 'district-border selected-border', fill: 'none', 'clip-path': 'url(#state-clip)', 'pointer-events': 'none', 'data-role': 'selected-borders' });
    const outline = svgEl('path', { class: 'state-outline', 'pointer-events': 'none', 'data-role': 'state-outline' });
    const highlight = svgEl('path', { class: 'precinct-highlight', 'clip-path': 'url(#state-clip)', 'pointer-events': 'none', 'data-role': 'precinct-highlight' });
    const badges = svgEl('g', { class: 'badges', 'pointer-events': 'none', 'aria-hidden': 'true', 'data-role': 'badges' });
    const cityLayer = svgEl('g', { class: 'cities', 'data-role': 'cities' });
    const cursorLayer = svgEl('g', { class: 'build-cursor', 'aria-hidden': 'true', 'pointer-events': 'none', 'data-role': 'build-cursor' });
    cursorLayer.append(svgEl('path', { d: 'M-14,0H14M0,-14V14', class: 'cursor-cross' }), svgEl('circle', { r: 6, class: 'cursor-ring' }));
    const brushLayer = svgEl('g', { class: 'brush', 'aria-hidden': 'true', 'pointer-events': 'none', 'data-role': 'brush' });
    brushLayer.append(svgEl('circle', { class: 'brush-circle', 'data-role': 'brush-circle', 'data-mode': brush.mode, r: brush.radius, cx: 0, cy: 0, style: 'display: none' }));
    svg.append(defs, precincts, unassigned, selected, borders, selectedBorders, outline, highlight, badges, cityLayer, cursorLayer, brushLayer);
    layers = { clip: clip.firstChild, precincts, unassigned, selected, borders, selectedBorders, outline, highlight, badges, cities: cityLayer, cursor: cursorLayer, brush: brushLayer, brushCircle: brushLayer.firstChild };
  }

  // Map coordinates of a pointer event, whatever size the map is drawn at.
  function exactPointFromEvent(event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  }

  function placeBrushCircle(point) {
    if (!layers) return;
    const circle = layers.brushCircle;
    circle.setAttribute('r', brush.radius);
    circle.dataset.mode = brush.mode;
    if (point) {
      circle.setAttribute('cx', point[0]);
      circle.setAttribute('cy', point[1]);
      circle.style.display = brush.active ? '' : 'none';
    } else {
      circle.style.display = 'none';
    }
  }

  function applyBrush() {
    svg.classList.toggle('is-brushing-map', brush.active);
    svg.style.touchAction = brush.active ? 'none' : '';
    if (!brush.active) stroking = false;
    placeBrushCircle(null);
  }

  // Map coordinates (whole pixels) of a pointer event, whatever size the map is drawn at.
  function pointFromEvent(event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: Math.round(point.x), y: Math.round(point.y) };
  }

  function renderCities() {
    if (!layers) return;
    layers.cities.replaceChildren(...cities.map((city, i) => {
      const isSelected = i === selectedCity;
      const marker = svgEl('g', { class: isSelected ? 'city-marker selected' : 'city-marker', 'data-city': i, transform: `translate(${city.x} ${city.y})`, 'aria-hidden': 'true' });
      if (isSelected) marker.setAttribute('data-selected', 'true');
      marker.append(svgEl('circle', { class: 'city-hit', r: 14, fill: 'transparent' }));
      if (isSelected) marker.append(svgEl('circle', { class: 'city-ring', r: 11, fill: 'none' }));
      marker.append(svgEl('circle', { class: 'city-dot', r: 6 }));
      return marker;
    }));
  }

  function placeCursor() {
    if (!layers) return;
    layers.cursor.setAttribute('transform', `translate(${cursor.x} ${cursor.y})`);
    layers.cursor.setAttribute('data-cursor', `${cursor.x},${cursor.y}`);
  }

  // Build mode takes the map out of the precinct tab order and makes the map itself the one focus target.
  function applyMode() {
    const building = mode === 'build';
    svg.classList.toggle('is-building-map', building);
    if (building) {
      svg.setAttribute('tabindex', '0');
      svg.setAttribute('role', 'application');
      svg.setAttribute('aria-label', 'City placement map. Arrow keys move the cursor, Enter adds or removes a city.');
    } else {
      svg.removeAttribute('tabindex');
      svg.setAttribute('role', 'group');
      if (viewLabel) svg.setAttribute('aria-label', viewLabel);
    }
    for (const [id, path] of precinctPaths) path.setAttribute('tabindex', !building && id === tabStop ? '0' : '-1');
    if (layers) layers.cursor.style.display = building ? '' : 'none';
    placeCursor();
  }

  function precinctFromEvent(event) {
    const target = event.target.closest?.('.precinct');
    return target && svg.contains(target) ? target.dataset.precinctId : null;
  }

  function setInspected(precinctId) {
    inspectedId = precinctId;
    if (!precinctId || !state) {
      layers.highlight.setAttribute('d', '');
      return;
    }
    layers.highlight.setAttribute('d', pathFromPolygon(state.precinctsById.get(precinctId).polygon));
  }

  function districtOf(precinctId) {
    return precinctId && state ? state.assignments[precinctId] ?? null : null;
  }

  function sameDistrictPrecinct(node, precinctId) {
    const next = node?.closest?.('.precinct');
    if (!next || !svg.contains(next)) return false;
    const district = districtOf(precinctId);
    return district !== null && districtOf(next.dataset.precinctId) === district;
  }

  function trackPointer(event) {
    if (event.pointerType) lastPointerType = event.pointerType;
  }
  svg.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    if (!brush.active || mode === 'build' || (event.button !== undefined && event.button > 0)) return;
    const point = exactPointFromEvent(event);
    if (!point) return;
    // A stroke is under way: no details pop-up, highlight, or district reveal until it ends.
    stroking = true;
    strokePointer = event.pointerId;
    try {
      svg.setPointerCapture?.(event.pointerId);
    } catch {
      // A synthetic pointer has nothing to capture; the stroke still works.
    }
    const id = inspectedId;
    setInspected(null);
    if (id) onPrecinctLeave?.(id);
    setRevealed(null);
    placeBrushCircle(point);
    event.preventDefault();
    onStroke?.({ type: 'start', point, shiftKey: event.shiftKey });
  });
  function endStroke(event, type) {
    if (!stroking || (strokePointer !== null && event.pointerId !== undefined && event.pointerId !== strokePointer)) return;
    stroking = false;
    strokePointer = null;
    try {
      svg.releasePointerCapture?.(event.pointerId);
    } catch {
      // Nothing was captured.
    }
    onStroke?.({ type, point: exactPointFromEvent(event), shiftKey: event.shiftKey });
  }
  svg.addEventListener('pointerup', (event) => {
    trackPointer(event);
    endStroke(event, 'end');
  });
  svg.addEventListener('pointercancel', (event) => endStroke(event, 'cancel'));
  svg.addEventListener('pointerleave', () => {
    if (!stroking) placeBrushCircle(null);
  });

  svg.addEventListener('pointerover', (event) => {
    trackPointer(event);
    if (stroking) return;
    const id = precinctFromEvent(event);
    if (id && event.pointerType !== 'touch') {
      stickyReveal = false;
      setRevealed(districtOf(id));
    }
    if (!id || id === inspectedId) return;
    setInspected(id);
    onPrecinctEnter?.(id, { x: event.clientX, y: event.clientY });
  });
  svg.addEventListener('pointermove', (event) => {
    if (brush.active && mode !== 'build') {
      const point = exactPointFromEvent(event);
      if (point) {
        placeBrushCircle(point);
        // Holding Shift flips Add and Erase, and the circle shows which one a press would do.
        if (!stroking && event.shiftKey) layers.brushCircle.dataset.mode = brush.mode === 'add' ? 'erase' : 'add';
        if (stroking) onStroke?.({ type: 'move', point, shiftKey: event.shiftKey });
      }
    }
    if (stroking) return;
    const id = precinctFromEvent(event);
    if (id && id === inspectedId) onPrecinctMove?.(id, { x: event.clientX, y: event.clientY });
  });
  svg.addEventListener('pointerout', (event) => {
    if (stroking) return;
    const id = precinctFromEvent(event);
    const next = event.relatedTarget?.closest?.('.precinct');
    if (id && (!next || !svg.contains(next))) {
      setInspected(null);
      onPrecinctLeave?.(id);
    }
    if (id && event.pointerType !== 'touch' && !stickyReveal && !sameDistrictPrecinct(event.relatedTarget, id)) {
      // Moving onto a precinct of another district reveals that district from its own pointerover.
      if (!next || !svg.contains(next)) setRevealed(null);
    }
  });
  svg.addEventListener('focusin', (event) => {
    const id = precinctFromEvent(event);
    if (!id) return;
    if (mode !== 'build') setTabStop(id);
    stickyReveal = false;
    setRevealed(districtOf(id));
    setInspected(id);
    onPrecinctEnter?.(id, event.target);
  });
  svg.addEventListener('focusout', (event) => {
    const id = precinctFromEvent(event);
    if (!id) return;
    setInspected(null);
    onPrecinctLeave?.(id);
    const next = event.relatedTarget?.closest?.('.precinct');
    if (!next || !svg.contains(next)) setRevealed(null);
  });
  svg.addEventListener('click', (event) => {
    // With the brush on, the press already did the work (pointer events), so the click that follows is ignored.
    if (brush.active && mode !== 'build') return;
    if (mode === 'build') {
      const marker = event.target.closest?.('.city-marker');
      if (marker && svg.contains(marker)) {
        onCitySelect?.(Number(marker.dataset.city));
        return;
      }
      const point = pointFromEvent(event);
      if (point) onBuildPoint?.(point);
      return;
    }
    const id = precinctFromEvent(event);
    const touch = (event.pointerType || lastPointerType) === 'touch';
    if (touch && !lastRender?.editingDistrict) {
      // A tap keeps its district revealed until the next tap; tapping it again or outside a district clears it.
      const district = districtOf(id);
      const again = stickyReveal && district === revealedDistrict;
      stickyReveal = district !== null && !again;
      setRevealed(stickyReveal ? district : null);
    }
    if (id) onPrecinctActivate?.(id, event);
  });
  const CURSOR_STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const ARROW_DIRECTIONS = CURSOR_STEPS;

  svg.addEventListener('keydown', (event) => {
    if (mode === 'build') {
      const step = CURSOR_STEPS[event.key];
      if (step) {
        const size = event.shiftKey ? 40 : 10;
        cursor.x = Math.min(MAP_WIDTH, Math.max(0, cursor.x + step[0] * size));
        cursor.y = Math.min(MAP_HEIGHT, Math.max(0, cursor.y + step[1] * size));
        placeCursor();
        event.preventDefault();
      } else if (event.key === 'Enter' || event.key === ' ') {
        onBuildPoint?.({ x: cursor.x, y: cursor.y });
        event.preventDefault();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        onCityDelete?.();
        event.preventDefault();
      }
      return;
    }
    const id = precinctFromEvent(event);
    if (id && ARROW_DIRECTIONS[event.key]) {
      const next = neighborInDirection(id, ARROW_DIRECTIONS[event.key]);
      if (next) {
        setTabStop(next);
        precinctPaths.get(next)?.focus({ preventScroll: true });
      }
      event.preventDefault();
      return;
    }
    if (!id || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (brush.active) {
      const precinct = state.precinctsById.get(id);
      onStroke?.({ type: 'tap', point: [...(precinct.center ?? precinct.seedPoint)], shiftKey: event.shiftKey });
      return;
    }
    onPrecinctActivate?.(id, event);
  });

  function setTabStop(id) {
    if (id === tabStop) return;
    precinctPaths.get(tabStop)?.setAttribute('tabindex', '-1');
    tabStop = id;
    precinctPaths.get(id)?.setAttribute('tabindex', '0');
  }

  // The neighbor of a precinct that lies most nearly in the arrow's direction, or null at the edge of the state.
  function neighborInDirection(id, direction) {
    const from = state.precinctsById.get(id);
    const [fx, fy] = from.center ?? from.seedPoint;
    let best = null;
    let bestScore = 0.3;
    for (const neighborId of from.neighbors) {
      const to = state.precinctsById.get(neighborId);
      const [tx, ty] = to.center ?? to.seedPoint;
      const length = Math.hypot(tx - fx, ty - fy) || 1;
      const score = ((tx - fx) * direction[0] + (ty - fy) * direction[1]) / length;
      if (score > bestScore) {
        bestScore = score;
        best = neighborId;
      }
    }
    return best;
  }

  function paintPrecinct(precinct) {
    const path = precinctPaths.get(precinct.id);
    const number = state.assignments[precinct.id] ?? null;
    const district = number === null ? null : state.districts[number - 1];
    if (district && number !== revealedDistrict) {
      const color = getResultColor(district.status, district.marginPercent, matchupNow);
      path.setAttribute('fill', color);
      path.style.stroke = color;
      path.dataset.revealed = 'false';
    } else {
      path.setAttribute('fill', path.dataset.ownFill);
      path.style.stroke = '';
      path.dataset.revealed = String(district !== null);
    }
  }

  // Districts are painted as one solid color; unassigned and revealed precincts show their own result.
  function paintPrecincts() {
    for (const precinct of state.precincts) paintPrecinct(precinct);
  }

  function setRevealed(number) {
    const next = number ?? null;
    if (next === null) stickyReveal = false;
    if (next === revealedDistrict) return;
    const previous = revealedDistrict;
    revealedDistrict = next;
    if (!state || !matchupNow) return;
    for (const precinct of state.precincts) {
      const d = state.assignments[precinct.id] ?? null;
      if (d !== null && (d === previous || d === next)) paintPrecinct(precinct);
    }
  }

  function renderPrecincts(matchup) {
    matchupNow = matchup;
    for (const precinct of state.precincts) {
      const result = getResult(precinct.sideAVoters, precinct.sideBVoters);
      const path = precinctPaths.get(precinct.id);
      path.dataset.ownFill = getResultColor(result.status, result.marginPercent, matchup);
      path.dataset.status = result.status;
    }
  }

  function renderDistricts(matchup, editingDistrict) {
    const { assignments } = state;
    const borderSegments = [];
    const selectedSegments = [];
    for (const edge of edges) {
      const da = assignments[edge.a] ?? null;
      const db = assignments[edge.b] ?? null;
      if (da === db) continue;
      if (editingDistrict && (da === editingDistrict || db === editingDistrict)) selectedSegments.push(edge.segment);
      else borderSegments.push(edge.segment);
    }
    layers.borders.setAttribute('d', segmentsPath(borderSegments));
    layers.selectedBorders.setAttribute('d', segmentsPath(selectedSegments));
    layers.selected.setAttribute('d', editingDistrict
      ? state.precincts.filter((c) => assignments[c.id] === editingDistrict).map((c) => pathFromPolygon(c.polygon)).join('')
      : '');

    const unassignedPaths = [];
    for (const precinct of state.precincts) {
      const path = precinctPaths.get(precinct.id);
      const number = assignments[precinct.id] ?? null;
      path.dataset.district = number === null ? '' : String(number);
      path.setAttribute('aria-label', number === null ? `${precinct.name}, No district` : `${precinct.name}, District ${number}`);
      path.classList.toggle('in-selected', number !== null && editingDistrict === number);
      path.classList.toggle('unassigned', number === null);
      if (number === null) unassignedPaths.push(pathFromPolygon(precinct.polygon));
    }
    layers.unassigned.setAttribute('d', unassignedPaths.join(''));

    const scale = badgeScale();
    lastRender = { matchup, editingDistrict, scale };
    const labeled = state.districts.filter((d) => d.labelPoint);
    const positions = separateBadges(labeled.map((d) => d.labelPoint), BADGE_RADIUS * scale);
    const badges = labeled.map((district, i) => {
      const color = getResultColor(district.status, district.marginPercent, matchup);
      const group = svgEl('g', { class: 'badge', 'data-district': district.number, transform: `translate(${positions[i][0].toFixed(1)} ${positions[i][1].toFixed(1)}) scale(${scale.toFixed(2)})` });
      group.classList.toggle('selected', district.number === editingDistrict);
      const circle = svgEl('circle', { r: BADGE_RADIUS, fill: color });
      const text = svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: textColorFor(district.status, district.marginPercent) });
      text.textContent = String(district.number);
      group.append(circle, text);
      return group;
    });
    layers.badges.replaceChildren(...badges);
    svg.classList.toggle('is-editing', Boolean(editingDistrict));

    // After an edit, a hovered precinct's reveal follows the precinct into its current district.
    if (inspectedId && !stickyReveal) revealedDistrict = assignments[inspectedId] ?? null;
    matchupNow = matchup;
    paintPrecincts();
  }

  return {
    setState(nextState) {
      // Voter-only changes keep the same layout key, so the precinct shapes, edges, and hover state are reused.
      const sameLayout = state && (nextState.layoutKey !== undefined ? state.layoutKey === nextState.layoutKey : state.precincts === nextState.precincts);
      const fresh = !state || !sameLayout;
      state = nextState;
      if (!fresh) return;
      setupLayers();
      edges = precomputeEdges(state);
      const outlinePath = pathFromPolygon(state.outline);
      layers.clip.setAttribute('d', outlinePath);
      layers.outline.setAttribute('d', outlinePath);
      precinctPaths = new Map();
      for (const precinct of state.precincts) {
        const path = svgEl('path', {
          class: 'precinct',
          d: pathFromPolygon(precinct.polygon),
          tabindex: '-1',
          role: 'button',
          'data-precinct-id': precinct.id,
        });
        precinctPaths.set(precinct.id, path);
        layers.precincts.append(path);
      }
      viewLabel = `Map of ${state.name} with ${state.precincts.length} precincts and ${state.districtCount} congressional districts`;
      tabStop = state.precincts[0]?.id ?? null;
      inspectedId = null;
      revealedDistrict = null;
      stickyReveal = false;
      applyMode();
      renderCities();
    },
    setMode(nextMode) {
      mode = nextMode === 'build' ? 'build' : 'view';
      applyMode();
    },
    // Shows or hides the brush circle and sets its size and look; strokes are reported through `onStroke`.
    setBrush({ active = false, radius = brush.radius, mode: brushMode = brush.mode } = {}) {
      brush.active = Boolean(active);
      brush.radius = radius;
      brush.mode = brushMode;
      applyBrush();
    },
    get isStroking() {
      return stroking;
    },
    setCities(points, selectedIndex = null) {
      cities = points.map((p) => ({ x: p.x, y: p.y }));
      selectedCity = selectedIndex;
      renderCities();
    },
    get cursor() {
      return { ...cursor };
    },
    render(matchup, editingDistrict = null) {
      if (!state) return;
      renderPrecincts(matchup);
      renderDistricts(matchup, editingDistrict);
    },
    renderDistricts(matchup, editingDistrict = null) {
      if (state) renderDistricts(matchup, editingDistrict);
    },
    setRevealed(number, { sticky = false } = {}) {
      setRevealed(number);
      stickyReveal = sticky && revealedDistrict !== null;
    },
    getRevealed() {
      return revealedDistrict;
    },
    isRevealSticky() {
      return stickyReveal;
    },
    getPrecinctElement(precinctId) {
      return precinctPaths.get(precinctId) ?? null;
    },
    get inspectedPrecinctId() {
      return inspectedId;
    },
    get edgeCount() {
      return edges.length;
    },
  };
}

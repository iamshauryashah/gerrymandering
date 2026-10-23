import { generateState } from './state-generator.js';
import { applyPrecinctEdit, getControlTotal, getPlanStatus, reassignPrecinct, summarizeDistricts } from './districts.js';
import { MATCHUPS } from './matchups.js';
import { formatPrecinctDetails, formatDistrictDetails, formatNoDistrictDetails } from './formatters.js';
import { createSeed, getSeedFromUrl } from './random.js';
import {
  DEFAULT_POPULATION, MAX_CITIES, MIN_CITY_DISTANCE, addCity, applyVoterSettings, buildCustomState, checkCityPlacement, createPlan,
  decodeCustomCode, findCityAt, getCustomCodeFromUrl, normalizePopulation, removeCity as removeCityFromPlan,
  setCityPopulation as setPlanCityPopulation, withSettings,
} from './custom-state.js';
import { createTooltip } from './ui/tooltip.js';
import { createMatchupToggle } from './ui/matchup-toggle.js';
import { renderLegend } from './ui/legend.js';
import { createSummaryDock } from './ui/summary-dock.js';
import { createMapView } from './ui/map-view.js';
import { createDistrictList } from './ui/district-list.js';
import { renderControlTotal } from './ui/control-total.js';
import { renderStateTotals } from './ui/state-totals.js';
import { renderPlanStatus } from './ui/plan-status.js';
import { renderDistrictDetail } from './ui/district-detail.js';
import { createBuilderPanel } from './ui/builder-panel.js';
import { createBrushPanel } from './ui/brush-panel.js';
import { BRUSH_SIZE, applySegment, finishStroke, startStroke } from './brush.js';

const INVALID_LINK_MESSAGE = "That custom map link isn't valid, so here is a new random map.";

const BUILD_MESSAGES = {
  outside: 'Cities must be inside the state.',
  'too-close': `Cities must be at least ${MIN_CITY_DISTANCE} pixels apart.`,
  limit: `You can place up to ${MAX_CITIES} cities.`,
  layout: "These cities can't make a map that splits into fair districts. Try moving cities further apart or removing one.",
};

export function createApp(root, {
  seed, custom, confirm = (text) => window.confirm(text), buildState = buildCustomState, makeOutlineSeed = createSeed, makeState = generateState,
} = {}) {
  const $ = (role) => root.querySelector(`[data-role="${role}"]`);
  const elements = {
    caption: $('state-caption'),
    toggle: $('matchup-toggle'),
    newMap: $('new-map'),
    buildState: $('build-state'),
    builder: $('builder'),
    brushTool: $('brush-tool'),
    status: $('editing-status'),
    editMessage: $('edit-message'),
    planStatus: $('plan-status'),
    detail: $('district-detail'),
    error: $('error'),
    retry: $('retry'),
    layout: $('map-layout'),
    map: $('map'),
    control: $('control-total'),
    stateTotals: $('state-totals'),
    legend: $('legend'),
    list: $('district-list'),
    tooltip: $('tooltip'),
  };

  const app = {
    state: null,
    matchup: MATCHUPS[0],
    editingDistrict: null,
    inspected: null,
    // 'view' for the normal page, 'build' while the visitor is building a state; `draft` holds the work in progress.
    mode: 'view',
    draft: null,
    // The brush: on only while a district is selected; its size and mode are kept until a new state is shown.
    brush: { on: false, size: BRUSH_SIZE.default, mode: 'add', unclaimedOnly: false },
    // The stroke under way: `{ stroke, last, queue, frame }`, or null.
    stroke: null,
    lastStroke: null,
  };

  const tooltip = createTooltip(elements.tooltip);

  function districtFor(precinctId) {
    const number = app.state.assignments[precinctId] ?? null;
    return number === null ? null : app.state.districts[number - 1];
  }

  function inspectedSections() {
    if (!app.inspected || !app.state) return [];
    if (app.inspected.type === 'precinct') {
      const precinct = app.state.precinctsById.get(app.inspected.id);
      const district = districtFor(precinct.id);
      return [
        formatPrecinctDetails(precinct, app.matchup),
        district ? formatDistrictDetails(district, app.state.precinctsById, app.matchup) : formatNoDistrictDetails(),
      ];
    }
    return [formatDistrictDetails(app.state.districts[app.inspected.id - 1], app.state.precinctsById, app.matchup)];
  }

  function showInspected(at) {
    tooltip.show(inspectedSections(), at);
  }

  function clearInspected(type, id) {
    if (app.inspected && app.inspected.type === type && app.inspected.id === id) {
      app.inspected = null;
      tooltip.hide();
    }
  }

  const mapView = createMapView(elements.map, {
    onPrecinctEnter(id, at) {
      app.inspected = { type: 'precinct', id };
      showInspected(at);
    },
    onPrecinctMove(id, at) {
      tooltip.move(at);
    },
    onPrecinctLeave(id) {
      clearInspected('precinct', id);
    },
    onPrecinctActivate(id) {
      if (!app.editingDistrict) return;
      editPrecinct(id);
    },
    onBuildPoint(point) {
      placeCity(point);
    },
    onStroke(event) {
      handleStroke(event);
    },
    onCitySelect(index) {
      selectCity(index);
    },
    onCityDelete() {
      removeSelectedCity();
    },
  });

  const builderPanel = createBuilderPanel(elements.builder, {
    onShare(shareA) {
      setBuilderSettings({ shareA });
    },
    onLean(cityLean) {
      setBuilderSettings({ cityLean });
    },
    onPopulation(thousands) {
      schedulePopulation(thousands);
    },
    onPopulationCommit(thousands) {
      setPopulationNow(thousands);
    },
    onRemove() {
      removeSelectedCity();
    },
    onUse() {
      useBuiltState();
    },
    onCancel() {
      cancelBuilder();
    },
    onClear() {
      clearCities();
    },
    onNewOutline() {
      newOutline();
    },
  });

  const districtList = createDistrictList(elements.list, {
    onPenToggle(number) {
      setEditing(app.editingDistrict === number ? null : number);
    },
    onDistrictEnter(number, at) {
      mapView.setRevealed(number);
      app.inspected = { type: 'district', id: number };
      showInspected(at);
    },
    onDistrictMove(number, at) {
      if (app.inspected?.type === 'district' && app.inspected.id === number) tooltip.move(at);
    },
    onDistrictLeave(number) {
      if (mapView.getRevealed() === number && !mapView.isRevealSticky()) mapView.setRevealed(null);
      clearInspected('district', number);
    },
  });

  // --- Brush ------------------------------------------------------------------------------------------------------

  const brushPanel = elements.brushTool
    ? createBrushPanel(elements.brushTool, {
      onToggle() {
        setBrushOn(!app.brush.on);
      },
      onMode(mode) {
        setBrushOptions({ mode });
      },
      onSize(size) {
        setBrushOptions({ size });
      },
      onUnclaimedOnly(unclaimedOnly) {
        setBrushOptions({ unclaimedOnly });
      },
    })
    : null;

  const brushAvailable = () => app.mode === 'view' && app.editingDistrict !== null && Boolean(app.state);
  const otherMode = (mode) => (mode === 'add' ? 'erase' : 'add');
  const effectiveMode = (shiftKey) => (shiftKey ? otherMode(app.brush.mode) : app.brush.mode);

  function renderBrush() {
    const available = brushAvailable();
    if (!available && app.brush.on) {
      app.brush.on = false;
      if (app.stroke) finishRun();
    }
    brushPanel?.render({ available, on: app.brush.on, mode: app.brush.mode, size: app.brush.size, unclaimedOnly: app.brush.unclaimedOnly });
    mapView.setBrush({ active: app.brush.on, radius: app.brush.size, mode: app.stroke ? app.stroke.stroke.mode : app.brush.mode });
    root.classList.toggle('is-brushing', app.brush.on);
  }

  function setBrushOn(on) {
    if (on && !brushAvailable()) return false;
    const ended = !on && app.stroke ? finishRun() : null;
    app.brush.on = Boolean(on);
    if (!on && !ended) brushPanel?.say('');
    renderBrush();
    return true;
  }

  function setBrushOptions({ size, mode, unclaimedOnly } = {}) {
    if (size !== undefined) {
      const stepped = Math.round(Number(size) / BRUSH_SIZE.step) * BRUSH_SIZE.step;
      app.brush.size = Math.min(BRUSH_SIZE.max, Math.max(BRUSH_SIZE.min, stepped));
    }
    if (mode === 'add' || mode === 'erase') app.brush.mode = mode;
    if (typeof unclaimedOnly === 'boolean') app.brush.unclaimedOnly = unclaimedOnly;
    renderBrush();
  }

  // Applies the queued pointer positions as segments of the running stroke, then draws the plan once.
  function applyQueued() {
    const run = app.stroke;
    if (!run) return;
    if (run.frame) {
      cancelAnimationFrame(run.frame);
      run.frame = null;
    }
    if (!run.queue.length) return;
    let state = app.state;
    for (const point of run.queue) {
      state = applySegment(state, run.stroke, run.last, point, { labels: false }).state;
      run.last = point;
    }
    run.queue = [];
    if (state !== app.state) commit({ ...state, districts: summarizeDistricts(state) });
  }

  function startRun({ point, shiftKey }) {
    if (app.stroke) finishRun();
    const stroke = startStroke(app.state, { district: app.editingDistrict, mode: effectiveMode(shiftKey), radius: app.brush.size, unclaimedOnly: app.brush.unclaimedOnly });
    app.stroke = { stroke, last: point, queue: [point], frame: null };
    app.inspected = null;
    tooltip.hide();
    showEditMessage(null);
    brushPanel?.say('');
    applyQueued();
    renderBrush();
  }

  // Ends the running stroke and reports what it did in one message.
  function finishRun() {
    const run = app.stroke;
    if (!run) return null;
    applyQueued();
    app.stroke = null;
    const summary = finishStroke(app.state, run.stroke);
    app.lastStroke = summary;
    brushPanel?.say(summary.message);
    renderBrush();
    return summary;
  }

  function abortStroke() {
    if (app.stroke) finishRun();
  }

  function handleStroke(event) {
    if (!app.brush.on || !brushAvailable()) return;
    if (event.type === 'start' || event.type === 'tap') {
      startRun(event);
      if (event.type === 'tap') finishRun();
      return;
    }
    const run = app.stroke;
    if (!run) return;
    if (event.point) run.queue.push(event.point);
    if (event.type === 'move') {
      if (!run.frame) {
        run.frame = requestAnimationFrame(() => {
          run.frame = null;
          applyQueued();
        });
      }
      return;
    }
    finishRun();
  }

  // Test and automation helpers: a one-position stroke, and a whole drag along a list of [x, y] points.
  function strokeAtPoint(point, { shiftKey = false } = {}) {
    handleStroke({ type: 'tap', point: [point[0], point[1]], shiftKey });
    return lastSummary();
  }

  function dragBrush(points, { shiftKey = false } = {}) {
    if (!points.length) return null;
    handleStroke({ type: 'start', point: [...points[0]], shiftKey });
    for (const point of points.slice(1)) handleStroke({ type: 'move', point: [...point], shiftKey });
    handleStroke({ type: 'end', point: null, shiftKey });
    return lastSummary();
  }

  const lastSummary = () => app.lastStroke;

  createMatchupToggle(elements.toggle, {
    onChange(matchup) {
      abortStroke();
      app.matchup = matchup;
      renderAll();
    },
  });

  function renderEditingStatus() {
    const n = app.editingDistrict;
    elements.status.hidden = !n;
    elements.status.textContent = n ? `Editing District ${n}: click precincts to add or remove them. Press Escape or the pen again to stop.` : '';
    root.classList.toggle('is-editing', Boolean(n));
    renderBrush();
  }

  function showEditMessage(text) {
    if (!elements.editMessage) return;
    elements.editMessage.textContent = text ?? '';
    elements.editMessage.hidden = !text;
  }

  function renderDistrictViews() {
    const plan = getPlanStatus(app.state);
    mapView.renderDistricts(app.matchup, app.editingDistrict);
    districtList.render(app.state.districts, app.matchup, app.editingDistrict, plan.balance);
    renderControlTotal(elements.control, getControlTotal(app.state.districts, app.state), app.matchup);
    if (elements.planStatus) renderPlanStatus(elements.planStatus, plan);
    if (elements.detail) {
      const n = app.editingDistrict;
      renderDistrictDetail(elements.detail, {
        district: n ? app.state.districts[n - 1] : null,
        balanceInfo: n ? plan.balance.districts[n - 1] : null,
        balance: plan.balance,
        matchup: app.matchup,
      });
    }
    renderEditingStatus();
    tooltip.update(inspectedSections());
  }

  // Describes the whole state, so it redraws with a new map or matchup but never after a district edit.
  function renderStateTotalsView() {
    renderStateTotals(elements.stateTotals, app.state, app.matchup);
  }

  function renderAll() {
    if (!app.state) return;
    mapView.render(app.matchup, app.editingDistrict);
    renderLegend(elements.legend, app.matchup);
    renderStateTotalsView();
    renderDistrictViews();
    if (app.draft) builderPanel.render({ plan: app.draft.plan, result: app.draft.result, matchup: app.matchup, selected: app.draft.selected });
  }

  // --- Build mode ---------------------------------------------------------------------------------------------

  // A plan with a fresh outline that builds: the first of a few new outlines (keeping the cities that fit it).
  function freshDraftPlan(cities = [], settings = {}) {
    let last = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let plan = withSettings(createPlan({ outlineSeed: makeOutlineSeed() }), settings);
      for (const city of cities) if (checkCityPlacement(plan, city).ok) plan = addCity(plan, city, city.pop);
      last = { plan, result: buildState(plan) };
      if (last.result.ok) break;
    }
    return last;
  }

  // Shows the draft: a built map replaces the one on screen; a failed build keeps the last good map.
  function showDraft() {
    const { plan, result } = app.draft;
    if (result.ok) {
      app.state = result.state;
      mapView.setState(app.state);
    }
    mapView.setCities(plan.cities, app.draft.selected);
    elements.caption.textContent = `Building your own state · ${app.state.precincts.length} precincts · ${app.state.districtCount} districts`;
    renderAll();
  }

  function changeDraft(plan, announcement, selected = null) {
    const result = buildState(plan);
    app.draft = { ...app.draft, plan, result, selected };
    showDraft();
    builderPanel.say(result.ok ? `${announcement} ${plan.cities.length} of ${MAX_CITIES} cities.` : BUILD_MESSAGES.layout);
  }

  function populationText(pop) {
    return `${pop.toLocaleString('en-US')} voters`;
  }

  // A click, tap, or Enter at a point: it selects the city that is there, or adds one if the rules allow.
  function placeCity(point) {
    if (!app.draft) return null;
    const existing = findCityAt(app.draft.plan, point);
    if (existing >= 0) return selectCity(existing);
    const check = checkCityPlacement(app.draft.plan, point);
    if (!check.ok) {
      builderPanel.say(BUILD_MESSAGES[check.reason]);
      return check;
    }
    const plan = addCity(app.draft.plan, point, app.draft.lastPopulation);
    changeDraft(plan, `City added at x ${point.x}, y ${point.y}.`, plan.cities.length - 1);
    return { ok: true };
  }

  function selectCity(index) {
    if (!app.draft || !app.draft.plan.cities[index]) return null;
    app.draft = { ...app.draft, selected: index };
    showDraft();
    builderPanel.say(`City ${index + 1} selected. ${populationText(app.draft.plan.cities[index].pop)}.`);
    return { ok: true, selected: index };
  }

  // Removes a city, keeping the same city selected unless it was the one removed.
  function removeCityAt(index) {
    if (!app.draft || !app.draft.plan.cities[index]) return null;
    const { selected } = app.draft;
    let next = null;
    if (selected !== null && selected !== index) next = selected > index ? selected - 1 : selected;
    changeDraft(removeCityFromPlan(app.draft.plan, index), `City ${index + 1} removed.`, next);
    return { ok: true, removed: true };
  }

  function removeSelectedCity() {
    if (!app.draft || app.draft.selected === null) return null;
    return removeCityAt(app.draft.selected);
  }

  // A city's population changed: the layout is redrawn around it and the state's total follows.
  function setCityPopulation(index, value) {
    if (!app.draft || !app.draft.plan.cities[index]) return null;
    const pop = normalizePopulation(value);
    if (pop !== app.draft.plan.cities[index].pop) {
      changeDraft(setPlanCityPopulation(app.draft.plan, index, pop), `City ${index + 1} set to ${populationText(pop)}.`, index);
    }
    app.draft = { ...app.draft, lastPopulation: pop };
    return { ok: true, pop };
  }

  // Dragging the slider redraws once it pauses; letting go applies the value at once.
  let populationTimer = null;
  function clearPopulationTimer() {
    clearTimeout(populationTimer);
    populationTimer = null;
  }

  function setPopulationNow(thousands) {
    clearPopulationTimer();
    if (!app.draft || app.draft.selected === null) return null;
    return setCityPopulation(app.draft.selected, thousands * 1000);
  }

  function schedulePopulation(thousands) {
    clearPopulationTimer();
    populationTimer = setTimeout(() => setPopulationNow(thousands), 120);
  }

  // A slider moved: only the voters change, so the layout is reused and the map recolors at once.
  function setBuilderSettings(settings) {
    if (!app.draft) return null;
    const plan = withSettings(app.draft.plan, settings);
    const result = app.draft.result.ok
      ? { ok: true, state: applyVoterSettings(app.draft.result.state, settings) }
      : buildState(plan);
    app.draft = { ...app.draft, plan, result };
    showDraft();
    return result;
  }

  function leaveBuilder() {
    clearPopulationTimer();
    app.mode = 'view';
    app.draft = null;
    root.classList.remove('is-building');
    elements.builder.hidden = true;
    builderPanel.say('');
    mapView.setMode('view');
  }

  // Closes the builder and shows the built state with every district empty.
  function useBuiltState() {
    if (!app.draft || !app.draft.result.ok) return false;
    const state = app.draft.result.state;
    showState(state);
    setAddress('custom', state.seed);
    return true;
  }

  // Removes every city and puts both voter settings back to their defaults; the outline stays.
  function clearCities() {
    if (!app.draft) return false;
    if (app.draft.plan.cities.length && !confirm('Clear all cities and reset the voter settings?')) return false;
    changeDraft(createPlan({ outlineSeed: app.draft.plan.outlineSeed }), 'All cities cleared.');
    return true;
  }

  // A new random outline; the voter settings stay and every city that still fits it is kept.
  function newOutline() {
    if (!app.draft) return false;
    const { plan: old } = app.draft;
    const { plan, result } = freshDraftPlan(old.cities, { shareA: old.shareA, cityLean: old.cityLean });
    app.draft = { ...app.draft, plan, result, selected: null };
    showDraft();
    const removed = old.cities.length - plan.cities.length;
    if (!result.ok) builderPanel.say(BUILD_MESSAGES.layout);
    else if (removed) builderPanel.say(`New outline. ${removed} ${removed === 1 ? 'city' : 'cities'} outside it ${removed === 1 ? 'was' : 'were'} removed.`);
    else builderPanel.say('New outline.');
    return true;
  }

  // Closes the builder and brings back the map the visitor had, districts and all. Nothing of theirs was changed.
  function cancelBuilder() {
    if (!app.draft) return false;
    const { snapshot } = app.draft;
    app.state = snapshot.state;
    leaveBuilder();
    mapView.setState(app.state);
    window.history.replaceState(null, '', snapshot.address);
    renderCaption();
    renderAll();
    return true;
  }

  function startBuilder() {
    if (app.mode === 'build' || !app.state) return false;
    const hasWork = Object.values(app.state.assignments).some((d) => d !== null);
    if (hasWork && !confirm('Build a state? Your districts will be lost.')) return false;
    const snapshot = { state: app.state, address: `${window.location.pathname}${window.location.search}${window.location.hash}` };
    const { plan, result } = freshDraftPlan();
    app.mode = 'build';
    app.draft = { plan, result, snapshot, selected: null, lastPopulation: DEFAULT_POPULATION };
    app.editingDistrict = null;
    app.inspected = null;
    showEditMessage(null);
    tooltip.hide();
    root.classList.add('is-building');
    elements.builder.hidden = false;
    mapView.setMode('build');
    showDraft();
    builderPanel.say(result.ok ? '' : BUILD_MESSAGES.layout);
    return true;
  }

  function setEditing(number) {
    abortStroke();
    app.editingDistrict = number;
    if (number === null) brushPanel?.say('');
    mapView.setRevealed(null);
    showEditMessage(null);
    renderDistrictViews();
  }

  function commit(next) {
    if (next === app.state) return;
    app.state = next;
    mapView.setState(next);
    renderDistrictViews();
  }

  // Sets a precinct's district directly, without the editing rules (used to load whole plans).
  function assignPrecinct(precinctId, districtNumber) {
    commit(reassignPrecinct(app.state, precinctId, districtNumber));
  }

  // Replaces every precinct's district at once (used to load a whole plan).
  function setAssignments(assignments) {
    const next = { ...app.state, assignments: { ...assignments } };
    next.districts = summarizeDistricts(next);
    commit(next);
  }

  function blockedMessage(edit, precinctId) {
    const name = app.state.precinctsById.get(precinctId).name;
    if (edit.reason === 'not-adjacent') return `District ${edit.to} must stay connected. Pick a precinct that touches it.`;
    if (edit.reason === 'split-source') return `Can't take ${name}: it would split District ${edit.from} into pieces.`;
    return `Can't remove ${name}: it would split District ${edit.from} into pieces.`;
  }

  function editPrecinct(precinctId) {
    if (!app.editingDistrict) return null;
    const { state, edit } = applyPrecinctEdit(app.state, precinctId, app.editingDistrict);
    showEditMessage(edit.allowed ? null : blockedMessage(edit, precinctId));
    commit(state);
    return edit;
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape' || !app.editingDistrict) return;
    // The first Escape turns the brush off (ending any stroke); the next one stops editing the district.
    if (app.brush.on) setBrushOn(false);
    else setEditing(null);
  }
  document.addEventListener('keydown', onKeyDown);

  // Shows a state as the map in use, with every other part of the page reset around it.
  function showState(state) {
    abortStroke();
    app.brush = { on: false, size: BRUSH_SIZE.default, mode: 'add', unclaimedOnly: false };
    brushPanel?.say('');
    app.state = state;
    app.editingDistrict = null;
    app.inspected = null;
    showEditMessage(null);
    tooltip.hide();
    leaveBuilder();
    mapView.setState(app.state);
    renderCaption();
    renderAll();
  }

  function load(nextSeed) {
    elements.error.hidden = true;
    elements.layout.hidden = false;
    let state;
    try {
      state = makeState({ seed: nextSeed });
    } catch (error) {
      console.error(error);
      app.state = null;
      elements.error.hidden = false;
      elements.layout.hidden = true;
      return;
    }
    showState(state);
  }

  // Opens a custom state from its address code; false when the code is damaged or cannot be built.
  function loadCustom(code) {
    const plan = decodeCustomCode(code);
    const result = plan ? buildState(plan) : null;
    if (!result?.ok) return false;
    elements.error.hidden = true;
    elements.layout.hidden = false;
    showState(result.state);
    return true;
  }

  // The address keeps exactly one of ?seed= and ?custom=, so a reload shows what is on screen.
  function setAddress(name, value) {
    const url = new URL(window.location.href);
    url.searchParams.delete('seed');
    url.searchParams.delete('custom');
    url.searchParams.set(name, value);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  // The line under the title: a seed link for random states, a code link for custom ones.
  function renderCaption() {
    const { state } = app;
    const link = document.createElement('a');
    if (state.custom) {
      link.href = `?custom=${encodeURIComponent(state.seed)}`;
      link.textContent = 'custom map link';
    } else {
      link.href = `?seed=${encodeURIComponent(state.seed)}`;
      link.textContent = `seed ${state.seed}`;
    }
    const label = state.custom ? 'A custom state' : `The fictional state of ${state.name}`;
    elements.caption.replaceChildren(document.createTextNode(`${label} · ${state.precincts.length} precincts · ${state.districtCount} districts · `), link);
  }

  // Replaces the map with a new random state, asking first if any districts would be lost.
  function newMap() {
    const hasWork = app.state && Object.values(app.state.assignments).some((d) => d !== null);
    if (hasWork && !confirm('Start a new map? Your districts will be lost.')) return false;
    load(createSeed());
    if (!app.state) return true;
    setAddress('seed', app.state.seed);
    return true;
  }

  elements.retry?.addEventListener('click', () => load(createSeed()));
  elements.newMap?.addEventListener('click', () => newMap());
  elements.buildState?.addEventListener('click', () => startBuilder());
  if (!(custom && loadCustom(custom))) {
    load(seed ?? createSeed());
    if (custom) showEditMessage(INVALID_LINK_MESSAGE);
  }

  // The summary blocks move up beside the map when there is room (feature 012); pages without the full layout skip it.
  const dockLayout = root.querySelector('[data-role="layout"]');
  const dockBlocks = [elements.stateTotals, elements.control, elements.legend];
  const dockHint = dockLayout?.querySelector(':scope > .hint');
  const dockMap = root.querySelector('.map-cell');
  const dockColumn = $('panels');
  const dock = dockLayout && dockHint && dockMap && dockColumn && elements.brushTool && dockBlocks.every(Boolean)
    ? createSummaryDock({ layout: dockLayout, column: dockColumn, map: dockMap, brush: elements.brushTool, blocks: dockBlocks, hint: dockHint, app: root })
    : null;

  return {
    get state() {
      return app.state;
    },
    get dock() {
      return dock;
    },
    get matchup() {
      return app.matchup;
    },
    get editingDistrict() {
      return app.editingDistrict;
    },
    get mode() {
      return app.mode;
    },
    get builder() {
      return app.draft ? { plan: app.draft.plan, result: app.draft.result, selected: app.draft.selected } : null;
    },
    mapView,
    districtList,
    tooltip,
    setEditing,
    setBrush(options = {}) {
      if (options.on !== undefined && !setBrushOn(options.on) && options.on) return false;
      setBrushOptions(options);
      return true;
    },
    get brush() {
      return { ...app.brush };
    },
    get lastStroke() {
      return app.lastStroke;
    },
    strokeAt: strokeAtPoint,
    dragBrush,
    flushStroke: applyQueued,
    assignPrecinct,
    editPrecinct,
    setAssignments,
    load,
    newMap,
    startBuilder,
    placeCity,
    selectCity,
    removeCity: removeCityAt,
    removeSelectedCity,
    setCityPopulation,
    setBuilderSettings,
    useBuiltState,
    cancelBuilder,
    clearCities,
    newOutline,
    destroy() {
      dock?.destroy();
      document.removeEventListener('keydown', onKeyDown);
      if (app.stroke?.frame) cancelAnimationFrame(app.stroke.frame);
      clearPopulationTimer();
      tooltip.hide();
    },
  };
}

if (document.body?.dataset.autostart === 'true') {
  const t0 = performance.now();
  const instance = createApp(document.querySelector('[data-role="app"]'), { seed: getSeedFromUrl(), custom: getCustomCodeFromUrl() });
  window.gerryApp = instance;
  window.gerryLoadMs = performance.now() - t0;
}

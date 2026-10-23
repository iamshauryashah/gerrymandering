const MARGIN = 8;
const OFFSET = 14;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderSection(details) {
  const section = el('div', 'tt-section');
  section.append(el('div', 'tt-title', details.title));
  if (details.subtitle) section.append(el('div', 'tt-subtitle', details.subtitle));
  if (details.precinctList !== undefined) section.append(el('div', 'tt-subtitle tt-precincts', details.precinctList));
  const rows = el('dl', 'tt-rows');
  const add = (label, value, color) => {
    const dt = el('dt');
    if (color) {
      const swatch = el('span', 'swatch');
      swatch.style.background = color;
      dt.append(swatch);
    }
    dt.append(document.createTextNode(label));
    rows.append(dt, el('dd', '', value));
  };
  for (const row of details.info ?? []) add(row.label, row.value);
  if (details.sides) {
    add('Total voters', details.totalVoters);
    for (const side of details.sides) add(side.name, `${side.voters} (${side.percent})`, side.color);
    add('Result', details.statusText);
    add('Margin', details.margin);
  }
  if (rows.childElementCount) section.append(rows);
  return section;
}

export function createTooltip(element) {
  let anchor = null;

  function position() {
    if (!anchor || element.hidden) return;
    const box = element.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    let left;
    let top;
    if (anchor.rect) {
      const r = anchor.rect;
      left = r.left + r.width / 2 - box.width / 2;
      top = r.bottom + 6;
      if (top + box.height > vh - MARGIN) top = r.top - box.height - 6;
    } else {
      left = anchor.x + OFFSET;
      top = anchor.y + OFFSET;
      if (left + box.width > vw - MARGIN) left = anchor.x - box.width - OFFSET;
      if (top + box.height > vh - MARGIN) top = anchor.y - box.height - OFFSET;
    }
    left = Math.max(MARGIN, Math.min(left, vw - box.width - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - box.height - MARGIN));
    element.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  return {
    element,
    // `at` is either {x, y} client coordinates or an Element whose box anchors the tooltip.
    show(sections, at) {
      element.replaceChildren(...sections.map(renderSection));
      anchor = at instanceof Element ? { rect: at.getBoundingClientRect() } : at;
      element.hidden = false;
      position();
    },
    update(sections) {
      if (element.hidden) return;
      element.replaceChildren(...sections.map(renderSection));
      position();
    },
    move(at) {
      anchor = at instanceof Element ? { rect: at.getBoundingClientRect() } : at;
      position();
    },
    hide() {
      element.hidden = true;
      anchor = null;
    },
    get visible() {
      return !element.hidden;
    },
  };
}

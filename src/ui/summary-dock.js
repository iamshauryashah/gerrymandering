// Places the three summary blocks (Statewide Voters, District Control, Legend) in the open room under the plan check when
// there is room, and leaves the rest where they are below the map. The browser's own layout decides what fits: all blocks
// are tried in the column, then taken out from the last one until the column no longer overflows.

// The largest count from `total` down to 1 for which fits(count) is true, or 0 when none fits.
export function chooseDockCount(total, fits) {
  for (let count = total; count > 0; count -= 1) if (fits(count)) return count;
  return 0;
}

export function createSummaryDock({ layout, column, map, brush, blocks, hint, app }) {
  let docked = 0;
  let busy = false;
  let frame = null;
  const view = layout.ownerDocument.defaultView;

  const mode = () => view.getComputedStyle(layout).getPropertyValue('--dock').trim();
  const holdsFocus = (block) => block.contains(layout.ownerDocument.activeElement);

  // Docked blocks are the last children of the column in order; the others sit in the layout just before the help text.
  // Moving goes from the last block to the first so each block is inserted before a neighbor that is already in place.
  function place(count) {
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      const block = blocks[i];
      const isDocked = i < count;
      const parent = isDocked ? column : layout;
      const next = i + 1 < blocks.length && (i + 1 < count) === isDocked ? blocks[i + 1] : isDocked ? null : hint;
      block.classList.toggle('is-docked', isDocked);
      if (block.parentNode === parent && block.nextSibling === next) continue;
      if (holdsFocus(block)) continue;
      parent.insertBefore(block, next);
    }
  }

  function fits(kind) {
    if (kind === 'column') return column.scrollHeight <= column.clientHeight + 1;
    const gap = Number.parseFloat(view.getComputedStyle(layout).rowGap) || 0;
    return column.offsetHeight <= map.offsetHeight + gap + brush.offsetHeight + 0.5;
  }

  function update() {
    if (busy) return docked;
    busy = true;
    try {
      const kind = mode();
      let target = 0;
      if ((kind === 'column' || kind === 'beside') && !app.classList.contains('is-building') && column.offsetHeight > 0) {
        target = chooseDockCount(blocks.length, (count) => {
          place(count);
          return fits(kind);
        });
      }
      place(target);
      docked = target;
      layout.dataset.docked = String(target);
      return target;
    } finally {
      busy = false;
    }
  }

  // Resize notifications are handled on the next frame (answering inside one can loop); content changes are handled at once.
  const later = () => {
    if (frame !== null) return;
    frame = view.requestAnimationFrame(() => {
      frame = null;
      update();
    });
  };
  const resizes = new view.ResizeObserver(later);
  const changes = new view.MutationObserver(() => update());
  const parts = ['district-list', 'district-detail', 'plan-status'].map((role) => column.querySelector(`[data-role="${role}"]`));
  const slot = column.querySelector('.message-slot');
  for (const node of [layout, column, ...blocks, ...parts, slot]) if (node) resizes.observe(node);
  for (const node of [...blocks, ...parts, slot]) if (node) changes.observe(node, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  changes.observe(app, { attributes: true, attributeFilter: ['class'] });

  update();

  return {
    update,
    get docked() {
      return docked;
    },
    destroy() {
      resizes.disconnect();
      changes.disconnect();
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      place(0);
      docked = 0;
      delete layout.dataset.docked;
    },
  };
}

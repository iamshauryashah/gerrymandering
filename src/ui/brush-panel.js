import { BRUSH_SIZE } from '../brush.js';

// The brush section: an on/off button, Add or Erase, an "only unclaimed precincts" box, a size slider, and one cell that shows
// what the last stroke did, or else a hint.
export function createBrushPanel(root, { onToggle, onMode, onSize, onUnclaimedOnly } = {}) {
  const $ = (role) => root.querySelector(`[data-role="${role}"]`);
  const toggle = $('brush-toggle');
  const modeGroup = $('brush-mode');
  const radios = [...root.querySelectorAll('input[name="brush-mode"]')];
  const unclaimed = $('brush-unclaimed');
  const size = $('brush-size');
  const output = $('brush-size-output');
  const hint = $('brush-hint');
  const message = $('brush-message');

  size.min = String(BRUSH_SIZE.min);
  size.max = String(BRUSH_SIZE.max);
  size.step = String(BRUSH_SIZE.step);

  toggle.addEventListener('click', () => onToggle?.());
  for (const radio of radios) radio.addEventListener('change', () => radio.checked && onMode?.(radio.value));
  unclaimed.addEventListener('change', () => onUnclaimedOnly?.(unclaimed.checked));
  size.addEventListener('input', () => onSize?.(Number(size.value)));
  size.addEventListener('change', () => onSize?.(Number(size.value)));

  // The notes cell has room for one thing: the stroke message while there is one, otherwise the hint.
  const showNotes = () => {
    hint.hidden = message.textContent !== '';
  };

  return {
    // `available` is true only while a district is selected for editing.
    render({ available, on, mode, size: radius, unclaimedOnly }) {
      toggle.disabled = !available;
      toggle.setAttribute('aria-pressed', String(Boolean(on)));
      toggle.textContent = on ? 'Brush: on' : 'Brush: off';
      for (const radio of radios) {
        radio.disabled = !available;
        radio.checked = radio.value === mode;
      }
      unclaimed.checked = Boolean(unclaimedOnly);
      unclaimed.disabled = !available || mode === 'erase';
      if (available && mode === 'erase') {
        unclaimed.title = 'Applies when adding';
        unclaimed.setAttribute('aria-describedby', 'brush-unclaimed-note');
      } else {
        unclaimed.removeAttribute('title');
        unclaimed.removeAttribute('aria-describedby');
      }
      size.disabled = !available;
      size.value = String(radius);
      output.textContent = String(radius);
      modeGroup.dataset.mode = mode;
      if (!available) hint.textContent = "Pick a district's pen to use the brush.";
      else if (on) hint.textContent = 'Click or drag on the map. Hold Shift to swap Add and Erase.';
      else hint.textContent = 'Turn the brush on to add or erase many precincts at once.';
      showNotes();
    },
    say(text) {
      message.textContent = text ?? '';
      message.title = text ?? '';
      showNotes();
    },
    setHidden(hidden) {
      root.hidden = hidden;
    },
  };
}

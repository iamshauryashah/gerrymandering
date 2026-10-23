import { MATCHUPS, getMatchup, getNextMatchup } from '../matchups.js';

export function createMatchupToggle(button, { initialId = MATCHUPS[0].id, onChange } = {}) {
  let current = getMatchup(initialId);

  function render() {
    button.textContent = current.label;
    button.setAttribute('aria-label', `Matchup: ${current.label}. Activate to switch to ${getNextMatchup(current.id).label}`);
    button.dataset.matchup = current.id;
  }

  button.addEventListener('click', () => {
    current = getNextMatchup(current.id);
    render();
    onChange?.(current);
  });

  render();
  return {
    get matchup() {
      return current;
    },
  };
}

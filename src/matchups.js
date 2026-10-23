export const TIE_COLOR = '#9ca3af';
export const EMPTY_STYLE = 'empty';

export const MATCHUPS = Object.freeze([
  Object.freeze({
    id: 'dem-rep',
    label: 'Democrats vs Republicans',
    sideA: Object.freeze({ name: 'Democrats', shortName: 'Dem', singular: 'Democratic', shades: ['#c6dbf7', '#8db8ec', '#4a86d6', '#1f5fb4', '#0d3a7a'] }),
    sideB: Object.freeze({ name: 'Republicans', shortName: 'Rep', singular: 'Republican', shades: ['#f8c9c4', '#f0948b', '#de5a4e', '#b8302a', '#7d1714'] }),
  }),
  Object.freeze({
    id: 'soc-lib',
    label: 'Socialists vs Libertarians',
    sideA: Object.freeze({ name: 'Socialists', shortName: 'Soc', singular: 'Socialist', shades: ['#f9cfdc', '#f19bb6', '#e0628c', '#be3768', '#861b45'] }),
    sideB: Object.freeze({ name: 'Libertarians', shortName: 'Lib', singular: 'Libertarian', shades: ['#fbe7a8', '#f6d063', '#e3b11f', '#b88a0d', '#7d5d05'] }),
  }),
  Object.freeze({
    id: 'purple-orange',
    label: 'Purple vs Orange',
    sideA: Object.freeze({ name: 'Purple', shortName: 'Pur', singular: 'Purple', shades: ['#e0d2f3', '#c0a2e6', '#9567d1', '#6d3fb0', '#47217a'] }),
    sideB: Object.freeze({ name: 'Orange', shortName: 'Org', singular: 'Orange', shades: ['#fdd9b8', '#fbb478', '#f58a35', '#d4650f', '#93430a'] }),
  }),
]);

export const MARGIN_STEPS = Object.freeze([5, 10, 20, 35]);

export function getMatchup(id) {
  const matchup = MATCHUPS.find((m) => m.id === id);
  if (!matchup) throw new Error(`Unknown matchup ID: ${id}`);
  return matchup;
}

export function getNextMatchup(currentId) {
  const index = MATCHUPS.findIndex((m) => m.id === currentId);
  if (index === -1) throw new Error(`Unknown matchup ID: ${currentId}`);
  return MATCHUPS[(index + 1) % MATCHUPS.length];
}

export function getSide(matchup, status) {
  if (status === 'sideA') return matchup.sideA;
  if (status === 'sideB') return matchup.sideB;
  return null;
}

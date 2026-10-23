// Measures how precinct size follows voter density, shared by the random-state and custom-state tests.

const ranks = (values) => {
  const order = values.map((value, i) => [value, i]).sort((a, b) => a[0] - b[0]);
  const result = new Array(values.length);
  order.forEach(([, i], rank) => {
    result[i] = rank;
  });
  return result;
};

// Spearman rank correlation of precinct density against precinct area: negative when dense precincts are small.
export function densityAreaCorrelation(state) {
  const a = ranks(state.precincts.map((c) => c.density));
  const b = ranks(state.precincts.map((c) => c.area));
  const mid = (a.length - 1) / 2;
  let both = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    both += (a[i] - mid) * (b[i] - mid);
    aa += (a[i] - mid) ** 2;
    bb += (b[i] - mid) ** 2;
  }
  return both / Math.sqrt(aa * bb);
}

const averageArea = (precincts) => precincts.reduce((sum, c) => sum + c.area, 0) / precincts.length;

// Average area of the densest tenth of precincts divided by that of the sparsest tenth.
export function decileAreaRatio(state) {
  const sorted = [...state.precincts].sort((x, y) => y.density - x.density);
  const tenth = Math.max(1, Math.round(sorted.length / 10));
  return averageArea(sorted.slice(0, tenth)) / averageArea(sorted.slice(-tenth));
}

// Average precinct area for a type ('urban', 'suburban', 'rural'), or null when no precinct has it.
export function typeAverageArea(state, type) {
  const precincts = state.precincts.filter((c) => c.type === type);
  return precincts.length ? averageArea(precincts) : null;
}

// True when the types that exist are ordered urban < suburban < rural by average area.
export function typesAreOrdered(state) {
  const averages = ['urban', 'suburban', 'rural'].map((type) => typeAverageArea(state, type)).filter((value) => value !== null);
  return averages.every((value, i) => i === 0 || averages[i - 1] < value);
}

// Precincts within `reach` px of a point, by seed distance.
export const precinctsNear = (state, point, reach) => state.precincts.filter((c) => Math.hypot(c.seedPoint[0] - point.x, c.seedPoint[1] - point.y) <= reach);

export const meanArea = averageArea;

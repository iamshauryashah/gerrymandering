import { EMPTY_STYLE, MARGIN_STEPS, TIE_COLOR, getSide } from './matchups.js';

const VALID_STATUSES = new Set(['sideA', 'sideB', 'tie', 'empty']);

export function getShadeIndex(marginPercent) {
  let index = 0;
  for (const step of MARGIN_STEPS) {
    if (marginPercent >= step) index += 1;
  }
  return index;
}

export function getResultColor(status, marginPercent, matchup) {
  if (!VALID_STATUSES.has(status)) throw new Error(`Unknown result status: ${status}`);
  if (status === 'tie') return TIE_COLOR;
  if (status === 'empty') return EMPTY_STYLE;
  return getSide(matchup, status).shades[getShadeIndex(marginPercent)];
}

export function getResult(sideAVoters, sideBVoters) {
  const totalVoters = sideAVoters + sideBVoters;
  if (totalVoters === 0) return { sideAVoters, sideBVoters, totalVoters, status: 'empty', marginPercent: 0 };
  if (sideAVoters === sideBVoters) return { sideAVoters, sideBVoters, totalVoters, status: 'tie', marginPercent: 0 };
  return {
    sideAVoters,
    sideBVoters,
    totalVoters,
    status: sideAVoters > sideBVoters ? 'sideA' : 'sideB',
    marginPercent: (Math.abs(sideAVoters - sideBVoters) / totalVoters) * 100,
  };
}

const numberFormat = new Intl.NumberFormat('en-US');

export function formatCount(value) {
  return numberFormat.format(Math.round(value));
}

export function formatPercent(value) {
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
}

function percentOf(part, total) {
  return total > 0 ? (part / total) * 100 : 0;
}

export function formatVoterDetails(result, matchup) {
  const { sideAVoters = 0, sideBVoters = 0 } = result;
  const totalVoters = result.totalVoters ?? sideAVoters + sideBVoters;
  const status = result.status ?? getResult(sideAVoters, sideBVoters).status;
  const marginPercent = result.marginPercent ?? getResult(sideAVoters, sideBVoters).marginPercent;
  const leader = getSide(matchup, status);
  let statusText = 'Tied';
  if (status === 'empty') statusText = 'Empty (no precincts)';
  else if (leader) statusText = `${leader.name} lead`;
  return {
    totalVoters: formatCount(totalVoters),
    sides: [
      { key: 'sideA', name: matchup.sideA.name, color: matchup.sideA.shades[2], voters: formatCount(sideAVoters), percent: formatPercent(percentOf(sideAVoters, totalVoters)) },
      { key: 'sideB', name: matchup.sideB.name, color: matchup.sideB.shades[2], voters: formatCount(sideBVoters), percent: formatPercent(percentOf(sideBVoters, totalVoters)) },
    ],
    status,
    leader: leader ? leader.name : null,
    statusText,
    margin: leader ? `${leader.name} +${(Math.round(marginPercent * 10) / 10).toFixed(1)} pts` : 'None',
  };
}

const TYPE_LABELS = { urban: 'Urban', suburban: 'Suburban', rural: 'Rural' };

export function formatPrecinctDetails(precinct, matchup) {
  const info = [];
  if (precinct.type) info.push({ label: 'Type', value: TYPE_LABELS[precinct.type] });
  if (precinct.density !== undefined) info.push({ label: 'Density', value: `${formatCount(precinct.density)} voters/sq mi` });
  return {
    title: precinct.name,
    subtitle: 'Precinct voters',
    info,
    ...formatVoterDetails(getResult(precinct.sideAVoters, precinct.sideBVoters), matchup),
  };
}

// The whole state's result: every precinct counts, whether or not it is in a district.
export function getStatewideResult(precincts) {
  let sideA = 0;
  let sideB = 0;
  for (const precinct of precincts) {
    sideA += precinct.sideAVoters;
    sideB += precinct.sideBVoters;
  }
  return getResult(sideA, sideB);
}

export function formatStatewideMakeup(precincts, matchup) {
  const result = getStatewideResult(precincts);
  const details = formatVoterDetails(result, matchup);
  const total = result.totalVoters;
  // Whole tenths of a percent, with side B as the remainder, so the pair always adds up to exactly 100.0%.
  const tenthsA = total > 0 ? Math.round((result.sideAVoters / total) * 1000) : 0;
  const tenthsB = total > 0 ? 1000 - tenthsA : 0;
  const percent = (tenths) => `${(tenths / 10).toFixed(1)}%`;
  const share = (voters) => (total > 0 ? (voters / total) * 100 : 0);
  const sides = [
    { key: 'sideA', name: matchup.sideA.name, color: matchup.sideA.shades[3], voters: formatCount(result.sideAVoters), share: share(result.sideAVoters), percent: percent(tenthsA) },
    { key: 'sideB', name: matchup.sideB.name, color: matchup.sideB.shades[3], voters: formatCount(result.sideBVoters), share: share(result.sideBVoters), percent: percent(tenthsB) },
  ];
  let summary = `${details.statusText} statewide · ${details.margin}`;
  if (result.status === 'tie') summary = 'Tied statewide';
  else if (result.status === 'empty') summary = 'No voters';
  return {
    totalVoters: details.totalVoters,
    sides,
    status: result.status,
    statusText: details.statusText,
    margin: details.margin,
    summary,
    ariaLabel: `${sides[0].name} ${sides[0].percent}, ${sides[1].name} ${sides[1].percent}`,
  };
}

export function formatNoDistrictDetails() {
  return { title: 'No district', subtitle: 'This precinct is not in any district yet.' };
}

// A district can hold a hundred precincts, so the pop-up lists only the first few names and counts the rest.
export const MAX_LISTED_PRECINCTS = 8;

export function formatDistrictDetails(district, precinctsById, matchup) {
  const names = district.precinctIds.map((id) => precinctsById.get(id).name).sort((a, b) => a.localeCompare(b));
  const precinctCount = names.length;
  const more = precinctCount - MAX_LISTED_PRECINCTS;
  const listed = more > 0 ? `${names.slice(0, MAX_LISTED_PRECINCTS).join(', ')}, and ${more.toLocaleString('en-US')} more` : names.join(', ');
  return {
    title: `District ${district.number}`,
    subtitle: `${precinctCount} ${precinctCount === 1 ? 'precinct' : 'precincts'}`,
    precinctCount,
    precinctNames: names,
    precinctList: precinctCount ? listed : 'No precincts assigned',
    ...formatVoterDetails(district, matchup),
  };
}

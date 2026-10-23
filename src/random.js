function hashSeed(seed) {
  const text = String(seed);
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function createRandom(seed) {
  let a = hashSeed(seed);
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

export function randomBetween(random, min, max) {
  return min + random() * (max - min);
}

export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

export function shuffle(random, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createSeed() {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    values[0] = Math.floor(Math.random() * 4294967296);
  }
  return values[0].toString(36);
}

export function getSeedFromUrl(search = globalThis.location?.search ?? '') {
  const value = new URLSearchParams(search).get('seed');
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 64) : null;
}

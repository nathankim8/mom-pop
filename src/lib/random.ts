/** Small, dependency-free seeded random helpers so simulated data is identical on every load. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Deterministic hash of two integers to [0, 1). */
export function hash2(x: number, y: number, seed = 1337): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 2D value noise in [0, 1]; `scale` is the lattice spacing in input units. */
export function valueNoise(x: number, y: number, scale: number, seed = 1337): number {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const sx = smooth(gx - x0);
  const sy = smooth(gy - y0);
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function pickWeighted<T extends string>(weights: Record<T, number>, rand: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

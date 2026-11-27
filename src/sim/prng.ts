import type { RngState } from './types';

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

export function createRngState(seed: number): RngState {
  let z = (seed >>> 0) || 0x9e3779b9;
  const splitMix = (): number => {
    z = (z + 0x9e3779b9) >>> 0;
    let t = z;
    t = Math.imul(t ^ (t >>> 15), 0x85ebca6b) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
    return (t ^ (t >>> 16)) >>> 0;
  };
  return {
    s0: splitMix(),
    s1: splitMix(),
    s2: splitMix(),
    s3: splitMix(),
  };
}

export function nextUint32(rng: RngState): number {
  const result = Math.imul(rotl(Math.imul(rng.s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (rng.s1 << 9) >>> 0;

  rng.s2 = (rng.s2 ^ rng.s0) >>> 0;
  rng.s3 = (rng.s3 ^ rng.s1) >>> 0;
  rng.s1 = (rng.s1 ^ rng.s2) >>> 0;
  rng.s0 = (rng.s0 ^ rng.s3) >>> 0;

  rng.s2 = (rng.s2 ^ t) >>> 0;
  rng.s3 = rotl(rng.s3, 11);

  return result;
}

export function nextFloat(rng: RngState): number {
  return nextUint32(rng) / 4294967296;
}

export function nextInt(rng: RngState, min: number, maxInclusive: number): number {
  return min + Math.floor(nextFloat(rng) * (maxInclusive - min + 1));
}

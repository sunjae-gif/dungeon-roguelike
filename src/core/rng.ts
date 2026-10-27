// 시드 기반 난수. 30-systems/rng.md
// 규칙 코드의 모든 난수는 이 파일을 거친다.

// 난수 흐름 이름과 범위 (rng.md "난수 흐름" 표)
export const FLOOR_STREAMS = ['map', 'rooms', 'objects', 'spawn', 'loot'] as const;
export const RUN_STREAMS = ['combat', 'ai'] as const;

export type FloorStream = (typeof FLOOR_STREAMS)[number];
export type RunStream = (typeof RUN_STREAMS)[number];

const UINT32_RANGE = 0x100000000;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

// 생성기 하나. 상태는 32비트 정수 하나뿐이라 RunState.rng에 그대로 저장된다.
export interface Rng {
  state: number;
}

// FNV-1a. 판 시드, 층 번호, 흐름 이름을 섞어 흐름의 시작값을 만든다.
export function hashSeed(runSeed: number, floorNumber: number, streamName: string): number {
  let h = FNV_OFFSET;
  const mix = (byte: number) => {
    h ^= byte & 0xff;
    h = Math.imul(h, FNV_PRIME) >>> 0;
  };
  const mixU32 = (n: number) => {
    for (let shift = 0; shift < 32; shift += 8) mix(n >>> shift);
  };
  mixU32(runSeed >>> 0);
  mixU32(floorNumber >>> 0);
  for (let i = 0; i < streamName.length; i++) mixU32(streamName.charCodeAt(i));
  return h >>> 0;
}

export function createRng(state: number): Rng {
  return { state: state >>> 0 };
}

// mulberry32: 다음 32비트 부호 없는 정수
export function nextU32(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

// [0, 1)
export function nextFloat(rng: Rng): number {
  return nextU32(rng) / UINT32_RANGE;
}

// [min, max] 정수
export function nextInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

export function chance(rng: Rng, probability: number): boolean {
  return nextFloat(rng) < probability;
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[nextInt(rng, 0, list.length - 1)];
}

// 가중치 비율로 하나 고른다. entries 순서가 같으면 결과도 같다
export function pickWeighted<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = nextFloat(rng) * total;
  for (const [value, weight] of entries) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}

// "층마다 새로" 흐름: 층을 만들 때마다 시작값에서 다시 출발한다.
export function floorRng(runSeed: number, floorNumber: number, stream: FloorStream): Rng {
  return createRng(hashSeed(runSeed, floorNumber, stream));
}

// "판 전체" 흐름의 시작값들. 층 번호 자리에 0을 넣는다.
export function initRunRng(runSeed: number): Record<string, number> {
  const rng: Record<string, number> = {};
  for (const stream of RUN_STREAMS) rng[stream] = hashSeed(runSeed, 0, stream);
  return rng;
}

// RunState.rng에 저장된 흐름을 꺼내 쓰고, 바뀐 내부값을 새 객체로 돌려준다.
// "판 전체" 흐름과, 층 안에서 이어 쓰는 loot 흐름(rng.md)이 쓴다.
export function useStoredRng<T>(
  rngState: Record<string, number>,
  stream: RunStream | 'loot',
  fn: (rng: Rng) => T,
): { value: T; rng: Record<string, number> } {
  const rng = createRng(rngState[stream]);
  const value = fn(rng);
  return { value, rng: { ...rngState, [stream]: rng.state } };
}


// 시드는 8자리 16진수 대문자로 보여준다. 예: 3FA2C910
export function formatSeed(seed: number): string {
  return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

// 8자리 이하 16진수 문자열을 시드로. 형식이 틀리면 null.
export function parseSeed(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[0-9a-fA-F]{1,8}$/.test(trimmed)) return null;
  return parseInt(trimmed, 16) >>> 0;
}

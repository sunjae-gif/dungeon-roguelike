// F009 방 종류 정하기 (rooms 흐름)
import type { GameData, RoomTypeDef, ThemeDef } from '../data/types';
import { nextInt, pickWeighted, type Rng } from './rng';

// 구조용 방 (F009 규칙 1). 다른 종류를 겸하지 않는다
export const STRUCTURAL_ROOM_TYPES = ['start', 'stairs', 'boss'];
// 다른 종류가 될 수 없을 때의 기본값 (rooms.json id)
export const NORMAL_ROOM_TYPE = 'normal';
export const SECRET_ROOM_TYPE = 'secret';
export const TREASURE_ROOM_TYPE = 'treasure';
export const PUZZLE_ROOM_TYPE = 'puzzle';
export const SPRING_ROOM_TYPE = 'spring';

// 규칙 2~5: fixed(구조용 방)를 뺀 방들의 종류를 정한다
export function assignRoomTypes(
  sizes: { w: number; h: number }[],
  fixed: Map<number, string>,
  data: GameData,
  theme: ThemeDef,
  rng: Rng,
): string[] {
  const types = sizes.map((_, i) => fixed.get(i) ?? '');
  const weightOf = (def: RoomTypeDef) => theme.roomWeights[def.id] ?? def.weight;
  // 규칙 4: 방의 짧은 변이 그 종류의 최소 크기 이상
  const fits = (i: number, def: RoomTypeDef) => Math.min(sizes[i].w, sizes[i].h) >= def.minRoomSize;
  const count = (id: string) => types.filter((t) => t === id).length;
  const free = () => types.map((t, i) => (t === '' ? i : -1)).filter((i) => i >= 0);

  // 규칙 3, 5: 최소 개수부터 채운다 (가중치 0인 종류는 최소 개수를 무시)
  for (const def of data.roomTypes) {
    if (weightOf(def) <= 0) continue;
    while (count(def.id) < def.minPerFloor) {
      const candidates = free().filter((i) => fits(i, def));
      if (candidates.length === 0) {
        console.warn(`방 종류 ${def.id}의 최소 개수 ${def.minPerFloor}를 채울 수 없다.`);
        break;
      }
      types[candidates[nextInt(rng, 0, candidates.length - 1)]] = def.id;
    }
  }
  // 규칙 2: 나머지는 가중치로 (최대 개수, 최소 크기 안에서)
  for (const i of free()) {
    const options = data.roomTypes
      .filter((def) => weightOf(def) > 0 && count(def.id) < def.maxPerFloor && fits(i, def))
      .map((def) => [def.id, weightOf(def)] as const);
    types[i] = options.length > 0 ? pickWeighted(rng, options) : NORMAL_ROOM_TYPE;
  }
  return types;
}

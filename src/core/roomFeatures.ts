// F009 방 종류별 물체: 보물상자방·비밀방의 상자, 샘방의 샘, 숨은 벽 찾기
import type { GameData } from '../data/types';
import { HIDDEN_WALL_OBJECT_TYPE } from './dungeon';
import { getStat } from './effects';

import { CHEST_OBJECT_TYPE } from './items';
import { addMessage, MESSAGES } from './messages';
import { SECRET_ROOM_TYPE, SPRING_ROOM_TYPE, TREASURE_ROOM_TYPE } from './roomTypes';
import { centerSpot } from './rooms';
import type { FloorState, ItemChoice, MapObject, RunState } from './state';

export const SPRING_OBJECT_TYPE = 'spring';

// 보물상자방(F005 규칙 10, F009 규칙 6)과 비밀방(F009 규칙 14)의 가운데에 상자, 샘방(규칙 30)의 가운데에 샘
export function placeRoomFeatures(floor: FloorState, firstId: number): { floor: FloorState; nextId: number } {
  let next = floor;
  let nextId = firstId;
  const put = (object: Omit<MapObject, 'id' | 'x' | 'y'>, room: FloorState['rooms'][number]) => {
    const spot = centerSpot(next, room);
    if (!spot) return;
    next = { ...next, objects: [...next.objects, { id: nextId++, ...spot, ...object }] };
  };
  for (const room of floor.rooms) {
    if (room.type === TREASURE_ROOM_TYPE || room.type === SECRET_ROOM_TYPE) {
      const source: ItemChoice['source'] = room.type === SECRET_ROOM_TYPE ? 'secret' : 'chest';
      put({ type: CHEST_OBJECT_TYPE, blocksMove: true, blocksSight: false, state: { opened: false, source } }, room);
    }
    if (room.type === SPRING_ROOM_TYPE) put({ type: SPRING_OBJECT_TYPE, blocksMove: true, blocksSight: false, state: { used: false } }, room);
  }
  return { floor: next, nextId };
}

// 규칙 31~33: 샘 마시기. 쓸 수 없으면 안내 메시지만 (턴 안 씀)
export function springNotice(state: RunState, data: GameData, spring: MapObject): string | null {
  if (spring.state.used) return MESSAGES.springDry();
  if (state.player.hp >= getStat(state.player, 'maxHp', data)) return MESSAGES.springNotThirsty();
  return null;
}

export function drinkSpring(state: RunState, data: GameData, springId: number): RunState {
  const maxHp = getStat(state.player, 'maxHp', data);
  const hp = Math.min(maxHp, state.player.hp + Math.floor(maxHp * data.loot.springHealRatio));
  const healed = hp - state.player.hp;
  const objects = state.floor.objects.map((o) => (o.id === springId ? { ...o, state: { ...o.state, used: true } } : o));
  const next = { ...state, player: { ...state.player, hp }, floor: { ...state.floor, objects } };
  return addMessage(next, MESSAGES.springDrank(healed), data);
}

// 규칙 12: 숨은 벽과 상하좌우로 맞닿은 칸에서 쉬면 발견. 확률 없음
export function discoverHiddenWalls(state: RunState, data: GameData): RunState {
  const { x, y } = state.player;
  const near = (o: MapObject) => Math.abs(o.x - x) + Math.abs(o.y - y) === 1;
  const found = state.floor.objects.filter((o) => o.type === HIDDEN_WALL_OBJECT_TYPE && !o.state.discovered && near(o));
  if (found.length === 0) return state;
  const ids = new Set(found.map((o) => o.id));
  const objects = state.floor.objects.map((o) =>
    ids.has(o.id) ? { ...o, blocksMove: false, blocksSight: false, state: { ...o.state, discovered: true } } : o,
  );
  return addMessage({ ...state, floor: { ...state.floor, objects } }, MESSAGES.hiddenWallFound(), data);
}

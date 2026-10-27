// F010 문: 배치, 열기
import { monsterName, themeForFloor } from '../data/query';
import type { GameData } from '../data/types';
import { findActor } from './actors';
import { addMessage, josa, MESSAGES } from './messages';
import { objectAt } from './movement';
import { chance, type Rng } from './rng';
import { inRoom, outsideEntrances, pointKey } from './rooms';
import { type FloorState, type MapObject, type RunState, tileIndex } from './state';

export const DOOR_OBJECT_TYPE = 'door';
// 규칙 1: 보스방(봉인이 대신함), 비밀방(숨은 벽이 대신함) 입구에는 문을 두지 않는다
const NO_DOOR_ROOMS = ['boss', 'secret'];

export const isClosedDoor = (o: MapObject | undefined) => o?.type === DOOR_OBJECT_TYPE && !o.state.open;

// 규칙 1: 방과 통로가 만나는 칸(방 바로 바깥의 통로 칸)에 테마 doorChance 확률로 (objects 흐름)
export function placeDoors(floor: FloorState, data: GameData, floorNumber: number, rng: Rng, firstId: number): { floor: FloorState; nextId: number } {
  const { doorChance } = themeForFloor(data, floorNumber);
  const excluded = floor.rooms.filter((r) => NO_DOOR_ROOMS.includes(r.type));
  const seen = new Set<string>();
  const objects = [...floor.objects];
  let nextId = firstId;
  for (const room of floor.rooms) {
    if (NO_DOOR_ROOMS.includes(room.type)) continue;
    for (const spot of outsideEntrances(floor, room)) {
      if (seen.has(pointKey(spot))) continue;
      seen.add(pointKey(spot));
      // 다른 방 안이거나, 문을 두지 않는 방의 입구와 맞닿은 칸이면 두지 않는다
      if (floor.rooms.some((r) => inRoom(r, spot))) continue;
      if (excluded.some((r) => outsideEntrances(floor, r).some((p) => p.x === spot.x && p.y === spot.y))) continue;
      if (objectAt(floor, spot.x, spot.y) || floor.tiles[tileIndex(floor, spot.x, spot.y)] !== 'floor') continue;
      if (!chance(rng, doorChance)) continue;
      objects.push({ id: nextId++, type: DOOR_OBJECT_TYPE, ...spot, blocksMove: true, blocksSight: true, state: { open: false } });
    }
  }
  return { floor: { ...floor, objects }, nextId };
}

// 규칙 2~5: 문을 연다. 연 개체는 제자리에 있다. 열린 문은 다시 닫히지 않는다
export function openDoor(state: RunState, data: GameData, actorId: number, doorId: number): RunState {
  const door = state.floor.objects.find((o) => o.id === doorId);
  if (!isClosedDoor(door)) return state;
  const opened = { ...door!, blocksMove: false, blocksSight: false, state: { ...door!.state, open: true } };
  const next = { ...state, floor: { ...state.floor, objects: state.floor.objects.map((o) => (o.id === doorId ? opened : o)) } };
  if (actorId === state.player.id) return addMessage(next, MESSAGES.doorOpened(), data);
  // 몬스터가 연 문은 플레이어 시야에 있을 때만 알린다
  if (!state.floor.visible[tileIndex(state.floor, door!.x, door!.y)]) return next;
  const monster = findActor(state, actorId);
  const name = monster ? monsterName(data, monster.defId) : '';
  return addMessage(next, MESSAGES.monsterOpenedDoor(josa(name, '이', '가')), data);
}

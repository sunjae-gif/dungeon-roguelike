// F010 함정: 배치, 발동
import { monsterName, themeForFloor, trapDef } from '../data/query';
import type { GameData } from '../data/types';
import type { Point } from './dungeon';
import { applyEffect, fireEvent, findActor } from './events';
import { addMessage, josa, MESSAGES } from './messages';
import { objectAt } from './movement';
import { nextInt, pick, type Rng } from './rng';
import { AROUND, inRoom, pointKey, roomEntrances, roomTiles } from './rooms';
import { tileIndex, type FloorState, type MapObject, type Room, type RunState } from './state';

export const TRAP_OBJECT_TYPE = 'trap';
// 규칙 8: 함정을 놓지 않는 방
const NO_TRAP_ROOMS = ['start', 'stairs', 'boss', 'secret', 'puzzle', 'spring'];

export function trapAt(floor: FloorState, x: number, y: number): MapObject | undefined {
  const o = objectAt(floor, x, y);
  return o?.type === TRAP_OBJECT_TYPE ? o : undefined;
}

// 규칙 10: 함정을 밟지 않고 방의 모든 입구끼리, 그리고 방 안의 막힌 물체(상자 등) 옆까지 갈 수 있는가
function roomStaysOpen(floor: FloorState, room: Room, traps: Set<string>): boolean {
  const entrances = roomEntrances(floor, room);
  if (entrances.length === 0) return true;
  const open = (p: Point) => inRoom(room, p) && !traps.has(pointKey(p)) && floor.tiles[tileIndex(floor, p.x, p.y)] === 'floor' && !objectAt(floor, p.x, p.y)?.blocksMove;
  const reached = new Set<string>();
  const queue = entrances.filter(open).slice(0, 1);
  for (const p of queue) reached.add(pointKey(p));
  for (let head = 0; head < queue.length; head++) {
    for (const n of AROUND(queue[head])) {
      if (reached.has(pointKey(n)) || !open(n)) continue;
      reached.add(pointKey(n));
      queue.push(n);
    }
  }
  if (!entrances.every((e) => reached.has(pointKey(e)))) return false;
  const blockers = floor.objects.filter((o) => o.blocksMove && inRoom(room, o));
  return blockers.every((o) => AROUND(o).some((n) => reached.has(pointKey(n))));
}

// 규칙 6~10: 방 안에만, 입구와 그 주변 제외, 테마 trapCount·trapTypes (objects 흐름)
export function placeTraps(floor: FloorState, data: GameData, floorNumber: number, rng: Rng, firstId: number): { floor: FloorState; nextId: number } {
  const theme = themeForFloor(data, floorNumber);
  const count = nextInt(rng, theme.trapCount[0], theme.trapCount[1]);
  if (count === 0 || theme.trapTypes.length === 0) return { floor, nextId: firstId };
  let candidates: { room: Room; p: Point }[] = [];
  for (const room of floor.rooms) {
    if (NO_TRAP_ROOMS.includes(room.type)) continue;
    const near = new Set(roomEntrances(floor, room).flatMap((e) => [e, ...AROUND(e)]).map(pointKey));
    for (const p of roomTiles(floor, room)) {
      if (!near.has(pointKey(p)) && !objectAt(floor, p.x, p.y)) candidates.push({ room, p });
    }
  }
  let next = floor;
  let nextId = firstId;
  const traps = new Set<string>();
  let placed = 0;
  while (placed < count && candidates.length > 0) {
    const pickIndex = nextInt(rng, 0, candidates.length - 1);
    const { room, p } = candidates[pickIndex];
    candidates = candidates.filter((_, i) => i !== pickIndex);
    traps.add(pointKey(p));
    if (!roomStaysOpen(next, room, traps)) {
      traps.delete(pointKey(p));
      continue;
    }
    const defId = pick(rng, theme.trapTypes);
    const trap: MapObject = { id: nextId++, type: TRAP_OBJECT_TYPE, defId, ...p, blocksMove: false, blocksSight: false, state: { spent: false } };
    next = { ...next, objects: [...next.objects, trap] };
    placed++;
  }
  return { floor: next, nextId };
}

// 규칙 11~14: 개체가 함정 칸에 들어가면 발동. self는 밟은 개체, 피해는 공격이 아닌 피해
export function triggerTrap(state: RunState, data: GameData, actorId: number): RunState {
  const actor = findActor(state, actorId);
  if (!actor) return state;
  const trap = trapAt(state.floor, actor.x, actor.y);
  const def = trapDef(data, trap?.defId);
  if (!trap || !def) return state;
  let next = state;
  // 규칙 14: 플레이어면 항상, 몬스터면 플레이어 시야 안일 때만
  const trapName = josa(def.name, '을', '를');
  if (actorId === state.player.id) next = addMessage(next, MESSAGES.steppedOnTrap(trapName), data);
  else if (state.floor.visible[tileIndex(state.floor, actor.x, actor.y)]) {
    const name = monsterName(data, actor.defId);
    next = addMessage(next, MESSAGES.monsterSteppedOnTrap(josa(name, '이', '가'), trapName), data);
  }
  // 규칙 12: once 함정은 사라진다
  if (def.once) next = { ...next, floor: { ...next.floor, objects: next.floor.objects.filter((o) => o.id !== trap.id) } };
  for (const effect of def.effects) {
    if (!findActor(next, actorId)) break;
    next = applyEffect(next, data, actorId, { cause: def.id }, effect, {}, 1).state;
  }
  return fireEvent(next, data, actorId, 'onTrapTriggered', { trapId: def.id }).state;
}

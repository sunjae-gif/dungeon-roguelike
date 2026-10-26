// F004·F014 몬스터: 배치, 차례, 발견 메시지, 도망친 몬스터 사라짐
import { themeForFloor } from '../data/query';
import type { GameData } from '../data/types';
import { actAmbush, actChase, actFlee, actRanged } from './ai';
import { actBoss } from './boss';
import type { Point } from './dungeon';
import { baseStat } from './effects';
import { findActor } from './events';
import { addMessage, MESSAGES } from './messages';
import { monsterAt, objectAt } from './movement';
import { floorRng, nextInt, pickWeighted } from './rng';
import { AROUND, inRoom, pointKey, roomEntrances } from './rooms';
import { tileIndex, type Actor, type FloorState, type MonsterAi, type Room, type RunState } from './state';

export { firstStep } from './ai';

// F004 규칙 3: 몬스터를 놓지 않는 방 (비밀방은 F009에서 생긴다)
const NO_MONSTER_ROOMS = ['start', 'stairs', 'boss', 'secret'];

// F014 배치 2: 방 입구 옆의 방 안 칸. 입구 칸 자체는 막지 않는다
function chokepointSpots(floor: FloorState, rooms: Room[]): Set<string> {
  const spots = new Set<string>();
  for (const room of rooms) {
    const entrances = roomEntrances(floor, room);
    const entranceKeys = new Set(entrances.map(pointKey));
    for (const e of entrances) {
      for (const n of AROUND(e)) if (inRoom(room, n) && !entranceKeys.has(pointKey(n))) spots.add(pointKey(n));
    }
  }
  return spots;
}

// F004 배치, F014 출현 가중치와 chokepoint. 같은 runSeed·층이면 같은 결과 (spawn 흐름)
export function spawnMonsters(
  floor: FloorState,
  data: GameData,
  runSeed: number,
  floorNumber: number,
  firstId: number,
): { floor: FloorState; nextId: number } {
  const theme = themeForFloor(data, floorNumber);
  const weights = Object.entries(theme.monsterTypes);
  const rng = floorRng(runSeed, floorNumber, 'spawn');
  const count = nextInt(rng, theme.monsterCount[0], theme.monsterCount[1]);

  // F004 규칙 2~4: 몬스터를 놓을 수 있는 방 안의 빈 바닥 칸
  const rooms = floor.rooms.filter((r) => !NO_MONSTER_ROOMS.includes(r.type));
  let free: Point[] = [];
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (floor.tiles[tileIndex(floor, x, y)] !== 'floor') continue;
        if (objectAt(floor, x, y) || monsterAt(floor, x, y)) continue;
        free.push({ x, y });
      }
    }
  }
  const chokepoints = chokepointSpots(floor, rooms);

  let nextId = firstId;
  const actors: Actor[] = [...floor.actors];
  // F004 규칙 6: 자리가 모자라면 놓을 수 있는 만큼만
  for (let i = 0; i < count && free.length > 0 && weights.length > 0; i++) {
    const defId = pickWeighted(rng, weights);
    const def = data.monsters.find((m) => m.id === defId);
    const preferred = def?.placement === 'chokepoint' ? free.filter((p) => chokepoints.has(pointKey(p))) : [];
    const pool = preferred.length > 0 ? preferred : free;
    const spot = pool[nextInt(rng, 0, pool.length - 1)];
    free = free.filter((p) => p !== spot);
    const monster: Actor = {
      id: nextId++,
      defId,
      ...spot,
      facing: 'down',
      hp: 0,
      buildItems: [],
      consumables: [],
      statuses: [],
      ai: {},
    };
    actors.push({ ...monster, hp: baseStat(monster, 'maxHp', data) });
  }
  return { floor: { ...floor, actors }, nextId };
}

// 몬스터 한 마리의 차례. behavior별로 (F004, F014, F008)
function actMonster(state: RunState, data: GameData, monster: Actor): RunState {
  const def = data.monsters.find((m) => m.id === monster.defId);
  if (!def) return state;
  const ai: MonsterAi = { ...monster.ai };
  switch (def.behavior) {
    case 'chase':
      return actChase(state, data, monster, ai);
    case 'ranged':
      return actRanged(state, data, monster, def, ai);
    case 'flee':
      return actFlee(state, data, monster, def, ai);
    case 'ambush':
      return actAmbush(state, data, monster, ai);
    case 'boss':
      return actBoss(state, data, monster, def, ai);
  }
}

// turn-order.md 5단계: 살아 있는 몬스터가 id 순서대로 한 번씩. 플레이어가 쓰러지면 남은 몬스터는 행동하지 않는다
export function actMonsters(state: RunState, data: GameData): RunState {
  const ids = state.floor.actors.map((a) => a.id).sort((a, b) => a - b);
  let next = state;
  for (const id of ids) {
    if (next.player.hp <= 0) break;
    const monster = findActor(next, id);
    if (!monster || monster.hp <= 0) continue; // 이번 턴에 쓰러졌다
    next = actMonster(next, data, monster);
  }
  return next;
}

const nameOf = (data: GameData, defId: string) => data.monsters.find((m) => m.id === defId)?.name ?? defId;
const isVisible = (floor: FloorState, a: Actor) => floor.visible[tileIndex(floor, a.x, a.y)];

// F014 공통 규칙 3: 플레이어 시야에 처음 들어온 몬스터마다 한 번 "{이름}이(가) 보인다."
export function noticeMonsters(state: RunState, data: GameData): RunState {
  let next = state;
  for (const m of [...state.floor.actors].sort((a, b) => a.id - b.id)) {
    if (m.ai?.noticed || !isVisible(state.floor, m)) continue;
    // F008: noticeMessage가 있으면 그것을 쓴다
    const custom = data.monsters.find((d) => d.id === m.defId)?.noticeMessage;
    next = addMessage(next, custom ?? MESSAGES.noticed(nameOf(data, m.defId)), data);
    const actors = next.floor.actors.map((a) => (a.id === m.id ? { ...a, ai: { ...a.ai, noticed: true } } : a));
    next = { ...next, floor: { ...next.floor, actors } };
  }
  return next;
}

// turn-order.md 6-5, F014 flee 규칙 4: 도망 중 연속으로 시야 밖에 vanishWhenUnseen턴 있으면 사라진다
export function vanishFleeing(state: RunState, data: GameData): RunState {
  let next = state;
  for (const m of state.floor.actors) {
    const limit = data.monsters.find((d) => d.id === m.defId)?.vanishWhenUnseen;
    if (!m.ai?.fleeing || limit === undefined) continue;
    const unseenTurns = isVisible(state.floor, m) ? 0 : (m.ai.unseenTurns ?? 0) + 1;
    if (unseenTurns < limit) {
      const actors = next.floor.actors.map((a) => (a.id === m.id ? { ...a, ai: { ...a.ai, unseenTurns } } : a));
      next = { ...next, floor: { ...next.floor, actors } };
      continue;
    }
    // 갖고 있던 carried도 함께 사라진다
    const name = nameOf(data, m.defId);
    next = { ...next, floor: { ...next.floor, actors: next.floor.actors.filter((a) => a.id !== m.id) } };
    next = addMessage(next, (m.carried?.length ?? 0) > 0 ? MESSAGES.fledWith(name) : MESSAGES.fled(name), data);
  }
  return next;
}

// F008 최종보스: 배치, 보스방 경고·봉인, 행동 패턴. 무작위 요소 없음
import { updateActor } from './actors';
import { monsterName, themeForFloor } from '../data/query';
import type { GameData, MonsterDef } from '../data/types';
import { firstStep, isAdjacent, moveOrWait, seesPlayer, stepFrom, strike, walkable } from './ai';
import type { Point } from './dungeon';
import { baseStat, getStat } from './effects';

import { addMessage, MESSAGES } from './messages';
import { monsterAt, objectAt } from './movement';
import { tileIndex, type Actor, type Direction, type FloorState, type MapObject, type MonsterAi, type Room, type RunState } from './state';

export const SEALED_GATE_TYPE = 'sealedGate';
const BOSS_ROOM_TYPE = 'boss';
const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left'];

const inRoom = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const dist = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function bossRoomAt(floor: FloorState, p: Point): Room | undefined {
  return floor.rooms.find((r) => r.type === BOSS_ROOM_TYPE && inRoom(r, p));
}

function bossName(data: GameData, floorNumber: number): string {
  const id = themeForFloor(data, floorNumber).boss;
  return id ? monsterName(data, id) : '';
}

// 규칙 1, 2: 테마의 boss를 보스방 가운데에 가장 가까운 빈 바닥 칸에 1마리
export function placeBoss(floor: FloorState, data: GameData, floorNumber: number, firstId: number): { floor: FloorState; nextId: number } {
  const bossId = themeForFloor(data, floorNumber).boss;
  const room = floor.rooms.find((r) => r.type === BOSS_ROOM_TYPE);
  if (!bossId || !room) return { floor, nextId: firstId };
  const center = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
  const spots: Point[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (floor.tiles[tileIndex(floor, x, y)] === 'floor' && !objectAt(floor, x, y) && !monsterAt(floor, x, y)) spots.push({ x, y });
    }
  }
  const spot = spots.sort((a, b) => dist(a, center) - dist(b, center) || a.y - b.y || a.x - b.x)[0];
  if (!spot) return { floor, nextId: firstId };
  const boss: Actor = { id: firstId, defId: bossId, ...spot, facing: 'down', hp: 0, buildItems: [], consumables: [], statuses: [], ai: {} };
  return { floor: { ...floor, actors: [...floor.actors, { ...boss, hp: baseStat(boss, 'maxHp', data) }] }, nextId: firstId + 1 };
}

// 규칙 4: 보스방 밖에서 보스방 안 칸으로 처음 이동하려 하면 경고할 방
export function bossRoomNeedingWarning(state: RunState, to: Point): Room | undefined {
  const room = bossRoomAt(state.floor, to);
  if (!room || room.state.warned || inRoom(room, state.player)) return undefined;
  return room;
}

// 규칙 4: 이동하지 않고 경고만. 턴은 쓰지 않는다
export function warnBossRoom(state: RunState, data: GameData, roomId: number): RunState {
  const rooms = state.floor.rooms.map((r) => (r.id === roomId ? { ...r, state: { ...r.state, warned: true } } : r));
  return addMessage({ ...state, floor: { ...state.floor, rooms } }, MESSAGES.bossWarning(bossName(data, state.floorNumber)), data);
}

// 규칙 6, 7: 보스방 안에서 턴이 끝나면 맞닿은 바깥 바닥을 모두 막는다. 개체가 있는 칸은 떠난 뒤에
export function sealBossRooms(state: RunState, data: GameData): RunState {
  let next = state;
  for (const room of state.floor.rooms.filter((r) => r.type === BOSS_ROOM_TYPE)) {
    if (!room.state.sealed) {
      if (!inRoom(room, next.player)) continue;
      const rooms = next.floor.rooms.map((r) => (r.id === room.id ? { ...r, state: { ...r.state, sealed: true } } : r));
      next = addMessage({ ...next, floor: { ...next.floor, rooms } }, MESSAGES.sealed(), data);
    }
    for (const gate of gateTiles(next.floor, room)) {
      const { floor, player } = next;
      if (objectAt(floor, gate.x, gate.y)?.type === SEALED_GATE_TYPE) continue;
      if (monsterAt(floor, gate.x, gate.y) || (player.x === gate.x && player.y === gate.y)) continue;
      const object: MapObject = { id: next.nextId, type: SEALED_GATE_TYPE, ...gate, blocksMove: true, blocksSight: true, state: {} };
      next = {
        ...next,
        nextId: next.nextId + 1,
        floor: {
          ...floor,
          objects: [...floor.objects.filter((o) => !(o.x === gate.x && o.y === gate.y)), object],
          // 물체가 있는 칸에는 아이템을 두지 않는다 (game-state.md)
          items: floor.items.filter((it) => !(it.x === gate.x && it.y === gate.y)),
        },
      };
    }
  }
  return next;
}

// 보스방 바깥 바닥 중 보스방 칸과 상하좌우로 맞닿은 칸
function gateTiles(floor: FloorState, room: Room): Point[] {
  const gates: Point[] = [];
  const seen = new Set<string>();
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      for (const dir of DIRECTIONS) {
        const n = stepFrom({ x, y }, dir);
        const key = `${n.x},${n.y}`;
        if (inRoom(room, n) || seen.has(key) || floor.tiles[tileIndex(floor, n.x, n.y)] !== 'floor') continue;
        seen.add(key);
        gates.push(n);
      }
    }
  }
  return gates;
}

// 규칙 10: 네 방향으로 slamRange칸까지. 벽·막힌 물체에서 끊긴다(그 칸 제외). 개체는 막지 않는다
function slamTiles(floor: FloorState, from: Point, range: number): Point[] {
  const tiles: Point[] = [];
  for (const dir of DIRECTIONS) {
    let p = from;
    for (let k = 0; k < range; k++) {
      p = stepFrom(p, dir);
      if (!walkable(floor, p.x, p.y)) break;
      tiles.push(p);
    }
  }
  return tiles;
}

// 9-3: 보스방 안에서만 chase
function chaseInRoom(state: RunState, data: GameData, monster: Actor, ai: MonsterAi, room: Room | undefined): RunState {
  if (isAdjacent(state, monster)) return strike(state, data, monster, ai);
  const dir = firstStep(state.floor, monster, state.player);
  if (!dir || (room && !inRoom(room, stepFrom(monster, dir)))) return updateActor(state, { ...monster, ai });
  return moveOrWait(state, data, monster, dir, ai);
}

// 규칙 8~12
export function actBoss(state: RunState, data: GameData, monster: Actor, def: MonsterDef, ai: MonsterAi): RunState {
  const cfg = def.boss;
  if (!cfg) return state;
  const room = bossRoomAt(state.floor, monster);
  const every = () => (ai.enraged ? cfg.enrage.chargeEvery : cfg.chargeEvery);
  let next = state;
  // 12. 2단계: 차례가 시작될 때 HP가 기준 이하면
  if (!ai.enraged && monster.hp <= getStat(monster, 'maxHp', data) * cfg.enrage.hpRatio) {
    ai.enraged = true;
    next = addMessage(next, cfg.enrage.message, data);
    if (ai.turnsUntilCharge !== undefined) ai.turnsUntilCharge = Math.min(ai.turnsUntilCharge, every());
  }
  // 8. 플레이어가 보스방 안에 있을 때만 본다
  const sees = !!room && inRoom(room, next.player) && seesPlayer(next, data, monster);
  if (ai.turnsUntilCharge === undefined) {
    if (!sees) return updateActor(next, { ...monster, ai });
    // 처음 본 차례: noticeMessage(플레이어가 먼저 봐서 이미 나왔으면 생략), 그 차례에는 추적만
    if (def.noticeMessage && !ai.noticed) next = addMessage(next, def.noticeMessage, data);
    ai.noticed = true;
    ai.turnsUntilCharge = every();
    return chaseInRoom(next, data, monster, ai, room);
  }
  // 9-1. 강타: 힘을 모은 칸 중 플레이어가 서 있는 칸이 있으면 ×slamDamageMul. 이 턴에는 움직이지 않는다
  if (ai.charging) {
    const hit = ai.charging.some((t) => t.x === next.player.x && t.y === next.player.y);
    ai.charging = undefined;
    ai.turnsUntilCharge = every();
    next = addMessage(next, MESSAGES.bossSlam(def.name), data);
    if (!hit) return updateActor(next, { ...monster, ai });
    return strike(next, data, monster, ai, { extraOps: [{ op: 'mul', value: cfg.slamDamageMul }] });
  }
  // 9-2. 힘 모으기
  ai.turnsUntilCharge -= 1;
  if (ai.turnsUntilCharge <= 0) {
    ai.charging = slamTiles(next.floor, monster, cfg.slamRange);
    return addMessage(updateActor(next, { ...monster, ai }), MESSAGES.bossCharge(def.name), data);
  }
  // 9-3. 추적
  return chaseInRoom(next, data, monster, ai, room);
}

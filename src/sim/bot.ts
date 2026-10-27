// F017 밸런스 시뮬레이터의 자동 플레이 봇. "조심성 있는 보통 사람" 정도로, 매 턴 규칙 1~9 중 처음 맞는 것 하나만 한다.
// 무작위 요소 없음: 같은 상태면 같은 결정을 내린다 (F017 실행 3)
import { itemDef } from '../data/query';
import type { GameData } from '../data/types';
import { BOSS_ROOM_TYPE } from '../core/boss';
import { isClosedDoor } from '../core/doors';
import { isBossFloor, type Point, STAIRS_OBJECT_TYPE } from '../core/dungeon';
import { getStat } from '../core/effects';
import { canUseConsumable, CHEST_OBJECT_TYPE } from '../core/items';
import { DIRECTIONS, inBounds, isPassable, monsterAt, stepFrom } from '../core/movement';
import { isPuzzleTile } from '../core/puzzles';
import { roomAt, roomTiles } from '../core/rooms';
import { PUZZLE_ROOM_TYPE } from '../core/roomTypes';
import { SPRING_OBJECT_TYPE } from '../core/roomFeatures';
import { type Direction, type FloorState, type MapObject, type RunState, tileIndex } from '../core/state';
import { TRAP_OBJECT_TYPE } from '../core/traps';
import type { PlayerInput } from '../core/turn';

// 봇이 기억하는 것: 몬스터마다 마지막으로 본 자리. 문 옆에서 시야가 깜빡여 오락가락하지 않게, 사람처럼 본 곳까지는 가 본다
export interface BotMemory {
  floorNumber: number;
  lastSeen: Map<number, Point>;
}

export const newMemory = (): BotMemory => ({ floorNumber: 0, lastSeen: new Map() });

export type BotMove = { type: 'introDone' } | { type: 'choose'; index: number } | { type: 'play'; input: PlayerInput };

// F017 봇 규칙에 적힌 HP 기준 (규칙 2, 5)
const POTION_HP_RATIO = 0.4;
const SPRING_HP_RATIO = 0.6;
const REST: BotMove = { type: 'play', input: { type: 'rest' } };

const go = (direction: Direction): BotMove => ({ type: 'play', input: { type: 'direction', direction } });

export function decide(state: RunState, data: GameData, memory: BotMemory): BotMove {
  if (state.phase === 'floorIntro') return { type: 'introDone' };
  // 1. 희귀를 먼저, 같은 등급이면 후보 순서대로
  if (state.phase === 'itemChoice') {
    const options = state.pendingChoice?.options ?? [];
    const rare = options.findIndex((id) => itemDef(data, id)?.rarity === 'rare');
    return { type: 'choose', index: Math.max(rare, 0) };
  }
  const { player, floor } = state;
  const maxHp = getStat(player, 'maxHp', data);

  // 2. HP 40% 이하면 회복 물약
  if (player.hp <= maxHp * POTION_HP_RATIO) {
    const index = player.consumables.findIndex((id, i) => healsSelf(data, id) && canUseConsumable(state, data, i));
    if (index >= 0) return { type: 'play', input: { type: 'useItem', index } };
  }

  // 3. 인접한 몬스터 공격 (HP가 가장 낮은 쪽)
  let target: { dir: Direction; hp: number } | null = null;
  for (const dir of DIRECTIONS) {
    const p = stepFrom(player, dir);
    const monster = monsterAt(floor, p.x, p.y);
    if (monster && (!target || monster.hp < target.hp)) target = { dir, hp: monster.hp };
  }
  if (target) return go(target.dir);

  // 4. 보스 강타 칸에서 비키기
  const slam = new Set(floor.actors.flatMap((a) => a.ai?.charging ?? []).map(key));
  if (slam.has(key(player))) {
    const dir = DIRECTIONS.find((d) => {
      const p = stepFrom(player, d);
      return !slam.has(key(p)) && isPassable(state, p.x, p.y) && !trapOn(floor, p);
    });
    if (dir) return go(dir);
  }

  // 5. HP 60% 이하면 아는 샘으로
  if (player.hp <= maxHp * SPRING_HP_RATIO) {
    const springs = known(floor, (o) => o.type === SPRING_OBJECT_TYPE && !o.state.used);
    const dir = stepToward(floor, player, springs);
    if (dir) return go(dir);
  }

  // 6. 보이는 몬스터에게 다가가기. 안 보이게 되었으면 마지막으로 본 자리까지
  // 도망치는 몬스터는 쫓지 않는다: 같은 속도라 끝없이 쫓게 된다 (붙으면 규칙 3으로 친다)
  if (memory.floorNumber !== state.floorNumber) Object.assign(memory, { floorNumber: state.floorNumber, lastSeen: new Map() });
  for (const a of floor.actors) {
    if (!floor.visible[tileIndex(floor, a.x, a.y)]) continue;
    if (a.ai?.fleeing) memory.lastSeen.delete(a.id);
    else memory.lastSeen.set(a.id, { x: a.x, y: a.y });
  }
  // 쓰러뜨렸거나 가 봤는데 없으면 잊는다
  const alive = new Set(floor.actors.map((a) => a.id));
  for (const [id, p] of memory.lastSeen) if (!alive.has(id) || (p.x === player.x && p.y === player.y)) memory.lastSeen.delete(id);
  const toMonster = stepToward(floor, player, [...memory.lastSeen.values()]);
  if (toMonster) return go(toMonster);
  memory.lastSeen.clear();

  // 7. 아는 열지 않은 상자 (잠긴 상자·퍼즐방 상자는 건너뛴다)
  const chests = known(floor, (o) => o.type === CHEST_OBJECT_TYPE && !o.state.opened && !o.state.locked && roomAt(floor, o)?.type !== PUZZLE_ROOM_TYPE);
  const toChest = stepToward(floor, player, chests);
  if (toChest) return go(toChest);

  // 8. 가장 가까운 미탐색 칸 쪽으로
  const toFrontier = stepToward(floor, player, frontier(floor));
  if (toFrontier) return go(toFrontier);

  // 9. 계단으로 내려가기. 마지막 층이면 보스방으로
  if (isBossFloor(data, state.floorNumber)) {
    const room = floor.rooms.find((r) => r.type === BOSS_ROOM_TYPE);
    const goals = room ? roomTiles(floor, room) : [];
    const dir = stepToward(floor, player, goals) ?? stepToward(floor, player, goals, false);
    return dir ? go(dir) : REST;
  }
  const stairs = floor.objects.filter((o) => o.type === STAIRS_OBJECT_TYPE);
  if (stairs.some((s) => s.x === player.x && s.y === player.y)) return { type: 'play', input: { type: 'descend' } };
  const dir = stepToward(floor, player, known(floor, (o) => o.type === STAIRS_OBJECT_TYPE)) ?? stepToward(floor, player, stairs, false);
  return dir ? go(dir) : REST;
}

const key = (p: Point) => `${p.x},${p.y}`;

function healsSelf(data: GameData, id: string): boolean {
  return itemDef(data, id)?.use?.effects.some((e) => e.type === 'heal' && e.target === 'self') ?? false;
}

function trapOn(floor: FloorState, p: Point): boolean {
  return floor.objects.some((o) => o.type === TRAP_OBJECT_TYPE && o.x === p.x && o.y === p.y);
}

// 본 적 있는 칸 위의 물체
function known(floor: FloorState, test: (o: MapObject) => boolean): MapObject[] {
  return floor.objects.filter((o) => test(o) && floor.explored[tileIndex(floor, o.x, o.y)]);
}

// 본 적 있는 바닥 중 아직 안 본 칸과 맞닿은 칸
function frontier(floor: FloorState): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const i = tileIndex(floor, x, y);
      if (!floor.explored[i] || floor.tiles[i] !== 'floor') continue;
      if (DIRECTIONS.some((d) => {
        const n = stepFrom({ x, y }, d);
        return inBounds(floor, n.x, n.y) && !floor.explored[tileIndex(floor, n.x, n.y)];
      })) out.push({ x, y });
    }
  }
  return out;
}

// 칸마다 지나갈 수 있는지: 0 막힘, 1 지나감, 2 함정(피할 수 없을 때만 지나감)
// knownOnly면 본 적 있는 칸만 쓴다. 다른 개체는 장애물로 보지 않는다 (ai.ts pathable과 같은 기준)
// 한 턴 안에서 같은 층으로 여러 번 길을 찾으므로 층 객체마다 한 번만 만든다
const gridCache = new WeakMap<FloorState, Map<boolean, Uint8Array>>();

function passGrid(floor: FloorState, knownOnly: boolean): Uint8Array {
  let byKnown = gridCache.get(floor);
  if (!byKnown) gridCache.set(floor, (byKnown = new Map()));
  let grid = byKnown.get(knownOnly);
  if (!grid) byKnown.set(knownOnly, (grid = buildGrid(floor, knownOnly)));
  return grid;
}

function buildGrid(floor: FloorState, knownOnly: boolean): Uint8Array {
  const grid = new Uint8Array(floor.width * floor.height);
  for (let i = 0; i < grid.length; i++) {
    if (floor.tiles[i] === 'floor' && (!knownOnly || floor.explored[i])) grid[i] = 1;
  }
  for (const o of floor.objects) {
    const i = tileIndex(floor, o.x, o.y);
    if (grid[i] === 0 || isClosedDoor(o)) continue;
    if (isPuzzleTile(o) || o.blocksMove) grid[i] = 0;
    else if (o.type === TRAP_OBJECT_TYPE) grid[i] = 2;
  }
  return grid;
}

// 가장 가까운 목표로 가는 첫 걸음. 함정을 피하는 길이 없을 때만 함정을 지난다. 길이 없거나 이미 목표 위면 null
function stepToward(floor: FloorState, from: Point, goals: Point[], knownOnly = true): Direction | null {
  if (goals.length === 0) return null;
  const grid = passGrid(floor, knownOnly);
  return firstStep(floor, grid, from, goals, false) ?? firstStep(floor, grid, from, goals, true);
}

function firstStep(floor: FloorState, grid: Uint8Array, from: Point, goals: Point[], throughTraps: boolean): Direction | null {
  const dist = new Int32Array(grid.length).fill(-1);
  const queue: number[] = [];
  for (const g of goals) {
    const i = tileIndex(floor, g.x, g.y);
    if (dist[i] === -1) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  const start = tileIndex(floor, from.x, from.y);
  for (let head = 0; head < queue.length && dist[start] === -1; head++) {
    const i = queue[head];
    const p = { x: i % floor.width, y: Math.floor(i / floor.width) };
    for (const dir of DIRECTIONS) {
      const n = stepFrom(p, dir);
      if (!inBounds(floor, n.x, n.y)) continue;
      const j = tileIndex(floor, n.x, n.y);
      const pass = grid[j] === 1 || (throughTraps && grid[j] === 2) || j === start;
      if (!pass || dist[j] !== -1) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  const here = dist[start];
  if (here <= 0) return null;
  for (const dir of DIRECTIONS) {
    const n = stepFrom(from, dir);
    if (inBounds(floor, n.x, n.y) && dist[tileIndex(floor, n.x, n.y)] === here - 1) return dir;
  }
  return null;
}

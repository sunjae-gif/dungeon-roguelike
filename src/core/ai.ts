// F004·F014 몬스터 행동 방식. 무작위 요소 없음
import type { GameData, MonsterDef } from '../data/types';
import { attack, type AttackOptions } from './combat';
import type { Point } from './dungeon';
import { getStat } from './effects';
import { isClosedDoor, openDoor } from './doors';
import { isPuzzleTile } from './puzzles';
import { fireEvent, updateActor } from './events';
import { canSee, DIRECTION_DELTAS, inBounds, isPassable, manhattanDistance, monsterAt, objectAt } from './movement';
import { tileIndex, type Actor, type Direction, type FloorState, type MonsterAi, type RunState } from './state';
import { trapAt, triggerTrap } from './traps';

// F004 규칙 14: 최단 경로가 여러 개면 위 → 오른쪽 → 아래 → 왼쪽
const STEP_ORDER: Direction[] = ['up', 'right', 'down', 'left'];

export const stepFrom = (p: Point, dir: Direction): Point => ({ x: p.x + DIRECTION_DELTAS[dir].x, y: p.y + DIRECTION_DELTAS[dir].y });

// 바닥이고 막힌 물체가 없는 칸. 사격선·강타 범위가 쓴다 (닫힌 문은 막는다)
export function walkable(floor: FloorState, x: number, y: number): boolean {
  return inBounds(floor, x, y) && floor.tiles[tileIndex(floor, x, y)] === 'floor' && !objectAt(floor, x, y)?.blocksMove;
}

// F004 규칙 13, F010 규칙 15: 경로에 넣을 수 있는 칸. 다른 개체는 장애물이 아니다.
// 닫힌 문은 열고 지나가므로 넣는다. avoidTraps면 함정 칸을 뺀다
function pathable(floor: FloorState, x: number, y: number, avoidTraps: boolean): boolean {
  if (!inBounds(floor, x, y) || floor.tiles[tileIndex(floor, x, y)] !== 'floor') return false;
  const object = objectAt(floor, x, y);
  if (!object || isClosedDoor(object)) return true;
  // F009 규칙 21: 퍼즐 판의 칸에는 들어가지 않는다
  if (isPuzzleTile(object)) return false;
  if (avoidTraps && trapAt(floor, x, y)) return false;
  return !object.blocksMove;
}

// 목표 칸들에서 거꾸로 BFS해 각 칸의 거리를 구한다. 갈 수 없는 칸은 -1
function distancesFrom(floor: FloorState, goals: Point[], avoidTraps: boolean): number[] {
  const dist: number[] = new Array(floor.width * floor.height).fill(-1);
  const queue: Point[] = [];
  for (const g of goals) {
    if (dist[tileIndex(floor, g.x, g.y)] === -1) {
      dist[tileIndex(floor, g.x, g.y)] = 0;
      queue.push(g);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    const d = dist[tileIndex(floor, p.x, p.y)];
    for (const dir of STEP_ORDER) {
      const n = stepFrom(p, dir);
      if (!pathable(floor, n.x, n.y, avoidTraps) || dist[tileIndex(floor, n.x, n.y)] !== -1) continue;
      dist[tileIndex(floor, n.x, n.y)] = d + 1;
      queue.push(n);
    }
  }
  return dist;
}

// 가장 가까운 목표로 가는 최단 경로의 첫 걸음. 경로가 없거나 이미 목표 위면 null (F004 규칙 13~16)
// F010 규칙 15: 함정을 지나지 않는 경로가 없을 때만 함정을 지나는 경로를 쓴다
export function firstStepTo(floor: FloorState, from: Point, goals: Point[]): Direction | null {
  if (goals.length === 0) return null;
  let dist = distancesFrom(floor, goals, true);
  if (dist[tileIndex(floor, from.x, from.y)] < 0) dist = distancesFrom(floor, goals, false);
  const here = dist[tileIndex(floor, from.x, from.y)];
  if (here <= 0) return null;
  for (const dir of STEP_ORDER) {
    const n = stepFrom(from, dir);
    if (inBounds(floor, n.x, n.y) && dist[tileIndex(floor, n.x, n.y)] === here - 1) return dir;
  }
  return null;
}

export function firstStep(floor: FloorState, from: Point, goal: Point): Direction | null {
  return firstStepTo(floor, from, [goal]);
}

function directionTo(from: Point, to: Point): Direction {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  return to.y > from.y ? 'down' : 'up';
}

// F014 사격선: 같은 줄, 거리 1~range, 사이 칸에 벽·막힌 물체가 없다. 관통이 아니면 다른 개체도 없다.
// ignoreId: 쏘는 몬스터 자신 (사격 위치를 미리 볼 때 지금 칸이 사이에 있을 수 있다)
export function lineOfFire(state: RunState, from: Point, to: Point, range: number, piercing: boolean, ignoreId: number): boolean {
  if (from.x !== to.x && from.y !== to.y) return false;
  const d = manhattanDistance(from, to);
  if (d < 1 || d > range) return false;
  const dir = directionTo(from, to);
  const { floor } = state;
  for (let k = 1, p = stepFrom(from, dir); k < d; k++, p = stepFrom(p, dir)) {
    if (!walkable(floor, p.x, p.y)) return false;
    if (piercing) continue;
    const other = monsterAt(floor, p.x, p.y);
    if ((other && other.id !== ignoreId) || (state.player.x === p.x && state.player.y === p.y)) return false;
  }
  return true;
}

// F014 공통 규칙 2: 멀어지는 칸. 지금보다 멀어지는 칸 중 가장 먼 칸, 같으면 위→오른쪽→아래→왼쪽
function retreatStep(state: RunState, monster: Actor): Direction | null {
  let best: Direction | null = null;
  let bestDistance = manhattanDistance(monster, state.player);
  for (const dir of STEP_ORDER) {
    const n = stepFrom(monster, dir);
    const d = manhattanDistance(n, state.player);
    // F010 규칙 16: 함정 칸은 후보에서 뺀다
    if (d > bestDistance && isPassable(state, n.x, n.y) && !trapAt(state.floor, n.x, n.y) && !isPuzzleTile(objectAt(state.floor, n.x, n.y))) {
      best = dir;
      bestDistance = d;
    }
  }
  return best;
}

// 한 칸 움직인다. 첫 걸음 칸에 다른 개체가 있으면 기다린다 (F004 규칙 15)
export function moveOrWait(state: RunState, data: GameData, monster: Actor, dir: Direction, ai: MonsterAi): RunState {
  const to = stepFrom(monster, dir);
  if (monsterAt(state.floor, to.x, to.y) || (to.x === state.player.x && to.y === state.player.y)) {
    return updateActor(state, { ...monster, ai, facing: dir });
  }
  // F010 규칙 4: 닫힌 문이면 여는 것이 이번 행동
  const door = objectAt(state.floor, to.x, to.y);
  if (isClosedDoor(door)) return openDoor(updateActor(state, { ...monster, ai, facing: dir }), data, monster.id, door!.id);
  const moved = updateActor(state, { ...monster, ...to, facing: dir, ai });
  const fired = fireEvent(moved, data, monster.id, 'onMove', { from: { x: monster.x, y: monster.y }, to }).state;
  // F010 규칙 11: 함정 칸에 들어가면 발동
  return triggerTrap(fired, data, monster.id);
}

export function strike(state: RunState, data: GameData, monster: Actor, ai: MonsterAi, options: AttackOptions = {}): RunState {
  const facing = updateActor(state, { ...monster, ai, facing: directionTo(monster, state.player) });
  return attack(facing, data, monster.id, state.player.id, options);
}

export const isAdjacent = (state: RunState, monster: Actor) => manhattanDistance(monster, state.player) === 1;
export const seesPlayer = (state: RunState, data: GameData, monster: Actor) =>
  canSee(state.floor, monster, state.player, data.monsterSightRadius);

// 마지막 목격 위치로 한 칸, 아니면 제자리 (F004 규칙 12-3, 12-4)
function followMemory(state: RunState, data: GameData, monster: Actor, ai: MonsterAi): RunState {
  const goal = ai.lastSeenPlayer;
  if (!goal) return updateActor(state, { ...monster, ai });
  const dir = firstStep(state.floor, monster, goal);
  if (!dir) {
    if (monster.x === goal.x && monster.y === goal.y) delete ai.lastSeenPlayer;
    return updateActor(state, { ...monster, ai });
  }
  const to = stepFrom(monster, dir);
  if (to.x === goal.x && to.y === goal.y) delete ai.lastSeenPlayer;
  return moveOrWait(state, data, monster, dir, ai);
}

// F004 규칙 12 chase
export function actChase(state: RunState, data: GameData, monster: Actor, ai: MonsterAi): RunState {
  if (isAdjacent(state, monster)) return strike(state, data, monster, ai);
  if (!seesPlayer(state, data, monster)) return followMemory(state, data, monster, ai);
  ai.lastSeenPlayer = { x: state.player.x, y: state.player.y };
  const dir = firstStep(state.floor, monster, state.player);
  return dir ? moveOrWait(state, data, monster, dir, ai) : updateActor(state, { ...monster, ai });
}

// F014 ranged
export function actRanged(state: RunState, data: GameData, monster: Actor, def: MonsterDef, ai: MonsterAi): RunState {
  const adjacent = isAdjacent(state, monster);
  // 1. 붙어 있고 지난 턴에 물러나지 않았으면 물러난다
  if (adjacent && !ai.retreatedLastTurn) {
    const dir = retreatStep(state, monster);
    if (dir) return moveOrWait(state, data, monster, dir, { ...ai, retreatedLastTurn: true });
  }
  ai.retreatedLastTurn = false;
  // 2. 근접 공격
  if (adjacent) return strike(state, data, monster, ai);
  if (!seesPlayer(state, data, monster)) return followMemory(state, data, monster, ai); // 5
  ai.lastSeenPlayer = { x: state.player.x, y: state.player.y };
  const range = getStat(monster, 'attackRange', data);
  const piercing = def.piercing ?? false;
  // 3. 사격선이 있으면 그 자리에서 공격
  if (lineOfFire(state, monster, state.player, range, piercing, monster.id)) return strike(state, data, monster, ai, { ranged: true });
  // 4. 사격 위치(플레이어와 같은 줄, 2칸 이상 떨어진 바닥)로. 없으면 chase처럼 다가간다
  const spots: Point[] = [];
  for (const dir of STEP_ORDER) {
    for (let k = 2, p = stepFrom(stepFrom(state.player, dir), dir); k <= range; k++, p = stepFrom(p, dir)) {
      // F010 규칙 16: 함정 칸, F009 규칙 21: 퍼즐 칸은 사격 위치에서 뺀다
      const tile = objectAt(state.floor, p.x, p.y);
      if (!walkable(state.floor, p.x, p.y) || trapAt(state.floor, p.x, p.y) || isPuzzleTile(tile)) continue;
      if (lineOfFire(state, p, state.player, range, piercing, monster.id)) spots.push(p);
    }
  }
  const dir = firstStepTo(state.floor, monster, spots) ?? firstStep(state.floor, monster, state.player);
  return dir ? moveOrWait(state, data, monster, dir, ai) : updateActor(state, { ...monster, ai });
}

// F014 flee
export function actFlee(state: RunState, data: GameData, monster: Actor, def: MonsterDef, ai: MonsterAi): RunState {
  // 1. HP 조건(또는 steal 성공)으로 도망 상태. 한번 되면 풀리지 않는다
  if (monster.hp <= getStat(monster, 'maxHp', data) * (def.fleeHpRatio ?? 0)) ai.fleeing = true;
  if (!ai.fleeing) return actChase(state, data, monster, ai);
  const dir = retreatStep(state, monster);
  if (dir) return moveOrWait(state, data, monster, dir, ai);
  if (isAdjacent(state, monster)) return strike(state, data, monster, ai); // 궁지에 몰린 쥐
  return updateActor(state, { ...monster, ai });
}

// F014 ambush
export function actAmbush(state: RunState, data: GameData, monster: Actor, ai: MonsterAi): RunState {
  if (ai.awake) return actChase(state, data, monster, ai);
  if (!isAdjacent(state, monster)) return state;
  return strike(state, data, monster, { ...ai, awake: true });
}

// F004 몬스터: 배치와 행동
import { themeForFloor } from '../data/query';
import type { GameData } from '../data/types';
import { attack } from './combat';
import type { Point } from './dungeon';
import { baseStat } from './effects';
import { fireEvent, findActor, updateActor } from './events';
import { canSee, DIRECTION_DELTAS, inBounds, manhattanDistance, monsterAt, objectAt } from './movement';
import { floorRng, nextInt, pick } from './rng';
import { tileIndex, type Actor, type Direction, type FloorState, type RunState } from './state';

// F004 규칙 3: 몬스터를 놓지 않는 방 (비밀방은 F009에서 생긴다)
const NO_MONSTER_ROOMS = ['start', 'stairs', 'boss', 'secret'];

// F004 배치. 같은 runSeed·층이면 같은 결과 (spawn 흐름)
export function spawnMonsters(
  floor: FloorState,
  data: GameData,
  runSeed: number,
  floorNumber: number,
  firstId: number,
): { floor: FloorState; nextId: number } {
  const theme = themeForFloor(data, floorNumber);
  const rng = floorRng(runSeed, floorNumber, 'spawn');
  const count = nextInt(rng, theme.monsterCount[0], theme.monsterCount[1]);

  // 규칙 2~4: 몬스터를 놓을 수 있는 방 안의 빈 바닥 칸
  const free: Point[] = [];
  for (const room of floor.rooms) {
    if (NO_MONSTER_ROOMS.includes(room.type)) continue;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (floor.tiles[tileIndex(floor, x, y)] !== 'floor') continue;
        if (objectAt(floor, x, y) || monsterAt(floor, x, y)) continue;
        free.push({ x, y });
      }
    }
  }

  let nextId = firstId;
  const actors: Actor[] = [...floor.actors];
  // 규칙 6: 자리가 모자라면 놓을 수 있는 만큼만
  for (let i = 0; i < count && free.length > 0 && theme.monsterTypes.length > 0; i++) {
    const spot = free.splice(nextInt(rng, 0, free.length - 1), 1)[0];
    const defId = pick(rng, theme.monsterTypes);
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

// F004 규칙 14: 최단 경로가 여러 개면 위 → 오른쪽 → 아래 → 왼쪽
const STEP_ORDER: Direction[] = ['up', 'right', 'down', 'left'];

// 규칙 13: 경로 계산에서 벽과 막힌 물체만 장애물. 다른 몬스터와 플레이어는 장애물이 아니다.
function walkable(floor: FloorState, x: number, y: number): boolean {
  return inBounds(floor, x, y) && floor.tiles[tileIndex(floor, x, y)] === 'floor' && !objectAt(floor, x, y)?.blocksMove;
}

// 목표에서 거꾸로 BFS해 각 칸의 거리를 구한다. 갈 수 없는 칸은 -1
function distancesTo(floor: FloorState, goal: Point): number[] {
  const dist: number[] = new Array(floor.width * floor.height).fill(-1);
  dist[tileIndex(floor, goal.x, goal.y)] = 0;
  const queue: Point[] = [goal];
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    const d = dist[tileIndex(floor, p.x, p.y)];
    for (const dir of STEP_ORDER) {
      const n = { x: p.x + DIRECTION_DELTAS[dir].x, y: p.y + DIRECTION_DELTAS[dir].y };
      if (!walkable(floor, n.x, n.y) || dist[tileIndex(floor, n.x, n.y)] !== -1) continue;
      dist[tileIndex(floor, n.x, n.y)] = d + 1;
      queue.push(n);
    }
  }
  return dist;
}

// 규칙 13~16: 최단 경로의 첫 걸음. 경로가 없거나 이미 도착했으면 null
export function firstStep(floor: FloorState, from: Point, goal: Point): Direction | null {
  if (from.x === goal.x && from.y === goal.y) return null;
  const dist = distancesTo(floor, goal);
  const here = dist[tileIndex(floor, from.x, from.y)];
  if (here <= 0) return null;
  for (const dir of STEP_ORDER) {
    const n = { x: from.x + DIRECTION_DELTAS[dir].x, y: from.y + DIRECTION_DELTAS[dir].y };
    if (inBounds(floor, n.x, n.y) && dist[tileIndex(floor, n.x, n.y)] === here - 1) return dir;
  }
  return null;
}

function directionTo(from: Point, to: Point): Direction {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  return to.y > from.y ? 'down' : 'up';
}

// F004 규칙 12 chase
function actChase(state: RunState, data: GameData, monster: Actor): RunState {
  const { player, floor } = state;
  // 12-1, 17: 상하좌우로 인접하면 공격 (대각선은 거리 2라 해당하지 않는다)
  if (manhattanDistance(monster, player) === 1) {
    const facing = updateActor(state, { ...monster, facing: directionTo(monster, player) });
    return attack(facing, data, monster.id, player.id);
  }
  // 12-2, 규칙 8: 몬스터 위치에서 공통 시야 반경으로 플레이어가 보이는가
  const sees = canSee(floor, monster, player, data.monsterSightRadius);
  const ai = { ...monster.ai };
  if (sees) ai.lastSeenPlayer = { x: player.x, y: player.y };
  const goal = ai.lastSeenPlayer;
  // 12-4: 보이지도 않고 기억도 없으면 제자리
  if (!goal) return state;
  const dir = firstStep(floor, monster, goal);
  // 12-3: 마지막 본 곳에 도착해 있으면 기억을 지우고 멈춘다. 규칙 16: 경로가 없으면 제자리
  if (!dir) {
    if (monster.x === goal.x && monster.y === goal.y) delete ai.lastSeenPlayer;
    return updateActor(state, { ...monster, ai });
  }
  const to = { x: monster.x + DIRECTION_DELTAS[dir].x, y: monster.y + DIRECTION_DELTAS[dir].y };
  // 규칙 15: 첫 걸음 칸에 다른 몬스터가 있으면 기다린다
  if (monsterAt(floor, to.x, to.y) || (to.x === player.x && to.y === player.y)) {
    return updateActor(state, { ...monster, ai, facing: dir });
  }
  if (!sees && to.x === goal.x && to.y === goal.y) delete ai.lastSeenPlayer;
  const moved = updateActor(state, { ...monster, ...to, facing: dir, ai });
  return fireEvent(moved, data, monster.id, 'onMove', { from: { x: monster.x, y: monster.y }, to }).state;
}

// turn-order.md 5단계: 살아 있는 몬스터가 id 순서대로 한 번씩. 플레이어가 쓰러지면 남은 몬스터는 행동하지 않는다
export function actMonsters(state: RunState, data: GameData): RunState {
  const ids = state.floor.actors.map((a) => a.id).sort((a, b) => a - b);
  let next = state;
  for (const id of ids) {
    if (next.player.hp <= 0) break;
    const monster = findActor(next, id);
    if (!monster) continue; // 이번 턴에 쓰러졌다
    // 규칙 11: behavior별 행동. 지금은 chase뿐 (데이터 검사가 다른 값을 막는다)
    next = actChase(next, data, monster);
  }
  return next;
}

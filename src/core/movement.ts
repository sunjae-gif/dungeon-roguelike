// F002 이동과 시야
import type { Point } from './dungeon';
import { tileIndex, type Direction, type FloorState, type RunState } from './state';

// F002 좌표: x는 오른쪽, y는 아래쪽으로 커진다
export const DIRECTION_DELTAS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function inBounds(floor: FloorState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < floor.width && y < floor.height;
}

export function objectAt(floor: FloorState, x: number, y: number) {
  return floor.objects.find((o) => o.x === x && o.y === y);
}

export function actorAt(state: RunState, x: number, y: number) {
  if (state.player.x === x && state.player.y === y) return state.player;
  return state.floor.actors.find((a) => a.x === x && a.y === y);
}

// game-state.md "칸이 지나갈 수 있는가". 이 판단은 이 함수에서만 한다.
export function isPassable(state: RunState, x: number, y: number): boolean {
  const { floor } = state;
  if (!inBounds(floor, x, y)) return false;
  if (floor.tiles[tileIndex(floor, x, y)] !== 'floor') return false;
  if (objectAt(floor, x, y)?.blocksMove) return false;
  return actorAt(state, x, y) === undefined;
}

// game-state.md: 시야를 막는지는 이 함수에서만 판단한다.
export function blocksSight(floor: FloorState, x: number, y: number): boolean {
  if (!inBounds(floor, x, y)) return true;
  if (floor.tiles[tileIndex(floor, x, y)] === 'wall') return true;
  return objectAt(floor, x, y)?.blocksSight ?? false;
}

// F002 규칙 7: 브레젠험 직선의 중간 칸(양 끝 제외)이 시야를 막지 않는가
function lineIsClear(floor: FloorState, from: Point, to: Point): boolean {
  const dx = Math.abs(to.x - from.x);
  const dy = -Math.abs(to.y - from.y);
  const sx = Math.sign(to.x - from.x);
  const sy = Math.sign(to.y - from.y);
  let err = dx + dy;
  let { x, y } = from;
  for (;;) {
    if (x === to.x && y === to.y) return true;
    if ((x !== from.x || y !== from.y) && blocksSight(floor, x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// F002 규칙 6, 7: 마름모 시야
export function computeVisible(floor: FloorState, origin: Point, radius: number): boolean[] {
  const visible: boolean[] = new Array(floor.width * floor.height).fill(false);
  for (let dy = -radius; dy <= radius; dy++) {
    const span = radius - Math.abs(dy);
    for (let dx = -span; dx <= span; dx++) {
      const p = { x: origin.x + dx, y: origin.y + dy };
      if (inBounds(floor, p.x, p.y) && lineIsClear(floor, origin, p)) visible[tileIndex(floor, p.x, p.y)] = true;
    }
  }
  return visible;
}

// 플레이어 시야로 visible을 다시 계산하고, F002 규칙 8: 본 칸은 탐색됨으로 남긴다.
// sightRadius는 아직 player.json 기본값. 보정이 생기는 M2에서 effects.md getStat으로 바꾼다.
export function updateSight(state: RunState, sightRadius: number): RunState {
  const visible = computeVisible(state.floor, state.player, sightRadius);
  const explored = state.floor.explored.map((seen, i) => seen || visible[i]);
  return { ...state, floor: { ...state.floor, visible, explored } };
}

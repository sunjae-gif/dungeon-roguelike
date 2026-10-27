// 바닥 아이템 놓기 (game-state.md: 한 칸에 최대 1개, 물체가 있는 칸에는 놓지 않는다)
import type { Point } from './dungeon';
import { inBounds, objectAt } from './movement';
import { type RunState, tileIndex } from './state';

// 아이템을 놓을 수 있는 가장 가까운 바닥 칸 (4방향 거리가 가까운 순, 같으면 위쪽·왼쪽 먼저)
export function nearestFreeFloor(state: RunState, from: Point): Point | null {
  const { floor } = state;
  const free = (x: number, y: number) =>
    inBounds(floor, x, y) &&
    floor.tiles[tileIndex(floor, x, y)] === 'floor' &&
    !objectAt(floor, x, y) &&
    !floor.items.some((it) => it.x === x && it.y === y);
  const maxRadius = floor.width + floor.height;
  for (let r = 0; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const span = r - Math.abs(dy);
      for (const dx of span === 0 ? [0] : [-span, span]) {
        if (free(from.x + dx, from.y + dy)) return { x: from.x + dx, y: from.y + dy };
      }
    }
  }
  return null;
}

// near에서 가장 가까운 빈 바닥 칸에 아이템 하나를 떨어뜨린다
export function dropItem(state: RunState, itemId: string, near: Point): RunState {
  const spot = nearestFreeFloor(state, near);
  if (!spot) return state;
  const item = { id: state.nextId, defId: itemId, ...spot };
  return { ...state, nextId: state.nextId + 1, floor: { ...state.floor, items: [...state.floor.items, item] } };
}

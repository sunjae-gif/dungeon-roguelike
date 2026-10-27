// F009 비밀방 입구: 막다른 통로 끝의 숨은 벽 (map 흐름)
import { centerOf, corridorPath, nearest, type Rect } from './corridors';
import type { Point } from './dungeon';
import { nextInt, type Rng } from './rng';
import { inRoom } from './rooms';
import { NORMAL_ROOM_TYPE, SECRET_ROOM_TYPE } from './roomTypes';
import { tileIndex, type FloorState } from './state';

export const HIDDEN_WALL_OBJECT_TYPE = 'hiddenWall';

// 규칙 8, 9: 비밀방마다 입구를 낸다. 통로가 닿아 버렸거나 입구를 낼 수 없으면 일반방으로 바꾸어 보통 통로로 잇는다.
// floor·types·links를 그 자리에서 바꾸고, 다음 id를 돌려준다
export function carveSecretEntrances(
  floor: FloorState,
  rects: Rect[],
  types: string[],
  links: [number, number][],
  rng: Rng,
  firstId: number,
): number {
  let nextId = firstId;
  const carve = (p: Point) => (floor.tiles[tileIndex(floor, p.x, p.y)] = 'floor');
  rects.forEach((r, i) => {
    if (types[i] !== SECRET_ROOM_TYPE) return;
    const entrance = isIsolated(floor, r)
      ? (findSecretEntrance(floor, rects, types, i, rng) ?? findBranchEntrance(floor, rects, types, i, rng))
      : null;
    if (entrance) {
      entrance.corridor.forEach(carve);
      carve(entrance.wall);
      floor.objects.push({
        id: nextId++, type: HIDDEN_WALL_OBJECT_TYPE, ...entrance.wall, blocksMove: true, blocksSight: true, state: { discovered: false },
      });
      return;
    }
    types[i] = NORMAL_ROOM_TYPE;
    if (!isIsolated(floor, r)) return;
    const others = rects.map((_, j) => j).filter((j) => j !== i && types[j] !== SECRET_ROOM_TYPE);
    const target = nearest(rects, i, others)!;
    links.push([target, i]);
    corridorPath(rng, centerOf(rects[target]), centerOf(r)).forEach(carve);
  });
  return nextId;
}

const isWall = (floor: FloorState, p: Point) =>
  p.x > 0 && p.y > 0 && p.x < floor.width - 1 && p.y < floor.height - 1 && floor.tiles[tileIndex(floor, p.x, p.y)] === 'wall';
const isFloorTile = (floor: FloorState, p: Point) =>
  p.x >= 0 && p.y >= 0 && p.x < floor.width && p.y < floor.height && floor.tiles[tileIndex(floor, p.x, p.y)] === 'floor';
const OUTWARD: { d: Point; side: Point }[] = [
  { d: { x: 0, y: -1 }, side: { x: 1, y: 0 } },
  { d: { x: 1, y: 0 }, side: { x: 0, y: 1 } },
  { d: { x: 0, y: 1 }, side: { x: 1, y: 0 } },
  { d: { x: -1, y: 0 }, side: { x: 0, y: 1 } },
];
const add = (p: Point, d: Point, k = 1): Point => ({ x: p.x + d.x * k, y: p.y + d.y * k });

// 방 칸과 상하좌우로 맞닿은 바깥 칸에 바닥이 하나도 없는가 (어떤 통로도 닿지 않았는가)
function isIsolated(floor: FloorState, r: Rect): boolean {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      for (const { d } of OUTWARD) {
        const n = add({ x, y }, d);
        if (!inRoom(r, n) && isFloorTile(floor, n)) return false;
      }
    }
  }
  return true;
}

// 막다른 통로 후보 길이 (F009 규칙 8: 2~3칸)
const DEAD_END_LENGTHS = [2, 3];

// F009 규칙 8: 비밀방 변의 칸에서 바깥으로 [숨은 벽 1칸][통로 2~3칸] 다음이 기존 바닥인 곳 (map 흐름)
// 통로와 숨은 벽 옆은 모두 벽이라야 한다 (다른 바닥과 붙으면 막다른 통로가 아니게 된다)
function findSecretEntrance(floor: FloorState, rects: Rect[], types: string[], index: number, rng: Rng): { wall: Point; corridor: Point[] } | null {
  const room = rects[index];
  const secretRects = rects.filter((_, j) => types[j] === SECRET_ROOM_TYPE);
  const options: { wall: Point; corridor: Point[] }[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      for (const { d, side } of OUTWARD) {
        const wall = add({ x, y }, d);
        if (inRoom(room, wall) || !isWall(floor, wall)) continue;
        for (const length of DEAD_END_LENGTHS) {
          const corridor = Array.from({ length }, (_, k) => add(wall, d, k + 1));
          const end = add(wall, d, length + 1);
          const line = [wall, ...corridor];
          if (!line.every((p) => isWall(floor, p) && isWall(floor, add(p, side)) && isWall(floor, add(p, side, -1)))) continue;
          if (!isFloorTile(floor, end) || secretRects.some((r) => inRoom(r, end))) continue;
          options.push({ wall, corridor });
        }
      }
    }
  }
  return options.length > 0 ? options[nextInt(rng, 0, options.length - 1)] : null;
}

// 2~3칸 자리가 없을 때: 가장 가까운 기존 바닥에서 비밀방 쪽으로 가지 통로를 내고 그 끝에 숨은 벽 (map 흐름)
// 막다른 통로가 하나뿐이라는 단서(F009 규칙 10)는 지키고, 길이만 3칸보다 길어질 수 있다
function findBranchEntrance(floor: FloorState, rects: Rect[], types: string[], index: number, rng: Rng): { wall: Point; corridor: Point[] } | null {
  const room = rects[index];
  const secretRects = rects.filter((_, j) => types[j] === SECRET_ROOM_TYPE);
  // 모든 칸에서 가장 가까운 기존 바닥(비밀방 제외)을 한 번의 BFS로 구한다 (4방향 거리)
  const nearestOf = new Array<Point | null>(floor.width * floor.height).fill(null);
  const queue: Point[] = [];
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (isFloorTile(floor, { x, y }) && !secretRects.some((r) => inRoom(r, { x, y }))) {
        nearestOf[tileIndex(floor, x, y)] = { x, y };
        queue.push({ x, y });
      }
    }
  }
  if (queue.length === 0) return null;
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    for (const { d } of OUTWARD) {
      const n = add(p, d);
      if (n.x < 0 || n.y < 0 || n.x >= floor.width || n.y >= floor.height || nearestOf[tileIndex(floor, n.x, n.y)]) continue;
      nearestOf[tileIndex(floor, n.x, n.y)] = nearestOf[tileIndex(floor, p.x, p.y)];
      queue.push(n);
    }
  }
  const nearestTarget = (p: Point) => nearestOf[tileIndex(floor, p.x, p.y)]!;
  const touchesRoom = (p: Point) => OUTWARD.some(({ d }) => inRoom(room, add(p, d)));
  const options: { wall: Point; tip: Point; target: Point; cost: number }[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      for (const { d, side } of OUTWARD) {
        const wall = add({ x, y }, d);
        const tip = add(wall, d);
        if (inRoom(room, wall) || !isWall(floor, wall) || !isWall(floor, add(wall, side)) || !isWall(floor, add(wall, side, -1))) continue;
        if (!isWall(floor, tip)) continue;
        const target = nearestTarget(tip);
        options.push({ wall, tip, target, cost: Math.abs(target.x - tip.x) + Math.abs(target.y - tip.y) });
      }
    }
  }
  options.sort((a, b) => a.cost - b.cost);
  for (const { wall, tip, target } of options) {
    const path = corridorPath(rng, tip, target).filter((p) => !(p.x === target.x && p.y === target.y));
    // 비밀방에 맞닿거나 숨은 벽 옆을 지나면 안 된다 (숨은 벽을 거치지 않는 길이 생긴다)
    if (path.some((p, k) => (k > 0 && touchesRoom(p)) || inRoom(room, p) || (k > 0 && Math.abs(p.x - wall.x) + Math.abs(p.y - wall.y) <= 1))) continue;
    // 끝(tip)은 막다른 칸이어야 한다: 숨은 벽 말고 맞닿는 바닥은 다음 통로 칸 하나뿐
    const carved = new Set(path.map((p) => `${p.x},${p.y}`));
    const neighbors = OUTWARD.map(({ d }) => add(tip, d)).filter((n) => !(n.x === wall.x && n.y === wall.y) && (carved.has(`${n.x},${n.y}`) || isFloorTile(floor, n)));
    if (neighbors.length !== 1) continue;
    return { wall, corridor: path };
  }
  return null;
}

// F001 던전 생성 (기본 지형): 방과 통로, 시작 지점, 계단 또는 보스방
import { themeForFloor } from '../data/query';
import type { GameData, ThemeDef } from '../data/types';
import { floorRng, nextInt, pick, type Rng } from './rng';
import { assignRoomTypes, NORMAL_ROOM_TYPE, SECRET_ROOM_TYPE } from './roomTypes';
import { tileIndex, type FloorState, type MapObject } from './state';

export interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GeneratedFloor {
  floor: FloorState;
  start: Point;
  nextId: number;
  // 통로로 이어진 방 쌍 (floor.rooms의 인덱스). 상태에는 넣지 않는다.
  links: [number, number][];
}

export const STAIRS_OBJECT_TYPE = 'stairs';
export const HIDDEN_WALL_OBJECT_TYPE = 'hiddenWall';

interface Layout {
  rects: Rect[];
  types: string[]; // F009 방 종류 (방마다)
  corridors: Point[][];
  links: [number, number][];
  start: Point;
  stairs: Point | null;
}

export function isBossFloor(data: GameData, floorNumber: number): boolean {
  return floorNumber === data.dungeon.maxFloor;
}

// F001 규칙 10: 같은 시드면 같은 지도
export function generateFloor(data: GameData, runSeed: number, floorNumber: number, nextId: number): GeneratedFloor {
  const theme = themeForFloor(data, floorNumber);
  const size = { width: theme.mapWidth, height: theme.mapHeight };
  const boss = isBossFloor(data, floorNumber);
  // F001 예외: 시도 횟수 상한을 넘으면 시드에 1을 더해 다시 시작
  for (let seed = runSeed >>> 0; ; seed = (seed + 1) >>> 0) {
    const rng = floorRng(seed, floorNumber, 'map');
    for (let attempt = 0; attempt < data.dungeon.generationMaxAttempts; attempt++) {
      const layout = tryLayout(rng, data, theme, size, boss, floorRng(seed, floorNumber, 'rooms'));
      if (layout) return buildFloor(layout, theme.id, size, nextId, rng);
    }
  }
}

// F001 규칙 4: 방끼리 겹치지 않고 사이에 벽이 최소 1칸
export function roomsTouch(a: Rect, b: Rect): boolean {
  return a.x - 1 < b.x + b.w && b.x < a.x + a.w + 1 && a.y - 1 < b.y + b.h && b.y < a.y + a.h + 1;
}

function randomRect(rng: Rng, size: { width: number; height: number }, minSize: number, maxSize: number): Rect | null {
  const w = nextInt(rng, minSize, maxSize);
  const h = nextInt(rng, minSize, maxSize);
  // 지도 테두리는 벽으로 남긴다
  const maxX = size.width - 1 - w;
  const maxY = size.height - 1 - h;
  if (maxX < 1 || maxY < 1) return null;
  return { x: nextInt(rng, 1, maxX), y: nextInt(rng, 1, maxY), w, h };
}

function tryLayout(
  rng: Rng,
  data: GameData,
  theme: ThemeDef,
  size: { width: number; height: number },
  boss: boolean,
  roomsRng: Rng,
): Layout | null {
  const { roomPlacementTries } = data.dungeon;
  // F011 규칙 6: 테마에 방 설정이 있으면 dungeon.json 대신 쓴다
  const rooms = theme.rooms ?? data.dungeon.rooms;
  const bossRoom = theme.bossRoom ?? data.dungeon.bossRoom;
  const extraCorridors = theme.extraCorridors ?? data.dungeon.extraCorridors;
  const target = nextInt(rng, rooms.minCount, rooms.maxCount);
  const rects: Rect[] = [];

  // F001 규칙 8: 보스층은 보스방을 먼저 놓는다
  if (boss) {
    for (let i = 0; i < roomPlacementTries && rects.length === 0; i++) {
      const rect = randomRect(rng, size, bossRoom.minSize, bossRoom.maxSize);
      if (rect) rects.push(rect);
    }
    if (rects.length === 0) return null;
  }

  // F001 규칙 3, 4: 방 배치
  for (let i = 0; i < roomPlacementTries && rects.length < target; i++) {
    const rect = randomRect(rng, size, rooms.minSize, rooms.maxSize);
    if (rect && !rects.some((r) => roomsTouch(r, rect))) rects.push(rect);
  }
  if (rects.length < rooms.minCount) return null;

  // F001 규칙 7, 8: 시작 지점과 계단(또는 보스방)은 서로 다른 방
  const bossIndex = boss ? 0 : null;
  const roomIndexes = rects.map((_, i) => i);
  const startIndex = pick(rng, roomIndexes.filter((i) => i !== bossIndex));
  const stairsIndex = boss ? null : pick(rng, roomIndexes.filter((i) => i !== startIndex));

  // F009: 통로를 내기 전에 방 종류를 정한다 (비밀방은 통로로 잇지 않는다)
  const fixed = new Map<number, string>([[startIndex, 'start']]);
  if (bossIndex !== null) fixed.set(bossIndex, 'boss');
  if (stairsIndex !== null) fixed.set(stairsIndex, 'stairs');
  const types = assignRoomTypes(rects, fixed, data, theme, roomsRng);

  const connected = roomIndexes.filter((i) => types[i] !== SECRET_ROOM_TYPE);
  const links = connectRooms(rng, rects, connected, nextInt(rng, extraCorridors[0], extraCorridors[1]));
  // 통로가 비밀방에 닿으면 비밀방이 일반방이 되므로, 닿지 않는 쪽으로 꺾는 경로를 먼저 고른다
  const secretRects = rects.filter((_, i) => types[i] === SECRET_ROOM_TYPE);
  const touchesSecret = (path: Point[]) =>
    path.some((p) => secretRects.some((r) => p.x >= r.x - 1 && p.x <= r.x + r.w && p.y >= r.y - 1 && p.y <= r.y + r.h));
  const corridors = links.map(([a, b]) => {
    const from = centerOf(rects[a]);
    const to = centerOf(rects[b]);
    const path = corridorPath(rng, from, to);
    if (!touchesSecret(path)) return path;
    const other = lShape(from, to, path[1]?.x === from.x);
    return touchesSecret(other) ? path : other;
  });
  return {
    rects,
    types,
    corridors,
    links,
    start: randomPointIn(rng, rects[startIndex]),
    stairs: stairsIndex === null ? null : randomPointIn(rng, rects[stairsIndex]),
  };
}

const distance = (a: Rect, b: Rect) => {
  const ca = centerOf(a);
  const cb = centerOf(b);
  return Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y);
};

// 가장 가까운 방. 거리가 같으면 인덱스가 작은 쪽
function nearest(rects: Rect[], from: number, candidates: number[]): number | null {
  let best: number | null = null;
  for (const c of candidates) {
    if (best === null || distance(rects[from], rects[c]) < distance(rects[from], rects[best])) best = c;
  }
  return best;
}

// F001 규칙 5-1: 이어진 방 무리에 무작위 방을 하나씩, 무리 중 가장 가까운 방과 잇는다.
// 그래서 한쪽 방향이 아니라 여러 방향으로 갈라진다. 그다음 고리를 만드는 통로를 extra개 더한다.
function connectRooms(rng: Rng, rects: Rect[], indexes: number[], extra: number): [number, number][] {
  const links: [number, number][] = [];
  const linked = (a: number, b: number) => links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const connected = [pick(rng, indexes)];
  let remaining = indexes.filter((i) => i !== connected[0]);
  while (remaining.length > 0) {
    const room = pick(rng, remaining);
    links.push([nearest(rects, room, connected)!, room]);
    connected.push(room);
    remaining = remaining.filter((i) => i !== room);
  }
  for (let i = 0; i < extra; i++) {
    const room = pick(rng, indexes);
    const other = nearest(rects, room, indexes.filter((j) => j !== room && !linked(room, j)));
    if (other !== null) links.push([room, other]);
  }
  return links;
}

function centerOf(r: Rect): Point {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

function randomPointIn(rng: Rng, r: Rect): Point {
  return { x: nextInt(rng, r.x, r.x + r.w - 1), y: nextInt(rng, r.y, r.y + r.h - 1) };
}

// 가로 먼저 또는 세로 먼저 한 번 꺾이는 통로
function corridorPath(rng: Rng, from: Point, to: Point): Point[] {
  return lShape(from, to, nextInt(rng, 0, 1) === 0);
}

function lShape(from: Point, to: Point, horizontalFirst: boolean): Point[] {
  const corner = horizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  return [...straightLine(from, corner), ...straightLine(corner, to)];
}

function straightLine(from: Point, to: Point): Point[] {
  const points: Point[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  for (let p = { ...from }; ; p = { x: p.x + dx, y: p.y + dy }) {
    points.push(p);
    if (p.x === to.x && p.y === to.y) return points;
  }
}

function buildFloor(
  layout: Layout,
  themeId: string,
  size: { width: number; height: number },
  firstId: number,
  rng: Rng,
): GeneratedFloor {
  let nextId = firstId;
  const cells = size.width * size.height;
  const floor: FloorState = {
    themeId,
    width: size.width,
    height: size.height,
    tiles: new Array(cells).fill('wall'),
    explored: new Array(cells).fill(false),
    visible: new Array(cells).fill(false),
    rooms: [],
    objects: [],
    actors: [],
    items: [],
  };
  const carve = (p: Point) => (floor.tiles[tileIndex(floor, p.x, p.y)] = 'floor');
  const { rects, types, links } = layout;
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve({ x, y });
  }
  for (const path of layout.corridors) path.forEach(carve);

  // F009 규칙 8, 9: 비밀방 입구. 통로가 닿아 버렸거나 입구를 낼 수 없으면 일반방으로 바꾸어 보통 통로로 잇는다
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

  rects.forEach((r, i) => floor.rooms.push({ id: nextId++, ...r, type: types[i], state: {} }));
  if (layout.stairs) {
    const stairs: MapObject = { id: nextId++, type: STAIRS_OBJECT_TYPE, ...layout.stairs, blocksMove: false, blocksSight: false, state: {} };
    floor.objects.push(stairs);
  }
  return { floor, start: layout.start, nextId, links };
}

const isWall = (floor: FloorState, p: Point) =>
  p.x > 0 && p.y > 0 && p.x < floor.width - 1 && p.y < floor.height - 1 && floor.tiles[tileIndex(floor, p.x, p.y)] === 'wall';
const isFloorTile = (floor: FloorState, p: Point) =>
  p.x >= 0 && p.y >= 0 && p.x < floor.width && p.y < floor.height && floor.tiles[tileIndex(floor, p.x, p.y)] === 'floor';
const inRect = (r: Rect, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
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
        if (!inRect(r, n) && isFloorTile(floor, n)) return false;
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
        if (inRect(room, wall) || !isWall(floor, wall)) continue;
        for (const length of DEAD_END_LENGTHS) {
          const corridor = Array.from({ length }, (_, k) => add(wall, d, k + 1));
          const end = add(wall, d, length + 1);
          const line = [wall, ...corridor];
          if (!line.every((p) => isWall(floor, p) && isWall(floor, add(p, side)) && isWall(floor, add(p, side, -1)))) continue;
          if (!isFloorTile(floor, end) || secretRects.some((r) => inRect(r, end))) continue;
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
      if (isFloorTile(floor, { x, y }) && !secretRects.some((r) => inRect(r, { x, y }))) {
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
  const touchesRoom = (p: Point) => OUTWARD.some(({ d }) => inRect(room, add(p, d)));
  const options: { wall: Point; tip: Point; target: Point; cost: number }[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      for (const { d, side } of OUTWARD) {
        const wall = add({ x, y }, d);
        const tip = add(wall, d);
        if (inRect(room, wall) || !isWall(floor, wall) || !isWall(floor, add(wall, side)) || !isWall(floor, add(wall, side, -1))) continue;
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
    if (path.some((p, k) => (k > 0 && touchesRoom(p)) || inRect(room, p) || (k > 0 && Math.abs(p.x - wall.x) + Math.abs(p.y - wall.y) <= 1))) continue;
    // 끝(tip)은 막다른 칸이어야 한다: 숨은 벽 말고 맞닿는 바닥은 다음 통로 칸 하나뿐
    const carved = new Set(path.map((p) => `${p.x},${p.y}`));
    const neighbors = OUTWARD.map(({ d }) => add(tip, d)).filter((n) => !(n.x === wall.x && n.y === wall.y) && (carved.has(`${n.x},${n.y}`) || isFloorTile(floor, n)));
    if (neighbors.length !== 1) continue;
    return { wall, corridor: path };
  }
  return null;
}

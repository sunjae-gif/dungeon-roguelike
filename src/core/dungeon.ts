// F001 던전 생성 (기본 지형): 방과 통로, 시작 지점, 계단 또는 보스방
import { themeForFloor } from '../data/query';
import type { GameData } from '../data/types';
import { floorRng, nextInt, pick, type Rng } from './rng';
import { tileIndex, type FloorState, type MapObject, type Room } from './state';

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

// 방 종류(F009)가 붙기 전의 기본값. rooms.json의 id
const DEFAULT_ROOM_TYPE = 'normal';
export const STAIRS_OBJECT_TYPE = 'stairs';

interface Layout {
  rects: Rect[];
  corridors: Point[][];
  links: [number, number][];
  bossIndex: number | null;
  startIndex: number;
  stairsIndex: number | null;
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
      const layout = tryLayout(rng, data, size, boss);
      if (layout) return buildFloor(layout, theme.id, size, nextId);
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

function tryLayout(rng: Rng, data: GameData, size: { width: number; height: number }, boss: boolean): Layout | null {
  const { rooms, bossRoom, roomPlacementTries, extraCorridors } = data.dungeon;
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

  const links = connectRooms(rng, rects, nextInt(rng, extraCorridors[0], extraCorridors[1]));
  const corridors = links.map(([a, b]) => corridorPath(rng, centerOf(rects[a]), centerOf(rects[b])));

  // F001 규칙 7, 8: 시작 지점과 계단(또는 보스방)은 서로 다른 방
  const bossIndex = boss ? 0 : null;
  const roomIndexes = rects.map((_, i) => i);
  const startIndex = pick(rng, roomIndexes.filter((i) => i !== bossIndex));
  const stairsIndex = boss ? null : pick(rng, roomIndexes.filter((i) => i !== startIndex));
  return {
    rects,
    corridors,
    links,
    bossIndex,
    startIndex,
    stairsIndex,
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
function connectRooms(rng: Rng, rects: Rect[], extra: number): [number, number][] {
  const links: [number, number][] = [];
  const linked = (a: number, b: number) => links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const indexes = rects.map((_, i) => i);
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
  const horizontalFirst = nextInt(rng, 0, 1) === 0;
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

function buildFloor(layout: Layout, themeId: string, size: { width: number; height: number }, firstId: number): GeneratedFloor {
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

  layout.rects.forEach((r, i) => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) floor.tiles[tileIndex(floor, x, y)] = 'floor';
    }
    const room: Room = { id: nextId++, ...r, type: roomTypeOf(layout, i), state: {} };
    floor.rooms.push(room);
  });
  for (const path of layout.corridors) {
    for (const p of path) floor.tiles[tileIndex(floor, p.x, p.y)] = 'floor';
  }
  if (layout.stairs) {
    const stairs: MapObject = {
      id: nextId++,
      type: STAIRS_OBJECT_TYPE,
      ...layout.stairs,
      blocksMove: false,
      blocksSight: false,
      state: {},
    };
    floor.objects.push(stairs);
  }
  return { floor, start: layout.start, nextId, links: layout.links };
}

function roomTypeOf(layout: Layout, index: number): string {
  if (index === layout.bossIndex) return 'boss';
  if (index === layout.startIndex) return 'start';
  if (index === layout.stairsIndex) return 'stairs';
  return DEFAULT_ROOM_TYPE;
}

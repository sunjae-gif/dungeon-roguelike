// F001 던전 생성 (기본 지형): 방과 통로, 시작 지점, 계단 또는 보스방
import { themeForFloor } from '../data/query';
import type { GameData, ThemeDef } from '../data/types';
import { floorRng, nextInt, pick, type Rng } from './rng';
import { centerOf, corridorPath, lShape, nearest, type Rect } from './corridors';
import { assignRoomTypes, SECRET_ROOM_TYPE } from './roomTypes';
import { carveSecretEntrances } from './secretRooms';
import { tileIndex, type FloorState, type MapObject } from './state';

export interface Point {
  x: number;
  y: number;
}

export interface GeneratedFloor {
  floor: FloorState;
  start: Point;
  nextId: number;
  // 통로로 이어진 방 쌍 (floor.rooms의 인덱스). 상태에는 넣지 않는다.
  links: [number, number][];
}

export const STAIRS_OBJECT_TYPE = 'stairs';

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

function randomPointIn(rng: Rng, r: Rect): Point {
  return { x: nextInt(rng, r.x, r.x + r.w - 1), y: nextInt(rng, r.y, r.y + r.h - 1) };
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

  // F009 규칙 8, 9: 비밀방 입구 (안 되면 일반방으로 바꾸어 보통 통로로 잇는다)
  nextId = carveSecretEntrances(floor, rects, types, links, rng, nextId);

  rects.forEach((r, i) => floor.rooms.push({ id: nextId++, ...r, type: types[i], state: {} }));
  if (layout.stairs) {
    const stairs: MapObject = { id: nextId++, type: STAIRS_OBJECT_TYPE, ...layout.stairs, blocksMove: false, blocksSight: false, state: {} };
    floor.objects.push(stairs);
  }
  return { floor, start: layout.start, nextId, links };
}


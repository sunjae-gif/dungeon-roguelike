// 방 안팎 칸 계산. 문(F010)·함정(F010)·매복 배치(F014)·퍼즐(F009)이 같이 쓴다
import type { Point } from './dungeon';
import { tileIndex, type FloorState, type Room } from './state';

export const AROUND = (p: Point): Point[] => [
  { x: p.x, y: p.y - 1 },
  { x: p.x + 1, y: p.y },
  { x: p.x, y: p.y + 1 },
  { x: p.x - 1, y: p.y },
];

export const inRoom = (r: Room, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
export const pointKey = (p: Point) => `${p.x},${p.y}`;

const isFloor = (floor: FloorState, p: Point) =>
  p.x >= 0 && p.y >= 0 && p.x < floor.width && p.y < floor.height && floor.tiles[tileIndex(floor, p.x, p.y)] === 'floor';

export function roomTiles(floor: FloorState, room: Room): Point[] {
  const tiles: Point[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) if (isFloor(floor, { x, y })) tiles.push({ x, y });
  }
  return tiles;
}

// 방 입구 칸: 방 바깥 바닥과 상하좌우로 맞닿은 방 안 칸
export function roomEntrances(floor: FloorState, room: Room): Point[] {
  return roomTiles(floor, room).filter((p) => AROUND(p).some((n) => !inRoom(room, n) && isFloor(floor, n)));
}

// 방 바로 바깥의 바닥 칸 (통로가 방에 닿는 칸)
export function outsideEntrances(floor: FloorState, room: Room): Point[] {
  const seen = new Set<string>();
  const result: Point[] = [];
  for (const e of roomEntrances(floor, room)) {
    for (const n of AROUND(e)) {
      if (inRoom(room, n) || !isFloor(floor, n) || seen.has(pointKey(n))) continue;
      seen.add(pointKey(n));
      result.push(n);
    }
  }
  return result;
}

export function roomAt(floor: FloorState, p: Point): Room | undefined {
  return floor.rooms.find((r) => inRoom(r, p));
}

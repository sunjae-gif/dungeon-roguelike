// F001 던전 생성 (기본 지형)
import { describe, expect, it } from 'vitest';
import { generateFloor, roomsTouch, STAIRS_OBJECT_TYPE, type GeneratedFloor, type Point } from '../src/core/dungeon';
import { tileIndex, type FloorState } from '../src/core/state';
import { gameData } from './helpers';

const data = gameData();
const SEED_COUNT = 1000;
const { maxFloor } = data.dungeon;

// 시작 지점에서 4방향으로 닿는 바닥 칸
function reachable(floor: FloorState, start: Point): Set<number> {
  const seen = new Set([tileIndex(floor, start.x, start.y)]);
  const queue = [start];
  while (queue.length > 0) {
    const p = queue.pop()!;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) continue;
      const i = tileIndex(floor, x, y);
      if (floor.tiles[i] !== 'floor' || seen.has(i)) continue;
      seen.add(i);
      queue.push({ x, y });
    }
  }
  return seen;
}

const roomAt = (floor: FloorState, p: Point) =>
  floor.rooms.find((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);

// F011 규칙 6: 테마에 방 설정이 있으면 그것을 쓴다
const settingsFor = (themeId: string) => {
  const theme = data.themes.find((t) => t.id === themeId)!;
  return { rooms: theme.rooms ?? data.dungeon.rooms, bossRoom: theme.bossRoom ?? data.dungeon.bossRoom };
};

function checkCommon(g: GeneratedFloor): Set<number> {
  const { floor, start } = g;
  // 방 개수가 설정 범위 안 (보스방 포함)
  const { rooms } = settingsFor(floor.themeId);
  expect(floor.rooms.length).toBeGreaterThanOrEqual(rooms.minCount);
  expect(floor.rooms.length).toBeLessThanOrEqual(rooms.maxCount);
  // 방끼리 겹치거나 맞닿지 않는다
  for (let i = 0; i < floor.rooms.length; i++) {
    for (let j = i + 1; j < floor.rooms.length; j++) {
      expect(roomsTouch(floor.rooms[i], floor.rooms[j])).toBe(false);
    }
  }
  // 모든 바닥 칸이 시작 지점에서 닿는다
  const reach = reachable(floor, start);
  const floorCount = floor.tiles.filter((t) => t === 'floor').length;
  expect(reach.size).toBe(floorCount);
  // 지도 테두리는 벽
  for (let x = 0; x < floor.width; x++) {
    expect(floor.tiles[tileIndex(floor, x, 0)]).toBe('wall');
    expect(floor.tiles[tileIndex(floor, x, floor.height - 1)]).toBe('wall');
  }
  return reach;
}

describe('F001 던전 생성', () => {
  it('같은 시드로 두 번 생성한 지도가 칸 단위로 같다', () => {
    for (let floor = 1; floor <= maxFloor; floor++) {
      expect(generateFloor(data, 42, floor, 1)).toEqual(generateFloor(data, 42, floor, 1));
    }
    expect(generateFloor(data, 42, 1, 1).floor.tiles).not.toEqual(generateFloor(data, 43, 1, 1).floor.tiles);
  });

  it('지도 크기는 그 층 테마의 mapWidth, mapHeight', () => {
    for (const theme of data.themes) {
      const { floor } = generateFloor(data, 1, theme.floors[0], 1);
      expect([floor.width, floor.height, floor.themeId]).toEqual([theme.mapWidth, theme.mapHeight, theme.id]);
      expect(floor.tiles.length).toBe(theme.mapWidth * theme.mapHeight);
    }
  });

  it(`시드 ${SEED_COUNT}개로 1~${maxFloor - 1}층: 계단 1개, 시작과 다른 방, 4방향 경로, 모든 바닥 연결`, () => {
    for (let seed = 0; seed < SEED_COUNT; seed++) {
      for (let floorNumber = 1; floorNumber < maxFloor; floorNumber++) {
        const g = generateFloor(data, seed, floorNumber, 1);
        const reach = checkCommon(g);
        const stairs = g.floor.objects.filter((o) => o.type === STAIRS_OBJECT_TYPE);
        expect(stairs.length).toBe(1);
        expect(reach.has(tileIndex(g.floor, stairs[0].x, stairs[0].y))).toBe(true);
        expect(roomAt(g.floor, stairs[0])).not.toBe(roomAt(g.floor, g.start));
        expect(g.floor.rooms.some((r) => r.type === 'boss')).toBe(false);
      }
    }
  });

  it(`시드 ${SEED_COUNT}개로 ${maxFloor}층: 계단 없음, 보스방 1개, 시작과 다른 방, 4방향 경로`, () => {
    for (let seed = 0; seed < SEED_COUNT; seed++) {
      const g = generateFloor(data, seed, maxFloor, 1);
      const reach = checkCommon(g);
      expect(g.floor.objects.some((o) => o.type === STAIRS_OBJECT_TYPE)).toBe(false);
      const bossRooms = g.floor.rooms.filter((r) => r.type === 'boss');
      expect(bossRooms.length).toBe(1);
      const boss = bossRooms[0];
      const { bossRoom } = settingsFor(g.floor.themeId);
      expect(boss.w).toBeGreaterThanOrEqual(bossRoom.minSize);
      expect(boss.w).toBeLessThanOrEqual(bossRoom.maxSize);
      expect(roomAt(g.floor, g.start)).not.toBe(boss);
      expect(reach.has(tileIndex(g.floor, boss.x, boss.y))).toBe(true);
    }
  });

  it(`시드 ${SEED_COUNT}개로 생성했을 때 고리가 있는 지도가 있고, 여러 방향으로 갈라진다`, () => {
    const [extraMin] = data.dungeon.extraCorridors;
    let withLoop = 0;
    let branching = 0;
    for (let seed = 0; seed < SEED_COUNT; seed++) {
      const g = generateFloor(data, seed, 1, 1);
      // 모든 방을 잇는 통로(방 수 - 1) + 고리 통로
      expect(g.links.length).toBeGreaterThanOrEqual(g.floor.rooms.length - 1);
      expect(g.links.length).toBeLessThanOrEqual(g.floor.rooms.length - 1 + data.dungeon.extraCorridors[1]);
      if (g.links.length >= g.floor.rooms.length - 1 + Math.max(extraMin, 1)) withLoop++;
      // 통로가 3개 이상 붙은 방이 있으면 한 줄이 아니라 갈라진 모양
      const degree = new Map<number, number>();
      for (const [a, b] of g.links) for (const r of [a, b]) degree.set(r, (degree.get(r) ?? 0) + 1);
      if ([...degree.values()].some((d) => d >= 3)) branching++;
    }
    expect(withLoop).toBeGreaterThan(0);
    expect(branching).toBeGreaterThan(SEED_COUNT / 2);
  });

  it('방 목록에 위치·크기·종류가 있고 id는 겹치지 않는다', () => {
    const g = generateFloor(data, 7, 1, 100);
    const ids = [...g.floor.rooms.map((r) => r.id), ...g.floor.objects.map((o) => o.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids)).toBe(100);
    expect(g.nextId).toBe(100 + ids.length);
    expect(g.floor.rooms.filter((r) => r.type === 'start').length).toBe(1);
    expect(g.floor.rooms.filter((r) => r.type === 'stairs').length).toBe(1);
  });
});

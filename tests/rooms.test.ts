// F009 방 종류 (가중치, 보물상자방, 비밀방, 샘방)
import { describe, expect, it } from 'vitest';
import { generateFloor } from '../src/core/dungeon';
import { HIDDEN_WALL_OBJECT_TYPE } from '../src/core/secretRooms';
import { getStat } from '../src/core/effects';
import { CHEST_OBJECT_TYPE } from '../src/core/items';
import { placeRoomFeatures, SPRING_OBJECT_TYPE } from '../src/core/roomFeatures';
import { inRoom } from '../src/core/rooms';
import { tileIndex, type FloorState, type MapObject, type RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { objectSprite } from '../src/render/view';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const SEEDS = 1000;
const OPTIONAL = ['secret', 'puzzle', 'spring'];
const count = (floor: FloorState, type: string) => floor.rooms.filter((r) => r.type === type).length;
const rest = (s: RunState) => playTurn(s, { type: 'rest' }, data);
const go = (s: RunState, direction: 'up' | 'down' | 'left' | 'right') => playTurn(s, { type: 'direction', direction }, data);

// 막다른 통로: 방 밖의 바닥 칸 중 (숨은 벽을 벽으로 볼 때) 상하좌우 바닥 이웃이 1개뿐인 칸
function deadEnds(floor: FloorState): { x: number; y: number }[] {
  const hidden = new Set(floor.objects.filter((o) => o.type === HIDDEN_WALL_OBJECT_TYPE).map((o) => tileIndex(floor, o.x, o.y)));
  const open = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < floor.width && y < floor.height && floor.tiles[tileIndex(floor, x, y)] === 'floor' && !hidden.has(tileIndex(floor, x, y));
  const result = [];
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (!open(x, y) || floor.rooms.some((r) => inRoom(r, { x, y }))) continue;
      const n = [open(x, y - 1), open(x + 1, y), open(x, y + 1), open(x - 1, y)].filter(Boolean).length;
      if (n <= 1) result.push({ x, y });
    }
  }
  return result;
}

describe('F009 방 종류 정하기', () => {
  it('모든 층에 start 1개, 1~9층에 stairs 1개, 10층에 boss 1개', () => {
    for (let seed = 0; seed < 100; seed++) {
      for (let f = 1; f <= data.dungeon.maxFloor; f++) {
        const { floor } = generateFloor(data, seed, f, 1);
        expect(count(floor, 'start')).toBe(1);
        expect(count(floor, f === data.dungeon.maxFloor ? 'boss' : 'stairs')).toBe(1);
      }
    }
  });

  it(`시드 ${SEEDS}개로 1~9층: 보물상자방 1~2개, 비밀방·퍼즐방·샘방 0~1개. 10층에는 이 넷이 없다`, () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const f = 1 + (seed % 9);
      const { floor } = generateFloor(data, seed, f, 1);
      expect(count(floor, 'treasure')).toBeGreaterThanOrEqual(1);
      expect(count(floor, 'treasure')).toBeLessThanOrEqual(2);
      for (const t of OPTIONAL) expect(count(floor, t)).toBeLessThanOrEqual(1);
      const boss = generateFloor(data, seed, data.dungeon.maxFloor, 1).floor;
      for (const t of ['treasure', ...OPTIONAL]) expect(count(boss, t)).toBe(0);
    }
  });

  it(`시드 ${SEEDS}개로 생성했을 때 방 종류 비율이 테마 가중치와 ±5%p 안 (최소 개수 보정 제외)`, () => {
    const theme = data.themes.find((t) => t.id === 'theme_3')!;
    const counts: Record<string, number> = {};
    let total = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      const { floor } = generateFloor(data, seed, theme.floors[seed % 3], 1);
      for (const r of floor.rooms) {
        if (['start', 'stairs', 'boss'].includes(r.type)) continue;
        counts[r.type] = (counts[r.type] ?? 0) + 1;
        total++;
      }
    }
    const weights = theme.roomWeights;
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    // 보물상자방은 최소 개수(1)로 채우는 종류라 비율 비교에서 뺀다 (완료 기준 "최소 개수 보정 제외")
    for (const t of ['secret', 'spring']) {
      expect(Math.abs((counts[t] ?? 0) / total - weights[t] / sum), t).toBeLessThan(0.05);
    }
  });
});

describe('F009 비밀방', () => {
  it('비밀방이 있는 층에서 막다른 통로는 그 입구 하나뿐이고, 비밀방이 없는 층에는 막다른 통로가 없다', () => {
    let withSecret = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      const { floor } = generateFloor(data, seed, 1 + (seed % 9), 1);
      const ends = deadEnds(floor);
      const hidden = floor.objects.filter((o) => o.type === HIDDEN_WALL_OBJECT_TYPE);
      if (count(floor, 'secret') === 0) {
        expect(ends, `seed ${seed}`).toEqual([]);
        expect(hidden).toEqual([]);
        continue;
      }
      withSecret++;
      expect(hidden.length).toBe(1);
      expect(ends.length, `seed ${seed}`).toBe(1);
      expect(Math.abs(ends[0].x - hidden[0].x) + Math.abs(ends[0].y - hidden[0].y)).toBe(1);
    }
    expect(withSecret).toBeGreaterThan(50);
  });

  it('비밀방 바닥은 숨은 벽을 찾기 전에는 시작 지점에서 갈 수 없다 (몬스터 길 찾기도 마찬가지)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const g = generateFloor(data, seed, 1 + (seed % 9), 1);
      const room = g.floor.rooms.find((r) => r.type === 'secret');
      if (!room) continue;
      const { floor, start } = g;
      const blocked = (x: number, y: number) =>
        floor.tiles[tileIndex(floor, x, y)] !== 'floor' || floor.objects.some((o) => o.x === x && o.y === y && o.blocksMove);
      const seen = new Set([tileIndex(floor, start.x, start.y)]);
      const queue = [start];
      for (let h = 0; h < queue.length; h++) {
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const x = queue[h].x + dx;
          const y = queue[h].y + dy;
          if (blocked(x, y) || seen.has(tileIndex(floor, x, y))) continue;
          seen.add(tileIndex(floor, x, y));
          queue.push({ x, y });
        }
      }
      expect(seen.has(tileIndex(floor, room.x, room.y))).toBe(false);
    }
  });

  it('숨은 벽 옆에서 쉬면 그 벽이 통로가 되고 메시지가 남는다. 옆이 아닌 곳에서 쉬면 아무 일도 없다', () => {
    const s0 = stateFromMap(`
      #######
      #..@#.#
      #######`, data);
    const wall: MapObject = { id: 77, type: HIDDEN_WALL_OBJECT_TYPE, x: 4, y: 1, blocksMove: true, blocksSight: true, state: { discovered: false } };
    const s = { ...s0, floor: { ...s0.floor, tiles: s0.floor.tiles.map((t, i) => (i === 1 * 7 + 4 ? 'floor' as const : t)), objects: [wall] } };
    expect(objectSprite(s.floor.objects[0], data, s.floorNumber)).toBe(data.themes[0].tiles.wall);
    const far = { ...s, player: { ...s.player, x: 1 } };
    expect(rest(far).floor.objects[0].state.discovered).toBe(false);
    const found = rest(s);
    const w = found.floor.objects[0];
    expect([w.state.discovered, w.blocksMove, w.blocksSight]).toEqual([true, false, false]);
    expect(found.messageLog.at(-1)?.text).toBe('벽 틈으로 바람이 새어 나온다. 숨은 통로를 찾았다!');
    expect(go(found, 'right').player.x).toBe(4);
  });

  it('비밀방에는 상자가 있고, 열면 희귀 둘 중 하나', () => {
    for (let seed = 0; seed < 200; seed++) {
      const g = generateFloor(data, seed, 1 + (seed % 9), 1);
      const { floor } = placeRoomFeatures(g.floor, g.nextId);
      const room = floor.rooms.find((r) => r.type === 'secret');
      if (!room) continue;
      const chest = floor.objects.find((o) => o.type === CHEST_OBJECT_TYPE && inRoom(room, o))!;
      expect(chest.state.source).toBe('secret');
      // 상자 옆에 플레이어를 두고 연다
      const s0 = stateFromMap(`
        #####
        #@..#
        #####`, data);
      const s = { ...s0, floor: { ...s0.floor, objects: [{ ...chest, x: 2, y: 1 }] } };
      const opened = go(s, 'right');
      expect(opened.pendingChoice?.source).toBe('secret');
      expect(opened.pendingChoice?.options.length).toBe(data.loot.secretChoices);
      for (const id of opened.pendingChoice!.options) expect(data.items.find((it) => it.id === id)?.rarity).toBe('rare');
      return;
    }
    throw new Error('비밀방이 있는 층을 찾지 못했다');
  });
});

describe('F009 샘방', () => {
  const springAt = (s: RunState, x: number, y: number): RunState => ({
    ...s,
    floor: { ...s.floor, objects: [...s.floor.objects, { id: 88, type: SPRING_OBJECT_TYPE, x, y, blocksMove: true, blocksSight: false, state: { used: false } }] },
  });
  const BASE = `
    #####
    #@..#
    #####`;

  it('샘을 마시면 HP가 최대의 50% 회복되고 샘이 마른다. HP가 가득일 때는 마시지 않고 턴도 안 쓴다', () => {
    const s0 = springAt(stateFromMap(BASE, data), 2, 1);
    const max = getStat(s0.player, 'maxHp', data);
    const full = go(s0, 'right');
    expect(full.turn).toBe(s0.turn);
    expect(full.messageLog.at(-1)?.text).toBe('지금은 목이 마르지 않다.');
    const hurt = { ...s0, player: { ...s0.player, hp: 5 } };
    const drank = go(hurt, 'right');
    expect(drank.player.hp).toBe(5 + Math.floor(max * data.loot.springHealRatio));
    expect(drank.turn).toBe(hurt.turn + 1);
    expect(drank.messageLog.map((m) => m.text)).toContain(`샘물을 마셨다. (HP +${Math.floor(max * 0.5)})`);
    const spring = drank.floor.objects.find((o) => o.type === SPRING_OBJECT_TYPE)!;
    expect(spring.state.used).toBe(true);
    expect(objectSprite(spring, data, drank.floorNumber)).toBe('spring_used');
    const again = go({ ...drank, player: { ...drank.player, hp: 5 } }, 'right');
    expect(again.messageLog.at(-1)?.text).toBe('샘이 말라 있다.');
    expect(again.player.hp).toBe(5);
  });

  it('샘방에는 샘이 1개, 몬스터·함정이 없다', () => {
    let checked = 0;
    for (let seed = 0; seed < 300 && checked < 30; seed++) {
      const g = generateFloor(data, seed, 4 + (seed % 3), 1);
      const room = g.floor.rooms.find((r) => r.type === 'spring');
      if (!room) continue;
      const { floor } = placeRoomFeatures(g.floor, g.nextId);
      expect(floor.objects.filter((o) => o.type === SPRING_OBJECT_TYPE && inRoom(room, o)).length).toBe(1);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

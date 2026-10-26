// F004 몬스터
import { describe, expect, it } from 'vitest';
import { generateFloor } from '../src/core/dungeon';
import { firstStep, spawnMonsters } from '../src/core/monsters';
import { createRun, enterFloor } from '../src/core/run';
import type { RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { gameData, withItems } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const R = data.monsterSightRadius;
const rest = (s: RunState, d = data) => playTurn(s, { type: 'rest' }, d);
const monster = (s: RunState) => s.floor.actors[0];
const inRoom = (r: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }) =>
  p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

// 폭 넓은 빈 복도. @와 g 사이 거리를 정해서 만든다
function corridor(distance: number): string {
  const row = `#@${'.'.repeat(distance - 1)}g${'.'.repeat(3)}#`;
  const wall = '#'.repeat(row.length);
  const open = `#${'.'.repeat(row.length - 2)}#`;
  return [wall, open, row, open, wall].join('\n');
}

describe('F004 배치', () => {
  it('시작방·계단방·보스방 안과 통로에 몬스터가 없고, 수가 테마 범위 안이다', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const floorNumber of [1, 4, 7, data.dungeon.maxFloor]) {
        const g = generateFloor(data, seed, floorNumber, 1);
        const { floor } = spawnMonsters(g.floor, data, seed, floorNumber, g.nextId);
        const theme = data.themes.find((t) => t.floors.includes(floorNumber))!;
        expect(floor.actors.length).toBeGreaterThanOrEqual(theme.monsterCount[0]);
        expect(floor.actors.length).toBeLessThanOrEqual(theme.monsterCount[1]);
        for (const m of floor.actors) {
          expect(theme.monsterTypes).toContain(m.defId);
          const room = floor.rooms.find((r) => inRoom(r, m));
          expect(room, '통로에 놓임').toBeDefined();
          expect(['start', 'stairs', 'boss']).not.toContain(room!.type);
          expect(floor.objects.some((o) => o.x === m.x && o.y === m.y)).toBe(false);
        }
        const spots = new Set(floor.actors.map((m) => `${m.x},${m.y}`));
        expect(spots.size).toBe(floor.actors.length);
      }
    }
  });

  it('같은 runSeed면 같은 층의 몬스터 위치·종류가 같다 (그 전에 무엇을 했든)', () => {
    const a = enterFloor(createRun(data, 31, 'playing'), data, 3);
    const b = enterFloor(rest(rest(createRun(data, 31, 'playing'))), data, 3);
    const pick = (s: RunState) => s.floor.actors.map((m) => [m.defId, m.x, m.y]);
    expect(pick(b)).toEqual(pick(a));
    expect(pick(a).length).toBeGreaterThan(0);
  });

  it('자리가 모자라면 놓을 수 있는 만큼만 놓는다', () => {
    const s = stateFromMap(`
      #####
      #@..#
      #####`, data);
    const floor = { ...s.floor, rooms: [{ id: 1, x: 1, y: 1, w: 3, h: 1, type: 'normal', state: {} }] };
    const { floor: spawned } = spawnMonsters(floor, data, 1, 1, 100);
    expect(spawned.actors.length).toBeLessThanOrEqual(3);
  });
});

describe('F004 시야', () => {
  it(`monsterSightRadius ${R}일 때 거리 ${R}인 몬스터는 플레이어를 보고 ${R + 1}인 몬스터는 보지 못한다`, () => {
    expect(R).toBe(7);
    const near = stateFromMap(corridor(R), data);
    expect(monster(rest(near)).x).toBe(monster(near).x - 1);
    const far = stateFromMap(corridor(R + 1), data);
    const after = rest(far);
    expect([monster(after).x, monster(after).y]).toEqual([monster(far).x, monster(far).y]);
    expect(monster(after).ai?.lastSeenPlayer).toBeUndefined();
  });

  it('플레이어 시야를 +3 하는 아이템이 있어도 몬스터가 플레이어를 보는 거리는 그대로다', () => {
    const d = withItems({ id: 't_eye', modifiers: [{ stat: 'sightRadius', op: 'add', value: 3 }] });
    const far = stateFromMap(corridor(R + 1), d);
    const s = { ...far, player: { ...far.player, buildItems: ['t_eye'] } };
    expect(monster(rest(s, d)).x).toBe(monster(s).x);
  });

  it('벽 뒤에 있는 몬스터는 거리 안이어도 플레이어를 보지 못하고 움직이지 않는다', () => {
    const s = stateFromMap(`
      #########
      #@..#.g.#
      #########`, data);
    const after = rest(s);
    expect([monster(after).x, monster(after).y]).toEqual([monster(s).x, monster(s).y]);
  });
});

describe('F004 행동 (chase)', () => {
  it('lastSeenPlayer가 플레이어 칸인 몬스터는 벽을 돌아가는 최단 경로를 따른다. 첫 걸음은 아래(4, 2)', () => {
    const s = stateFromMap(`
      #######
      #@.#g.#
      ##.#.##
      #.....#
      #######`, data);
    const g = monster(s);
    expect(firstStep(s.floor, g, s.player)).toBe('down');
    const remembered = { ...s, floor: { ...s.floor, actors: [{ ...g, ai: { lastSeenPlayer: { x: 1, y: 1 } } }] } };
    const after = rest(remembered);
    expect([monster(after).x, monster(after).y]).toEqual([4, 2]);
  });

  it('플레이어를 본 몬스터는 매 턴 플레이어와의 거리가 줄거나 같다', () => {
    let s = stateFromMap(`
      #######
      #@....#
      #.....#
      #....g#
      #######`, data);
    s = { ...s, player: { ...s.player, hp: 999 } };
    let prev = Math.abs(monster(s).x - s.player.x) + Math.abs(monster(s).y - s.player.y);
    for (let i = 0; i < 12; i++) {
      s = rest(s);
      const d = Math.abs(monster(s).x - s.player.x) + Math.abs(monster(s).y - s.player.y);
      expect(d).toBeLessThanOrEqual(prev);
      prev = d;
    }
    expect(prev).toBe(1);
  });

  it('플레이어를 놓친 몬스터는 마지막으로 본 위치까지 가서 멈춘다', () => {
    // 플레이어는 벽 너머라 보이지 않는다. 몬스터는 (1,1)에서 마지막으로 봤다
    const s = stateFromMap(`
      ##############
      #............#
      #...g.....#@.#
      ##############`, data);
    let cur: RunState = { ...s, floor: { ...s.floor, actors: [{ ...monster(s), ai: { lastSeenPlayer: { x: 1, y: 1 } } }] } };
    for (let i = 0; i < 10; i++) cur = rest(cur);
    expect([monster(cur).x, monster(cur).y]).toEqual([1, 1]);
    expect(monster(cur).ai?.lastSeenPlayer).toBeUndefined();
  });

  it('플레이어를 못 본 몬스터는 위치가 변하지 않는다', () => {
    const s = stateFromMap(corridor(R + 3), data);
    let cur = s;
    for (let i = 0; i < 5; i++) cur = rest(cur);
    expect([monster(cur).x, monster(cur).y]).toEqual([monster(s).x, monster(s).y]);
  });

  it('대각선에 있는 플레이어를 공격하지 않는다', () => {
    const s = stateFromMap(`
      #####
      #@..#
      #.g.#
      #####`, data);
    const after = rest(s);
    expect(after.player.hp).toBe(s.player.hp);
    // 대신 상하좌우로 인접하도록 움직인다
    expect(Math.abs(monster(after).x - after.player.x) + Math.abs(monster(after).y - after.player.y)).toBe(1);
  });

  it('상하좌우로 인접하면 공격한다', () => {
    const s = stateFromMap(`
      #####
      #@g.#
      #####`, data);
    expect(rest(s).player.hp).toBeLessThan(s.player.hp);
  });

  it('두 몬스터가 같은 칸으로 가려 하면 id가 작은 쪽만 움직이고 다른 쪽은 기다린다', () => {
    // 위 고블린(2,1)은 아래로, 오른쪽 고블린(3,2)은 왼쪽으로: 둘 다 (2,2)로 가려 한다
    const s = stateFromMap(`
      #####
      #.g.#
      #@.g#
      #####`, data);
    const [first, second] = [...s.floor.actors].sort((a, b) => a.id - b.id);
    expect([first.x, first.y, second.x, second.y]).toEqual([2, 1, 3, 2]);
    const after = rest(s);
    const a1 = after.floor.actors.find((m) => m.id === first.id)!;
    const a2 = after.floor.actors.find((m) => m.id === second.id)!;
    expect([a1.x, a1.y]).toEqual([2, 2]);
    expect([a2.x, a2.y]).toEqual([3, 2]);
  });

  it('플레이어가 먼저 쓰러뜨린 몬스터는 같은 턴에 공격하지 않는다', () => {
    const s = stateFromMap(`
      #####
      #@r.#
      #####`, data);
    const weak = { ...s, floor: { ...s.floor, actors: [{ ...monster(s), hp: 1 }] } };
    const after = playTurn(weak, { type: 'direction', direction: 'right' }, data);
    expect(after.floor.actors).toEqual([]);
    expect(after.player.hp).toBe(s.player.hp);
  });

  it('무효 행동 뒤에는 턴 수와 몬스터 위치가 그대로다 (turn-order.md)', () => {
    const s = stateFromMap(`
      ######
      #@..g#
      ######`, data);
    expect(playTurn(s, { type: 'direction', direction: 'up' }, data)).toBe(s);
  });

  it('계단을 내려간 턴에는 이전 층 몬스터가 행동하지 않는다 (turn-order.md)', () => {
    const s = stateFromMap(`
      #####
      #@g.#
      #####`, data);
    const onStairs = { ...s, floor: { ...s.floor, objects: [{ id: 1, type: 'stairs', x: 1, y: 1, blocksMove: false, blocksSight: false, state: {} }] } };
    const down = playTurn(onStairs, { type: 'descend' }, data);
    expect(down.floorNumber).toBe(s.floorNumber + 1);
    expect(down.player.hp).toBe(s.player.hp);
  });
});

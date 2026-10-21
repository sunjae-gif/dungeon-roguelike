// F002 이동과 시야, turn-order.md (move, rest)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeVisible, updateSight } from '../src/core/movement';
import { tileIndex, type Direction, type RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { keyToCommand } from '../src/input/keys';
import { KeyRepeater, shouldStopRepeat } from '../src/input/repeat';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const move = (state: RunState, direction: Direction) => playTurn(state, { type: 'direction', direction }, data);
const visibleCount = (s: RunState) => s.floor.visible.filter(Boolean).length;
const isVisible = (s: RunState, x: number, y: number) => s.floor.visible[tileIndex(s.floor, x, y)];

const OPEN_ROOM = `
###########
#.........#
#.........#
#.........#
#.........#
#....@....#
#.........#
#.........#
#.........#
#.........#
###########`;

describe('F002 이동', () => {
  const start = stateFromMap(`
    #####
    #@..#
    #...#
    #####`, data);

  it('벽 방향 입력 시 위치와 턴 수가 변하지 않는다', () => {
    for (const dir of ['up', 'left'] as const) {
      const next = move(start, dir);
      expect(next).toBe(start);
    }
  });

  it('바닥 방향 입력 시 한 칸 이동하고 턴 수가 1 늘며 그 방향을 바라본다', () => {
    const next = move(start, 'right');
    expect([next.player.x, next.player.y, next.turn]).toEqual([2, 1, start.turn + 1]);
    expect(next.player.facing).toBe('right');
    const down = move(next, 'down');
    expect([down.player.x, down.player.y, down.turn, down.player.facing]).toEqual([2, 2, start.turn + 2, 'down']);
  });

  it('어떤 입력으로도 x, y가 한 턴에 동시에 바뀌지 않는다', () => {
    let state = stateFromMap(OPEN_ROOM, data);
    const dirs: Direction[] = ['up', 'right', 'down', 'left', 'up', 'up', 'left', 'down', 'right', 'right'];
    for (let i = 0; i < 200; i++) {
      const next = move(state, dirs[(i * 7) % dirs.length]);
      expect(Math.abs(next.player.x - state.player.x) + Math.abs(next.player.y - state.player.y)).toBeLessThanOrEqual(1);
      state = next;
    }
  });

  it('쉬기는 제자리에서 턴만 지나간다', () => {
    const next = playTurn(start, { type: 'rest' }, data);
    expect([next.player.x, next.player.y, next.turn]).toEqual([1, 1, start.turn + 1]);
  });

  it('playing이 아니면 입력해도 상태가 바뀌지 않는다', () => {
    for (const phase of ['title', 'floorIntro', 'gameOver', 'victory'] as const) {
      const state = { ...start, phase };
      expect(move(state, 'right')).toBe(state);
    }
  });

  it('키 배치: 방향키·WASD로 이동, Space로 쉬기', () => {
    expect(keyToCommand('playing', 'ArrowUp')).toEqual({ type: 'player', input: { type: 'direction', direction: 'up' } });
    expect(keyToCommand('playing', 'd')).toEqual({ type: 'player', input: { type: 'direction', direction: 'right' } });
    expect(keyToCommand('playing', 'S')).toEqual({ type: 'player', input: { type: 'direction', direction: 'down' } });
    expect(keyToCommand('playing', ' ')).toEqual({ type: 'player', input: { type: 'rest' } });
  });
});

describe('F002 시야', () => {
  it('막힌 곳 없는 빈 방에서 sightRadius 3이면 보이는 칸이 정확히 마름모 25칸', () => {
    const s = stateFromMap(OPEN_ROOM, data);
    const visible = computeVisible(s.floor, s.player, 3);
    expect(visible.filter(Boolean).length).toBe(25);
  });

  it('4방향 거리가 sightRadius + 1인 칸은 보이지 않는다', () => {
    const s = stateFromMap(OPEN_ROOM, data);
    const visible = computeVisible(s.floor, s.player, 3);
    const { x, y } = s.player;
    expect(visible[tileIndex(s.floor, x + 3, y)]).toBe(true);
    expect(visible[tileIndex(s.floor, x + 4, y)]).toBe(false);
    expect(visible[tileIndex(s.floor, x + 2, y + 2)]).toBe(false);
    expect(visible[tileIndex(s.floor, x + 2, y + 1)]).toBe(true);
  });

  it('벽 뒤 칸은 시야 반경 안이어도 보이지 않는다. 벽 자체는 보인다', () => {
    const s = updateSight(stateFromMap(`
      #########
      #@..#...#
      #########`, data), 8);
    expect(isVisible(s, 4, 1)).toBe(true);
    expect(isVisible(s, 5, 1)).toBe(false);
    expect(isVisible(s, 7, 1)).toBe(false);
  });

  it('본 적 있는 칸은 시야를 벗어나도 탐색됨으로 남는다', () => {
    const radius = data.player.sightRadius;
    const corridor = `#${'@'}${'.'.repeat(radius + 2)}#`;
    const wall = '#'.repeat(corridor.length);
    let s = updateSight(stateFromMap([wall, corridor, wall].join('\n'), data), radius);
    expect(s.floor.explored[tileIndex(s.floor, 1, 1)]).toBe(true);
    for (let i = 0; i < radius + 1; i++) s = move(s, 'right');
    expect(isVisible(s, 1, 1)).toBe(false);
    expect(s.floor.explored[tileIndex(s.floor, 1, 1)]).toBe(true);
    expect(visibleCount(s)).toBeGreaterThan(0);
  });

  it('턴이 끝나면 시야가 새 위치 기준으로 다시 계산된다', () => {
    const s = updateSight(stateFromMap(OPEN_ROOM, data), data.player.sightRadius);
    const next = move(s, 'left');
    const expected = computeVisible(next.floor, next.player, data.player.sightRadius);
    expect(next.floor.visible).toEqual(expected);
  });
});

describe('F002 키를 누르고 있을 때', () => {
  afterEach(() => vi.useRealTimers());
  const interval = data.ui.input.keyRepeatIntervalMs;

  function hold(initial: RunState, direction: Direction, ms: number) {
    vi.useFakeTimers();
    let state = initial;
    const repeater = new KeyRepeater(interval);
    repeater.press('KeyD', () => {
      const prev = state;
      state = move(state, direction);
      return !shouldStopRepeat(prev, state);
    });
    vi.advanceTimersByTime(ms);
    const result = state;
    repeater.release('KeyD');
    return result;
  }

  it(`키를 누르고 있으면 ${interval}ms마다 한 칸씩 이동한다`, () => {
    const s = stateFromMap(`
      ##############
      #@...........#
      ##############`, data);
    expect(hold(s, 'right', 0).player.x).toBe(2);
    expect(hold(s, 'right', interval - 1).player.x).toBe(2);
    expect(hold(s, 'right', interval * 3).player.x).toBe(5);
  });

  it('누르고 이동하다 벽에 막히면 반복이 멈추고, 그 뒤로는 입력을 넣지 않는다', () => {
    vi.useFakeTimers();
    let state = stateFromMap(`
      #####
      #@..#
      #####`, data);
    let fired = 0;
    const repeater = new KeyRepeater(interval);
    repeater.press('KeyD', () => {
      fired++;
      const prev = state;
      state = move(state, 'right');
      return !shouldStopRepeat(prev, state);
    });
    vi.advanceTimersByTime(interval * 10);
    expect(state.player.x).toBe(3);
    expect(fired).toBe(3); // 이동 2번 + 벽에 막힌 1번
  });

  it('누르고 이동하다 새 몬스터가 시야에 들어오면 반복이 멈춘다', () => {
    const radius = data.player.sightRadius;
    const corridor = `#@${'.'.repeat(radius + 4)}r#`;
    const wall = '#'.repeat(corridor.length);
    const s = updateSight(stateFromMap([wall, corridor, wall].join('\n'), data), radius);
    const ratX = corridor.indexOf('r');
    const result = hold(s, 'right', interval * 40);
    // 쥐가 시야 반경 안에 들어온 턴에 멈춘다
    expect(result.player.x).toBe(ratX - radius);
  });

  it('피해를 받으면 반복이 멈춘다', () => {
    const s = stateFromMap(OPEN_ROOM, data);
    const hurt = { ...s, turn: s.turn + 1, player: { ...s.player, hp: s.player.hp - 1 } };
    expect(shouldStopRepeat(s, hurt)).toBe(true);
    expect(shouldStopRepeat(s, { ...s, turn: s.turn + 1 })).toBe(false);
  });
});

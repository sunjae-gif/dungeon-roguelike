// F006 게임 종료와 재시작
import { describe, expect, it } from 'vitest';
import { getStat } from '../src/core/effects';
import { transition } from '../src/core/flow';
import { formatSeed } from '../src/core/rng';
import { createRun } from '../src/core/run';
import type { RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { gameOverLines } from '../src/render/view';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const nameOf = (id: string) => data.monsters.find((m) => m.id === id)!.name;
const rest = (s: RunState) => playTurn(s, { type: 'rest' }, data);

const VS_ORC = `
  #####
  #@o.#
  #####`;

describe('F006 게임 종료와 재시작', () => {
  it('HP가 0이 된 턴이 끝나면 phase가 gameOver이고, 이후 입력은 상태를 바꾸지 않는다', () => {
    const s = stateFromMap(VS_ORC, data);
    const over = rest({ ...s, player: { ...s.player, hp: 1 } });
    expect(over.phase).toBe('gameOver');
    expect(rest(over)).toBe(over);
  });

  it('게임 오버 화면에 도달 층, 처치 수, 턴 수, 시드, 사인이 나온다', () => {
    const s = stateFromMap(VS_ORC, data);
    const over = rest({ ...s, turn: 41, runStats: { ...s.runStats, kills: 7, floorsReached: 4 }, player: { ...s.player, hp: 1 } });
    const lines = gameOverLines(over, data).join('\n');
    expect(lines).toContain('4층');
    expect(lines).toContain('쓰러뜨린 몬스터  7');
    expect(lines).toContain(`턴 수  ${over.turn}`);
    expect(lines).toContain(formatSeed(over.runSeed));
    expect(lines).toContain(`${nameOf('orc')}에게 쓰러졌다`);
  });

  it('재시작하면 층 1, HP 최대, 아이템 없음, 새 runSeed', () => {
    const run = createRun(data, 5, 'playing');
    const over: RunState = {
      ...run,
      phase: 'gameOver',
      floorNumber: 6,
      player: { ...run.player, hp: 0, consumables: ['potion_heal'], buildItems: ['x'] },
      runStats: { ...run.runStats, kills: 3, killedBy: 'orc' },
    };
    const next = transition(over, { type: 'restart', seed: 999 }, data);
    expect(next.floorNumber).toBe(1);
    expect(next.player.hp).toBe(getStat(next.player, 'maxHp', data));
    expect([next.player.consumables, next.player.buildItems]).toEqual([[], []]);
    expect(next.runSeed).toBe(999);
    expect(next.runStats).toEqual({ kills: 0, floorsReached: 1, itemsFound: 0 });
  });

  it('일시 효과로 쓰러지면 "{원인}(으)로 쓰러졌다"', () => {
    const s = stateFromMap(VS_ORC, data);
    const over = { ...s, phase: 'gameOver' as const, runStats: { ...s.runStats, killedBy: 'poison' } };
    expect(gameOverLines(over, data).join('\n')).toContain('중독(으)로 쓰러졌다');
  });
});

// 30-systems/game-flow.md
import { describe, expect, it } from 'vitest';
import { createTitleState, transition, type FlowEvent } from '../src/core/flow';
import { createRun, enterFloor } from '../src/core/run';
import type { Phase, RunState } from '../src/core/state';
import { keyToCommand } from '../src/input/keys';
import { gameData } from './helpers';

const data = gameData();
const go = (state: RunState, event: FlowEvent) => transition(state, event, data);
const inPhase = (phase: Phase, floor = 1): RunState => ({ ...enterFloor(createRun(data, 1, phase), data, floor), phase });

describe('화면 흐름', () => {
  it('title → 새 게임 → floorIntro (1층, 받은 시드)', () => {
    const next = go(createTitleState(data), { type: 'newGame', seed: 0xabc });
    expect(next.phase).toBe('floorIntro');
    expect(next.floorNumber).toBe(1);
    expect(next.runSeed).toBe(0xabc);
  });

  it('floorIntro → playing', () => {
    expect(go(inPhase('floorIntro'), { type: 'introDone' }).phase).toBe('playing');
  });

  it('playing에서 내려가면 다음 층의 floorIntro', () => {
    const next = go(inPhase('playing', 3), { type: 'descend' });
    expect(next.phase).toBe('floorIntro');
    expect(next.floorNumber).toBe(4);
  });

  it('턴 끝에 HP ≤ 0이면 gameOver', () => {
    const state = inPhase('playing');
    const dead = { ...state, player: { ...state.player, hp: 0 } };
    expect(go(dead, { type: 'turnEnd' }).phase).toBe('gameOver');
    expect(go(state, { type: 'turnEnd' })).toBe(state);
  });

  it('보스가 있는 층에서 보스가 없으면 victory, 게임 오버가 우선', () => {
    const bossTheme = data.themes.find((t) => t.boss)!;
    const bossFloor = inPhase('playing', bossTheme.floors[0]);
    const boss = { ...bossFloor.player, id: 99, defId: bossTheme.boss! };
    const withBoss = { ...bossFloor, floor: { ...bossFloor.floor, actors: [boss] } };

    expect(go(withBoss, { type: 'turnEnd' }).phase).toBe('playing');
    expect(go(bossFloor, { type: 'turnEnd' }).phase).toBe('victory');
    const both = { ...bossFloor, player: { ...bossFloor.player, hp: 0 } };
    expect(go(both, { type: 'turnEnd' }).phase).toBe('gameOver');
    // 보스가 없는 테마의 층은 클리어가 아니다
    expect(go(inPhase('playing', 1), { type: 'turnEnd' }).phase).toBe('playing');
  });

  it('gameOver에서 R → floorNumber 1, 새 runSeed, floorIntro', () => {
    const over = inPhase('gameOver', 7);
    const next = go(over, { type: 'restart', seed: 0x1234 });
    expect(next.phase).toBe('floorIntro');
    expect(next.floorNumber).toBe(1);
    expect(next.runSeed).toBe(0x1234);
    expect(next.player.hp).toBe(data.player.maxHp);
  });

  it('gameOver·victory에서 Esc → title', () => {
    expect(go(inPhase('gameOver'), { type: 'toTitle' }).phase).toBe('title');
    expect(go(inPhase('victory'), { type: 'toTitle' }).phase).toBe('title');
  });

  it('phase가 받지 않는 이벤트는 상태를 바꾸지 않는다', () => {
    const cases: [Phase, FlowEvent][] = [
      ['title', { type: 'introDone' }],
      ['title', { type: 'descend' }],
      ['floorIntro', { type: 'descend' }],
      ['playing', { type: 'newGame', seed: 1 }],
      ['playing', { type: 'restart', seed: 1 }],
      ['gameOver', { type: 'descend' }],
      ['victory', { type: 'turnEnd' }],
    ];
    for (const [phase, event] of cases) {
      const state = inPhase(phase);
      expect(go(state, event), `${phase} + ${event.type}`).toBe(state);
    }
  });
});

describe('phase별 입력', () => {
  it('title은 Enter만 받는다', () => {
    expect(keyToCommand('title', 'Enter')).toEqual({ type: 'newGame' });
    expect(keyToCommand('title', 'ArrowUp')).toBeNull();
  });

  it('floorIntro는 아무 키 (조합키 단독 제외)', () => {
    expect(keyToCommand('floorIntro', 'a')).toEqual({ type: 'introDone' });
    expect(keyToCommand('floorIntro', 'Shift')).toBeNull();
  });

  it('gameOver·victory는 R과 Esc', () => {
    for (const phase of ['gameOver', 'victory'] as const) {
      expect(keyToCommand(phase, 'r')).toEqual({ type: 'restart' });
      expect(keyToCommand(phase, 'R')).toEqual({ type: 'restart' });
      expect(keyToCommand(phase, 'Escape')).toEqual({ type: 'toTitle' });
      expect(keyToCommand(phase, 'Enter')).toBeNull();
    }
  });

  it('playing이 아닌 phase에서 이동 키는 아무것도 하지 않는다', () => {
    for (const phase of ['title', 'gameOver', 'victory'] as const) {
      for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
        expect(keyToCommand(phase, key)).toBeNull();
      }
    }
  });
});

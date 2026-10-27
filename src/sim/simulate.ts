// F017 밸런스 시뮬레이터: 봇으로 한 판씩 끝까지 돌리고 기록을 남긴다. core/만 쓴다 (브라우저 없음)
import type { GameData } from '../data/types';
import { bossRoomAt } from '../core/boss';
import { isBossFloor } from '../core/dungeon';
import { getStat } from '../core/effects';
import { transition } from '../core/flow';
import { createRun } from '../core/run';
import type { RunState } from '../core/state';
import { playTurn } from '../core/turn';
import { decide, newMemory } from './bot';

export interface RunResult {
  seed: number;
  outcome: 'clear' | 'death' | 'timeout';
  turns: number;
  floorReached: number;
  killedBy?: string;
  buildItems: string[];
  hpOnEntry: number[]; // [층 번호 - 1] = 그 층에 들어설 때 HP / 최대 HP
  bossFightTurns?: number; // 보스방에 들어간 판만: 들어간 뒤 끝날 때까지의 턴 수
}

// 턴이 지나지 않는 결정(경고·안내 메시지)을 연달아 이만큼 하면 쉬기로 바꾼다. 봇이 제자리에서 맴돌지 않게
const MAX_STALLED_MOVES = 3;

export function simulateRun(data: GameData, seed: number, maxTurns: number): RunResult {
  let state = createRun(data, seed, 'floorIntro');
  const hpOnEntry: number[] = [];
  let bossEnteredTurn: number | undefined;
  let stalled = 0;
  const memory = newMemory();

  while (state.phase !== 'gameOver' && state.phase !== 'victory' && state.turn < maxTurns) {
    if (hpOnEntry.length < state.floorNumber) hpOnEntry.push(state.player.hp / getStat(state.player, 'maxHp', data));
    if (bossEnteredTurn === undefined && state.phase === 'playing' && isBossFloor(data, state.floorNumber) && bossRoomAt(state.floor, state.player)) {
      bossEnteredTurn = state.turn;
    }
    const move = decide(state, data, memory);
    const before = state;
    if (move.type === 'introDone') state = transition(state, move, data);
    else if (move.type === 'choose') state = transition(state, move, data);
    else state = playTurn(state, stalled >= MAX_STALLED_MOVES ? { type: 'rest' } : move.input, data);
    // 무효 행동(같은 상태)이면 쉰다. 턴이 지나지 않은 결정이 이어지면 센다
    if (state === before) state = playTurn(state, { type: 'rest' }, data);
    stalled = before.phase === 'playing' && state.turn === before.turn ? stalled + 1 : 0;
  }
  return result(state, seed, hpOnEntry, bossEnteredTurn);
}

function result(state: RunState, seed: number, hpOnEntry: number[], bossEnteredTurn: number | undefined): RunResult {
  const outcome = state.phase === 'victory' ? 'clear' : state.phase === 'gameOver' ? 'death' : 'timeout';
  return {
    seed,
    outcome,
    turns: state.turn,
    floorReached: state.floorNumber,
    ...(outcome === 'death' && { killedBy: state.runStats.killedBy }),
    buildItems: [...state.player.buildItems],
    hpOnEntry,
    ...(bossEnteredTurn !== undefined && { bossFightTurns: state.turn - bossEnteredTurn }),
  };
}

export function simulate(data: GameData, seedStart: number, runs: number, maxTurns: number): RunResult[] {
  return Array.from({ length: runs }, (_, i) => simulateRun(data, seedStart + i, maxTurns));
}

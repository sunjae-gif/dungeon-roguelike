// phase 전환. 30-systems/game-flow.md
// phase를 바꾸는 곳은 이 파일의 transition() 하나뿐이다.
import { themeForFloor } from '../data/query';
import type { GameData } from '../data/types';
import { createRun, enterFloor } from './run';
import type { RunState } from './state';

export type FlowEvent =
  | { type: 'newGame'; seed: number }
  | { type: 'introDone' }
  | { type: 'descend' }
  | { type: 'turnEnd' }
  | { type: 'restart'; seed: number }
  | { type: 'toTitle' };

// 타이틀 화면의 상태. 판은 아직 시작하지 않았으므로 시드 0으로 채운다.
export function createTitleState(data: GameData): RunState {
  return createRun(data, 0, 'title');
}

// 받을 수 없는 이벤트면 같은 상태 객체를 그대로 돌려준다.
export function transition(state: RunState, event: FlowEvent, data: GameData): RunState {
  switch (state.phase) {
    case 'title':
      if (event.type === 'newGame') return createRun(data, event.seed, 'floorIntro');
      return state;

    case 'floorIntro':
      if (event.type === 'introDone') return { ...state, phase: 'playing' };
      return state;

    case 'playing':
      if (event.type === 'descend') {
        return { ...enterFloor(state, data, state.floorNumber + 1), phase: 'floorIntro' };
      }
      if (event.type === 'turnEnd') return checkRunEnd(state, data);
      return state;

    case 'gameOver':
    case 'victory':
      if (event.type === 'restart') return createRun(data, event.seed, 'floorIntro');
      if (event.type === 'toTitle') return createTitleState(data);
      return state;
  }
}

// 턴 끝 판정 (turn-order.md 6단계). 게임 오버가 클리어보다 먼저다.
function checkRunEnd(state: RunState, data: GameData): RunState {
  if (state.player.hp <= 0) return { ...state, phase: 'gameOver' };
  if (isBossDefeated(state, data)) return { ...state, phase: 'victory' };
  return state;
}

// 보스가 있는 테마의 층에서 그 보스가 남아 있지 않으면 클리어
function isBossDefeated(state: RunState, data: GameData): boolean {
  const bossId = themeForFloor(data, state.floorNumber).boss;
  if (!bossId) return false;
  return !state.floor.actors.some((a) => a.defId === bossId && a.hp > 0);
}

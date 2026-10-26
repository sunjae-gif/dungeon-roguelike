// phase 전환. 30-systems/game-flow.md
// phase를 바꾸는 곳은 이 파일의 transition() 하나뿐이다.
import type { GameData } from '../data/types';
import { chooseItem } from './items';
import { createRun, enterFloor } from './run';
import type { RunState } from './state';

export type FlowEvent =
  | { type: 'newGame'; seed: number }
  | { type: 'introDone' }
  | { type: 'descend' }
  | { type: 'turnEnd' }
  | { type: 'restart'; seed: number }
  | { type: 'toTitle' }
  | { type: 'choose'; index: number };

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
      if (event.type === 'turnEnd') return checkRunEnd(state);
      return state;

    case 'itemChoice': {
      // F005 규칙 13, 14: 숫자키로 고른다. 턴을 쓰지 않는다
      if (event.type !== 'choose') return state;
      const chosen = chooseItem(state, data, event.index);
      return chosen === state ? state : { ...chosen, phase: 'playing' };
    }

    case 'gameOver':
    case 'victory':
      if (event.type === 'restart') return createRun(data, event.seed, 'floorIntro');
      if (event.type === 'toTitle') return createTitleState(data);
      return state;
  }
}

// 턴 끝 판정 (turn-order.md 6-6, game-flow.md 규칙 2): 게임 오버 → 클리어 → 아이템 고르기
function checkRunEnd(state: RunState): RunState {
  if (state.player.hp <= 0) return { ...state, phase: 'gameOver' };
  if (state.runStats.bossKilled) return { ...state, phase: 'victory' };
  if (state.pendingChoice) return { ...state, phase: 'itemChoice' };
  return state;
}

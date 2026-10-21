// phase 전환. 30-systems/game-flow.md
// phase를 바꾸는 곳은 이 파일의 transition() 하나뿐이다.
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
      if (event.type === 'turnEnd') return checkRunEnd(state);
      return state;

    case 'gameOver':
    case 'victory':
      if (event.type === 'restart') return createRun(data, event.seed, 'floorIntro');
      if (event.type === 'toTitle') return createTitleState(data);
      return state;
  }
}

// 턴 끝 판정 (turn-order.md 6단계). 게임 오버가 클리어보다 먼저다.
// 클리어 판정은 최종보스(F008)가 confirmed가 되면 여기에 더한다. 지금 넣으면 보스가 없는 10층에서 바로 클리어된다.
function checkRunEnd(state: RunState): RunState {
  if (state.player.hp <= 0) return { ...state, phase: 'gameOver' };
  return state;
}

// 메시지 로그 문구와 추가
import type { RunState } from './state';

export const MESSAGES = {
  // F013 규칙 7, 8
  stairsHere: () => '계단이 있다. >를 눌러 내려간다.',
  enteredFloor: (floorNumber: number) => `${floorNumber}층에 들어섰다.`,
};

export function addMessage(state: RunState, text: string): RunState {
  return { ...state, messageLog: [...state.messageLog, { turn: state.turn, text }] };
}

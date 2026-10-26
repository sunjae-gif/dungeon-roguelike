// 메시지 로그 문구와 추가
import type { GameData } from '../data/types';
import type { RunState } from './state';

export const MESSAGES = {
  // F013 규칙 7, 8
  stairsHere: () => '계단이 있다. >를 눌러 내려간다.',
  enteredFloor: (floorNumber: number) => `${floorNumber}층에 들어섰다.`,
  // F003 규칙 5
  playerHit: (monster: string, damage: number) => `${monster}에게 ${damage} 피해를 입혔다.`,
  monsterHit: (monster: string, damage: number) => `${monster}에게 ${damage} 피해를 받았다.`,
  monsterKilled: (monster: string) => `${monster}을(를) 쓰러뜨렸다.`,
  playerKilled: (monster: string) => `${monster}에게 쓰러졌다.`,
};

// game-state.md: 최대 messageLogMaxStored개. 넘으면 오래된 것부터 버린다
export function addMessage(state: RunState, text: string, data: GameData): RunState {
  const log = [...state.messageLog, { turn: state.turn, text }];
  return { ...state, messageLog: log.slice(-data.ui.messageLogMaxStored) };
}

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
  // F014 원거리 공격. 문구는 몬스터 항목의 attackVerb로 바꾼다
  monsterShot: (monster: string, verb: string, damage: number) => `${monster}의 ${verb}에 ${damage} 피해를 받았다.`,
  defaultAttackVerb: '화살',
  // F014 공통 규칙 3, flee 규칙 4
  noticed: (monster: string) => `${monster}이(가) 보인다.`,
  fledWith: (monster: string) => `${monster}이(가) 훔친 물건과 함께 달아났다.`,
  fled: (monster: string) => `${monster}이(가) 달아났다.`,
  // effects.md 4절: 공격이 아닌 피해(일시 효과 등)로 쓰러짐
  playerKilledBy: (cause: string) => `${cause}(으)로 쓰러졌다.`,
  // F005
  gotItem: (item: string) => `${item}을(를) 얻었다.`,
  bagFull: () => '가방이 가득 찼다.',
  // effects.md 7절 면역
  immune: (target: string) => `${target}에게는 통하지 않는다.`,
  playerName: '당신',
  // effects.md 6절 steal
  stole: (monster: string, item: string) => `${monster}이(가) ${item}을(를) 훔쳤다!`,
};

// game-state.md: 최대 messageLogMaxStored개. 넘으면 오래된 것부터 버린다
export function addMessage(state: RunState, text: string, data: GameData): RunState {
  const log = [...state.messageLog, { turn: state.turn, text }];
  return { ...state, messageLog: log.slice(-data.ui.messageLogMaxStored) };
}

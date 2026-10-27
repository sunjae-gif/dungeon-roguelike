// 메시지 로그 문구와 추가
import type { GameData } from '../data/types';
import type { RunState } from './state';

// 받침이 있으면 withFinal(이·을), 없으면 without(가·를)
export function josa(word: string, withFinal: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code < 11172 && code % 28 !== 0;
  return `${word}${hasFinal ? withFinal : without}`;
}

export const MESSAGES = {
  // F013 규칙 7, 8
  stairsHere: () => '계단이 있다. >를 눌러 내려간다.',
  enteredFloor: (floorNumber: number) => `${floorNumber}층에 들어섰다.`,
  // F011 규칙 5
  themeEntered: (theme: string) => `— ${theme} —`,
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
  gotItem: (item: string) => `${josa(item, '을', '를')} 얻었다.`,
  bagFull: () => '가방이 가득 찼다.',
  // F005 규칙 3-1
  pickedUp: (item: string) => `${josa(item, '을', '를')} 주웠다.`,
  usedItem: (item: string) => `${josa(item, '을', '를')} 사용했다.`,
  healAmountKey: '{회복량}',
  // F010
  alarm: () => '경보가 울렸다! 발소리가 다가온다.',
  doorOpened: () => '문을 열었다.',
  // F009
  hiddenWallFound: () => '벽 틈으로 바람이 새어 나온다. 숨은 통로를 찾았다!',
  springDrank: (healed: number) => `샘물을 마셨다. (HP +${healed})`,
  springNotThirsty: () => '지금은 목이 마르지 않다.',
  springDry: () => '샘이 말라 있다.',
  chestLocked: () => '잠겨 있다.',
  monsterOpenedDoor: (monsterWithJosa: string) => `${monsterWithJosa} 문을 열었다.`,
  steppedOnTrap: (trapWithJosa: string) => `${trapWithJosa} 밟았다!`,
  monsterSteppedOnTrap: (monsterWithJosa: string, trapWithJosa: string) => `${monsterWithJosa} ${trapWithJosa} 밟았다!`,
  // F008 최종보스
  bossWarning: (boss: string) => `이 너머는 ${boss}의 방이다. 들어가면 돌아올 수 없다.`,
  sealed: () => '뒤에서 문이 닫혔다.',
  bossCharge: (boss: string) => `${josa(boss, '이', '가')} 힘을 모은다!`,
  bossSlam: (boss: string) => `${josa(boss, '이', '가')} 내려친다!`,
  bossDefeated: (boss: string) => `${josa(boss, '을', '를')} 쓰러뜨렸다!`,
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

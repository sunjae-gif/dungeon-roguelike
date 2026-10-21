// 키 입력을 phase별 명령으로 바꾼다. 30-systems/game-flow.md "받는 입력"
import type { Phase } from '../core/state';

export type Command =
  | { type: 'newGame' }
  | { type: 'introDone' }
  | { type: 'restart' }
  | { type: 'toTitle' };

// 단독으로 눌렀을 때 "아무 키"로 치지 않는 키
const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];

export function keyToCommand(phase: Phase, key: string): Command | null {
  switch (phase) {
    case 'title':
      return key === 'Enter' ? { type: 'newGame' } : null;
    case 'floorIntro':
      return MODIFIER_KEYS.includes(key) ? null : { type: 'introDone' };
    case 'playing':
      // M1에서 이동·쉬기 행동을 추가한다 (turn-order.md)
      return null;
    case 'gameOver':
    case 'victory':
      if (key === 'r' || key === 'R') return { type: 'restart' };
      if (key === 'Escape') return { type: 'toTitle' };
      return null;
  }
}

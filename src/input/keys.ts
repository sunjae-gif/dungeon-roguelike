// 키 입력을 phase별 명령으로 바꾼다. 30-systems/game-flow.md "받는 입력"
import type { Direction, Phase } from '../core/state';
import type { PlayerInput } from '../core/turn';

export type Command =
  | { type: 'newGame' }
  | { type: 'introDone' }
  | { type: 'restart' }
  | { type: 'toTitle' }
  | { type: 'choose'; index: number }
  | { type: 'player'; input: PlayerInput };

// F002 키 배치: 방향키 또는 WASD
const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};
const REST_KEY = ' ';
// F013: 계단에서 내려가기
const DESCEND_KEYS = ['>', 'Enter'];

function playingCommand(key: string): Command | null {
  const direction = DIRECTION_KEYS[key] ?? DIRECTION_KEYS[key.toLowerCase()];
  if (direction) return { type: 'player', input: { type: 'direction', direction } };
  if (key === REST_KEY) return { type: 'player', input: { type: 'rest' } };
  if (DESCEND_KEYS.includes(key)) return { type: 'player', input: { type: 'descend' } };
  // F005 규칙 2: 숫자키 1~9로 소모품 사용
  const n = Number(key);
  if (Number.isInteger(n) && n >= 1 && n <= 9) return { type: 'player', input: { type: 'useItem', index: n - 1 } };
  return null;
}

// 단독으로 눌렀을 때 "아무 키"로 치지 않는 키
const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];

export function keyToCommand(phase: Phase, key: string): Command | null {
  switch (phase) {
    case 'title':
      return key === 'Enter' ? { type: 'newGame' } : null;
    case 'floorIntro':
      return MODIFIER_KEYS.includes(key) ? null : { type: 'introDone' };
    case 'playing':
      return playingCommand(key);
    case 'itemChoice': {
      // F005 규칙 13: 숫자키로 고른다
      const n = Number(key);
      return Number.isInteger(n) && n >= 1 && n <= 9 ? { type: 'choose', index: n - 1 } : null;
    }
    case 'gameOver':
    case 'victory':
      if (key === 'r' || key === 'R') return { type: 'restart' };
      if (key === 'Escape') return { type: 'toTitle' };
      return null;
  }
}

// 키 입력을 phase별 명령으로 바꾼다. 30-systems/game-flow.md "받는 입력"
import type { Direction, Phase } from '../core/state';
import type { PlayerInput } from '../core/turn';

export type Command =
  | { type: 'newGame' }
  | { type: 'introDone' }
  | { type: 'restart' }
  | { type: 'toTitle' }
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

function playingCommand(key: string): Command | null {
  const direction = DIRECTION_KEYS[key] ?? DIRECTION_KEYS[key.toLowerCase()];
  if (direction) return { type: 'player', input: { type: 'direction', direction } };
  if (key === REST_KEY) return { type: 'player', input: { type: 'rest' } };
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
    case 'gameOver':
    case 'victory':
      if (key === 'r' || key === 'R') return { type: 'restart' };
      if (key === 'Escape') return { type: 'toTitle' };
      return null;
  }
}

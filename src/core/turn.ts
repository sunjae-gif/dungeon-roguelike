// 한 턴 처리. 30-systems/turn-order.md
import type { GameData } from '../data/types';
import { transition } from './flow';
import { DIRECTION_DELTAS, isPassable, updateSight } from './movement';
import type { Direction, RunState } from './state';

// 플레이어 입력 (input/이 키를 이것으로 바꾼다)
export type PlayerInput = { type: 'direction'; direction: Direction } | { type: 'rest' };

// 게임 규칙이 이해하는 행동 (turn-order.md "플레이어 행동 종류")
export type Action = { type: 'move'; direction: Direction } | { type: 'rest' };

// 2단계: 입력을 행동으로. 무효면 null.
// 방향 입력은 attack → interact → move → 무효 순서로 판정한다. attack(F003)과 interact(F010)는 아직 없다.
export function toAction(state: RunState, input: PlayerInput): Action | null {
  switch (input.type) {
    case 'direction': {
      const d = DIRECTION_DELTAS[input.direction];
      // F002 규칙 2: 벽으로는 이동할 수 없다
      return isPassable(state, state.player.x + d.x, state.player.y + d.y)
        ? { type: 'move', direction: input.direction }
        : null;
    }
    case 'rest':
      return input;
  }
}

export function playTurn(state: RunState, input: PlayerInput, data: GameData): RunState {
  if (state.phase !== 'playing') return state;
  const action = toAction(state, input);
  // 무효 행동: 턴 수 그대로
  if (!action) return state;

  // 3. onTurnStart 이벤트 (effects.md, M2)
  // 4. 플레이어 행동
  let next = applyPlayerAction(state, action);
  // 5. 몬스터 행동 (F004, M2)
  // 6. 턴 마무리: onTurnEnd(M2) → 시야 → 게임 오버 판정 → 턴 수 증가
  next = updateSight(next, data.player.sightRadius);
  next = transition(next, { type: 'turnEnd' }, data);
  return { ...next, turn: next.turn + 1 };
}

function applyPlayerAction(state: RunState, action: Action): RunState {
  switch (action.type) {
    case 'move': {
      // F002 규칙 1, 5: 한 칸 이동하고 그 방향을 바라본다
      const d = DIRECTION_DELTAS[action.direction];
      const player = { ...state.player, x: state.player.x + d.x, y: state.player.y + d.y, facing: action.direction };
      return { ...state, player };
    }
    case 'rest':
      // F002 규칙 4
      return state;
  }
}

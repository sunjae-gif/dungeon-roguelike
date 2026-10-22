// 한 턴 처리. 30-systems/turn-order.md
import type { GameData } from '../data/types';
import { transition } from './flow';
import { STAIRS_OBJECT_TYPE } from './dungeon';
import { getStat } from './effects';
import { fireEvent, fireForAll, tickStatuses } from './events';
import { addMessage, MESSAGES } from './messages';
import { DIRECTION_DELTAS, isPassable, objectAt, updateSight } from './movement';
import type { Direction, RunState } from './state';

// 플레이어 입력 (input/이 키를 이것으로 바꾼다)
export type PlayerInput = { type: 'direction'; direction: Direction } | { type: 'rest' } | { type: 'descend' };

// 게임 규칙이 이해하는 행동 (turn-order.md "플레이어 행동 종류")
export type Action = { type: 'move'; direction: Direction } | { type: 'rest' } | { type: 'descend' };

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
    case 'descend':
      // F013: 계단 칸 위에서만. 아니면 무효(턴 안 지남)
      return isOnStairs(state) ? input : null;
  }
}

function isOnStairs(state: RunState): boolean {
  return objectAt(state.floor, state.player.x, state.player.y)?.type === STAIRS_OBJECT_TYPE;
}

export function playTurn(state: RunState, input: PlayerInput, data: GameData): RunState {
  if (state.phase !== 'playing') return state;
  const action = toAction(state, input);
  // 무효 행동: 턴 수 그대로, 메시지 없음
  if (!action) return state;

  // 3. onTurnStart
  let next = fireForAll(state, data, 'onTurnStart');
  // 4. 플레이어 행동
  if (action.type === 'descend') {
    // F013: 새 층을 만들고(onFloorEnter 포함) floorIntro로. 5~6단계는 건너뛰고 턴 수만 1 늘린다.
    next = transition(next, { type: 'descend' }, data);
    return { ...next, turn: next.turn + 1 };
  }
  next = applyPlayerAction(next, action, data);
  // 5. 몬스터 행동 (F004가 확정되면)
  // 6. 턴 마무리: onTurnEnd, 일시 효과 감소 → 시야 → 게임 오버 판정 → 턴 수 증가
  next = tickStatuses(fireForAll(next, data, 'onTurnEnd'), data);
  next = updateSight(next, getStat(next.player, 'sightRadius', data));
  next = transition(next, { type: 'turnEnd' }, data);
  return { ...next, turn: next.turn + 1 };
}

function applyPlayerAction(state: RunState, action: Exclude<Action, { type: 'descend' }>, data: GameData): RunState {
  switch (action.type) {
    case 'move': {
      // F002 규칙 1, 5: 한 칸 이동하고 그 방향을 바라본다
      const d = DIRECTION_DELTAS[action.direction];
      const player = { ...state.player, x: state.player.x + d.x, y: state.player.y + d.y, facing: action.direction };
      const from = { x: state.player.x, y: state.player.y };
      const moved = fireEvent({ ...state, player }, data, player.id, 'onMove', { from, to: { x: player.x, y: player.y } }).state;
      // 도착한 칸 처리: 아이템 줍기(F005), 함정(F010)은 확정되면 여기에
      // F013 규칙 7: 계단 칸에 올라서면 알려준다
      return isOnStairs(moved) ? addMessage(moved, MESSAGES.stairsHere(), data) : moved;
    }
    case 'rest':
      // F002 규칙 4
      return state;
  }
}

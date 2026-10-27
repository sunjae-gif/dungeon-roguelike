// 한 턴 처리. 30-systems/turn-order.md
import type { GameData } from '../data/types';
import { transition } from './flow';
import { bossRoomNeedingWarning, sealBossRooms, warnBossRoom } from './boss';
import { attack } from './combat';
import { DOOR_OBJECT_TYPE, isClosedDoor, openDoor } from './doors';
import { discoverHiddenWalls, drinkSpring, SPRING_OBJECT_TYPE, springNotice } from './roomFeatures';
import { triggerTrap } from './traps';
import { canUseConsumable, CHEST_OBJECT_TYPE, openChest, pickUp, useConsumable } from './items';
import { STAIRS_OBJECT_TYPE } from './dungeon';
import { getStat } from './effects';
import { sweepDeadMonsters } from './damage';
import { fireEvent, fireForAll, tickStatuses } from './events';
import { addMessage, MESSAGES } from './messages';
import { actMonsters, noticeMonsters, vanishFleeing } from './monsters';
import { DIRECTION_DELTAS, inBounds, isPassable, monsterAt, objectAt, updateSight } from './movement';
import { tileIndex, type MapObject } from './state';
import type { Direction, RunState } from './state';

// 플레이어 입력 (input/이 키를 이것으로 바꾼다)
export type PlayerInput =
  | { type: 'direction'; direction: Direction }
  | { type: 'rest' }
  | { type: 'descend' }
  | { type: 'useItem'; index: number };

// 게임 규칙이 이해하는 행동 (turn-order.md "플레이어 행동 종류")
export type Action =
  | { type: 'move'; direction: Direction }
  | { type: 'attack'; direction: Direction; targetId: number }
  | { type: 'interact'; direction: Direction; objectId: number }
  | { type: 'useItem'; index: number }
  | { type: 'rest' }
  | { type: 'descend' }
  | { type: 'warn'; roomId: number }
  | { type: 'notice'; text: string };

// 2단계: 입력을 행동으로. 무효면 null.
// 방향 입력 판정 (turn-order.md 1~5)
export function toAction(state: RunState, input: PlayerInput, data: GameData): Action | null {
  switch (input.type) {
    case 'direction': {
      const { direction } = input;
      const d = DIRECTION_DELTAS[direction];
      const x = state.player.x + d.x;
      const y = state.player.y + d.y;
      // 1. 바로 앞 몬스터를 공격 (F003 규칙 1)
      const monster = monsterAt(state.floor, x, y);
      if (monster) return { type: 'attack', direction, targetId: monster.id };
      // 2. 바로 앞의 막힌 물체: 문·상자·샘 (F010, F005, F009). 효과가 없으면 무효(안내 메시지가 있으면 그것만)
      const object = objectAt(state.floor, x, y);
      if (object?.blocksMove) return interactionWith(state, data, object, direction);
      // 3. 사거리 안 같은 줄의 몬스터 (F015 창)
      const ranged = monsterInRange(state, direction, getStat(state.player, 'attackRange', data));
      if (ranged) return { type: 'attack', direction, targetId: ranged.id };
      // 4. 이동, 5. 무효 (F002 규칙 2: 벽으로는 이동할 수 없다)
      if (!isPassable(state, x, y)) return null;
      // F008 규칙 4: 보스방에 처음 들어가려 하면 이동 대신 경고
      const bossRoom = bossRoomNeedingWarning(state, { x, y });
      return bossRoom ? { type: 'warn', roomId: bossRoom.id } : { type: 'move', direction };
    }
    case 'rest':
      return input;
    case 'descend':
      // F013: 계단 칸 위에서만. 아니면 무효(턴 안 지남)
      return isOnStairs(state) ? input : null;
    case 'useItem':
      // F005 규칙 2, 4: 쓸 수 없으면 무효(턴 안 지남)
      return canUseConsumable(state, data, input.index) ? input : null;
  }
}

// turn-order.md 2: 막힌 물체와의 상호작용. 효과 없는 interact는 안내 메시지만 남기는 무효 행동
function interactionWith(state: RunState, data: GameData, object: MapObject, direction: Direction): Action | null {
  const interact: Action = { type: 'interact', direction, objectId: object.id };
  if (isClosedDoor(object)) return interact;
  if (object.type === CHEST_OBJECT_TYPE && !object.state.opened) {
    return object.state.locked ? { type: 'notice', text: MESSAGES.chestLocked() } : interact;
  }
  if (object.type === SPRING_OBJECT_TYPE) {
    const notice = springNotice(state, data, object);
    return notice ? { type: 'notice', text: notice } : interact;
  }
  return null;
}

// turn-order.md 3: 그 방향 2~range칸 안의 가장 가까운 몬스터. 사이 칸은 모두 비어 있어야 한다
function monsterInRange(state: RunState, direction: Direction, range: number) {
  const { floor, player } = state;
  const d = DIRECTION_DELTAS[direction];
  for (let k = 1; k <= range; k++) {
    const x = player.x + d.x * k;
    const y = player.y + d.y * k;
    if (!inBounds(floor, x, y)) return undefined;
    const monster = monsterAt(floor, x, y);
    if (monster) return k >= 2 ? monster : undefined;
    // 벽·막힌 물체가 사이에 있으면 닿지 않는다
    if (floor.tiles[tileIndex(floor, x, y)] !== 'floor' || objectAt(floor, x, y)?.blocksMove) return undefined;
  }
  return undefined;
}

function isOnStairs(state: RunState): boolean {
  return objectAt(state.floor, state.player.x, state.player.y)?.type === STAIRS_OBJECT_TYPE;
}

export function playTurn(state: RunState, input: PlayerInput, data: GameData): RunState {
  if (state.phase !== 'playing') return state;
  const action = toAction(state, input, data);
  // 무효 행동: 턴 수 그대로, 메시지 없음
  if (!action) return state;
  // F008 규칙 4: 경고는 무효 행동이지만 메시지를 남기는 예외 (turn-order.md)
  if (action.type === 'warn') return warnBossRoom(state, data, action.roomId);
  if (action.type === 'notice') return addMessage(state, action.text, data);

  // 3. onTurnStart (플레이어, effects.md 3절)
  let next = fireEvent(state, data, state.player.id, 'onTurnStart').state;
  // 4. 플레이어 행동
  if (action.type === 'descend') {
    // F013: 새 층을 만들고(onFloorEnter 포함) floorIntro로. 5~6단계는 건너뛰고 턴 수만 1 늘린다.
    next = transition(next, { type: 'descend' }, data);
    return { ...next, turn: next.turn + 1 };
  }
  next = applyPlayerAction(next, action, data);
  // 5. 몬스터 행동 (F004)
  next = actMonsters(next, data);
  // 6. 턴 마무리
  next = fireForAll(next, data, 'onTurnEnd'); // 6-1 재생·중독
  next = tickStatuses(next, data); // 6-2
  next = sweepDeadMonsters(next, data); // 6-3
  next = sealBossRooms(next, data); // F008 규칙 6 (봉인 문은 시야를 막으므로 시야 계산 전에)
  next = noticeMonsters(updateSight(next, getStat(next.player, 'sightRadius', data)), data); // 6-4
  next = vanishFleeing(next, data); // 6-5
  next = transition(next, { type: 'turnEnd' }, data); // 6-6
  return { ...next, turn: next.turn + 1 }; // 6-7
}

function applyPlayerAction(state: RunState, action: Exclude<Action, { type: 'descend' | 'warn' | 'notice' }>, data: GameData): RunState {
  switch (action.type) {
    case 'move': {
      // F002 규칙 1, 5: 한 칸 이동하고 그 방향을 바라본다
      const d = DIRECTION_DELTAS[action.direction];
      const player = { ...state.player, x: state.player.x + d.x, y: state.player.y + d.y, facing: action.direction };
      const from = { x: state.player.x, y: state.player.y };
      let moved = fireEvent({ ...state, player }, data, player.id, 'onMove', { from, to: { x: player.x, y: player.y } }).state;
      // 도착한 칸 처리: 아이템 자동 줍기(F005) → 함정 발동(F010)
      moved = triggerTrap(pickUp(moved, data), data, player.id);
      // F013 규칙 7: 계단 칸에 올라서면 알려준다
      return isOnStairs(moved) ? addMessage(moved, MESSAGES.stairsHere(), data) : moved;
    }
    case 'attack': {
      // F002 규칙 5: 공격한 방향을 바라본다. F003 규칙 4: 공격도 한 턴
      const facing = { ...state, player: { ...state.player, facing: action.direction } };
      return attack(facing, data, state.player.id, action.targetId);
    }
    case 'interact': {
      const facing = { ...state, player: { ...state.player, facing: action.direction } };
      const object = state.floor.objects.find((o) => o.id === action.objectId);
      // F010 규칙 2: 문 열기 (제자리, 한 턴)
      if (object?.type === DOOR_OBJECT_TYPE) return openDoor(facing, data, state.player.id, action.objectId);
      // F009 규칙 31: 샘 마시기 (한 턴)
      if (object?.type === SPRING_OBJECT_TYPE) return drinkSpring(facing, data, action.objectId);
      // F005 규칙 8: 상자 열기 (한 턴). 고르기 화면은 턴이 끝난 뒤 (game-flow.md)
      return openChest(facing, data, action.objectId);
    }
    case 'useItem':
      // F005 규칙 2: 소모품 사용 (한 턴)
      return useConsumable(state, data, action.index);
    case 'rest':
      // F002 규칙 4. F009 규칙 12: 숨은 벽 옆이면 찾는다
      return discoverHiddenWalls(state, data);
  }
}

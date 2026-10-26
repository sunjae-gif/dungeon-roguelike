// F005 아이템과 빌드: 빌드 아이템 얻기, 고르기
import type { GameData } from '../data/types';
import { getStat, immunitiesOf, itemDef, statusImmunity } from './effects';
import { fireEvent } from './events';
import { addMessage, MESSAGES } from './messages';
import type { RunState } from './state';

// 빌드 아이템을 목록 끝에 더한다. 개발자 모드 아이템 생성도 이것을 쓴다
// F005 규칙 15: 최대 HP가 늘면 현재 HP도 같은 만큼. effects.md 7절 규칙 2: 새 면역이 생기면 그 일시 효과는 풀린다
export function addBuildItem(state: RunState, data: GameData, itemId: string): RunState {
  const before = getStat(state.player, 'maxHp', data);
  const withItem = { ...state.player, buildItems: [...state.player.buildItems, itemId] };
  const gained = Math.max(0, getStat(withItem, 'maxHp', data) - before);
  const immune = immunitiesOf(withItem, data);
  const player = {
    ...withItem,
    hp: withItem.hp + gained,
    statuses: withItem.statuses.filter((s) => !immune.includes(statusImmunity(s.id))),
  };
  return { ...state, player };
}

// F005 규칙 14: 고른 후보를 빌드 아이템으로. onPickup, 메시지. 턴은 쓰지 않는다
export function chooseItem(state: RunState, data: GameData, index: number): RunState {
  const itemId = state.pendingChoice?.options[index];
  if (itemId === undefined) return state;
  let next = addBuildItem({ ...state, pendingChoice: undefined }, data, itemId);
  next = { ...next, runStats: { ...next.runStats, itemsFound: next.runStats.itemsFound + 1 } };
  next = fireEvent(next, data, next.player.id, 'onPickup', { itemId }).state;
  return addMessage(next, MESSAGES.gotItem(itemDef(data, itemId)?.name ?? itemId), data);
}

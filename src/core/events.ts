// 30-systems/effects.md 2. 이벤트, 3. 피해 처리 순서, 4. 효과 실행
import type { EffectDef, GameData } from '../data/types';
import { clampHp, getStat, itemDef, type EventName } from './effects';
import { addMessage } from './messages';
import { chance, useRunRng } from './rng';
import type { Actor, RunState } from './state';

// 처리 규칙 3: 효과가 일으킨 이벤트가 이어지는 깊이 상한
export const MAX_EVENT_DEPTH = 3;

// 이벤트와 함께 전달되는 값. other는 이벤트의 상대(공격 대상, 공격자 등)의 id
export interface EventContext {
  other?: number;
  damage?: number;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  itemId?: string;
  floorNumber?: number;
  trapId?: string;
}

export function findActor(state: RunState, id: number): Actor | undefined {
  return state.player.id === id ? state.player : state.floor.actors.find((a) => a.id === id);
}

export function updateActor(state: RunState, actor: Actor): RunState {
  if (state.player.id === actor.id) return { ...state, player: actor };
  return { ...state, floor: { ...state.floor, actors: state.floor.actors.map((a) => (a.id === actor.id ? actor : a)) } };
}

// 이벤트 하나를 그 개체의 빌드 아이템 triggers에 전달한다.
// 처리 규칙 1: 아이템을 얻은 순서대로. 규칙 2: onBeforeAttack의 damage는 다음 아이템이 이어받는다.
export function fireEvent(
  state: RunState,
  data: GameData,
  ownerId: number,
  event: EventName,
  ctx: EventContext = {},
  depth = 1,
): { state: RunState; ctx: EventContext } {
  if (depth > MAX_EVENT_DEPTH) {
    console.warn(`이벤트 ${event}: 이어지는 깊이가 ${MAX_EVENT_DEPTH}단계를 넘어 실행하지 않는다.`);
    return { state, ctx };
  }
  let current = { state, ctx };
  const owner = findActor(state, ownerId);
  if (!owner) return current;
  for (const id of owner.buildItems) {
    for (const trigger of itemDef(data, id)?.triggers ?? []) {
      if (trigger.event !== event) continue;
      // chance가 1이 아니면 combat 난수 흐름
      if (trigger.chance < 1) {
        const roll = useRunRng(current.state.rng, 'combat', (rng) => chance(rng, trigger.chance));
        current = { ...current, state: { ...current.state, rng: roll.rng } };
        if (!roll.value) continue;
      }
      for (const effect of trigger.effects) current = applyEffect(current.state, data, ownerId, effect, current.ctx, depth);
    }
  }
  return current;
}

// 효과 하나 실행 (effects.md "효과 종류" 표)
export function applyEffect(
  state: RunState,
  data: GameData,
  ownerId: number,
  effect: EffectDef,
  ctx: EventContext,
  depth: number,
): { state: RunState; ctx: EventContext } {
  const targetId = effect.target === 'other' ? ctx.other : ownerId;
  const target = targetId === undefined ? undefined : findActor(state, targetId);
  switch (effect.type) {
    case 'heal': {
      if (!target) return { state, ctx };
      const hp = Math.min(target.hp + (effect.amount ?? 0), getStat(target, 'maxHp', data));
      return { state: updateActor(state, { ...target, hp }), ctx };
    }
    case 'damage':
      // 방어 무시
      if (!target) return { state, ctx };
      return { state: applyDamage(state, data, ownerId, target.id, effect.amount ?? 0, depth + 1), ctx };
    case 'modifyDamage': {
      if (ctx.damage === undefined) return { state, ctx };
      const value = effect.value ?? 0;
      const damage = effect.op === 'mul' ? Math.floor(ctx.damage * value) : ctx.damage + value;
      return { state, ctx: { ...ctx, damage } };
    }
    case 'message':
      return { state: addMessage(state, effect.text ?? '', data), ctx };
    default:
      return { state, ctx };
  }
}

// 피해를 주고 onDamaged, 쓰러지면 onKill과 제거. 공격 피해와 효과 피해가 같이 쓴다.
// 플레이어의 HP가 0 이하가 되어도 여기서는 제거하지 않는다. 게임 오버는 턴 끝에 판정한다(game-flow.md).
export function applyDamage(
  state: RunState,
  data: GameData,
  sourceId: number,
  targetId: number,
  amount: number,
  depth: number,
): RunState {
  const target = findActor(state, targetId);
  if (!target) return state;
  let next = updateActor(state, { ...target, hp: target.hp - amount });
  next = fireEvent(next, data, targetId, 'onDamaged', { other: sourceId, damage: amount }, depth).state;
  return handleDeath(next, data, sourceId, targetId, depth);
}

function handleDeath(state: RunState, data: GameData, killerId: number, targetId: number, depth: number): RunState {
  const target = findActor(state, targetId);
  if (!target || target.hp > 0 || targetId === state.player.id) return state;
  let next = fireEvent(state, data, killerId, 'onKill', { other: targetId }, depth).state;
  next = { ...next, floor: { ...next.floor, actors: next.floor.actors.filter((a) => a.id !== targetId) } };
  if (killerId === next.player.id) next = { ...next, runStats: { ...next.runStats, kills: next.runStats.kills + 1 } };
  return next;
}

// effects.md 3. 피해 처리 순서 (F003이 따른다)
export function resolveAttack(state: RunState, data: GameData, attackerId: number, targetId: number): RunState {
  const attacker = findActor(state, attackerId);
  const target = findActor(state, targetId);
  if (!attacker || !target) return state;
  // 1. onBeforeAttack. 피해 기본값 = 공격자 attack − 대상 defense
  const base = getStat(attacker, 'attack', data) - getStat(target, 'defense', data);
  const before = fireEvent(state, data, attackerId, 'onBeforeAttack', { other: targetId, damage: base });
  // 2. 최솟값 1
  const damage = Math.max(1, before.ctx.damage ?? base);
  // 3. 대상 HP 감소
  const hit = findActor(before.state, targetId);
  if (!hit) return before.state;
  let next = updateActor(before.state, { ...hit, hp: hit.hp - damage });
  // 4. onHit (공격자), onDamaged (대상)
  next = fireEvent(next, data, attackerId, 'onHit', { other: targetId, damage }).state;
  next = fireEvent(next, data, targetId, 'onDamaged', { other: attackerId, damage }).state;
  // 5. HP가 0 이하면 onKill, 대상 제거 (플레이어면 턴 끝에 게임 오버)
  return handleDeath(next, data, attackerId, targetId, 1);
}

// 모든 개체에 같은 이벤트 (onTurnStart, onTurnEnd 등). 플레이어 먼저, 몬스터는 id 순서
export function fireForAll(state: RunState, data: GameData, event: EventName, ctx: EventContext = {}): RunState {
  const ids = [state.player.id, ...state.floor.actors.map((a) => a.id).sort((a, b) => a - b)];
  return ids.reduce((s, id) => fireEvent(s, data, id, event, ctx).state, state);
}

// turn-order.md 6-1: 일시 효과의 turnsLeft 1 감소·만료 제거, 그리고 HP를 최대 HP 이하로
export function tickStatuses(state: RunState, data: GameData): RunState {
  const tick = (a: Actor): Actor =>
    clampHp(
      { ...a, statuses: a.statuses.map((s) => ({ ...s, turnsLeft: s.turnsLeft - 1 })).filter((s) => s.turnsLeft > 0) },
      data,
    );
  return { ...state, player: tick(state.player), floor: { ...state.floor, actors: state.floor.actors.map(tick) } };
}

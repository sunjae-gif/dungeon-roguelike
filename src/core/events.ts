// 30-systems/effects.md 3. 이벤트, 5. 일시 효과, 6. 효과 실행
// 공격과 피해 처리(4절)는 damage.ts
import type { EffectDef, GameData } from '../data/types';
import { clampHp, getStat, immunitiesOf, itemDef, sourcesOf, statusDef, statusImmunity, type EventName } from './effects';
import { addMessage, MESSAGES } from './messages';
import { applyDamage, knockback, type DamageSource } from './damage';
import { chance, useRunRng } from './rng';
import type { Actor, RunState, Status } from './state';

// 3절 처리 규칙 3: 효과가 일으킨 이벤트가 이어지는 깊이 상한
export const MAX_EVENT_DEPTH = 3;

// 4절 공격 정보. onBeforeAttack, onBeforeDamaged의 효과가 기록한다
export interface AttackInfo {
  ignoreDefense: boolean;
  damageOps: { op: 'add' | 'mul'; value: number }[];
  cancelled: boolean;
}

// 이벤트와 함께 전달되는 값. other는 이벤트의 상대(공격 대상, 공격자, 피해 원인)의 id
export interface EventContext {
  other?: number;
  damage?: number;
  attack?: AttackInfo;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  itemId?: string;
  floorNumber?: number;
  trapId?: string;
}

type Fired = { state: RunState; ctx: EventContext };

export function findActor(state: RunState, id: number): Actor | undefined {
  return state.player.id === id ? state.player : state.floor.actors.find((a) => a.id === id);
}

export function updateActor(state: RunState, actor: Actor): RunState {
  if (state.player.id === actor.id) return { ...state, player: actor };
  return { ...state, floor: { ...state.floor, actors: state.floor.actors.map((a) => (a.id === actor.id ? actor : a)) } };
}

// 이벤트 하나를 그 개체의 효과 출처(개체 정의 → 빌드 아이템 → 일시 효과)에 전달한다 (2절, 3절)
export function fireEvent(
  state: RunState,
  data: GameData,
  ownerId: number,
  event: EventName,
  ctx: EventContext = {},
  depth = 1,
): Fired {
  if (depth > MAX_EVENT_DEPTH) {
    console.warn(`이벤트 ${event}: 이어지는 깊이가 ${MAX_EVENT_DEPTH}단계를 넘어 실행하지 않는다.`);
    return { state, ctx };
  }
  const owner = findActor(state, ownerId);
  if (!owner) return { state, ctx };
  let current: Fired = { state, ctx };
  for (const source of sourcesOf(owner, data)) {
    // 5절 규칙 3: 걸린 그 턴의 마무리에서는 일시 효과의 onTurnEnd를 실행하지 않는다
    if (source.status && event === 'onTurnEnd' && source.status.appliedTurn === state.turn) continue;
    for (const trigger of source.triggers) {
      if (trigger.event !== event) continue;
      if (!findActor(current.state, ownerId)) return current; // 앞 효과로 쓰러졌다
      // 3절 규칙 5: chance가 1이 아니면 combat 흐름
      if (trigger.chance < 1) {
        const roll = useRunRng(current.state.rng, 'combat', (rng) => chance(rng, trigger.chance));
        current = { ...current, state: { ...current.state, rng: roll.rng } };
        if (!roll.value) continue;
      }
      // 3절 규칙 6: 발동 메시지
      if (trigger.message) current = { ...current, state: addMessage(current.state, trigger.message, data) };
      // 일시 효과에서 온 피해는 상대가 없다 (3절 규칙 4)
      const origin: DamageSource = source.status
        ? { cause: source.status.id }
        : { actorId: ownerId, cause: owner.defId };
      for (const effect of trigger.effects) {
        current = applyEffect(current.state, data, ownerId, origin, effect, current.ctx, depth);
      }
    }
  }
  return current;
}

// 효과 하나 실행 (6절 "효과 종류" 표)
export function applyEffect(
  state: RunState,
  data: GameData,
  ownerId: number,
  origin: DamageSource,
  effect: EffectDef,
  ctx: EventContext,
  depth: number,
): Fired {
  const targetId = effect.target === 'other' ? ctx.other : ownerId;
  // 3절 규칙 4: 상대가 없으면 아무것도 하지 않는다
  const target = targetId === undefined ? undefined : findActor(state, targetId);
  const attack = ctx.attack;
  // 7절 규칙 1: 면역이면 아무 일도 없고 메시지를 남긴다
  const immunity = immunityFor(effect);
  if (target && immunity && immunitiesOf(target, data).includes(immunity)) {
    return { state: addMessage(state, MESSAGES.immune(actorName(state, data, target)), data), ctx };
  }
  switch (effect.type) {
    case 'heal': {
      if (!target) return { state, ctx };
      const hp = Math.min(target.hp + (effect.amount ?? 0), getStat(target, 'maxHp', data));
      return { state: updateActor(state, { ...target, hp }), ctx };
    }
    case 'damage':
      if (!target) return { state, ctx };
      return { state: applyDamage(state, data, origin, target.id, effect.amount ?? 0, depth + 1), ctx };
    case 'modifyDamage':
      if (!attack || !effect.op) return { state, ctx };
      return { state, ctx: { ...ctx, attack: { ...attack, damageOps: [...attack.damageOps, { op: effect.op, value: effect.value ?? 0 }] } } };
    case 'ignoreDefense':
      return attack ? { state, ctx: { ...ctx, attack: { ...attack, ignoreDefense: true } } } : { state, ctx };
    case 'cancelAttack':
      return attack ? { state, ctx: { ...ctx, attack: { ...attack, cancelled: true } } } : { state, ctx };
    case 'applyStatus':
      if (!target || !effect.status) return { state, ctx };
      return { state: updateActor(state, addStatus(target, effect.status, effect.turns ?? 0, state.turn)), ctx };
    case 'knockback':
      if (!target) return { state, ctx };
      return { state: knockback(state, data, ownerId, target.id, effect.distance ?? 0, effect.collisionDamage ?? 0, depth), ctx };
    case 'steal':
      if (!target) return { state, ctx };
      return { state: steal(state, data, ownerId, target.id), ctx };
    case 'alarm':
      return { state: alarm(state, data, ownerId, effect.radius ?? 0), ctx };
    case 'message':
      return { state: addMessage(state, effect.text ?? '', data), ctx };
    default:
      return { state, ctx };
  }
}

// 7절 면역 표: 이 효과를 막는 면역 값
function immunityFor(effect: EffectDef): string | undefined {
  if (effect.type === 'knockback' || effect.type === 'steal') return effect.type;
  if (effect.type === 'applyStatus' && effect.status) return statusImmunity(effect.status);
  return undefined;
}

export function actorName(state: RunState, data: GameData, actor: Actor): string {
  if (actor.id === state.player.id) return MESSAGES.playerName;
  return data.monsters.find((m) => m.id === actor.defId)?.name ?? actor.defId;
}

// 5절 규칙 1, 2: 일시 효과 걸기. 이미 걸려 있으면 남은 턴을 max로
export function addStatus(actor: Actor, id: string, turns: number, turn: number): Actor {
  const existing = actor.statuses.find((s) => s.id === id);
  if (!existing) return { ...actor, statuses: [...actor.statuses, { id, turnsLeft: turns, appliedTurn: turn }] };
  if (turns <= existing.turnsLeft) return actor;
  const renewed: Status = { id, turnsLeft: turns, appliedTurn: turn };
  return { ...actor, statuses: actor.statuses.map((s) => (s.id === id ? renewed : s)) };
}

// 6절 alarm (F010): 주인 칸에서 4방향 거리 radius 안의 모든 몬스터(벽 무시)가 그 칸을 마지막 목격 위치로
// 매복 몬스터는 깨우지 않는다 (awake를 바꾸지 않는다)
function alarm(state: RunState, data: GameData, ownerId: number, radius: number): RunState {
  const owner = findActor(state, ownerId);
  if (!owner) return state;
  const spot = { x: owner.x, y: owner.y };
  const actors = state.floor.actors.map((a) =>
    a.id !== ownerId && Math.abs(a.x - spot.x) + Math.abs(a.y - spot.y) <= radius ? { ...a, ai: { ...a.ai, lastSeenPlayer: spot } } : a,
  );
  return addMessage({ ...state, floor: { ...state.floor, actors } }, MESSAGES.alarm(), data);
}

// 6절 steal: 대상의 가장 나중에 얻은 소모품을 훔친다. 성공하면 도망 상태
function steal(state: RunState, data: GameData, thiefId: number, targetId: number): RunState {
  const thief = findActor(state, thiefId);
  const target = findActor(state, targetId);
  if (!thief || !target || target.consumables.length === 0) return state;
  const itemId = target.consumables[target.consumables.length - 1];
  let next = updateActor(state, { ...target, consumables: target.consumables.slice(0, -1) });
  next = updateActor(next, { ...thief, carried: [...(thief.carried ?? []), itemId], ai: { ...thief.ai, fleeing: true } });
  const thiefName = data.monsters.find((m) => m.id === thief.defId)?.name ?? thief.defId;
  return addMessage(next, MESSAGES.stole(thiefName, itemDef(data, itemId)?.name ?? itemId), data);
}

// 모든 개체에 같은 이벤트. 플레이어 먼저, 몬스터는 id 순서 (3절 onTurnEnd)
export function fireForAll(state: RunState, data: GameData, event: EventName, ctx: EventContext = {}): RunState {
  const ids = [state.player.id, ...state.floor.actors.map((a) => a.id).sort((a, b) => a - b)];
  return ids.reduce((s, id) => fireEvent(s, data, id, event, ctx).state, state);
}

// turn-order.md 6-2, effects.md 5절 규칙 3, 4: 남은 턴 1 감소(이번 턴에 걸린 것은 제외), 0이면 제거.
// 그리고 HP를 최대 HP 이하로
export function tickStatuses(state: RunState, data: GameData): RunState {
  const tick = (a: Actor): Actor =>
    clampHp(
      {
        ...a,
        statuses: a.statuses
          .map((s) => (s.appliedTurn === state.turn ? s : { ...s, turnsLeft: s.turnsLeft - 1 }))
          .filter((s) => s.turnsLeft > 0),
      },
      data,
    );
  return { ...state, player: tick(state.player), floor: { ...state.floor, actors: state.floor.actors.map(tick) } };
}

// 피해 원인 이름: 몬스터, 일시 효과, 함정(F010)
export function causeName(data: GameData, cause: string): string {
  return (
    data.monsters.find((m) => m.id === cause)?.name ?? statusDef(data, cause)?.name ?? data.traps.find((t) => t.id === cause)?.name ?? cause
  );
}

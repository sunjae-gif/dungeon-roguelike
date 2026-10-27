// 30-systems/effects.md 1. 능력치, 2. 효과의 출처, 표들
// 이벤트와 피해 처리는 events.ts
import { itemDef, monsterDef, statusDef } from '../data/query';
import type { GameData, Modifier, Trigger } from '../data/types';
import { PLAYER_DEF_ID, type Actor, type Status } from './state';

// "능력치 목록" 표
export const STAT_IDS = ['maxHp', 'attack', 'defense', 'attackRange', 'sightRadius'] as const;
export type StatId = (typeof STAT_IDS)[number];

// "이벤트" 표
export const EVENT_NAMES = [
  'onTurnStart',
  'onTurnEnd',
  'onMove',
  'onBeforeAttack',
  'onBeforeDamaged',
  'onHit',
  'onDamaged',
  'onKill',
  'onPickup',
  'onFloorEnter',
  'onTrapTriggered',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

// "효과 종류" 표: type → 필수 필드
export const EFFECT_FIELDS = {
  heal: ['target', 'amount'],
  damage: ['target', 'amount'],
  modifyDamage: ['op', 'value'],
  ignoreDefense: [],
  cancelAttack: [],
  applyStatus: ['target', 'status', 'turns'],
  knockback: ['target', 'distance', 'collisionDamage'],
  steal: ['target'],
  alarm: ['radius'],
  message: ['text'],
} as const;
export type EffectType = keyof typeof EFFECT_FIELDS;
export const EFFECT_TYPES = Object.keys(EFFECT_FIELDS) as EffectType[];

// 함정(traps.json)의 효과는 이벤트가 아니라 밟을 때 실행된다 (F010)
export const TRAP_EVENT = 'trap';

// "쓸 수 있는 이벤트" 열. 없는 종류는 모든 이벤트에서 쓸 수 있다
export const EFFECT_EVENTS: Partial<Record<EffectType, readonly (EventName | typeof TRAP_EVENT)[]>> = {
  alarm: [TRAP_EVENT],
  modifyDamage: ['onBeforeAttack', 'onBeforeDamaged'],
  ignoreDefense: ['onBeforeAttack'],
  cancelAttack: ['onBeforeDamaged'],
  knockback: ['onHit'],
  steal: ['onHit'],
};

export const MODIFIER_OPS = ['add', 'mul'] as const;
export const EFFECT_TARGETS = ['self', 'other'] as const;

// "능력치 목록"의 최솟값
const STAT_MIN: Record<StatId, number> = { maxHp: 1, attack: 0, defense: 0, attackRange: 1, sightRadius: 1 };

// 기본값: 플레이어는 player.json, 몬스터는 monsters.json
export function baseStat(actor: Actor, stat: StatId, data: GameData): number {
  if (actor.defId === PLAYER_DEF_ID) return data.player[stat];
  const def = monsterDef(data, actor.defId);
  if (!def) throw new Error(`monsters.json에 없는 몬스터 "${actor.defId}"`);
  // F004 규칙 9: 몬스터는 개별 시야 능력치가 없다. 몬스터 시야는 monsters.json monsterSightRadius 고정값이다.
  if (stat === 'sightRadius') throw new Error('몬스터 시야는 getStat이 아니라 monsters.json monsterSightRadius를 쓴다 (F004 규칙 7)');
  // 몬스터 항목에 사거리가 없으면 1
  if (stat === 'attackRange') return def.attackRange ?? STAT_MIN.attackRange;
  return def[stat];
}

// 효과의 출처 하나 (2절 표)
export interface EffectSource {
  modifiers: Modifier[];
  triggers: Trigger[];
  status?: Status; // 일시 효과에서 왔으면 그 일시 효과
}

// 2절: 개체 정의 → 빌드 아이템(얻은 순서) → 일시 효과(걸린 순서)
export function sourcesOf(actor: Actor, data: GameData): EffectSource[] {
  const sources: EffectSource[] = [];
  const def = monsterDef(data, actor.defId);
  if (def) {
    // F008: 보스 2단계 보정은 개체 정의 보정에 더한다
    const enraged = def.boss && actor.ai?.enraged ? def.boss.enrage.modifiers : [];
    sources.push({ modifiers: [...(def.modifiers ?? []), ...enraged], triggers: def.triggers ?? [] });
  }
  for (const id of actor.buildItems) {
    const item = itemDef(data, id);
    if (item) sources.push({ modifiers: item.modifiers ?? [], triggers: item.triggers ?? [] });
  }
  for (const status of actor.statuses) {
    const sd = statusDef(data, status.id);
    if (sd) sources.push({ modifiers: sd.modifiers ?? [], triggers: sd.triggers ?? [], status });
  }
  return sources;
}

// 7절 면역: 개체 정의와 가진 빌드 아이템의 immunities를 모두 갖는다
export function immunitiesOf(actor: Actor, data: GameData): string[] {
  const def = monsterDef(data, actor.defId);
  return [...(def?.immunities ?? []), ...actor.buildItems.flatMap((id) => itemDef(data, id)?.immunities ?? [])];
}

export const statusImmunity = (statusId: string) => `status:${statusId}`;

// 최종값 = floor((기본값 + add 합) × (1 + mul 합)), 최솟값·상한 적용. 상태에 저장하지 않고 필요할 때 계산한다.
export function getStat(actor: Actor, stat: StatId, data: GameData): number {
  let add = 0;
  let mul = 0;
  for (const m of sourcesOf(actor, data).flatMap((s) => s.modifiers)) {
    if (m.stat !== stat) continue;
    if (m.op === 'add') add += m.value;
    else mul += m.value;
  }
  const value = Math.max(Math.floor((baseStat(actor, stat, data) + add) * (1 + mul)), STAT_MIN[stat]);
  // 1절: 플레이어 사거리는 maxAttackRange를 넘지 않는다
  if (stat === 'attackRange' && actor.defId === PLAYER_DEF_ID) return Math.min(value, data.player.maxAttackRange);
  return value;
}

// maxHp가 줄어 현재 HP가 최대 HP보다 크면 낮춘다
export function clampHp(actor: Actor, data: GameData): Actor {
  const maxHp = getStat(actor, 'maxHp', data);
  return actor.hp > maxHp ? { ...actor, hp: maxHp } : actor;
}

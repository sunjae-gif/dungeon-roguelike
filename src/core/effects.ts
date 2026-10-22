// 30-systems/effects.md 1. 능력치: 표와 최종 능력치 계산
// 이벤트와 피해 처리는 events.ts
import type { GameData, ItemDef, Modifier } from '../data/types';
import { PLAYER_DEF_ID, type Actor } from './state';

// "능력치 목록" 표
export const STAT_IDS = ['maxHp', 'attack', 'defense', 'sightRadius'] as const;
export type StatId = (typeof STAT_IDS)[number];

// "이벤트" 표
export const EVENT_NAMES = [
  'onTurnStart',
  'onTurnEnd',
  'onMove',
  'onBeforeAttack',
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
  message: ['text'],
} as const;
export type EffectType = keyof typeof EFFECT_FIELDS;
export const EFFECT_TYPES = Object.keys(EFFECT_FIELDS) as EffectType[];

export const MODIFIER_OPS = ['add', 'mul'] as const;
export const EFFECT_TARGETS = ['self', 'other'] as const;

// "계산 순서"의 최솟값
const STAT_MIN: Record<StatId, number> = { maxHp: 1, attack: 0, defense: 0, sightRadius: 1 };

export function itemDef(data: GameData, id: string): ItemDef | undefined {
  return data.items.find((it) => it.id === id);
}

// 기본값: 플레이어는 player.json, 몬스터는 monsters.json
export function baseStat(actor: Actor, stat: StatId, data: GameData): number {
  if (actor.defId === PLAYER_DEF_ID) return data.player[stat];
  const def = data.monsters.find((m) => m.id === actor.defId);
  if (!def) throw new Error(`monsters.json에 없는 몬스터 "${actor.defId}"`);
  return def[stat];
}

// 보정의 출처: 빌드 아이템의 modifiers. 일시 효과(statuses)의 보정은 쓰는 곳이 생기면 여기에 더한다.
function modifiersOf(actor: Actor, data: GameData): Modifier[] {
  return actor.buildItems.flatMap((id) => itemDef(data, id)?.modifiers ?? []);
}

// 최종값 = floor((기본값 + add 합) × (1 + mul 합)), 최솟값 적용. 상태에 저장하지 않고 필요할 때 계산한다.
export function getStat(actor: Actor, stat: StatId, data: GameData): number {
  let add = 0;
  let mul = 0;
  for (const m of modifiersOf(actor, data)) {
    if (m.stat !== stat) continue;
    if (m.op === 'add') add += m.value;
    else mul += m.value;
  }
  const value = Math.floor((baseStat(actor, stat, data) + add) * (1 + mul));
  return Math.max(value, STAT_MIN[stat]);
}

// maxHp가 줄어 현재 HP가 최대 HP보다 크면 낮춘다
export function clampHp(actor: Actor, data: GameData): Actor {
  const maxHp = getStat(actor, 'maxHp', data);
  return actor.hp > maxHp ? { ...actor, hp: maxHp } : actor;
}

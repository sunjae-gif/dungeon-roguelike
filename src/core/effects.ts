// 30-systems/effects.md의 표. 데이터 검사(src/data/validate.ts)가 쓴다.
// 능력치 계산과 이벤트 처리는 M2에서 이 파일에 추가한다.

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

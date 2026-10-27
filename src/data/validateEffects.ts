// 효과 형식 검사 (30-systems/effects.md 3절 확률 규칙, 6절 데이터 형식)
// 아이템·몬스터 특성·일시 효과가 같이 쓴다.
import { EFFECT_EVENTS, EFFECT_FIELDS, EFFECT_TARGETS, EFFECT_TYPES, EVENT_NAMES, MODIFIER_OPS, STAT_IDS, type EffectType } from '../core/effects';

import type { Checker, Obj } from './check';

export interface EffectRefs {
  statuses: Set<string>;
}

export function checkModifiers(c: Checker, o: Obj, p: string): void {
  c.arr(o, 'modifiers', p, true)?.forEach((m, j) => {
    const mp = `${p}.modifiers[${j}]`;
    if (!c.obj(m, mp)) return;
    c.oneOf(m, 'stat', mp, STAT_IDS);
    c.oneOf(m, 'op', mp, MODIFIER_OPS);
    c.num(m, 'value', mp);
  });
}

// certainOnly: 3절 규칙 7. 몬스터 특성과 일시 효과는 chance가 1이어야 한다
export function checkTriggers(c: Checker, o: Obj, p: string, refs: EffectRefs, certainOnly: boolean): void {
  c.arr(o, 'triggers', p, true)?.forEach((t, j) => {
    const tp = `${p}.triggers[${j}]`;
    if (!c.obj(t, tp)) return;
    c.oneOf(t, 'event', tp, EVENT_NAMES);
    c.num(t, 'chance', tp, { min: 0, max: 1 });
    c.str(t, 'message', tp, true);
    if (t.chance !== 1) {
      if (certainOnly) c.fail(`${tp}.chance`, '몬스터 특성과 일시 효과는 chance가 1이어야 함 (effects.md 3절 규칙 7)');
      // 3절 규칙 6: 확률 trigger는 발동 메시지가 있어야 한다
      else if (t.message === undefined) c.fail(`${tp}.message`, 'chance가 1이 아니면 message가 필요함 (effects.md 3절 규칙 6)');
    }
    checkEffects(c, c.arr(t, 'effects', tp), `${tp}.effects`, refs, t.event as string);
  });
}

// event가 없으면(소모품 use) 이벤트 전용 효과를 쓸 수 없다
export function checkEffects(c: Checker, list: unknown[] | null, p: string, refs: EffectRefs, event?: string): void {
  list?.forEach((e, i) => {
    const ep = `${p}[${i}]`;
    if (!c.obj(e, ep)) return;
    c.oneOf(e, 'type', ep, EFFECT_TYPES);
    const type = e.type as EffectType;
    const fields: readonly string[] = EFFECT_FIELDS[type] ?? [];
    for (const f of fields) {
      if (f === 'target') c.oneOf(e, f, ep, EFFECT_TARGETS);
      else if (f === 'op') c.oneOf(e, f, ep, MODIFIER_OPS);
      else if (f === 'text') c.str(e, f, ep);
      else if (f === 'status') {
        c.str(e, f, ep);
        c.ref(e.status, refs.statuses, `${ep}.status`, 'statuses.json');
      } else c.num(e, f, ep);
    }
    const allowed = EFFECT_EVENTS[type];
    if (allowed && !allowed.includes(event as never)) {
      c.fail(`${ep}.type`, `${type}은(는) ${allowed.join(', ')}에서만 쓸 수 있음 (지금: ${event ?? '아이템 사용'})`);
    }
  });
}

// 7절 면역: knockback, steal, status:{statuses.json id}
export function checkImmunities(c: Checker, o: Obj, p: string, refs: EffectRefs): void {
  c.arr(o, 'immunities', p, true)?.forEach((v, i) => {
    const ip = `${p}.immunities[${i}]`;
    if (v === 'knockback' || v === 'steal') return;
    if (typeof v === 'string' && v.startsWith('status:')) return c.ref(v.slice('status:'.length), refs.statuses, ip, 'statuses.json');
    c.fail(ip, `knockback / steal / status:{id} 중 하나여야 함 (지금: ${JSON.stringify(v)})`);
  });
}

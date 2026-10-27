// F016 움직임 연출. 규칙 코드는 연출을 모른다: 이전 상태와 새 상태를 비교해서 연출을 만든다 (원칙 1)
import type { Point } from '../core/dungeon';
import { TRAP_OBJECT_TYPE } from '../core/traps';
import { DIRECTION_DELTAS } from '../core/movement';
import type { Actor, RunState } from '../core/state';
import type { UiData } from '../data/types';

export type Anim =
  | { kind: 'move'; actorId: number; from: Point; start: number; duration: number }
  | { kind: 'bump'; actorId: number; toward: Point; start: number; duration: number }
  | { kind: 'flash'; actorId: number; start: number; duration: number }
  | { kind: 'number'; at: Point; value: number; heal: boolean; slot: number; start: number; duration: number }
  | { kind: 'projectile'; from: Point; to: Point; start: number; duration: number }
  | { kind: 'trapFlash'; at: Point; start: number; duration: number };

const actorsOf = (s: RunState): Actor[] => [s.player, ...s.floor.actors];

// 바라보는 방향으로 같은 줄에 있는가 (공격한 개체는 대상을 바라본다: F002 규칙 5, ai.ts strike)
function faces(actor: Actor, target: Point): number {
  const d = DIRECTION_DELTAS[actor.facing];
  const dx = target.x - actor.x;
  const dy = target.y - actor.y;
  if (d.x !== 0 && dy === 0 && Math.sign(dx) === d.x) return Math.abs(dx);
  if (d.y !== 0 && dx === 0 && Math.sign(dy) === d.y) return Math.abs(dy);
  return 0;
}

// 한 턴 사이에 일어난 일을 연출로. 층·화면이 바뀌었으면 연출 없음. 시간이 0인 연출은 만들지 않는다
export function deriveAnims(prev: RunState, next: RunState, anim: UiData['anim'], now: number): Anim[] {
  if (prev.phase !== 'playing' || prev.floorNumber !== next.floorNumber) return [];
  const before = new Map(actorsOf(prev).map((a) => [a.id, a]));
  const after = new Map(actorsOf(next).map((a) => [a.id, a]));
  const anims: Anim[] = [];
  const slots = new Map<string, number>();
  const nextSlot = (p: Point) => {
    const key = `${p.x},${p.y}`;
    const n = slots.get(key) ?? 0;
    slots.set(key, n + 1);
    return n;
  };

  // 맞은 개체: HP가 줄었거나 사라졌다
  const hurt: { pos: Point; id: number }[] = [];
  for (const [id, b] of before) {
    const a = after.get(id);
    if (!a) {
      if (id !== prev.player.id) hurt.push({ pos: b, id });
      continue;
    }
    // 이동 (밀쳐내기 포함)
    if ((a.x !== b.x || a.y !== b.y) && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) {
      anims.push({ kind: 'move', actorId: id, from: { x: b.x, y: b.y }, start: now, duration: anim.moveMs });
      // 함정 발동: 들어간 칸에 함정이 있었다
      if (prev.floor.objects.some((o) => o.type === TRAP_OBJECT_TYPE && o.x === a.x && o.y === a.y)) {
        anims.push({ kind: 'trapFlash', at: { x: a.x, y: a.y }, start: now, duration: anim.trapFlashMs });
      }
    }
    const delta = a.hp - b.hp;
    if (delta < 0) {
      hurt.push({ pos: a, id });
      anims.push({ kind: 'flash', actorId: id, start: now, duration: anim.hitFlashMs });
    }
    if (delta !== 0) {
      anims.push({ kind: 'number', at: { x: a.x, y: a.y }, value: Math.abs(delta), heal: delta > 0, slot: nextSlot(a), start: now, duration: anim.damageNumberMs });
    }
  }
  // 공격: 움직이지 않고 맞은 개체를 바라보는 개체. 붙어 있으면 내밀기, 떨어져 있으면 날아가는 점
  for (const [id, a] of after) {
    const b = before.get(id);
    if (!b || b.x !== a.x || b.y !== a.y) continue;
    for (const target of hurt) {
      if (target.id === id) continue;
      const distance = faces(a, target.pos);
      if (distance === 1) anims.push({ kind: 'bump', actorId: id, toward: target.pos, start: now, duration: anim.attackBumpMs });
      else if (distance > 1) anims.push({ kind: 'projectile', from: { x: a.x, y: a.y }, to: target.pos, start: now, duration: anim.projectileMs });
    }
  }
  return anims.filter((x) => x.duration > 0);
}

// 그리는 쪽이 쓰는 한 순간의 연출 모습
export interface AnimFrame {
  offset(actor: Actor): Point; // 칸 단위로 그릴 위치를 얼마나 옮기나
  flashing(actorId: number): number; // 흰색 깜빡임 세기 0~1
  numbers: { at: Point; value: number; heal: boolean; rise: number; alpha: number; slot: number }[];
  projectiles: Point[]; // 칸 단위 위치
  trapFlashes: { at: Point; alpha: number }[];
}

// 공격 내밀기 거리: 반 칸 (F016 표)
const BUMP_REACH = 0.5;

const progress = (a: Anim, now: number) => Math.min(1, Math.max(0, (now - a.start) / a.duration));

export class Animator {
  private anims: Anim[] = [];

  // 새 상태가 오면 진행 중인 연출은 버린다 = 바로 끝 상태로 (원칙 2)
  begin(prev: RunState, next: RunState, anim: UiData['anim'], now: number): void {
    this.anims = deriveAnims(prev, next, anim, now);
  }

  active(now: number): boolean {
    return this.anims.some((a) => now < a.start + a.duration);
  }

  frame(now: number): AnimFrame {
    const live = this.anims.filter((a) => now < a.start + a.duration);
    return {
      offset: (actor) => {
        let dx = 0;
        let dy = 0;
        for (const a of live) {
          if (a.kind === 'move' && a.actorId === actor.id) {
            // 이전 칸에서 지금 칸으로 미끄러진다
            const rest = 1 - progress(a, now);
            dx += (a.from.x - actor.x) * rest;
            dy += (a.from.y - actor.y) * rest;
          }
          if (a.kind === 'bump' && a.actorId === actor.id) {
            // 대상 쪽으로 반 칸 나갔다 돌아온다
            const reach = BUMP_REACH * Math.sin(Math.PI * progress(a, now));
            dx += Math.sign(a.toward.x - actor.x) * reach;
            dy += Math.sign(a.toward.y - actor.y) * reach;
          }
        }
        return { x: dx, y: dy };
      },
      flashing: (actorId) => {
        const a = live.find((x) => x.kind === 'flash' && x.actorId === actorId);
        return a ? 1 - progress(a, now) : 0;
      },
      numbers: live.flatMap((a) =>
        a.kind === 'number' ? [{ at: a.at, value: a.value, heal: a.heal, rise: progress(a, now), alpha: 1 - progress(a, now), slot: a.slot }] : [],
      ),
      projectiles: live.flatMap((a) => {
        if (a.kind !== 'projectile') return [];
        const t = progress(a, now);
        return [{ x: a.from.x + (a.to.x - a.from.x) * t, y: a.from.y + (a.to.y - a.from.y) * t }];
      }),
      trapFlashes: live.flatMap((a) => (a.kind === 'trapFlash' ? [{ at: a.at, alpha: 1 - progress(a, now) }] : [])),
    };
  }
}

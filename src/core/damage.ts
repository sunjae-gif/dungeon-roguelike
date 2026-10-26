// 30-systems/effects.md 4. 공격과 피해 처리 순서, 6절 knockback·steal의 떨어뜨리기
import type { GameData } from '../data/types';
import { getStat } from './effects';
import { causeName, fireEvent, findActor, updateActor, type AttackInfo } from './events';
import { addMessage, MESSAGES } from './messages';
import { dropItem } from './floorItems';
import { monsterDrop } from './items';
import { isPassable } from './movement';
import type { Actor, RunState } from './state';

// 피해의 출처. actorId는 상대(onDamaged의 other)가 될 개체, cause는 killedBy에 남길 원인 id
export interface DamageSource {
  actorId?: number;
  cause: string;
}

export interface AttackResult {
  state: RunState;
  damage: number;
  killed: boolean;
  cancelled: boolean;
}

// 4절 1~9단계
// extraOps: 공격 자체에 붙은 피해 수정 (F008 강타 ×2). 효과가 기록한 것보다 먼저 적용된다
export function resolveAttack(
  state: RunState,
  data: GameData,
  attackerId: number,
  targetId: number,
  extraOps: AttackInfo['damageOps'] = [],
): AttackResult {
  const miss = (s: RunState): AttackResult => ({ state: s, damage: 0, killed: false, cancelled: false });
  if (!findActor(state, attackerId) || !findActor(state, targetId)) return miss(state);
  // 1~3. 공격 정보를 만들고 공격자, 대상 순서로 기록
  const info: AttackInfo = { ignoreDefense: false, damageOps: [...extraOps], cancelled: false };
  let fired = fireEvent(state, data, attackerId, 'onBeforeAttack', { other: targetId, attack: info });
  fired = fireEvent(fired.state, data, targetId, 'onBeforeDamaged', { other: attackerId, attack: fired.ctx.attack });
  const attack = fired.ctx.attack ?? info;
  // 4. 회피
  if (attack.cancelled) return { ...miss(fired.state), cancelled: true };
  const attacker = findActor(fired.state, attackerId);
  const target = findActor(fired.state, targetId);
  if (!attacker || !target) return miss(fired.state);
  // 5. 기본 피해, 6. 기록된 순서대로 수정 → 소수 버림 → 최솟값 1
  const defense = attack.ignoreDefense ? 0 : getStat(target, 'defense', data);
  const base = getStat(attacker, 'attack', data) - defense;
  const modified = attack.damageOps.reduce((d, o) => (o.op === 'mul' ? d * o.value : d + o.value), base);
  const damage = Math.max(1, Math.floor(modified));
  // 7. HP 감소, 8. onHit, onDamaged
  let next = updateActor(fired.state, wake({ ...target, hp: target.hp - damage }));
  next = fireEvent(next, data, attackerId, 'onHit', { other: targetId, damage }).state;
  next = fireEvent(next, data, targetId, 'onDamaged', { other: attackerId, damage }).state;
  // 9. 쓰러짐
  next = attackDeath(next, data, attackerId, targetId);
  const after = findActor(next, targetId);
  return { state: next, damage, killed: !after || after.hp <= 0, cancelled: false };
}

// F014 ambush: 피해를 받으면 깨어난다
function wake(actor: Actor): Actor {
  return actor.ai ? { ...actor, ai: { ...actor.ai, awake: true } } : actor;
}

// 4절 9단계: 공격으로 쓰러짐. 몬스터면 onKill 후 제거, 플레이어가 쓰러뜨렸으면 처치 수 +1 (F003 규칙 3)
function attackDeath(state: RunState, data: GameData, attackerId: number, targetId: number): RunState {
  const target = findActor(state, targetId);
  // 대상이 이미 없으면 효과 피해(가시·충돌)로 먼저 쓰러져 처리가 끝났다
  if (!target || target.hp > 0) return state;
  if (targetId === state.player.id) return recordPlayerDeath(state, findActor(state, attackerId)?.defId);
  let next = fireEvent(state, data, attackerId, 'onKill', { other: targetId }).state;
  next = removeMonster(next, data, targetId);
  if (attackerId === next.player.id) next = { ...next, runStats: { ...next.runStats, kills: next.runStats.kills + 1 } };
  return next;
}

function recordPlayerDeath(state: RunState, cause: string | undefined): RunState {
  if (cause === undefined || state.runStats.killedBy !== undefined) return state;
  return { ...state, runStats: { ...state.runStats, killedBy: cause } };
}

// 4절 "공격이 아닌 피해": 방어 무시, onDamaged만 발생. 몬스터가 죽으면 처치 수에 넣고 onKill은 없다
export function applyDamage(
  state: RunState,
  data: GameData,
  source: DamageSource,
  targetId: number,
  amount: number,
  depth: number,
): RunState {
  const target = findActor(state, targetId);
  if (!target) return state;
  let next = updateActor(state, wake({ ...target, hp: target.hp - amount }));
  next = fireEvent(next, data, targetId, 'onDamaged', { other: source.actorId, damage: amount }, depth).state;
  const after = findActor(next, targetId);
  if (!after || after.hp > 0) return next;
  if (targetId === next.player.id) {
    if (next.runStats.killedBy !== undefined) return next;
    // 게임 오버 문구: 몬스터면 "{몬스터}에게 쓰러졌다", 일시 효과면 "{원인}(으)로 쓰러졌다"
    const isMonster = data.monsters.some((m) => m.id === source.cause);
    const name = causeName(data, source.cause);
    next = addMessage(next, isMonster ? MESSAGES.playerKilled(name) : MESSAGES.playerKilledBy(name), data);
    return recordPlayerDeath(next, source.cause);
  }
  return sweepDeadMonsters(next, data);
}

// turn-order.md 6-3: HP가 0 이하인 몬스터 제거·처치 수 증가 (onKill 없음)
export function sweepDeadMonsters(state: RunState, data: GameData): RunState {
  let next = state;
  for (const dead of state.floor.actors.filter((a) => a.hp <= 0)) {
    next = removeMonster(next, data, dead.id);
    next = { ...next, runStats: { ...next.runStats, kills: next.runStats.kills + 1 } };
  }
  return next;
}

// 몬스터 제거. 훔친 물건(carried)이 있으면 떨어뜨린다 (6절 steal 규칙 5)
// F008 규칙 15: 보스가 어떤 이유로든 쓰러지면 bossKilled
function removeMonster(state: RunState, data: GameData, id: number): RunState {
  const monster = state.floor.actors.find((a) => a.id === id);
  if (!monster) return state;
  let next: RunState = { ...state, floor: { ...state.floor, actors: state.floor.actors.filter((a) => a.id !== id) } };
  if (data.monsters.find((m) => m.id === monster.defId)?.isBoss) {
    next = { ...next, runStats: { ...next.runStats, bossKilled: true } };
  }
  // effects.md 6절 steal 규칙 5: 훔친 물건을 떨어뜨린다
  for (const itemId of monster.carried ?? []) next = dropItem(next, itemId, monster);
  // F005 규칙 6: 몬스터 드롭 (보스 제외, 처치 원인과 상관없이)
  return monsterDrop(next, data, monster);
}

// 6절 knockback: 공격자 → 대상 방향으로 distance칸. 막히면 그 자리에서 충돌 피해(공격이 아닌 피해)
export function knockback(
  state: RunState,
  data: GameData,
  ownerId: number,
  targetId: number,
  distance: number,
  collisionDamage: number,
  depth: number,
): RunState {
  const owner = findActor(state, ownerId);
  const target = findActor(state, targetId);
  // 이미 쓰러진 대상은 밀지 않는다
  if (!owner || !target || target.hp <= 0) return state;
  const dx = Math.sign(target.x - owner.x);
  const dy = Math.sign(target.y - owner.y);
  if (Math.abs(dx) + Math.abs(dy) !== 1) return state;
  let next = state;
  for (let i = 0; i < distance; i++) {
    const cur = findActor(next, targetId)!;
    const to = { x: cur.x + dx, y: cur.y + dy };
    if (!isPassable(next, to.x, to.y)) {
      return applyDamage(next, data, { actorId: ownerId, cause: owner.defId }, targetId, collisionDamage, depth + 1);
    }
    next = updateActor(next, { ...cur, ...to });
    // 밀려난 칸의 함정은 F010에서
  }
  return next;
}

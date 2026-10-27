// F003 전투: 공격 실행과 전투 메시지
import { monsterDef, monsterName } from '../data/query';
import type { GameData } from '../data/types';
import { resolveAttack } from './damage';
import { findActor, type AttackInfo } from './events';
import { addMessage, MESSAGES } from './messages';
import type { RunState } from './state';

// F003 규칙 2~5: 피해 처리(effects.md)를 하고 결과를 메시지 로그에 남긴다
export interface AttackOptions {
  ranged?: boolean; // 원거리 공격 메시지 (F014)
  extraOps?: AttackInfo['damageOps']; // F008 강타
}

export function attack(state: RunState, data: GameData, attackerId: number, targetId: number, options: AttackOptions = {}): RunState {
  const { ranged = false, extraOps = [] } = options;
  const attacker = findActor(state, attackerId);
  const target = findActor(state, targetId);
  if (!attacker || !target) return state;
  const result = resolveAttack(state, data, attackerId, targetId, extraOps);
  let next = result.state;
  // 회피: 발동 메시지는 trigger가 남겼다 (effects.md 3절 규칙 6)
  if (result.cancelled) return next;
  const playerId = state.player.id;
  if (attackerId === playerId) {
    const name = monsterName(data, target.defId);
    next = addMessage(next, MESSAGES.playerHit(name, result.damage), data);
    if (result.killed) next = addMessage(next, MESSAGES.monsterKilled(name), data);
  } else if (targetId === playerId) {
    const def = monsterDef(data, attacker.defId);
    const name = monsterName(data, attacker.defId);
    const text = ranged
      ? MESSAGES.monsterShot(name, def?.attackVerb ?? MESSAGES.defaultAttackVerb, result.damage)
      : MESSAGES.monsterHit(name, result.damage);
    next = addMessage(next, text, data);
    if (result.killed) next = addMessage(next, MESSAGES.playerKilled(name), data);
  }
  return next;
}

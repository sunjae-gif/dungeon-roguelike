// F003 전투: 공격 실행과 전투 메시지
import type { GameData } from '../data/types';
import { resolveAttack } from './damage';
import { findActor } from './events';
import { addMessage, MESSAGES } from './messages';
import type { RunState } from './state';

export function monsterName(data: GameData, defId: string): string {
  return data.monsters.find((m) => m.id === defId)?.name ?? defId;
}

// F003 규칙 2~5: 피해 처리(effects.md)를 하고 결과를 메시지 로그에 남긴다
// ranged: 원거리 공격 메시지를 쓴다 (F014)
export function attack(state: RunState, data: GameData, attackerId: number, targetId: number, ranged = false): RunState {
  const attacker = findActor(state, attackerId);
  const target = findActor(state, targetId);
  if (!attacker || !target) return state;
  const result = resolveAttack(state, data, attackerId, targetId);
  let next = result.state;
  // 회피: 발동 메시지는 trigger가 남겼다 (effects.md 3절 규칙 6)
  if (result.cancelled) return next;
  const playerId = state.player.id;
  if (attackerId === playerId) {
    const name = monsterName(data, target.defId);
    next = addMessage(next, MESSAGES.playerHit(name, result.damage), data);
    if (result.killed) next = addMessage(next, MESSAGES.monsterKilled(name), data);
  } else if (targetId === playerId) {
    const def = data.monsters.find((m) => m.id === attacker.defId);
    const name = monsterName(data, attacker.defId);
    const text = ranged
      ? MESSAGES.monsterShot(name, def?.attackVerb ?? MESSAGES.defaultAttackVerb, result.damage)
      : MESSAGES.monsterHit(name, result.damage);
    next = addMessage(next, text, data);
    if (result.killed) next = addMessage(next, MESSAGES.playerKilled(name), data);
  }
  return next;
}

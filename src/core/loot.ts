// loot 난수 흐름과 몬스터 드롭 (F005, rng.md)
import { monsterDef } from '../data/query';
import type { GameData } from '../data/types';
import { dropItem } from './floorItems';
import { chance, hashSeed, useStoredRng, type Rng } from './rng';
import type { Actor, RunState } from './state';

// loot 흐름은 층 안에서 RunState.rng.loot에 이어 쓴다 (rng.md)
export function withLoot<T>(state: RunState, fn: (rng: Rng) => T): { value: T; state: RunState } {
  const rngState = state.rng.loot === undefined ? { ...state.rng, loot: hashSeed(state.runSeed, state.floorNumber, 'loot') } : state.rng;
  const used = useStoredRng(rngState, 'loot', fn);
  return { value: used.value, state: { ...state, rng: used.rng } };
}

// F005 규칙 6: 보스가 아니면 monsterDrop.chance 확률로 그 칸에 떨어뜨린다
export function monsterDrop(state: RunState, data: GameData, monster: Actor): RunState {
  if (monsterDef(data, monster.defId)?.isBoss) return state;
  const { item, chance: p } = data.loot.monsterDrop;
  const roll = withLoot(state, (rng) => chance(rng, p));
  return roll.value ? dropItem(roll.state, item, monster) : roll.state;
}

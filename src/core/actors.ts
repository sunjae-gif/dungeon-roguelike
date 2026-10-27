// 개체 찾기·바꾸기, 이름 (여러 규칙 모듈이 같이 쓴다)
import { monsterDef, monsterName, statusDef, trapDef } from '../data/query';
import type { GameData } from '../data/types';
import { MESSAGES } from './messages';
import type { Actor, RunState } from './state';

export function findActor(state: RunState, id: number): Actor | undefined {
  return state.player.id === id ? state.player : state.floor.actors.find((a) => a.id === id);
}

export function updateActor(state: RunState, actor: Actor): RunState {
  if (state.player.id === actor.id) return { ...state, player: actor };
  return { ...state, floor: { ...state.floor, actors: state.floor.actors.map((a) => (a.id === actor.id ? actor : a)) } };
}

// 메시지에서 부르는 이름. 플레이어는 "당신" (glossary)
export function actorName(state: RunState, data: GameData, actor: Actor): string {
  if (actor.id === state.player.id) return MESSAGES.playerName;
  return monsterName(data, actor.defId);
}

// 피해 원인 이름: 몬스터, 일시 효과, 함정 (effects.md 4절, F010)
export function causeName(data: GameData, cause: string): string {
  return monsterDef(data, cause)?.name ?? statusDef(data, cause)?.name ?? trapDef(data, cause)?.name ?? cause;
}

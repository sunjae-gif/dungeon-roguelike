// F012 개발자 모드 명령. 화면(devMode.ts)과 나눠서 테스트할 수 있게 한다.
// 바뀐 상태도 game-state.md 구조를 그대로 따른다.
import { addBuildItem } from '../core/items';
import { createRun, enterFloor } from '../core/run';
import { type RunState, STATE_VERSION } from '../core/state';
import { itemDef } from '../data/query';
import type { GameData } from '../data/types';

export type DevResult = { ok: true; state: RunState; note: string } | { ok: false; error: string };

// 아이템 생성: items.json id를 소모품이면 인벤토리, 빌드 아이템이면 빌드에 넣는다
export function grantItem(state: RunState, data: GameData, id: string): DevResult {
  const def = itemDef(data, id.trim());
  if (!def) return { ok: false, error: `items.json에 없는 id "${id}"` };
  const { player } = state;
  if (def.kind === 'build') {
    return { ok: true, state: addBuildItem(state, data, def.id), note: `빌드에 ${def.name}` };
  }
  if (player.consumables.length >= data.player.inventorySize) return { ok: false, error: '인벤토리가 가득 찼다' };
  return { ok: true, state: { ...state, player: { ...player, consumables: [...player.consumables, def.id] } }, note: `인벤토리에 ${def.name}` };
}

// 층 이동: HP·아이템을 유지한 채 원하는 층으로
export function jumpToFloor(state: RunState, data: GameData, floorNumber: number): DevResult {
  if (!Number.isInteger(floorNumber) || floorNumber < 1 || floorNumber > data.dungeon.maxFloor) {
    return { ok: false, error: `층은 1~${data.dungeon.maxFloor}` };
  }
  return { ok: true, state: { ...enterFloor(state, data, floorNumber), phase: 'floorIntro' }, note: `${floorNumber}층으로` };
}

// 시드로 시작: 1층부터 새 판
export function startWithSeed(data: GameData, seed: number): DevResult {
  return { ok: true, state: createRun(data, seed, 'floorIntro'), note: '새 판' };
}

// 지도 공개: 모든 칸을 탐색됨으로 (숨은 물체는 F010이 생기면 여기서 드러낸다)
export function revealMap(state: RunState): DevResult {
  return { ok: true, state: { ...state, floor: { ...state.floor, explored: state.floor.explored.map(() => true) } }, note: '지도 공개' };
}

// 상태 불러오기: 내보낸 JSON을 그대로 쓴다
export function loadState(json: string): DevResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'JSON 형식이 아니다' };
  }
  const s = parsed as Partial<RunState>;
  if (s?.version !== STATE_VERSION || !s.floor || !s.player || typeof s.runSeed !== 'number') {
    return { ok: false, error: `RunState(version ${STATE_VERSION})가 아니다` };
  }
  return { ok: true, state: s as RunState, note: '상태 불러옴' };
}

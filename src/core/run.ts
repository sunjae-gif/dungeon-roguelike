// 새 판과 새 층의 상태를 만든다. 30-systems/game-state.md
import type { GameData } from '../data/types';
import { generateFloor } from './dungeon';
import { getStat } from './effects';
import { fireEvent } from './events';
import { addMessage, MESSAGES } from './messages';
import { updateSight } from './movement';
import { initRunRng } from './rng';
import { PLAYER_DEF_ID, STATE_VERSION, type Actor, type Phase, type RunState } from './state';

export function createPlayer(data: GameData, id: number): Actor {
  return {
    id,
    defId: PLAYER_DEF_ID,
    x: 0,
    y: 0,
    facing: 'down',
    hp: data.player.maxHp,
    buildItems: [],
    consumables: [],
    statuses: [],
  };
}

export function createRun(data: GameData, runSeed: number, phase: Phase): RunState {
  const seed = runSeed >>> 0;
  const firstFloor = 1;
  const playerId = 1;
  const { floor, start, nextId } = generateFloor(data, seed, firstFloor, playerId + 1);
  const run: RunState = {
    version: STATE_VERSION,
    runSeed: seed,
    rng: initRunRng(seed),
    phase,
    floorNumber: firstFloor,
    turn: 0,
    nextId,
    player: { ...createPlayer(data, playerId), ...start },
    floor,
    messageLog: [],
    runStats: { kills: 0, floorsReached: firstFloor, itemsFound: 0 },
  };
  return arrive(run, data);
}

// F013: 다른 층으로 옮긴다. 플레이어의 HP·아이템은 그대로 두고 위치만 새 층의 시작 지점으로.
// 이전 층의 상태는 버린다. 시야는 바로 계산한다.
export function enterFloor(state: RunState, data: GameData, floorNumber: number): RunState {
  const { floor, start, nextId } = generateFloor(data, state.runSeed, floorNumber, state.nextId);
  const next: RunState = {
    ...state,
    floorNumber,
    floor,
    nextId,
    player: { ...state.player, ...start },
    runStats: { ...state.runStats, floorsReached: Math.max(state.runStats.floorsReached, floorNumber) },
  };
  return arrive(next, data);
}

// 새 층에 들어온 직후: 메시지, onFloorEnter, 시야
function arrive(state: RunState, data: GameData): RunState {
  let next = addMessage(state, MESSAGES.enteredFloor(state.floorNumber), data);
  next = fireEvent(next, data, next.player.id, 'onFloorEnter', { floorNumber: next.floorNumber }).state;
  return updateSight(next, getStat(next.player, 'sightRadius', data));
}

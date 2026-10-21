// 새 판과 새 층의 상태를 만든다. 30-systems/game-state.md
import { themeForFloor } from '../data/query';
import type { GameData } from '../data/types';
import { initRunRng } from './rng';
import { PLAYER_DEF_ID, STATE_VERSION, type Actor, type FloorState, type Phase, type RunState } from './state';

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

// 층 상태를 만든다.
// 지금은 테마 크기만 맞춘 벽뿐인 층이다. M1에서 F001 던전 생성으로 바꾼다.
export function createFloor(data: GameData, floorNumber: number): FloorState {
  const theme = themeForFloor(data, floorNumber);
  const size = theme.mapWidth * theme.mapHeight;
  return {
    themeId: theme.id,
    width: theme.mapWidth,
    height: theme.mapHeight,
    tiles: new Array(size).fill('wall'),
    explored: new Array(size).fill(false),
    visible: new Array(size).fill(false),
    rooms: [],
    objects: [],
    actors: [],
    items: [],
  };
}

export function createRun(data: GameData, runSeed: number, phase: Phase): RunState {
  const seed = runSeed >>> 0;
  const firstFloor = 1;
  let nextId = 1;
  const player = createPlayer(data, nextId++);
  return {
    version: STATE_VERSION,
    runSeed: seed,
    rng: initRunRng(seed),
    phase,
    floorNumber: firstFloor,
    turn: 0,
    nextId,
    player,
    floor: createFloor(data, firstFloor),
    messageLog: [],
    runStats: { kills: 0, floorsReached: firstFloor, itemsFound: 0 },
  };
}

// 다른 층으로 옮긴다. 플레이어의 HP·아이템은 그대로 둔다.
export function enterFloor(state: RunState, data: GameData, floorNumber: number): RunState {
  return {
    ...state,
    floorNumber,
    floor: createFloor(data, floorNumber),
    runStats: { ...state.runStats, floorsReached: Math.max(state.runStats.floorsReached, floorNumber) },
  };
}

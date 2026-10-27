// 새 판과 새 층의 상태를 만든다. 30-systems/game-state.md
import { isThemeStart, themeForFloor } from '../data/query';
import type { GameData } from '../data/types';
import { generateFloor } from './dungeon';
import { getStat } from './effects';
import { fireEvent } from './events';
import { placeBoss } from './boss';
import { placeDoors } from './doors';
import { floorRng, initRunRng } from './rng';
import { placeTraps } from './traps';
import { placeFloorItems } from './items';
import { placeRoomFeatures } from './roomFeatures';
import { addMessage, MESSAGES } from './messages';
import { noticeMonsters, spawnMonsters } from './monsters';
import { updateSight } from './movement';
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
  const { floor, start, nextId, lootState } = buildFloor(data, seed, firstFloor, playerId + 1);
  const run: RunState = {
    version: STATE_VERSION,
    runSeed: seed,
    rng: { ...initRunRng(seed), loot: lootState },
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
  const { floor, start, nextId, lootState } = buildFloor(data, state.runSeed, floorNumber, state.nextId);
  const next: RunState = {
    ...state,
    // rng.md: loot 흐름은 층을 만들 때 다시 시작한다
    rng: { ...state.rng, loot: lootState },
    floorNumber,
    floor,
    nextId,
    player: { ...state.player, ...start },
    runStats: { ...state.runStats, floorsReached: Math.max(state.runStats.floorsReached, floorNumber) },
  };
  return arrive(next, data);
}

// F001 지형·방 종류 → F009 상자·샘 → F010 문·함정 → F004 몬스터 → F008 보스 → F005 바닥 소모품
function buildFloor(data: GameData, runSeed: number, floorNumber: number, firstId: number) {
  const generated = generateFloor(data, runSeed, floorNumber, firstId);
  const withChest = placeRoomFeatures(generated.floor, generated.nextId); // F005 상자, F009 비밀방 상자·샘
  // F010: 문 → 함정 (objects 흐름)
  const objectsRng = floorRng(runSeed, floorNumber, 'objects');
  const doors = placeDoors(withChest.floor, data, floorNumber, objectsRng, withChest.nextId);
  const traps = placeTraps(doors.floor, data, floorNumber, objectsRng, doors.nextId);
  const spawned = spawnMonsters(traps.floor, data, runSeed, floorNumber, traps.nextId);
  const boss = placeBoss(spawned.floor, data, floorNumber, spawned.nextId); // F008
  const items = placeFloorItems(boss.floor, data, runSeed, floorNumber, boss.nextId, generated.start);
  return { floor: items.floor, start: generated.start, nextId: items.nextId, lootState: items.lootState };
}

// 새 층에 들어온 직후: 메시지, onFloorEnter, 시야
function arrive(state: RunState, data: GameData): RunState {
  let next = state;
  // F011 규칙 5: 테마가 바뀌는 층에 처음 들어가면
  if (isThemeStart(data, state.floorNumber)) next = addMessage(next, MESSAGES.themeEntered(themeForFloor(data, state.floorNumber).name), data);
  next = addMessage(next, MESSAGES.enteredFloor(state.floorNumber), data);
  next = fireEvent(next, data, next.player.id, 'onFloorEnter', { floorNumber: next.floorNumber }).state;
  return noticeMonsters(updateSight(next, getStat(next.player, 'sightRadius', data)), data);
}

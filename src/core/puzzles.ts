// F009 퍼즐방: 판 찍기, 무너지는 발판, 돌 밀기, 되돌림 레버
import type { GameData, PuzzleDef } from '../data/types';
import type { Point } from './dungeon';
import { CHEST_OBJECT_TYPE } from './items';
import { addMessage, MESSAGES } from './messages';
import { DIRECTION_DELTAS, inBounds, isPassable, monsterAt, objectAt } from './movement';
import { nextInt, type Rng } from './rng';
import { NORMAL_ROOM_TYPE, PUZZLE_ROOM_TYPE } from './roomTypes';
import { AROUND, inRoom, pointKey, roomEntrances } from './rooms';
import { type Direction, type FloorState, type MapObject, type Room, type RunState, tileIndex } from './state';

export const PLATE_OBJECT_TYPE = 'plate';
export const BOULDER_OBJECT_TYPE = 'boulder';
export const SWITCH_OBJECT_TYPE = 'switch';
export const LEVER_OBJECT_TYPE = 'lever';

// 규칙 21: 몬스터가 들어가지 않는 퍼즐 판의 칸 (돌·레버·상자는 원래 막혀 있다)
export const isPuzzleTile = (o: MapObject | undefined) => o?.type === PLATE_OBJECT_TYPE || o?.type === SWITCH_OBJECT_TYPE;

// 판은 방 가운데에 놓는다 (규칙 16). 뒤집어도 크기는 같다
export function boardRect(room: Room, def: PuzzleDef): { x: number; y: number; w: number; h: number } {
  const w = def.map[0].length;
  const h = def.map.length;
  return { x: room.x + Math.floor((room.w - w) / 2), y: room.y + Math.floor((room.h - h) / 2), w, h };
}

function orient(map: string[], flipX: boolean, flipY: boolean): string[] {
  const rows = flipY ? [...map].reverse() : map;
  return flipX ? rows.map((r) => [...r].reverse().join('')) : rows;
}

const FLIPS: [boolean, boolean][] = [
  [false, false],
  [true, false],
  [false, true],
  [true, true],
];

// 규칙 15~17: 퍼즐방마다 판을 고르고(objects 흐름) 찍는다. 레버가 입구 칸이나 그 상하좌우에 오면 뒤집어 보고, 안 되면 다른 판.
// 맞는 판이 없으면 그 방은 퍼즐방이 되지 않는다
export function placePuzzles(floor: FloorState, data: GameData, rng: Rng, firstId: number): { floor: FloorState; nextId: number } {
  let next = floor;
  let nextId = firstId;
  for (const room of floor.rooms.filter((r) => r.type === PUZZLE_ROOM_TYPE)) {
    const near = new Set(roomEntrances(next, room).flatMap((e) => [e, ...AROUND(e)]).map(pointKey));
    const candidates = data.puzzles.filter((p) => p.map[0].length <= room.w && p.map.length <= room.h);
    let stamped: { floor: FloorState; nextId: number } | null = null;
    while (!stamped && candidates.length > 0) {
      const def = candidates.splice(nextInt(rng, 0, candidates.length - 1), 1)[0];
      const rect = boardRect(room, def);
      for (const [fx, fy] of FLIPS) {
        const map = orient(def.map, fx, fy);
        const ly = map.findIndex((r) => r.includes('L'));
        const lever = { x: rect.x + map[ly].indexOf('L'), y: rect.y + ly };
        if (near.has(pointKey(lever))) continue;
        stamped = stamp(next, room, def.id, map, rect, nextId);
        break;
      }
    }
    if (stamped) {
      next = stamped.floor;
      nextId = stamped.nextId;
    } else {
      next = { ...next, rooms: next.rooms.map((r) => (r.id === room.id ? { ...r, type: NORMAL_ROOM_TYPE } : r)) };
    }
  }
  return { floor: next, nextId };
}

function stamp(floor: FloorState, room: Room, puzzleId: string, map: string[], rect: { x: number; y: number }, firstId: number) {
  let nextId = firstId;
  const tiles = [...floor.tiles];
  const objects = [...floor.objects];
  const put = (o: Omit<MapObject, 'id'>) => objects.push({ id: nextId++, ...o });
  map.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      const x = rect.x + dx;
      const y = rect.y + dy;
      const base = { x, y, blocksSight: false };
      if (ch === '#') tiles[tileIndex(floor, x, y)] = 'wall';
      else if (ch === 'o') put({ ...base, type: PLATE_OBJECT_TYPE, blocksMove: false, state: { stepped: false, broken: false } });
      else if (ch === 'B') put({ ...base, type: BOULDER_OBJECT_TYPE, blocksMove: true, state: { homeX: x, homeY: y } });
      else if (ch === 'S') put({ ...base, type: SWITCH_OBJECT_TYPE, blocksMove: false, state: { pressed: false } });
      else if (ch === 'C') put({ ...base, type: CHEST_OBJECT_TYPE, blocksMove: true, state: { opened: false, locked: true, source: 'puzzle' } });
      else if (ch === 'L') put({ ...base, type: LEVER_OBJECT_TYPE, blocksMove: true, state: {} });
    });
  });
  const rooms = floor.rooms.map((r) => (r.id === room.id ? { ...r, state: { puzzleId, solved: false } } : r));
  return { floor: { ...floor, tiles, objects, rooms }, nextId };
}

const puzzleRoomOf = (state: RunState, p: Point) => state.floor.rooms.find((r) => r.type === PUZZLE_ROOM_TYPE && inRoom(r, p));
const inPuzzle = (room: Room) => (o: MapObject) => inRoom(room, o);

function updateObjects(state: RunState, fn: (o: MapObject) => MapObject): RunState {
  return { ...state, floor: { ...state.floor, objects: state.floor.objects.map(fn) } };
}

// turn-order.md 4-1, 규칙 23: 플레이어가 발판에서 나오면 그 발판이 무너지고, 들어간 발판은 밟은 것이 된다
export function stepPlates(state: RunState, from: Point): RunState {
  const room = puzzleRoomOf(state, from) ?? puzzleRoomOf(state, state.player);
  if (!room || room.state.solved) return state;
  const to = state.player;
  return updateObjects(state, (o) => {
    if (o.type !== PLATE_OBJECT_TYPE) return o;
    if (o.x === from.x && o.y === from.y) return { ...o, blocksMove: true, state: { ...o.state, broken: true } };
    if (o.x === to.x && o.y === to.y) return { ...o, state: { ...o.state, stepped: true } };
    return o;
  });
}

// 규칙 27, 28: 돌 너머 칸이 바닥이고 개체·다른 돌·스위치가 아닌 물체가 없을 때만 밀린다
export function canPushBoulder(state: RunState, boulder: MapObject, direction: Direction): boolean {
  const d = DIRECTION_DELTAS[direction];
  const x = boulder.x + d.x;
  const y = boulder.y + d.y;
  const { floor } = state;
  if (!inBounds(floor, x, y) || floor.tiles[tileIndex(floor, x, y)] !== 'floor') return false;
  if (monsterAt(floor, x, y) || (state.player.x === x && state.player.y === y)) return false;
  return floor.objects.every((o) => o.x !== x || o.y !== y || o.type === SWITCH_OBJECT_TYPE);
}

// 규칙 29: 스위치는 돌이 올라가 있으면 눌린다
function updateSwitches(state: RunState): RunState {
  const boulders = new Set(state.floor.objects.filter((o) => o.type === BOULDER_OBJECT_TYPE).map(pointKey));
  return updateObjects(state, (o) => (o.type === SWITCH_OBJECT_TYPE ? { ...o, state: { ...o.state, pressed: boulders.has(pointKey(o)) } } : o));
}

// 규칙 27: 돌이 한 칸 밀리고 플레이어가 따라간다 (한 턴)
export function pushBoulder(state: RunState, boulderId: number, direction: Direction): RunState {
  const boulder = state.floor.objects.find((o) => o.id === boulderId)!;
  const d = DIRECTION_DELTAS[direction];
  const moved = updateObjects(state, (o) => (o.id === boulderId ? { ...o, x: o.x + d.x, y: o.y + d.y } : o));
  return updateSwitches({ ...moved, player: { ...moved.player, x: boulder.x, y: boulder.y, facing: direction } });
}

// 규칙 19, 24: 판을 처음 상태로
function resetPuzzle(state: RunState, room: Room): RunState {
  const occupied = (x: number, y: number) => monsterAt(state.floor, x, y) || (state.player.x === x && state.player.y === y);
  const reset = updateObjects(state, (o) => {
    if (!inRoom(room, o)) return o;
    if (o.type === PLATE_OBJECT_TYPE) return { ...o, blocksMove: false, state: { ...o.state, stepped: false, broken: false } };
    if (o.type === BOULDER_OBJECT_TYPE) {
      const home = { x: o.state.homeX as number, y: o.state.homeY as number };
      return occupied(home.x, home.y) ? o : { ...o, ...home };
    }
    return o;
  });
  return updateSwitches(reset);
}

// 규칙 19: 레버를 당기면 판이 처음 상태로 (한 턴). 푼 뒤에는 아무것도 하지 않는다
export function leverWorks(state: RunState, lever: MapObject): boolean {
  const room = puzzleRoomOf(state, lever);
  return !!room && !room.state.solved;
}

export function pullLever(state: RunState, data: GameData, leverId: number): RunState {
  const lever = state.floor.objects.find((o) => o.id === leverId)!;
  return addMessage(resetPuzzle(state, puzzleRoomOf(state, lever)!), MESSAGES.puzzleReset(), data);
}

// turn-order.md 6-3-1: 퍼즐 판정 (풀렸으면 잠금 해제, 무너지는 발판에 갇혔으면 되돌리기)
export function checkPuzzles(state: RunState, data: GameData): RunState {
  let next = state;
  for (const room of state.floor.rooms.filter((r) => r.type === PUZZLE_ROOM_TYPE && !r.state.solved)) {
    const def = data.puzzles.find((p) => p.id === room.state.puzzleId);
    if (!def) continue;
    const objects = next.floor.objects.filter(inPuzzle(room));
    if (def.type === 'crumble') {
      const plates = objects.filter((o) => o.type === PLATE_OBJECT_TYPE);
      if (plates.every((p) => p.state.stepped)) {
        // 규칙 25: 풀리면 구멍이 모두 원래 바닥으로
        next = { ...next, floor: { ...next.floor, objects: next.floor.objects.filter((o) => !(o.type === PLATE_OBJECT_TYPE && inRoom(room, o))) } };
        next = solve(next, data, room);
      } else if (isStuckOnPlate(next, room)) {
        next = addMessage(movePlayerToRim(resetPuzzle(next, room), room, def), MESSAGES.puzzleCrumbleReset(), data);
      }
    } else {
      const switches = objects.filter((o) => o.type === SWITCH_OBJECT_TYPE);
      if (switches.every((s) => s.state.pressed)) next = solve(next, data, room);
    }
  }
  return next;
}

function solve(state: RunState, data: GameData, room: Room): RunState {
  const rooms = state.floor.rooms.map((r) => (r.id === room.id ? { ...r, state: { ...r.state, solved: true } } : r));
  const solved = updateObjects({ ...state, floor: { ...state.floor, rooms } }, (o) =>
    o.type === CHEST_OBJECT_TYPE && inRoom(room, o) ? { ...o, state: { ...o.state, locked: false } } : o,
  );
  return addMessage(solved, MESSAGES.puzzleSolved(), data);
}

// 규칙 24: 발판 위에 있는데 상하좌우로 갈 수 있는 칸이 하나도 없다
function isStuckOnPlate(state: RunState, room: Room): boolean {
  const { player } = state;
  if (!inRoom(room, player) || objectAt(state.floor, player.x, player.y)?.type !== PLATE_OBJECT_TYPE) return false;
  return AROUND(player).every((n) => !isPassable(state, n.x, n.y));
}

// 판 둘레의 가장 가까운 빈 칸으로 옮긴다
function movePlayerToRim(state: RunState, room: Room, def: PuzzleDef): RunState {
  const rect = boardRect(room, def);
  const rim: Point[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const onRim = x === rect.x || y === rect.y || x === rect.x + rect.w - 1 || y === rect.y + rect.h - 1;
      if (onRim && isPassable(state, x, y)) rim.push({ x, y });
    }
  }
  const { player } = state;
  const dist = (p: Point) => Math.abs(p.x - player.x) + Math.abs(p.y - player.y);
  const spot = rim.sort((a, b) => dist(a) - dist(b) || a.y - b.y || a.x - b.x)[0];
  return spot ? { ...state, player: { ...player, ...spot } } : state;
}

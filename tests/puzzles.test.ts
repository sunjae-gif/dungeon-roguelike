// F009 퍼즐방
import { describe, expect, it } from 'vitest';
import { generateFloor, HIDDEN_WALL_OBJECT_TYPE } from '../src/core/dungeon';
import { CHEST_OBJECT_TYPE } from '../src/core/items';
import { BOULDER_OBJECT_TYPE, LEVER_OBJECT_TYPE, PLATE_OBJECT_TYPE, placePuzzles, SWITCH_OBJECT_TYPE } from '../src/core/puzzles';
import { createRng, floorRng } from '../src/core/rng';
import { AROUND, inRoom, pointKey, roomEntrances } from '../src/core/rooms';
import { placeRoomFeatures } from '../src/core/roomFeatures';
import type { MapObject, Room, RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import type { GameData, PuzzleDef } from '../src/data/types';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
type Dir = 'up' | 'down' | 'left' | 'right';
const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// ── 자동 풀이 (게임 코드와 따로 만든 작은 BFS) ──
function solvable(def: PuzzleDef): boolean {
  const map = def.map;
  const h = map.length;
  const w = map[0].length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '#' : map[y][x]);
  const solid = (ch: string) => ch === '#' || ch === 'C' || ch === 'L';
  const start = { x: 1, y: 0 };
  if (def.type === 'crumble') {
    const plates: string[] = [];
    map.forEach((r, y) => [...r].forEach((ch, x) => ch === 'o' && plates.push(`${x},${y}`)));
    const idx = new Map(plates.map((p, i) => [p, i]));
    const all = (1 << plates.length) - 1;
    const key = (x: number, y: number, stepped: number, broken: number) => `${x},${y},${stepped},${broken}`;
    const queue = [{ x: start.x, y: start.y, stepped: 0, broken: 0 }];
    const seen = new Set([key(start.x, start.y, 0, 0)]);
    for (let i = 0; i < queue.length; i++) {
      const s = queue[i];
      if (s.stepped === all) return true;
      for (const [dx, dy] of Object.values(DELTA)) {
        const x = s.x + dx;
        const y = s.y + dy;
        if (solid(at(x, y))) continue;
        const to = idx.get(`${x},${y}`);
        if (to !== undefined && s.broken & (1 << to)) continue;
        const from = idx.get(`${s.x},${s.y}`);
        const broken = from !== undefined ? s.broken | (1 << from) : s.broken;
        const stepped = to !== undefined ? s.stepped | (1 << to) : s.stepped;
        const k = key(x, y, stepped, broken);
        if (!seen.has(k)) { seen.add(k); queue.push({ x, y, stepped, broken }); }
      }
    }
    return false;
  }
  const switches: string[] = [];
  const boulders0: string[] = [];
  map.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'S') switches.push(`${x},${y}`); if (ch === 'B') boulders0.push(`${x},${y}`); }));
  const key = (x: number, y: number, b: string[]) => `${x},${y}|${[...b].sort().join(';')}`;
  const queue = [{ x: start.x, y: start.y, boulders: boulders0 }];
  const seen = new Set([key(start.x, start.y, boulders0)]);
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    if (switches.every((sw) => s.boulders.includes(sw))) return true;
    for (const [dx, dy] of Object.values(DELTA)) {
      const x = s.x + dx;
      const y = s.y + dy;
      if (solid(at(x, y))) continue;
      let boulders = s.boulders;
      if (boulders.includes(`${x},${y}`)) {
        const bx = x + dx;
        const by = y + dy;
        if (solid(at(bx, by)) || boulders.includes(`${bx},${by}`)) continue;
        boulders = boulders.map((b) => (b === `${x},${y}` ? `${bx},${by}` : b));
      }
      const k = key(x, y, boulders);
      if (!seen.has(k)) { seen.add(k); queue.push({ x, y, boulders }); }
    }
  }
  return false;
}

// ── 시험용 퍼즐방: 9×9 방 하나에 판 하나를 찍는다 ──
const ROOM: Room = { id: 60, x: 1, y: 1, w: 9, h: 9, type: 'puzzle', state: {} };
function puzzleState(puzzleId: string): { s: RunState; d: GameData } {
  const d = { ...data, puzzles: data.puzzles.filter((p) => p.id === puzzleId) };
  const rows = ['###########', ...Array.from({ length: 9 }, () => '#.........#'), '###########'];
  rows[1] = '#@........#';
  const s0 = stateFromMap(rows.join('\n'), d);
  const { floor } = placePuzzles({ ...s0.floor, rooms: [ROOM] }, d, createRng(1), 500);
  return { s: { ...s0, floor }, d };
}
const objs = (s: RunState, type: string) => s.floor.objects.filter((o) => o.type === type);
const chest = (s: RunState) => objs(s, CHEST_OBJECT_TYPE)[0];
const at = (s: RunState, x: number, y: number): RunState => ({ ...s, player: { ...s.player, x, y } });
function walk(s: RunState, d: GameData, dirs: Dir[]): RunState {
  return dirs.reduce((cur, dir) => playTurn(cur, { type: 'direction', direction: dir }, d), s);
}
const texts = (s: RunState) => s.messageLog.map((m) => m.text);

describe('F009 퍼즐 판 데이터', () => {
  it('puzzles.json에 판이 6종 이상 있고, 모든 판이 풀 수 있다', () => {
    expect(data.puzzles.length).toBeGreaterThanOrEqual(6);
    for (const def of data.puzzles) expect(solvable(def), def.id).toBe(true);
  });

  it('뒤집은 판도 풀 수 있다', () => {
    for (const def of data.puzzles) {
      const flipped = { ...def, map: [...def.map].reverse().map((r) => [...r].reverse().join('')) };
      // 시작 칸(1,0)이 레버가 되지 않도록 둘레를 따라 시작해도 같다: 판 둘레는 모두 이어져 있다
      expect(solvable(flipped), def.id).toBe(true);
    }
  });
});

describe('F009 퍼즐방 생성', () => {
  it('퍼즐방에는 레버와 잠긴 상자가 1개씩 있고, 레버는 방 입구나 그 옆에 없다', () => {
    let checked = 0;
    for (let seed = 0; seed < 400 && checked < 40; seed++) {
      const f = 1 + (seed % 9);
      const g = generateFloor(data, seed, f, 1);
      const withFeatures = placeRoomFeatures(g.floor, g.nextId);
      const { floor } = placePuzzles(withFeatures.floor, data, floorRng(seed, f, 'objects'), withFeatures.nextId);
      for (const room of floor.rooms.filter((r) => r.type === 'puzzle')) {
        const inside = floor.objects.filter((o) => inRoom(room, o));
        expect(inside.filter((o) => o.type === LEVER_OBJECT_TYPE).length).toBe(1);
        const chests = inside.filter((o) => o.type === CHEST_OBJECT_TYPE);
        expect(chests.length).toBe(1);
        expect(chests[0].state.locked).toBe(true);
        const lever = inside.find((o) => o.type === LEVER_OBJECT_TYPE)!;
        const near = new Set(roomEntrances(floor, room).flatMap((e) => [e, ...AROUND(e)]).map(pointKey));
        expect(near.has(pointKey(lever))).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe('F009 퍼즐 규칙', () => {
  it('퍼즐방의 잠긴 상자는 풀기 전에 열리지 않고 턴도 안 쓴다', () => {
    const { s, d } = puzzleState('boulder_basic');
    const c = chest(s);
    const next = at(s, c.x, c.y + 1);
    const tried = walk(next, d, ['up']);
    expect(tried.turn).toBe(next.turn);
    expect(texts(tried).at(-1)).toBe('잠겨 있다.');
    expect(chest(tried).state.opened).toBe(false);
  });

  it('무너지는 발판: 모든 발판을 한 번씩 밟으면 상자가 열리고 구멍이 사라진다', () => {
    const { s, d } = puzzleState('crumble_ring');
    // 판은 (3,3)부터 5×5. 둘레 (4,3)에서 시작해 발판 8개를 한 바퀴
    let cur = walk(at(s, 4, 3), d, ['down', 'right', 'right', 'down', 'down', 'left', 'left']);
    expect(objs(cur, PLATE_OBJECT_TYPE).some((o) => o.state.broken)).toBe(true);
    expect(chest(cur).state.locked).toBe(true);
    cur = walk(cur, d, ['up']);
    expect(chest(cur).state.locked).toBe(false);
    expect(objs(cur, PLATE_OBJECT_TYPE)).toEqual([]);
    expect(texts(cur)).toContain('철컥, 상자의 잠금이 풀렸다.');
    // 상자를 열면 퍼즐방 규칙(셋 중 하나)
    const opened = walk(at(cur, 5, 4), d, ['down']);
    expect(opened.pendingChoice?.source).toBe('puzzle');
    expect(opened.pendingChoice?.options.length).toBe(data.loot.puzzleChoices);
  });

  it('무너지는 발판: 갇히면 그 턴 끝에 퍼즐이 처음으로 돌아가고 플레이어가 둘레로 옮겨진다', () => {
    const { s, d } = puzzleState('crumble_square');
    // 판은 (2,2)부터 6×6. 안쪽 발판 (4,5) 주변 (3,5) (5,5) (4,6)을 무너뜨리고, 위는 상자(4,4)
    const broken = new Set(['3,5', '5,5', '4,6']);
    const trapped: RunState = {
      ...at(s, 4, 5),
      floor: { ...s.floor, objects: s.floor.objects.map((o) => (broken.has(pointKey(o)) ? { ...o, blocksMove: true, state: { ...o.state, stepped: true, broken: true } } : o)) },
    };
    const after = playTurn(trapped, { type: 'rest' }, d);
    expect(objs(after, PLATE_OBJECT_TYPE).every((o) => !o.state.broken && !o.state.stepped)).toBe(true);
    const { x, y } = after.player;
    expect(x === 2 || y === 2 || x === 7 || y === 7).toBe(true);
    expect(texts(after)).toContain('발밑이 흔들리더니 발판이 다시 솟아올랐다.');
  });

  it('돌 밀기: 돌을 스위치에 올리면 상자가 열린다. 벽 쪽으로 미는 입력은 턴을 쓰지 않는다', () => {
    const { s, d } = puzzleState('boulder_basic');
    // 판은 (2,3)부터 6×5. 돌 (3,4), 스위치 (6,4). 플레이어 (2,4)에서 오른쪽으로 세 번
    const pushed = walk(at(s, 2, 4), d, ['right', 'right', 'right']);
    expect(objs(pushed, BOULDER_OBJECT_TYPE)[0]).toMatchObject({ x: 6, y: 4 });
    expect(pushed.player).toMatchObject({ x: 5, y: 4 });
    expect(objs(pushed, SWITCH_OBJECT_TYPE)[0].state.pressed).toBe(true);
    expect(chest(pushed).state.locked).toBe(false);
    // 돌을 방 왼쪽 벽 옆으로 옮겨 두고 벽 쪽으로 민다
    const nearWall: RunState = {
      ...at(s, 2, 4),
      floor: { ...s.floor, objects: s.floor.objects.map((o) => (o.type === BOULDER_OBJECT_TYPE ? { ...o, x: 1, y: 4 } : o)) },
    };
    const stuck = walk(nearWall, d, ['left']);
    expect(stuck.turn).toBe(nearWall.turn);
    expect(objs(stuck, BOULDER_OBJECT_TYPE)[0]).toMatchObject({ x: 1, y: 4 });
  });

  it('레버를 당기면 판이 처음 상태로 돌아가고 한 턴이 지난다. 푼 뒤에는 아무것도 하지 않는다', () => {
    const { s, d } = puzzleState('boulder_basic');
    const pushedOnce = walk(at(s, 2, 4), d, ['right']);
    expect(objs(pushedOnce, BOULDER_OBJECT_TYPE)[0].x).toBe(4);
    // 레버 (2,3): 오른쪽 칸 (3,3)에서 왼쪽으로
    const pulled = walk(at(pushedOnce, 3, 3), d, ['left']);
    expect(objs(pulled, BOULDER_OBJECT_TYPE)[0]).toMatchObject({ x: 3, y: 4 });
    expect(pulled.turn).toBe(pushedOnce.turn + 1);
    expect(texts(pulled).at(-1)).toBe('덜컥, 퍼즐이 처음으로 돌아갔다.');
    const solved = walk(at(s, 2, 4), d, ['right', 'right', 'right']);
    const afterSolve = at(solved, 3, 3);
    expect(walk(afterSolve, d, ['left'])).toBe(afterSolve);
  });

  it('몬스터가 퍼즐 판과 숨은 벽(발견 전)을 지나지 않는다', () => {
    const { s, d } = puzzleState('crumble_ring');
    // 고블린이 판 아래쪽 둘레에서 위쪽의 플레이어를 기억하고 다가온다. 발판을 밟지 않는다
    const goblin = {
      id: 900, defId: 'goblin', x: 5, y: 8, facing: 'down' as const, hp: 99,
      buildItems: [], consumables: [], statuses: [], ai: { lastSeenPlayer: { x: 5, y: 2 } },
    };
    let cur: RunState = { ...at(s, 5, 2), floor: { ...s.floor, actors: [goblin] } };
    const plates = new Set(objs(cur, PLATE_OBJECT_TYPE).map(pointKey));
    for (let i = 0; i < 8; i++) {
      cur = playTurn(cur, { type: 'rest' }, d);
      const g = cur.floor.actors.find((a) => a.id === 900)!;
      expect(plates.has(pointKey(g)), `turn ${i}`).toBe(false);
    }
    // 숨은 벽
    const hs = stateFromMap(`
      #######
      #@..#g#
      #######`, data);
    const wall: MapObject = { id: 77, type: HIDDEN_WALL_OBJECT_TYPE, x: 4, y: 1, blocksMove: true, blocksSight: true, state: { discovered: false } };
    let hcur: RunState = {
      ...hs,
      floor: {
        ...hs.floor,
        tiles: hs.floor.tiles.map((t, i) => (i === 1 * 7 + 4 ? ('floor' as const) : t)),
        objects: [wall],
        actors: hs.floor.actors.map((a) => ({ ...a, ai: { lastSeenPlayer: { x: 1, y: 1 } } })),
      },
    };
    for (let i = 0; i < 3; i++) hcur = playTurn(hcur, { type: 'rest' }, data);
    expect(hcur.floor.actors[0].x).toBe(5);
  });
});

describe('F009 규칙 21과 원거리 몬스터', () => {
  it('원거리 몬스터는 사격 위치를 찾을 때도 퍼즐 발판에 들어가지 않는다', () => {
    const { s, d } = puzzleState('crumble_ring');
    // 판 (3,3)~(7,7). 플레이어 (4,1), 궁수는 판 왼쪽 둘레 (3,4).
    // 플레이어와 같은 세로줄의 사격 위치 중 (4,4)는 바로 옆이지만 발판이라 들어가면 안 된다
    const archer = {
      id: 901, defId: 'goblin_archer', x: 3, y: 4, facing: 'down' as const, hp: 99,
      buildItems: [], consumables: [], statuses: [], ai: {},
    };
    let cur: RunState = { ...at(s, 4, 1), floor: { ...s.floor, actors: [archer] } };
    const plates = new Set(objs(cur, PLATE_OBJECT_TYPE).map(pointKey));
    for (let i = 0; i < 6; i++) {
      cur = playTurn(cur, { type: 'rest' }, d);
      const a = cur.floor.actors.find((m) => m.id === 901)!;
      expect(plates.has(pointKey(a)), `turn ${i}`).toBe(false);
    }
  });
});

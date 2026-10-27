// 지도 관련 데이터 검사: dungeon.json, rooms.json, puzzles.json, themes.json (40-tech/tech-stack.md "데이터 검사")
import { Checker, type Obj } from './check';

export function checkDungeon(c: Checker, d: Obj): void {
  const p = 'dungeon.json';
  c.num(d, 'maxFloor', p, { integer: true, min: 1 });
  c.num(d, 'generationMaxAttempts', p, { integer: true, min: 1 });
  c.num(d, 'roomPlacementTries', p, { integer: true, min: 1 });
  c.range(d, 'extraCorridors', p);
  for (const key of ['rooms', 'bossRoom']) {
    const o = c.objField(d, key, p);
    if (!o) continue;
    const keys = key === 'rooms' ? ['minCount', 'maxCount', 'minSize', 'maxSize'] : ['minSize', 'maxSize'];
    for (const k of keys) c.num(o, k, `${p}.${key}`, { integer: true, min: 1 });
  }
}

export function checkRoomTypes(c: Checker, d: Obj): Obj[] {
  const list = c.idList(d, 'roomTypes', 'rooms.json');
  list.forEach((r, i) => {
    const p = `rooms.json.roomTypes[${i}]`;
    c.str(r, 'name', p);
    for (const k of ['weight', 'minPerFloor', 'maxPerFloor', 'minRoomSize']) c.num(r, k, p, { integer: true, min: 0 });
  });
  return list;
}

// F009 puzzles.json: 문자 종류, 줄 길이, 레버·상자 1개씩, 바깥 한 줄은 . 과 L 만, 돌 ≥ 스위치, 발판 ≥ 3
const PUZZLE_TYPES = ['crumble', 'boulder'];
const PUZZLE_CHARS = '.#oBSCL';
const MIN_CRUMBLE_PLATES = 3;

export function checkPuzzles(c: Checker, d: Obj): Obj[] {
  const list = c.idList(d, 'puzzles', 'puzzles.json');
  list.forEach((pz, i) => {
    const p = `puzzles.json.puzzles[${i}]`;
    c.oneOf(pz, 'type', p, PUZZLE_TYPES);
    const rows = c.arr(pz, 'map', p);
    if (!rows || rows.some((r) => typeof r !== 'string')) return c.fail(`${p}.map`, '문자열 줄 목록이어야 함');
    const map = rows as string[];
    if (new Set(map.map((r) => r.length)).size !== 1) return c.fail(`${p}.map`, '줄 길이가 모두 같아야 함');
    const all = map.join('');
    const bad = [...all].filter((ch) => !PUZZLE_CHARS.includes(ch));
    if (bad.length > 0) c.fail(`${p}.map`, `알 수 없는 문자 ${JSON.stringify([...new Set(bad)].join(''))}`);
    const countOf = (ch: string) => [...all].filter((x) => x === ch).length;
    if (countOf('L') !== 1 || countOf('C') !== 1) c.fail(`${p}.map`, '레버(L)와 잠긴 상자(C)가 정확히 1개씩이어야 함');
    const w = map[0].length;
    const h = map.length;
    const ring = map.flatMap((row, y) => [...row].filter((_, x) => x === 0 || y === 0 || x === w - 1 || y === h - 1));
    if (ring.some((ch) => ch !== '.' && ch !== 'L')) c.fail(`${p}.map`, '바깥 한 줄은 . 과 L 만 둘 수 있음');
    if (pz.type === 'boulder' && (countOf('S') < 1 || countOf('B') < countOf('S'))) c.fail(`${p}.map`, '돌 밀기 판은 스위치가 1개 이상, 돌이 스위치 이상');
    if (pz.type === 'crumble' && countOf('o') < MIN_CRUMBLE_PLATES) c.fail(`${p}.map`, `무너지는 발판 판은 발판이 ${MIN_CRUMBLE_PLATES}개 이상`);
  });
  return list;
}

export interface ThemeRefs {
  monsters: Set<string>;
  traps: Set<string>;
  sprites: Set<string>;
  roomTypes: Set<string>;
}

export function checkThemes(c: Checker, d: Obj, refs: ThemeRefs): Obj[] {
  const list = c.idList(d, 'themes', 'themes.json');
  list.forEach((t, i) => {
    const p = `themes.json.themes[${i}]`;
    c.str(t, 'name', p);
    c.str(t, 'intro', p);
    c.num(t, 'rareChance', p, { min: 0, max: 1 });
    // F011 규칙 6: 테마별 방 설정 (선택)
    const rooms = c.objField(t, 'rooms', p, true);
    if (rooms) for (const k of ['minCount', 'maxCount', 'minSize', 'maxSize']) c.num(rooms, k, `${p}.rooms`, { integer: true, min: 1 });
    const bossRoom = c.objField(t, 'bossRoom', p, true);
    if (bossRoom) for (const k of ['minSize', 'maxSize']) c.num(bossRoom, k, `${p}.bossRoom`, { integer: true, min: 1 });
    if (t.extraCorridors !== undefined) c.range(t, 'extraCorridors', p);
    c.arr(t, 'floors', p)?.forEach((f, j) => {
      if (!Number.isInteger(f)) c.fail(`${p}.floors[${j}]`, '정수여야 함');
    });
    c.num(t, 'mapWidth', p, { integer: true, min: 1 });
    c.num(t, 'mapHeight', p, { integer: true, min: 1 });
    c.num(t, 'doorChance', p, { min: 0, max: 1 });
    for (const k of ['monsterCount', 'itemCount', 'trapCount']) c.range(t, k, p);

    const tiles = c.objField(t, 'tiles', p);
    if (tiles) {
      for (const k of ['floor', 'wall', 'door', 'doorOpen']) {
        c.str(tiles, k, `${p}.tiles`);
        c.ref(tiles[k], refs.sprites, `${p}.tiles.${k}`, 'sprites.json');
      }
    }
    // F014 배치 1: { monsters.json id: 양의 정수 가중치 }
    const types = c.objField(t, 'monsterTypes', p);
    if (types) {
      for (const id of Object.keys(types)) {
        c.ref(id, refs.monsters, `${p}.monsterTypes.${id}`, 'monsters.json');
        c.num(types, id, `${p}.monsterTypes`, { integer: true, min: 1 });
      }
    }
    c.strList(t, 'trapTypes', p);
    (t.trapTypes as unknown[] | undefined)?.forEach((id, j) =>
      c.ref(id, refs.traps, `${p}.trapTypes[${j}]`, 'traps.json'),
    );
    const weights = c.objField(t, 'roomWeights', p);
    if (weights) {
      for (const k of Object.keys(weights)) {
        c.ref(k, refs.roomTypes, `${p}.roomWeights.${k}`, 'rooms.json');
        c.num(weights, k, `${p}.roomWeights`, { min: 0 });
      }
    }
    c.str(t, 'boss', p, true);
    c.ref(t.boss, refs.monsters, `${p}.boss`, 'monsters.json');
  });
  return list;
}

// 테마의 floors가 1~maxFloor를 빠짐없이, 겹치지 않게 덮는지
export function checkFloorCoverage(c: Checker, themes: Obj[], maxFloor: number): void {
  const owner = new Map<number, string>();
  for (const t of themes) {
    if (!Array.isArray(t.floors)) continue;
    for (const f of t.floors) {
      if (!Number.isInteger(f)) continue;
      if (f < 1 || f > maxFloor) c.fail(`themes.json "${t.id}"`, `${f}층은 1~${maxFloor} 범위 밖`);
      else if (owner.has(f)) c.fail(`themes.json "${t.id}"`, `${f}층이 "${owner.get(f)}"와 겹침`);
      else owner.set(f, String(t.id));
    }
  }
  for (let f = 1; f <= maxFloor; f++) {
    if (!owner.has(f)) c.fail('themes.json', `${f}층을 덮는 테마가 없음`);
  }
}

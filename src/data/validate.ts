// 20-data/ 전체 검사. 40-tech/tech-stack.md "데이터 검사"
import { STAT_IDS, TRAP_EVENT } from '../core/effects';

import { Checker, idsOf, type Obj } from './check';
import { checkEffects, checkImmunities, checkModifiers, checkTriggers, type EffectRefs } from './validateEffects';
import type { GameData, RawData } from './types';

export type ValidationResult = { ok: true; data: GameData } | { ok: false; errors: string[] };

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
const ITEM_KINDS = ['consumable', 'build'] as const;
const RARITIES = ['common', 'rare'] as const;

export function validateGameData(raw: RawData): ValidationResult {
  const c = new Checker();
  const file = (name: keyof RawData): Obj => (c.obj(raw[name], name) ? (raw[name] as Obj) : {});

  // 각 파일의 필드와 형식
  const dungeon = file('dungeon.json');
  checkDungeon(c, dungeon);
  checkPlayer(c, file('player.json'));
  const statuses = checkStatuses(c, file('statuses.json'));
  const effectRefs: EffectRefs = { statuses: idsOf(statuses) };
  const monsters = checkMonsters(c, file('monsters.json'), effectRefs);
  const roomTypes = checkRoomTypes(c, file('rooms.json'));
  const { sprites } = checkSprites(c, file('sprites.json'));
  const spriteIds = idsOf(sprites);
  const items = checkItems(c, file('items.json'), spriteIds, effectRefs);
  const traps = checkTraps(c, file('traps.json'), spriteIds, effectRefs);
  checkUi(c, file('ui.json'));
  checkLoot(c, file('loot.json'), items);
  const puzzles = checkPuzzles(c, file('puzzles.json'));

  // 테마: 다른 파일을 가리키는 id, 층 범위
  const refs = { monsters: idsOf(monsters), traps: idsOf(traps), sprites: spriteIds, roomTypes: idsOf(roomTypes) };
  const themes = checkThemes(c, file('themes.json'), refs);
  if (typeof dungeon.maxFloor === 'number') checkFloorCoverage(c, themes, dungeon.maxFloor);

  if (c.errors.length > 0) return { ok: false, errors: c.errors };
  const data = {
    dungeon,
    player: raw['player.json'],
    monsters,
    monsterSightRadius: (raw['monsters.json'] as Obj).monsterSightRadius,
    items,
    statuses,
    loot: raw['loot.json'],
    puzzles,
    roomTypes,
    sprites: raw['sprites.json'],
    themes,
    traps,
    ui: raw['ui.json'],
  };
  return { ok: true, data: data as unknown as GameData };
}

function checkDungeon(c: Checker, d: Obj): void {
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

function checkStats(c: Checker, o: Obj, p: string, stats: readonly string[] = STAT_IDS): void {
  for (const stat of stats) c.num(o, stat, p, { integer: true, min: 0 });
}

// F004 몬스터: 시야는 모든 몬스터 공통 고정값 monsterSightRadius이므로 몬스터별 sightRadius가 없다.
// 사거리는 없으면 1이라 따로 검사한다 (effects.md 1절)
const MONSTER_STAT_IDS = STAT_IDS.filter((s) => s !== 'sightRadius' && s !== 'attackRange');
// F014 행동 방식, 배치
const MONSTER_BEHAVIORS = ['chase', 'ranged', 'flee', 'ambush', 'boss'];
const MONSTER_PLACEMENTS = ['room', 'chokepoint'];

function checkPlayer(c: Checker, d: Obj): void {
  checkStats(c, d, 'player.json');
  c.num(d, 'maxAttackRange', 'player.json', { integer: true, min: 1 });
  c.num(d, 'inventorySize', 'player.json', { integer: true, min: 1 });
}

// effects.md 5절
function checkStatuses(c: Checker, d: Obj): Obj[] {
  const list = c.idList(d, 'statuses', 'statuses.json');
  const refs = { statuses: idsOf(list) };
  list.forEach((s, i) => {
    const p = `statuses.json.statuses[${i}]`;
    c.str(s, 'name', p);
    checkModifiers(c, s, p);
    checkTriggers(c, s, p, refs, true);
  });
  return list;
}

function checkMonsters(c: Checker, d: Obj, refs: EffectRefs): Obj[] {
  c.num(d, 'monsterSightRadius', 'monsters.json', { integer: true, min: 1 });
  const list = c.idList(d, 'monsters', 'monsters.json');
  list.forEach((m, i) => {
    const p = `monsters.json.monsters[${i}]`;
    c.str(m, 'name', p);
    checkStats(c, m, p, MONSTER_STAT_IDS);
    c.num(m, 'attackRange', p, { integer: true, min: 1, optional: true });
    // effects.md 2절: 몬스터 특성. 3절 규칙 7: 확률 없음
    checkModifiers(c, m, p);
    checkTriggers(c, m, p, refs, true);
    checkImmunities(c, m, p, refs);
    c.str(m, 'behavior', p);
    if (typeof m.behavior === 'string' && !MONSTER_BEHAVIORS.includes(m.behavior)) {
      c.fail(`${p}.behavior`, `알 수 없는 행동 방식 "${m.behavior}" (가능: ${MONSTER_BEHAVIORS.join(', ')})`);
    }
    c.bool(m, 'isBoss', p, true);
    // F014 "데이터 검사에 추가할 것"
    if (m.behavior === 'ranged' && !(typeof m.attackRange === 'number' && m.attackRange >= 2)) {
      c.fail(`${p}.attackRange`, 'ranged는 attackRange 2 이상이 필요함');
    }
    c.num(m, 'fleeHpRatio', p, { min: 0, max: 1, optional: m.behavior !== 'flee' });
    c.num(m, 'vanishWhenUnseen', p, { integer: true, min: 1, optional: true });
    c.oneOf(m, 'placement', p, MONSTER_PLACEMENTS, true);
    c.bool(m, 'piercing', p, true);
    c.str(m, 'attackVerb', p, true);
    c.str(m, 'noticeMessage', p, true);
    // F008: behavior boss면 boss 객체 필수
    const boss = c.objField(m, 'boss', p, m.behavior !== 'boss');
    if (boss) checkBoss(c, boss, `${p}.boss`);
  });
  // F008: isBoss인 몬스터는 하나뿐
  if (list.filter((m) => m.isBoss === true).length > 1) c.fail('monsters.json', 'isBoss인 몬스터가 둘 이상');
  return list;
}

// F008 보스 패턴
function checkBoss(c: Checker, b: Obj, p: string): void {
  c.num(b, 'chargeEvery', p, { integer: true, min: 1 });
  c.num(b, 'slamRange', p, { integer: true, min: 1 });
  c.num(b, 'slamDamageMul', p, { min: 0 });
  const enrage = c.objField(b, 'enrage', p);
  if (!enrage) return;
  c.num(enrage, 'hpRatio', `${p}.enrage`, { min: 0, max: 1 });
  c.num(enrage, 'chargeEvery', `${p}.enrage`, { integer: true, min: 1 });
  c.str(enrage, 'message', `${p}.enrage`);
  c.arr(enrage, 'modifiers', `${p}.enrage`);
  checkModifiers(c, enrage, `${p}.enrage`);
}

function checkRoomTypes(c: Checker, d: Obj): Obj[] {
  const list = c.idList(d, 'roomTypes', 'rooms.json');
  list.forEach((r, i) => {
    const p = `rooms.json.roomTypes[${i}]`;
    c.str(r, 'name', p);
    for (const k of ['weight', 'minPerFloor', 'maxPerFloor', 'minRoomSize']) c.num(r, k, p, { integer: true, min: 0 });
  });
  return list;
}

function checkSprites(c: Checker, d: Obj): { sprites: Obj[] } {
  const p = 'sprites.json';
  c.num(d, 'tileSize', p, { integer: true, min: 1 });
  c.num(d, 'sourcePixelSize', p, { integer: true, min: 1 });
  const sprites = c.idList(d, 'sprites', p);
  sprites.forEach((s, i) => {
    const sp = `${p}.sprites[${i}]`;
    c.str(s, 'path', sp);
    c.str(s, 'fallbackColor', sp);
    const dirs = c.objField(s, 'directions', sp, true);
    if (dirs) for (const dir of DIRECTIONS) c.str(dirs, dir, `${sp}.directions`);
  });
  const illustrations = c.idList(d, 'illustrations', p);
  illustrations.forEach((s, i) => c.str(s, 'path', `${p}.illustrations[${i}]`));
  return { sprites };
}

function checkItems(c: Checker, d: Obj, spriteIds: Set<string>, refs: EffectRefs): Obj[] {
  const list = c.idList(d, 'items', 'items.json');
  list.forEach((item, i) => {
    const p = `items.json.items[${i}]`;
    c.str(item, 'name', p);
    c.oneOf(item, 'kind', p, ITEM_KINDS);
    // 드롭 가중치는 F005에서 정한다
    c.num(item, 'weight', p, { min: 0, optional: true });
    c.str(item, 'sprite', p);
    c.ref(item.sprite, spriteIds, `${p}.sprite`, 'sprites.json');
    // F005: 빌드 아이템은 등급과 설명이 필수
    const build = item.kind === 'build';
    c.oneOf(item, 'rarity', p, RARITIES, !build);
    c.str(item, 'description', p, !build);
    c.str(item, 'useMessage', p, true);

    const use = c.objField(item, 'use', p, item.kind !== 'consumable');
    if (use) {
      c.str(use, 'requires', `${p}.use`, true);
      checkEffects(c, c.arr(use, 'effects', `${p}.use`), `${p}.use.effects`, refs);
    }
    checkModifiers(c, item, p);
    checkTriggers(c, item, p, refs, false);
    checkImmunities(c, item, p, refs);
  });
  return list;
}

// F009 puzzles.json: 문자 종류, 줄 길이, 레버·상자 1개씩, 바깥 한 줄은 . 과 L 만, 돌 ≥ 스위치, 발판 ≥ 3
const PUZZLE_TYPES = ['crumble', 'boulder'];
const PUZZLE_CHARS = '.#oBSCL';
const MIN_CRUMBLE_PLATES = 3;

function checkPuzzles(c: Checker, d: Obj): Obj[] {
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

// F005 loot.json: item은 items.json의 소모품
function checkLoot(c: Checker, d: Obj, items: Obj[]): void {
  const p = 'loot.json';
  for (const k of ['chestChoices', 'secretChoices', 'puzzleChoices']) c.num(d, k, p, { integer: true, min: 1 });
  const consumables = new Set(items.filter((it) => it.kind === 'consumable').map((it) => String(it.id)));
  const drop = c.objField(d, 'monsterDrop', p);
  if (drop) {
    c.ref(drop.item, consumables, `${p}.monsterDrop.item`, 'items.json 소모품');
    c.num(drop, 'chance', `${p}.monsterDrop`, { min: 0, max: 1 });
  }
  c.num(d, 'springHealRatio', p, { min: 0, max: 1 });
  const reward = c.objField(d, 'exhaustedReward', p);
  if (reward) {
    c.ref(reward.item, consumables, `${p}.exhaustedReward.item`, 'items.json 소모품');
    c.num(reward, 'count', `${p}.exhaustedReward`, { integer: true, min: 1 });
  }
}

// F010: effects는 effects.md 효과 형식 (이벤트 자리에는 'trap')
function checkTraps(c: Checker, d: Obj, spriteIds: Set<string>, refs: EffectRefs): Obj[] {
  const list = c.idList(d, 'traps', 'traps.json');
  list.forEach((t, i) => {
    const p = `traps.json.traps[${i}]`;
    c.str(t, 'name', p);
    checkEffects(c, c.arr(t, 'effects', p), `${p}.effects`, refs, TRAP_EVENT);
    c.bool(t, 'once', p, true);
    c.str(t, 'sprite', p);
    c.ref(t.sprite, spriteIds, `${p}.sprite`, 'sprites.json');
  });
  return list;
}

function checkUi(c: Checker, d: Obj): void {
  const p = 'ui.json';
  const group = (key: string, nums: string[], strs: string[] = []) => {
    const o = c.objField(d, key, p);
    if (!o) return;
    for (const k of nums) c.num(o, k, `${p}.${key}`, { min: 0 });
    for (const k of strs) c.str(o, k, `${p}.${key}`);
  };
  group('baseResolution', ['width', 'height']);
  group('viewportTiles', ['width', 'height']);
  group('layout', ['padding', 'statusPanelWidth', 'messageLogLines', 'messageLineHeight']);
  group('fov', ['exploredBrightness'], ['unexploredColor']);
  group('font', ['size'], ['family', 'file', 'fallback']);
  group('colors', [], ['background', 'text', 'hpNormal', 'hpLow', 'missingSprite', 'rare', 'telegraph', 'bossHp']);
  group('input', ['keyRepeatIntervalMs']);
  c.num(d, 'lowHpRatio', p, { min: 0, max: 1 });
  c.num(d, 'floorIntroMs', p, { min: 0 });
  c.num(d, 'messageLogMaxStored', p, { integer: true, min: 1 });
}

interface ThemeRefs {
  monsters: Set<string>;
  traps: Set<string>;
  sprites: Set<string>;
  roomTypes: Set<string>;
}

function checkThemes(c: Checker, d: Obj, refs: ThemeRefs): Obj[] {
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
function checkFloorCoverage(c: Checker, themes: Obj[], maxFloor: number): void {
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

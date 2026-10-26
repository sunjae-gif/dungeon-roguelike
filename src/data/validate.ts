// 20-data/ 전체 검사. 40-tech/tech-stack.md "데이터 검사"
import { EFFECT_TYPES, STAT_IDS } from '../core/effects';
import { Checker, idsOf, type Obj } from './check';
import { checkEffects, checkModifiers, checkTriggers, type EffectRefs } from './validateEffects';
import type { GameData, RawData } from './types';

export type ValidationResult = { ok: true; data: GameData } | { ok: false; errors: string[] };

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
const ITEM_KINDS = ['consumable', 'build'] as const;

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
  const traps = checkTraps(c, file('traps.json'), spriteIds);
  checkUi(c, file('ui.json'));

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
const MONSTER_BEHAVIORS = ['chase', 'ranged', 'flee', 'ambush'];
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
  });
  return list;
}

function checkRoomTypes(c: Checker, d: Obj): Obj[] {
  const list = c.idList(d, 'roomTypes', 'rooms.json');
  list.forEach((r, i) => {
    const p = `rooms.json.roomTypes[${i}]`;
    c.str(r, 'name', p);
    for (const k of ['weight', 'minPerFloor', 'maxPerFloor']) c.num(r, k, p, { integer: true, min: 0 });
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

    const use = c.objField(item, 'use', p, item.kind !== 'consumable');
    if (use) {
      c.str(use, 'requires', `${p}.use`, true);
      checkEffects(c, c.arr(use, 'effects', `${p}.use`), `${p}.use.effects`, refs);
    }
    checkModifiers(c, item, p);
    checkTriggers(c, item, p, refs, false);
  });
  return list;
}

function checkTraps(c: Checker, d: Obj, spriteIds: Set<string>): Obj[] {
  const list = c.idList(d, 'traps', 'traps.json');
  list.forEach((t, i) => {
    const p = `traps.json.traps[${i}]`;
    c.str(t, 'name', p);
    c.oneOf(t, 'effect', p, EFFECT_TYPES);
    c.num(t, 'amount', p, { min: 0 });
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
  group('colors', [], ['background', 'text', 'hpNormal', 'hpLow', 'missingSprite']);
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
    c.arr(t, 'floors', p)?.forEach((f, j) => {
      if (!Number.isInteger(f)) c.fail(`${p}.floors[${j}]`, '정수여야 함');
    });
    c.num(t, 'mapWidth', p, { integer: true, min: 1 });
    c.num(t, 'mapHeight', p, { integer: true, min: 1 });
    c.num(t, 'doorChance', p, { min: 0, max: 1 });
    for (const k of ['monsterCount', 'itemCount', 'trapCount']) c.range(t, k, p);

    const tiles = c.objField(t, 'tiles', p);
    if (tiles) {
      for (const k of ['floor', 'wall', 'door']) {
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

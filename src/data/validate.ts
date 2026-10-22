// 20-data/ 전체 검사. 40-tech/tech-stack.md "데이터 검사"
import { EFFECT_FIELDS, EFFECT_TARGETS, EFFECT_TYPES, EVENT_NAMES, MODIFIER_OPS, STAT_IDS } from '../core/effects';
import { Checker, idsOf, type Obj } from './check';
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
  const monsters = checkMonsters(c, file('monsters.json'));
  const roomTypes = checkRoomTypes(c, file('rooms.json'));
  const { sprites } = checkSprites(c, file('sprites.json'));
  const spriteIds = idsOf(sprites);
  const items = checkItems(c, file('items.json'), spriteIds);
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
    items,
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

function checkStats(c: Checker, o: Obj, p: string): void {
  for (const stat of STAT_IDS) c.num(o, stat, p, { integer: true, min: 0 });
}

function checkPlayer(c: Checker, d: Obj): void {
  checkStats(c, d, 'player.json');
  c.num(d, 'inventorySize', 'player.json', { integer: true, min: 1 });
}

function checkMonsters(c: Checker, d: Obj): Obj[] {
  const list = c.idList(d, 'monsters', 'monsters.json');
  list.forEach((m, i) => {
    const p = `monsters.json.monsters[${i}]`;
    c.str(m, 'name', p);
    checkStats(c, m, p);
    c.bool(m, 'isBoss', p, true);
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

function checkEffects(c: Checker, list: unknown[] | null, p: string): void {
  list?.forEach((e, i) => {
    const ep = `${p}[${i}]`;
    if (!c.obj(e, ep)) return;
    c.oneOf(e, 'type', ep, EFFECT_TYPES);
    const fields: readonly string[] = EFFECT_FIELDS[e.type as keyof typeof EFFECT_FIELDS] ?? [];
    for (const f of fields) {
      if (f === 'target') c.oneOf(e, f, ep, EFFECT_TARGETS);
      else if (f === 'op') c.oneOf(e, f, ep, MODIFIER_OPS);
      else if (f === 'text') c.str(e, f, ep);
      else c.num(e, f, ep);
    }
  });
}

function checkItems(c: Checker, d: Obj, spriteIds: Set<string>): Obj[] {
  const list = c.idList(d, 'items', 'items.json');
  list.forEach((item, i) => {
    const p = `items.json.items[${i}]`;
    c.str(item, 'name', p);
    c.oneOf(item, 'kind', p, ITEM_KINDS);
    c.num(item, 'weight', p, { min: 0 });
    c.str(item, 'sprite', p);
    c.ref(item.sprite, spriteIds, `${p}.sprite`, 'sprites.json');

    const use = c.objField(item, 'use', p, item.kind !== 'consumable');
    if (use) {
      c.str(use, 'requires', `${p}.use`, true);
      checkEffects(c, c.arr(use, 'effects', `${p}.use`), `${p}.use.effects`);
    }
    c.arr(item, 'modifiers', p, true)?.forEach((m, j) => {
      const mp = `${p}.modifiers[${j}]`;
      if (!c.obj(m, mp)) return;
      c.oneOf(m, 'stat', mp, STAT_IDS);
      c.oneOf(m, 'op', mp, MODIFIER_OPS);
      c.num(m, 'value', mp);
    });
    c.arr(item, 'triggers', p, true)?.forEach((t, j) => {
      const tp = `${p}.triggers[${j}]`;
      if (!c.obj(t, tp)) return;
      c.oneOf(t, 'event', tp, EVENT_NAMES);
      c.num(t, 'chance', tp, { min: 0, max: 1 });
      checkEffects(c, c.arr(t, 'effects', tp), `${tp}.effects`);
    });
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
    c.strList(t, 'monsterTypes', p);
    (t.monsterTypes as unknown[] | undefined)?.forEach((id, j) =>
      c.ref(id, refs.monsters, `${p}.monsterTypes[${j}]`, 'monsters.json'),
    );
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

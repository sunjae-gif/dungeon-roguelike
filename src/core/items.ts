// F005 아이템과 빌드: 바닥 소모품, 몬스터 드롭, 보물상자와 빌드 아이템 고르기
import { themeForFloor } from '../data/query';
import type { GameData, ItemDef } from '../data/types';
import { isBossFloor, type Point } from './dungeon';
import { getStat, immunitiesOf, itemDef, statusImmunity } from './effects';
import { applyEffect, fireEvent } from './events';
import { dropItem } from './floorItems';
import { addMessage, MESSAGES } from './messages';
import { monsterAt, objectAt } from './movement';
import { chance, floorRng, hashSeed, nextInt, pickWeighted, useStoredRng, type Rng } from './rng';
import { tileIndex, type Actor, type FloorState, type ItemChoice, type MapObject, type Room, type RunState } from './state';

export const CHEST_OBJECT_TYPE = 'chest';
// 구조용 방 (F009 규칙 1). 보물상자방이 될 수 없다
const STRUCTURAL_ROOMS = ['start', 'stairs', 'boss'];
// rooms.json의 보물상자방 id
const TREASURE_ROOM_TYPE = 'treasure';

const weightOf = (it: ItemDef) => it.weight ?? 1;

// loot 흐름은 층 안에서 RunState.rng.loot에 이어 쓴다 (rng.md)
function withLoot<T>(state: RunState, fn: (rng: Rng) => T): { value: T; state: RunState } {
  const rngState = state.rng.loot === undefined
    ? { ...state.rng, loot: hashSeed(state.runSeed, state.floorNumber, 'loot') }
    : state.rng;
  const used = useStoredRng(rngState, 'loot', fn);
  return { value: used.value, state: { ...state, rng: used.rng } };
}

function roomTiles(floor: FloorState, room: Room): Point[] {
  const tiles: Point[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (floor.tiles[tileIndex(floor, x, y)] === 'floor') tiles.push({ x, y });
    }
  }
  return tiles;
}

// F005 규칙 10, 11: 1~9층에 보물상자방 1개, 방 가운데에 가장 가까운 빈 바닥 칸에 상자 (rooms 흐름)
export function placeTreasureChest(
  floor: FloorState,
  data: GameData,
  runSeed: number,
  floorNumber: number,
  firstId: number,
): { floor: FloorState; nextId: number } {
  if (isBossFloor(data, floorNumber)) return { floor, nextId: firstId };
  const candidates = floor.rooms.filter((r) => !STRUCTURAL_ROOMS.includes(r.type));
  if (candidates.length === 0) return { floor, nextId: firstId };
  const room = candidates[nextInt(floorRng(runSeed, floorNumber, 'rooms'), 0, candidates.length - 1)];
  const center = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
  const spot = roomTiles(floor, room)
    .filter((p) => !objectAt(floor, p.x, p.y))
    .sort((a, b) => dist(a, center) - dist(b, center) || a.y - b.y || a.x - b.x)[0];
  if (!spot) return { floor, nextId: firstId };
  const chest: MapObject = { id: firstId, type: CHEST_OBJECT_TYPE, ...spot, blocksMove: true, blocksSight: false, state: { opened: false } };
  return {
    floor: {
      ...floor,
      rooms: floor.rooms.map((r) => (r.id === room.id ? { ...r, type: TREASURE_ROOM_TYPE } : r)),
      objects: [...floor.objects, chest],
    },
    nextId: firstId + 1,
  };
}

const dist = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// F005 규칙 5: 바닥 소모품. 테마 itemCount만큼, weight 비율로, 방 안 빈 바닥 칸에 (loot 흐름)
// 다 놓은 뒤의 loot 흐름 상태를 돌려준다. 그 층에 있는 동안 이어 쓴다
export function placeFloorItems(
  floor: FloorState,
  data: GameData,
  runSeed: number,
  floorNumber: number,
  firstId: number,
  start: Point,
): { floor: FloorState; nextId: number; lootState: number } {
  const theme = themeForFloor(data, floorNumber);
  const rng = floorRng(runSeed, floorNumber, 'loot');
  const consumables = data.items.filter((it) => it.kind === 'consumable' && weightOf(it) > 0).map((it) => [it.id, weightOf(it)] as const);
  const count = nextInt(rng, theme.itemCount[0], theme.itemCount[1]);
  let free = floor.rooms
    .flatMap((r) => roomTiles(floor, r))
    .filter((p) => !objectAt(floor, p.x, p.y) && !monsterAt(floor, p.x, p.y) && !(p.x === start.x && p.y === start.y));
  let nextId = firstId;
  const items = [...floor.items];
  for (let i = 0; i < count && free.length > 0 && consumables.length > 0; i++) {
    const defId = pickWeighted(rng, consumables);
    const spot = free[nextInt(rng, 0, free.length - 1)];
    free = free.filter((p) => p !== spot);
    items.push({ id: nextId++, defId, ...spot });
  }
  return { floor: { ...floor, items }, nextId, lootState: rng.state };
}

// F005 규칙 6: 보스가 아니면 monsterDrop.chance 확률로 그 칸에 떨어뜨린다
export function monsterDrop(state: RunState, data: GameData, monster: Actor): RunState {
  if (data.monsters.find((m) => m.id === monster.defId)?.isBoss) return state;
  const { item, chance: p } = data.loot.monsterDrop;
  const roll = withLoot(state, (rng) => chance(rng, p));
  return roll.value ? dropItem(roll.state, item, monster) : roll.state;
}

// F005 규칙 1, 3: 플레이어 칸의 소모품을 자동으로 줍는다. 턴을 쓰지 않는다
export function pickUp(state: RunState, data: GameData): RunState {
  const { player, floor } = state;
  const item = floor.items.find((it) => it.x === player.x && it.y === player.y);
  if (!item) return state;
  if (player.consumables.length >= data.player.inventorySize) return addMessage(state, MESSAGES.bagFull(), data);
  let next: RunState = {
    ...state,
    player: { ...player, consumables: [...player.consumables, item.defId] },
    floor: { ...floor, items: floor.items.filter((it) => it.id !== item.id) },
    runStats: { ...state.runStats, itemsFound: state.runStats.itemsFound + 1 },
  };
  next = fireEvent(next, data, player.id, 'onPickup', { itemId: item.defId }).state;
  return next;
}

// F005 규칙 2, 4: 소모품을 쓸 수 있는가. HP가 최대일 때 회복 물약은 쓰이지 않는다
export function canUseConsumable(state: RunState, data: GameData, index: number): boolean {
  const def = itemDef(data, state.player.consumables[index] ?? '');
  if (!def?.use) return false;
  if (def.use.requires === 'hpNotFull') return state.player.hp < getStat(state.player, 'maxHp', data);
  return true;
}

export function useConsumable(state: RunState, data: GameData, index: number): RunState {
  const def = itemDef(data, state.player.consumables[index]);
  if (!def?.use) return state;
  const consumables = state.player.consumables.filter((_, i) => i !== index);
  let next: RunState = { ...state, player: { ...state.player, consumables } };
  const origin = { actorId: next.player.id, cause: next.player.defId };
  for (const effect of def.use.effects) next = applyEffect(next, data, next.player.id, origin, effect, {}, 1).state;
  return next;
}

// F005 규칙 12: 빌드 아이템 후보 만들기 (loot 흐름). 후보가 없으면 빈 목록
export function generateChoice(state: RunState, data: GameData, source: ItemChoice['source']): { state: RunState; options: string[] } {
  const slots = { chest: data.loot.chestChoices, secret: data.loot.secretChoices, puzzle: data.loot.puzzleChoices }[source];
  const rareChance = themeForFloor(data, state.floorNumber).rareChance;
  const owned = new Set(state.player.buildItems);
  const builds = data.items.filter((it) => it.kind === 'build' && weightOf(it) > 0);
  const rolled = withLoot(state, (rng) => {
    const options: string[] = [];
    for (let i = 0; i < slots; i++) {
      const rare = chance(rng, rareChance);
      const available = (rarity: string) => builds.filter((it) => it.rarity === rarity && !owned.has(it.id) && !options.includes(it.id));
      // 정한 등급이 비었으면 다른 등급에서. 둘 다 비면 그 칸은 비운다
      const primary = available(rare ? 'rare' : 'common');
      const pool = primary.length > 0 ? primary : available(rare ? 'common' : 'rare');
      if (pool.length === 0) continue;
      options.push(pickWeighted(rng, pool.map((it) => [it.id, weightOf(it)] as const)));
    }
    return options;
  });
  return { state: rolled.state, options: rolled.value };
}

// F005 규칙 8, 9: 상자 열기 (interact, 한 턴). 연 상자는 지나갈 수 있다
export function openChest(state: RunState, data: GameData, chestId: number): RunState {
  const chest = state.floor.objects.find((o) => o.id === chestId);
  if (!chest || chest.state.opened) return state;
  const opened = { ...chest, blocksMove: false, state: { ...chest.state, opened: true } };
  let next: RunState = { ...state, floor: { ...state.floor, objects: state.floor.objects.map((o) => (o.id === chestId ? opened : o)) } };
  const choice = generateChoice(next, data, 'chest');
  next = choice.state;
  if (choice.options.length > 0) return { ...next, pendingChoice: { source: 'chest', options: choice.options } };
  // 규칙 12-5: 후보가 하나도 없으면 exhaustedReward. 인벤토리에 자리가 없으면 상자 옆 바닥에
  const { item, count } = data.loot.exhaustedReward;
  for (let i = 0; i < count; i++) {
    if (next.player.consumables.length < data.player.inventorySize) {
      next = { ...next, player: { ...next.player, consumables: [...next.player.consumables, item] } };
    } else {
      next = dropItem(next, item, chest);
    }
  }
  return next;
}

// 빌드 아이템을 목록 끝에 더한다. 개발자 모드 아이템 생성도 이것을 쓴다
// F005 규칙 15: 최대 HP가 늘면 현재 HP도 같은 만큼. effects.md 7절 규칙 2: 새 면역이 생기면 그 일시 효과는 풀린다
export function addBuildItem(state: RunState, data: GameData, itemId: string): RunState {
  const before = getStat(state.player, 'maxHp', data);
  const withItem = { ...state.player, buildItems: [...state.player.buildItems, itemId] };
  const gained = Math.max(0, getStat(withItem, 'maxHp', data) - before);
  const immune = immunitiesOf(withItem, data);
  const player = {
    ...withItem,
    hp: withItem.hp + gained,
    statuses: withItem.statuses.filter((s) => !immune.includes(statusImmunity(s.id))),
  };
  return { ...state, player };
}

// F005 규칙 14: 고른 후보를 빌드 아이템으로. onPickup, 메시지. 턴은 쓰지 않는다
export function chooseItem(state: RunState, data: GameData, index: number): RunState {
  const itemId = state.pendingChoice?.options[index];
  if (itemId === undefined) return state;
  let next = addBuildItem({ ...state, pendingChoice: undefined }, data, itemId);
  next = { ...next, runStats: { ...next.runStats, itemsFound: next.runStats.itemsFound + 1 } };
  next = fireEvent(next, data, next.player.id, 'onPickup', { itemId }).state;
  return addMessage(next, MESSAGES.gotItem(itemDef(data, itemId)?.name ?? itemId), data);
}

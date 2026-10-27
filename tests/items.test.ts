// F005 아이템과 빌드
import { describe, expect, it } from 'vitest';
import { generateFloor } from '../src/core/dungeon';
import { getStat } from '../src/core/effects';
import { transition } from '../src/core/flow';
import { CHEST_OBJECT_TYPE, generateChoice, monsterDrop } from '../src/core/items';
import { placeRoomFeatures } from '../src/core/roomFeatures';
import { MESSAGES } from '../src/core/messages';
import { createRun, enterFloor } from '../src/core/run';
import type { MapObject, RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const right = (s: RunState) => playTurn(s, { type: 'direction', direction: 'right' }, data);
const rest = (s: RunState) => playTurn(s, { type: 'rest' }, data);
const use = (s: RunState, index: number) => playTurn(s, { type: 'useItem', index }, data);
const builds = data.items.filter((it) => it.kind === 'build');
const maxHp = (s: RunState) => getStat(s.player, 'maxHp', data);

const withPotionAt = (s: RunState, x: number, y: number): RunState => ({
  ...s,
  floor: { ...s.floor, items: [...s.floor.items, { id: 900, defId: 'potion_heal', x, y }] },
});
const withChestAt = (s: RunState, x: number, y: number): RunState => {
  const chest: MapObject = { id: 901, type: CHEST_OBJECT_TYPE, x, y, blocksMove: true, blocksSight: false, state: { opened: false } };
  return { ...s, floor: { ...s.floor, objects: [...s.floor.objects, chest] } };
};

const CORRIDOR = `
  ######
  #@...#
  ######`;

describe('F005 소모품', () => {
  it('바닥의 회복 물약을 밟으면 인벤토리에 들어가고 바닥에서 사라진다. 턴 수는 이동 1턴만 는다', () => {
    const s = withPotionAt(stateFromMap(CORRIDOR, data), 2, 1);
    const after = right(s);
    expect(after.player.consumables).toEqual(['potion_heal']);
    expect(after.floor.items).toEqual([]);
    expect(after.turn).toBe(s.turn + 1);
    expect(after.runStats.itemsFound).toBe(s.runStats.itemsFound + 1);
  });

  it('물약을 주우면 "회복 물약을 주웠다.", 마시면 "회복 물약을 마셨다. (HP +n)". HP 25/30에서 마시면 n은 5', () => {
    const picked = right(withPotionAt(stateFromMap(CORRIDOR, data), 2, 1));
    expect(picked.messageLog.map((m) => m.text)).toContain('회복 물약을 주웠다.');
    const hurt = { ...picked, player: { ...picked.player, hp: 25 } };
    const used = use(hurt, 0);
    expect(used.messageLog.at(-1)?.text).toBe('회복 물약을 마셨다. (HP +5)');
  });

  it('인벤토리가 가득 차면 아이템이 바닥에 남고 메시지가 나온다', () => {
    const s0 = withPotionAt(stateFromMap(CORRIDOR, data), 2, 1);
    const s = { ...s0, player: { ...s0.player, consumables: new Array(data.player.inventorySize).fill('potion_heal') } };
    const after = right(s);
    expect(after.floor.items.length).toBe(1);
    expect(after.player.consumables.length).toBe(data.player.inventorySize);
    expect(after.messageLog.map((m) => m.text)).toContain(MESSAGES.bagFull());
  });

  it('회복 물약 사용 후 HP가 늘고 최대 HP를 넘지 않는다. 최대 HP에서 쓰면 아이템과 턴 수가 그대로다', () => {
    const s0 = stateFromMap(CORRIDOR, data);
    const s = { ...s0, player: { ...s0.player, hp: 25, consumables: ['potion_heal'] } };
    const used = use(s, 0);
    expect(used.player.hp).toBe(maxHp(s));
    expect(used.player.consumables).toEqual([]);
    expect(used.turn).toBe(s.turn + 1);
    const low = use({ ...s, player: { ...s.player, hp: 5 } }, 0);
    expect(low.player.hp).toBe(15);
    const full = { ...s, player: { ...s.player, hp: maxHp(s) } };
    expect(use(full, 0)).toBe(full);
    expect(use(s, 3)).toBe(s); // 빈 칸 번호
  });

  it('층마다 바닥 소모품이 테마 itemCount 범위 안에서 방 안에 놓인다', () => {
    for (let seed = 0; seed < 100; seed++) {
      const run = createRun(data, seed, 'playing');
      const theme = data.themes.find((t) => t.floors.includes(1))!;
      expect(run.floor.items.length).toBeGreaterThanOrEqual(theme.itemCount[0]);
      expect(run.floor.items.length).toBeLessThanOrEqual(theme.itemCount[1]);
      for (const it of run.floor.items) {
        expect(run.floor.rooms.some((r) => it.x >= r.x && it.x < r.x + r.w && it.y >= r.y && it.y < r.y + r.h)).toBe(true);
        expect(run.floor.objects.some((o) => o.x === it.x && o.y === it.y)).toBe(false);
      }
    }
  });

  it('몬스터 1000마리를 쓰러뜨렸을 때(시드 고정) 회복 물약 드롭 비율이 8% ±2%p 안이다', () => {
    let s = stateFromMap(`
      #####
      #@g.#
      #####`, data);
    const goblin = s.floor.actors[0];
    let drops = 0;
    for (let i = 0; i < 1000; i++) {
      const before = s.floor.items.length;
      s = monsterDrop({ ...s, floor: { ...s.floor, items: [] } }, data, goblin);
      if (s.floor.items.length > before) drops++;
    }
    expect(Math.abs(drops / 1000 - data.loot.monsterDrop.chance)).toBeLessThan(0.02);
  });
});

describe('F005 보물상자와 고르기', () => {
  it('시드 1000개로 1~9층을 만들었을 때 모든 층에 상자가 1개 이상 있고, 10층에는 없다', () => {
    for (let seed = 0; seed < 1000; seed++) {
      for (let floorNumber = 1; floorNumber <= data.dungeon.maxFloor; floorNumber++) {
        const g = generateFloor(data, seed, floorNumber, 1);
        const { floor } = placeRoomFeatures(g.floor, g.nextId);
        const chests = floor.objects.filter((o) => o.type === CHEST_OBJECT_TYPE && o.state.source === 'chest');
        if (floorNumber === data.dungeon.maxFloor) expect(chests.length).toBe(0);
        else {
          expect(chests.length).toBeGreaterThanOrEqual(1);
          const room = floor.rooms.find((r) => chests[0].x >= r.x && chests[0].x < r.x + r.w && chests[0].y >= r.y && chests[0].y < r.y + r.h)!;
          expect(room.type).toBe('treasure');
        }
      }
    }
  });

  it('상자를 열면 그 턴이 끝난 뒤 후보 3개가 나오고, 셋은 서로 다르며 플레이어가 가진 아이템이 없다', () => {
    const s0 = withChestAt(stateFromMap(CORRIDOR, data), 2, 1);
    const s = { ...s0, player: { ...s0.player, buildItems: ['spear', 'owl_eye'] } };
    const opened = right(s);
    expect(opened.phase).toBe('itemChoice');
    expect(opened.turn).toBe(s.turn + 1);
    const options = opened.pendingChoice!.options;
    expect(options.length).toBe(data.loot.chestChoices);
    expect(new Set(options).size).toBe(options.length);
    for (const id of options) expect(s.player.buildItems).not.toContain(id);
  });

  it('후보를 고르면 빌드 아이템에 추가되고, 연 상자는 지나갈 수 있다', () => {
    const opened = right(withChestAt(stateFromMap(CORRIDOR, data), 2, 1));
    const pick = opened.pendingChoice!.options[1];
    const chosen = transition(opened, { type: 'choose', index: 1 }, data);
    expect(chosen.player.buildItems).toEqual([pick]);
    const walked = right(chosen);
    expect(walked.player.x).toBe(2);
  });

  it('고르지 않은 아이템은 다음 상자에서 다시 후보로 나올 수 있다', () => {
    const s = stateFromMap(CORRIDOR, data);
    const first = generateChoice(s, data, 'chest');
    const notChosen = first.options.slice(1);
    let again = false;
    let cur = { ...first.state, player: { ...s.player, buildItems: [first.options[0]] } };
    for (let i = 0; i < 50 && !again; i++) {
      const next = generateChoice(cur, data, 'chest');
      if (next.options.some((id) => notChosen.includes(id))) again = true;
      cur = next.state;
    }
    expect(again).toBe(true);
  });

  it('빌드 아이템을 19개 가진 상태에서 상자를 열면 후보가 1개만, 20개를 모두 가졌으면 회복 물약 2개를 받는다', () => {
    expect(builds.length).toBe(20);
    const s0 = withChestAt(stateFromMap(CORRIDOR, data), 2, 1);
    const nineteen = { ...s0, player: { ...s0.player, buildItems: builds.slice(1).map((it) => it.id) } };
    expect(right(nineteen).pendingChoice!.options).toEqual([builds[0].id]);
    const all = { ...s0, player: { ...s0.player, buildItems: builds.map((it) => it.id) } };
    const rewarded = right(all);
    expect(rewarded.phase).toBe('playing');
    expect(rewarded.player.consumables).toEqual(['potion_heal', 'potion_heal']);
  });

  it('후보가 없고 인벤토리가 가득 차면 보상은 상자 옆 바닥에 떨어진다', () => {
    const s0 = withChestAt(stateFromMap(CORRIDOR, data), 2, 1);
    const full = {
      ...s0,
      player: { ...s0.player, buildItems: builds.map((it) => it.id), consumables: new Array(data.player.inventorySize).fill('potion_heal') },
    };
    expect(right(full).floor.items.length).toBe(data.loot.exhaustedReward.count);
  });

  it('theme_3에서 상자 1000개의 후보 칸 중 희귀 비율이 50% ±3%p 안이다', () => {
    let s = enterFloor(createRun(data, 3, 'playing'), data, 7);
    let rare = 0;
    let total = 0;
    for (let i = 0; i < 1000; i++) {
      const choice = generateChoice(s, data, 'chest');
      s = choice.state;
      for (const id of choice.options) {
        total++;
        if (builds.find((it) => it.id === id)!.rarity === 'rare') rare++;
      }
    }
    expect(Math.abs(rare / total - 0.5)).toBeLessThan(0.03);
  });

  it('튼튼한 심장을 얻으면 최대 HP와 현재 HP가 모두 6 는다', () => {
    const s0 = stateFromMap(CORRIDOR, data);
    const s = { ...s0, player: { ...s0.player, hp: 20 }, pendingChoice: { source: 'chest' as const, options: ['sturdy_heart'] }, phase: 'itemChoice' as const };
    const after = transition(s, { type: 'choose', index: 0 }, data);
    expect(maxHp(after)).toBe(maxHp(s) + 6);
    expect(after.player.hp).toBe(26);
  });

  it('정화의 부적이 있으면 슬라임에게 맞아도 약화가 걸리지 않는다', () => {
    const s0 = stateFromMap(`
      #####
      #@s.#
      #####`, data);
    const s = { ...s0, player: { ...s0.player, buildItems: ['purity_charm'] } };
    const after = rest(s);
    expect(after.player.hp).toBeLessThan(s.player.hp);
    expect(after.player.statuses).toEqual([]);
  });
});

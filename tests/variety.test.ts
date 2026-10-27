// F014 몬스터 다양화
import { describe, expect, it } from 'vitest';
import { firstStep } from '../src/core/ai';
import { applyDamage, resolveAttack } from '../src/core/damage';
import { generateFloor } from '../src/core/dungeon';
import { getStat } from '../src/core/effects';
import { MESSAGES } from '../src/core/messages';
import { spawnMonsters } from '../src/core/monsters';
import type { Actor, RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { statusLines } from '../src/render/view';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const def = (id: string) => data.monsters.find((m) => m.id === id)!;
const rest = (s: RunState) => playTurn(s, { type: 'rest' }, data);
const go = (s: RunState, direction: 'up' | 'down' | 'left' | 'right') => playTurn(s, { type: 'direction', direction }, data);
const byDef = (s: RunState, id: string) => s.floor.actors.find((a) => a.defId === id)!;
const texts = (s: RunState) => s.messageLog.map((m) => m.text);
const shots = (s: RunState) => texts(s).filter((t) => t.includes('의 화살에') || t.includes('의 저주에'));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const setMonster = (s: RunState, id: number, patch: Partial<Actor>): RunState => ({
  ...s,
  floor: { ...s.floor, actors: s.floor.actors.map((a) => (a.id === id ? { ...a, ...patch } : a)) },
});

describe('F014 원거리 (ranged)', () => {
  it('같은 줄, 사거리 안, 사이가 비어 있으면 그 자리에서 공격한다', () => {
    const s = stateFromMap(`
      ########
      #@..a..#
      ########`, data);
    const archer = byDef(s, 'goblin_archer');
    const after = rest(s);
    expect([byDef(after, 'goblin_archer').x]).toEqual([archer.x]);
    const dmg = def('goblin_archer').attack - data.player.defense;
    expect(after.player.hp).toBe(s.player.hp - dmg);
    expect(texts(after)).toContain(MESSAGES.monsterShot('고블린 궁수', '화살', dmg));
  });

  it('사이에 다른 몬스터가 있으면 일반 궁수는 쏘지 않고, 해골 궁수(관통)는 쏜다', () => {
    const blocked = rest(stateFromMap(`
      ########
      #@.ga..#
      ########`, data));
    expect(shots(blocked)).toEqual([]);
    const pierced = rest(stateFromMap(`
      ########
      #@.gk..#
      ########`, data));
    expect(shots(pierced).length).toBe(1);
    expect(shots(pierced)[0]).toContain('해골 궁수의 화살에');
  });

  it('사이에 벽이 있으면 어떤 궁수도 쏘지 않는다', () => {
    for (const m of ['a', 'k']) {
      const s = stateFromMap(`
        ########
        #@.#${m}..#
        ########`, data);
      expect(shots(rest(s))).toEqual([]);
    }
  });

  it('대각선에 있는 플레이어는 원거리 몬스터도 공격하지 않는다', () => {
    const s = stateFromMap(`
      ######
      #@...#
      #..a.#
      ######`, data);
    const after = rest(s);
    expect(shots(after)).toEqual([]);
    expect(after.player.hp).toBe(s.player.hp);
  });

  it('사격선이 없으면 사격 위치 쪽으로 움직이고, 플레이어에게 붙으러 오지 않는다', () => {
    let s = stateFromMap(`
      #######
      #@....#
      #.....#
      #.....#
      #....a#
      #######`, data);
    let shot = false;
    for (let i = 0; i < 6; i++) {
      s = rest(s);
      expect(dist(byDef(s, 'goblin_archer'), s.player)).toBeGreaterThan(1);
      if (shots(s).length > 0) shot = true;
    }
    expect(shot).toBe(true);
  });

  it('붙으면 한 칸 물러난다. 다시 붙으면 그다음 턴에는 물러나지 않고 근접 공격한다', () => {
    const s = stateFromMap(`
      ########
      #@a....#
      #......#
      ########`, data);
    const first = rest(s);
    const archer = byDef(first, 'goblin_archer');
    expect(dist(archer, first.player)).toBe(2);
    expect(first.player.hp).toBe(s.player.hp);
    // 플레이어가 따라가 붙는다
    const dir = firstStep(first.floor, first.player, archer)!;
    const second = go(first, dir);
    expect(dist(byDef(second, 'goblin_archer'), second.player)).toBe(1);
    const melee = def('goblin_archer').attack - data.player.defense;
    expect(second.player.hp).toBe(first.player.hp - melee);
    expect(texts(second)).toContain(MESSAGES.monsterHit('고블린 궁수', melee));
  });

  it('넓은 방에서 계속 따라가면 4턴 안에 적어도 한 번은 인접한 상태로 플레이어 차례가 온다', () => {
    let s = stateFromMap(`
      ##########
      #........#
      #...@a...#
      #........#
      #........#
      ##########`, data);
    s = rest(s); // 물러난다
    let adjacentOnMyTurn = false;
    for (let i = 0; i < 4 && !adjacentOnMyTurn; i++) {
      const archer = byDef(s, 'goblin_archer');
      if (dist(archer, s.player) === 1) adjacentOnMyTurn = true;
      else s = go(s, firstStep(s.floor, s.player, archer)!);
    }
    expect(adjacentOnMyTurn).toBe(true);
  });
});

describe('F014 겁쟁이 (flee)와 도둑', () => {
  it('HP가 기준 이하가 된 다음 턴부터 플레이어와의 거리가 줄지 않는다', () => {
    let s = stateFromMap(`
      #########
      #.......#
      #..@h...#
      #.......#
      #########`, data);
    const thief = byDef(s, 'goblin_thief');
    s = setMonster(s, thief.id, { hp: Math.floor(def('goblin_thief').maxHp * def('goblin_thief').fleeHpRatio!) });
    let prev = dist(byDef(s, 'goblin_thief'), s.player);
    for (let i = 0; i < 6; i++) {
      s = rest(s);
      const d = dist(byDef(s, 'goblin_thief'), s.player);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    expect(byDef(s, 'goblin_thief').ai?.fleeing).toBe(true);
  });

  it('도둑에게 맞으면 가장 나중에 얻은 소모품이 사라지고, 도둑이 도망 상태가 된다', () => {
    const s = stateFromMap(`
      ######
      #@h..#
      ######`, data);
    const withBag = { ...s, player: { ...s.player, consumables: ['potion_heal', 'potion_heal'] } };
    const after = rest(withBag);
    expect(after.player.consumables).toEqual(['potion_heal']);
    const thief = byDef(after, 'goblin_thief');
    expect(thief.ai?.fleeing).toBe(true);
    expect(thief.carried).toEqual(['potion_heal']);
    expect(texts(after)).toContain(MESSAGES.stole('고블린 도둑', '회복 물약'));
  });

  it('소모품이 없을 때 도둑에게 맞으면 도둑은 계속 싸운다', () => {
    const start = stateFromMap(`
      ######
      #@h..#
      ######`, data);
    const s = rest(rest(start));
    expect(byDef(s, 'goblin_thief').ai?.fleeing).toBeFalsy();
    expect(dist(byDef(s, 'goblin_thief'), s.player)).toBe(1);
    expect(s.player.hp).toBe(start.player.hp - 2 * Math.max(1, def('goblin_thief').attack - data.player.defense));
  });

  it('도둑을 쓰러뜨리면 훔친 소모품이 바닥에 떨어진다', () => {
    const s = stateFromMap(`
      ######
      #@h..#
      ######`, data);
    const thief = byDef(s, 'goblin_thief');
    const carrying = setMonster(s, thief.id, { hp: 1, carried: ['potion_heal'] });
    const after = go(carrying, 'right');
    expect(after.floor.actors.some((a) => a.id === thief.id)).toBe(false);
    expect(after.floor.items.map((it) => [it.defId, it.x, it.y])).toEqual([['potion_heal', thief.x, thief.y]]);
  });

  it('도망 중인 도둑이 5턴 연속 시야 밖에 있으면 사라지고, 메시지가 남는다', () => {
    let s = stateFromMap(`
      #########
      #@..#.h.#
      #########`, data);
    const thief = byDef(s, 'goblin_thief');
    s = setMonster(s, thief.id, { carried: ['potion_heal'], ai: { fleeing: true } });
    const limit = def('goblin_thief').vanishWhenUnseen!;
    for (let i = 0; i < limit - 1; i++) s = rest(s);
    expect(s.floor.actors.some((a) => a.id === thief.id)).toBe(true);
    s = rest(s);
    expect(s.floor.actors.some((a) => a.id === thief.id)).toBe(false);
    expect(texts(s)).toContain(MESSAGES.fledWith('고블린 도둑'));
    expect(s.floor.items).toEqual([]);
  });
});

describe('F014 매복 (ambush)', () => {
  it('플레이어가 보여도 인접하기 전까지 위치가 변하지 않는다. 피해를 받으면 깨어난다', () => {
    let s = stateFromMap(`
      ########
      #@...G.#
      ########`, data);
    const g = byDef(s, 'gargoyle');
    for (let i = 0; i < 3; i++) s = rest(s);
    expect([byDef(s, 'gargoyle').x, byDef(s, 'gargoyle').y]).toEqual([g.x, g.y]);
    s = applyDamage(s, data, { actorId: s.player.id, cause: 'player' }, g.id, 1, 1);
    expect(byDef(s, 'gargoyle').ai?.awake).toBe(true);
    s = rest(s);
    expect(byDef(s, 'gargoyle').x).toBe(g.x - 1);
  });

  it('인접하면 깨어나면서 바로 공격한다', () => {
    const s = stateFromMap(`
      #####
      #@G.#
      #####`, data);
    const after = rest(s);
    expect(after.player.hp).toBe(s.player.hp - (def('gargoyle').attack - data.player.defense));
    expect(byDef(after, 'gargoyle').ai?.awake).toBe(true);
  });

  it('가고일은 방 입구 옆 칸에 놓인다 (그런 칸이 있을 때)', () => {
    let checked = 0;
    for (let seed = 0; seed < 300; seed++) {
      const g = generateFloor(data, seed, 7, 1);
      const { floor } = spawnMonsters(g.floor, data, seed, 7, g.nextId);
      const isFloor = (x: number, y: number) => floor.tiles[y * floor.width + x] === 'floor';
      for (const m of floor.actors.filter((a) => a.defId === 'gargoyle')) {
        const room = floor.rooms.find((r) => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h)!;
        const inRoom = (x: number, y: number) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
        const around = (x: number, y: number) => [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]];
        const isEntrance = (x: number, y: number) => inRoom(x, y) && around(x, y).some(([nx, ny]) => !inRoom(nx, ny) && isFloor(nx, ny));
        expect(isEntrance(m.x, m.y), `seed ${seed}: 입구 칸 위`).toBe(false);
        expect(around(m.x, m.y).some(([nx, ny]) => isEntrance(nx, ny)), `seed ${seed}: 입구 옆이 아님`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe('F014 특성과 일시 효과', () => {
  it('슬라임에게 맞으면 그다음 3턴 동안 공격이 2 낮아지고, 상태창에 "약화"가 보인다', () => {
    let s = stateFromMap(`
      #####
      #@s.#
      #####`, data);
    s = rest(s);
    expect(statusLines(s, data).map((l) => l.text)).toContain('약화 (3턴)');
    // 슬라임을 치우고 3턴을 지켜본다
    s = { ...s, floor: { ...s.floor, actors: [] } };
    const attacks = [];
    for (let i = 0; i < 4; i++) {
      attacks.push(getStat(s.player, 'attack', data));
      s = rest(s);
    }
    const a = data.player.attack;
    expect(attacks).toEqual([a - 2, a - 2, a - 2, a]);
  });

  it('슬라임과 주술사에게 연달아 맞아도 공격 감소는 −2 한 번뿐이다', () => {
    let s = stateFromMap(`
      #######
      #@s.m.#
      #######`, data);
    s = { ...s, floor: { ...s.floor, actors: s.floor.actors.map((a) => (a.defId === 'orc_shaman' ? { ...a, defId: 'orc_shaman' } : a)) } };
    // 주술사는 슬라임 뒤라 못 쏜다. 슬라임을 아래로 옮겨 사격선을 열어 준다
    const slime = byDef(s, 'slime');
    s = setMonster(s, slime.id, { hp: 99 });
    s = rest(s); // 슬라임에게 맞음
    s = { ...s, floor: { ...s.floor, actors: s.floor.actors.filter((a) => a.defId !== 'slime') } };
    s = rest(s); // 주술사에게 맞음
    expect(shots(s).length).toBeGreaterThan(0);
    expect(s.player.statuses.filter((x) => x.id === 'weak').length).toBe(1);
    expect(getStat(s.player, 'attack', data)).toBe(data.player.attack - 2);
  });

  it('트롤은 턴 끝마다 HP가 1 회복되고 최대 HP를 넘지 않는다', () => {
    let s = stateFromMap(`
      ########
      #@.#..t#
      ########`, data);
    const troll = byDef(s, 'troll');
    s = setMonster(s, troll.id, { hp: def('troll').maxHp - 2 });
    s = rest(s);
    expect(byDef(s, 'troll').hp).toBe(def('troll').maxHp - 1);
    s = rest(rest(s));
    expect(byDef(s, 'troll').hp).toBe(def('troll').maxHp);
  });

  it('몬스터가 처음 보이면 "{이름}이(가) 보인다." 메시지가 한 번 남는다', () => {
    let s = stateFromMap(`
      ###########
      #@........#
      #.....o...#
      ###########`, data);
    s = rest(s);
    const count = () => texts(s).filter((t) => t === MESSAGES.noticed('오크')).length;
    expect(count()).toBe(1);
    for (let i = 0; i < 3; i++) s = rest(s);
    expect(count()).toBe(1);
  });
});

describe('F014 배치와 결정성', () => {
  it('시드 1000개로 1~3층을 생성했을 때 몬스터 종류 비율이 가중치 비율과 ±5%p 안에서 맞는다', () => {
    const theme = data.themes.find((t) => t.floors.includes(1))!;
    const counts: Record<string, number> = {};
    let total = 0;
    for (let seed = 0; seed < 1000; seed++) {
      for (const floorNumber of theme.floors) {
        const g = generateFloor(data, seed, floorNumber, 1);
        for (const m of spawnMonsters(g.floor, data, seed, floorNumber, g.nextId).floor.actors) {
          counts[m.defId] = (counts[m.defId] ?? 0) + 1;
          total++;
        }
      }
    }
    const weightSum = Object.values(theme.monsterTypes).reduce((a, b) => a + b, 0);
    for (const [id, w] of Object.entries(theme.monsterTypes)) {
      expect(Math.abs((counts[id] ?? 0) / total - w / weightSum), id).toBeLessThan(0.05);
    }
  });

  it('같은 상태에서 같은 행동을 반복하면 결과가 항상 같다 (무작위 없음)', () => {
    const s = stateFromMap(`
      ##########
      #@.......#
      #..a..s..#
      #.h....k.#
      #...G..m.#
      ##########`, data);
    const runIt = () => {
      let cur = s;
      const dirs = ['right', 'down', 'right', 'right', 'up', 'left'] as const;
      for (let i = 0; i < 12; i++) cur = i % 2 ? rest(cur) : go(cur, dirs[i % dirs.length]);
      return cur;
    };
    expect(runIt()).toEqual(runIt());
    expect(resolveAttack(s, data, s.player.id, byDef(s, 'goblin_archer').id)).toEqual(
      resolveAttack(s, data, s.player.id, byDef(s, 'goblin_archer').id),
    );
  });
});

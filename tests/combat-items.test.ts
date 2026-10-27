// F015 전투 규칙 아이템
import { describe, expect, it } from 'vitest';
import { resolveAttack } from '../src/core/damage';
import { getStat } from '../src/core/effects';
import { MESSAGES } from '../src/core/messages';
import { createRun } from '../src/core/run';
import type { RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { grantItem } from '../src/dev/commands';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const F015_ITEMS = [
  'sharp_dagger', 'vampire_ring', 'thorn_armor', 'warrior_crest', 'shadow_cloak',
  'spear', 'war_hammer', 'poison_blade', 'piercing_tip',
];
const holding = (s: RunState, ...ids: string[]): RunState => ({ ...s, player: { ...s.player, buildItems: ids } });
const rest = (s: RunState) => playTurn(s, { type: 'rest' }, data);
const right = (s: RunState) => playTurn(s, { type: 'direction', direction: 'right' }, data);
const texts = (s: RunState) => s.messageLog.map((m) => m.text);
const monster = (s: RunState) => s.floor.actors[0];
const withMonster = (s: RunState, patch: Partial<RunState['floor']['actors'][0]>): RunState => ({
  ...s,
  floor: { ...s.floor, actors: [{ ...monster(s), ...patch }, ...s.floor.actors.slice(1)] },
});

// 확률 아이템을 시험할 때: 같은 시드에서 여러 번 굴린다 (rng를 이어서 쓴다)
function attackMany(s: RunState, times: number) {
  let rng = s.rng;
  const results = [];
  for (let i = 0; i < times; i++) {
    const r = resolveAttack({ ...s, rng }, data, s.player.id, monster(s).id);
    rng = r.state.rng;
    results.push(r);
  }
  return results;
}

const VS_GOBLIN = `
  #####
  #@g.#
  #####`;

describe('F015 전투 규칙 아이템', () => {
  it('아이템이 하나도 없으면 같은 전투는 항상 같은 결과다', () => {
    const s = stateFromMap(VS_GOBLIN, data);
    const damages = new Set(attackMany(s, 200).map((r) => r.damage));
    expect(damages.size).toBe(1);
  });

  it('단검: 시드를 고정하고 1000번 공격하면 치명타 비율이 25% ±3%p, 발동하면 "치명타!"가 먼저 남는다', () => {
    const s = holding(stateFromMap(VS_GOBLIN, data), 'sharp_dagger');
    const normal = data.player.attack - data.monsters.find((m) => m.id === 'goblin')!.defense;
    const results = attackMany(s, 1000);
    const crits = results.filter((r) => r.damage === normal * 2).length;
    expect(Math.abs(crits / 1000 - 0.25)).toBeLessThan(0.03);
    const critTurn = results.find((r) => r.damage === normal * 2)!;
    expect(texts(critTurn.state).at(-1)).toBe('치명타!');
    // 실제 턴에서는 발동 메시지 → 피해 메시지 순서
    let cur = s;
    for (let i = 0; i < 50 && !texts(cur).includes('치명타!'); i++) cur = right(withMonster(cur, { hp: 99 }));
    const log = texts(cur);
    const at = log.lastIndexOf('치명타!');
    expect(log[at + 1]).toBe(MESSAGES.playerHit('고블린', normal * 2));
  });

  it('흡혈 반지: 공격이 맞으면 HP +1, 최대 HP를 넘지 않는다', () => {
    const s = holding(stateFromMap(VS_GOBLIN, data), 'vampire_ring');
    const hurt = { ...s, player: { ...s.player, hp: 10 } };
    expect(resolveAttack(hurt, data, s.player.id, monster(s).id).state.player.hp).toBe(11);
    expect(resolveAttack(s, data, s.player.id, monster(s).id).state.player.hp).toBe(s.player.hp);
  });

  it('가시 갑옷: 몬스터에게 맞으면 그 몬스터 HP −1. 중독 피해에는 발동하지 않는다', () => {
    const s = holding(stateFromMap(VS_GOBLIN, data), 'thorn_armor');
    const g = monster(s);
    expect(monster(resolveAttack(s, data, g.id, s.player.id).state).hp).toBe(g.hp - 1);
    const poisoned = { ...s, player: { ...s.player, statuses: [{ id: 'poison', turnsLeft: 2, appliedTurn: s.turn - 1 }] } };
    const far = { ...poisoned, floor: { ...poisoned.floor, actors: [{ ...g, x: 3 }] } };
    const after = rest(far);
    expect(after.player.hp).toBe(s.player.hp - 1);
    expect(monster(after).hp).toBe(g.hp);
  });

  it('가시 갑옷: 몬스터와 같이 쓰러져도 사망 원인은 그 몬스터다', () => {
    const s = holding(stateFromMap(VS_GOBLIN, data), 'thorn_armor');
    const both = withMonster({ ...s, player: { ...s.player, hp: 1 } }, { hp: 1 });
    const after = resolveAttack(both, data, monster(s).id, s.player.id).state;
    expect(after.floor.actors).toEqual([]);
    expect(after.player.hp).toBeLessThanOrEqual(0);
    expect(after.runStats.killedBy).toBe(monster(s).defId);
  });

  it('전사의 문장: 공격으로 쓰러뜨리면 HP +3. 가시·중독으로 죽으면 발동하지 않는다', () => {
    const s = holding(stateFromMap(VS_GOBLIN, data), 'warrior_crest', 'thorn_armor');
    const hurt = { ...s, player: { ...s.player, hp: 10 } };
    const killed = right(withMonster(hurt, { hp: 1 }));
    expect(killed.floor.actors).toEqual([]);
    expect(killed.player.hp).toBe(13);
    // 가시로 죽음: 고블린이 공격 → 가시 1 → 고블린 HP 1이면 죽는다
    const thorned = resolveAttack(withMonster(hurt, { hp: 1 }), data, monster(s).id, s.player.id).state;
    expect(thorned.floor.actors).toEqual([]);
    expect(thorned.runStats.kills).toBe(s.runStats.kills + 1);
    expect(thorned.player.hp).toBe(10 - (4 - data.player.defense));
  });

  it('그림자 망토: 회피하면 HP 그대로, "공격을 피했다!", 슬라임의 약화도 걸리지 않는다', () => {
    const s = holding(stateFromMap(`
      #####
      #@s.#
      #####`, data), 'shadow_cloak');
    let rng = s.rng;
    let dodged;
    for (let i = 0; i < 100 && !dodged; i++) {
      const r = resolveAttack({ ...s, rng }, data, monster(s).id, s.player.id);
      rng = r.state.rng;
      if (r.cancelled) dodged = r;
    }
    expect(dodged).toBeDefined();
    expect(dodged!.state.player.hp).toBe(s.player.hp);
    expect(dodged!.state.player.statuses).toEqual([]);
    expect(texts(dodged!.state).at(-1)).toBe('공격을 피했다!');
  });

  it('창: 2칸 앞 몬스터를 공격할 수 있고, 창 두 개를 얻어도 사거리는 2다', () => {
    const s = holding(stateFromMap(`
      ######
      #@.g.#
      ######`, data), 'spear', 'spear');
    expect(getStat(s.player, 'attackRange', data)).toBe(2);
    const after = right(s);
    expect(after.player.x).toBe(s.player.x);
    expect(monster(after).hp).toBeLessThan(monster(s).hp);
  });

  it('전투 망치: 맞은 몬스터가 1칸 밀려난다. 뒤가 벽이면 제자리에서 HP −1 추가', () => {
    const s = holding(stateFromMap(VS_GOBLIN, data), 'war_hammer');
    const g = monster(s);
    const pushed = monster(resolveAttack(s, data, s.player.id, g.id).state);
    expect([pushed.x, pushed.y]).toEqual([g.x + 1, g.y]);
    const walled = holding(stateFromMap(`
      ####
      #@g#
      ####`, data), 'war_hammer');
    const w = monster(walled);
    const hit = monster(resolveAttack(walled, data, walled.player.id, w.id).state);
    expect([hit.x, hit.y]).toEqual([w.x, w.y]);
    expect(hit.hp).toBe(w.hp - (data.player.attack - 1) - 1);
    // 창으로 2칸 앞을 쳐도 같은 방향으로 민다 (턴 전체로 하면 고블린이 자기 차례에 다시 다가오므로 공격만 본다)
    const far = holding(stateFromMap(`
      #######
      #@.g..#
      #######`, data), 'war_hammer', 'spear');
    expect(monster(resolveAttack(far, data, far.player.id, monster(far).id).state).x).toBe(monster(far).x + 1);
  });

  it('독 바른 칼: 걸린 다음 턴부터 턴 끝마다 HP −1, 정확히 3번 피해를 받고 풀린다', () => {
    const s = holding(stateFromMap(`
      ##########
      #@#.....g#
      ##########`, data), 'poison_blade');
    // 독을 직접 건다 (확률은 단검 테스트에서 확인)
    let cur = { ...s, floor: { ...s.floor, actors: [{ ...monster(s), statuses: [{ id: 'poison', turnsLeft: 3, appliedTurn: s.turn }] }] } };
    const hp0 = monster(cur).hp;
    const hps = [];
    for (let i = 0; i < 5; i++) {
      cur = rest(cur);
      hps.push(monster(cur).hp);
    }
    expect(hps).toEqual([hp0, hp0 - 1, hp0 - 2, hp0 - 3, hp0 - 3]);
    expect(monster(cur).statuses).toEqual([]);
  });

  it('독 바른 칼: 발동하면 "독이 퍼졌다!"가 남고 중독이 걸린다. 이미 중독이면 남은 턴이 3으로', () => {
    const s = holding(stateFromMap(VS_GOBLIN, data), 'poison_blade');
    const target = withMonster(s, { hp: 999, statuses: [{ id: 'poison', turnsLeft: 1, appliedTurn: s.turn - 1 }] });
    const poisoned = attackMany(target, 100).find((r) => texts(r.state).includes('독이 퍼졌다!'))!;
    expect(monster(poisoned.state).statuses).toEqual([{ id: 'poison', turnsLeft: 3, appliedTurn: s.turn }]);
  });

  it('관통: 발동하면 방어 5인 가고일에게도 피해 = 공격', () => {
    const s = holding(stateFromMap(`
      #####
      #@G.#
      #####`, data), 'piercing_tip');
    expect(data.monsters.find((m) => m.id === 'gargoyle')!.defense).toBe(5);
    const pierced = attackMany(s, 100).find((r) => texts(r.state).includes('방어를 꿰뚫었다!'))!;
    expect(pierced.damage).toBe(data.player.attack);
  });

  it('개발자 모드 "아이템 생성"으로 9개를 모두 얻을 수 있다', () => {
    let s = createRun(data, 1, 'playing');
    for (const id of F015_ITEMS) {
      const r = grantItem(s, data, id);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.player.buildItems).toEqual(F015_ITEMS);
  });
});

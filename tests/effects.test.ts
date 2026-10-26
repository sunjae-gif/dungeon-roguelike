// 30-systems/effects.md
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStat } from '../src/core/effects';
import { resolveAttack } from '../src/core/damage';
import { MAX_EVENT_DEPTH, tickStatuses } from '../src/core/events';
import { createRun } from '../src/core/run';
import { addStatus } from '../src/core/events';
import { validateGameData } from '../src/data/validate';
import { RAW_DATA } from '../src/data/load';
import type { RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { gameData, withItems } from './helpers';
import { stateFromMap } from './parseMap';

const base = gameData();

const give = (s: RunState, ...ids: string[]): RunState => ({ ...s, player: { ...s.player, buildItems: ids } });

// 플레이어(@)와 고블린(g)이 붙어 있는 지도
const DUEL = `
  #####
  #@g.#
  #####`;

// 플레이어 오른쪽에 오크(방어 2), 그 뒤는 벽
const VS_ORC = `
  ####
  #@o#
  ####`;

describe('effects.md 1. 능력치', () => {
  it('attack 기본값 5에 add +2, mul +0.5 보정이 있으면 최종 attack은 10', () => {
    expect(base.player.attack).toBe(5);
    const data = withItems(
      { id: 't_add', modifiers: [{ stat: 'attack', op: 'add', value: 2 }] },
      { id: 't_mul', modifiers: [{ stat: 'attack', op: 'mul', value: 0.5 }] },
    );
    const run = give(createRun(data, 1, 'playing'), 't_mul', 't_add');
    expect(getStat(run.player, 'attack', data)).toBe(10);
  });

  it('곱하기 보정은 서로 더한다 (0.2 + 0.3 = ×1.5)', () => {
    const data = withItems(
      { id: 't_m1', modifiers: [{ stat: 'maxHp', op: 'mul', value: 0.2 }] },
      { id: 't_m2', modifiers: [{ stat: 'maxHp', op: 'mul', value: 0.3 }] },
    );
    const run = give(createRun(data, 1, 'playing'), 't_m1', 't_m2');
    expect(getStat(run.player, 'maxHp', data)).toBe(Math.floor(base.player.maxHp * 1.5));
  });

  it('보정 때문에 defense가 음수가 되면 0, sightRadius·maxHp는 최소 1', () => {
    const data = withItems({
      id: 't_curse',
      modifiers: [
        { stat: 'defense', op: 'add', value: -99 },
        { stat: 'sightRadius', op: 'add', value: -99 },
        { stat: 'maxHp', op: 'add', value: -999 },
      ],
    });
    const run = give(createRun(data, 1, 'playing'), 't_curse');
    expect(getStat(run.player, 'defense', data)).toBe(0);
    expect(getStat(run.player, 'sightRadius', data)).toBe(1);
    expect(getStat(run.player, 'maxHp', data)).toBe(1);
  });

  it('maxHp가 줄어 현재 HP가 더 크면 턴 끝에 최대 HP로 낮춘다', () => {
    const data = withItems({ id: 't_frail', modifiers: [{ stat: 'maxHp', op: 'add', value: -10 }] });
    const run = give(createRun(data, 1, 'playing'), 't_frail');
    expect(tickStatuses(run, data).player.hp).toBe(base.player.maxHp - 10);
  });

  it('몬스터는 monsters.json 기본값을 쓴다', () => {
    const s = stateFromMap(DUEL, base);
    const goblin = base.monsters.find((m) => m.id === 'goblin')!;
    expect(getStat(s.floor.actors[0], 'attack', base)).toBe(goblin.attack);
  });
});

describe('effects.md 2~3. 이벤트와 피해 처리', () => {
  afterEach(() => vi.restoreAllMocks());

  it('기본 피해 = attack − defense, 최소 1', () => {
    const s = stateFromMap(DUEL, base);
    const goblin = s.floor.actors[0];
    const goblinDef = base.monsters.find((m) => m.id === 'goblin')!;
    const after = resolveAttack(s, base, s.player.id, goblin.id).state;
    expect(after.floor.actors[0].hp).toBe(goblin.hp - (base.player.attack - goblinDef.defense));
    // 반대 방향: 고블린 공격 4 − 플레이어 방어 2
    const back = resolveAttack(s, base, goblin.id, s.player.id).state;
    expect(back.player.hp).toBe(s.player.hp - Math.max(1, goblinDef.attack - base.player.defense));
  });

  it('테스트용 아이템(onHit → heal 2)을 가진 플레이어가 공격에 성공하면 HP가 2 회복된다', () => {
    const data = withItems({
      id: 't_vamp',
      triggers: [{ event: 'onHit', chance: 1, effects: [{ type: 'heal', target: 'self', amount: 2 }] }],
    });
    const s = give(stateFromMap(DUEL, data), 't_vamp');
    const hurt = { ...s, player: { ...s.player, hp: 10 } };
    expect(resolveAttack(hurt, data, s.player.id, s.floor.actors[0].id).state.player.hp).toBe(12);
    // 최대 HP를 넘지 않는다
    expect(resolveAttack(s, data, s.player.id, s.floor.actors[0].id).state.player.hp).toBe(base.player.maxHp);
  });

  it('onBeforeAttack에 피해 ×2 아이템과 +1 아이템이 순서대로 있으면, 기본 피해 3은 7이 된다', () => {
    const data = withItems(
      { id: 't_x2', triggers: [{ event: 'onBeforeAttack', chance: 1, effects: [{ type: 'modifyDamage', op: 'mul', value: 2 }] }] },
      { id: 't_p1', triggers: [{ event: 'onBeforeAttack', chance: 1, effects: [{ type: 'modifyDamage', op: 'add', value: 1 }] }] },
    );
    // 공격 5 − 오크 방어 2 = 기본 피해 3
    const s = give(stateFromMap(VS_ORC, data), 't_x2', 't_p1');
    expect(resolveAttack(s, data, s.player.id, s.floor.actors[0].id).damage).toBe(7);
    // 얻은 순서가 바뀌면 (3 + 1) × 2 = 8
    const reversed = give(s, 't_p1', 't_x2');
    expect(resolveAttack(reversed, data, s.player.id, s.floor.actors[0].id).damage).toBe(8);
  });

  it(`스스로를 계속 다시 일으키는 효과를 만들어도 ${MAX_EVENT_DEPTH}단계에서 멈춘다`, () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = withItems({
      id: 't_loop',
      triggers: [{ event: 'onDamaged', chance: 1, effects: [{ type: 'damage', target: 'self', amount: 1 }] }],
    });
    const s = give(stateFromMap(DUEL, data), 't_loop');
    const goblin = s.floor.actors[0];
    const attackDamage = Math.max(1, getStat(goblin, 'attack', data) - getStat(s.player, 'defense', data));
    const after = resolveAttack(s, data, goblin.id, s.player.id).state;
    expect(after.player.hp).toBe(s.player.hp - attackDamage - MAX_EVENT_DEPTH);
    expect(warn).toHaveBeenCalled();
  });

  it('대상 HP가 0 이하면 onKill 후 몬스터가 지도에서 사라지고 처치 수가 오른다', () => {
    const data = withItems({
      id: 't_cry',
      triggers: [{ event: 'onKill', chance: 1, effects: [{ type: 'message', text: '처치!' }] }],
    });
    const s = give(stateFromMap(DUEL, data), 't_cry');
    const weak = { ...s, floor: { ...s.floor, actors: [{ ...s.floor.actors[0], hp: 1 }] } };
    const after = resolveAttack(weak, data, s.player.id, s.floor.actors[0].id).state;
    expect(after.floor.actors).toEqual([]);
    expect(after.runStats.kills).toBe(1);
    expect(after.messageLog.at(-1)?.text).toBe('처치!');
  });

  it('chance가 1이 아니면 combat 난수 흐름을 쓰고, 같은 시드면 결과가 같다', () => {
    const data = withItems({
      id: 't_luck',
      triggers: [{ event: 'onTurnEnd', chance: 0.5, message: '행운', effects: [] }],
    });
    const s = give(stateFromMap(DUEL, data), 't_luck');
    const run = (state: RunState) => {
      let cur = state;
      for (let i = 0; i < 40; i++) cur = playTurn(cur, { type: 'rest' }, data);
      return cur;
    };
    const a = run(s);
    const b = run(s);
    expect(a.messageLog).toEqual(b.messageLog);
    expect(a.rng.combat).not.toBe(s.rng.combat);
    expect(a.rng.ai).toBe(s.rng.ai);
    const lucky = a.messageLog.filter((m) => m.text === '행운').length;
    expect(lucky).toBeGreaterThan(5);
    expect(lucky).toBeLessThan(35);
  });

  it('턴 이벤트: onTurnStart, onMove, onTurnEnd가 턴 순서대로 발생한다', () => {
    const msg = (text: string) => [{ type: 'message' as const, text }];
    const data = withItems({
      id: 't_trace',
      triggers: [
        { event: 'onTurnStart', chance: 1, effects: msg('start') },
        { event: 'onMove', chance: 1, effects: msg('move') },
        { event: 'onTurnEnd', chance: 1, effects: msg('end') },
      ],
    });
    const s = give(stateFromMap(`
      #####
      #@..#
      #####`, data), 't_trace');
    const after = playTurn(s, { type: 'direction', direction: 'right' }, data);
    expect(after.messageLog.map((m) => m.text)).toEqual(['start', 'move', 'end']);
    // 무효 행동에는 이벤트가 없다
    expect(playTurn(s, { type: 'direction', direction: 'left' }, data)).toBe(s);
  });

  it('새 층에 들어오면 onFloorEnter가 발생한다', () => {
    const data = withItems({
      id: 't_floor',
      triggers: [{ event: 'onFloorEnter', chance: 1, effects: [{ type: 'heal', target: 'self', amount: 5 }] }],
    });
    const run = give(createRun(data, 3, 'playing'), 't_floor');
    const hurt = { ...run, player: { ...run.player, hp: 10 } };
    const stairs = hurt.floor.objects.find((o) => o.type === 'stairs')!;
    const down = playTurn({ ...hurt, player: { ...hurt.player, x: stairs.x, y: stairs.y } }, { type: 'descend' }, data);
    expect(down.player.hp).toBe(15);
  });

  it('보정이 시야 반경에 반영된다', () => {
    const data = withItems({ id: 't_eye', modifiers: [{ stat: 'sightRadius', op: 'add', value: 2 }] });
    const s = give(stateFromMap(`
      ###############
      #@............#
      ###############`, data), 't_eye');
    const after = playTurn(s, { type: 'rest' }, data);
    const radius = base.player.sightRadius + 2;
    expect(after.floor.visible[1 * 15 + 1 + radius]).toBe(true);
    expect(after.floor.visible[1 * 15 + 1 + radius + 1]).toBe(false);
  });

  it('전투·이동 코드에 특정 아이템 id가 나오지 않는다', () => {
    const ids = base.items.map((it) => it.id);
    const dir = join(__dirname, '../src/core');
    for (const name of readdirSync(dir)) {
      const source = readFileSync(join(dir, name), 'utf8');
      for (const id of ids) expect(source, `${name}에 "${id}"`).not.toContain(id);
    }
  });

  it('attackRange +3 보정이 있어도 플레이어 attackRange는 maxAttackRange(2)다', () => {
    const data = withItems({ id: 't_reach', modifiers: [{ stat: 'attackRange', op: 'add', value: 3 }] });
    const run = give(createRun(data, 1, 'playing'), 't_reach');
    expect(getStat(run.player, 'attackRange', data)).toBe(data.player.maxAttackRange);
    expect(data.player.maxAttackRange).toBe(2);
  });

  it('치명타(×2)를 먼저 얻고 방어 관통을 나중에 얻었어도, 둘 다 발동하면 피해 = 공격 × 2', () => {
    const data = withItems(
      { id: 't_crit', triggers: [{ event: 'onBeforeAttack', chance: 1, effects: [{ type: 'modifyDamage', op: 'mul', value: 2 }] }] },
      { id: 't_pierce', triggers: [{ event: 'onBeforeAttack', chance: 1, effects: [{ type: 'ignoreDefense' }] }] },
    );
    const s = give(stateFromMap(VS_ORC, data), 't_crit', 't_pierce');
    expect(resolveAttack(s, data, s.player.id, s.floor.actors[0].id).damage).toBe(base.player.attack * 2);
  });

  it('cancelAttack이 발동하면 대상 HP가 그대로이고 onHit이 일어나지 않는다', () => {
    const data = withItems(
      { id: 't_dodge', triggers: [{ event: 'onBeforeDamaged', chance: 1, message: '피함', effects: [{ type: 'cancelAttack' }] }] },
      { id: 't_hitmark', triggers: [{ event: 'onHit', chance: 1, effects: [{ type: 'message', text: '맞음' }] }] },
    );
    const s = give(stateFromMap(DUEL, data), 't_dodge');
    const goblin = { ...s.floor.actors[0], buildItems: ['t_hitmark'] };
    const st = { ...s, floor: { ...s.floor, actors: [goblin] } };
    const result = resolveAttack(st, data, goblin.id, st.player.id);
    expect(result.cancelled).toBe(true);
    expect(result.state.player.hp).toBe(st.player.hp);
    expect(result.state.messageLog.map((m) => m.text)).toEqual(['피함']);
  });

  it('약화(3턴)가 걸린 상태에서 다시 약화(2턴)가 걸리면 남은 턴은 3, 공격 감소는 −2 한 번뿐', () => {
    const run = createRun(base, 1, 'playing');
    const once = addStatus(run.player, 'weak', 3, run.turn);
    const twice = addStatus(once, 'weak', 2, run.turn);
    expect(twice.statuses).toEqual([{ id: 'weak', turnsLeft: 3, appliedTurn: run.turn }]);
    expect(getStat(twice, 'attack', base)).toBe(base.player.attack - 2);
  });

  it('걸린 턴을 포함해 약화 3턴짜리는 그다음 3번의 플레이어 행동에 적용되고 4번째에는 풀린다', () => {
    const s = stateFromMap(`
      #####
      #@..#
      #####`, base);
    // 이번 턴(s.turn)에 걸렸다
    let cur: RunState = { ...s, player: addStatus(s.player, 'weak', 3, s.turn) };
    cur = playTurn(cur, { type: 'rest' }, base);
    const attacks: number[] = [];
    for (let i = 0; i < 4; i++) {
      attacks.push(getStat(cur.player, 'attack', base)); // 플레이어 행동 시점의 공격
      cur = playTurn(cur, { type: 'rest' }, base);
    }
    const a = base.player.attack;
    expect(attacks).toEqual([a - 2, a - 2, a - 2, a]);
  });

  it('중독 피해로 죽은 몬스터는 처치 수에 들어가고, 처치 시 회복 아이템은 발동하지 않는다', () => {
    const data = withItems({ id: 't_crest', triggers: [{ event: 'onKill', chance: 1, effects: [{ type: 'heal', target: 'self', amount: 3 }] }] });
    const s = give(stateFromMap(`
      #######
      #@...g#
      #######`, data), 't_crest');
    const goblin = s.floor.actors[0];
    const poisoned = { ...goblin, hp: 1, statuses: [{ id: 'poison', turnsLeft: 3, appliedTurn: s.turn - 1 }] };
    const st = { ...s, player: { ...s.player, hp: 10 }, floor: { ...s.floor, actors: [poisoned] } };
    const after = playTurn(st, { type: 'rest' }, data);
    expect(after.floor.actors).toEqual([]);
    expect(after.runStats.kills).toBe(st.runStats.kills + 1);
    expect(after.player.hp).toBe(10);
  });

  it('벽 앞의 몬스터를 밀어내면 위치는 그대로이고 collisionDamage만큼 HP가 더 준다', () => {
    const data = withItems({
      id: 't_hammer',
      triggers: [{ event: 'onHit', chance: 1, effects: [{ type: 'knockback', target: 'other', distance: 1, collisionDamage: 1 }] }],
    });
    const s = give(stateFromMap(VS_ORC, data), 't_hammer');
    const orc = s.floor.actors[0];
    const after = resolveAttack(s, data, s.player.id, orc.id).state.floor.actors[0];
    expect([after.x, after.y]).toEqual([orc.x, orc.y]);
    expect(after.hp).toBe(orc.hp - 3 - 1);
  });

  it('데이터 검사: 몬스터 특성의 chance 0.5, 메시지 없는 확률 trigger, 이벤트에 맞지 않는 효과는 오류', () => {
    const errorsOf = (edit: (raw: any) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const raw = structuredClone(RAW_DATA) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      edit(raw);
      const r = validateGameData(raw);
      return r.ok ? [] : r.errors;
    };
    expect(errorsOf((r) => (r['monsters.json'].monsters[0].triggers = [
      { event: 'onHit', chance: 0.5, message: 'x', effects: [{ type: 'heal', target: 'self', amount: 1 }] },
    ])).join()).toMatch(/chance가 1이어야/);
    expect(errorsOf((r) => r['items.json'].items.push({
      id: 't', name: 't', kind: 'build', sprite: 'potion_heal', rarity: 'common', description: 't',
      triggers: [{ event: 'onHit', chance: 0.5, effects: [{ type: 'heal', target: 'self', amount: 1 }] }],
    })).join()).toMatch(/message가 필요/);
    expect(errorsOf((r) => r['items.json'].items.push({
      id: 't', name: 't', kind: 'build', sprite: 'potion_heal', rarity: 'common', description: 't',
      triggers: [{ event: 'onHit', chance: 1, effects: [{ type: 'cancelAttack' }] }],
    })).join()).toMatch(/onBeforeDamaged에서만/);
    expect(errorsOf((r) => r['items.json'].items.push({
      id: 't', name: 't', kind: 'build', sprite: 'potion_heal', rarity: 'common', description: 't',
      triggers: [{ event: 'onHit', chance: 1, effects: [{ type: 'applyStatus', target: 'other', status: 'nope', turns: 1 }] }],
    })).join()).toMatch(/statuses\.json에 없는 id "nope"/);
  });

  it('규칙 코드에 특정 몬스터·일시 효과 id 문자열이 나오지 않는다', () => {
    const ids = [...base.monsters.map((m) => m.id), ...base.statuses.map((s) => s.id)];
    const dir = join(__dirname, '../src/core');
    for (const name of readdirSync(dir)) {
      const source = readFileSync(join(dir, name), 'utf8');
      for (const id of ids) expect(source, `${name}에 '${id}'`).not.toMatch(new RegExp(`['"\`]${id}['"\`]`));
    }
  });
});

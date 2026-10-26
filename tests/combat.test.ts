// F003 전투
import { describe, expect, it } from 'vitest';
import { resolveAttack } from '../src/core/damage';
import { getStat } from '../src/core/effects';
import { MESSAGES } from '../src/core/messages';
import type { RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { gameData, withItems } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const nameOf = (id: string) => data.monsters.find((m) => m.id === id)!.name;
const right = (s: RunState, d = data) => playTurn(s, { type: 'direction', direction: 'right' }, d);
const rest = (s: RunState) => playTurn(s, { type: 'rest' }, data);

// 플레이어(@) 오른쪽에 오크(o, 방어 2)
const VS_ORC = `
  #####
  #@o.#
  #####`;

describe('F003 전투', () => {
  it('공격 5, 방어 2일 때 피해는 3이다', () => {
    const s = stateFromMap(VS_ORC, data);
    const orc = s.floor.actors[0];
    expect([getStat(s.player, 'attack', data), getStat(orc, 'defense', data)]).toEqual([5, 2]);
    expect(resolveAttack(s, data, s.player.id, orc.id).damage).toBe(3);
  });

  it('공격 2, 방어 5일 때 피해는 1이다', () => {
    const d = withItems(
      { id: 't_weak', modifiers: [{ stat: 'attack', op: 'add', value: -3 }] },
      { id: 't_shell', modifiers: [{ stat: 'defense', op: 'add', value: 3 }] },
    );
    const s = stateFromMap(VS_ORC, d);
    const orc = { ...s.floor.actors[0], buildItems: ['t_shell'] };
    const st = { ...s, player: { ...s.player, buildItems: ['t_weak'] }, floor: { ...s.floor, actors: [orc] } };
    expect([getStat(st.player, 'attack', d), getStat(orc, 'defense', d)]).toEqual([2, 5]);
    expect(resolveAttack(st, d, st.player.id, orc.id).damage).toBe(1);
  });

  it('같은 상태에서 같은 공격을 1000번 계산하면 피해가 모두 같다', () => {
    const s = stateFromMap(VS_ORC, data);
    const damages = new Set(Array.from({ length: 1000 }, () => resolveAttack(s, data, s.player.id, s.floor.actors[0].id).damage));
    expect(damages.size).toBe(1);
  });

  it('몬스터 방향으로 이동 입력을 하면 위치는 그대로이고 몬스터 HP가 준다', () => {
    const s = stateFromMap(VS_ORC, data);
    const next = right(s);
    expect([next.player.x, next.player.y]).toEqual([s.player.x, s.player.y]);
    expect(next.floor.actors[0].hp).toBe(s.floor.actors[0].hp - 3);
    expect(next.turn).toBe(s.turn + 1);
    expect(next.messageLog.map((m) => m.text)).toContain(MESSAGES.playerHit(nameOf('orc'), 3));
  });

  it('HP가 0이 된 몬스터는 다음 턴에 지도에 없고, kills가 1 늘었다', () => {
    const s = stateFromMap(VS_ORC, data);
    const weak = { ...s, floor: { ...s.floor, actors: [{ ...s.floor.actors[0], hp: 3 }] } };
    const next = right(weak);
    expect(next.floor.actors).toEqual([]);
    expect(next.runStats.kills).toBe(weak.runStats.kills + 1);
    expect(next.messageLog.at(-1)?.text).toBe(MESSAGES.monsterKilled(nameOf('orc')));
  });

  it('몬스터를 쓰러뜨려도 플레이어 능력치가 변하지 않는다', () => {
    const s = stateFromMap(VS_ORC, data);
    const weak = { ...s, floor: { ...s.floor, actors: [{ ...s.floor.actors[0], hp: 1 }] } };
    const next = right(weak);
    for (const stat of ['maxHp', 'attack', 'defense', 'sightRadius'] as const) {
      expect(getStat(next.player, stat, data)).toBe(getStat(s.player, stat, data));
    }
  });

  it('플레이어 HP가 0이 되면 게임 오버 상태가 되고, 쓰러뜨린 몬스터가 기록된다', () => {
    const s = stateFromMap(VS_ORC, data);
    const dying = { ...s, player: { ...s.player, hp: 1 } };
    const next = rest(dying);
    expect(next.player.hp).toBeLessThanOrEqual(0);
    expect(next.phase).toBe('gameOver');
    expect(next.runStats.killedBy).toBe('orc');
    expect(next.messageLog.map((m) => m.text)).toEqual([
      MESSAGES.monsterHit(nameOf('orc'), data.monsters.find((m) => m.id === 'orc')!.attack - data.player.defense),
      MESSAGES.playerKilled(nameOf('orc')),
    ]);
  });
});

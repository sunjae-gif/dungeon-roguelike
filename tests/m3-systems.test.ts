// M3 시스템 확장: effects.md 7절 면역, game-flow.md itemChoice·클리어
import { describe, expect, it } from 'vitest';
import { resolveAttack } from '../src/core/damage';
import { addStatus } from '../src/core/events';
import { transition } from '../src/core/flow';
import { MESSAGES } from '../src/core/messages';
import type { RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { RAW_DATA } from '../src/data/load';
import { validateGameData } from '../src/data/validate';
import { keyToCommand } from '../src/input/keys';
import { gameData, withItems } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const texts = (s: RunState) => s.messageLog.map((m) => m.text);

describe('effects.md 7절 면역', () => {
  it('immunities: ["status:weak"]인 개체에게 약화를 걸면 걸리지 않고 "통하지 않는다" 메시지가 남는다', () => {
    const d = withItems({ id: 't_pure', immunities: ['status:weak'] });
    const s = stateFromMap(`
      #####
      #@s.#
      #####`, d);
    const pure = { ...s, player: { ...s.player, buildItems: ['t_pure'] } };
    const after = playTurn(pure, { type: 'rest' }, d);
    expect(after.player.statuses).toEqual([]);
    expect(texts(after)).toContain(MESSAGES.immune(MESSAGES.playerName));
  });

  it('밀쳐내기 면역인 개체를 전투 망치로 쳐도 위치가 그대로이고 충돌 피해가 없다', () => {
    const raw = structuredClone(RAW_DATA) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    raw['monsters.json'].monsters.find((m: { id: string }) => m.id === 'goblin').immunities = ['knockback'];
    const r = validateGameData(raw);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    const d = r.data;
    const s = stateFromMap(`
      ######
      #@g..#
      ######`, d);
    const armed = { ...s, player: { ...s.player, buildItems: ['war_hammer'] } };
    const g = s.floor.actors[0];
    const after = resolveAttack(armed, d, s.player.id, g.id).state.floor.actors[0];
    expect([after.x, after.y]).toEqual([g.x, g.y]);
    expect(after.hp).toBe(g.hp - (data.player.attack - 1));
  });

  it('이미 걸린 일시 효과에 대한 면역을 나중에 얻으면 그 일시 효과는 즉시 풀린다', async () => {
    const { addBuildItem } = await import('../src/core/items');
    const d = withItems({ id: 't_pure', immunities: ['status:weak'] });
    const s = stateFromMap(`
      ###
      #@#
      ###`, d);
    const weak = { ...s, player: addStatus(s.player, 'weak', 3, s.turn) };
    expect(addBuildItem(weak, d, 't_pure').player.statuses).toEqual([]);
  });

  it('데이터 검사: 면역 값 형식과 status id', () => {
    const errorsOf = (v: unknown[]) => {
      const raw = structuredClone(RAW_DATA) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      raw['monsters.json'].monsters[0].immunities = v;
      const r = validateGameData(raw);
      return r.ok ? '' : r.errors.join();
    };
    expect(errorsOf(['knockback', 'steal', 'status:weak'])).toBe('');
    expect(errorsOf(['fire'])).toMatch(/status:\{id\}/);
    expect(errorsOf(['status:nope'])).toMatch(/statuses\.json에 없는 id "nope"/);
  });
});

describe('game-flow.md itemChoice와 클리어', () => {
  const base = stateFromMap(`
    #####
    #@..#
    #####`, data);
  const pending: RunState = { ...base, pendingChoice: { source: 'chest', options: ['spear', 'sharp_dagger', 'vampire_ring'] } };

  it('pendingChoice가 있는 턴이 끝나면 itemChoice이고, 이동 키를 눌러도 아무 일도 없다', () => {
    const choosing = playTurn(pending, { type: 'rest' }, data);
    expect(choosing.phase).toBe('itemChoice');
    expect(playTurn(choosing, { type: 'direction', direction: 'right' }, data)).toBe(choosing);
    expect(keyToCommand('itemChoice', 'ArrowRight')).toBeNull();
  });

  it('itemChoice에서 1을 누르면 첫 번째 후보가 빌드 아이템에 추가되고 phase가 playing, 턴 수는 그대로', () => {
    const choosing = playTurn(pending, { type: 'rest' }, data);
    const command = keyToCommand('itemChoice', '1');
    expect(command).toEqual({ type: 'choose', index: 0 });
    const chosen = transition(choosing, { type: 'choose', index: 0 }, data);
    expect(chosen.player.buildItems).toEqual(['spear']);
    expect(chosen.phase).toBe('playing');
    expect(chosen.turn).toBe(choosing.turn);
    expect(chosen.pendingChoice).toBeUndefined();
    expect(texts(chosen).at(-1)).toBe(MESSAGES.gotItem('창'));
    // 후보 범위 밖 숫자는 무시
    expect(transition(choosing, { type: 'choose', index: 5 }, data)).toBe(choosing);
  });

  it('bossKilled가 true인 턴이 끝나면 victory, 같은 턴에 쓰러졌으면 게임 오버가 우선', () => {
    const killed = { ...base, runStats: { ...base.runStats, bossKilled: true } };
    expect(playTurn(killed, { type: 'rest' }, data).phase).toBe('victory');
    const both = { ...killed, player: { ...killed.player, hp: 0 } };
    expect(transition(both, { type: 'turnEnd' }, data).phase).toBe('gameOver');
    // 클리어가 아이템 고르기보다 먼저
    expect(transition({ ...killed, pendingChoice: pending.pendingChoice }, { type: 'turnEnd' }, data).phase).toBe('victory');
  });
});

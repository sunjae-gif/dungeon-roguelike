// F008 최종보스 "심연의 왕"
import { describe, expect, it } from 'vitest';
import { resolveAttack } from '../src/core/damage';
import { getStat } from '../src/core/effects';
import { MESSAGES } from '../src/core/messages';
import { createRun, enterFloor } from '../src/core/run';
import type { Actor, Room, RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { gameOverLines, victoryLines } from '../src/render/view';
import type { GameData } from '../src/data/types';
import { gameData, withItems } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const bossDef = data.monsters.find((m) => m.isBoss)!;
const cfg = bossDef.boss!;
const NAME = bossDef.name;

// 보스방은 x 6~9, y 1~4. (5,2)가 입구 바깥 칸
const ARENA = `
  ###########
  #....#....#
  #.........#
  #....#.B..#
  #....#....#
  ###########`;
const ROOM: Room = { id: 50, x: 6, y: 1, w: 4, h: 4, type: 'boss', state: {} };

function arena(d: GameData, player: { x: number; y: number }, boss: Partial<Actor> = {}): RunState {
  const s = stateFromMap(ARENA.replace('#.........#', '#.@.......#'), d);
  const b = s.floor.actors[0];
  return {
    ...s,
    floorNumber: d.dungeon.maxFloor,
    player: { ...s.player, ...player },
    floor: { ...s.floor, themeId: 'theme_boss', rooms: [ROOM], actors: [{ ...b, defId: bossDef.id, hp: bossDef.maxHp, ...boss }] },
  };
}
const bossOf = (s: RunState) => s.floor.actors.find((a) => a.defId === bossDef.id)!;
const go = (s: RunState, direction: 'up' | 'down' | 'left' | 'right', d = data) => playTurn(s, { type: 'direction', direction }, d);
const rest = (s: RunState, d = data) => playTurn(s, { type: 'rest' }, d);
const newTexts = (before: RunState, after: RunState) => after.messageLog.slice(before.messageLog.length).map((m) => m.text);
// 시험용: 최대 HP를 크게 올려 오래 버틴다
const sturdy = withItems({ id: 't_tank', modifiers: [{ stat: 'maxHp', op: 'add', value: 1000 }] });
const tank = (s: RunState): RunState => ({ ...s, player: { ...s.player, buildItems: ['t_tank'], hp: 1030 } });

describe('F008 배치와 보스방', () => {
  it('1~9층에는 보스가 없다. 10층에는 정확히 1마리가 보스방 안에 있다', () => {
    for (const seed of [1, 2, 3]) {
      let s = createRun(data, seed, 'playing');
      for (let n = 1; n <= data.dungeon.maxFloor; n++) {
        if (n > 1) s = enterFloor(s, data, n);
        const bosses = s.floor.actors.filter((a) => a.defId === bossDef.id);
        if (n < data.dungeon.maxFloor) expect(bosses.length).toBe(0);
        else {
          expect(bosses.length).toBe(1);
          const room = s.floor.rooms.find((r) => r.type === 'boss')!;
          expect(bosses[0].x >= room.x && bosses[0].x < room.x + room.w && bosses[0].y >= room.y && bosses[0].y < room.y + room.h).toBe(true);
          // 보스방에는 다른 몬스터가 없다
          const others = s.floor.actors.filter((a) => a.defId !== bossDef.id && a.x >= room.x && a.x < room.x + room.w && a.y >= room.y && a.y < room.y + room.h);
          expect(others).toEqual([]);
        }
      }
    }
  });

  it('플레이어가 보스방 밖에 있는 동안 보스는 움직이지 않는다', () => {
    let s = arena(data, { x: 4, y: 2 });
    const b = bossOf(s);
    for (let i = 0; i < 5; i++) s = rest(s);
    expect([bossOf(s).x, bossOf(s).y]).toEqual([b.x, b.y]);
    expect(bossOf(s).ai?.turnsUntilCharge).toBeUndefined();
  });

  it('보스방에 처음 들어가려 하면 이동하지 않고 경고가 나오며, 턴 수가 그대로다. 다시 움직이면 들어간다', () => {
    const s = arena(data, { x: 5, y: 2 });
    const warned = go(s, 'right');
    expect([warned.player.x, warned.turn]).toEqual([5, s.turn]);
    expect(newTexts(s, warned)).toEqual([MESSAGES.bossWarning(NAME)]);
    expect(warned.floor.rooms[0].state.warned).toBe(true);
    const entered = go(warned, 'right');
    expect(entered.player.x).toBe(6);
  });

  it('보스방 안에서 턴이 끝나면 맞닿은 바깥 칸이 모두 막히고, 밖으로 나갈 수 없다', () => {
    const s = arena(data, { x: 5, y: 2 });
    const entered = go(go(s, 'right'), 'right');
    expect(entered.floor.rooms[0].state.sealed).toBe(true);
    expect(entered.messageLog.map((m) => m.text)).toContain(MESSAGES.sealed());
    const gate = entered.floor.objects.find((o) => o.x === 5 && o.y === 2);
    expect(gate?.type).toBe('sealedGate');
    expect(go(entered, 'left').player.x).toBe(6);
  });
});

describe('F008 행동 패턴', () => {
  // 들어간 뒤 보스 차례마다 무엇을 했는지 기록한다
  function actions(turns: number, d = sturdy) {
    let s = tank(arena(d, { x: 5, y: 2 }));
    s = go(go(s, 'right', d), 'right', d); // 경고 → 입장 (보스가 처음 본 차례: 추적)
    const log: string[] = [];
    for (let i = 0; i < turns; i++) {
      const before = s;
      s = rest(s, d);
      const texts = newTexts(before, s);
      log.push(texts.includes(MESSAGES.bossCharge(NAME)) ? 'charge' : texts.includes(MESSAGES.bossSlam(NAME)) ? 'slam' : 'chase');
    }
    return log;
  }

  it('처음 본 차례 다음부터 세어 3번째 차례에 힘을 모으고, 그다음 차례에 강타한다. 그 뒤로도 추적 2번 → 힘 모으기 → 강타', () => {
    expect(actions(8)).toEqual(['chase', 'chase', 'charge', 'slam', 'chase', 'chase', 'charge', 'slam']);
  });

  it('힘을 모은 칸에 서 있던 플레이어가 옆으로 한 칸 비키면 강타에 맞지 않는다', () => {
    // 보스 (7,3), 플레이어 (7,1): 위쪽 십자 범위 안. 다음 보스 차례에 힘을 모은다
    const s = tank(arena(sturdy, { x: 7, y: 1 }, { ai: { turnsUntilCharge: 1, noticed: true } }));
    const charged = rest(s, sturdy);
    expect(bossOf(charged).ai?.charging).toContainEqual({ x: 7, y: 1 });
    const dodged = go(charged, 'left', sturdy);
    expect(dodged.player.hp).toBe(charged.player.hp);
    const stayed = rest(charged, sturdy);
    expect(stayed.player.hp).toBeLessThan(charged.player.hp);
  });

  it('강타에 맞으면 피해는 일반 공격의 2배다. 그림자 망토 회피가 발동하면 맞지 않는다', () => {
    const normal = bossDef.attack - data.player.defense;
    const charging = (d: GameData) => tank(arena(d, { x: 7, y: 1 }, { ai: { turnsUntilCharge: 1, charging: [{ x: 7, y: 1 }], noticed: true } }));
    const s = charging(sturdy);
    expect(s.player.hp - rest(s, sturdy).player.hp).toBe(normal * cfg.slamDamageMul);
    const dodge = withItems(
      { id: 't_tank', modifiers: [{ stat: 'maxHp', op: 'add', value: 1000 }] },
      { id: 't_cloak', triggers: [{ event: 'onBeforeDamaged', chance: 1, message: '피함', effects: [{ type: 'cancelAttack' }] }] },
    );
    const cloaked = charging(dodge);
    const withCloak = { ...cloaked, player: { ...cloaked.player, buildItems: ['t_tank', 't_cloak'] } };
    expect(rest(withCloak, dodge).player.hp).toBe(withCloak.player.hp);
  });

  it('강타 범위는 벽에서 끊긴다', () => {
    // 보스 (7,3): 아래 (7,4)까지만 (그 아래는 벽), 왼쪽 (6,3)까지만 (5,3)은 벽
    const s = tank(arena(sturdy, { x: 9, y: 1 }, { ai: { turnsUntilCharge: 1, noticed: true } }));
    const tiles = bossOf(rest(s, sturdy)).ai!.charging!;
    expect(tiles).toContainEqual({ x: 7, y: 4 });
    expect(tiles).not.toContainEqual({ x: 7, y: 5 });
    expect(tiles).toContainEqual({ x: 6, y: 3 });
    expect(tiles).not.toContainEqual({ x: 5, y: 3 });
    // 위 (7,2)(7,1), 오른쪽 (8,3)(9,3), 아래 (7,4), 왼쪽 (6,3)
    expect(tiles.length).toBe(6);
  });

  it('HP가 절반 이하가 되면 "분노한다"가 한 번, 공격 +2, 그 뒤로는 2번째 차례마다 힘을 모은다', () => {
    let s = tank(arena(sturdy, { x: 5, y: 2 }));
    s = go(go(s, 'right', sturdy), 'right', sturdy);
    s = { ...s, floor: { ...s.floor, actors: s.floor.actors.map((a) => (a.defId === bossDef.id ? { ...a, hp: bossDef.maxHp / 2 } : a)) } };
    const log: string[] = [];
    for (let i = 0; i < 6; i++) {
      const before = s;
      s = rest(s, sturdy);
      const texts = newTexts(before, s);
      log.push(texts.includes(MESSAGES.bossCharge(NAME)) ? 'charge' : texts.includes(MESSAGES.bossSlam(NAME)) ? 'slam' : 'chase');
    }
    expect(s.messageLog.filter((m) => m.text === cfg.enrage.message).length).toBe(1);
    expect(getStat(bossOf(s), 'attack', sturdy)).toBe(bossDef.attack + 2);
    expect(log).toEqual(['chase', 'charge', 'slam', 'chase', 'charge', 'slam']);
  });

  it('전투 망치로 쳐도 보스는 밀리지 않고, 약화도 걸리지 않는다. 중독은 걸린다', () => {
    const d = withItems(
      { id: 't_weaken', triggers: [{ event: 'onHit', chance: 1, effects: [{ type: 'applyStatus', target: 'other', status: 'weak', turns: 3 }] }] },
      { id: 't_poison', triggers: [{ event: 'onHit', chance: 1, effects: [{ type: 'applyStatus', target: 'other', status: 'poison', turns: 3 }] }] },
    );
    const s = arena(d, { x: 6, y: 3 });
    const armed = { ...s, player: { ...s.player, buildItems: ['war_hammer', 't_weaken', 't_poison'] } };
    const b = bossOf(armed);
    const after = resolveAttack(armed, d, armed.player.id, b.id).state;
    expect([bossOf(after).x, bossOf(after).y]).toEqual([b.x, b.y]);
    expect(bossOf(after).statuses.map((x) => x.id)).toEqual(['poison']);
    expect(after.messageLog.map((m) => m.text)).toContain(MESSAGES.immune(NAME));
  });

  it('보스가 중독 피해로 쓰러져도 클리어가 된다', () => {
    const s = arena(data, { x: 2, y: 2 }, { hp: 1, statuses: [{ id: 'poison', turnsLeft: 2, appliedTurn: -1 }] });
    const after = rest(s);
    expect(after.floor.actors.some((a) => a.defId === bossDef.id)).toBe(false);
    expect(after.runStats.bossKilled).toBe(true);
    expect(after.phase).toBe('victory');
  });

  it('클리어 화면과 게임 오버 화면에 빌드 아이템 목록이 얻은 순서대로 나온다', () => {
    const s = arena(data, { x: 2, y: 2 });
    const built = { ...s, player: { ...s.player, buildItems: ['spear', 'owl_eye', 'sharp_dagger'] } };
    const expected = '창, 올빼미 눈, 날카로운 단검';
    expect(victoryLines(built, data)).toContain(expected);
    expect(victoryLines(built, data)[0]).toBe(MESSAGES.bossDefeated(NAME));
    expect(MESSAGES.bossDefeated(NAME)).toBe('심연의 왕을 쓰러뜨렸다!');
    expect(gameOverLines(built, data)).toContain(expected);
  });

  it('보스 행동에 무작위 요소가 없다 (같은 상태 → 같은 결과)', () => {
    const run = () => {
      let s = tank(arena(sturdy, { x: 5, y: 2 }));
      for (const step of ['right', 'right', 'down', 'right', 'up', 'right', 'down', 'left'] as const) s = go(s, step, sturdy);
      for (let i = 0; i < 6; i++) s = rest(s, sturdy);
      return s;
    };
    expect(run()).toEqual(run());
  });
});

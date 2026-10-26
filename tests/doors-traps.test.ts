// F010 문과 함정
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAttack } from '../src/core/damage';
import { DOOR_OBJECT_TYPE } from '../src/core/doors';
import { createRun, enterFloor } from '../src/core/run';
import { AROUND, inRoom, pointKey, roomEntrances } from '../src/core/rooms';
import type { MapObject, RunState } from '../src/core/state';
import { TRAP_OBJECT_TYPE } from '../src/core/traps';
import { playTurn } from '../src/core/turn';
import { KeyRepeater, blocksRepeatedStep, shouldStopRepeat } from '../src/input/repeat';
import { objectSprite } from '../src/render/view';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const go = (s: RunState, direction: 'up' | 'down' | 'left' | 'right') => playTurn(s, { type: 'direction', direction }, data);
const rest = (s: RunState) => playTurn(s, { type: 'rest' }, data);
const texts = (s: RunState) => s.messageLog.map((m) => m.text);
const setTrap = (s: RunState, defId: string): RunState => ({
  ...s,
  floor: { ...s.floor, objects: s.floor.objects.map((o) => (o.type === TRAP_OBJECT_TYPE ? { ...o, defId } : o)) },
});
const NO_TRAP_ROOMS = ['start', 'stairs', 'boss', 'secret', 'puzzle', 'spring'];

describe('F010 문', () => {
  it('닫힌 문 너머 칸은 보이지 않고, 원거리 몬스터도 닫힌 문 너머로 쏘지 않는다', () => {
    const s = rest(stateFromMap(`
      #########
      #@..+..a#
      #########`, data));
    expect(s.floor.visible[1 * 9 + 5]).toBe(false);
    expect(texts(s).some((t) => t.includes('화살'))).toBe(false);
  });

  it('닫힌 문으로 이동하면 문이 열리고, 위치는 그대로, 턴 수가 1 늘어난다', () => {
    const s = stateFromMap(`
      ######
      #@+..#
      ######`, data);
    const opened = go(s, 'right');
    expect([opened.player.x, opened.turn]).toEqual([1, s.turn + 1]);
    const door = opened.floor.objects.find((o) => o.type === DOOR_OBJECT_TYPE)!;
    expect([door.state.open, door.blocksMove, door.blocksSight]).toEqual([true, false, false]);
    expect(texts(opened)).toContain('문을 열었다.');
    expect(go(opened, 'right').player.x).toBe(2);
  });

  it('몬스터도 문을 연다 (여는 것이 그 차례의 행동)', () => {
    // 고블린은 문 너머의 플레이어를 기억하고 있다
    const s0 = stateFromMap(`
      #######
      #@..+g#
      #######`, data);
    const s = { ...s0, floor: { ...s0.floor, actors: s0.floor.actors.map((a) => ({ ...a, ai: { lastSeenPlayer: { x: 1, y: 1 } } })) } };
    const after = rest(s);
    expect(after.floor.objects.find((o) => o.type === DOOR_OBJECT_TYPE)!.state.open).toBe(true);
    expect(after.floor.actors[0].x).toBe(5);
  });
});

describe('F010 함정 배치', () => {
  it('함정은 처음부터 보이고 그림이 있다', () => {
    const s = rest(stateFromMap(`
      ######
      #@.^.#
      ######`, data));
    const trap = s.floor.objects.find((o) => o.type === TRAP_OBJECT_TYPE)!;
    expect(s.floor.visible[1 * 6 + 3]).toBe(true);
    expect(objectSprite(trap, data, s.floorNumber)).toBe('trap_spike');
  });

  it('시드 1000개로 생성했을 때 함정이 통로, 입구 주변, 금지된 방에 없고, 방 안 길을 막지 않는다', () => {
    let total = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const floorNumber = 1 + (seed % 9);
      const { floor } = enterFloor(createRun(data, seed, 'playing'), data, floorNumber);
      const traps = floor.objects.filter((o) => o.type === TRAP_OBJECT_TYPE);
      total += traps.length;
      const trapKeys = new Set(traps.map(pointKey));
      for (const t of traps) {
        const room = floor.rooms.find((r) => inRoom(r, t));
        expect(room, `seed ${seed}: 통로의 함정`).toBeDefined();
        expect(NO_TRAP_ROOMS).not.toContain(room!.type);
        const near = roomEntrances(floor, room!).flatMap((e) => [e, ...AROUND(e)]).map(pointKey);
        expect(near).not.toContain(pointKey(t));
      }
      // 모든 방: 입구끼리, 입구에서 막힌 물체 옆까지 함정을 밟지 않는 길
      for (const room of floor.rooms) {
        const entrances = roomEntrances(floor, room);
        if (entrances.length === 0) continue;
        const open = (p: { x: number; y: number }) => {
          const o = floor.objects.find((ob) => ob.x === p.x && ob.y === p.y);
          return inRoom(room, p) && floor.tiles[p.y * floor.width + p.x] === 'floor' && !trapKeys.has(pointKey(p)) && !o?.blocksMove;
        };
        const reached = new Set([pointKey(entrances[0])]);
        const queue = [entrances[0]];
        for (let h = 0; h < queue.length; h++) {
          for (const n of AROUND(queue[h])) if (!reached.has(pointKey(n)) && open(n)) { reached.add(pointKey(n)); queue.push(n); }
        }
        for (const e of entrances) expect(reached.has(pointKey(e)), `seed ${seed}`).toBe(true);
        for (const o of floor.objects.filter((ob: MapObject) => ob.blocksMove && inRoom(room, ob))) {
          expect(AROUND(o).some((n) => reached.has(pointKey(n))), `seed ${seed}: ${o.type}까지 길`).toBe(true);
        }
      }
    }
    expect(total).toBeGreaterThan(1000);
  });
});

describe('F010 함정 발동', () => {
  const CORRIDOR = `
    #######
    #@^...#
    #######`;

  it('가시 함정을 밟으면 HP −4, 다시 밟으면 또 −4', () => {
    let s = stateFromMap(CORRIDOR, data);
    const hp = s.player.hp;
    s = go(s, 'right');
    expect(s.player.hp).toBe(hp - 4);
    expect(texts(s)).toContain('가시 함정을 밟았다!');
    s = go(go(s, 'right'), 'left');
    expect(s.player.hp).toBe(hp - 8);
  });

  it('경보 함정을 밟으면 반경 12 안 몬스터가 그 칸으로 오고, 함정은 사라진다', () => {
    let s = setTrap(stateFromMap(`
      ################
      #@^......#....g#
      #........#.....#
      #..............#
      ################`, data), 'alarm');
    s = go(s, 'right');
    expect(s.floor.objects.some((o) => o.type === TRAP_OBJECT_TYPE)).toBe(false);
    expect(texts(s)).toContain('경보가 울렸다! 발소리가 다가온다.');
    const g0 = s.floor.actors[0];
    expect(g0.ai?.lastSeenPlayer).toEqual({ x: 2, y: 1 });
    const d0 = Math.abs(g0.x - 2) + Math.abs(g0.y - 1);
    // 벽을 돌아가는 경로라 처음 몇 턴은 직선거리가 줄지 않는다
    for (let i = 0; i < 8; i++) s = rest(s);
    const g = s.floor.actors[0];
    expect(Math.abs(g.x - 2) + Math.abs(g.y - 1)).toBeLessThan(d0 - 4);
  });

  it('정화의 부적이 있으면 독 가스 함정을 밟아도 중독되지 않는다', () => {
    const s = setTrap(stateFromMap(CORRIDOR, data), 'poison_gas');
    expect(go(s, 'right').player.statuses.map((x) => x.id)).toEqual(['poison']);
    const pure = { ...s, player: { ...s.player, buildItems: ['purity_charm'] } };
    expect(go(pure, 'right').player.statuses).toEqual([]);
  });

  it('함정 옆을 지나 플레이어에게 오는 몬스터는 돌아갈 길이 있으면 함정을 밟지 않는다', () => {
    let s = stateFromMap(`
      #######
      #@.^.g#
      #.....#
      #######`, data);
    const hp = s.floor.actors[0].hp;
    for (let i = 0; i < 4; i++) s = rest(s);
    expect(s.floor.actors[0].hp).toBe(hp);
    expect(texts(s).some((t) => t.includes('밟았다'))).toBe(false);
  });

  it('돌아갈 길이 없으면 함정을 지나서라도 온다', () => {
    let s = stateFromMap(`
      #######
      #@.^.g#
      #######`, data);
    const hp = s.floor.actors[0].hp;
    for (let i = 0; i < 3; i++) s = rest(s);
    expect(s.floor.actors[0].hp).toBe(hp - 4);
  });

  it('전투 망치로 몬스터를 가시 함정 위로 밀면 함정이 발동한다', () => {
    const s0 = stateFromMap(`
      ######
      #@o^.#
      ######`, data);
    const s = { ...s0, player: { ...s0.player, buildItems: ['war_hammer'] } };
    const orc = s.floor.actors[0];
    const after = resolveAttack(s, data, s.player.id, orc.id).state;
    const pushed = after.floor.actors[0];
    expect(pushed.x).toBe(3);
    expect(pushed.hp).toBe(orc.hp - (data.player.attack - 2) - 4);
  });

  it('함정으로 몬스터가 죽으면 처치 수가 늘고, 전사의 문장은 발동하지 않는다', () => {
    const s0 = stateFromMap(`
      #####
      #@g^#
      #####`, data);
    const s = {
      ...s0,
      player: { ...s0.player, hp: 10, buildItems: ['war_hammer', 'warrior_crest'] },
      floor: { ...s0.floor, actors: [{ ...s0.floor.actors[0], hp: 5 }] },
    };
    // 공격 4(=5−1)로 HP 1이 남고, 밀려서 가시 4로 죽는다
    const after = resolveAttack(s, data, s.player.id, s.floor.actors[0].id).state;
    expect(after.floor.actors).toEqual([]);
    expect(after.runStats.kills).toBe(s.runStats.kills + 1);
    expect(after.player.hp).toBe(10);
  });

  it('함정으로 플레이어가 쓰러지면 "{함정 이름}(으)로 쓰러졌다"', () => {
    const s0 = stateFromMap(CORRIDOR, data);
    const after = go({ ...s0, player: { ...s0.player, hp: 3 } }, 'right');
    expect(after.phase).toBe('gameOver');
    expect(after.runStats.killedBy).toBe('spike');
    expect(texts(after)).toContain('가시 함정(으)로 쓰러졌다.');
  });
});

describe('F010 키를 누르고 있을 때', () => {
  afterEach(() => vi.useRealTimers());

  it('키를 누르고 이동하다 다음 칸이 함정이면 그 앞에서 멈춘다. 처음 누른 입력은 밟는다', () => {
    vi.useFakeTimers();
    let s = stateFromMap(`
      #########
      #@...^..#
      #########`, data);
    const input = { type: 'direction', direction: 'right' } as const;
    const repeater = new KeyRepeater(data.ui.input.keyRepeatIntervalMs);
    repeater.press('KeyD', (repeated) => {
      if (repeated && blocksRepeatedStep(s, input)) return false;
      const prev = s;
      s = playTurn(s, input, data);
      return !shouldStopRepeat(prev, s);
    });
    vi.advanceTimersByTime(data.ui.input.keyRepeatIntervalMs * 10);
    expect(s.player.x).toBe(4);
    // 다시 누르면 밟는다
    expect(blocksRepeatedStep(s, input)).toBe(true);
    expect(playTurn(s, input, data).player.x).toBe(5);
  });

  it('문을 연 턴에는 반복을 멈추고, 닫힌 문 앞에서도 반복하지 않는다', () => {
    const s = stateFromMap(`
      ######
      #@+..#
      ######`, data);
    const opened = go(s, 'right');
    expect(shouldStopRepeat(s, opened)).toBe(true);
    expect(blocksRepeatedStep(s, { type: 'direction', direction: 'right' })).toBe(true);
  });
});

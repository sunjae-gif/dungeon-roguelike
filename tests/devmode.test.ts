// F012 개발자 모드 명령
import { describe, expect, it } from 'vitest';
import { createRun } from '../src/core/run';
import { grantItem, jumpToFloor, loadState, revealMap, startWithSeed } from '../src/dev/commands';
import { gameData } from './helpers';

const data = gameData();

describe('F012 개발자 모드', () => {
  it('층 이동으로 10층에 가면 보스방이 있는 층이 생성되고, HP·아이템은 유지된다', () => {
    const run = createRun(data, 4, 'playing');
    const hurt = { ...run, player: { ...run.player, hp: 9, consumables: ['potion_heal'] } };
    const result = jumpToFloor(hurt, data, data.dungeon.maxFloor);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.floorNumber).toBe(data.dungeon.maxFloor);
    expect(result.state.floor.rooms.some((r) => r.type === 'boss')).toBe(true);
    expect(result.state.player.hp).toBe(9);
    expect(result.state.player.consumables).toEqual(['potion_heal']);
    expect(result.state.phase).toBe('floorIntro');
    expect(jumpToFloor(hurt, data, 11).ok).toBe(false);
  });

  it('상태 내보내기 → 불러오기 후 상태가 같다', () => {
    const run = createRun(data, 77, 'playing');
    const loaded = loadState(JSON.stringify(run, null, 2));
    if (!loaded.ok) throw new Error(loaded.error);
    expect(loaded.state).toEqual(run);
    expect(loadState('{').ok).toBe(false);
    expect(loadState('{"version": 2}').ok).toBe(false);
  });

  it('아이템 생성: 소모품은 인벤토리, 없는 id는 실패', () => {
    const run = createRun(data, 1, 'playing');
    const potion = grantItem(run, data, 'potion_heal');
    expect(potion.ok && potion.state.player.consumables).toEqual(['potion_heal']);
    expect(grantItem(run, data, 'no_such_item').ok).toBe(false);
  });

  it('인벤토리가 가득 차면 소모품을 더 넣지 않는다', () => {
    const run = createRun(data, 1, 'playing');
    const full = { ...run, player: { ...run.player, consumables: new Array(data.player.inventorySize).fill('potion_heal') } };
    expect(grantItem(full, data, 'potion_heal').ok).toBe(false);
  });

  it('시드로 시작하면 그 시드의 1층, 지도 공개는 모든 칸을 탐색됨으로', () => {
    const started = startWithSeed(data, 0xabc);
    expect(started.ok && [started.state.runSeed, started.state.floorNumber]).toEqual([0xabc, 1]);
    const revealed = revealMap(createRun(data, 1, 'playing'));
    expect(revealed.ok && revealed.state.floor.explored.every(Boolean)).toBe(true);
  });
});

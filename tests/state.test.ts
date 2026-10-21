// 30-systems/game-state.md
import { describe, expect, it } from 'vitest';
import { createRun, enterFloor } from '../src/core/run';
import { cloneState } from '../src/core/state';
import { gameData } from './helpers';

describe('게임 상태', () => {
  const data = gameData();

  it('새 판은 1층, 턴 0, 플레이어 HP는 player.json의 maxHp', () => {
    const run = createRun(data, 5, 'floorIntro');
    expect(run.version).toBe(1);
    expect(run.floorNumber).toBe(1);
    expect(run.turn).toBe(0);
    expect(run.player.defId).toBe('player');
    expect(run.player.hp).toBe(data.player.maxHp);
    expect(run.nextId).toBeGreaterThan(run.player.id);
  });

  it('층 크기와 테마는 themes.json을 따른다', () => {
    for (let floor = 1; floor <= data.dungeon.maxFloor; floor++) {
      const state = enterFloor(createRun(data, 5, 'playing'), data, floor);
      const theme = data.themes.find((t) => t.floors.includes(floor))!;
      expect(state.floor.themeId).toBe(theme.id);
      expect(state.floor.tiles.length).toBe(theme.mapWidth * theme.mapHeight);
      expect(state.floor.explored.length).toBe(state.floor.tiles.length);
      expect(state.floor.visible.length).toBe(state.floor.tiles.length);
    }
  });

  it('상태는 JSON으로 저장했다 그대로 복원된다', () => {
    const run = createRun(data, 0xdeadbeef, 'playing');
    expect(cloneState(run)).toEqual(run);
    expect(JSON.parse(JSON.stringify(run))).toStrictEqual(run);
  });

  it('층을 옮겨도 플레이어 HP·아이템은 유지되고 floorsReached가 갱신된다', () => {
    const run = createRun(data, 1, 'playing');
    const hurt = { ...run, player: { ...run.player, hp: 3, consumables: ['potion_heal'] } };
    const next = enterFloor(hurt, data, 4);
    const { x, y, ...rest } = next.player;
    const { x: _x, y: _y, ...before } = hurt.player;
    expect(rest).toEqual(before);
    expect(next.floor.tiles[y * next.floor.width + x]).toBe('floor');
    expect(next.runStats.floorsReached).toBe(4);
  });
});

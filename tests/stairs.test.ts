// F013 계단과 층 이동
import { describe, expect, it } from 'vitest';
import { STAIRS_OBJECT_TYPE } from '../src/core/dungeon';
import { MESSAGES } from '../src/core/messages';
import { createRun } from '../src/core/run';
import { tileIndex, type RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { keyToCommand } from '../src/input/keys';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const descend = (s: RunState) => playTurn(s, { type: 'descend' }, data);

// 계단 칸으로 순간이동시킨 뒤 내려간다. (경로 찾기 대신 테스트용)
function goDown(s: RunState): RunState {
  const stairs = s.floor.objects.find((o) => o.type === STAIRS_OBJECT_TYPE)!;
  const onStairs = { ...s, phase: 'playing' as const, player: { ...s.player, x: stairs.x, y: stairs.y } };
  return descend(onStairs);
}

describe('F013 계단과 층 이동', () => {
  it('계단에서 >를 누르면 floorNumber가 1 늘고 지도가 바뀐다', () => {
    const run = createRun(data, 11, 'playing');
    const next = goDown(run);
    expect(next.floorNumber).toBe(2);
    expect(next.floor.tiles).not.toEqual(run.floor.tiles);
    expect(next.turn).toBe(run.turn + 1);
  });

  it('계단이 아닌 칸에서 >를 누르면 상태가 바뀌지 않는다', () => {
    const s = stateFromMap(`
      #####
      #@.>#
      #####`, data);
    expect(descend(s)).toBe(s);
  });

  it('층을 내려간 뒤 HP, 소모품, 빌드 아이템이 같다', () => {
    const run = createRun(data, 11, 'playing');
    const carried = { ...run, player: { ...run.player, hp: 7, consumables: ['potion_heal'], buildItems: ['x'] } };
    const next = goDown(carried);
    expect([next.player.hp, next.player.consumables, next.player.buildItems]).toEqual([7, ['potion_heal'], ['x']]);
  });

  it('위치는 새 층의 시작 방이고, 시작 방이 보이는 상태로 시작한다', () => {
    const next = goDown(createRun(data, 11, 'playing'));
    const start = next.floor.rooms.find((r) => r.type === 'start')!;
    const { x, y } = next.player;
    expect(x >= start.x && x < start.x + start.w && y >= start.y && y < start.y + start.h).toBe(true);
    expect(next.floor.visible[tileIndex(next.floor, x, y)]).toBe(true);
    expect(next.floor.visible.filter(Boolean).length).toBeGreaterThan(1);
  });

  it('같은 runSeed로 두 번 시작해 3층까지 내려가면 3층 지도가 같다', () => {
    // 두 번째 판은 1층에서 몇 턴 돌아다닌 뒤 내려간다
    let a = createRun(data, 2024, 'playing');
    let b = createRun(data, 2024, 'playing');
    b = playTurn(b, { type: 'rest' }, data);
    for (let i = 0; i < 2; i++) {
      a = goDown(a);
      b = goDown(b);
    }
    expect(a.floorNumber).toBe(3);
    expect(b.floor.tiles).toEqual(a.floor.tiles);
    expect(b.floor.objects.map((o) => [o.x, o.y])).toEqual(a.floor.objects.map((o) => [o.x, o.y]));
  });

  it('4층에 들어가면 theme_2 설정의 지도 크기로 만들어진다', () => {
    let s = createRun(data, 5, 'playing');
    for (let i = 0; i < 3; i++) s = goDown(s);
    const theme2 = data.themes.find((t) => t.floors.includes(4))!;
    expect(s.floorNumber).toBe(4);
    expect([s.floor.width, s.floor.height, s.floor.themeId]).toEqual([theme2.mapWidth, theme2.mapHeight, theme2.id]);
  });

  it('내려간 직후 phase가 floorIntro다', () => {
    expect(goDown(createRun(data, 3, 'playing')).phase).toBe('floorIntro');
  });

  it('마지막 층에는 계단이 없어 내려갈 수 없다', () => {
    let s = createRun(data, 9, 'playing');
    for (let i = 1; i < data.dungeon.maxFloor; i++) s = goDown(s);
    expect(s.floorNumber).toBe(data.dungeon.maxFloor);
    const playing = { ...s, phase: 'playing' as const };
    expect(descend(playing)).toBe(playing);
  });

  it('메시지: 계단에 올라서면 안내, 새 층에 들어서면 층 번호', () => {
    const s = stateFromMap(`
      #####
      #@>.#
      #####`, data);
    const onStairs = playTurn(s, { type: 'direction', direction: 'right' }, data);
    expect(onStairs.messageLog.at(-1)?.text).toBe(MESSAGES.stairsHere());
    expect(createRun(data, 1, 'playing').messageLog.at(-1)?.text).toBe(MESSAGES.enteredFloor(1));
    expect(goDown(createRun(data, 1, 'playing')).messageLog.at(-1)?.text).toBe(MESSAGES.enteredFloor(2));
  });

  it('> 또는 Enter로 내려가기', () => {
    expect(keyToCommand('playing', '>')).toEqual({ type: 'player', input: { type: 'descend' } });
    expect(keyToCommand('playing', 'Enter')).toEqual({ type: 'player', input: { type: 'descend' } });
  });
});

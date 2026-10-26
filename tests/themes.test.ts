// F011 층 테마
import { describe, expect, it } from 'vitest';
import { generateFloor } from '../src/core/dungeon';
import { MESSAGES } from '../src/core/messages';
import { createRun, enterFloor } from '../src/core/run';
import { RAW_DATA } from '../src/data/load';
import { validateGameData } from '../src/data/validate';
import { floorIntroLines, statusLines } from '../src/render/view';
import { gameData } from './helpers';

const data = gameData();
const theme = (id: string) => data.themes.find((t) => t.id === id)!;

describe('F011 층 테마', () => {
  it('1, 3층은 theme_1, 4층은 theme_2, 7층은 theme_3, 10층은 theme_boss 설정으로 생성된다', () => {
    const expected: [number, string][] = [[1, 'theme_1'], [3, 'theme_1'], [4, 'theme_2'], [7, 'theme_3'], [10, 'theme_boss']];
    for (const [floorNumber, id] of expected) {
      const { floor } = generateFloor(data, 5, floorNumber, 1);
      expect([floor.themeId, floor.width, floor.height]).toEqual([id, theme(id).mapWidth, theme(id).mapHeight]);
    }
  });

  it('1층과 4층의 floorIntro에는 진입 문구가 나오고, 2층에는 나오지 않는다', () => {
    const run = createRun(data, 1, 'floorIntro');
    const at = (n: number) => floorIntroLines(enterFloor(run, data, n), data);
    expect(at(1)).toContain(theme('theme_1').intro);
    expect(at(4)).toContain(theme('theme_2').intro);
    expect(at(2).join()).not.toContain(theme('theme_1').intro);
    expect(at(2)).toContain(theme('theme_1').name);
  });

  it('테마가 바뀌는 층에 처음 들어가면 "— {테마 이름} —"를 남긴다', () => {
    const run = createRun(data, 1, 'playing');
    const texts = (n: number) => enterFloor(run, data, n).messageLog.map((m) => m.text);
    expect(run.messageLog.map((m) => m.text)).toContain(MESSAGES.themeEntered(theme('theme_1').name));
    expect(texts(4)).toContain(MESSAGES.themeEntered(theme('theme_2').name));
    expect(texts(5).filter((t) => t.startsWith('—')).length).toBe(1); // 1층에서 남긴 것뿐
  });

  it('화면의 층 이름에 "(이름 미정)"이 나오지 않는다', () => {
    for (const t of data.themes) expect(t.name).not.toContain('이름 미정');
    for (const n of [1, 4, 7, 10]) {
      const s = enterFloor(createRun(data, 1, 'playing'), data, n);
      expect(statusLines(s, data)[0].text).not.toContain('미정');
    }
  });

  it('시드 1000개로 10층을 만들었을 때 방 개수가 3~4개이고, 보스방 한 변이 12 이상이다', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const { floor } = generateFloor(data, seed, data.dungeon.maxFloor, 1);
      expect(floor.rooms.length).toBeGreaterThanOrEqual(3);
      expect(floor.rooms.length).toBeLessThanOrEqual(4);
      const boss = floor.rooms.find((r) => r.type === 'boss')!;
      expect(Math.min(boss.w, boss.h)).toBeGreaterThanOrEqual(12);
    }
  });

  it('이미지가 없을 때 테마마다 바닥·벽 색이 팔레트대로 다르다', () => {
    const color = (id: string) => data.sprites.sprites.find((s) => s.id === id)!.fallbackColor;
    const palette: Record<string, [string, string]> = {
      theme_1: ['#2f3b2f', '#4f6b45'],
      theme_2: ['#3b2e24', '#6e4a2c'],
      theme_3: ['#2b2f36', '#5d6670'],
      theme_boss: ['#14102a', '#3a2a66'],
    };
    for (const [id, [floor, wall]] of Object.entries(palette)) {
      expect([color(theme(id).tiles.floor), color(theme(id).tiles.wall)]).toEqual([floor, wall]);
    }
    const floors = new Set(Object.values(palette).map(([f]) => f));
    expect(floors.size).toBe(4);
  });

  it('themes.json에 테마를 하나 더 추가하고 floors를 바꾸면 코드 수정 없이 반영된다', () => {
    const raw = structuredClone(RAW_DATA) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const themes = raw['themes.json'].themes;
    const t2 = themes.find((t: { id: string }) => t.id === 'theme_2');
    t2.floors = [4, 6];
    themes.push({ ...structuredClone(t2), id: 'theme_extra', name: '추가 테마', intro: '새로운 곳.', floors: [5], mapWidth: 44, mapHeight: 28 });
    const r = validateGameData(raw);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    const { floor } = generateFloor(r.data, 3, 5, 1);
    expect([floor.themeId, floor.width, floor.height]).toEqual(['theme_extra', 44, 28]);
    const s = enterFloor(createRun(r.data, 1, 'playing'), r.data, 5);
    expect(floorIntroLines(s, r.data)).toContain('새로운 곳.');
  });
});

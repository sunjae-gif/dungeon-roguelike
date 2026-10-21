// F007 화면 구성 (캔버스 없이 확인할 수 있는 부분)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STAIRS_OBJECT_TYPE } from '../src/core/dungeon';
import { updateSight } from '../src/core/movement';
import { createRun } from '../src/core/run';
import { tileIndex, type RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { cameraFor } from '../src/render/camera';
import { fontCss } from '../src/render/font';
import { computeLayout } from '../src/render/layout';
import { renderScreen } from '../src/render/screen';
import { SpriteBook, type ImageLoader } from '../src/render/sprites';
import { drawableMonsters, messageLines, statusLines, tileShade } from '../src/render/view';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const layout = computeLayout(data);
const noImages: ImageLoader = () => ({ get: () => null });

// 모든 그리기 호출을 받아 주기만 하는 가짜 캔버스
function fakeCtx(): CanvasRenderingContext2D {
  return new Proxy({}, {
    get: (target: Record<string, unknown>, key: string) => (key in target ? target[key] : () => undefined),
    set: (target: Record<string, unknown>, key: string, value) => ((target[key] = value), true),
  }) as unknown as CanvasRenderingContext2D;
}

describe('F007 배치와 카메라', () => {
  it('캔버스 크기가 1280×720이다', () => {
    expect(layout.canvas).toEqual({ width: 1280, height: 720 });
  });

  it('지도·상태창·로그가 캔버스 안에 겹치지 않게 놓인다', () => {
    const { map, status, log, canvas } = layout;
    expect(map.w).toBe(data.ui.viewportTiles.width * data.sprites.tileSize);
    expect(status.x).toBeGreaterThanOrEqual(map.x + map.w);
    expect(status.x + status.w).toBeLessThanOrEqual(canvas.width);
    expect(log.y).toBeGreaterThanOrEqual(map.y + map.h);
    expect(log.y + log.h).toBeLessThanOrEqual(canvas.height);
  });

  it('50×30 지도에서 플레이어가 (0,0) 근처면 카메라 왼쪽 위가 (0,0)', () => {
    const floor = { width: 50, height: 30 };
    expect(cameraFor(floor, { x: 2, y: 3 }, layout.viewport)).toEqual({ x: 0, y: 0 });
    // 반대쪽 끝에서도 지도 밖을 보여주지 않는다
    expect(cameraFor(floor, { x: 49, y: 29 }, layout.viewport)).toEqual({
      x: 50 - layout.viewport.width,
      y: 30 - layout.viewport.height,
    });
  });

  it('플레이어가 지도 가운데 있으면 지도 영역의 가운데 칸에 그려진다', () => {
    const player = { x: 25, y: 15 };
    const cam = cameraFor({ width: 50, height: 30 }, player, layout.viewport);
    expect(player.x - cam.x).toBe(Math.floor(layout.viewport.width / 2));
    expect(player.y - cam.y).toBe(Math.floor(layout.viewport.height / 2));
  });

  it('지도가 뷰포트보다 작은 방향은 가운데에 놓는다', () => {
    const cam = cameraFor({ width: 11, height: 30 }, { x: 5, y: 0 }, layout.viewport);
    expect(cam.x).toBe(-Math.floor((layout.viewport.width - 11) / 2));
    expect(cam.y).toBe(0);
  });
});

describe('F007 칸 표시', () => {
  const s = updateSight(stateFromMap(`
    ###############
    #@.....#.....r#
    ###############`, data), data.player.sightRadius);

  it('한 번도 안 본 칸은 unexplored(검정), 탐색됨 칸은 보이는 칸보다 어둡다', () => {
    expect(tileShade(s.floor, 1, 1)).toBe('visible');
    expect(tileShade(s.floor, 10, 1)).toBe('unexplored');
    const explored = { ...s, floor: { ...s.floor, visible: s.floor.visible.map(() => false) } };
    expect(tileShade(explored.floor, 1, 1)).toBe('explored');
    expect(data.ui.fov.exploredBrightness).toBeLessThan(1);
    expect(data.ui.fov.unexploredColor).toBe('#000000');
  });

  it('탐색됨 칸에 있는 몬스터는 그려지지 않는다', () => {
    const i = tileIndex(s.floor, 13, 1);
    const explored = { ...s, floor: { ...s.floor, explored: s.floor.explored.map((e, j) => e || j === i) } };
    expect(drawableMonsters(explored)).toEqual([]);
    const visible = { ...s, floor: { ...s.floor, visible: s.floor.visible.map((v, j) => v || j === i) } };
    expect(drawableMonsters(visible).map((m) => m.defId)).toEqual(['rat']);
  });
});

describe('F007 그림과 글꼴', () => {
  afterEach(() => vi.restoreAllMocks());

  it('이미지가 없으면 fallbackColor로 그린다', () => {
    const book = new SpriteBook(data.sprites, data.ui.colors.missingSprite, noImages);
    const def = data.sprites.sprites.find((sp) => sp.id === 'player')!;
    expect(book.get('player', 'up')).toEqual({ image: null, color: def.fallbackColor });
  });

  it('방향 이미지가 없으면 기본 이미지를 쓰고, 있으면 방향 이미지를 쓴다', () => {
    const fake = { tag: 'img' } as unknown as CanvasImageSource;
    const onlyBase: ImageLoader = (path) => ({ get: () => (path === 'assets/chars/player.png' ? fake : null) });
    expect(new SpriteBook(data.sprites, '', onlyBase).get('player', 'left').image).toBe(fake);
    const dirImg = { tag: 'left' } as unknown as CanvasImageSource;
    const withDir: ImageLoader = (path) => ({ get: () => (path.endsWith('_left.png') ? dirImg : fake) });
    expect(new SpriteBook(data.sprites, '', withDir).get('player', 'left').image).toBe(dirImg);
  });

  it('sprites.json에 없는 id는 콘솔 경고(한 번) 후 색 사각형', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const book = new SpriteBook(data.sprites, data.ui.colors.missingSprite, noImages);
    expect(book.get('no_such_sprite')).toEqual({ image: null, color: data.ui.colors.missingSprite });
    book.get('no_such_sprite');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('글꼴이 없으면 대체 글꼴로 그리도록 font 문자열에 fallback이 있다', () => {
    expect(fontCss(data.ui)).toBe(`${data.ui.font.size}px "${data.ui.font.family}", ${data.ui.font.fallback}`);
  });

  it('이미지 파일이 하나도 없어도 1층부터 마지막 층까지 화면이 그려진다', () => {
    const rc = { ctx: fakeCtx(), data, layout, sprites: new SpriteBook(data.sprites, '', noImages), extraStatus: [] };
    let s: RunState = createRun(data, 77, 'playing');
    for (let floor = 1; floor < data.dungeon.maxFloor; floor++) {
      renderScreen(rc, s);
      const stairs = s.floor.objects.find((o) => o.type === STAIRS_OBJECT_TYPE)!;
      s = playTurn({ ...s, player: { ...s.player, x: stairs.x, y: stairs.y } }, { type: 'descend' }, data);
      renderScreen(rc, s); // floorIntro
      s = { ...s, phase: 'playing' };
    }
    expect(() => renderScreen(rc, s)).not.toThrow();
    for (const phase of ['title', 'gameOver', 'victory'] as const) renderScreen(rc, { ...s, phase });
  });
});

describe('F007 상태창과 메시지 로그', () => {
  it('HP가 바뀌면 같은 턴의 상태창 내용이 바뀌고, 낮으면 hpLow 색', () => {
    const s = createRun(data, 1, 'playing');
    const hpLine = (st: RunState) => statusLines(st, data)[1];
    expect(hpLine(s)).toEqual({ text: `HP ${data.player.maxHp}/${data.player.maxHp}`, color: data.ui.colors.hpNormal });
    const low = Math.floor(data.player.maxHp * data.ui.lowHpRatio);
    expect(hpLine({ ...s, player: { ...s.player, hp: low } })).toEqual({
      text: `HP ${low}/${data.player.maxHp}`,
      color: data.ui.colors.hpLow,
    });
  });

  it('상태창: 층·테마 이름, 공격, 방어, 번호 붙은 소모품, 빌드 아이템', () => {
    const s = createRun(data, 1, 'playing');
    const texts = statusLines({ ...s, player: { ...s.player, consumables: ['potion_heal'] } }, data).map((l) => l.text);
    const theme = data.themes.find((t) => t.floors.includes(1))!;
    expect(texts[0]).toContain(theme.name);
    expect(texts).toContain(`공격 ${data.player.attack}`);
    expect(texts).toContain(`방어 ${data.player.defense}`);
    expect(texts).toContain('1. 회복 물약');
    expect(texts).toContain('빌드 아이템');
  });

  it('메시지가 6개 이상이면 가장 오래된 것부터 안 보이고, 새 것이 맨 위', () => {
    const s = createRun(data, 1, 'playing');
    const log = Array.from({ length: 6 }, (_, i) => ({ turn: i, text: `m${i}` }));
    expect(messageLines({ ...s, messageLog: log }, data)).toEqual(['m5', 'm4', 'm3', 'm2', 'm1']);
  });

  it('화면 코드(render/)에 색 값이 직접 쓰여 있지 않다', () => {
    const dir = join(__dirname, '../src/render');
    for (const name of readdirSync(dir)) {
      const source = readFileSync(join(dir, name), 'utf8');
      expect(source, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    }
  });
});

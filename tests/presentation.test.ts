// F016 화면 연출과 다듬기
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../src/core/state';
import { playTurn } from '../src/core/turn';
import { Animator, deriveAnims } from '../src/render/anim';
import { IllustrationLayer, illustrationBox } from '../src/render/illustration';
import { computeLayout } from '../src/render/layout';
import { renderScreen } from '../src/render/screen';
import { SpriteBook } from '../src/render/sprites';
import { illustrationFor, statusLines, titleLines } from '../src/render/view';
import { createRun, enterFloor } from '../src/core/run';
import { computeScale } from '../src/render/scale';
import { stateFromMap } from './parseMap';
import { gameData } from './helpers';

const data = gameData();
const base = data.ui.baseResolution;

describe('F016 창 맞춤 확대', () => {
  it('1920×1080 창에서 비율을 유지한 채 창을 채운다', () => {
    const scale = computeScale({ width: 1920, height: 1080 }, base, data.ui.scaling.preferInteger);
    expect(scale).toBe(1.5);
    expect([base.width * scale, base.height * scale]).toEqual([1920, 1080]);
  });

  it('2560×1440 창에서는 정확히 2배, 더 큰 창도 정수 배를 담을 수 있으면 정수 배', () => {
    expect(computeScale({ width: 2560, height: 1440 }, base, true)).toBe(2);
    expect(computeScale({ width: 3000, height: 1700 }, base, true)).toBe(2);
    expect(computeScale({ width: 3840, height: 2160 }, base, true)).toBe(3);
  });

  it('창이 기준보다 작으면 줄이고, 비율은 짧은 쪽에 맞춘다', () => {
    expect(computeScale({ width: 1000, height: 1000 }, base, true)).toBeCloseTo(1000 / 1280);
    expect(computeScale({ width: 2000, height: 720 }, base, true)).toBe(1);
  });

  it('게임 화면 캔버스는 확대해도 픽셀이 흐려지지 않게(pixelated), 일러스트 층은 매끄럽게', () => {
    const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/canvas\.pixel \{ image-rendering: pixelated; \}/);
    expect(html).toMatch(/canvas\.smooth \{ image-rendering: auto;/);
  });
});

describe('F016 원칙', () => {
  it('core/에 연출 관련 코드가 없다', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else files.push(path);
      }
    };
    walk(join(__dirname, '../src/core'));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\banim\b|requestAnimationFrame|performance\.now/);
  });
});

describe('F016 움직임 연출', () => {
  const anim = data.ui.anim;
  const go = (st: RunState, direction: 'up' | 'down' | 'left' | 'right') => playTurn(st, { type: 'direction', direction }, data);
  const kinds = (prev: RunState, next: RunState) => deriveAnims(prev, next, anim, 0).map((a) => a.kind).sort();

  it('가장 긴 이동 연출도 키 반복 간격보다 짧다 (키를 누르고 있을 때 느려지지 않는다)', () => {
    expect(anim.moveMs).toBeLessThan(data.ui.input.keyRepeatIntervalMs);
    expect(anim.attackBumpMs).toBeLessThanOrEqual(data.ui.input.keyRepeatIntervalMs);
  });

  it('이동하면 이전 칸에서 미끄러지고, 끝나면 제자리', () => {
    const s = stateFromMap(`
      #####
      #@..#
      #####`, data);
    const moved = go(s, 'right');
    const animator = new Animator();
    animator.begin(s, moved, anim, 1000);
    expect(animator.frame(1000).offset(moved.player)).toEqual({ x: -1, y: 0 });
    expect(animator.frame(1000 + anim.moveMs / 2).offset(moved.player).x).toBeCloseTo(-0.5);
    expect(animator.frame(1000 + anim.moveMs).offset(moved.player)).toEqual({ x: 0, y: 0 });
    expect(animator.active(1000 + anim.moveMs)).toBe(false);
  });

  it('근접 공격: 공격자가 내밀고, 맞은 쪽은 깜빡이고 피해 숫자가 뜬다', () => {
    const s = stateFromMap(`
      #####
      #@o.#
      #####`, data);
    const hit = go(s, 'right');
    const list = deriveAnims(s, hit, anim, 0);
    expect(list.some((a) => a.kind === 'bump' && a.actorId === s.player.id)).toBe(true);
    expect(list.some((a) => a.kind === 'flash' && a.actorId === s.floor.actors[0].id)).toBe(true);
    const orc = s.floor.actors[0];
    const number = list.find((a) => a.kind === 'number' && !a.heal && a.at.x === orc.x && a.at.y === orc.y);
    expect(number && number.kind === 'number' && number.value).toBe(data.player.attack - 2);
  });

  it('원거리 공격은 날아가는 점, 회복은 초록 숫자', () => {
    const s = stateFromMap(`
      ########
      #@..a..#
      ########`, data);
    expect(kinds(s, playTurn(s, { type: 'rest' }, data))).toContain('projectile');
    const hurt = { ...s, player: { ...s.player, hp: 10, consumables: ['potion_heal'] } };
    const drank = playTurn(hurt, { type: 'useItem', index: 0 }, data);
    expect(deriveAnims(hurt, drank, anim, 0).some((a) => a.kind === 'number' && a.heal)).toBe(true);
  });

  it('함정 칸에 들어가면 함정이 번쩍인다', () => {
    const s = stateFromMap(`
      #####
      #@^.#
      #####`, data);
    expect(kinds(s, go(s, 'right'))).toContain('trapFlash');
  });

  it('연출 도중 새 입력이 오면 이전 연출은 바로 끝 상태가 된다', () => {
    const s = stateFromMap(`
      ######
      #@...#
      ######`, data);
    const one = go(s, 'right');
    const two = go(one, 'right');
    const animator = new Animator();
    animator.begin(s, one, anim, 0);
    animator.begin(one, two, anim, 10);
    // 두 번째 이동만 남는다: 한 칸 뒤(2,1)에서 지금 칸(3,1)으로
    expect(animator.frame(10).offset(two.player)).toEqual({ x: -1, y: 0 });
  });

  it('ui.json에서 모든 연출 시간을 0으로 하면 연출이 없다', () => {
    const zero = Object.fromEntries(Object.keys(anim).map((k) => [k, 0])) as typeof anim;
    const s = stateFromMap(`
      #####
      #@o^#
      #####`, data);
    expect(deriveAnims(s, go(s, 'right'), zero, 0)).toEqual([]);
    const animator = new Animator();
    animator.begin(s, go(s, 'right'), zero, 0);
    expect(animator.active(0)).toBe(false);
  });

  it('층이 바뀌거나 playing이 아니던 상태에서는 연출하지 않는다', () => {
    const s = stateFromMap(`
      #####
      #@..#
      #####`, data);
    expect(deriveAnims({ ...s, phase: 'itemChoice' }, go(s, 'right'), anim, 0)).toEqual([]);
    expect(deriveAnims(s, { ...go(s, 'right'), floorNumber: s.floorNumber + 1 }, anim, 0)).toEqual([]);
  });
});

describe('F016 타이틀, 일러스트, 아이콘', () => {
  const layout = computeLayout(data);
  const fakeCtx = () =>
    new Proxy({}, {
      get: (t: Record<string, unknown>, k: string) => (k in t ? t[k] : () => undefined),
      set: (t: Record<string, unknown>, k: string, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
  const run = createRun(data, 3, 'playing');
  const bossFloor = { ...enterFloor(run, data, data.dungeon.maxFloor), phase: 'floorIntro' as const };
  const screens = [
    { ...run, phase: 'title' as const },
    bossFloor,
    { ...run, phase: 'gameOver' as const },
    { ...run, phase: 'victory' as const },
  ];

  it('일러스트는 네 화면에서만: 타이틀·10층 진입·게임 오버·클리어', () => {
    expect(screens.map((st) => illustrationFor(st, data))).toEqual([
      'player_portrait', 'final_boss_portrait', 'player_portrait_defeat', 'player_portrait_victory',
    ]);
    expect(illustrationFor({ ...run, phase: 'floorIntro' }, data)).toBeNull();
    expect(illustrationFor(run, data)).toBeNull();
    for (const id of ['player_portrait', 'final_boss_portrait', 'player_portrait_defeat', 'player_portrait_victory']) {
      expect(data.sprites.illustrations.some((i) => i.id === id), id).toBe(true);
    }
  });

  it('일러스트 자리: 타이틀은 오른쪽, 결과 화면은 왼쪽, 보스 진입은 가운데. 비율 2:3', () => {
    const [title, intro, over] = screens.map((st) => illustrationBox(st, data, layout));
    const mid = layout.canvas.width / 2;
    expect(title.x).toBeGreaterThanOrEqual(mid);
    expect(over.x + over.w).toBeLessThanOrEqual(mid);
    expect(intro.x + intro.w / 2).toBeCloseTo(mid);
    expect(title.w / title.h).toBeCloseTo(2 / 3);
  });

  it('일러스트 파일이 없어도 네 화면이 깨지지 않는다', () => {
    const none = () => ({ get: () => null });
    const layer = new IllustrationLayer(data, none);
    const rc = { ctx: fakeCtx(), data, layout, sprites: new SpriteBook(data.sprites, '', none), extraStatus: [] };
    for (const st of screens) {
      expect(() => layer.draw(fakeCtx(), st, layout)).not.toThrow();
      expect(() => renderScreen(rc, st)).not.toThrow();
    }
  });

  it('타이틀 화면에 게임 제목, 새 게임 안내, 버전이 나온다', () => {
    const lines = titleLines(data);
    expect(lines[0]).toBe('무너진 왕국의 지하');
    expect(lines).toContain('Enter: 새 게임');
    expect(lines).toContain(`v${data.ui.title.version}`);
  });

  it('상태창: 빌드 아이템과 일시 효과 앞에 아이콘', () => {
    const st = { ...run, player: { ...run.player, buildItems: ['spear'], statuses: [{ id: 'weak', turnsLeft: 2, appliedTurn: 0 }] } };
    const lines = statusLines(st, data);
    expect(lines.find((l) => l.text === '창')?.icon).toBe('spear');
    expect(lines.find((l) => l.text.startsWith('약화'))?.icon).toBe('status_weak');
  });
});

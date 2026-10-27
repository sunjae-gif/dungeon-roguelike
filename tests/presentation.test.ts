// F016 화면 연출과 다듬기
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeScale } from '../src/render/scale';
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

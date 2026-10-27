// 30-systems/rng.md
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createRng, floorRng, formatSeed, hashSeed, initRunRng, nextFloat, nextInt, nextU32, parseSeed, useStoredRng,
} from '../src/core/rng';
import { createRun } from '../src/core/run';
import { gameData } from './helpers';

const take = (seed: number, n: number) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => nextU32(rng));
};

describe('난수', () => {
  it('같은 시작값이면 같은 수열', () => {
    expect(take(12345, 20)).toEqual(take(12345, 20));
    expect(take(12345, 20)).not.toEqual(take(12346, 20));
  });

  it('nextFloat는 [0,1), nextInt는 [min,max] 안', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10000; i++) {
      const f = nextFloat(rng);
      expect(f >= 0 && f < 1).toBe(true);
      const n = nextInt(rng, 3, 6);
      expect(n >= 3 && n <= 6 && Number.isInteger(n)).toBe(true);
    }
  });

  it('흐름의 시작값은 판 시드·층·흐름 이름마다 다르고, 같으면 같다', () => {
    expect(hashSeed(1, 1, 'map')).toBe(hashSeed(1, 1, 'map'));
    const values = new Set([
      hashSeed(1, 1, 'map'), hashSeed(2, 1, 'map'), hashSeed(1, 2, 'map'), hashSeed(1, 1, 'spawn'),
    ]);
    expect(values.size).toBe(4);
  });

  it('한 흐름의 호출 횟수를 바꿔도 다른 흐름의 결과는 같다', () => {
    const run = (objectsCalls: number) => {
      const objects = floorRng(99, 3, 'objects');
      for (let i = 0; i < objectsCalls; i++) nextU32(objects);
      const map = floorRng(99, 3, 'map');
      const spawn = floorRng(99, 3, 'spawn');
      return [nextU32(map), nextU32(map), nextU32(spawn)];
    };
    expect(run(0)).toEqual(run(500));
  });

  it('판 전체 흐름은 RunState.rng에 이어서 저장된다', () => {
    const start = initRunRng(42);
    const a = useStoredRng(start, 'combat', (rng) => nextU32(rng));
    const b = useStoredRng(a.rng, 'combat', (rng) => nextU32(rng));
    expect(a.value).not.toBe(b.value);
    expect(a.rng.ai).toBe(start.ai);
    // JSON으로 저장했다 복원해도 이어지는 값이 같다
    const restored = JSON.parse(JSON.stringify(a.rng));
    expect(useStoredRng(restored, 'combat', (rng) => nextU32(rng)).value).toBe(b.value);
  });

  it('시드는 8자리 16진수 대문자로 보여준다', () => {
    expect(formatSeed(0x3fa2c910)).toBe('3FA2C910');
    expect(formatSeed(255)).toBe('000000FF');
    expect(parseSeed('3fa2c910')).toBe(0x3fa2c910);
    expect(parseSeed('xyz')).toBeNull();
    expect(parseSeed('123456789')).toBeNull();
  });

  it('같은 runSeed로 만든 판은 같다', () => {
    const data = gameData();
    expect(createRun(data, 777, 'floorIntro')).toEqual(createRun(data, 777, 'floorIntro'));
  });

  it('규칙 코드(src/core/)에 Math.random, Date.now, crypto가 없다', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith('.ts')) files.push(path);
      }
    };
    walk(join(__dirname, '../src/core'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/Math\.random|Date\.now|crypto/);
    }
  });
});

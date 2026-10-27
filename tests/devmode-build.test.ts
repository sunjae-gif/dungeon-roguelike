// F012, F017: 배포 빌드에는 개발자 모드와 밸런스 시뮬레이터 코드가 포함되지 않는다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const outDir = mkdtempSync(join(tmpdir(), 'dungeon-build-'));

function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? allFiles(path) : [path];
  });
}

describe('F012 개발자 모드', () => {
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it('배포 빌드 결과물에 개발자 모드 문자열이 없다', () => {
    // vitest는 NODE_ENV=test라서, npm run build와 같은 조건이 되도록 따로 실행한다
    const env = { ...process.env };
    delete env.NODE_ENV;
    const vite = join(root, 'node_modules/vite/bin/vite.js');
    execFileSync(process.execPath, [vite, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'silent'], {
      cwd: root,
      env,
    });

    const files = allFiles(outDir).filter((f) => /\.(js|html|css)$/.test(f));
    const output = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(output.includes('타이틀')).toBe(true);
    for (const marker of ['개발자 모드', 'installDevMode', 'dev-panel', '상태 내보내기']) {
      expect(output.includes(marker), `빌드에 "${marker}"가 들어 있음`).toBe(false);
    }
    // F017: 보고서 문구, 목표치 파일
    for (const marker of ['밸런스 시뮬레이션 보고서', '사망 원인 순위', '봇 기준 목표치', 'maxTurnsPerRun']) {
      expect(output.includes(marker), `빌드에 "${marker}"가 들어 있음`).toBe(false);
    }
  }, 60_000);
});

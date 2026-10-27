// F017: npm run sim. 브라우저 없이 src/sim/cli.ts를 vite의 모듈 실행기로 바로 돌린다 (따로 설치할 것 없음)
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { module } = await runnerImport('/src/sim/cli.ts', { root, configFile: false, logLevel: 'silent' });
process.exitCode = module.main(process.argv.slice(2));

// F017 실행: npm run sim -- --runs 500 --seed-start 1 [--out sim-results]
// 결과 JSON에는 시간처럼 매번 바뀌는 값을 넣지 않는다 (같은 시드면 같은 JSON)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import rawTargets from '../../20-data/balance-targets.json';
import { loadGameData } from '../data/load';
import { checkTargets, summarize, toMarkdown } from './report';
import { simulate } from './simulate';

interface Options {
  runs: number;
  seedStart: number;
  out: string;
}

const DEFAULTS: Options = { runs: 500, seedStart: 1, out: 'sim-results' };
const FLAGS: Record<string, keyof Options> = { '--runs': 'runs', '--seed-start': 'seedStart', '--out': 'out' };

function parseArgs(argv: string[]): Options | string {
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 2) {
    const key = FLAGS[argv[i]];
    const value = argv[i + 1];
    if (!key || value === undefined) return `알 수 없는 인자: ${argv[i]}`;
    if (key === 'out') options.out = value;
    else {
      const n = Number(value);
      if (!Number.isInteger(n) || n < (key === 'runs' ? 1 : 0)) return `${argv[i]}에는 정수를 써야 한다: ${value}`;
      options[key] = n;
    }
  }
  return options;
}

const two = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;

export function main(argv: string[]): number {
  const options = parseArgs(argv);
  if (typeof options === 'string') {
    console.error(options);
    return 1;
  }
  const loaded = loadGameData();
  const checked = checkTargets(rawTargets);
  if (!loaded.ok || !checked.ok) {
    console.error([...(loaded.ok ? [] : loaded.errors), ...(checked.ok ? [] : checked.errors)].join('\n'));
    return 1;
  }
  const { targets } = checked;
  const started = Date.now();
  const results = simulate(loaded.data, options.seedStart, options.runs, targets.maxTurnsPerRun);
  const summary = summarize(results, options.seedStart, targets, loaded.data);
  const markdown = toMarkdown(summary, targets);

  mkdirSync(options.out, { recursive: true });
  const base = join(options.out, stamp(new Date()));
  writeFileSync(`${base}.json`, `${JSON.stringify({ summary, runs: results }, null, 2)}\n`);
  writeFileSync(`${base}.md`, markdown);
  console.log(markdown);
  console.log(`${options.runs}판, ${((Date.now() - started) / 1000).toFixed(1)}초. 저장: ${base}.json, ${base}.md`);
  return 0;
}

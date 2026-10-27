// F017 보고서: 판 기록을 모아 표로 만들고, 목표(balance-targets.json)를 벗어난 항목에 ⚠️를 붙인다
import { causeName } from '../core/actors';
import { Checker, type Obj } from '../data/check';
import { itemName } from '../data/query';
import type { GameData } from '../data/types';
import type { RunResult } from './simulate';

export type Range = [number, number];

export interface BalanceTargets {
  botClearRate: Range;
  medianTurnsCleared: Range;
  maxShareOfDeathsOnOneFloor: number;
  bossWinRateWhenReached: Range;
  itemClearRateGapWarn: number;
  maxTurnsPerRun: number;
}

export function checkTargets(raw: unknown): { ok: true; targets: BalanceTargets } | { ok: false; errors: string[] } {
  const c = new Checker();
  const path = 'balance-targets.json';
  if (c.obj(raw, path)) {
    const o = raw as Obj;
    for (const key of ['botClearRate', 'medianTurnsCleared', 'bossWinRateWhenReached']) {
      const range = c.arr(o, key, path);
      if (range && (range.length !== 2 || range.some((v) => typeof v !== 'number') || (range[0] as number) > (range[1] as number))) {
        c.fail(`${path}.${key}`, '[최소, 최대] 숫자 두 개여야 함');
      }
    }
    c.num(o, 'maxShareOfDeathsOnOneFloor', path, { min: 0, max: 1 });
    c.num(o, 'itemClearRateGapWarn', path, { min: 0, max: 1 });
    c.num(o, 'maxTurnsPerRun', path, { integer: true, min: 1 });
  }
  return c.errors.length > 0 ? { ok: false, errors: c.errors } : { ok: true, targets: raw as BalanceTargets };
}

interface TurnStats {
  mean: number;
  median: number;
  top10: number; // 상위 10%가 시작되는 턴 수 (90번째 백분위)
}

export interface Summary {
  runs: number;
  seedStart: number;
  clears: number;
  clearRate: number;
  deathsByFloor: Record<string, number>;
  deathCauses: { cause: string; name: string; count: number }[];
  turnsAll: TurnStats | null;
  turnsCleared: TurnStats | null;
  hpOnEntryByFloor: Record<string, number>;
  items: { id: string; name: string; runs: number; clearRate: number; gap: number }[];
  boss: { reached: number; won: number; winRate: number | null; meanTurns: number | null };
  timeouts: { count: number; seeds: number[] };
  warnings: string[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// 정렬한 값에서 p 백분위 (가장 가까운 순위)
function percentile(sorted: number[], p: number): number {
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

function turnStats(turns: number[]): TurnStats | null {
  if (turns.length === 0) return null;
  const sorted = [...turns].sort((a, b) => a - b);
  return { mean: mean(sorted), median: percentile(sorted, 0.5), top10: percentile(sorted, 0.9) };
}

const outside = (v: number, [lo, hi]: Range) => v < lo || v > hi;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const UNKNOWN_CAUSE = '(알 수 없음)';

export function summarize(results: RunResult[], seedStart: number, targets: BalanceTargets, data: GameData): Summary {
  const warnings: string[] = [];
  const clears = results.filter((r) => r.outcome === 'clear');
  const deaths = results.filter((r) => r.outcome === 'death');
  const clearRate = results.length ? clears.length / results.length : 0;
  if (outside(clearRate, targets.botClearRate)) warnings.push('clearRate');

  const deathsByFloor: Record<string, number> = {};
  for (const r of deaths) deathsByFloor[r.floorReached] = (deathsByFloor[r.floorReached] ?? 0) + 1;
  for (const [floor, count] of Object.entries(deathsByFloor)) {
    if (count / deaths.length > targets.maxShareOfDeathsOnOneFloor) warnings.push(`deathFloor:${floor}`);
  }

  const causeCounts = new Map<string, number>();
  for (const r of deaths) causeCounts.set(r.killedBy ?? UNKNOWN_CAUSE, (causeCounts.get(r.killedBy ?? UNKNOWN_CAUSE) ?? 0) + 1);
  const deathCauses = [...causeCounts]
    .map(([cause, count]) => ({ cause, name: cause === UNKNOWN_CAUSE ? cause : causeName(data, cause), count }))
    .sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause));

  const turnsCleared = turnStats(clears.map((r) => r.turns));
  if (!turnsCleared || outside(turnsCleared.median, targets.medianTurnsCleared)) warnings.push('medianTurnsCleared');

  const hpOnEntryByFloor: Record<string, number> = {};
  for (let floor = 1; floor <= data.dungeon.maxFloor; floor++) {
    const ratios = results.flatMap((r) => (r.hpOnEntry.length >= floor ? [r.hpOnEntry[floor - 1]] : []));
    if (ratios.length) hpOnEntryByFloor[floor] = mean(ratios);
  }

  const items = data.items
    .filter((it) => it.kind === 'build')
    .map((it) => {
      const holders = results.filter((r) => r.buildItems.includes(it.id));
      const rate = holders.length ? holders.filter((r) => r.outcome === 'clear').length / holders.length : 0;
      return { id: it.id, name: itemName(data, it.id), runs: holders.length, clearRate: rate, gap: holders.length ? rate - clearRate : 0 };
    });
  for (const it of items) if (it.runs > 0 && Math.abs(it.gap) > targets.itemClearRateGapWarn) warnings.push(`item:${it.id}`);

  const fights = results.filter((r) => r.bossFightTurns !== undefined);
  const won = fights.filter((r) => r.outcome === 'clear').length;
  const boss = {
    reached: fights.length,
    won,
    winRate: fights.length ? won / fights.length : null,
    meanTurns: fights.length ? mean(fights.map((r) => r.bossFightTurns!)) : null,
  };
  if (boss.winRate === null || outside(boss.winRate, targets.bossWinRateWhenReached)) warnings.push('bossWinRate');

  const timeoutSeeds = results.filter((r) => r.outcome === 'timeout').map((r) => r.seed);
  if (timeoutSeeds.length) warnings.push('timeouts');

  return {
    runs: results.length,
    seedStart,
    clears: clears.length,
    clearRate,
    deathsByFloor,
    deathCauses,
    turnsAll: turnStats(results.map((r) => r.turns)),
    turnsCleared,
    hpOnEntryByFloor,
    items,
    boss,
    timeouts: { count: timeoutSeeds.length, seeds: timeoutSeeds },
    warnings,
  };
}

// 사람이 읽는 요약
export function toMarkdown(s: Summary, t: BalanceTargets): string {
  const warn = (id: string) => (s.warnings.includes(id) ? ' ⚠️' : '');
  const range = ([lo, hi]: Range, f: (v: number) => string) => `${f(lo)}~${f(hi)}`;
  const turns = (x: TurnStats | null) => (x ? `${x.mean.toFixed(0)} | ${x.median} | ${x.top10}` : '- | - | -');
  const lines = [
    '# 밸런스 시뮬레이션 보고서 (F017)',
    '',
    `판 수 ${s.runs} (시드 ${s.seedStart}~${s.seedStart + s.runs - 1}), 한 판 최대 ${t.maxTurnsPerRun}턴`,
    '',
    '## 클리어율',
    `${pct(s.clearRate)} (${s.clears}/${s.runs}). 목표 ${range(t.botClearRate, pct)}${warn('clearRate')}`,
    '',
    '## 사망 층 분포',
    `한 층에 사망이 ${pct(t.maxShareOfDeathsOnOneFloor)}를 넘게 몰리면 ⚠️`,
    '',
    '| 층 | 사망 | 비율 |',
    '|---|---|---|',
    ...Object.entries(s.deathsByFloor).map(([floor, n]) => {
      const total = Object.values(s.deathsByFloor).reduce((a, b) => a + b, 0);
      return `| ${floor} | ${n} | ${pct(n / total)}${warn(`deathFloor:${floor}`)} |`;
    }),
    '',
    '## 사망 원인 순위',
    '| 원인 | 횟수 |',
    '|---|---|',
    ...s.deathCauses.map((c) => `| ${c.name === c.cause ? c.name : `${c.name} (${c.cause})`} | ${c.count} |`),
    '',
    '## 한 판 턴 수',
    '| | 평균 | 중앙값 | 상위 10% |',
    '|---|---|---|---|',
    `| 전체 | ${turns(s.turnsAll)} |`,
    `| 클리어한 판 | ${turns(s.turnsCleared)} |`,
    '',
    `클리어한 판의 중앙값 목표 ${range(t.medianTurnsCleared, String)}${warn('medianTurnsCleared')}`,
    '',
    '## 층별 남은 HP (층에 들어설 때 HP 비율 평균)',
    '| 층 | HP |',
    '|---|---|',
    ...Object.entries(s.hpOnEntryByFloor).map(([floor, v]) => `| ${floor} | ${pct(v)} |`),
    '',
    '## 빌드 아이템',
    `가진 판의 클리어율 - 전체 클리어율. ±${pct(t.itemClearRateGapWarn)}를 넘으면 ⚠️`,
    '',
    '| 아이템 | 가진 판 | 클리어율 | 차이 |',
    '|---|---|---|---|',
    ...s.items.map((it) =>
      it.runs ? `| ${it.name} | ${it.runs} | ${pct(it.clearRate)} | ${it.gap >= 0 ? '+' : ''}${pct(it.gap)}${warn(`item:${it.id}`)} |` : `| ${it.name} | 0 | - | - |`,
    ),
    '',
    '## 보스전',
    `보스방에 들어간 판 ${s.boss.reached}, 이긴 판 ${s.boss.won}`,
    `이긴 비율 ${s.boss.winRate === null ? '-' : pct(s.boss.winRate)}. 목표 ${range(t.bossWinRateWhenReached, pct)}${warn('bossWinRate')}`,
    `보스전 평균 턴 수 ${s.boss.meanTurns === null ? '-' : s.boss.meanTurns.toFixed(1)}`,
    '',
    '## 시간 초과',
    `${s.timeouts.count}판${warn('timeouts')}${s.timeouts.count ? ` (시드: ${s.timeouts.seeds.join(', ')})` : ''}`,
    '',
  ];
  return lines.join('\n');
}

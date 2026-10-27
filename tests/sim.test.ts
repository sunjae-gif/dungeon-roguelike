// F017 밸런스 시뮬레이터
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import rawTargets from '../20-data/balance-targets.json';
import { updateSight } from '../src/core/movement';
import type { RunState } from '../src/core/state';
import { decide, newMemory } from '../src/sim/bot';
import { checkTargets, summarize, toMarkdown } from '../src/sim/report';
import type { RunResult } from '../src/sim/simulate';
import { gameData } from './helpers';
import { stateFromMap } from './parseMap';

const data = gameData();
const root = join(__dirname, '..');
const checked = checkTargets(rawTargets);
if (!checked.ok) throw new Error(checked.errors.join('\n'));
const targets = checked.targets;
const POTION = data.items.find((it) => it.use?.effects.some((e) => e.type === 'heal'))!.id;

const seen = (s: RunState) => updateSight(s, data.player.sightRadius);
const withHp = (s: RunState, hp: number): RunState => ({ ...s, player: { ...s.player, hp } });

describe('F017 봇 규칙', () => {
  it('1. 아이템 고르기에서 희귀를 먼저, 없으면 첫 번째', () => {
    const common = data.items.filter((it) => it.rarity === 'common').map((it) => it.id);
    const rare = data.items.find((it) => it.rarity === 'rare')!.id;
    const s = stateFromMap(`
      #####
      #.@.#
      #####`, data);
    const choosing = (options: string[]): RunState => ({ ...s, phase: 'itemChoice', pendingChoice: { source: 'chest', options } });
    expect(decide(choosing([common[0], common[1], rare]), data, newMemory())).toEqual({ type: 'choose', index: 2 });
    expect(decide(choosing([common[0], common[1]]), data, newMemory())).toEqual({ type: 'choose', index: 0 });
  });

  it('2. HP 40% 이하이고 회복 물약이 있으면 마신다', () => {
    const s = seen(stateFromMap(`
      #######
      #@...r#
      #######`, data));
    const low = { ...withHp(s, Math.floor(data.player.maxHp * 0.4)), player: { ...withHp(s, Math.floor(data.player.maxHp * 0.4)).player, consumables: [POTION] } };
    expect(decide(low, data, newMemory())).toEqual({ type: 'play', input: { type: 'useItem', index: 0 } });
    // 40%보다 많으면 마시지 않고 다가간다
    const high = { ...low, player: { ...low.player, hp: Math.floor(data.player.maxHp * 0.4) + 1 } };
    expect(decide(high, data, newMemory())).toEqual({ type: 'play', input: { type: 'direction', direction: 'right' } });
  });

  it('3. 인접한 몬스터 중 HP가 가장 낮은 쪽을 공격한다', () => {
    const s = seen(stateFromMap(`
      #####
      #.r.#
      #r@g#
      #####`, data));
    const weakest = s.floor.actors.find((a) => a.x === 3)!;
    const floor = { ...s.floor, actors: s.floor.actors.map((a) => (a.id === weakest.id ? { ...a, hp: 1 } : a)) };
    expect(decide({ ...s, floor }, data, newMemory())).toEqual({ type: 'play', input: { type: 'direction', direction: 'right' } });
  });

  it('4. 보스의 강타 칸 위면 강타 칸이 아닌 옆 칸으로 비킨다', () => {
    const s = seen(stateFromMap(`
      #########
      #.......#
      #.@.....#
      #......B#
      #########`, data));
    const floor = {
      ...s.floor,
      actors: s.floor.actors.map((a) => ({ ...a, ai: { charging: [{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 2 }, { x: 2, y: 3 }] } })),
    };
    expect(decide({ ...s, floor }, data, newMemory())).toEqual({ type: 'play', input: { type: 'direction', direction: 'left' } });
  });

  it('6. 보이던 몬스터가 안 보이게 되어도 마지막으로 본 자리까지 간다', () => {
    const s = seen(stateFromMap(`
      #########
      #@.....r#
      #########`, data));
    const memory = newMemory();
    expect(decide(s, data, memory)).toEqual({ type: 'play', input: { type: 'direction', direction: 'right' } });
    const gone = { ...s, floor: { ...s.floor, actors: [] } };
    expect(decide(gone, data, memory)).toEqual({ type: 'play', input: { type: 'direction', direction: 'right' } });
  });

  it('8~9. 다 봤으면 계단으로 가고, 계단 위에서 내려간다. 함정은 돌아간다', () => {
    const map = `
      ######
      #@^.>#
      #....#
      ######`;
    const explored = (s: RunState): RunState => ({ ...s, floor: { ...s.floor, explored: s.floor.explored.map(() => true) } });
    const s = explored(seen(stateFromMap(map, data)));
    expect(decide(s, data, newMemory())).toEqual({ type: 'play', input: { type: 'direction', direction: 'down' } });
    const atStairs = { ...s, player: { ...s.player, x: 4, y: 1 } };
    expect(decide(atStairs, data, newMemory())).toEqual({ type: 'play', input: { type: 'descend' } });
  });
});

describe('F017 보고서', () => {
  const run = (over: Partial<RunResult>): RunResult => ({ seed: 1, outcome: 'death', turns: 100, floorReached: 1, buildItems: [], hpOnEntry: [1], ...over });

  it('balance-targets.json이 검사를 통과한다', () => {
    expect(checkTargets(rawTargets).ok).toBe(true);
    expect(checkTargets({ ...rawTargets, botClearRate: [0.5, 0.1] }).ok).toBe(false);
  });

  it('목표를 벗어난 항목에 ⚠️가 붙는다', () => {
    const item = data.items.find((it) => it.kind === 'build')!;
    const results = [
      run({ seed: 1, outcome: 'clear', turns: 5000, floorReached: 10, buildItems: [item.id], bossFightTurns: 10 }),
      run({ seed: 2, floorReached: 3, killedBy: 'rat' }),
      run({ seed: 3, floorReached: 3, killedBy: 'rat' }),
      run({ seed: 4, outcome: 'timeout', turns: targets.maxTurnsPerRun }),
    ];
    const s = summarize(results, 1, targets, data);
    expect(s.clearRate).toBe(0.25);
    expect(s.warnings).toEqual(expect.arrayContaining(['deathFloor:3', 'medianTurnsCleared', `item:${item.id}`, 'timeouts']));
    expect(s.warnings).not.toContain('clearRate');
    expect(s.boss).toEqual({ reached: 1, won: 1, winRate: 1, meanTurns: 10 });
    expect(s.deathCauses).toEqual([{ cause: 'rat', name: data.monsters.find((m) => m.id === 'rat')!.name, count: 2 }]);
    const md = toMarkdown(s, targets);
    expect(md).toContain('시드: 4');
    expect(md.match(/⚠️/g)!.length).toBeGreaterThanOrEqual(5);
  });
});

describe('F017 실행', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'dungeon-sim-'));
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));
  const sim = (out: string) => execFileSync(process.execPath, [join(root, 'scripts/sim.mjs'), '--runs', '10', '--seed-start', '1', '--out', out], { cwd: root });

  it('npm run sim -- --runs 10이 브라우저 없이 끝나고 보고서 두 파일이 생긴다. 다시 돌려도 JSON이 같다', () => {
    sim(join(outDir, 'a'));
    sim(join(outDir, 'b'));
    const read = (dir: string, ext: string) => readFileSync(join(dir, readdirSync(dir).find((f) => f.endsWith(ext))!), 'utf8');
    const a = join(outDir, 'a');
    expect(readdirSync(a).sort().map((f) => f.slice(-3))).toEqual(['son', '.md']);
    expect(read(a, '.json')).toBe(read(join(outDir, 'b'), '.json'));
    const md = read(a, '.md');
    for (const heading of ['클리어율', '사망 층 분포', '사망 원인 순위', '한 판 턴 수', '층별 남은 HP', '빌드 아이템', '보스전', '시간 초과']) {
      expect(md).toContain(`## ${heading}`);
    }
    expect(JSON.parse(read(a, '.json')).runs).toHaveLength(10);
  }, 60_000);
});

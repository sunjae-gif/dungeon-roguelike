import { loadGameData } from '../src/data/load';
import type { GameData, ItemDef } from '../src/data/types';
import { validateGameData } from '../src/data/validate';
import { RAW_DATA } from '../src/data/load';

// 검사를 통과한 실제 데이터
export function gameData(): GameData {
  const result = loadGameData();
  if (!result.ok) throw new Error(`데이터 검사 실패:\n${result.errors.join('\n')}`);
  return result.data;
}

// 테스트 전용 빌드 아이템을 더한 데이터. 형식 검사도 통과해야 한다.
export function withItems(...items: Omit<ItemDef, 'name' | 'kind' | 'weight' | 'sprite'>[]): GameData {
  const full = items.map((it) => ({ name: it.id, kind: 'build' as const, weight: 0, sprite: 'potion_heal', ...it }));
  const raw = structuredClone(RAW_DATA) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  raw['items.json'].items.push(...full);
  const result = validateGameData(raw as typeof RAW_DATA);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.data;
}

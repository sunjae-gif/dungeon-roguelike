import { loadGameData } from '../src/data/load';
import type { GameData } from '../src/data/types';

// 검사를 통과한 실제 데이터
export function gameData(): GameData {
  const result = loadGameData();
  if (!result.ok) throw new Error(`데이터 검사 실패:\n${result.errors.join('\n')}`);
  return result.data;
}

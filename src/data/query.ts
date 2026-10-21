// 검사를 통과한 데이터에서 값을 찾는 함수들.
import type { GameData, ThemeDef } from './types';

export function themeForFloor(data: GameData, floorNumber: number): ThemeDef {
  const theme = data.themes.find((t) => t.floors.includes(floorNumber));
  if (!theme) throw new Error(`${floorNumber}층의 테마가 없음`);
  return theme;
}

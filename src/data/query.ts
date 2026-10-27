// 검사를 통과한 데이터에서 값을 찾는 함수들.
import type { GameData, ItemDef, MonsterDef, StatusDef, ThemeDef, TrapDef } from './types';

export function themeForFloor(data: GameData, floorNumber: number): ThemeDef {
  const theme = data.themes.find((t) => t.floors.includes(floorNumber));
  if (!theme) throw new Error(`${floorNumber}층의 테마가 없음`);
  return theme;
}

// F011 규칙 4, 5: 그 테마가 시작되는 층인가 (1, 4, 7, 10층)
export function isThemeStart(data: GameData, floorNumber: number): boolean {
  return floorNumber === Math.min(...themeForFloor(data, floorNumber).floors);
}

// 데이터 정의 조회. id는 데이터 검사를 통과했으므로 보통 찾아지지만, 없으면 undefined
export const monsterDef = (data: GameData, id: string): MonsterDef | undefined => data.monsters.find((m) => m.id === id);
export const itemDef = (data: GameData, id: string): ItemDef | undefined => data.items.find((it) => it.id === id);
export const statusDef = (data: GameData, id: string): StatusDef | undefined => data.statuses.find((s) => s.id === id);
export const trapDef = (data: GameData, id: string | undefined): TrapDef | undefined => data.traps.find((t) => t.id === id);
export const bossDef = (data: GameData): MonsterDef | undefined => data.monsters.find((m) => m.isBoss);

// 이름 (정의가 없으면 id)
export const monsterName = (data: GameData, id: string): string => monsterDef(data, id)?.name ?? id;
export const itemName = (data: GameData, id: string): string => itemDef(data, id)?.name ?? id;

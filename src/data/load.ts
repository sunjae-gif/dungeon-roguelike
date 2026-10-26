// 20-data/ 파일을 불러와 검사한다. 게임 시작과 테스트에서 같은 함수를 쓴다.
import dungeon from '../../20-data/dungeon.json';
import items from '../../20-data/items.json';
import loot from '../../20-data/loot.json';
import monsters from '../../20-data/monsters.json';
import player from '../../20-data/player.json';
import rooms from '../../20-data/rooms.json';
import sprites from '../../20-data/sprites.json';
import statuses from '../../20-data/statuses.json';
import themes from '../../20-data/themes.json';
import traps from '../../20-data/traps.json';
import ui from '../../20-data/ui.json';
import type { RawData } from './types';
import { validateGameData, type ValidationResult } from './validate';

export const RAW_DATA: RawData = {
  'dungeon.json': dungeon,
  'player.json': player,
  'monsters.json': monsters,
  'items.json': items,
  'rooms.json': rooms,
  'sprites.json': sprites,
  'themes.json': themes,
  'traps.json': traps,
  'statuses.json': statuses,
  'loot.json': loot,
  'ui.json': ui,
};

// RAW_DATA는 모듈 사이에서 공유되므로 검사·사용은 복사본으로 한다.
export function loadGameData(): ValidationResult {
  return validateGameData(structuredClone(RAW_DATA));
}


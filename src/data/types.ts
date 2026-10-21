// 20-data/ 파일의 타입. 검사는 validate.ts가 한다.
import type { Direction } from '../core/state';

export interface DungeonData {
  maxFloor: number;
  rooms: { minCount: number; maxCount: number; minSize: number; maxSize: number };
  bossRoom: { minSize: number; maxSize: number };
  generationMaxAttempts: number;
}

export interface PlayerData {
  maxHp: number;
  attack: number;
  defense: number;
  sightRadius: number;
  inventorySize: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  sightRadius: number;
  isBoss?: boolean;
}

export interface Modifier {
  stat: string;
  op: 'add' | 'mul';
  value: number;
}

export interface EffectDef {
  type: string;
  target?: 'self' | 'other';
  amount?: number;
  op?: 'add' | 'mul';
  value?: number;
  text?: string;
}

export interface Trigger {
  event: string;
  chance: number;
  effects: EffectDef[];
}

export interface ItemDef {
  id: string;
  name: string;
  kind: 'consumable' | 'build';
  weight: number;
  sprite: string;
  use?: { requires?: string; effects: EffectDef[] };
  modifiers?: Modifier[];
  triggers?: Trigger[];
}

export interface RoomTypeDef {
  id: string;
  name: string;
  weight: number;
  minPerFloor: number;
  maxPerFloor: number;
}

export interface SpriteDef {
  id: string;
  path: string;
  fallbackColor: string;
  directions?: Record<Direction, string>;
}

export interface IllustrationDef {
  id: string;
  path: string;
}

export interface SpritesData {
  tileSize: number;
  sourcePixelSize: number;
  sprites: SpriteDef[];
  illustrations: IllustrationDef[];
}

export type Range = [number, number];

export interface ThemeDef {
  id: string;
  name: string;
  floors: number[];
  mapWidth: number;
  mapHeight: number;
  tiles: { floor: string; wall: string; door: string };
  monsterTypes: string[];
  monsterCount: Range;
  itemCount: Range;
  roomWeights: Record<string, number>;
  doorChance: number;
  trapCount: Range;
  trapTypes: string[];
  boss?: string;
}

export interface TrapDef {
  id: string;
  name: string;
  effect: string;
  amount: number;
  sprite: string;
}

export interface UiData {
  baseResolution: { width: number; height: number };
  viewportTiles: { width: number; height: number };
  layout: { padding: number; statusPanelWidth: number; messageLogLines: number; messageLineHeight: number };
  fov: { exploredBrightness: number; unexploredColor: string };
  font: { family: string; file: string; size: number; fallback: string };
  colors: { background: string; text: string; hpNormal: string; hpLow: string };
  lowHpRatio: number;
  input: { keyRepeatIntervalMs: number };
  floorIntroMs: number;
}

export interface GameData {
  dungeon: DungeonData;
  player: PlayerData;
  monsters: MonsterDef[];
  items: ItemDef[];
  roomTypes: RoomTypeDef[];
  sprites: SpritesData;
  themes: ThemeDef[];
  traps: TrapDef[];
  ui: UiData;
}

// 데이터 파일 이름 → 내용 (검사 전)
export type RawData = Record<DataFileName, unknown>;
export type DataFileName =
  | 'dungeon.json'
  | 'player.json'
  | 'monsters.json'
  | 'items.json'
  | 'rooms.json'
  | 'sprites.json'
  | 'themes.json'
  | 'traps.json'
  | 'ui.json';

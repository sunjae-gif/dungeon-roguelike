// 20-data/ 파일의 타입. 검사는 validate.ts가 한다.
import type { Direction } from '../core/state';

export interface DungeonData {
  maxFloor: number;
  rooms: { minCount: number; maxCount: number; minSize: number; maxSize: number };
  bossRoom: { minSize: number; maxSize: number };
  generationMaxAttempts: number;
  roomPlacementTries: number;
  extraCorridors: [number, number];
}

export interface PlayerData {
  maxHp: number;
  attack: number;
  defense: number;
  sightRadius: number;
  attackRange: number;
  maxAttackRange: number;
  inventorySize: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  behavior: MonsterBehavior;
  attackRange?: number;
  isBoss?: boolean;
  // effects.md 2절: 몬스터 특성. 아이템과 같은 형식
  modifiers?: Modifier[];
  triggers?: Trigger[];
  // F014 행동 방식별 필드
  piercing?: boolean;
  attackVerb?: string;
  fleeHpRatio?: number;
  vanishWhenUnseen?: number;
  placement?: 'room' | 'chokepoint';
  // effects.md 7절
  immunities?: string[];
  // F008: 있으면 F014 처음 발견 메시지 대신 쓴다
  noticeMessage?: string;
  boss?: BossDef;
}

export type MonsterBehavior = 'chase' | 'ranged' | 'flee' | 'ambush' | 'boss';

// F008 보스 패턴
export interface BossDef {
  chargeEvery: number;
  slamRange: number;
  slamDamageMul: number;
  enrage: { hpRatio: number; chargeEvery: number; modifiers: Modifier[]; message: string };
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
  status?: string;
  turns?: number;
  distance?: number;
  collisionDamage?: number;
  radius?: number;
}

export interface Trigger {
  event: string;
  chance: number;
  message?: string;
  effects: EffectDef[];
}

export interface ItemDef {
  id: string;
  name: string;
  kind: 'consumable' | 'build';
  weight?: number;
  sprite: string;
  use?: { requires?: string; effects: EffectDef[] };
  modifiers?: Modifier[];
  triggers?: Trigger[];
  // F005
  rarity?: 'common' | 'rare';
  description?: string;
  useMessage?: string; // F005 규칙 3-1. {회복량}은 실제로 오른 HP
  // effects.md 7절
  immunities?: string[];
}

// effects.md 5절
export interface StatusDef {
  id: string;
  name: string;
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
  intro: string; // F011 진입 문구
  rareChance: number; // F005 보물상자 후보가 희귀일 확률
  // F011 규칙 6: 있으면 dungeon.json 대신
  rooms?: DungeonData['rooms'];
  bossRoom?: DungeonData['bossRoom'];
  extraCorridors?: [number, number];
  floors: number[];
  mapWidth: number;
  mapHeight: number;
  tiles: { floor: string; wall: string; door: string };
  monsterTypes: Record<string, number>; // F014: 몬스터 id → 출현 가중치
  monsterCount: Range;
  itemCount: Range;
  roomWeights: Record<string, number>;
  doorChance: number;
  trapCount: Range;
  trapTypes: string[];
  boss?: string;
}

// F010
export interface TrapDef {
  id: string;
  name: string;
  effects: EffectDef[];
  once?: boolean;
  sprite: string;
}

// F005 loot.json
export interface LootData {
  chestChoices: number;
  secretChoices: number;
  puzzleChoices: number;
  monsterDrop: { item: string; chance: number };
  exhaustedReward: { item: string; count: number };
}

export interface UiData {
  baseResolution: { width: number; height: number };
  viewportTiles: { width: number; height: number };
  layout: { padding: number; statusPanelWidth: number; messageLogLines: number; messageLineHeight: number };
  fov: { exploredBrightness: number; unexploredColor: string };
  font: { family: string; file: string; size: number; fallback: string };
  colors: { background: string; text: string; hpNormal: string; hpLow: string; missingSprite: string; rare: string; telegraph: string; bossHp: string };
  lowHpRatio: number;
  input: { keyRepeatIntervalMs: number };
  floorIntroMs: number;
  messageLogMaxStored: number;
}

export interface GameData {
  dungeon: DungeonData;
  player: PlayerData;
  monsters: MonsterDef[];
  // F004 규칙 7: 모든 몬스터 공통 시야
  monsterSightRadius: number;
  items: ItemDef[];
  statuses: StatusDef[];
  loot: LootData;
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
  | 'statuses.json'
  | 'loot.json'
  | 'ui.json';

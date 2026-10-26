// 게임 상태 구조. 30-systems/game-state.md를 그대로 옮긴다.
// 상태는 순수 데이터다: JSON.stringify → JSON.parse로 그대로 복원되어야 한다.

export type Direction = 'up' | 'down' | 'left' | 'right';
export type TileType = 'wall' | 'floor';

// 30-systems/game-flow.md
export type Phase = 'title' | 'playing' | 'floorIntro' | 'gameOver' | 'victory';

export interface RunState {
  version: 1;
  runSeed: number;
  rng: Record<string, number>;
  phase: Phase;
  floorNumber: number;
  turn: number;
  nextId: number;
  player: Actor;
  floor: FloorState;
  messageLog: Message[];
  runStats: { kills: number; floorsReached: number; itemsFound: number; killedBy?: string };
}

export interface FloorState {
  themeId: string;
  width: number;
  height: number;
  tiles: TileType[];
  explored: boolean[];
  visible: boolean[];
  rooms: Room[];
  objects: MapObject[];
  actors: Actor[];
  items: FloorItem[];
}

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  state: Record<string, unknown>;
}

export interface MapObject {
  id: number;
  type: string;
  defId?: string;
  x: number;
  y: number;
  blocksMove: boolean;
  blocksSight: boolean;
  state: Record<string, unknown>;
}

export interface Actor {
  id: number;
  defId: string;
  x: number;
  y: number;
  facing: Direction;
  hp: number;
  buildItems: string[];
  consumables: string[];
  statuses: Status[];
  carried?: string[];
  ai?: MonsterAi;
}

// 몬스터만. F004, F014
export interface MonsterAi {
  lastSeenPlayer?: { x: number; y: number };
  noticed?: boolean;
  awake?: boolean;
  retreatedLastTurn?: boolean;
  fleeing?: boolean;
  unseenTurns?: number;
}

export interface Status {
  id: string;
  turnsLeft: number;
  appliedTurn: number; // 걸린 턴. 그 턴의 마무리에서는 줄지 않는다
}

export interface FloorItem {
  id: number;
  defId: string;
  x: number;
  y: number;
}

export interface Message {
  turn: number;
  text: string;
}

export const STATE_VERSION = 1;
export const PLAYER_DEF_ID = 'player';

export function tileIndex(floor: FloorState, x: number, y: number): number {
  return y * floor.width + x;
}

export function cloneState(state: RunState): RunState {
  return JSON.parse(JSON.stringify(state)) as RunState;
}

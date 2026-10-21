// 문자로 그린 고정 지도를 상태로 바꾸는 테스트 도우미 (40-tech/tech-stack.md "테스트 규칙")
import { STAIRS_OBJECT_TYPE } from '../src/core/dungeon';
import { createRun } from '../src/core/run';
import type { Actor, FloorState, RunState, TileType } from '../src/core/state';
import type { GameData } from '../src/data/types';

const MONSTER_LETTERS: Record<string, string> = { r: 'rat', g: 'goblin', o: 'orc', t: 'troll', B: 'final_boss' };

export interface ParsedMap {
  floor: FloorState;
  player: { x: number; y: number } | null;
}

export function parseMap(text: string, data: GameData, themeId = data.themes[0].id): ParsedMap {
  const rows = text.split('\n').map((r) => r.trimEnd()).filter((r) => r.trim() !== '');
  const indent = Math.min(...rows.map((r) => r.length - r.trimStart().length));
  const lines = rows.map((r) => r.slice(indent));
  const width = Math.max(...lines.map((l) => l.length));
  const height = lines.length;
  const floor: FloorState = {
    themeId, width, height,
    tiles: [], explored: new Array(width * height).fill(false), visible: new Array(width * height).fill(false),
    rooms: [], objects: [], actors: [], items: [],
  };
  let player: ParsedMap['player'] = null;
  let nextId = 1000;
  lines.forEach((line, y) => {
    for (let x = 0; x < width; x++) {
      const ch = line[x] ?? '#';
      const tile: TileType = ch === '#' ? 'wall' : 'floor';
      floor.tiles.push(tile);
      if (ch === '#' || ch === '.') continue;
      if (ch === '@') player = { x, y };
      else if (ch === '>') {
        floor.objects.push({ id: nextId++, type: STAIRS_OBJECT_TYPE, x, y, blocksMove: false, blocksSight: false, state: {} });
      } else if (MONSTER_LETTERS[ch]) {
        const defId = MONSTER_LETTERS[ch];
        const def = data.monsters.find((m) => m.id === defId)!;
        const actor: Actor = {
          id: nextId++, defId, x, y, facing: 'down', hp: def.maxHp, buildItems: [], consumables: [], statuses: [],
        };
        floor.actors.push(actor);
      } else {
        throw new Error(`parseMap: 아직 지원하지 않는 문자 "${ch}"`);
      }
    }
  });
  return { floor, player };
}

// 고정 지도로 playing 상태를 만든다. 시야는 계산하지 않은 상태.
export function stateFromMap(text: string, data: GameData): RunState {
  const { floor, player } = parseMap(text, data);
  if (!player) throw new Error('parseMap: 지도에 @가 없음');
  const run = createRun(data, 1, 'playing');
  return { ...run, floor, player: { ...run.player, ...player }, messageLog: [] };
}

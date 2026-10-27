// F007 무엇을 그릴지 정하는 순수 함수들. 캔버스를 쓰지 않아 테스트할 수 있다.
import { tileIndex, type Actor, type FloorState, type MapObject, type RunState } from '../core/state';
import { causeName } from '../core/events';
import { MESSAGES } from '../core/messages';
import { statusDef } from '../core/effects';
import { DOOR_OBJECT_TYPE } from '../core/doors';
import { HIDDEN_WALL_OBJECT_TYPE } from '../core/dungeon';
import { getStat } from '../core/effects';
import { TRAP_OBJECT_TYPE } from '../core/traps';
import { formatSeed } from '../core/rng';
import { isThemeStart, themeForFloor } from '../data/query';
import type { GameData } from '../data/types';

export type TileShade = 'visible' | 'explored' | 'unexplored';

// F007 규칙 6~8
export function tileShade(floor: FloorState, x: number, y: number): TileShade {
  const i = tileIndex(floor, x, y);
  if (floor.visible[i]) return 'visible';
  return floor.explored[i] ? 'explored' : 'unexplored';
}

// F002 규칙 8, F007 규칙 7: 지금 보이는 칸의 몬스터만 그린다
export function drawableMonsters(state: RunState): Actor[] {
  return state.floor.actors.filter((a) => tileShade(state.floor, a.x, a.y) === 'visible');
}

export function drawableItems(state: RunState) {
  return state.floor.items.filter((it) => tileShade(state.floor, it.x, it.y) === 'visible');
}

export interface TextLine {
  text: string;
  color: string;
}

// F007 규칙 18~20: 상태창 내용 (위에서부터)
export function statusLines(state: RunState, data: GameData): TextLine[] {
  const { colors, lowHpRatio } = data.ui;
  const text = (t: string): TextLine => ({ text: t, color: colors.text });
  const itemName = (id: string) => data.items.find((it) => it.id === id)?.name ?? id;
  const { hp } = state.player;
  const [maxHp, attack, defense] = (['maxHp', 'attack', 'defense'] as const).map((s) => getStat(state.player, s, data));
  const theme = themeForFloor(data, state.floorNumber);
  const lines: TextLine[] = [
    text(`${state.floorNumber}층  ${theme.name}`),
    { text: `HP ${hp}/${maxHp}`, color: hp <= maxHp * lowHpRatio ? colors.hpLow : colors.hpNormal },
    text(`공격 ${attack}`),
    text(`방어 ${defense}`),
    text(''),
    text('소모품'),
    ...state.player.consumables.map((id, i) => text(`${i + 1}. ${itemName(id)}`)),
    text(''),
    // F014 화면: 걸린 일시 효과 (빌드 아이템 목록 위)
    ...state.player.statuses.map((s) => text(`${statusDef(data, s.id)?.name ?? s.id} (${s.turnsLeft}턴)`)),
    ...(state.player.statuses.length > 0 ? [text('')] : []),
    text('빌드 아이템'),
    ...state.player.buildItems.map((id) => text(`- ${itemName(id)}`)),
  ];
  return lines;
}

// F007 규칙 22: 최근 메시지, 가장 새 것이 맨 위
export function messageLines(state: RunState, data: GameData): string[] {
  return state.messageLog
    .slice(-data.ui.layout.messageLogLines)
    .reverse()
    .map((m) => m.text);
}

// F006 규칙 1: 게임 오버 화면 내용
export function gameOverLines(state: RunState, data: GameData): string[] {
  const { killedBy } = state.runStats;
  return [
    '게임 오버',
    // effects.md 4절: 몬스터면 "{몬스터}에게", 일시 효과면 "{원인}(으)로"
    ...(killedBy
      ? [data.monsters.some((m) => m.id === killedBy) ? `${causeName(data, killedBy)}에게 쓰러졌다` : `${causeName(data, killedBy)}(으)로 쓰러졌다`]
      : []),
    ...resultLines(state, data),
  ];
}

// F008 규칙 16: 클리어 화면
export function victoryLines(state: RunState, data: GameData): string[] {
  const boss = data.monsters.find((m) => m.isBoss);
  return [MESSAGES.bossDefeated(boss?.name ?? ''), ...resultLines(state, data)];
}

// F006 결과 정보 + F008 규칙 16, 17: 이번 판의 빌드 아이템(얻은 순서)
function resultLines(state: RunState, data: GameData): string[] {
  const names = state.player.buildItems.map((id) => data.items.find((it) => it.id === id)?.name ?? id);
  return [
    '',
    `도달한 층  ${state.runStats.floorsReached}층`,
    `쓰러뜨린 몬스터  ${state.runStats.kills}`,
    `턴 수  ${state.turn}`,
    `시드  ${formatSeed(state.runSeed)}`,
    '',
    `빌드 아이템 (${names.length})`,
    ...(names.length > 0 ? chunk(names, BUILD_NAMES_PER_LINE).map((row) => row.join(', ')) : ['없음']),
    '',
    'R: 새 판   Esc: 타이틀',
  ];
}

// 결과 화면에서 빌드 아이템 이름을 한 줄에 몇 개씩
const BUILD_NAMES_PER_LINE = 5;
const chunk = <T,>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

// F008 규칙 13: 보스가 힘을 모은 칸 중 플레이어에게 보이는 칸
export function telegraphTiles(state: RunState): { x: number; y: number }[] {
  return state.floor.actors
    .flatMap((a) => a.ai?.charging ?? [])
    .filter((t) => tileShade(state.floor, t.x, t.y) === 'visible');
}

// F008 규칙 14: 시야에 있는 보스의 HP
export function bossBar(state: RunState, data: GameData): { name: string; hp: number; maxHp: number } | null {
  const boss = drawableMonsters(state).find((a) => data.monsters.find((m) => m.id === a.defId)?.isBoss);
  if (!boss) return null;
  return { name: causeName(data, boss.defId), hp: Math.max(0, boss.hp), maxHp: getStat(boss, 'maxHp', data) };
}

// F013 규칙 5, F011 규칙 4: 층 번호, 테마 이름, 테마 첫 층이면 진입 문구
export function floorIntroLines(state: RunState, data: GameData): string[] {
  const theme = themeForFloor(data, state.floorNumber);
  return [`${state.floorNumber}층`, theme.name, ...(isThemeStart(data, state.floorNumber) ? ['', theme.intro] : [])];
}

// 물체 그림 id. 열린 물체(상자 등)는 "{id}_open" 그림이 있으면 그것을 쓴다
// F010: 문은 테마의 door·doorOpen 그림, 함정은 traps.json의 sprite
export function objectSprite(obj: MapObject, data: GameData, floorNumber: number): string {
  if (obj.type === DOOR_OBJECT_TYPE) {
    const { tiles } = themeForFloor(data, floorNumber);
    return obj.state.open ? tiles.doorOpen : tiles.door;
  }
  if (obj.type === TRAP_OBJECT_TYPE) return data.traps.find((t) => t.id === obj.defId)?.sprite ?? obj.type;
  // F009 규칙 11, 12: 숨은 벽은 찾기 전에는 벽, 찾은 뒤에는 통로(바닥)
  if (obj.type === HIDDEN_WALL_OBJECT_TYPE) {
    const { tiles } = themeForFloor(data, floorNumber);
    return obj.state.discovered ? tiles.floor : tiles.wall;
  }
  // 상태별 그림: 열린 상자 "_open", 마른 샘 "_used", 무너진 발판 "_broken", 눌린 스위치 "_pressed" (있으면)
  const base = obj.defId ?? obj.type;
  const flag = (['opened', 'used', 'broken', 'pressed'] as const).find((k) => obj.state[k]);
  const suffix = { opened: '_open', used: '_used', broken: '_broken', pressed: '_pressed' } as const;
  const variant = flag ? `${base}${suffix[flag]}` : base;
  return data.sprites.sprites.some((s) => s.id === variant) ? variant : base;
}

const RARITY_LABEL: Record<string, string> = { common: '일반', rare: '희귀' };

// F005 화면: itemChoice 후보 목록. "1. 광전사의 띠 (일반) — 공격 +2, 방어 −1", 희귀는 색을 다르게
export function itemChoiceLines(state: RunState, data: GameData): TextLine[] {
  const { colors } = data.ui;
  const options = state.pendingChoice?.options ?? [];
  return [
    { text: '빌드 아이템을 하나 고른다 (숫자키)', color: colors.text },
    { text: '', color: colors.text },
    ...options.map((id, i) => {
      const def = data.items.find((it) => it.id === id);
      const rarity = def?.rarity ?? 'common';
      return {
        text: `${i + 1}. ${def?.name ?? id} (${RARITY_LABEL[rarity] ?? rarity}) — ${def?.description ?? ''}`,
        color: rarity === 'rare' ? colors.rare : colors.text,
      };
    }),
  ];
}

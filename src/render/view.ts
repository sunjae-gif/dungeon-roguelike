// F007 무엇을 그릴지 정하는 순수 함수들. 캔버스를 쓰지 않아 테스트할 수 있다.
import { tileIndex, type Actor, type FloorState, type RunState } from '../core/state';
import { monsterName } from '../core/combat';
import { getStat } from '../core/effects';
import { formatSeed } from '../core/rng';
import { themeForFloor } from '../data/query';
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
    ...(killedBy ? [`${monsterName(data, killedBy)}에게 쓰러졌다`] : []),
    '',
    `도달한 층  ${state.runStats.floorsReached}층`,
    `쓰러뜨린 몬스터  ${state.runStats.kills}`,
    `턴 수  ${state.turn}`,
    `시드  ${formatSeed(state.runSeed)}`,
    '',
    'R: 새 판   Esc: 타이틀',
  ];
}

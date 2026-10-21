// phase별 화면. 상태를 읽기만 한다.
// 지도·상태창·메시지 로그(F007)는 M1에서 그린다. 지금은 글자만 띄운다.
import type { RunState } from '../core/state';
import { themeForFloor } from '../data/query';
import type { GameData } from '../data/types';

function linesFor(state: RunState, data: GameData): string[] {
  switch (state.phase) {
    case 'title':
      return ['타이틀', 'Enter: 새 게임'];
    case 'floorIntro':
      return [`${state.floorNumber}층`, themeForFloor(data, state.floorNumber).name];
    case 'playing':
      return [`${state.floorNumber}층`, '(지도 화면은 M1에서)'];
    case 'gameOver':
      return ['게임 오버', 'R: 새 판   Esc: 타이틀'];
    case 'victory':
      return ['클리어', 'R: 새 판   Esc: 타이틀'];
  }
}

export function renderScreen(ctx: CanvasRenderingContext2D, state: RunState, data: GameData): void {
  const { font, colors, layout } = data.ui;
  const { width, height } = ctx.canvas;
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  const lines = linesFor(state, data);
  ctx.font = `${font.size}px ${font.family}, ${font.fallback}`;
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = height / 2 - ((lines.length - 1) * layout.messageLineHeight) / 2;
  for (const line of lines) {
    ctx.fillText(line, width / 2, y);
    y += layout.messageLineHeight;
  }
}

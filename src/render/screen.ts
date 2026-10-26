// phase별 화면. 상태를 읽기만 한다.
import type { RunState } from '../core/state';
import { themeForFloor } from '../data/query';
import type { GameData } from '../data/types';
import { cameraFor } from './camera';
import { fontCss } from './font';
import type { Box, Layout } from './layout';
import type { SpriteBook } from './sprites';
import { bossBar, floorIntroLines, itemChoiceLines, objectSprite, telegraphTiles, victoryLines, drawableItems, drawableMonsters, gameOverLines, messageLines, statusLines, tileShade, type TextLine } from './view';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  data: GameData;
  layout: Layout;
  sprites: SpriteBook;
  // 상태창 맨 아래에 붙일 줄 (F012 개발자 모드의 시드 등)
  extraStatus: TextLine[];
}

function centerLines(state: RunState, data: GameData): string[] | null {
  switch (state.phase) {
    case 'title':
      return ['타이틀', 'Enter: 새 게임'];
    case 'floorIntro':
      return floorIntroLines(state, data);
    case 'playing':
    case 'itemChoice':
      return null;
    case 'gameOver':
      return gameOverLines(state, data);
    case 'victory':
      return victoryLines(state, data);
  }
}

export function renderScreen(rc: RenderContext, state: RunState): void {
  const { ctx, data, layout } = rc;
  const { colors } = data.ui;
  ctx.imageSmoothingEnabled = false; // F007 규칙 9
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, layout.canvas.width, layout.canvas.height);
  ctx.font = fontCss(data.ui);
  ctx.textBaseline = 'top';

  const lines = centerLines(state, data);
  if (lines) return drawCentered(rc, lines);
  drawMap(rc, state);
  drawStatus(rc, state);
  drawLog(rc, state);
  if (state.phase === 'itemChoice') drawChoice(rc, state);
}

// F005 itemChoice: 지도 가운데에 상자를 띄운다
function drawChoice(rc: RenderContext, state: RunState): void {
  const { ctx, data, layout } = rc;
  const { padding, messageLineHeight } = data.ui.layout;
  const lines = itemChoiceLines(state, data);
  const w = layout.map.w - padding * 4;
  const h = lines.length * messageLineHeight + padding * 2;
  const box = { x: layout.map.x + (layout.map.w - w) / 2, y: layout.map.y + (layout.map.h - h) / 2, w, h };
  ctx.fillStyle = data.ui.colors.background;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = data.ui.colors.text;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  drawTextLines(rc, { x: box.x + padding, y: box.y + padding, w: box.w - padding * 2, h: box.h - padding * 2 }, lines);
}

function drawCentered(rc: RenderContext, lines: string[]): void {
  const { ctx, data, layout } = rc;
  const lineHeight = data.ui.layout.messageLineHeight;
  ctx.fillStyle = data.ui.colors.text;
  ctx.textAlign = 'center';
  let y = layout.canvas.height / 2 - (lines.length * lineHeight) / 2;
  for (const line of lines) {
    ctx.fillText(line, layout.canvas.width / 2, y);
    y += lineHeight;
  }
  ctx.textAlign = 'left';
}

// F007 규칙 10: 바닥·벽 → 물체 → 아이템 → 몬스터 → 플레이어
function drawMap(rc: RenderContext, state: RunState): void {
  const { ctx, data, layout, sprites } = rc;
  const { floor, player } = state;
  const { map, tileSize, viewport } = layout;
  const { fov } = data.ui;
  const theme = themeForFloor(data, state.floorNumber);
  const cam = cameraFor(floor, player, viewport);
  const toScreen = (x: number, y: number) => ({ x: map.x + (x - cam.x) * tileSize, y: map.y + (y - cam.y) * tileSize });
  const drawSprite = (id: string, x: number, y: number, facing?: typeof player.facing) => {
    const p = toScreen(x, y);
    const s = sprites.get(id, facing);
    if (s.image) ctx.drawImage(s.image, p.x, p.y, tileSize, tileSize);
    else {
      ctx.fillStyle = s.color;
      ctx.fillRect(p.x, p.y, tileSize, tileSize);
    }
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(map.x, map.y, map.w, map.h);
  ctx.clip();
  ctx.fillStyle = fov.unexploredColor;
  ctx.fillRect(map.x, map.y, map.w, map.h);

  for (let vy = 0; vy < viewport.height; vy++) {
    for (let vx = 0; vx < viewport.width; vx++) {
      const x = cam.x + vx;
      const y = cam.y + vy;
      if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) continue;
      const shade = tileShade(floor, x, y);
      if (shade === 'unexplored') continue;
      // F007 규칙 11: 바닥·벽 그림은 현재 층 테마의 tiles
      drawSprite(theme.tiles[floor.tiles[y * floor.width + x]], x, y);
      // 물체는 탐색됨 칸에서도 그린다 (마지막으로 본 모습)
      const obj = floor.objects.find((o) => o.x === x && o.y === y);
      if (obj) drawSprite(objectSprite(obj, data), x, y);
      if (shade === 'explored') {
        // F007 규칙 7: 탐색됨 칸은 exploredBrightness 밝기로
        const p = toScreen(x, y);
        ctx.globalAlpha = 1 - fov.exploredBrightness;
        ctx.fillStyle = fov.unexploredColor;
        ctx.fillRect(p.x, p.y, tileSize, tileSize);
        ctx.globalAlpha = 1;
      }
    }
  }
  // F008 규칙 13: 강타할 칸
  ctx.fillStyle = data.ui.colors.telegraph;
  for (const t of telegraphTiles(state)) {
    const p = toScreen(t.x, t.y);
    ctx.fillRect(p.x, p.y, tileSize, tileSize);
  }
  for (const item of drawableItems(state)) drawSprite(item.defId, item.x, item.y);
  for (const monster of drawableMonsters(state)) drawSprite(monster.defId, monster.x, monster.y, monster.facing);
  drawSprite(player.defId, player.x, player.y, player.facing);
  ctx.restore();
}

function drawTextLines(rc: RenderContext, box: Box, lines: TextLine[], fromBottom = false): void {
  const { ctx } = rc;
  const lineHeight = rc.data.ui.layout.messageLineHeight;
  const startY = fromBottom ? box.y + box.h - lines.length * lineHeight : box.y;
  lines.forEach((line, i) => {
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, box.x, startY + i * lineHeight);
  });
}

function drawStatus(rc: RenderContext, state: RunState): void {
  const { ctx, data, layout } = rc;
  const box = layout.status;
  drawTextLines(rc, box, statusLines(state, data));
  // F007 규칙 21: 개발자 모드면 맨 아래에 시드
  drawTextLines(rc, box, rc.extraStatus, true);
  // F008 규칙 14: 보스 HP 막대 (개발자 모드 줄 위)
  const boss = bossBar(state, data);
  if (!boss) return;
  const lineHeight = data.ui.layout.messageLineHeight;
  const barY = box.y + box.h - (rc.extraStatus.length + 1) * lineHeight;
  const labelY = barY - lineHeight;
  ctx.fillStyle = data.ui.colors.text;
  ctx.fillText(`${boss.name}  ${boss.hp}/${boss.maxHp}`, box.x, labelY);
  ctx.strokeStyle = data.ui.colors.text;
  ctx.strokeRect(box.x, barY, box.w, lineHeight / 2);
  ctx.fillStyle = data.ui.colors.bossHp;
  ctx.fillRect(box.x, barY, (box.w * boss.hp) / boss.maxHp, lineHeight / 2);
}

function drawLog(rc: RenderContext, state: RunState): void {
  const color = rc.data.ui.colors.text;
  drawTextLines(rc, rc.layout.log, messageLines(state, rc.data).map((text) => ({ text, color })));
}

// F007 화면 크기와 배치. 좌표는 모두 ui.json, sprites.json 수치로 계산한다.
import type { GameData } from '../data/types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  canvas: { width: number; height: number };
  tileSize: number;
  viewport: { width: number; height: number }; // 칸 수
  map: Box;
  status: Box;
  log: Box;
}

export function computeLayout(data: GameData): Layout {
  const { baseResolution, viewportTiles, layout } = data.ui;
  const { tileSize } = data.sprites;
  const { padding } = layout;
  const map = { x: padding, y: padding, w: viewportTiles.width * tileSize, h: viewportTiles.height * tileSize };
  return {
    canvas: { ...baseResolution },
    tileSize,
    viewport: { ...viewportTiles },
    map,
    status: {
      x: map.x + map.w + padding,
      y: padding,
      w: layout.statusPanelWidth,
      h: baseResolution.height - padding * 2,
    },
    log: {
      x: map.x,
      y: map.y + map.h + padding,
      w: map.w,
      h: layout.messageLogLines * layout.messageLineHeight,
    },
  };
}

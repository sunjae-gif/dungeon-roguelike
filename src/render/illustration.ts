// F016 스탠딩 일러스트 층: 픽셀아트 캔버스 위에 겹친 별도 캔버스에 매끄럽게 그린다
import type { RunState } from '../core/state';
import type { GameData } from '../data/types';
import type { Box, Layout } from './layout';
import type { ImageHandle, ImageLoader } from './sprites';
import { illustrationFor } from './view';

// 일러스트가 들어갈 자리. 타이틀은 오른쪽 반, 결과 화면은 왼쪽 반, 보스 진입은 가운데
export function illustrationBox(state: RunState, data: GameData, layout: Layout): Box {
  const { padding } = data.ui.layout;
  const { aspectWidth, aspectHeight } = data.ui.illustration;
  const half = layout.canvas.width / 2;
  const h = layout.canvas.height - padding * 2;
  const w = (h * aspectWidth) / aspectHeight;
  const center = state.phase === 'title' ? half + half / 2 : state.phase === 'floorIntro' ? half : half / 2;
  return { x: center - w / 2, y: padding, w, h };
}

export class IllustrationLayer {
  private readonly images = new Map<string, ImageHandle>();

  constructor(
    private readonly data: GameData,
    private readonly load: ImageLoader,
  ) {}

  // 그 화면의 일러스트를 그린다. 파일이 없으면 비워 둔다 (F016: 없어도 화면이 깨지지 않는다)
  draw(ctx: CanvasRenderingContext2D, state: RunState, layout: Layout): void {
    ctx.clearRect(0, 0, layout.canvas.width, layout.canvas.height);
    const id = illustrationFor(state, this.data);
    const def = id ? this.data.sprites.illustrations.find((i) => i.id === id) : undefined;
    if (!def) return;
    let handle = this.images.get(def.path);
    if (!handle) {
      handle = this.load(def.path);
      this.images.set(def.path, handle);
    }
    const image = handle.get();
    if (!image) return;
    const box = illustrationBox(state, this.data, layout);
    ctx.globalAlpha = state.phase === 'floorIntro' ? this.data.ui.illustration.bossIntroAlpha : 1;
    ctx.drawImage(image, box.x, box.y, box.w, box.h);
    ctx.globalAlpha = 1;
  }
}

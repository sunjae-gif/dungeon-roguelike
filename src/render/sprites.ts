// sprites.json을 읽어 이미지를 불러오고, 없거나 실패하면 색 사각형으로 그린다 (F007 규칙 12~14)
import type { Direction } from '../core/state';
import type { SpritesData } from '../data/types';

// 불러오는 중인 이미지 하나. 다 불러왔으면 image를, 아니면 null을 돌려준다.
export interface ImageHandle {
  get(): CanvasImageSource | null;
}

export type ImageLoader = (path: string) => ImageHandle;

export interface SpriteDraw {
  image: CanvasImageSource | null;
  color: string;
}

export class SpriteBook {
  private readonly images = new Map<string, ImageHandle>();
  private readonly warned = new Set<string>();

  constructor(
    private readonly sprites: SpritesData,
    private readonly missingColor: string,
    private readonly load: ImageLoader,
  ) {}

  // F007 규칙 14: 방향 이미지가 없으면 기본 이미지
  get(id: string, facing?: Direction): SpriteDraw {
    const def = this.sprites.sprites.find((s) => s.id === id);
    if (!def) {
      if (!this.warned.has(id)) {
        this.warned.add(id);
        console.warn(`sprites.json에 없는 그림 id "${id}". 색 사각형으로 그린다.`);
      }
      return { image: null, color: this.missingColor };
    }
    const directional = facing ? def.directions?.[facing] : undefined;
    const image = (directional && this.image(directional)) || this.image(def.path);
    return { image, color: def.fallbackColor };
  }

  private image(path: string): CanvasImageSource | null {
    let handle = this.images.get(path);
    if (!handle) {
      handle = this.load(path);
      this.images.set(path, handle);
    }
    return handle.get();
  }
}

// 브라우저용 이미지 불러오기. 다 불러오면 onReady로 다시 그리게 한다.
// 파일이 없으면 조용히 실패하고 색 사각형을 계속 쓴다 (F007 규칙 13).
export function browserImageLoader(baseUrl: string, onReady: () => void): ImageLoader {
  return (path) => {
    const img = new Image();
    let ok = false;
    img.onload = () => {
      ok = img.naturalWidth > 0;
      if (ok) onReady();
    };
    img.src = `${baseUrl}${path}`;
    return { get: () => (ok ? img : null) };
  };
}

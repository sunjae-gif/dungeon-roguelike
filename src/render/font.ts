// F007 규칙 16, 17: 픽셀 글꼴. 불러오기를 기다리지 않고, 실패하면 대체 글꼴로 그린다.
import type { UiData } from '../data/types';

export function fontCss(ui: UiData): string {
  return `${ui.font.size}px "${ui.font.family}", ${ui.font.fallback}`;
}

export function loadFont(ui: UiData, baseUrl: string, onReady: () => void): void {
  if (typeof FontFace === 'undefined') return;
  new FontFace(ui.font.family, `url(${baseUrl}${ui.font.file})`)
    .load()
    .then((face) => {
      document.fonts.add(face);
      onReady();
    })
    .catch(() => console.warn(`글꼴 ${ui.font.file}을 불러오지 못했다. ${ui.font.fallback}로 그린다.`));
}

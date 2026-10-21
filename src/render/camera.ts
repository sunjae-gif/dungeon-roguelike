// F007 카메라: 뷰포트 왼쪽 위 칸 좌표
import type { FloorState } from '../core/state';

// 한 축의 카메라 위치
function axis(mapSize: number, viewSize: number, player: number): number {
  // 규칙 5: 지도가 뷰포트보다 작으면 가운데에 놓는다 (카메라가 음수가 될 수 있다)
  if (mapSize <= viewSize) return -Math.floor((viewSize - mapSize) / 2);
  // 규칙 3, 4: 플레이어를 가운데에 두되, 지도 밖은 보여주지 않는다
  const centered = player - Math.floor(viewSize / 2);
  return Math.min(Math.max(centered, 0), mapSize - viewSize);
}

export function cameraFor(
  floor: Pick<FloorState, 'width' | 'height'>,
  player: { x: number; y: number },
  viewport: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: axis(floor.width, viewport.width, player.x),
    y: axis(floor.height, viewport.height, player.y),
  };
}

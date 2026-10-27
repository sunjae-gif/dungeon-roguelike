// 통로 모양 계산: 방 가운데, 가장 가까운 방, ㄱ자 통로 (F001, F009가 같이 쓴다)
import type { Point } from './dungeon';
import { nextInt, type Rng } from './rng';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function centerOf(r: Rect): Point {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

const distance = (a: Rect, b: Rect) => {
  const ca = centerOf(a);
  const cb = centerOf(b);
  return Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y);
};

// 가장 가까운 방. 거리가 같으면 인덱스가 작은 쪽
export function nearest(rects: Rect[], from: number, candidates: number[]): number | null {
  let best: number | null = null;
  for (const c of candidates) {
    if (best === null || distance(rects[from], rects[c]) < distance(rects[from], rects[best])) best = c;
  }
  return best;
}

// 가로 먼저 또는 세로 먼저 한 번 꺾이는 통로
export function corridorPath(rng: Rng, from: Point, to: Point): Point[] {
  return lShape(from, to, nextInt(rng, 0, 1) === 0);
}

export function lShape(from: Point, to: Point, horizontalFirst: boolean): Point[] {
  const corner = horizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  return [...straightLine(from, corner), ...straightLine(corner, to)];
}

function straightLine(from: Point, to: Point): Point[] {
  const points: Point[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  for (let p = { ...from }; ; p = { x: p.x + dx, y: p.y + dy }) {
    points.push(p);
    if (p.x === to.x && p.y === to.y) return points;
  }
}

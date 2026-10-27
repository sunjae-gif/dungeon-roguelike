// F016 창 맞춤 확대: 기준 해상도 화면을 창에 맞춰 비율을 유지한 채 확대·축소한다
export interface Size {
  width: number;
  height: number;
}

// 규칙 5, 6: 창에 맞는 배율. 정수 배(2배 이상)를 담을 수 있으면 정수 배율
export function computeScale(window: Size, base: Size, preferInteger: boolean): number {
  const fit = Math.min(window.width / base.width, window.height / base.height);
  const whole = Math.floor(fit);
  return preferInteger && whole >= 2 ? whole : fit;
}

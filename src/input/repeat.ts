// F002 키를 누르고 있을 때: 정해진 간격마다 같은 입력을 다시 넣는다. 규칙 코드는 반복 여부를 모른다.
import { tileIndex, type RunState } from '../core/state';

interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

const browserTimers: Timers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
};

export class KeyRepeater {
  private held: string | null = null;
  private timer: unknown = null;

  constructor(
    private readonly intervalMs: number,
    private readonly timers: Timers = browserTimers,
  ) {}

  // 새로 눌린 키. fire는 입력을 한 번 넣고, 반복을 이어가도 되면 true를 돌려준다.
  // 두 키를 함께 누르면 나중에 눌린 키 하나만 처리한다.
  press(key: string, fire: () => boolean): void {
    this.cancel();
    this.held = key;
    if (!fire()) return this.cancel();
    this.timer = this.timers.setInterval(() => {
      if (!fire()) this.cancel();
    }, this.intervalMs);
  }

  release(key: string): void {
    if (this.held === key) this.cancel();
  }

  // 반복을 멈춘다. 다시 움직이려면 키를 뗐다 다시 눌러야 한다.
  cancel(): void {
    if (this.timer !== null) this.timers.clearInterval(this.timer);
    this.timer = null;
    this.held = null;
  }
}

function visibleMonsterIds(state: RunState): Set<number> {
  const { floor } = state;
  return new Set(floor.actors.filter((a) => floor.visible[tileIndex(floor, a.x, a.y)]).map((a) => a.id));
}

// F002 반복을 멈추는 경우: 무효 이동, 피해, 이전 턴에 안 보이던 몬스터가 보임 (playing이 아니게 된 경우도)
export function shouldStopRepeat(prev: RunState, next: RunState): boolean {
  if (next.phase !== 'playing') return true;
  if (next.turn === prev.turn) return true;
  if (next.player.hp < prev.player.hp) return true;
  const before = visibleMonsterIds(prev);
  return [...visibleMonsterIds(next)].some((id) => !before.has(id));
}

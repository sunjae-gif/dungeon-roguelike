// F002 키를 누르고 있을 때: 정해진 간격마다 같은 입력을 다시 넣는다. 규칙 코드는 반복 여부를 모른다.
import { isClosedDoor } from '../core/doors';
import { DIRECTION_DELTAS, objectAt } from '../core/movement';
import { type RunState, tileIndex } from '../core/state';
import { trapAt } from '../core/traps';
import type { PlayerInput } from '../core/turn';

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
  // repeated: 처음 누른 입력이 아니라 반복으로 넣는 입력인가 (F010 규칙 18)
  // 두 키를 함께 누르면 나중에 눌린 키 하나만 처리한다.
  press(key: string, fire: (repeated: boolean) => boolean): void {
    this.cancel();
    this.held = key;
    if (!fire(false)) return this.cancel();
    this.timer = this.timers.setInterval(() => {
      if (!fire(true)) this.cancel();
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
  // F010 규칙 18: 문을 연 턴이면 멈춘다 (문 너머로 이어 가지 않는다)
  const closedBefore = prev.floor.objects.filter(isClosedDoor).length;
  if (next.floor.objects.filter(isClosedDoor).length < closedBefore) return true;
  const before = visibleMonsterIds(prev);
  return [...visibleMonsterIds(next)].some((id) => !before.has(id));
}

// F010 규칙 18: 반복 이동 중 다음 칸이 함정이나 닫힌 문이면 그 앞에서 멈춘다 (일부러 밟거나 열려면 다시 누른다)
export function blocksRepeatedStep(state: RunState, input: PlayerInput): boolean {
  if (input.type !== 'direction') return false;
  const d = DIRECTION_DELTAS[input.direction];
  const x = state.player.x + d.x;
  const y = state.player.y + d.y;
  return trapAt(state.floor, x, y) !== undefined || isClosedDoor(objectAt(state.floor, x, y));
}

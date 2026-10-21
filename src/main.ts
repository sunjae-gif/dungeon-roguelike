// 진입점. 데이터 검사 → 화면과 입력 연결.
import { transition, createTitleState, type FlowEvent } from './core/flow';
import type { RunState } from './core/state';
import { playTurn, type PlayerInput } from './core/turn';
import { loadGameData } from './data/load';
import type { GameData } from './data/types';
import type { DevMode } from './dev/devMode';
import { keyToCommand, type Command } from './input/keys';
import { KeyRepeater, shouldStopRepeat } from './input/repeat';
import { renderScreen } from './render/screen';

// 판 시드를 새로 뽑는 유일한 곳 (30-systems/rng.md 규칙 3)
function newRunSeed(): number {
  return Date.now() >>> 0;
}

function toFlowEvent(command: Exclude<Command, { type: 'player' }>): FlowEvent {
  switch (command.type) {
    case 'newGame':
    case 'restart':
      return { type: command.type, seed: newRunSeed() };
    default:
      return command;
  }
}

function showDataErrors(errors: string[]): void {
  console.error(`데이터 검사 실패 (${errors.length}건)\n${errors.join('\n')}`);
  const box = document.createElement('div');
  box.id = 'data-errors';
  box.textContent = `데이터 검사 실패. 게임을 시작하지 않습니다.\n\n${errors.join('\n')}`;
  document.body.append(box);
}

function start(data: GameData): void {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;

  let state: RunState = createTitleState(data);
  let dev: DevMode | null = null;
  let introTimer: ReturnType<typeof setTimeout> | undefined;

  const draw = () => renderScreen(ctx, state, data);

  const dispatch = (event: FlowEvent) => {
    const next = transition(state, event, data);
    if (next === state) return;
    state = next;
    onStateChange();
  };

  const play = (input: PlayerInput) => {
    const next = playTurn(state, input, data);
    if (next !== state) {
      state = next;
      onStateChange();
    }
  };

  // F002 키를 누르고 있을 때
  const repeater = new KeyRepeater(data.ui.input.keyRepeatIntervalMs);

  const onStateChange = () => {
    draw();
    dev?.update(state);
    // floorIntro는 시간이 지나면 playing으로 (game-flow.md 규칙 4)
    clearTimeout(introTimer);
    if (state.phase === 'floorIntro') {
      const introState = state;
      introTimer = setTimeout(() => {
        if (state === introState) dispatch({ type: 'introDone' });
      }, data.ui.floorIntroMs);
    }
  };

  window.addEventListener('keydown', (e) => {
    // F002: 브라우저의 키 반복은 쓰지 않는다
    if (e.repeat) return;
    if (dev?.handleKey(e)) {
      repeater.cancel();
      return;
    }
    const command = keyToCommand(state.phase, e.key);
    if (!command) return;
    e.preventDefault();
    if (command.type === 'player') {
      const { input } = command;
      repeater.press(e.code, () => {
        const prev = state;
        play(input);
        return !shouldStopRepeat(prev, state);
      });
    } else {
      dispatch(toFlowEvent(command));
    }
  });
  window.addEventListener('keyup', (e) => repeater.release(e.code));
  window.addEventListener('blur', () => repeater.cancel());

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  };
  window.addEventListener('resize', resize);
  resize();

  // F012: 개발 서버에서만 켜진다. 배포 빌드에서는 이 블록과 dev/ 코드가 빠진다.
  if (import.meta.env.DEV) {
    void import('./dev/devMode').then(({ installDevMode }) => {
      dev = installDevMode(() => state);
      dev.update(state);
    });
  }
}

const result = loadGameData();
if (result.ok) start(result.data);
else showDataErrors(result.errors);

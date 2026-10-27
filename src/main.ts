// 진입점. 데이터 검사 → 화면과 입력 연결.
import { createTitleState, type FlowEvent, transition } from './core/flow';
import type { RunState } from './core/state';
import { type PlayerInput, playTurn } from './core/turn';
import { loadGameData } from './data/load';
import type { GameData } from './data/types';
import type { DevMode } from './dev/devMode';
import { type Command, keyToCommand } from './input/keys';
import { blocksRepeatedStep, KeyRepeater, shouldStopRepeat } from './input/repeat';
import { loadFont } from './render/font';
import { computeLayout } from './render/layout';
import { computeScale } from './render/scale';
import { type RenderContext, renderScreen } from './render/screen';
import { browserImageLoader, SpriteBook } from './render/sprites';

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
  // F007 규칙 1: 캔버스는 기준 해상도로 그린다. F016: 창에 맞춰 CSS로 확대·축소
  const layout = computeLayout(data);
  const stage = document.createElement('div');
  stage.id = 'stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel';
  canvas.width = layout.canvas.width;
  canvas.height = layout.canvas.height;
  stage.append(canvas);
  document.body.append(stage);
  const fitToWindow = () => {
    const scale = computeScale({ width: window.innerWidth, height: window.innerHeight }, layout.canvas, data.ui.scaling.preferInteger);
    stage.style.width = `${layout.canvas.width * scale}px`;
    stage.style.height = `${layout.canvas.height * scale}px`;
  };
  window.addEventListener('resize', fitToWindow);
  fitToWindow();

  let state: RunState = createTitleState(data);
  let dev: DevMode | null = null;
  let introTimer: ReturnType<typeof setTimeout> | undefined;

  const baseUrl = import.meta.env.BASE_URL;
  const rc: RenderContext = {
    ctx: canvas.getContext('2d')!,
    data,
    layout,
    sprites: new SpriteBook(data.sprites, data.ui.colors.missingSprite, browserImageLoader(baseUrl, () => draw())),
    extraStatus: [],
  };
  const draw = () => {
    rc.extraStatus = dev?.statusLines(state) ?? [];
    renderScreen(rc, state);
  };
  loadFont(data.ui, baseUrl, () => draw());

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
    if (command.type === 'player' && command.input.type !== 'direction' && command.input.type !== 'rest') {
      // 내려가기·아이템 사용은 반복하지 않는다 (F002의 반복은 이동·쉬기)
      play(command.input);
    } else if (command.type === 'player') {
      const { input } = command;
      repeater.press(e.code, (repeated) => {
        if (repeated && blocksRepeatedStep(state, input)) return false;
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

  draw();

  // F012: 개발 서버에서만 켜진다. 배포 빌드에서는 이 블록과 dev/ 코드가 빠진다.
  if (import.meta.env.DEV) {
    void import('./dev/devMode').then(({ installDevMode }) => {
      dev = installDevMode({
        data,
        getState: () => state,
        setState: (next) => {
          state = next;
          onStateChange();
        },
      });
      dev.update(state);
      draw();
    });
  }
}

const result = loadGameData();
if (result.ok) start(result.data);
else showDataErrors(result.errors);

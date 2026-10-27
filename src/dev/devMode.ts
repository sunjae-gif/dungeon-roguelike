// F012 개발자 모드. main.ts가 import.meta.env.DEV일 때만 불러온다.
// 창 열고 닫기, 시드 표시, 시드로 시작, 층 이동, 지도 공개, 아이템 생성, 상태 내보내기·불러오기
// (무적은 아직 없다)
import { formatSeed, parseSeed } from '../core/rng';
import type { RunState } from '../core/state';
import type { GameData } from '../data/types';
import type { TextLine } from '../render/view';
import { type DevResult, grantItem, jumpToFloor, loadState, revealMap, startWithSeed } from './commands';

const TOGGLE_KEY = '`';

export interface DevMode {
  // 개발자 모드가 처리한 키면 true. 그러면 게임 입력으로 넘기지 않는다.
  handleKey(e: KeyboardEvent): boolean;
  update(state: RunState): void;
  // F012 시드 표시: 상태창 맨 아래에 붙일 줄
  statusLines(state: RunState): TextLine[];
}

const STYLE = `
#dev-panel { position: fixed; top: 32px; right: 8px; width: 360px; font: 13px monospace; color: #ddd;
  background: rgba(20,20,30,.95); border: 1px solid #555; padding: 10px; display: none; }
#dev-panel.open { display: block; }
#dev-title-seed { position: fixed; bottom: 16px; left: 16px; font: 13px monospace; color: #ddd; display: none; }
#dev-title-seed.show { display: block; }
#dev-panel h2 { font-size: 14px; margin: 0 0 8px; }
#dev-panel button { font: inherit; margin-bottom: 6px; }
#dev-panel textarea { width: 100%; height: 120px; box-sizing: border-box; font: 11px monospace; }
#dev-panel input { font: inherit; width: 160px; }
#dev-panel .row { margin-bottom: 6px; }
#dev-panel [data-result] { color: #9cf; min-height: 1em; }
`;

export interface DevHost {
  data: GameData;
  getState(): RunState;
  setState(state: RunState): void;
}

export function installDevMode(host: DevHost): DevMode {
  const { data, getState } = host;
  const textColor = data.ui.colors.text;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);

  // F012: 개발자 창
  const panel = document.createElement('div');
  panel.id = 'dev-panel';
  panel.innerHTML = `
    <h2>개발자 모드 (\` 로 닫기)</h2>
    <div>시드: <span data-seed></span></div>
    <div data-result></div>
    <hr>
    <div class="row"><input data-seed-in placeholder="시드 (16진수)"> <button data-seed-go>시드로 시작</button></div>
    <div class="row"><input data-floor-in placeholder="층 (1~${data.dungeon.maxFloor})"> <button data-floor-go>층 이동</button></div>
    <div class="row"><input data-item-in list="dev-items" placeholder="아이템 id"> <button data-item-go>아이템 생성</button></div>
    <datalist id="dev-items">${data.items.map((it) => `<option value="${it.id}">${it.name}</option>`).join('')}</datalist>
    <div class="row"><button data-reveal>지도 공개</button></div>
    <hr>
    <button data-export>상태 내보내기</button> <button data-load>상태 불러오기</button>
    <textarea data-export-out placeholder="상태 JSON (불러오기는 여기에 붙여 넣기)"></textarea>
  `;
  document.body.append(panel);

  // F016 타이틀 화면: 개발자 모드면 시드 입력 칸
  const titleSeed = document.createElement('div');
  titleSeed.id = 'dev-title-seed';
  titleSeed.innerHTML = '시드 <input data-title-seed placeholder="16진수"> <button>이 시드로 시작</button>';
  document.body.append(titleSeed);
  const titleSeedInput = titleSeed.querySelector('input') as HTMLInputElement;
  // 입력 칸에 친 글자가 게임 입력(Enter: 새 게임)으로 넘어가지 않게
  titleSeedInput.addEventListener('keydown', (e) => e.stopPropagation());
  titleSeed.querySelector('button')!.addEventListener('click', () => {
    const seed = parseSeed(titleSeedInput.value);
    if (seed === null) return;
    const started = startWithSeed(data, seed);
    if (started.ok) host.setState(started.state);
  });
  const seedText = panel.querySelector('[data-seed]') as HTMLElement;
  const exportOut = panel.querySelector('[data-export-out]') as HTMLTextAreaElement;
  const resultText = panel.querySelector('[data-result]') as HTMLElement;
  const input = (name: string) => (panel.querySelector(`[data-${name}-in]`) as HTMLInputElement).value;
  const on = (name: string, run: () => DevResult) =>
    panel.querySelector(`[data-${name}]`)!.addEventListener('click', () => {
      const result = run();
      if (result.ok) host.setState(result.state);
      resultText.textContent = result.ok ? result.note : `실패: ${result.error}`;
    });

  on('seed-go', () => {
    const seed = parseSeed(input('seed'));
    return seed === null ? { ok: false, error: '16진수 8자리 이하' } : startWithSeed(data, seed);
  });
  on('floor-go', () => jumpToFloor(getState(), data, Number(input('floor'))));
  on('item-go', () => grantItem(getState(), data, input('item')));
  on('reveal', () => revealMap(getState()));
  on('load', () => loadState(exportOut.value));

  // F012: 상태 내보내기. 클립보드에 복사하고, 실패해도 글상자에서 복사할 수 있게 둔다.
  panel.querySelector('[data-export]')!.addEventListener('click', () => {
    const json = JSON.stringify(getState(), null, 2);
    exportOut.value = json;
    exportOut.select();
    navigator.clipboard?.writeText(json).catch(() => {
      console.warn('클립보드 복사 실패. 글상자에서 직접 복사하세요.');
    });
  });

  const isOpen = () => panel.classList.contains('open');

  return {
    handleKey(e) {
      if (e.key === TOGGLE_KEY) {
        e.preventDefault();
        panel.classList.toggle('open');
        return true;
      }
      return isOpen();
    },
    update(state) {
      seedText.textContent = formatSeed(state.runSeed);
      titleSeed.classList.toggle('show', state.phase === 'title');
    },
    statusLines(state) {
      return [{ text: `시드 ${formatSeed(state.runSeed)}`, color: textColor }];
    },
  };
}

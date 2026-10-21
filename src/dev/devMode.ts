// F012 개발자 모드. main.ts가 import.meta.env.DEV일 때만 불러온다.
// M0 범위: 창 열고 닫기, 시드 표시, 상태 내보내기
import { formatSeed } from '../core/rng';
import type { RunState } from '../core/state';
import type { TextLine } from '../render/view';

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
#dev-panel h2 { font-size: 14px; margin: 0 0 8px; }
#dev-panel button { font: inherit; margin-bottom: 6px; }
#dev-panel textarea { width: 100%; height: 160px; box-sizing: border-box; font: 11px monospace; }
`;

export function installDevMode(getState: () => RunState, textColor: string): DevMode {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);

  // F012: 개발자 창
  const panel = document.createElement('div');
  panel.id = 'dev-panel';
  panel.innerHTML = `
    <h2>개발자 모드 (\` 로 닫기)</h2>
    <div>시드: <span data-seed></span></div>
    <hr>
    <button data-export>상태 내보내기</button>
    <textarea data-export-out readonly placeholder="내보낸 상태 JSON"></textarea>
  `;
  document.body.append(panel);
  const seedText = panel.querySelector('[data-seed]') as HTMLElement;
  const exportOut = panel.querySelector('[data-export-out]') as HTMLTextAreaElement;

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
    },
    statusLines(state) {
      return [{ text: `시드 ${formatSeed(state.runSeed)}`, color: textColor }];
    },
  };
}

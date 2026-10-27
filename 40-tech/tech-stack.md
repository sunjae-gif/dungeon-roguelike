---
status: confirmed
---
# 기술 스택과 코드 구조

## 스택
- 언어: TypeScript
- 빌드·개발 서버: Vite
- 렌더링: HTML Canvas 2D (게임 엔진·UI 프레임워크 없음)
- 테스트: Vitest
- 실행: `npm run dev`로 로컬 확인, `npm run build`로 정적 파일 생성

외부 라이브러리를 추가할 때는 먼저 묻는다.

## 폴더 구조
```
src/
├── main.ts          # 진입점. 화면과 입력을 연결
├── core/            # 게임 규칙. 브라우저 API(DOM, Canvas)를 쓰지 않는다
│   ├── state.ts     # 게임 상태 타입 (30-systems/game-state.md)
│   ├── rng.ts       # 시드 기반 난수 (30-systems/rng.md)
│   ├── effects.ts   # 능력치 계산, 이벤트 (30-systems/effects.md)
│   ├── flow.ts      # phase 전환 (30-systems/game-flow.md)
│   ├── turn.ts      # 한 턴 처리 (30-systems/turn-order.md)
│   ├── dungeon.ts   # F001
│   ├── movement.ts  # F002
│   ├── combat.ts    # F003
│   └── ...
├── render/          # 화면 그리기. 상태를 읽기만 하고 바꾸지 않는다
│   └── sprites.ts   # sprites.json을 읽어 이미지를 불러오고, 실패하면 색 사각형
├── input/           # 키 입력을 행동(Action)으로 바꾼다
├── dev/             # 개발자 모드 (F012). 배포 빌드에서 빠진다
└── data/            # 20-data/ 파일을 불러오고 검사하는 코드
public/
└── assets/          # 그림 파일. 규격은 art-guide.md
    ├── tiles/       # 픽셀아트 타일
    ├── chars/       # 픽셀아트 캐릭터·몬스터
    ├── objects/     # 픽셀아트 상자·함정 등
    ├── items/       # 픽셀아트 아이템
    └── illust/      # 스탠딩 일러스트
tests/               # core/ 단위 테스트
```

## 구현 규칙
1. **규칙과 화면을 나눈다.** `core/`는 브라우저 없이 테스트할 수 있어야 한다.
2. **흐름은 한 방향이다.** 입력 → 행동(Action) → `core`가 새 상태 계산 → `render`가 그림.
3. **방향은 4개뿐이다.** `type Direction = 'up' | 'down' | 'left' | 'right'`. 대각선 값을 만들지 않는다.
4. **난수는 `rng.ts`로만 만든다.** `Math.random()`을 직접 쓰지 않는다. 그래야 시드로 재현과 테스트가 된다.
5. **수치는 `20-data/`에서만 가져온다.** 코드에 숫자를 직접 쓰지 않는다(0, 1 같은 자명한 값 제외).
6. **이미지는 sprites.json의 id로만 찾는다.** 코드에 이미지 경로를 쓰지 않는다.
7. 파일 하나가 300줄을 넘으면 나눌지 검토한다.

## 데이터 검사
게임을 시작할 때(그리고 테스트에서) `20-data/` 전체를 검사한다. 하나라도 틀리면 게임을 시작하지 않고 무엇이 틀렸는지 화면과 콘솔에 보여준다.
- 각 파일의 필수 필드와 값의 형식 (TypeScript 타입과 검사 함수를 함께 둔다)
- id 중복이 없는지
- 다른 파일을 가리키는 id가 실제로 있는지: 테마의 `monsterTypes`·`trapTypes`·`tiles`·`roomWeights`·`boss`, 아이템과 함정의 `sprite`
- 테마의 `floors`가 1~`maxFloor`를 빠짐없이, 겹치지 않게 덮는지
- 효과의 `type`, 이벤트 이름, 능력치 id가 effects.md 표에 있는지

## 테스트 규칙
- `core/`의 규칙은 브라우저 없이 Vitest로 테스트한다.
- 규칙 테스트에는 무작위 지도 대신 **문자로 그린 고정 지도**를 쓴다. 테스트 도우미 `parseMap()`이 아래 같은 문자열을 FloorState로 바꾼다.
  ```
  #######
  #@..+.#
  #.^.g.#
  #######
  ```
  | 문자 | 뜻 |
  |---|---|
  | `#` | 벽 |
  | `.` | 바닥 |
  | `@` | 플레이어 |
  | `+` / `'` | 닫힌 문 / 열린 문 |
  | `^` | 가시 함정 (처음부터 보임, F010) |
  | `>` | 계단 |
  | `$` | 상자 |
  | `!` | 회복 물약 |
  | 영문자 | 몬스터 (`r` rat, `g` goblin, `o` orc, `t` troll, `B` final_boss, `a` goblin_archer, `s` slime, `h` goblin_thief, `m` orc_shaman, `G` gargoyle, `k` skeleton_archer) |
  새 물체가 생기면 이 표에 문자를 추가한다.
- 생성기(F001, F009 등)는 시드 여러 개(기본 1000개)로 돌려서 조건을 확인한다.

## 이미지 파일 규칙
`40-tech/art-guide.md`를 따른다. 새 이미지를 추가하면 sprites.json에 항목을 추가한다.

## 테마 규칙
층마다 달라지는 값은 themes.json에서 읽는다. 코드에 `if (theme === 'theme_2')` 같은 분기를 쓰지 않는다(F011).

## 배포
Cloudflare Pages (무료). 빌드 명령 `npm run build`, 출력 폴더 `dist`, `main` push 시 자동 배포. 자세한 것은 F018.
저장소가 비공개라 GitHub Pages는 무료 요금제로 쓸 수 없다(GitHub Pro 필요).

## 미결정 사항
없음.

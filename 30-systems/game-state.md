---
status: confirmed
---
# 게임 상태와 물체 모델

모든 기능이 같은 상태 구조를 쓰도록 정한다. 새 기능은 이 구조에 필드를 더하는 식으로 들어온다.
필드를 추가·변경하면 이 문서를 먼저 고친다.

## 기본 원칙
1. **상태는 순수 데이터다.** 클래스 인스턴스, 함수, `Map`, `Set`, 순환 참조를 넣지 않는다. `JSON.stringify`로 그대로 저장되고 `JSON.parse`로 그대로 복원되어야 한다. (나중에 저장·이어하기를 넣을 때 이 구조가 그대로 저장 형식이 된다.)
2. **규칙 코드(`core/`)는 상태와 행동을 받아 다음 상태를 만든다.** `render/`는 상태를 읽기만 한다.
3. **정의와 인스턴스를 나눈다.** 몬스터 능력치처럼 데이터 파일에 있는 값은 상태에 복사하지 않고 `defId`로 가리킨다. 상태에는 바뀌는 값(현재 HP, 위치 등)만 둔다.
4. **모든 인스턴스는 판 안에서 겹치지 않는 숫자 `id`를 갖는다.** `RunState.nextId`에서 하나씩 꺼내 쓴다.

## 지도 위의 세 가지 층

| 층 | 담는 것 | 한 칸에 몇 개 | 예 |
|---|---|---|---|
| 칸 `tile` | 지형 | 정확히 1개 | `wall`, `floor` |
| 물체 `object` | 칸 위에 놓인 상호작용 대상 | 최대 1개 | 문, 숨은 벽, 함정, 상자, 계단, 퍼즐 장치 |
| 개체 `actor` | 스스로 행동하는 것 | 최대 1개 | 플레이어, 몬스터, 보스 |

바닥에 떨어진 아이템은 별도 목록 `items`에 둔다. 한 칸에 최대 1개이고, 물체가 있는 칸에는 놓지 않는다.

칸 종류는 `wall`, `floor` 두 개로 고정한다. 문·함정처럼 상태가 바뀌는 것은 전부 물체로 만든다.

## 상태 구조 (TypeScript 표기)

```ts
type Direction = 'up' | 'down' | 'left' | 'right';
type TileType = 'wall' | 'floor';

interface RunState {
  version: 1;               // 상태 구조 버전. 구조가 바뀌면 올린다
  runSeed: number;          // 판 시드 (30-systems/rng.md)
  rng: Record<string, number>; // 난수 흐름별 현재 내부값
  phase: Phase;             // 화면 흐름 상태 (30-systems/game-flow.md)
  floorNumber: number;      // 1~10
  turn: number;
  nextId: number;
  player: Actor;
  floor: FloorState;
  messageLog: Message[];   // 최대 ui.json `messageLogMaxStored`(100)개. 넘으면 오래된 것부터 버린다
  pendingChoice?: ItemChoice; // 빌드 아이템 고르기 대기 중 (F005). 있으면 턴 끝에 phase가 itemChoice가 된다
  runStats: { kills: number; floorsReached: number; itemsFound: number; killedBy?: string; bossKilled?: boolean }; // killedBy: 플레이어를 쓰러뜨린 원인. 몬스터 defId 또는 일시 효과 id (F006, effects.md 4절)
}

interface FloorState {
  themeId: string;
  width: number;
  height: number;
  tiles: TileType[];        // 길이 width*height. 인덱스 = y*width + x
  explored: boolean[];      // 같은 인덱스
  visible: boolean[];       // 같은 인덱스. 매 턴 다시 계산
  rooms: Room[];
  objects: MapObject[];
  actors: Actor[];          // 몬스터. 플레이어는 RunState.player
  items: FloorItem[];
}

interface Room {
  id: number;
  x: number; y: number; w: number; h: number;
  type: string;             // rooms.json의 id 또는 start/stairs/boss
  state: Record<string, unknown>; // 방 종류별 값. 보스방: { warned: boolean, sealed: boolean } (F008)
}

interface MapObject {
  id: number;
  type: string;             // 'door' | 'hiddenWall' | 'trap' | 'chest' | 'stairs' | 'sealedGate' | 퍼즐 장치 ...
  defId?: string;           // traps.json 등의 id
  x: number; y: number;
  blocksMove: boolean;
  blocksSight: boolean;
  state: Record<string, unknown>; // { open: true }, { revealed: false } 등
}

interface Actor {
  id: number;
  defId: string;            // 'player' 또는 monsters.json의 id
  x: number; y: number;
  facing: Direction;
  hp: number;
  buildItems: string[];     // 얻은 순서대로. items.json id (30-systems/effects.md)
  consumables: string[];    // 인벤토리. 플레이어만 사용
  statuses: Status[];       // 일시 효과 (effects.md 5절)
  carried?: string[];       // 몬스터가 훔친 아이템 id (effects.md steal). 죽으면 떨어뜨린다
  ai?: MonsterAi;
}

interface MonsterAi {       // 몬스터만. F004, F014
  lastSeenPlayer?: { x: number; y: number };
  noticed?: boolean;        // 플레이어가 이 몬스터를 한 번이라도 봤는가 (첫 발견 메시지, F014)
  awake?: boolean;          // ambush: 깨어났는가
  retreatedLastTurn?: boolean; // ranged: 지난 턴에 물러났는가
  fleeing?: boolean;        // flee: 도망 중인가 (HP 조건 또는 steal 성공)
  unseenTurns?: number;     // 도망 중 플레이어 시야 밖에 있던 연속 턴 수
  turnsUntilCharge?: number; // boss: 다음 힘 모으기까지 남은 자기 턴 수 (F008)
  charging?: { x: number; y: number }[]; // boss: 힘을 모은 상태. 다음 자기 턴에 강타할 칸들 (화면에 표시)
  enraged?: boolean;        // boss: 2단계에 들어갔는가
}

interface ItemChoice {      // F005
  source: 'chest' | 'secret' | 'puzzle';
  options: string[];        // items.json id. 서로 다르고, 플레이어가 이미 가진 빌드 아이템은 없다
}

interface Status { id: string; turnsLeft: number; appliedTurn: number; } // appliedTurn: 걸린 턴. 그 턴의 마무리에서는 줄지 않는다
interface FloorItem { id: number; defId: string; x: number; y: number; }
interface Message { turn: number; text: string; }
```

## 칸이 지나갈 수 있는가
한 칸은 다음을 모두 만족할 때 이동할 수 있다.
1. 칸이 `floor`다.
2. 그 칸의 물체가 없거나 `blocksMove`가 false다.
3. 그 칸에 다른 개체가 없다. (있으면 이동 대신 공격 또는 대기)

시야를 막는지는 칸이 `wall`이거나, 물체의 `blocksSight`가 true인지로 판단한다.
이 두 판단은 각각 함수 하나(`isPassable`, `blocksSight`)에서만 한다. 다른 곳에서 따로 계산하지 않는다.

## 미결정 사항
없음. (Status의 쓰임새는 effects.md에서 정한다)

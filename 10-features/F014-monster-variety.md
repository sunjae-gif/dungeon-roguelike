---
id: F014
name: 몬스터 다양화
serves: [P3, P2, P4]
status: implemented
depends_on: [F004, F003]
data: [20-data/monsters.json, 20-data/themes.json, 20-data/statuses.json]
systems: [effects, turn-order, game-state, rng]
---
# F014 몬스터 다양화

## 목적
층마다 "어떻게 상대해야 하는지"가 다른 몬스터를 만나게 한다. 모든 몬스터가 똑같이 다가와 때리면 전투의 선택(싸울까, 피할까, 어디서 싸울까)이 단조로워진다(P2). 행동은 단순하고 일정해서, 한 번 보면 예측할 수 있어야 한다(P4).

F004는 `chase` 하나만 정했다. 이 문서는 행동 방식 3종, 몬스터 특성, 새 몬스터 6종, 출현 가중치를 더한다.

## 두 가지 장치
1. **행동 방식(`behavior`)**: 어떻게 움직이고 언제 공격하는가. monsters.json의 `behavior` 값 하나.
2. **특성**: 공격·피격·턴마다 일어나는 일. 아이템과 **같은 형식**의 `modifiers`, `triggers`를 monsters.json 항목에 직접 쓴다(effects.md 2절). **특성의 trigger는 확률을 쓸 수 없다**(`chance` 1만, effects.md 3절 규칙 7).

## 공통 규칙
1. 시야, `lastSeenPlayer`, 경로 찾기(BFS 첫 걸음, 위→오른쪽→아래→왼쪽)는 F004와 같다. 행동에 무작위 요소는 없다.
2. "멀어지는 칸 고르기"(물러나기·도망): 지금 칸에서 상하좌우로 갈 수 있는 칸 중, 플레이어와의 4방향 거리가 지금보다 커지는 칸. 그중 가장 먼 칸, 같으면 위→오른쪽→아래→왼쪽 순서.
3. **처음 발견 메시지:** 플레이어 시야에 몬스터가 처음 들어오면 "{이름}이(가) 보인다."를 남기고 `ai.noticed`를 true로 한다. 몬스터마다 한 번만. 능력치는 보여주지 않는다(F004).

## 행동 방식

### `chase` — 추적
F004 규칙 12 그대로.

### `ranged` — 원거리
필드: `attackRange`(능력치, 2 이상), `piercing`(선택, 기본 false)

"사격선": 플레이어가 몬스터와 **같은 가로줄이나 세로줄**에 있고, 거리가 `attackRange` 이하이고, 사이 칸에 벽·막힌 물체가 없다. `piercing`이 false면 사이 칸에 다른 개체도 없어야 한다.

매 턴 위에서부터 처음 맞는 것 하나만 한다.
1. 플레이어가 상하좌우로 인접하고, **지난 턴에 물러나지 않았고**, 멀어지는 칸이 있다 → 그 칸으로 물러난다. `ai.retreatedLastTurn = true`.
2. 플레이어가 상하좌우로 인접하다 → 근접 공격. (물러난 다음 턴이거나 물러날 곳이 없을 때)
3. 플레이어를 보고 있고 사격선이 있다 → 그 자리에서 공격.
4. 플레이어를 보고 있다 → **사격 위치**로 한 칸 움직인다. 사격 위치 = 플레이어와 사격선이 생기는 바닥 칸. 그중 BFS 거리가 가장 가까운 칸을 고르고, 같으면 위→오른쪽→아래→왼쪽 순서로 첫 걸음을 정한다. 갈 수 있는 사격 위치가 없으면 `chase`처럼 다가간다.
5. 그 밖 → `chase`의 3, 4 (마지막 목격 위치로, 아니면 대기)

1번 외의 경우 `ai.retreatedLastTurn = false`로 한다.
→ 물러나기는 두 턴에 한 번만 한다. 플레이어가 붙어서 따라가면 다음 턴에는 반드시 근접전이 된다(끝없이 끌려다니지 않는다).

원거리 공격의 피해 계산은 근접과 같다(F003, effects.md 4절). 대각선으로는 쏘지 않는다.
원거리 공격 메시지: "{몬스터}의 화살에 {피해} 피해를 받았다." (문구는 몬스터 항목의 `attackVerb`로 바꿀 수 있다. 예: 주술사 "{몬스터}의 저주에")

### `flee` — 겁쟁이
필드: `fleeHpRatio`(0~1), `vanishWhenUnseen`(선택, 턴 수)

1. 다음 중 하나면 도망 상태(`ai.fleeing = true`)가 된다. 한번 도망 상태가 되면 풀리지 않는다.
   - HP가 최대 HP × `fleeHpRatio` 이하
   - `steal` 효과로 아이템을 훔쳤다 (effects.md)
2. 도망 상태가 아니면 `chase`.
3. 도망 상태면:
   1. 멀어지는 칸이 있으면 그 칸으로 움직인다.
   2. 없고 플레이어가 인접하면 공격한다(궁지에 몰린 쥐).
   3. 그 밖에는 제자리.
4. `vanishWhenUnseen`이 있는 몬스터는, 도망 상태에서 플레이어 시야 밖에 연속으로 그 턴 수만큼 있으면 층에서 사라진다. 갖고 있던 `carried`도 함께 사라진다. 메시지: "{몬스터}이(가) 훔친 물건과 함께 달아났다." (`carried`가 비어 있으면 "{몬스터}이(가) 달아났다.")

### `ambush` — 매복
필드: `placement: "chokepoint"` (배치 규칙, 아래)

1. 깨어나기 전(`ai.awake`가 false)에는 플레이어가 보여도 움직이지 않는다.
2. 다음 중 하나면 깨어난다(`ai.awake = true`):
   - 자기 차례에 플레이어가 상하좌우로 인접해 있다 → 깨어나면서 바로 공격한다.
   - 피해를 받았다.
3. 깨어난 뒤로는 `chase`.

## 배치

1. **출현 가중치:** themes.json의 `monsterTypes`를 목록에서 가중치 객체로 바꾼다. 종류는 가중치 비율로 고른다(`spawn` 흐름). F004 규칙 1의 "같은 확률"을 대신한다.
   ```json
   "monsterTypes": { "rat": 5, "goblin": 4, "slime": 2, "goblin_archer": 1 }
   ```
2. **`placement: "chokepoint"`** 몬스터는 방의 입구(방 바깥 바닥과 맞닿은 방 안 칸) 옆 칸에 놓는다. 입구 칸 자체는 막지 않는다. 그런 칸이 없으면 F004의 일반 규칙대로 놓는다. 입구를 지나가려면 옆을 스칠 수밖에 없어서, 그냥 돌아가 피할 수 없게 된다.
3. 나머지는 F004 배치 규칙 그대로.

## 몬스터 목록
수치는 모두 임시값이다. 굵게 쓴 것이 새 몬스터.

| id | 이름 | HP | 공격 | 방어 | behavior | 사거리 | 특성 | 상대하는 법 |
|---|---|---|---|---|---|---|---|---|
| `rat` | 쥐 | 4 | 3 | 0 | chase | 1 | — | 약하다 |
| `goblin` | 고블린 | 8 | 4 | 1 | chase | 1 | — | 기본 근접 |
| **`goblin_archer`** | **고블린 궁수** | 6 | 3 | 0 | ranged | 3 | — | 줄을 피해 다가가 붙는다 |
| **`slime`** | **슬라임** | 12 | 2 | 0 | chase | 1 | 공격이 맞으면 3턴 `weak` | 맞지 말고 먼저 친다 |
| **`goblin_thief`** | **고블린 도둑** | 7 | 2 | 1 | flee (0.5, 5턴 뒤 사라짐) | 1 | 공격이 맞으면 `steal` | 쫓을지 포기할지 고른다 |
| `orc` | 오크 | 15 | 6 | 2 | chase | 1 | — | 강한 근접 |
| **`orc_shaman`** | **오크 주술사** | 10 | 4 | 1 | ranged | 4 | 공격이 맞으면 2턴 `weak` | 다른 몬스터 뒤에 서면 위험 |
| **`gargoyle`** | **가고일** | 20 | 7 | 5 | ambush (chokepoint) | 1 | — | 입구를 지날 각오를 한다 |
| `troll` | 트롤 | 25 | 8 | 3 | chase | 1 | 턴 끝마다 HP 1 재생 | 오래 끌면 불리하다 |
| **`skeleton_archer`** | **해골 궁수** | 9 | 5 | 1 | ranged (관통) | 5 | — | 몬스터 뒤에 숨어도 쏜다 |

### monsters.json 예시
```json
{ "id": "slime", "name": "슬라임", "maxHp": 12, "attack": 2, "defense": 0, "behavior": "chase",
  "triggers": [ { "event": "onHit", "chance": 1,
    "effects": [ { "type": "applyStatus", "target": "other", "status": "weak", "turns": 3 } ] } ] }

{ "id": "goblin_thief", "name": "고블린 도둑", "maxHp": 7, "attack": 2, "defense": 1,
  "behavior": "flee", "fleeHpRatio": 0.5, "vanishWhenUnseen": 5,
  "triggers": [ { "event": "onHit", "chance": 1, "effects": [ { "type": "steal", "target": "other" } ] } ] }

{ "id": "skeleton_archer", "name": "해골 궁수", "maxHp": 9, "attack": 5, "defense": 1,
  "behavior": "ranged", "attackRange": 5, "piercing": true }

{ "id": "troll", "name": "트롤", "maxHp": 25, "attack": 8, "defense": 3, "behavior": "chase",
  "triggers": [ { "event": "onTurnEnd", "chance": 1, "effects": [ { "type": "heal", "target": "self", "amount": 1 } ] } ] }
```

### 테마별 출현 가중치
| 테마 | monsterTypes |
|---|---|
| theme_1 (1~3층) | rat 5, goblin 4, slime 2, goblin_archer 1 |
| theme_2 (4~6층) | goblin 4, orc 3, goblin_archer 2, goblin_thief 2, orc_shaman 1 |
| theme_3 (7~9층) | orc 3, troll 2, orc_shaman 2, gargoyle 2, skeleton_archer 2 |
| theme_boss (10층) | troll 1 |

### 일시 효과 (statuses.json 신규)
| id | 이름 | 효과 |
|---|---|---|
| `weak` | 약화 | attack −2 |
| `poison` | 중독 | 턴 끝마다 1 피해 (방어 무시). F015 독 바른 칼이 쓴다 |

형식은 effects.md 5절.

## 화면
- 플레이어에게 걸린 일시 효과를 상태창에 "약화 (2턴)"처럼 보여준다(F007 상태창 아래쪽, 빌드 아이템 목록 위).
- 몬스터마다 sprites.json에 `fallbackColor`가 서로 다른 항목을 둔다. 이미지가 없어도 색으로 구별된다.

## 데이터 검사에 추가할 것
- `behavior`는 `chase`, `ranged`, `flee`, `ambush` 중 하나
- `ranged`면 `attackRange` 2 이상, `flee`면 `fleeHpRatio`(0~1) 필수
- `placement`는 `room`(기본), `chokepoint` 중 하나
- 몬스터 trigger의 `chance`는 1
- themes.json `monsterTypes`는 { monsters.json id: 양의 정수 } 객체

## 구현 순서
1. 데이터 형식: statuses.json 신규, monsters.json·themes.json 변경, 데이터 검사
2. effects.md 확장분 (출처 3종, `onBeforeDamaged`, 두 단계 피해, `applyStatus`, `steal`, 일시 효과 규칙)
3. 행동 방식: ranged → flee → ambush
4. 배치(가중치, chokepoint), 처음 발견 메시지, 상태창 일시 효과 표시

## 이번 버전에서 하지 않는 것
- 몬스터별 속도 (F004)
- 다른 몬스터를 부르거나 소환하는 행동
- 몬스터의 회피(확률) — 몬스터는 확률을 쓰지 않는다
- 몬스터 강함을 미리 보여주는 정보 (F004)

## 완료 기준
- [ ] 같은 줄, 사거리 안, 사이가 비어 있으면 원거리 몬스터가 그 자리에서 공격한다.
- [ ] 사이에 다른 몬스터가 있으면 일반 궁수는 쏘지 않고, 해골 궁수(관통)는 쏜다.
- [ ] 사이에 벽이 있으면 어떤 궁수도 쏘지 않는다.
- [ ] 대각선에 있는 플레이어는 원거리 몬스터도 공격하지 않는다.
- [ ] 사격선이 없으면 원거리 몬스터는 사격 위치 쪽으로 움직이고, 플레이어에게 붙으러 오지 않는다.
- [ ] 원거리 몬스터에게 붙으면 한 칸 물러난다. 플레이어가 다시 붙으면 그다음 턴에는 물러나지 않고 근접 공격한다.
- [ ] 넓은 방에서 플레이어가 원거리 몬스터를 계속 따라가면, 4턴 안에 적어도 한 번은 인접한 상태로 플레이어 차례가 온다.
- [ ] 겁쟁이 몬스터는 HP가 기준 이하가 된 다음 턴부터 플레이어와의 거리가 줄지 않는다.
- [ ] 고블린 도둑에게 맞으면 가장 나중에 얻은 소모품이 사라지고, 도둑이 도망 상태가 된다.
- [ ] 소모품이 없을 때 고블린 도둑에게 맞으면 도둑은 계속 싸운다.
- [ ] 도둑을 쓰러뜨리면 훔친 소모품이 바닥에 떨어진다.
- [ ] 도망 중인 도둑이 5턴 연속 시야 밖에 있으면 사라지고, 메시지가 남는다.
- [ ] 매복 몬스터는 플레이어가 보여도 인접하기 전까지 위치가 변하지 않는다. 피해를 받으면 깨어난다.
- [ ] 가고일은 방 입구 옆 칸에 놓인다 (그런 칸이 있을 때).
- [ ] 슬라임에게 맞으면 그다음 3턴 동안 공격이 2 낮아지고, 상태창에 "약화"가 보인다.
- [ ] 슬라임과 주술사에게 연달아 맞아도 공격 감소는 −2 한 번뿐이다.
- [ ] 트롤은 턴 끝마다 HP가 1 회복되고 최대 HP를 넘지 않는다.
- [ ] 몬스터가 처음 보이면 "{이름}이(가) 보인다." 메시지가 한 번 남는다.
- [ ] 시드 1000개로 1~3층을 생성했을 때 몬스터 종류 비율이 가중치 비율과 ±5%p 안에서 맞는다.
- [ ] 같은 상태에서 같은 행동을 반복하면 결과가 항상 같다 (무작위 없음).

## 미결정 사항
없음.

---
id: F005
name: 아이템과 빌드
serves: [P3, P2]
status: confirmed
depends_on: [F001, F002, F015]
data: [20-data/items.json, 20-data/player.json, 20-data/loot.json, 20-data/themes.json, 20-data/statuses.json]
systems: [effects, turn-order, game-flow, game-state, rng]
---
# F005 아이템과 빌드

## 목적
레벨업 대신 아이템이 캐릭터를 만든다. 판마다 손에 들어오는 아이템이 달라서 매번 다른 빌드로 플레이하게 된다(P3). 아이템을 얻을 때마다 "어느 쪽으로 키울까"를 고른다(P2).

## 정해진 것
- 성장 수단은 아이템뿐이다. 레벨·경험치는 없다.
- **빌드 아이템은 누적형이다.** 얻은 빌드 아이템은 판이 끝날 때까지 모두 효과가 있다. 장비 칸, 교체, 버리기는 없다.
- **빌드 아이템은 고르면서 얻는다.** 후보 2~3개 중 하나를 고른다. 고르지 않은 후보는 그 판의 후보 목록에 남는다.
- **한 판 안에서 같은 빌드 아이템은 한 번만 가진다.** 이미 가진 빌드 아이템은 후보로 나오지 않는다.
- 빌드 아이템은 **보물상자, 비밀방, 퍼즐방 보상으로만** 나온다. 바닥에 떨어진 아이템과 몬스터 드롭은 소모품뿐이다.
- 등급은 **일반(`common`)·희귀(`rare`)** 두 가지다.

## 소모품
1. 바닥 아이템이 있는 칸에 들어가면 자동으로 줍는다. 줍기는 턴을 쓰지 않는다.
2. 소모품은 인벤토리 칸(player.json `inventorySize`)에 들어간다. 숫자키 1~9로 쓰고, 한 턴을 쓴다.
3. 인벤토리가 꽉 차면 줍지 않고 "가방이 가득 찼다."를 남긴다. 아이템은 바닥에 남는다.
4. 소모품은 지금 회복 물약 하나뿐이다. HP가 최대일 때 쓰면 쓰이지 않고 턴도 지나가지 않는다.
5. 층마다 바닥에 소모품을 테마의 `itemCount`만큼 놓는다. 종류는 소모품의 `weight` 비율로, `loot` 난수 흐름으로 고른다. 방 안의 빈 바닥 칸에 놓고(시작방 포함), 통로와 물체·개체가 있는 칸에는 놓지 않는다.
6. **몬스터 드롭:** 몬스터를 쓰러뜨리면 loot.json `monsterDrop.chance`(8%) 확률로 `monsterDrop.item`(회복 물약)을 그 칸에 떨어뜨린다. 보스는 드롭하지 않는다. 이 확률은 플레이어 보상이라 "몬스터는 확률을 쓰지 않는다"(effects.md 3절 규칙 7)와 부딪히지 않는다. 처치 원인(공격·중독·가시)과 상관없다.

## 보물상자
7. 상자(`chest`)는 칸 위의 물체다. 닫혀 있으면 지나갈 수 없다(`blocksMove: true`, 시야는 막지 않음).
8. 상자 쪽으로 방향 입력을 하면 상자를 연다(`interact`, 한 턴). 연 상자는 빈 상자 그림으로 남고 지나갈 수 있게 된다.
9. 상자를 열면 `pendingChoice`가 생기고, 턴이 끝날 때 `itemChoice` 화면이 된다(game-flow.md).
10. **1~9층에는 층마다 보물상자방이 최소 1개 있다.** 시작방·계단방이 아닌 방 하나를 보물상자방으로 정하고, 그 방의 가운데에 가장 가까운 빈 바닥 칸에 상자를 하나 놓는다. 방 고르기에는 `rooms` 난수 흐름을 쓴다.
    - M3에서는 이 규칙만 구현한다. 보물상자방을 가중치로 더 만드는 것(층당 최대 2개)은 F009(M4)가 한다.
    - 보물상자방에도 몬스터는 일반 방처럼 놓인다.
11. 10층(보스층)에는 보물상자방이 없다.

## 빌드 아이템 고르기
12. 후보 만들기 (`loot` 난수 흐름):
    1. 후보 수와 등급 규칙은 얻는 곳마다 다르다(아래 표).
    2. 후보 칸마다 테마의 `rareChance` 확률로 희귀, 아니면 일반을 정한다.
    3. 정한 등급에서, 플레이어가 아직 갖지 않았고 이번 후보에 아직 없는 아이템 중 하나를 `weight` 비율로 고른다.
    4. 그 등급에 남은 아이템이 없으면 다른 등급에서 고른다.
    5. 두 등급 모두 남은 아이템이 없으면 그 칸은 비운다. 후보가 하나도 없으면 고르기 화면 없이 loot.json `exhaustedReward`(회복 물약 2개)를 바로 준다. 인벤토리에 자리가 없으면 상자 칸 옆 빈 바닥에 떨어뜨린다.

    | 얻는 곳 | 후보 수 | 등급 | 구현 |
    |---|---|---|---|
    | 보물상자 | 3 | 테마 `rareChance` | M3 |
    | 비밀방 보상 | 2 | 모두 희귀 (희귀가 모자라면 일반) | M4 (F009) |
    | 퍼즐방 보상 | 3 | 테마 `rareChance` | M4 (F009) |

13. `itemChoice` 화면: 지도 위에 후보를 번호와 함께 보여준다. 각 후보는 이름, 등급, `description`. 숫자키로 고른다. 건너뛰기는 없다.
14. 고르면 그 아이템을 빌드 아이템 목록 끝에 추가하고 `onPickup`을 일으킨다. 메시지: "{아이템}을(를) 얻었다." 턴은 쓰지 않는다.
15. 빌드 아이템으로 최대 HP가 늘면 현재 HP도 같은 만큼 는다. (줄어들 때는 effects.md 규칙대로 최대 HP에 맞춘다)

## 빌드 아이템 목록 (20종)
수치는 모두 임시값이다. F015의 9종에 단순 능력치·보조 아이템 11종을 더했다.

| id | 이름 | 등급 | 효과 | 출처 |
|---|---|---|---|---|
| `leather_gloves` | 가죽 장갑 | 일반 | 공격 +1 | 신규 |
| `iron_shield` | 철 방패 | 일반 | 방어 +1 | 신규 |
| `sturdy_heart` | 튼튼한 심장 | 일반 | 최대 HP +6 | 신규 |
| `owl_eye` | 올빼미 눈 | 일반 | 시야 +2 | 신규 |
| `berserker_belt` | 광전사의 띠 | 일반 | 공격 +2, 방어 −1 | 신규 |
| `turtle_shell` | 거북 등껍질 | 일반 | 방어 +2, 공격 −1 | 신규 |
| `chain_vest` | 사슬 조끼 | 일반 | 방어 +1, 최대 HP +3 | 신규 |
| `explorer_boots` | 탐험가의 장화 | 일반 | 새 층에 들어갈 때 HP 5 회복 | 신규 |
| `purity_charm` | 정화의 부적 | 일반 | 약화·중독에 걸리지 않음 | 신규 |
| `vampire_ring` | 흡혈 반지 | 일반 | 공격이 맞으면 HP 1 회복 | F015 |
| `thorn_armor` | 가시 갑옷 | 일반 | 공격받으면 공격자에게 1 피해 | F015 |
| `warrior_crest` | 전사의 문장 | 일반 | 처치하면 HP 3 회복 | F015 |
| `spear` | 창 | 일반 | 사거리 +1 | F015 |
| `life_ring` | 생명의 반지 | 희귀 | 최대 HP +25% | 신규 |
| `blood_rage` | 분노의 피 | 희귀 | 처치하면 3턴 동안 `rage`(공격 +2) | 신규 |
| `sharp_dagger` | 날카로운 단검 | 희귀 | 25% 치명타 ×2 | F015 |
| `shadow_cloak` | 그림자 망토 | 희귀 | 20% 회피 | F015 |
| `war_hammer` | 전투 망치 | 희귀 | 맞으면 1칸 밀어냄 | F015 |
| `poison_blade` | 독 바른 칼 | 희귀 | 30% 3턴 중독 | F015 |
| `piercing_tip` | 관통 화살촉 | 희귀 | 20% 방어 무시 | F015 |

일반 13종, 희귀 7종. 한 판에 9~12개를 얻으면 전체의 절반 정도를 보게 된다.

## 데이터

### items.json에 추가하는 필드
- 모든 아이템: `description` (고르기 화면과 상태창에 쓰는 한 줄 설명)
- 빌드 아이템: `rarity` (`common` | `rare`), `weight` (기본 1)
- F015 9종에도 `rarity`, `description`을 붙인다.

```json
{ "id": "berserker_belt", "name": "광전사의 띠", "kind": "build", "rarity": "common", "weight": 1,
  "description": "공격 +2, 방어 −1",
  "modifiers": [ { "stat": "attack", "op": "add", "value": 2 }, { "stat": "defense", "op": "add", "value": -1 } ] }

{ "id": "explorer_boots", "name": "탐험가의 장화", "kind": "build", "rarity": "common", "weight": 1,
  "description": "새 층에 들어갈 때 HP 5 회복",
  "triggers": [ { "event": "onFloorEnter", "chance": 1, "effects": [ { "type": "heal", "target": "self", "amount": 5 } ] } ] }

{ "id": "purity_charm", "name": "정화의 부적", "kind": "build", "rarity": "common", "weight": 1,
  "description": "약화·중독에 걸리지 않음",
  "immunities": ["status:weak", "status:poison"] }

{ "id": "life_ring", "name": "생명의 반지", "kind": "build", "rarity": "rare", "weight": 1,
  "description": "최대 HP +25%",
  "modifiers": [ { "stat": "maxHp", "op": "mul", "value": 0.25 } ] }

{ "id": "blood_rage", "name": "분노의 피", "kind": "build", "rarity": "rare", "weight": 1,
  "description": "몬스터를 쓰러뜨리면 3턴 동안 공격 +2",
  "triggers": [ { "event": "onKill", "chance": 1,
    "effects": [ { "type": "applyStatus", "target": "self", "status": "rage", "turns": 3 } ] } ] }
```

### statuses.json에 추가
```json
{ "id": "rage", "name": "분노", "modifiers": [ { "stat": "attack", "op": "add", "value": 2 } ] }
```

### loot.json (신규)
```json
{
  "_note": "아이템을 얻는 규칙(F005). 수치는 모두 임시값.",
  "chestChoices": 3,
  "secretChoices": 2,
  "puzzleChoices": 3,
  "monsterDrop": { "item": "potion_heal", "chance": 0.08 },
  "exhaustedReward": { "item": "potion_heal", "count": 2 }
}
```

### themes.json에 추가
`rareChance`: theme_1 0.2, theme_2 0.35, theme_3 0.5, theme_boss 0 (보물상자 없음)

### 데이터 검사에 추가
- 빌드 아이템은 `rarity`, `description` 필수
- `rarity`는 `common` | `rare`
- loot.json의 item id는 items.json의 소모품
- `immunities` 값 형식 (effects.md 7절)

## 화면
- `itemChoice`: 지도 가운데에 상자를 띄우고 "1. 광전사의 띠 (일반) — 공격 +2, 방어 −1"처럼 보여준다. 희귀는 이름 색을 다르게 한다(ui.json `colors.rare` 추가).
- 상태창 빌드 아이템 목록: 이름만. (설명은 고를 때 본다)

## 완료 기준
- [ ] 바닥의 회복 물약을 밟으면 인벤토리에 들어가고 바닥에서 사라진다. 턴 수는 이동 1턴만 는다.
- [ ] 인벤토리가 가득 차면 아이템이 바닥에 남고 메시지가 나온다.
- [ ] 회복 물약 사용 후 HP가 늘고 최대 HP를 넘지 않는다. 최대 HP에서 쓰면 아이템과 턴 수가 그대로다.
- [ ] 시드 1000개로 1~9층을 만들었을 때 모든 층에 상자가 1개 이상 있고, 10층에는 없다.
- [ ] 상자를 열면 그 턴이 끝난 뒤 후보 3개가 나오고, 셋은 서로 다르며 플레이어가 가진 아이템이 없다.
- [ ] 후보를 고르면 빌드 아이템에 추가되고, 연 상자는 지나갈 수 있다.
- [ ] 고르지 않은 아이템은 다음 상자에서 다시 후보로 나올 수 있다.
- [ ] 빌드 아이템을 19개 가진 상태에서 상자를 열면 후보가 1개만 나온다. 20개를 모두 가졌으면 회복 물약 2개를 받는다.
- [ ] theme_3에서 상자 1000개의 후보 칸 중 희귀 비율이 50% ±3%p 안이다 (희귀가 모자라지 않은 상태에서).
- [ ] 튼튼한 심장을 얻으면 최대 HP와 현재 HP가 모두 6 는다.
- [ ] 정화의 부적이 있으면 슬라임에게 맞아도 약화가 걸리지 않는다.
- [ ] 몬스터 1000마리를 쓰러뜨렸을 때(시드 고정) 회복 물약 드롭 비율이 8% ±2%p 안이다.

## 이번 버전에서 하지 않는 것
- 아이템끼리의 조합 효과(시너지)를 따로 정의하기. 지금은 효과가 자연스럽게 겹치는 것(창 + 전투 망치 등)만 있다. M5 밸런스 때 다시 본다.
- 회복 물약 말고 다른 소모품. M4 이후에 정한다.
- 빌드 아이템 버리기·교체

## 미결정 사항
없음.

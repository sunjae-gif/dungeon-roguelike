---
status: confirmed
---
# 효과 시스템 (능력치 보정과 이벤트)

## 목적
빌드 아이템이 능력치와 전투 규칙을 바꿀 수 있게 하는 공통 장치.
**어떤 아이템을 만들지는 아직 정하지 않았다(F005).** 이 문서는 아이템 효과가 끼어들 자리와 형식만 정한다.
목표: 새 빌드 아이템은 items.json에 항목만 추가하면 되고, 전투·이동 코드를 고치지 않아도 된다.

## 1. 능력치

### 능력치 목록
| id | 이름 | 기본값 출처 |
|---|---|---|
| `maxHp` | 최대 HP | player.json / monsters.json |
| `attack` | 공격 | 〃 |
| `defense` | 방어 | 〃 |
| `sightRadius` | 시야 | player.json (플레이어 전용. 몬스터 시야는 monsters.json `monsterSightRadius` 고정값, F004 규칙 7) |

능력치를 추가할 때는 이 표와 player.json, monsters.json에 함께 추가한다.
몬스터에게 `getStat(monster, 'sightRadius')`는 쓰지 않는다.

### 계산 순서
```
최종값 = floor( (기본값 + 더하기 보정의 합) × (1 + 곱하기 보정의 합) )
```
- 더하기 보정(`add`)을 모두 더한 뒤, 곱하기 보정(`mul`)을 적용한다. 곱하기 보정은 서로 더한다(0.2 + 0.3 = ×1.5).
- 결과가 정해진 최솟값보다 작으면 최솟값으로 한다: `maxHp` 1, `attack` 0, `defense` 0, `sightRadius` 1.
- 최종 능력치는 상태에 저장하지 않는다. 필요할 때 `getStat(actor, statId)` 함수 하나로 계산한다.
- `maxHp`가 줄어 현재 HP가 최대 HP보다 커지면 현재 HP를 최대 HP로 낮춘다.

### 보정의 출처
- 빌드 아이템의 `modifiers`
- 일시 효과(`statuses`)의 `modifiers` — 지금은 쓰는 곳 없음

## 2. 이벤트

게임 중 정해진 시점에 이벤트가 발생하고, 그 개체가 가진 빌드 아이템의 `triggers` 중 그 이벤트에 걸린 것이 실행된다.

| 이벤트 | 발생 시점 | 함께 전달되는 값 |
|---|---|---|
| `onTurnStart` | 플레이어 행동 처리 직전 | — |
| `onTurnEnd` | 모든 몬스터 행동이 끝난 뒤 | — |
| `onMove` | 개체가 한 칸 이동한 직후 | from, to |
| `onBeforeAttack` | 공격 피해 계산 직전 | attacker, target, damage(수정 가능) |
| `onHit` | 공격자가 피해를 준 직후 | attacker, target, damage |
| `onDamaged` | 피해를 받은 직후 (공격·함정 모두) | source, damage |
| `onKill` | 공격자가 대상을 쓰러뜨린 직후 | attacker, target |
| `onPickup` | 아이템을 주운 직후 | itemId |
| `onFloorEnter` | 새 층에 들어온 직후 | floorNumber |
| `onTrapTriggered` | 함정이 발동한 직후 | trapId |

### 처리 규칙
1. 한 이벤트에 여러 아이템이 걸리면 **아이템을 얻은 순서대로** 실행한다.
2. `onBeforeAttack`의 피해 값은 앞 아이템이 바꾼 값을 다음 아이템이 이어받는다.
3. 효과가 다른 이벤트를 일으킬 수 있다(예: 흡혈 회복). 이렇게 이어지는 깊이는 최대 3단계로 제한한다. 넘으면 더 실행하지 않고 개발자 콘솔에 경고를 남긴다.
4. 이벤트는 플레이어와 몬스터 모두에게 발생한다. 지금은 몬스터에게 빌드 아이템이 없으므로 실제로는 플레이어만 해당한다.

## 3. 피해 처리 순서 (F003이 따른다)
1. `onBeforeAttack` (공격자의 아이템) — 피해 기본값 = 공격자 attack − 대상 defense
2. 피해에 최솟값 1 적용
3. 대상 HP 감소
4. `onHit` (공격자), `onDamaged` (대상)
5. 대상 HP가 0 이하면 `onKill` (공격자), 대상 제거 또는 게임 오버

## 4. 데이터 형식 (items.json)

```json
{
  "id": "example_vampire_ring",
  "name": "예시: 흡혈 반지",
  "kind": "build",
  "modifiers": [
    { "stat": "attack", "op": "add", "value": 1 }
  ],
  "triggers": [
    {
      "event": "onHit",
      "chance": 1.0,
      "effects": [ { "type": "heal", "target": "self", "amount": 2 } ]
    }
  ]
}
```
위 아이템은 형식 설명용 예시다. 실제 데이터에는 넣지 않는다.

### 효과 종류 (effects의 type)
처음에는 아래만 만든다. 새 종류가 필요하면 이 표에 먼저 추가한다.

| type | 하는 일 | 필드 |
|---|---|---|
| `heal` | HP 회복 (최대 HP를 넘지 않음) | target, amount |
| `damage` | 피해 (방어 무시) | target, amount |
| `modifyDamage` | `onBeforeAttack`에서 피해 값 변경 | op(add/mul), value |
| `message` | 메시지 로그에 문구 추가 | text |

- `target`: `self`(아이템 주인) 또는 `other`(이벤트의 상대: 공격 대상, 공격자 등)
- `chance`: 0~1. 1이 아니면 `combat` 난수 흐름을 쓴다(30-systems/rng.md).
- 소모품도 같은 효과 종류를 쓴다: `{ "kind": "consumable", "use": { "effects": [...] } }`

## 완료 기준
- [ ] attack 기본값 5에 add +2, mul +0.5 보정이 있으면 최종 attack은 10이다.
- [ ] 보정 때문에 defense가 음수가 되면 0으로 계산된다.
- [ ] 테스트용 아이템(onHit → heal 2)을 가진 플레이어가 공격에 성공하면 HP가 2 회복된다.
- [ ] `onBeforeAttack`에 피해 ×2 아이템과 +1 아이템이 순서대로 있으면, 기본 피해 3은 7이 된다.
- [ ] 스스로를 계속 다시 일으키는 효과를 만들어도 3단계에서 멈춘다.
- [ ] 전투·이동 코드에 특정 아이템 id가 나오지 않는다.

## 미결정 사항
없음. 실제 아이템 목록과 빌드 방향은 F005에서 정한다.

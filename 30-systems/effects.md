---
status: confirmed
---
# 효과 시스템 (능력치 보정과 이벤트)

## 목적
빌드 아이템, 몬스터 특성, 일시 효과가 능력치와 전투 규칙을 바꿀 수 있게 하는 공통 장치.
목표: 새 아이템·몬스터 능력·일시 효과는 데이터 항목만 추가하면 되고, 전투·이동 코드를 고치지 않아도 된다.
실제 아이템 목록은 F005·F015, 몬스터 특성은 F014에서 정한다.

## 1. 능력치

### 능력치 목록
| id | 이름 | 기본값 출처 | 최솟값 |
|---|---|---|---|
| `maxHp` | 최대 HP | player.json / monsters.json | 1 |
| `attack` | 공격 | 〃 | 0 |
| `defense` | 방어 | 〃 | 0 |
| `attackRange` | 사거리 | 〃 (몬스터 항목에 없으면 1) | 1 |
| `sightRadius` | 시야 | player.json (플레이어 전용. 몬스터 시야는 monsters.json `monsterSightRadius` 고정값, F004 규칙 7) | 1 |

- 능력치를 추가할 때는 이 표와 player.json, monsters.json에 함께 추가한다.
- 몬스터에게 `getStat(monster, 'sightRadius')`는 쓰지 않는다.
- **플레이어의 `attackRange`는 player.json `maxAttackRange`(2)를 넘지 않는다.** 사거리 아이템이 쌓여 플레이어가 궁수처럼 되는 것을 막는다(F015).

### 계산 순서
```
최종값 = floor( (기본값 + 더하기 보정의 합) × (1 + 곱하기 보정의 합) )
```
- 더하기 보정(`add`)을 모두 더한 뒤, 곱하기 보정(`mul`)을 적용한다. 곱하기 보정은 서로 더한다(0.2 + 0.3 = ×1.5).
- 결과가 최솟값보다 작으면 최솟값으로, 상한이 있으면 상한으로 한다.
- 최종 능력치는 상태에 저장하지 않는다. 필요할 때 `getStat(actor, statId)` 함수 하나로 계산한다.
- `maxHp`가 줄어 현재 HP가 최대 HP보다 커지면 현재 HP를 최대 HP로 낮춘다.

## 2. 효과의 출처

보정(`modifiers`)과 반응(`triggers`)은 세 곳에서 온다. 형식은 모두 같다(4절).

| 출처 | 어디에 적는가 | 누구에게 |
|---|---|---|
| 개체 정의 (몬스터 특성) | monsters.json 항목의 `modifiers`, `triggers`. 보스가 2단계면 `boss.enrage.modifiers`도 여기에 더한다 (F008) | 그 몬스터 (F014, F008) |
| 빌드 아이템 | items.json `kind: "build"` 항목 | 그 아이템을 가진 개체 (F005, F015) |
| 일시 효과 | statuses.json 항목 | 그 일시 효과가 걸린 개체 |

한 이벤트에 여러 출처가 걸리면 **개체 정의 → 빌드 아이템(얻은 순서) → 일시 효과(걸린 순서)** 순서로 실행한다.

## 3. 이벤트

| 이벤트 | 발생 시점 | 누구의 효과가 실행되나 | 함께 전달되는 값 |
|---|---|---|---|
| `onTurnStart` | 플레이어 행동 처리 직전 | 플레이어 | — |
| `onTurnEnd` | 모든 몬스터 행동이 끝난 뒤 | 모든 개체 (플레이어 먼저, 그다음 몬스터 id 순) | — |
| `onMove` | 개체가 한 칸 이동한 직후 | 이동한 개체 | from, to |
| `onBeforeAttack` | 공격 피해 계산 직전 | 공격자 | attacker, target, 공격 정보(수정 가능) |
| `onBeforeDamaged` | 공격을 받기 직전 (`onBeforeAttack` 뒤) | 공격 대상 | attacker, target, 공격 정보(수정 가능) |
| `onHit` | 공격자가 피해를 준 직후 | 공격자 | attacker, target, damage |
| `onDamaged` | 피해를 받은 직후 (공격·효과·함정 모두) | 피해를 받은 개체 | source(없을 수 있음), damage |
| `onKill` | 공격으로 대상을 쓰러뜨린 직후 | 공격자 | attacker, target |
| `onPickup` | 아이템을 주운 직후 | 주운 개체 | itemId |
| `onFloorEnter` | 새 층에 들어온 직후 | 플레이어 | floorNumber |
| `onTrapTriggered` | 함정이 발동한 직후 | 밟은 개체 | trapId |

### 처리 규칙
1. 실행 순서는 2절 표의 순서를 따른다.
2. 공격 정보(`onBeforeAttack`, `onBeforeDamaged`)는 앞 효과가 바꾼 값을 다음 효과가 이어받는다.
3. 효과가 다른 이벤트를 일으킬 수 있다(예: 가시 갑옷 피해 → 공격자의 `onDamaged`). 이어지는 깊이는 최대 3단계로 제한한다. 넘으면 더 실행하지 않고 개발자 콘솔에 경고를 남긴다.
4. `target: "other"`인 효과에서 상대가 없으면(예: 중독 피해의 `onDamaged`에는 source가 없음) 그 효과는 아무것도 하지 않는다.

### 확률 (`chance`)
5. `chance`는 0~1. 1이 아니면 `combat` 난수 흐름으로 굴린다(rng.md).
6. **`chance`가 1이 아닌 trigger에는 `message`가 반드시 있다.** 발동하면 그 문구를 메시지 로그에 남긴다(예: "치명타!", "공격을 피했다!"). 플레이어가 무엇이 일어났는지 알 수 있어야 한다(P4).
7. **몬스터 특성(monsters.json)과 일시 효과(statuses.json)의 trigger는 `chance`가 1이어야 한다.** 몬스터가 확률로 이득을 보는 일은 없다. 데이터 검사에서 막는다.

## 4. 공격과 피해 처리 순서 (F003이 따른다)

1. **공격 정보 만들기:** `{ ignoreDefense: false, damageOps: [], cancelled: false }`
2. **`onBeforeAttack`** (공격자). 효과는 공격 정보에 기록만 한다.
   - `ignoreDefense` → `ignoreDefense = true`
   - `modifyDamage` → `damageOps`에 순서대로 추가
3. **`onBeforeDamaged`** (대상). 같은 방식으로 기록한다.
   - `cancelAttack` → `cancelled = true`
   - `modifyDamage` → `damageOps`에 순서대로 추가
4. `cancelled`이면 여기서 끝난다. 피해 없음, `onHit`·`onDamaged` 없음. (발동 메시지는 3절 규칙 6)
5. **기본 피해** = 공격자 attack − (`ignoreDefense`이면 0, 아니면 대상 defense)
6. **수정:** 기본 피해에 `damageOps`를 기록된 순서대로 적용한다. 그다음 최솟값 1 적용, 소수는 버린다.
7. 대상 HP 감소
8. `onHit` (공격자), `onDamaged` (대상)
9. 대상 HP가 0 이하면 `onKill` (공격자), 대상 제거 또는 게임 오버

이렇게 기본 피해를 정하는 단계(5)와 고치는 단계(6)를 나눠서, 방어 관통을 언제 얻었든 치명타 배율이 사라지지 않는다.

### 공격이 아닌 피해
- `damage` 효과(가시 갑옷 등)와 일시 효과(중독 등)의 피해는 방어를 무시하고, 4절 1~6단계를 거치지 않는다. `onDamaged`만 발생한다.
- 이런 피해로 몬스터가 죽으면 **처치 수에는 넣고, `onKill`은 일으키지 않는다.**
- 이런 피해로 플레이어가 죽으면 `runStats.killedBy`에 원인(몬스터 defId 또는 일시 효과 id)을 기록한다. 게임 오버 문구는 "{원인 이름}(으)로 쓰러졌다."

## 5. 일시 효과 (statuses.json)

```json
{ "id": "weak", "name": "약화", "modifiers": [ { "stat": "attack", "op": "add", "value": -2 } ] }
{ "id": "poison", "name": "중독", "triggers": [ { "event": "onTurnEnd", "chance": 1, "effects": [ { "type": "damage", "target": "self", "amount": 1 } ] } ] }
```

1. `applyStatus` 효과로 건다. `turns`만큼 유지된다.
2. **같은 일시 효과가 이미 걸려 있으면 겹치지 않는다.** 남은 턴을 `max(지금 남은 턴, 새 turns)`로 바꾼다.
3. 남은 턴은 턴 마무리(turn-order.md 6단계)에서 1씩 준다. **걸린 그 턴의 마무리에서는 줄지 않고, 그 일시 효과의 `onTurnEnd` trigger도 실행하지 않는다.** 그래서 `turns: 3`이면 그다음 3턴 동안 영향을 받고, 중독 3턴은 정확히 3번 피해를 준다. 보정(`modifiers`)은 걸린 즉시 적용된다.
4. 남은 턴이 0이 되면 지운다.
5. 일시 효과의 trigger에서 `self`는 그 효과가 걸린 개체다.
6. 플레이어에게 걸린 일시 효과는 상태창에 이름과 남은 턴을 보여준다(F007).

## 6. 데이터 형식

```json
{
  "id": "example_vampire_ring",
  "name": "예시: 흡혈 반지",
  "kind": "build",
  "modifiers": [ { "stat": "attack", "op": "add", "value": 1 } ],
  "triggers": [
    { "event": "onHit", "chance": 1, "effects": [ { "type": "heal", "target": "self", "amount": 2 } ] },
    { "event": "onBeforeAttack", "chance": 0.25, "message": "치명타!",
      "effects": [ { "type": "modifyDamage", "op": "mul", "value": 2 } ] }
  ]
}
```
위 아이템은 형식 설명용 예시다. 실제 데이터에는 넣지 않는다. 몬스터 특성과 일시 효과도 `modifiers`, `triggers`를 같은 형식으로 쓴다.

### 효과 종류 (effects의 type)
새 종류가 필요하면 이 표에 먼저 추가한다.

| type | 하는 일 | 필드 | 쓸 수 있는 이벤트 |
|---|---|---|---|
| `heal` | HP 회복 (최대 HP를 넘지 않음) | target, amount | 모두 |
| `damage` | 피해 (방어 무시, 4절 "공격이 아닌 피해") | target, amount | 모두 |
| `modifyDamage` | 공격 피해 수정 | op(add/mul), value | onBeforeAttack, onBeforeDamaged |
| `ignoreDefense` | 이번 공격은 대상 방어를 무시 | — | onBeforeAttack |
| `cancelAttack` | 이번 공격을 무효로 (회피) | — | onBeforeDamaged |
| `applyStatus` | 일시 효과 걸기 | target, status, turns | 모두 |
| `knockback` | 대상을 공격 방향으로 밀어냄 (아래) | target, distance, collisionDamage | onHit |
| `steal` | 대상의 소모품 하나를 훔침 (아래) | target | onHit |
| `message` | 메시지 로그에 문구 추가 | text | 모두 |

- `target`: `self`(효과의 주인) 또는 `other`(이벤트의 상대: 공격 대상, 공격자, 피해 원인)
- 소모품도 같은 효과 종류를 쓴다: `{ "kind": "consumable", "use": { "effects": [...] } }`
- 데이터 검사: `ignoreDefense`, `cancelAttack`, `modifyDamage`, `knockback`, `steal`을 쓸 수 없는 이벤트에 적으면 오류.

### knockback
1. 방향은 공격자에서 대상으로 향하는 방향이다(4방향 중 하나. 원거리 공격도 같은 줄이므로 정해진다).
2. `distance` 칸만큼 한 칸씩 민다. 다음 칸이 지나갈 수 없으면(벽, 막힌 물체, 다른 개체) 거기서 멈추고 대상에게 `collisionDamage` 피해(공격이 아닌 피해)를 준다.
3. 밀려난 칸에 함정이 있으면 밟은 것으로 친다(M4, F010).

### steal
1. 대상의 소모품 중 **가장 나중에 얻은 것** 하나를 빼앗아 훔친 개체의 `carried`에 넣는다.
2. 훔칠 소모품이 없으면 아무 일도 없다.
3. 훔치는 데 성공하면 훔친 개체의 `ai.fleeing`을 true로 한다(F014 `flee`).
4. 메시지: "{몬스터}이(가) {아이템}을(를) 훔쳤다!"
5. `carried`가 있는 몬스터가 죽으면 그 아이템들을 그 칸(이미 아이템이 있으면 가장 가까운 빈 바닥 칸)에 떨어뜨린다.

## 7. 면역 (`immunities`)

개체 정의(monsters.json)와 빌드 아이템(items.json)에 `immunities` 목록을 둘 수 있다. 개체는 자기 정의와 가진 빌드 아이템의 면역을 모두 갖는다.

```json
"immunities": ["knockback", "steal", "status:weak"]
```

| 값 | 막는 것 |
|---|---|
| `knockback` | 밀쳐내기. 위치도 그대로, 충돌 피해도 없음 |
| `steal` | 훔치기 |
| `status:{id}` | 그 일시 효과가 걸리지 않음 (`applyStatus`) |

1. 면역인 효과가 그 개체를 대상으로 실행되면 아무 일도 일어나지 않고 "{대상}에게는 통하지 않는다."를 남긴다.
2. 이미 걸린 일시 효과에 대한 면역을 나중에 얻으면, 그 일시 효과는 즉시 풀린다.
3. 데이터 검사: `status:` 뒤의 id는 statuses.json에 있어야 한다.

- [ ] attack 기본값 5에 add +2, mul +0.5 보정이 있으면 최종 attack은 10이다.
- [ ] 보정 때문에 defense가 음수가 되면 0으로 계산된다.
- [ ] attackRange +3 보정이 있어도 플레이어 attackRange는 2다.
- [ ] 테스트용 아이템(onHit → heal 2)을 가진 플레이어가 공격에 성공하면 HP가 2 회복된다.
- [ ] `onBeforeAttack`에 피해 ×2 아이템과 +1 아이템이 순서대로 있으면, 기본 피해 3은 7이 된다.
- [ ] 치명타(×2)를 먼저 얻고 방어 관통을 나중에 얻었어도, 둘 다 발동하면 피해 = 공격 × 2다.
- [ ] `cancelAttack`이 발동하면 대상 HP가 그대로이고 `onHit`이 일어나지 않는다.
- [ ] 약화(3턴)가 걸린 상태에서 다시 약화(2턴)가 걸리면 남은 턴은 3, 공격 감소는 −2 한 번뿐이다.
- [ ] 걸린 턴을 포함해 약화 3턴짜리는 그다음 3번의 플레이어 행동에 적용되고 4번째에는 풀린다.
- [ ] 중독 피해로 죽은 몬스터는 처치 수에 들어가고, 처치 시 회복 아이템은 발동하지 않는다.
- [ ] 벽 앞의 몬스터를 밀어내면 위치는 그대로이고 collisionDamage만큼 HP가 준다.
- [ ] 스스로를 계속 다시 일으키는 효과를 만들어도 3단계에서 멈춘다.
- [ ] 몬스터 특성에 chance 0.5인 trigger가 있으면 데이터 검사에서 오류가 난다.
- [ ] chance가 1이 아닌 trigger에 message가 없으면 데이터 검사에서 오류가 난다.
- [ ] 전투·이동 코드에 특정 아이템·몬스터·일시 효과 id가 나오지 않는다.
- [ ] `immunities: ["status:weak"]`인 개체에게 약화를 걸면 걸리지 않고 "통하지 않는다" 메시지가 남는다.
- [ ] 밀쳐내기 면역인 개체를 전투 망치로 쳐도 위치가 그대로이고 충돌 피해가 없다.

## 미결정 사항
없음.

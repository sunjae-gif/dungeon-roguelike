---
id: F015
name: 전투 규칙 아이템
serves: [P3, P2, P4]
status: implemented
depends_on: [F003, F014]
data: [20-data/items.json, 20-data/statuses.json, 20-data/player.json]
systems: [effects, turn-order, rng]
---
# F015 전투 규칙 아이템

## 목적
기본 전투는 확률 없이 계산 가능하게 두고(F003), **아이템을 가졌을 때만** 치명타·회피·흡혈 같은 규칙이 붙게 한다. 어떤 아이템을 주웠느냐에 따라 싸우는 방식이 달라져서, 판마다 다른 빌드가 된다(P3).

이 문서는 아이템의 **효과**만 정한다. 아이템이 바닥이나 상자에서 어떻게 나오는지(드롭, 등급, 슬롯/누적)는 F005가 정한다. F005 확정 전에는 개발자 모드 "아이템 생성"(F012)으로 얻어서 시험한다.

## 원칙
1. 확률은 아이템을 가진 쪽에 유리하게만 작동한다. 몬스터는 확률을 쓰지 않는다(effects.md 3절 규칙 7).
2. 확률 효과가 발동하면 반드시 메시지를 남긴다(effects.md 3절 규칙 6).
3. 한 판 안에서 같은 빌드 아이템은 한 번만 나온다(F005). 그래서 같은 아이템 효과가 두 번 겹치는 일은 없다.

## 아이템 목록
수치는 모두 임시값이다.

| id | 이름 | 효과 | 발동 메시지 |
|---|---|---|---|
| `sharp_dagger` | 날카로운 단검 | 공격 시 25% 확률로 피해 ×2 (치명타) | "치명타!" |
| `vampire_ring` | 흡혈 반지 | 공격이 맞으면 HP 1 회복 | — |
| `thorn_armor` | 가시 갑옷 | 공격받으면 공격자에게 1 피해 | — |
| `warrior_crest` | 전사의 문장 | 몬스터를 쓰러뜨리면 HP 3 회복 | — |
| `shadow_cloak` | 그림자 망토 | 공격받을 때 20% 확률로 회피 | "공격을 피했다!" |
| `spear` | 창 | 사거리 +1 (같은 줄 2칸 앞까지 공격) | — |
| `war_hammer` | 전투 망치 | 공격이 맞으면 대상을 1칸 밀어냄. 막히면 충돌 피해 1 | — |
| `poison_blade` | 독 바른 칼 | 공격이 맞으면 30% 확률로 3턴 중독 | "독이 퍼졌다!" |
| `piercing_tip` | 관통 화살촉 | 공격 시 20% 확률로 방어 무시 | "방어를 꿰뚫었다!" |

빼기로 한 것: **정밀 장갑(명중, 회피 무시)** — 기본 전투에 빗나감이 없고 몬스터도 확률 회피를 쓸 수 없어서, 무시할 회피가 없다. 몬스터 회피가 필요해지면 그때 원칙과 함께 다시 정한다.

## items.json 데이터
```json
{ "id": "sharp_dagger", "name": "날카로운 단검", "kind": "build",
  "triggers": [ { "event": "onBeforeAttack", "chance": 0.25, "message": "치명타!",
    "effects": [ { "type": "modifyDamage", "op": "mul", "value": 2 } ] } ] }

{ "id": "vampire_ring", "name": "흡혈 반지", "kind": "build",
  "triggers": [ { "event": "onHit", "chance": 1, "effects": [ { "type": "heal", "target": "self", "amount": 1 } ] } ] }

{ "id": "thorn_armor", "name": "가시 갑옷", "kind": "build",
  "triggers": [ { "event": "onDamaged", "chance": 1, "effects": [ { "type": "damage", "target": "other", "amount": 1 } ] } ] }

{ "id": "warrior_crest", "name": "전사의 문장", "kind": "build",
  "triggers": [ { "event": "onKill", "chance": 1, "effects": [ { "type": "heal", "target": "self", "amount": 3 } ] } ] }

{ "id": "shadow_cloak", "name": "그림자 망토", "kind": "build",
  "triggers": [ { "event": "onBeforeDamaged", "chance": 0.2, "message": "공격을 피했다!",
    "effects": [ { "type": "cancelAttack" } ] } ] }

{ "id": "spear", "name": "창", "kind": "build",
  "modifiers": [ { "stat": "attackRange", "op": "add", "value": 1 } ] }

{ "id": "war_hammer", "name": "전투 망치", "kind": "build",
  "triggers": [ { "event": "onHit", "chance": 1,
    "effects": [ { "type": "knockback", "target": "other", "distance": 1, "collisionDamage": 1 } ] } ] }

{ "id": "poison_blade", "name": "독 바른 칼", "kind": "build",
  "triggers": [ { "event": "onHit", "chance": 0.3, "message": "독이 퍼졌다!",
    "effects": [ { "type": "applyStatus", "target": "other", "status": "poison", "turns": 3 } ] } ] }

{ "id": "piercing_tip", "name": "관통 화살촉", "kind": "build",
  "triggers": [ { "event": "onBeforeAttack", "chance": 0.2, "message": "방어를 꿰뚫었다!",
    "effects": [ { "type": "ignoreDefense" } ] } ] }
```

player.json에 추가: `"attackRange": 1`, `"maxAttackRange": 2`

## 아이템별 세부 규칙
- **가시 갑옷:** 공격이 아닌 피해(중독 등)에는 상대가 없으므로 발동하지 않는다. 가시 피해로 몬스터가 죽으면 처치 수에는 넣고 `onKill`은 일으키지 않는다(effects.md 4절).
- **창:** 방향 입력 판정은 turn-order.md 3번. 바로 앞이 비어 있고 2칸 앞에 몬스터가 있으면 이동 대신 공격한다. 플레이어 사거리는 최대 2(player.json `maxAttackRange`).
- **전투 망치:** 밀려나는 방향은 플레이어에서 몬스터 쪽. 창으로 2칸 앞을 쳐도 같은 방향. 밀려난 칸에 함정이 있으면 밟은 것으로 친다(M4).
- **독 바른 칼:** 이미 중독된 몬스터에게 다시 걸면 남은 턴이 3으로 돌아간다(겹치지 않음, effects.md 5절). 중독으로 죽은 몬스터는 처치 수에 들어가고, 전사의 문장은 발동하지 않는다.
- **치명타와 관통이 함께 발동:** 피해 = 공격 × 2 (effects.md 4절. 기본 피해를 먼저 정하고 배율을 나중에 곱한다).

## 화면
- 상태창 빌드 아이템 목록에 이름이 나온다(F007).
- 확률 발동 메시지는 그 공격의 피해 메시지보다 먼저 나온다. 예: "치명타!" → "고블린에게 8 피해를 입혔다."

## 완료 기준
- [ ] 아이템이 하나도 없으면 같은 전투는 항상 같은 결과다 (F003 그대로).
- [ ] 단검을 가진 상태로 시드를 고정하고 1000번 공격하면 치명타 비율이 25% ±3%p 안이다.
- [ ] 치명타가 발동하면 "치명타!" 메시지가 남는다.
- [ ] 흡혈 반지: 공격이 맞으면 HP +1, 최대 HP를 넘지 않는다.
- [ ] 가시 갑옷: 몬스터에게 맞으면 그 몬스터 HP −1. 중독 피해에는 발동하지 않는다.
- [ ] 전사의 문장: 공격으로 쓰러뜨리면 HP +3. 가시·중독으로 죽으면 발동하지 않는다.
- [ ] 그림자 망토: 회피가 발동하면 HP가 그대로이고 "공격을 피했다!"가 남는다. 슬라임의 약화도 걸리지 않는다(`onHit`이 없으므로).
- [ ] 창: 2칸 앞 몬스터를 공격할 수 있고, 창 두 개를 얻어도(개발자 모드) 사거리는 2다.
- [ ] 전투 망치: 맞은 몬스터가 1칸 밀려난다. 뒤가 벽이면 제자리에서 HP −1 추가.
- [ ] 독 바른 칼: 중독이 걸린 몬스터는 걸린 다음 턴부터 턴 끝마다 HP −1, 정확히 3번 피해를 받고 풀린다.
- [ ] 관통: 발동하면 방어 5인 가고일에게도 피해 = 공격.
- [ ] 개발자 모드 "아이템 생성"으로 위 9개를 모두 얻을 수 있다.

## 미결정 사항
없음. (아이템을 어디서 얻는지, 등급, 슬롯/누적은 F005)

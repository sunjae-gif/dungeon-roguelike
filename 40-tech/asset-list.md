# 그림 목록

art-guide.md의 작업 순서대로 만든다. 상태: ⬜ 아직 · 🔶 만드는 중 · ✅ 게임에 넣음
sprites.json 칸의 "있음"은 이미 등록된 id(지금은 색 사각형), "새로"·"M4에서 추가 예정"은 등록이 필요한 id다. M4가 끝나면 이 목록을 sprites.json과 다시 맞춘다.

픽셀아트는 모두 16×16 PNG, 직접 그린다(art-guide.md). 출처 칸에는 "직접" 또는 바탕으로 쓴 공개 에셋 이름과 라이선스, 일러스트는 Leonardo와 요금제를 적는다. 그리는 우선순위는 art-guide.md "분량 줄이기".

## 캐릭터 (16)

| id | 이름 | sprites.json | 상태 | 출처 |
|---|---|---|---|---|
| `player` |  | 있음 | ⬜ | |
| `rat` | 쥐 | 있음 | ⬜ | |
| `goblin` | 고블린 | 있음 | ⬜ | |
| `orc` | 오크 | 있음 | ⬜ | |
| `troll` | 트롤 | 있음 | ⬜ | |
| `final_boss` | 심연의 왕 | 있음 | ⬜ | |
| `goblin_archer` | 고블린 궁수 | 있음 | ⬜ | |
| `slime` | 슬라임 | 있음 | ⬜ | |
| `goblin_thief` | 고블린 도둑 | 있음 | ⬜ | |
| `orc_shaman` | 오크 주술사 | 있음 | ⬜ | |
| `gargoyle` | 가고일 | 있음 | ⬜ | |
| `skeleton_archer` | 해골 궁수 | 있음 | ⬜ | |
| `player_up` | 주인공 (위) | 새로 | ⬜ | |
| `player_down` | 주인공 (아래) | 새로 | ⬜ | |
| `player_left` | 주인공 (왼쪽) | 새로 | ⬜ | |
| `player_right` | 주인공 (오른쪽) | 새로 | ⬜ | |

## 타일 (16)

| id | 이름 | sprites.json | 상태 | 출처 |
|---|---|---|---|---|
| `floor_t1` |  | 있음 | ⬜ | |
| `wall_t1` |  | 있음 | ⬜ | |
| `door_t1` |  | 있음 | ⬜ | |
| `door_open_t1` |  | 있음 | ⬜ | |
| `floor_t2` |  | 있음 | ⬜ | |
| `wall_t2` |  | 있음 | ⬜ | |
| `door_t2` |  | 있음 | ⬜ | |
| `door_open_t2` |  | 있음 | ⬜ | |
| `floor_t3` |  | 있음 | ⬜ | |
| `wall_t3` |  | 있음 | ⬜ | |
| `door_t3` |  | 있음 | ⬜ | |
| `door_open_t3` |  | 있음 | ⬜ | |
| `floor_boss` |  | 있음 | ⬜ | |
| `wall_boss` |  | 있음 | ⬜ | |
| `door_boss` |  | 있음 | ⬜ | |
| `door_open_boss` |  | 있음 | ⬜ | |

## 물체 (17)

| id | 이름 | sprites.json | 상태 | 출처 |
|---|---|---|---|---|
| `stairs` |  | 있음 | ⬜ | |
| `sealedGate` |  | 있음 | ⬜ | |
| `chest` |  | 있음 | ⬜ | |
| `chest_open` |  | 있음 | ⬜ | |
| `spring` |  | 있음 | ⬜ | |
| `spring_used` |  | 있음 | ⬜ | |
| `trap_spike` |  | 있음 | ⬜ | |
| `trap_gas` |  | 있음 | ⬜ | |
| `trap_alarm` |  | 있음 | ⬜ | |
| `lever` | 되돌림 레버 | M4에서 추가 예정 | ⬜ | |
| `plate` | 금 간 발판 | M4에서 추가 예정 | ⬜ | |
| `plate_broken` | 무너진 발판(구멍) | M4에서 추가 예정 | ⬜ | |
| `boulder` | 돌 | M4에서 추가 예정 | ⬜ | |
| `switch` | 스위치 | M4에서 추가 예정 | ⬜ | |
| `switch_pressed` | 눌린 스위치 | 새로 | ⬜ | |
| `chest_locked` | 잠긴 상자 | 새로 | ⬜ | |
| `hidden_passage` | 찾은 숨은 통로 | 새로 | ⬜ | |

## 아이템 (24)

| id | 이름 | sprites.json | 상태 | 출처 |
|---|---|---|---|---|
| `potion_heal` | 회복 물약 | 있음 | ⬜ | |
| `sharp_dagger` | 날카로운 단검 | 있음 | ⬜ | |
| `vampire_ring` | 흡혈 반지 | 있음 | ⬜ | |
| `thorn_armor` | 가시 갑옷 | 있음 | ⬜ | |
| `warrior_crest` | 전사의 문장 | 있음 | ⬜ | |
| `shadow_cloak` | 그림자 망토 | 있음 | ⬜ | |
| `spear` | 창 | 있음 | ⬜ | |
| `war_hammer` | 전투 망치 | 있음 | ⬜ | |
| `poison_blade` | 독 바른 칼 | 있음 | ⬜ | |
| `piercing_tip` | 관통 화살촉 | 있음 | ⬜ | |
| `leather_gloves` | 가죽 장갑 | 있음 | ⬜ | |
| `iron_shield` | 철 방패 | 있음 | ⬜ | |
| `sturdy_heart` | 튼튼한 심장 | 있음 | ⬜ | |
| `owl_eye` | 올빼미 눈 | 있음 | ⬜ | |
| `berserker_belt` | 광전사의 띠 | 있음 | ⬜ | |
| `turtle_shell` | 거북 등껍질 | 있음 | ⬜ | |
| `chain_vest` | 사슬 조끼 | 있음 | ⬜ | |
| `explorer_boots` | 탐험가의 장화 | 있음 | ⬜ | |
| `purity_charm` | 정화의 부적 | 있음 | ⬜ | |
| `life_ring` | 생명의 반지 | 있음 | ⬜ | |
| `blood_rage` | 분노의 피 | 있음 | ⬜ | |
| `status_weak` | 약화 아이콘 | 새로 (F016) | ⬜ | |
| `status_poison` | 중독 아이콘 | 새로 (F016) | ⬜ | |
| `status_rage` | 분노 아이콘 | 새로 (F016) | ⬜ | |

## 스탠딩 일러스트 (4)

1024×1536 PNG, 배경 투명.

| id | 쓰는 곳 | 상태 | 출처 |
|---|---|---|---|
| `player_portrait` | 주인공 기본 (캐릭터 시트, 타이틀) | ⬜ | |
| `final_boss_portrait` | 심연의 왕 (10층 floorIntro) | ⬜ | |
| `player_portrait_defeat` | 주인공 쓰러짐 (게임 오버) | ⬜ | |
| `player_portrait_victory` | 주인공 승리 (클리어) | ⬜ | |

합계: 픽셀아트 73장, 일러스트 4장

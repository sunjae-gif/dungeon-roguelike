---
status: confirmed
---
# 아트 가이드

그림은 두 종류다. 만드는 방법과 규격이 다르므로 섞지 않는다.
모든 그림은 미리 만들어 `public/assets/`에 넣고, `20-data/sprites.json`에 등록한다. 만들 그림 목록과 진행 상태는 `40-tech/asset-list.md`.

## 0. 캐릭터 콘셉트 (픽셀아트와 일러스트가 함께 따른다)

두 그림이 같은 인물로 보이려면 **멀리서도 알아볼 상징 3가지**를 정하고, 16px 그림에도 반드시 넣는다.

### 주인공 "탐험가"
- 이름 없는 탐험가. 후드 달린 낡은 망토, 가벼운 가죽 갑옷, 짧은 검.
- **상징 3가지:** ① 왼손에 든 **랜턴**(따뜻한 노란빛 — 시야 시스템의 그림 쪽 표현) ② **진청색 후드 망토** ③ 망토 끝의 **해진 붉은 천 띠**
- 랜턴의 노란색은 주인공만 쓴다. 어떤 몬스터·타일에도 같은 색을 쓰지 않아서, 어두운 화면에서도 주인공이 바로 보이게 한다.

### 심연의 왕
- 무너진 왕국의 마지막 왕이 심연에 삼켜진 모습. 사람보다 한참 크다.
- **상징 3가지:** ① **부서진 왕관**(한쪽이 깨져 별빛이 새어 나옴) ② **별이 박힌 듯한 검보라 갑옷** ③ **얼굴이 보이지 않는 어둠** 속 두 개의 흰 눈빛
- 색은 테마 `theme_boss` 팔레트(검보라 + 별빛 흰색)를 따른다.

## 1. 인게임 픽셀아트

지도 타일, 캐릭터, 몬스터, 아이템, 상자·함정 같은 물체.

| 항목 | 규격 |
|---|---|
| 원본 크기 | **16×16 픽셀** (확정. sprites.json `sourcePixelSize`) |
| 화면 크기 | 32×32 픽셀 (`tileSize`). 원본을 2배 정수 확대 |
| 형식 | PNG. 캐릭터·물체·아이템은 배경 투명, 바닥·벽 타일은 불투명 |
| 확대 | 최근접 이웃(nearest neighbor)만. 흐리게 보간하지 않는다 |
| 위치 | `assets/tiles/`, `assets/chars/`, `assets/objects/`, `assets/items/`, `assets/ui/` |
| 파일 이름 | sprites.json의 id와 같게. 방향 이미지는 `id_up.png`처럼 |

16px로 정한 이유: 그릴 그림이 70장 넘게 있고, 직접 그리기로 했으므로 한 장에 찍을 픽셀 수가 적을수록 좋다. 16px 캐릭터는 자연스럽게 머리가 큰 비례(2~2.5등신)가 되어 데포르메 일러스트와도 잘 맞는다.

### 색 (고정 팔레트 없음)
- **마스터 팔레트는 정하지 않는다(2026-10-27 결정).** 대신 아래 규칙으로 색이 흩어지지 않게 한다.
- 테마별 기준색(아래 표)에서 출발한다. 같은 테마의 타일은 그 테마 기준색과 그 밝기 변형만 쓴다.
- **그리면서 팔레트를 쌓아 저장한다.** 처음 그린 그림의 색을 Aseprite 팔레트 파일로 저장하고(`art/palettes/`. 게임에 실리지 않는 작업 파일이라 `public/` 밖에 둔다), 다음 그림은 그 팔레트에서 먼저 고른다. 새 색이 꼭 필요할 때만 더한다.
  - `characters.gpl` — 주인공·몬스터 공용
  - `theme_1.gpl` ~ `theme_boss.gpl` — 테마 타일·물체
  - `items.gpl` — 아이템 아이콘
- 한 그림에 쓰는 색은 4~6색 안팎으로 한다(외곽선 포함).
- 타일 색이 정해지면 sprites.json `fallbackColor`도 그 색으로 맞춘다.

### 테마별 팔레트 기준색 (F011)
| 테마 | 바닥 | 벽 | 문 | 강조색 |
|---|---|---|---|---|
| theme_1 이끼 낀 하수도 | `#2f3b2f` | `#4f6b45` | `#6b5134` | 이끼 초록 `#7fa65a` |
| theme_2 고블린 전초기지 | `#3b2e24` | `#6e4a2c` | `#8a5a2a` | 횃불 주황 `#e08a3c` |
| theme_3 잊힌 왕의 묘역 | `#2b2f36` | `#5d6670` | `#4a5560` | 혼불 청록 `#5fd1c8` |
| theme_boss 심연의 옥좌 | `#14102a` | `#3a2a66` | `#5a3fa0` | 별빛 `#f2efff` |

### 알아보기 규칙
- 모든 캐릭터·물체·아이템은 **1px 어두운 외곽선**을 두른다. 바닥 타일에는 두르지 않는다.
- 광원은 **왼쪽 위**로 통일한다.
- 몬스터는 **실루엣만 보고도 구별**되게 한다. 궁수류는 활, 주술사는 지팡이, 도둑은 자루를 든 모양처럼 손에 든 것으로 구별한다.
- 같은 계열(고블린 / 고블린 궁수 / 고블린 도둑)은 몸 색을 같게 하고 손에 든 것과 옷 색만 바꾼다.
- 바닥은 어둡고 채도를 낮게, 캐릭터와 물체는 밝고 채도를 높게. 바닥 무늬는 2~3색으로 단순하게 해서 캐릭터를 가리지 않게 한다.
- 함정은 바닥보다 확실히 밝은 색으로 그려 "보이는 함정"(F010)이 실제로 잘 보이게 한다.

### 제작 흐름 (직접 그리기, 2026-10-27 결정)
1. **도구:** Aseprite(유료, 한 번 결제)를 기본으로 한다. 무료로 하려면 Pixelorama나 LibreSprite도 같은 방식으로 쓸 수 있다. 캔버스 16×16, 격자 1px, 확대해서 그린다.
2. **참고 그림:** 일러스트(2절)를 먼저 만들고, 그것을 옆에 띄워 놓고 16px로 옮긴다. 상징 3가지(0절)를 가장 먼저 찍고 나머지를 채운다.
3. **그리는 순서 (한 장):** 실루엣(한 색) → 외곽선 → 기본 색 2~3개 → 왼쪽 위 밝은 면 → 작은 강조점. 실루엣 단계에서 32px로 확대해 어두운 바닥 위에 올려 보고, 다른 몬스터와 구별되는지 먼저 확인한다.
4. **확인:** 게임에 넣어 실제 크기(32px)와 어두운 바닥 위에서 본다. 개발자 모드 "지도 공개"로 한꺼번에 확인한다.
5. **등록:** `public/assets/`에 넣고 sprites.json 경로를 확인한다. asset-list.md의 상태를 바꾼다(Claude Code가 한다).

### 분량 줄이기
73장을 모두 손으로 그리면 시간이 오래 걸린다. 아래 순서로 **게임이 달라 보이는 것부터** 그린다. 나머지는 색 사각형으로 두어도 게임은 돈다.
1. 1순위 (약 20장): 주인공 4방향, 몬스터 10종, 테마 1 타일 4장, 계단·상자
2. 2순위 (약 25장): 나머지 테마 타일 12장, 함정·샘·퍼즐 장치·봉인
3. 3순위 (약 28장): 아이템 아이콘 21개, 일시 효과 3개, 열린 상자·마른 샘 같은 상태 그림

바닥·벽 타일은 공개 무료 에셋을 바탕으로 고쳐 써도 된다. 예: Kenney "Tiny Dungeon"(CC0, 출처 표기 의무 없음). 쓸 경우 asset-list.md "출처" 칸에 에셋 이름과 라이선스를 적는다. 캐릭터와 심연의 왕은 직접 그린다(게임의 얼굴이므로).

라이선스: 도구마다 상업적 이용 조건이 다르고 자주 바뀐다. 무료 체험분은 상업적 이용이 안 되는 경우가 많다. 나중에 게임을 공개·판매할 생각이 있으면, 그 시점에 쓰는 요금제의 약관을 확인하고 기록해 둔다(asset-list.md "출처" 칸).

## 2. 스탠딩 일러스트

캐릭터의 반신·전신 일러스트. 생성형 이미지로 만든 일반 일러스트 화풍. 쓰는 곳과 장수는 F016(4장).

| 항목 | 규격 |
|---|---|
| 비율 | 세로 2:3 (예: 1024×1536) |
| 형식 | PNG, 배경 투명 |
| 위치 | `assets/illust/` |
| 파일 이름 | `캐릭터id_portrait.png`, 상황별이면 `_portrait_defeat.png`, `_portrait_victory.png` |
| 확대 | 일반 보간 사용 (픽셀아트와 반대) |

### 화풍
**결정 (2026-10-27): A(어두운 판타지 회화풍)를 데포르메한 그림체.** 회화풍의 색·명암·붓 터치는 A를 따르고, 인물 비례는 머리가 크고 몸이 짧은 데포르메로 한다. 아래 기준 프롬프트는 이 결정에 맞춰 다시 다듬는다.

(검토했던 안)
| | A. 어두운 판타지 회화풍 (추천) | B. 애니메이션풍 |
|---|---|---|
| 느낌 | 붓 터치가 보이는 반실사, 낮은 채도, 강한 명암 | 깔끔한 선, 셀 채색, 밝은 인상 |
| 어울림 | 하수도→묘역→심연으로 가라앉는 분위기와 맞음 | 가볍고 친근함. 테마 분위기와는 다소 거리 |
| 픽셀아트와의 연결 | 같은 팔레트 강조색(랜턴 노랑, 별빛 보라)으로 묶기 쉬움 | 색이 밝아 픽셀 화면과 따로 놀 수 있음 |

### 생성 도구: Leonardo (2026-10-27 결정)
- 캐릭터를 여러 장면에서 같게 유지하는 기능(Character Reference / Consistent Character)과 직접 학습(LoRA)이 있다. 이 기능은 유료 요금제(Apprentice, 월 $12부터)에 있다는 자료가 있으니, 가입할 때 확인한다.
- 무료 요금제로 만든 그림은 다른 사람에게 공개되고, 상업적 이용 조건이 분명하지 않다. 일러스트는 4장뿐이므로 **유료 요금제를 1개월만 쓰는 것**을 권한다. 나중에 게임을 공개할 생각이 있으면 그 달의 약관을 저장해 둔다.
- 쓰는 법: ① 캐릭터 시트(`player_portrait`)를 여러 장 뽑아 하나를 고른다 → ② 그 그림을 캐릭터 참조로 넣고 강도를 중간~높음으로 두고 나머지 장면을 만든다 → ③ 배경을 지운다(Leonardo의 배경 제거 기능 또는 이미지 편집기).

### 일관성 규칙
- 같은 캐릭터는 같은 **기준 이미지(캐릭터 시트)** 한 장에서 출발한다. 먼저 캐릭터 시트를 만들고, 나머지 장면은 그것을 참조로 넣어 만든다.
- 아래 "기준 프롬프트"를 모든 일러스트에 공통으로 붙인다.
- 0절의 상징 3가지가 모든 일러스트에 보이는지 확인한다.

### 기준 프롬프트 (A를 데포르메, 생성 도구에는 영어가 잘 통한다)
```
Style: dark fantasy painterly illustration, super-deformed chibi proportions (about 2.5 to 3 heads tall),
       big head, small sturdy body, visible brush strokes, muted desaturated colors, strong chiaroscuro lighting
Light: single warm light source from a hand-held lantern, deep soft shadows
Color: deep teal and charcoal base, warm lantern yellow (#f4c95d) as the only warm accent
Frame: vertical 2:3, single character centered, full body, plain dark background
Avoid: text, watermark, logo, glossy anime cel shading, pastel kawaii colors, bright saturated colors,
       realistic proportions, extra characters, cluttered background
```
- 데포르메라도 **귀엽게 밝아지지 않게** 하는 것이 핵심이다. 비례만 작고 둥글게, 색·명암·붓 터치는 어두운 회화풍 그대로 둔다.
- 결과가 너무 귀여우면 `muted`, `chiaroscuro`를 앞쪽으로 옮기고 `pastel`, `kawaii`를 Avoid에 확실히 넣는다. 너무 실사 같으면 `super-deformed`, `big head`를 앞쪽으로 옮긴다.

### 장면별 프롬프트 초안
| 파일 | 프롬프트에 더할 내용 |
|---|---|
| `player_portrait` (캐릭터 시트 겸 타이틀) | a small hooded explorer in a worn deep-blue hooded cloak with a frayed red cloth band, light leather armor, short sword at the hip, holding a glowing lantern in the left hand, calm determined expression, standing, slight three-quarter view |
| `player_portrait_defeat` | same small explorer sitting slumped on the ground, lantern beside them flickering dimly, head lowered, cloak torn |
| `player_portrait_victory` | same small explorer standing on tiptoe, lantern raised high with both hands, light spilling upward, faint starlight around |
| `final_boss_portrait` | a hulking super-deformed fallen king, about 3 heads tall but much larger than a person, huge broken crown leaking starlight, chunky dark violet armor speckled like a night sky, face hidden in darkness with two white glowing eyes, seen from a low angle looming over the viewer, palette deep violet (#3a2a66) and star white (#f2efff) |

- 심연의 왕은 데포르메여도 **크기로 위압감**을 준다. 아래에서 올려다보는 구도로, 화면 위쪽이 잘릴 만큼 크게 둔다.

## 3. 글꼴
- 한글 픽셀 글꼴 **Galmuri11** (SIL Open Font License, 무료 사용·배포 가능)
- 받는 곳: GitHub `quiple/galmuri` 저장소의 배포 파일. `Galmuri11.woff2`를 `public/fonts/`에 넣는다.
- 크기·대체 글꼴은 `20-data/ui.json` `font`.
- 라이선스 파일(OFL.txt)도 `public/fonts/`에 함께 넣는다.

## 4. 작업 순서 (M5)
1. 일러스트: 주인공 캐릭터 시트(`player_portrait`) → 심연의 왕(`final_boss_portrait`). 이 두 장이 전체 그림의 기준이 된다.
2. 픽셀: 주인공 4방향 → 심연의 왕. 일러스트의 상징 3가지를 16px에 옮긴다.
3. 픽셀: 몬스터 10종 (같은 계열끼리 묶어서)
4. 픽셀: 테마 타일 4세트 (바닥·벽·문·열린 문)
5. 픽셀: 물체 (계단, 상자, 함정, 샘, 퍼즐 장치, 봉인)
6. 픽셀: 아이템 아이콘 21개, 일시 효과 아이콘 3개
7. 일러스트: 쓰러짐·승리 2장

한 단계가 끝날 때마다 게임에 넣어 보고 다음으로 간다. 1~2단계에서 방향이 맞지 않으면 나머지를 만들기 전에 고친다.

## 미결정 사항
없음.

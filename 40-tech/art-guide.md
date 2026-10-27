---
status: draft
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

16px로 정한 이유: 그릴 그림이 70장 넘게 있고, 생성 도구가 16~32px에서 가장 잘 맞으며, 손으로 고칠 픽셀 수가 가장 적다.

### 팔레트
- **공용 마스터 팔레트로 [ENDESGA 32](https://lospec.com/palette-list/endesga-32)(32색)를 추천한다.** 모든 픽셀아트는 이 32색 안에서만 쓴다. 그림마다 색이 조금씩 달라지는 것을 막는다.
- 테마별 기준색(아래 표)은 분위기를 정하는 기준이다. 타일을 만들 때는 기준색에 가장 가까운 마스터 팔레트 색으로 바꿔 쓴다. 바꾼 색은 sprites.json `fallbackColor`에도 맞춰 둔다.
- 한 그림에 쓰는 색은 4~6색 안팎으로 한다(외곽선 포함).

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

### 제작 흐름
1. **생성:** 픽셀 격자를 지키는 전용 도구로 만든다.
   - 추천: **PixelLab** — 실제 픽셀 격자로 만들고, 캐릭터를 4방향으로 돌려 주고, 타일셋도 만든다. 월 구독(체험 생성 40회 후 월 $12부터). 그림이 많이 필요한 M5 기간에만 1~2개월 쓰고 해지하는 방식을 권한다.
   - 대안: **Retro Diffusion** — Aseprite 확장으로 컴퓨터에서 돌고, 한 번 결제(Lite $20, 전체 $65)로 끝난다. 결과물이 내 것이다.
   - 일반 이미지 생성기(픽셀 격자를 안 지키는 것)로 만들었다면 **Unfaker**(unfake.js)로 격자를 찾아 정리한 뒤 2번으로 간다.
2. **정리:** **Aseprite**에서 마스터 팔레트로 색을 맞추고, 외곽선을 1px로 다듬고, 튀는 픽셀을 지운다. 이 단계는 어떤 도구를 쓰든 필요하다.
3. **확인:** 게임에 넣어 실제 크기(32px)와 어두운 바닥 위에서 본다. 색 사각형이던 자리에 넣고 개발자 모드 "지도 공개"로 한꺼번에 확인한다.
4. **등록:** `public/assets/`에 넣고 sprites.json 경로를 확인한다. asset-list.md의 상태를 바꾼다.

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

### 화풍 (추천: A)
| | A. 어두운 판타지 회화풍 (추천) | B. 애니메이션풍 |
|---|---|---|
| 느낌 | 붓 터치가 보이는 반실사, 낮은 채도, 강한 명암 | 깔끔한 선, 셀 채색, 밝은 인상 |
| 어울림 | 하수도→묘역→심연으로 가라앉는 분위기와 맞음 | 가볍고 친근함. 테마 분위기와는 다소 거리 |
| 픽셀아트와의 연결 | 같은 팔레트 강조색(랜턴 노랑, 별빛 보라)으로 묶기 쉬움 | 색이 밝아 픽셀 화면과 따로 놀 수 있음 |

### 생성 도구
- 추천: **Midjourney**(월 $10부터, 무료 없음) — Omni Reference로 기준 이미지 한 장을 고정해 같은 인물을 여러 장면에 그리기 좋다.
- 무료로 시작: **Ideogram** — 무료 요금제에서도 기준 이미지로 얼굴을 고정할 수 있다.
- 대안: **Leonardo** — Character Reference와 직접 학습(LoRA). 무료 요금제 결과물은 비상업용.
- 대부분 투명 배경으로 나오지 않는다. 배경을 지우는 단계를 따로 둔다(도구의 배경 제거 기능이나 이미지 편집기).

### 일관성 규칙
- 같은 캐릭터는 같은 **기준 이미지(캐릭터 시트)** 한 장에서 출발한다. 먼저 캐릭터 시트를 만들고, 나머지 장면은 그것을 참조로 넣어 만든다.
- 아래 "기준 프롬프트"를 모든 일러스트에 공통으로 붙인다.
- 0절의 상징 3가지가 모든 일러스트에 보이는지 확인한다.

### 기준 프롬프트 (화풍 A, 생성 도구에는 영어가 잘 통한다)
```
Style: dark fantasy painterly illustration, visible brush strokes, semi-realistic,
       muted desaturated colors, strong chiaroscuro lighting
Light: single warm light source from a hand-held lantern, deep shadows
Color: deep teal and charcoal base, warm lantern yellow (#f4c95d) as the only warm accent
Frame: vertical 2:3, character centered, full body or knees-up, plain dark background
Avoid: text, watermark, logo, bright saturated colors, anime style, extra characters, cluttered background
```

### 장면별 프롬프트 초안
| 파일 | 프롬프트에 더할 내용 |
|---|---|
| `player_portrait` (캐릭터 시트 겸 타이틀) | a lone hooded explorer in a worn deep-blue hooded cloak with a frayed red cloth band, light leather armor, short sword at the hip, holding a glowing lantern in the left hand, calm determined pose, looking slightly down |
| `player_portrait_defeat` | same explorer kneeling, lantern on the ground flickering dimly, head lowered, cloak torn |
| `player_portrait_victory` | same explorer standing, lantern raised high, light spilling upward, faint starlight around |
| `final_boss_portrait` | colossal fallen king consumed by the abyss, broken crown leaking starlight, dark violet armor speckled like a night sky, face hidden in darkness with two white glowing eyes, towering, looming over the viewer, palette deep violet (#3a2a66) and star white (#f2efff) |

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
- [ ] 일러스트 화풍: A(어두운 판타지 회화풍, 추천) / B(애니메이션풍)
- [ ] 생성 도구: 픽셀(PixelLab 구독 / Retro Diffusion 한 번 결제), 일러스트(Midjourney / Ideogram 무료 / Leonardo)
- [ ] 마스터 팔레트: ENDESGA 32 (추천) / 다른 팔레트

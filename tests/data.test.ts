// 데이터 검사 (40-tech/tech-stack.md "데이터 검사")
import { describe, expect, it } from 'vitest';
import { RAW_DATA } from '../src/data/load';
import type { RawData } from '../src/data/types';
import { validateGameData } from '../src/data/validate';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function errorsAfter(change: (raw: Json) => void): string[] {
  const raw = structuredClone(RAW_DATA) as Json;
  change(raw);
  const result = validateGameData(raw as RawData);
  return result.ok ? [] : result.errors;
}

const expectError = (change: (raw: Json) => void, pattern: RegExp) => {
  const errors = errorsAfter(change);
  expect(errors.some((e) => pattern.test(e)), `errors: ${JSON.stringify(errors)}`).toBe(true);
};

describe('데이터 검사', () => {
  it('지금의 20-data/는 검사를 통과한다', () => {
    expect(errorsAfter(() => {})).toEqual([]);
  });

  it('필수 필드가 없으면 실패', () => {
    expectError((r) => delete r['player.json'].maxHp, /player\.json\.maxHp: 필수 필드/);
    expectError((r) => delete r['ui.json'].floorIntroMs, /ui\.json\.floorIntroMs/);
  });

  it('값의 형식이 틀리면 실패', () => {
    expectError((r) => (r['monsters.json'].monsters[0].attack = '3'), /monsters\[0\]\.attack: 숫자/);
    expectError((r) => (r['themes.json'].themes[0].monsterCount = [5, 3]), /monsterCount: 최소가 최대보다 큼/);
    expectError((r) => (r['themes.json'].themes[0].doorChance = 2), /doorChance: 1 이하/);
  });

  it('id가 중복되면 실패', () => {
    expectError((r) => r['monsters.json'].monsters.push({ ...r['monsters.json'].monsters[0] }), /id "rat" 중복/);
    expectError((r) => r['sprites.json'].sprites.push({ ...r['sprites.json'].sprites[0] }), /중복/);
  });

  it('다른 파일을 가리키는 id가 없으면 실패', () => {
    expectError((r) => r['themes.json'].themes[0].monsterTypes.push('dragon'), /monsterTypes\[2\]: monsters\.json에 없는 id "dragon"/);
    expectError((r) => (r['themes.json'].themes[0].trapTypes = ['pit']), /traps\.json에 없는 id "pit"/);
    expectError((r) => (r['themes.json'].themes[0].tiles.wall = 'nope'), /tiles\.wall: sprites\.json에 없는/);
    expectError((r) => (r['themes.json'].themes[0].roomWeights.arena = 5), /roomWeights\.arena: rooms\.json에 없는/);
    expectError((r) => (r['themes.json'].themes[3].boss = 'dragon'), /boss: monsters\.json에 없는/);
    expectError((r) => (r['items.json'].items[0].sprite = 'nope'), /items\[0\]\.sprite: sprites\.json에 없는/);
    expectError((r) => (r['traps.json'].traps[0].sprite = 'nope'), /traps\[0\]\.sprite: sprites\.json에 없는/);
  });

  it('테마의 floors가 1~maxFloor를 빠짐없이, 겹치지 않게 덮어야 한다', () => {
    expectError((r) => (r['themes.json'].themes[0].floors = [1, 2]), /3층을 덮는 테마가 없음/);
    expectError((r) => (r['themes.json'].themes[1].floors = [3, 4, 5, 6]), /3층이 "theme_1"와 겹침/);
    expectError((r) => (r['themes.json'].themes[3].floors = [10, 11]), /11층은 1~10 범위 밖/);
  });

  it('효과 type, 이벤트 이름, 능력치 id가 effects.md 표에 있어야 한다', () => {
    const buildItem = {
      id: 'test_build', name: '테스트', kind: 'build', weight: 1, sprite: 'potion_heal',
      modifiers: [{ stat: 'attack', op: 'add', value: 1 }],
      triggers: [{ event: 'onHit', chance: 1, effects: [{ type: 'heal', target: 'self', amount: 2 }] }],
    };
    expect(errorsAfter((r) => r['items.json'].items.push(structuredClone(buildItem)))).toEqual([]);

    const withItem = (edit: (item: Json) => void) => (r: Json) => {
      const item = structuredClone(buildItem) as Json;
      edit(item);
      r['items.json'].items.push(item);
    };
    expectError(withItem((i) => (i.modifiers[0].stat = 'luck')), /modifiers\[0\]\.stat: maxHp \/ attack/);
    expectError(withItem((i) => (i.triggers[0].event = 'onJump')), /triggers\[0\]\.event/);
    expectError(withItem((i) => (i.triggers[0].effects[0].type = 'explode')), /effects\[0\]\.type/);
    expectError(withItem((i) => delete i.triggers[0].effects[0].amount), /effects\[0\]\.amount: 필수 필드/);
    expectError((r) => (r['items.json'].items[0].use.effects[0].type = 'teleport'), /use\.effects\[0\]\.type/);
    expectError((r) => (r['traps.json'].traps[0].effect = 'fire'), /traps\[0\]\.effect/);
  });

  it('여러 곳이 틀리면 모두 알려준다', () => {
    const errors = errorsAfter((r) => {
      delete r['player.json'].attack;
      r['themes.json'].themes[0].monsterTypes = ['dragon'];
    });
    expect(errors.length).toBe(2);
  });
});

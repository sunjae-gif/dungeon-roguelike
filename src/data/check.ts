// 데이터 검사용 작은 도우미. 틀린 곳을 errors에 "경로: 이유" 형식으로 쌓는다.

export type Obj = Record<string, unknown>;

export function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface NumberRule {
  optional?: boolean;
  integer?: boolean;
  min?: number;
  max?: number;
}

export class Checker {
  readonly errors: string[] = [];

  fail(path: string, reason: string): void {
    this.errors.push(`${path}: ${reason}`);
  }

  obj(v: unknown, path: string): v is Obj {
    if (isObj(v)) return true;
    this.fail(path, '객체여야 함');
    return false;
  }

  field(o: Obj, key: string, path: string, optional = false): boolean {
    if (o[key] !== undefined) return true;
    if (!optional) this.fail(`${path}.${key}`, '필수 필드가 없음');
    return false;
  }

  num(o: Obj, key: string, path: string, rule: NumberRule = {}): void {
    if (!this.field(o, key, path, rule.optional)) return;
    const v = o[key];
    const p = `${path}.${key}`;
    if (typeof v !== 'number' || !Number.isFinite(v)) return this.fail(p, '숫자여야 함');
    if (rule.integer && !Number.isInteger(v)) this.fail(p, '정수여야 함');
    if (rule.min !== undefined && v < rule.min) this.fail(p, `${rule.min} 이상이어야 함`);
    if (rule.max !== undefined && v > rule.max) this.fail(p, `${rule.max} 이하여야 함`);
  }

  str(o: Obj, key: string, path: string, optional = false): void {
    if (!this.field(o, key, path, optional)) return;
    if (typeof o[key] !== 'string' || o[key] === '') this.fail(`${path}.${key}`, '빈 문자열이 아닌 문자열이어야 함');
  }

  bool(o: Obj, key: string, path: string, optional = false): void {
    if (!this.field(o, key, path, optional)) return;
    if (typeof o[key] !== 'boolean') this.fail(`${path}.${key}`, 'true/false여야 함');
  }

  oneOf(o: Obj, key: string, path: string, values: readonly string[], optional = false): void {
    if (!this.field(o, key, path, optional)) return;
    if (!values.includes(o[key] as string)) {
      this.fail(`${path}.${key}`, `${values.join(' / ')} 중 하나여야 함 (지금: ${JSON.stringify(o[key])})`);
    }
  }

  arr(o: Obj, key: string, path: string, optional = false): unknown[] | null {
    if (!this.field(o, key, path, optional)) return null;
    const v = o[key];
    if (Array.isArray(v)) return v;
    this.fail(`${path}.${key}`, '배열이어야 함');
    return null;
  }

  objField(o: Obj, key: string, path: string, optional = false): Obj | null {
    if (!this.field(o, key, path, optional)) return null;
    return this.obj(o[key], `${path}.${key}`) ? (o[key] as Obj) : null;
  }

  strList(o: Obj, key: string, path: string): void {
    const list = this.arr(o, key, path);
    list?.forEach((v, i) => {
      if (typeof v !== 'string') this.fail(`${path}.${key}[${i}]`, '문자열이어야 함');
    });
  }

  // [최소, 최대] 정수 쌍
  range(o: Obj, key: string, path: string): void {
    const list = this.arr(o, key, path);
    if (!list) return;
    const [a, b] = list;
    const ok = list.length === 2 && Number.isInteger(a) && Number.isInteger(b) && (a as number) >= 0;
    if (!ok) this.fail(`${path}.${key}`, '[최소, 최대] 0 이상의 정수 쌍이어야 함');
    else if ((a as number) > (b as number)) this.fail(`${path}.${key}`, '최소가 최대보다 큼');
  }

  // 목록 안의 객체마다 id 중복 검사. 객체 목록만 돌려준다.
  idList(o: Obj, key: string, path: string): Obj[] {
    const list = this.arr(o, key, path) ?? [];
    const seen = new Set<string>();
    const result: Obj[] = [];
    list.forEach((item, i) => {
      const p = `${path}.${key}[${i}]`;
      if (!this.obj(item, p)) return;
      this.str(item, 'id', p);
      const id = item.id as string;
      if (seen.has(id)) this.fail(p, `id "${id}" 중복`);
      seen.add(id);
      result.push(item);
    });
    return result;
  }

  ref(id: unknown, ids: ReadonlySet<string>, path: string, what: string): void {
    if (typeof id === 'string' && !ids.has(id)) this.fail(path, `${what}에 없는 id "${id}"`);
  }
}

export function idsOf(list: Obj[]): Set<string> {
  return new Set(list.map((o) => o.id).filter((id): id is string => typeof id === 'string'));
}

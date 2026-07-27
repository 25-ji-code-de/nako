/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * /recommend 的参数归一。
 *
 * GET 与 POST 是**同一个操作的两个入口**，此前各写各的校验：
 *
 *   topK          GET 走 parseInt 再夹逼；POST 只判 `x > 0 && x <= 20`
 *                 → POST 传 "10" 原样穿过去（字符串），传 3.7 得到小数，
 *                   传 true 也过（`true > 0` 是 true），最后交给 Vectorize
 *   excludeRecent GET 一定得到 string[]；POST 直接原样透传
 *                 → 传 [null] 时 extractRecentStickers 里 `msg.match` 抛，
 *                   500 而不是 400
 *
 * 两个入口对同一个操作给出不同结果，而且不报错。
 * 这批测试盯的就是"两边必须一致"。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const {
  normalizeTopK,
  normalizeExcludeRecent,
  TOP_K_DEFAULT,
  TOP_K_MIN,
  TOP_K_MAX,
  EXCLUDE_RECENT_MAX,
} = await import('../src/handlers/recommend-params.ts');

describe('normalizeTopK', () => {
  test('合法数字原样通过', () => {
    for (const n of [1, 5, 19, 20]) assert.equal(normalizeTopK(n), n);
  });

  test('数字字符串也认 —— GET 只能给字符串', () => {
    assert.equal(normalizeTopK('10'), 10);
    assert.equal(normalizeTopK('  8  '), 8);
  });

  test('越界回落到默认值', () => {
    for (const n of [0, -1, 21, 1000, '0', '999']) {
      assert.equal(normalizeTopK(n), TOP_K_DEFAULT, JSON.stringify(n));
    }
  });

  test('小数被截断为整数', () => {
    // Vectorize 的 topK 要整数；3.7 原样传过去是没定义的行为
    assert.equal(normalizeTopK(3.7), 3);
    assert.equal(normalizeTopK('3.7'), 3);
  });

  test('布尔不算数字 —— `true > 0` 是 true，这正是原来漏掉的', () => {
    assert.equal(normalizeTopK(true), TOP_K_DEFAULT);
    assert.equal(normalizeTopK(false), TOP_K_DEFAULT);
  });

  test('其余一切非法输入回落到默认值，且永远返回数字', () => {
    for (const v of [null, undefined, '', 'abc', NaN, Infinity, -Infinity, {}, [], [5], () => 5]) {
      const r = normalizeTopK(v);
      assert.equal(typeof r, 'number', JSON.stringify(v));
      assert.ok(Number.isInteger(r), `${JSON.stringify(v)} → ${r} 不是整数`);
      assert.ok(r >= TOP_K_MIN && r <= TOP_K_MAX, `${JSON.stringify(v)} → ${r} 越界`);
    }
  });

  test('无论输入是什么，输出恒为 [MIN, MAX] 内的整数', () => {
    const inputs = [0, 1, 20, 21, -5, 3.7, '7', '  ', true, null, {}, 'NaN', 1e9];
    for (const v of inputs) {
      const r = normalizeTopK(v);
      assert.ok(Number.isInteger(r) && r >= TOP_K_MIN && r <= TOP_K_MAX, `${JSON.stringify(v)} → ${r}`);
    }
  });
});

describe('normalizeExcludeRecent', () => {
  test('字符串数组原样保留', () => {
    assert.deepEqual(normalizeExcludeRecent(['a', 'b']), ['a', 'b']);
  });

  test('comma-separated 字符串（GET 的形式）拆开并去空', () => {
    assert.deepEqual(normalizeExcludeRecent('a, b ,,c'), ['a', 'b', 'c']);
    assert.deepEqual(normalizeExcludeRecent(''), []);
  });

  test('数组里的非字符串元素被跳过，而不是让下游抛', () => {
    /*
     * 这是原来 POST 路径的 500：extractRecentStickers 里
     * `msg.match(...)` 对 null / 数字 / 对象都会抛。
     */
    assert.deepEqual(normalizeExcludeRecent([null, 'ok', 42, {}, undefined, 'yes']), ['ok', 'yes']);
    assert.deepEqual(normalizeExcludeRecent([null]), []);
  });

  test('非数组非字符串一律得到空数组', () => {
    for (const v of [null, undefined, 42, true, {}, () => {}]) {
      assert.deepEqual(normalizeExcludeRecent(v), [], JSON.stringify(v));
    }
  });

  test('过长时只保留最近若干条', () => {
    const many = Array.from({ length: EXCLUDE_RECENT_MAX + 20 }, (_, i) => `m${i}`);
    const r = normalizeExcludeRecent(many);
    assert.equal(r.length, EXCLUDE_RECENT_MAX);
    assert.equal(r[r.length - 1], `m${many.length - 1}`, '保留的应当是最近的那些');
  });

  test('输出永远是数组，且每一项都是字符串', () => {
    const inputs = [['a', null, 1], 'x,y', null, 42, [[]], [{}, 'z']];
    for (const v of inputs) {
      const r = normalizeExcludeRecent(v);
      assert.ok(Array.isArray(r), JSON.stringify(v));
      for (const item of r) assert.equal(typeof item, 'string', `${JSON.stringify(v)} → ${JSON.stringify(r)}`);
    }
  });
});

describe('两个入口都真的走了归一', () => {
  /*
   * 上面那些只测了归一函数本身。**函数对了不代表被调用了** ——
   * 反向验证时我把 POST 分支改回旧写法，所有用例照样全绿，
   * 因为没有任何一条盯着"handler 确实在用它"。
   *
   * 这里静态扫 handler 源码：两个解析分支都必须走 normalize*，
   * 且不许再出现旧的手写夹逼。
   */
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'src/handlers/recommend.ts'),
    'utf8',
  );

  /** 取一个函数体（到下一个顶层 `}` 为止）。 */
  function fnBody(name) {
    const re = new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`);
    const m = re.exec(source);
    assert.ok(m, `找不到 ${name}`);
    return m[0];
  }

  for (const fn of ['parseGetRequest', 'parsePostRequest']) {
    test(`${fn} 用 normalizeTopK`, () => {
      assert.match(fnBody(fn), /normalizeTopK\(/);
    });

    test(`${fn} 用 normalizeExcludeRecent`, () => {
      assert.match(fnBody(fn), /normalizeExcludeRecent\(/);
    });

    test(`${fn} 里没有手写的 topK 夹逼`, () => {
      const body = fnBody(fn);
      assert.ok(!/<=\s*20|>\s*0\s*&&/.test(body), `${fn} 里还有手写夹逼：${body}`);
      assert.ok(!/parseInt\s*\(/.test(body), `${fn} 里还在自己 parseInt`);
    });
  }

  test('两个函数的 prompt 长度上限用同一个常量', () => {
    // 原来两处都写死 500，改一处忘另一处就会漂移。
    // 只看 prompt 的长度判断 —— `filter(s => s.length > 0)` 这种不算
    const literals = [...source.matchAll(/prompt\.length\s*>\s*(\d+)/g)].map((m) => m[1]);
    assert.deepEqual(literals, [], `还有写死的 prompt 长度上限：${literals.join(', ')}`);
    assert.equal([...source.matchAll(/PROMPT_MAX_LEN/g)].length >= 2, true);
  });
});

describe('两个入口给出一致的结果', () => {
  /*
   * 这才是重点。原来 GET 和 POST 各写各的，同一个值走两条路会得到
   * 不同的东西 —— 而且都不报错。
   */
  const SAME = [
    ['10', 10],
    ['3.7', 3],
    ['0', TOP_K_DEFAULT],
    ['999', TOP_K_DEFAULT],
    ['abc', TOP_K_DEFAULT],
    ['', TOP_K_DEFAULT],
  ];

  for (const [raw, expected] of SAME) {
    test(`topK=${JSON.stringify(raw)} 两边都得到 ${expected}`, () => {
      // GET 拿到的永远是字符串；POST 可能是字符串也可能是数字
      assert.equal(normalizeTopK(raw), expected, 'GET 形式');
      const asNumber = Number(raw);
      if (Number.isFinite(asNumber)) {
        assert.equal(normalizeTopK(asNumber), expected, 'POST 传数字');
      }
    });
  }

  test('excludeRecent 两种形式等价', () => {
    // GET: "a,b,c"    POST: ["a","b","c"]
    assert.deepEqual(normalizeExcludeRecent('a,b,c'), normalizeExcludeRecent(['a', 'b', 'c']));
  });
});

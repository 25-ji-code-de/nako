/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * getPersona 的测试。
 *
 * 原实现是 `const config = PERSONAS[name]; if (!config) throw`。
 * 用真值判断做存在性检查，会让**原型链上的键**通过：
 *
 *   __proto__      → Object.prototype（真值）
 *   constructor    → Object 构造函数（真值）
 *   toString / valueOf / hasOwnProperty → 对应函数（真值）
 *
 * 后果是「未知 persona」检查形同虚设，拿到一个根本不是 PersonaConfig 的对象；
 * 而且 persona 名会被拼进 reportUsage 写入 D1 的 metric 名
 * （`${persona}_conversation`，见 handlers/chat.ts:219）。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { getPersona, PERSONAS, PERSONA_NAMES } = await import('../src/personas/index.ts');

describe('已注册的人设', () => {
  test('每个都能取到', () => {
    for (const name of PERSONA_NAMES) {
      const config = getPersona(name);
      assert.ok(config, name);
      assert.equal(config, PERSONAS[name]);
    }
  });

  test('缺省是 nako', () => {
    assert.equal(getPersona(), PERSONAS.nako);
    assert.equal(getPersona(undefined), PERSONAS.nako);
    assert.equal(getPersona(''), PERSONAS.nako, '空串按缺省处理');
  });

  test('PERSONA_NAMES 与 PERSONAS 一致', () => {
    assert.deepEqual([...PERSONA_NAMES].sort(), Object.keys(PERSONAS).sort());
    assert.ok(PERSONA_NAMES.includes('nako'));
  });
});

describe('未知人设被拒', () => {
  test('普通的未知名字抛异常', () => {
    for (const name of ['unknown', 'Nako', 'NAKO', 'nako ', ' nako']) {
      assert.throws(() => getPersona(name), /Unknown persona/, JSON.stringify(name));
    }
  });

  test('原型链上的键必须被拒 —— 这是原实现的漏洞', () => {
    for (const name of [
      '__proto__',
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
    ]) {
      assert.throws(
        () => getPersona(name),
        /Unknown persona/,
        `${name} 不该通过 —— 它在 Object.prototype 上`,
      );
    }
  });

  test('错误信息列出可用人设，便于排查', () => {
    try {
      getPersona('nope');
      assert.fail('应当抛出');
    } catch (err) {
      for (const name of PERSONA_NAMES) {
        assert.ok(err.message.includes(name), `错误信息应含 ${name}`);
      }
    }
  });
});

describe('返回值确实是 PersonaConfig', () => {
  test('每个人设都有必需字段', () => {
    for (const name of PERSONA_NAMES) {
      const config = getPersona(name);
      assert.equal(typeof config, 'object', name);
      assert.notEqual(config, null, name);
      // 拿到 Object.prototype 或函数时这些断言会失败
      assert.ok(!(config instanceof Function), `${name} 不该是函数`);
      assert.notEqual(config, Object.prototype, `${name} 不该是 Object.prototype`);
    }
  });
});

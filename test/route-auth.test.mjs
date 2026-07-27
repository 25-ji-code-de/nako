/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 业务 API 一律在鉴权之后。
 *
 * ── 为什么这一条在本仓格外重要 ──────────────────────────────────
 *
 * `/api/chat` 与 `/api/recommend` 背后是**按量计费的推理 API**。
 * 绕过鉴权不只是数据泄漏，是直接让任何人烧你的额度 —— 而账单要到月底
 * 才会告诉你这件事。
 *
 * 当前结构是对的：`/` 与 `/health` 显式公开（且只认 GET/HEAD），
 * 其余全部在 `authenticate` 之后。这批测试是把这个性质钉住。
 *
 * ── 这里测的是结构，不是行为 ────────────────────────────────────
 *
 * `authenticate` 来自 sekai-worker-kit，要跑它得搭 D1 与 token 表；
 * 而本仓其余测试都是纯函数级、零依赖的（CI 里连 npm ci 都不跑）。
 * 为了不把这一条变成整仓最重的测试，这里读源码断言**顺序**：
 *
 *   公开分支 → authenticate → 401 拦截 → 业务分发
 *
 * 顺序错了就是绕过。行为层面的覆盖由 gateway 那套（真 SQL + 真请求）
 * 承担，两仓用的是同一个 `authenticate`。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/index.ts'), 'utf8');

/** 源码里各个关键位置的偏移。 */
const at = {
  publicBranch: src.indexOf('url.pathname === "/health"'),
  authenticate: src.indexOf('await authenticate(request, env)'),
  reject: src.indexOf('"UNAUTHORIZED"'),
  chat: src.indexOf('url.pathname === "/api/chat"'),
  recommend: src.indexOf('url.pathname === "/api/recommend"'),
};

describe('鉴权在业务分发之前', () => {
  test('每个锚点都找得到（否则下面几条是空跑）', () => {
    for (const [name, pos] of Object.entries(at)) {
      assert.ok(pos >= 0, `源码里找不到 ${name} —— 分发方式变了，这批测试要跟着改`);
    }
  });

  test('authenticate 排在所有业务路径之前', () => {
    assert.ok(at.authenticate < at.chat, '/api/chat 排在了鉴权之前');
    assert.ok(at.authenticate < at.recommend, '/api/recommend 排在了鉴权之前');
  });

  test('鉴权失败在业务分发之前就返回 401', () => {
    assert.ok(at.reject > at.authenticate, '401 分支在 authenticate 之前？');
    assert.ok(at.reject < at.chat, '鉴权失败没有在分发前拦下');
    assert.ok(at.reject < at.recommend, '鉴权失败没有在分发前拦下');
  });

  test('401 分支是 return，不是记个日志继续往下走', () => {
    const around = src.slice(at.authenticate, at.chat);
    assert.match(
      around,
      /if \(!user\) \{\s*return createErrorResponse\("UNAUTHORIZED"/,
      '鉴权失败没有立刻 return',
    );
  });
});

describe('公开端点的范围', () => {
  test('只有 / 与 /health 在鉴权之前', () => {
    /*
     * 取「文件开头到 authenticate」这一段，看里面出现了哪些路径比较。
     * 多出任何一条，就是多了一个不需要登录的入口。
     */
    const beforeAuth = src.slice(0, at.authenticate);
    const paths = [...beforeAuth.matchAll(/url\.pathname === "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      [...new Set(paths)].sort(),
      ['/', '/health'],
      '鉴权之前出现了预期之外的路径',
    );
  });

  test('公开端点只认 GET / HEAD —— POST / 会落到鉴权', () => {
    const beforeAuth = src.slice(0, at.authenticate);
    assert.match(
      beforeAuth,
      /request\.method === "GET" \|\| request\.method === "HEAD"/,
      '公开分支没有限定方法 —— 任意方法都能命中它',
    );
  });

  test('公开端点不返回任何用户数据', () => {
    // 它现在返回的是 service / status / version / routes，全是常量
    //
    // 切到 authenticate **所在行的行首**，而不是 `await authenticate(` 的位置 ——
    // 后者会把同一行的 `const user = ` 一起划进来，于是这条断言会被自己的
    // 切片边界绊倒（第一版就是这样）。
    const authLineStart = src.lastIndexOf('\n', at.authenticate);
    const branch = src.slice(at.publicBranch, authLineStart);
    for (const leak of ['user', 'email', 'token', 'env.', 'DB']) {
      assert.ok(
        !new RegExp(`\\b${leak.replace('.', '\\.')}`).test(branch),
        `公开分支里出现了 ${leak}`,
      );
    }
  });
});

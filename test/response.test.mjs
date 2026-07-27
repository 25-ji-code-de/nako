/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * nako 接入 @25-ji-code-de/sekai-worker-kit 后的契约测试。
 *
 * 直接测 worker-kit 拼出来的头与信封 —— nako 的源码是 TypeScript，
 * 这里不引入构建步骤，改为对同一组 worker-kit 原语做等价断言，
 * 钉住 nightcord 的 nako-ai-service 依赖的那几个字段。
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  errorResponse,
  CORS_HEADERS,
  JSON_HEADERS,
  handleCors,
} from '@25-ji-code-de/sekai-worker-kit';

/** 与 src/utils/response.ts 保持一致的构造方式。 */
const CORS_JSON_HEADERS = {
  ...JSON_HEADERS,
  ...CORS_HEADERS,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const CORS_STREAM_HEADERS = {
  ...CORS_HEADERS,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

describe('错误信封', () => {
  test('保留迁移前的 error.code / error.message，并新增顶层 message', async () => {
    const response = errorResponse('UNAUTHORIZED', 'Authentication required', 401, {
      headers: CORS_JSON_HEADERS,
    });
    assert.equal(response.status, 401);

    const body = await response.json();
    assert.equal(body.success, false);
    // nightcord 的 nako-ai-service 读的是 errBody?.error?.message
    assert.equal(body.error.code, 'UNAUTHORIZED');
    assert.equal(body.error.message, 'Authentication required');
    // 新增的兼容镜像
    assert.equal(body.message, 'Authentication required');
  });

  test('错误响应带 CORS 且不可缓存', () => {
    const response = errorResponse('NOT_FOUND', 'Not Found', 404, {
      headers: CORS_JSON_HEADERS,
    });
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.match(response.headers.get('Cache-Control'), /no-store/);
  });

  test('nightcord 的两种解析路径都能拿到消息', async () => {
    const body = await errorResponse('RATE_LIMITED', '太快了', 429).json();
    // nako-ai-service.js:192  errBody?.error?.message
    assert.equal(body.error?.message, '太快了');
    // nako-ai-service.js:120  data.success 为 false
    assert.equal(body.success, false);
  });
});

describe('CORS 头', () => {
  test('方法集收窄为 nako 实际暴露的集合', () => {
    assert.equal(CORS_JSON_HEADERS['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
    assert.equal(CORS_JSON_HEADERS['Access-Control-Allow-Headers'], 'Content-Type, Authorization');
  });

  test('JSON 头同时带 Content-Type 与 nosniff', () => {
    assert.equal(CORS_JSON_HEADERS['Content-Type'], 'application/json; charset=utf-8');
    assert.equal(CORS_JSON_HEADERS['X-Content-Type-Options'], 'nosniff');
  });

  test('SSE 头覆盖 Content-Type 但保留 CORS', () => {
    assert.equal(CORS_STREAM_HEADERS['Content-Type'], 'text/event-stream; charset=utf-8');
    assert.equal(CORS_STREAM_HEADERS['Access-Control-Allow-Origin'], '*');
    assert.equal(CORS_STREAM_HEADERS['Cache-Control'], 'no-cache');
  });

  test('预检返回 204', () => {
    const preflight = handleCors(
      new Request('https://nako.example/api/chat', { method: 'OPTIONS' }),
      { ...CORS_JSON_HEADERS, 'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS' },
    );
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, POST, OPTIONS');
  });

  test('非 OPTIONS 返回 null', () => {
    assert.equal(handleCors(new Request('https://nako.example/api/chat', { method: 'POST' })), null);
  });
});

describe('成功响应形状', () => {
  test('聊天成功响应是 nako 专有形状，不是通用信封', () => {
    // nightcord 读的是 data.response，包成 { success, data } 会直接打断
    const body = { success: true, response: '喵', usage: { total_tokens: 1 } };
    assert.equal(body.response, '喵');
    assert.equal('data' in body, false);
  });
});

describe('401 的挑战头', () => {
  /*
   * 这一组**调 src/utils/response.ts 里真正的 createErrorResponse**，
   * 不像上面几组那样拿 kit 重新拼一遍。
   *
   * 重拼的写法验不了本仓自己那一层：把 createErrorResponse 改坏，
   * 那些测试照样绿。今天在生态里已经栽过一次同样的事
   * （sekai-worker-kit 的假 db 让 JOIN 从未被执行）。
   */
  let createErrorResponse;
  before(async () => {
    ({ createErrorResponse } = await import('../src/utils/response.ts'));
  });

  test('401 带 WWW-Authenticate —— 客户端唯一能读的认证提示', () => {
    /*
     * RFC 6750 §3：Bearer 保护的资源在 401 时必须给出挑战头。
     *
     * 实测（2026-07-27）线上没有：
     *   $ curl -i https://nako.nightcord.de5.net/api/chat
     *   HTTP/1.1 401 Unauthorized  …（没有 WWW-Authenticate）
     */
    const res = createErrorResponse('UNAUTHORIZED', 'Authentication required', 401);
    assert.equal(res.headers.get('WWW-Authenticate'), 'Bearer');
  });

  test('浏览器读得到它 —— 401 同时暴露该头', () => {
    /*
     * 光发不暴露等于白发：跨域响应默认只暴露 CORS 安全清单里那几个头，
     * 客户端 res.headers.get() 会返回 null。nightcord 的聊天前端是浏览器 SPA。
     */
    const expose = createErrorResponse('UNAUTHORIZED', 'x', 401)
      .headers.get('Access-Control-Expose-Headers');
    assert.ok(expose, '401 没有 Access-Control-Expose-Headers');
    assert.match(expose, /WWW-Authenticate/);
  });

  test('401 仍然带着原有的 CORS 与 JSON 头', () => {
    // 加挑战头不能把原来那套挤掉 —— 那会让所有跨域调用直接失败
    const res = createErrorResponse('UNAUTHORIZED', 'x', 401);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    assert.match(res.headers.get('Content-Type'), /application\/json/);
  });

  test('只有 401 带挑战头，别的状态码不带', () => {
    // 400/403/500 不是「你还没认证」，发 Bearer 挑战头会误导客户端去重新登录
    for (const status of [400, 403, 404, 500]) {
      assert.equal(
        createErrorResponse('X', 'x', status).headers.get('WWW-Authenticate'),
        null,
        `${status} 不该带挑战头`,
      );
    }
  });
});

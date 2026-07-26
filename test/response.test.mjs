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

import { test, describe } from 'node:test';
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

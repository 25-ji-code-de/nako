// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from '../src/models/openai.ts';
import { getPersona } from '../src/personas/index.ts';
import {
  resolveOpenAICredentials,
  resolveOpenAIModelForId,
} from '../src/config/llm.ts';

const env = {
  OPENAI_ENDPOINT: 'https://api.deepseek.com',
  OPENAI_API_KEY: 'test-deepseek-key',
  OPENAI_ENDPOINT_NAKO: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
  OPENAI_API_KEY_NAKO: 'test-nako-key',
  OPENAI_ENDPOINT_YUI: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  OPENAI_API_KEY_YUI: 'test-yui-key',
};

const cases = [
  ['nako', 'qwen3.7-flash', 'dashscope.aliyuncs.com', 'test-nako-key'],
  ['yui', 'qwen3.7-flash', 'dashscope.aliyuncs.com', 'test-yui-key'],
  ['asagi', 'deepseek-flash', 'api.deepseek.com', 'test-deepseek-key'],
  ['miku', 'deepseek-flash', 'api.deepseek.com', 'test-deepseek-key'],
];

for (const [id, expectedModel, expectedHost, expectedKey] of cases) {
  test(`${id} sends its cheaper model to the correct provider with thinking disabled`, async (t) => {
    const persona = getPersona(id);
    const { endpoint, apiKey } = resolveOpenAICredentials(env, id);
    const model = resolveOpenAIModelForId(env, id, persona);
    let requestBody;
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(new URL(url).hostname, expectedHost);
      assert.ok(url.endsWith('/v1/chat/completions'));
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, `Bearer ${expectedKey}`);
      requestBody = JSON.parse(init.body);
      return Response.json({
        choices: [{ message: { content: '今天也在呢。' } }],
        usage: { prompt_tokens: 800, completion_tokens: 12, total_tokens: 812 },
      });
    });

    const provider = new OpenAIProvider(endpoint, apiKey, model, persona.modelConfig);
    const result = await provider.chat('人设提示', '在吗', 'tester', [], false, id);

    assert.equal(requestBody.model, expectedModel);
    assert.equal(requestBody.stream, false);
    assert.deepEqual(requestBody.messages, [
      { role: 'system', content: '人设提示' },
      { role: 'user', content: '[tester]: 在吗' },
    ]);
    if (expectedHost === 'dashscope.aliyuncs.com') {
      assert.equal(requestBody.enable_thinking, false);
      assert.equal('thinking' in requestBody, false);
    } else {
      assert.deepEqual(requestBody.thinking, { type: 'disabled' });
      assert.equal('enable_thinking' in requestBody, false);
    }
    assert.deepEqual(result, {
      response: '今天也在呢。',
      usage: { promptTokens: 800, completionTokens: 12, totalTokens: 812 },
    });
  });
}

for (const [model, expectedThinking] of [
  ['qwen3.7-flash', { enable_thinking: false }],
  ['deepseek-flash', { thinking: { type: 'disabled' } }],
]) {
  test(`${model} also disables thinking for streamed replies`, async (t) => {
    const response = new Response('data: {"choices":[]}\n\ndata: [DONE]\n\n');
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.stream, true);
      for (const [name, value] of Object.entries(expectedThinking)) {
        assert.deepEqual(body[name], value);
      }
      return response;
    });
    const provider = new OpenAIProvider(env.OPENAI_ENDPOINT, 'test-key', model, {
      enableThinking: false,
    });
    const stream = await provider.chat('人设提示', '你好', 'tester', [], true);
    assert.equal(stream, response.body);
    assert.match(await new Response(stream).text(), /data: \[DONE\]/);
  });
}

test('thinking controls respect model overrides and the upstream default', async (t) => {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return Response.json({ choices: [{ message: { content: '你好' } }] });
  });
  for (const [model, config] of [
    ['qwen3.7-flash', { enableThinking: true }],
    ['deepseek-flash', { enableThinking: true }],
    ['deepseek-flash', {}],
    ['gpt-4.1-mini', { enableThinking: false }],
  ]) {
    const provider = new OpenAIProvider(env.OPENAI_ENDPOINT, 'test-key', model, config);
    await provider.chat('人设提示', '你好', 'tester', []);
  }
  assert.equal(bodies[0].enable_thinking, true);
  assert.deepEqual(bodies[1].thinking, { type: 'enabled' });
  for (const body of bodies.slice(2)) {
    assert.equal('enable_thinking' in body, false);
    assert.equal('thinking' in body, false);
  }
});

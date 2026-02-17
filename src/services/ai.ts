// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env, HistoryMessage, AIResponse } from "../types";
import type { ModelProvider } from "../models/base";
import { WorkersAIProvider } from "../models/workers-ai";
import { OpenAIProvider } from "../models/openai";
import { getPersona } from "../personas";

/**
 * 创建模型提供商实例
 * @param env Cloudflare Workers 环境变量
 * @param personaName 人设名称
 * @returns 模型提供商实例
 */
function createModelProvider(env: Env, personaName?: string): ModelProvider {
  const persona = getPersona(personaName);

  if (persona.provider === "openai") {
    // 使用 OpenAI 格式 API
    const endpoint = env.OPENAI_ENDPOINT;
    const apiKey = env.OPENAI_API_KEY;

    if (!endpoint || !apiKey) {
      throw new Error(
        "OpenAI API configuration missing. Please set OPENAI_ENDPOINT and OPENAI_API_KEY in Cloudflare Secrets."
      );
    }

    const model = persona.openai?.model || "gpt-3.5-turbo";

    return new OpenAIProvider(
      endpoint,
      apiKey,
      model,
      persona.modelConfig
    );
  } else {
    // 使用 Workers AI
    return new WorkersAIProvider(env.AI, persona.modelConfig);
  }
}

/**
 * 生成 AI 回复（支持多人设）
 * @param env Cloudflare Workers 环境变量
 * @param userMessage 用户消息
 * @param userId 用户 ID
 * @param history 历史消息
 * @param stream 是否流式输出
 * @param personaName 人设名称（可选，默认 "nako"）
 * @returns AI 回复或流式响应
 */
export async function generateAIResponse(
  env: Env,
  userMessage: string,
  userId: string,
  history: HistoryMessage[],
  stream: boolean = false,
  personaName?: string
): Promise<AIResponse | ReadableStream> {
  const persona = getPersona(personaName);
  const provider = createModelProvider(env, personaName);
  const systemPrompt = persona.getSystemPrompt();

  return provider.chat(systemPrompt, userMessage, userId, history, stream, personaName);
}

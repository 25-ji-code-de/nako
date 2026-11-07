// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { HistoryMessage, AIResponse } from "../types/index.ts";

export interface ModelProvider {
  chat(
    systemPrompt: string,
    userMessage: string,
    userId: string,
    history: HistoryMessage[],
    stream?: boolean,
    personaName?: string
  ): Promise<AIResponse | ReadableStream>;
}

export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  /**
   * 模型深度思考开关。OpenAI 兼容接口按 Qwen / DeepSeek 协议传参；
   * 未指定时使用上游默认值。Workers AI 默认 true，CF Qwen3 关闭后可能 content 为空。
   */
  enableThinking?: boolean;
}

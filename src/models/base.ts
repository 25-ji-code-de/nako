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
   * 模型 thinking（Qwen3 等）。默认 true。
   * 注意：CF Workers AI 上对 Qwen3 关 thinking 容易 content 为空。
   */
  enableThinking?: boolean;
}

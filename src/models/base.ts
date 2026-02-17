// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { HistoryMessage, AIResponse } from "../types";

/**
 * 基础模型提供商接口
 */
export interface ModelProvider {
  /**
   * 生成对话回复
   * @param systemPrompt 系统提示词
   * @param userMessage 用户消息
   * @param userId 用户 ID
   * @param history 历史消息
   * @param stream 是否流式输出
   * @param personaName 当前PERSONA名称（用于区分历史消息中的角色）
   */
  chat(
    systemPrompt: string,
    userMessage: string,
    userId: string,
    history: HistoryMessage[],
    stream?: boolean,
    personaName?: string
  ): Promise<AIResponse | ReadableStream>;
}

/**
 * 模型配置
 */
export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

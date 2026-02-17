// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ModelConfig } from "../models/base";

/**
 * 人设配置接口
 */
export interface PersonaConfig {
  /**
   * 人设名称
   */
  name: string;

  /**
   * 获取系统提示词
   */
  getSystemPrompt(): string;

  /**
   * 模型提供商类型
   */
  provider: "workers-ai" | "openai";

  /**
   * OpenAI 格式 API 配置（仅当 provider = "openai" 时需要）
   */
  openai?: {
    model: string;
  };

  /**
   * 模型配置
   */
  modelConfig?: ModelConfig;
}

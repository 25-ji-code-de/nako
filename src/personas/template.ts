// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { PersonaConfig } from "./base";

/**
 * 新人设模板
 * 复制此文件并修改内容来创建新人设
 */
export const templatePersona: PersonaConfig = {
  name: "模板人设",

  // 选择模型提供商：
  // - "workers-ai": 使用 Cloudflare Workers AI（Qwen 3 30B）
  // - "openai": 使用 OpenAI 格式 API（需要配置 OPENAI_ENDPOINT 和 OPENAI_API_KEY）
  provider: "openai",

  // OpenAI 格式 API 配置（仅当 provider = "openai" 时需要）
  openai: {
    model: "gpt-3.5-turbo",  // 或 gpt-4, claude-3-5-sonnet, 等
  },

  // 模型参数配置
  modelConfig: {
    temperature: 0.7,        // 0-2，越高越随机
    maxTokens: 1024,         // 最大输出长度
    topP: 0.9,               // 0-1，nucleus sampling
    frequencyPenalty: 0,     // -2 到 2，降低重复
    presencePenalty: 0,      // -2 到 2，鼓励新话题
  },

  getSystemPrompt(): string {
    // 在这里填写你的人设提示词
    return `你是一个新的 AI 助手。

【角色设定】
在这里填写角色的基本信息、性格特点等。

【说话风格】
在这里描述说话的方式、语气、习惯用语等。

【行为准则】
在这里定义角色的行为规范、禁忌事项等。
`;
  }
};

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { PersonaConfig } from "./base.ts";

/** 新人设模板：复制后改内容，在 personas/index.ts 注册。 */
export const templatePersona: PersonaConfig = {
  name: "模板人设",
  provider: "openai",
  openai: {
    model: "deepseek-chat",
  },
  modelConfig: {
    temperature: 0.7,
    maxTokens: 1024,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },

  getSystemPrompt(): string {
    return `你是一个新的 AI 助手。

【角色设定】
在这里填写角色的基本信息、性格特点等。

【说话风格】
在这里描述说话的方式、语气、习惯用语等。

【行为准则】
在这里定义角色的行为规范、禁忌事项等。
`;
  },
};

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { PersonaConfig } from "./base";
import { nakoPersona } from "./nako";
import { asagiPersona } from "./asagi";
import { mikuPersona } from "./miku";
import { yuiPersona } from "./yui";
// import { templatePersona } from "./template";

/**
 * 所有可用的人设配置
 * 添加新人设：
 * 1. 在 personas 目录创建新文件（参考 template.ts）
 * 2. 在这里导入并添加到 PERSONAS 对象中
 */
export const PERSONAS: Record<string, PersonaConfig> = {
  nako: nakoPersona,
  asagi: asagiPersona,
  miku: mikuPersona,
  yui: yuiPersona,
  // template: templatePersona,  // 取消注释来启用模板人设
};

/**
 * 获取人设配置
 * @param persona 人设名称，默认为 "nako"
 * @returns 人设配置对象
 */
export function getPersona(persona?: string): PersonaConfig {
  const personaName = persona || "nako";
  const config = PERSONAS[personaName];

  if (!config) {
    throw new Error(`Unknown persona: ${personaName}. Available: ${Object.keys(PERSONAS).join(", ")}`);
  }

  return config;
}

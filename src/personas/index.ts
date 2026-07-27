// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { PersonaConfig } from "./base.ts";
import { nakoPersona } from "./nako.ts";
import { asagiPersona } from "./asagi.ts";
import { mikuPersona } from "./miku.ts";
import { yuiPersona } from "./yui.ts";
// import { templatePersona } from "./template.ts";

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

/** 可用人设名，供错误信息与外部校验使用。 */
export const PERSONA_NAMES = Object.keys(PERSONAS);

/**
 * 获取人设配置
 * @param persona 人设名称，默认为 "nako"
 * @returns 人设配置对象
 */
export function getPersona(persona?: string): PersonaConfig {
  const personaName = persona || "nako";

  // 必须用 Object.hasOwn 而不是 `PERSONAS[name]` 的真值判断 ——
  // 后者会让原型链上的键通过检查：__proto__ 返回 Object.prototype，
  // constructor / toString / valueOf / hasOwnProperty 返回对应函数，全是真值。
  // 结果是「未知 persona」检查形同虚设，拿到一个根本不是 PersonaConfig 的对象，
  // 并且这个名字还会被拼进 reportUsage 写入的 metric 名里。
  if (!Object.hasOwn(PERSONAS, personaName)) {
    throw new Error(`Unknown persona: ${personaName}. Available: ${PERSONA_NAMES.join(", ")}`);
  }

  return PERSONAS[personaName];
}

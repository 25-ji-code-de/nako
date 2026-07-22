// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env } from "../types";
import type { PersonaConfig } from "../personas/base";

export const DEFAULT_WORKERS_AI_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
export const DEFAULT_OPENAI_MODEL = "deepseek-v4-flash";

/** WORKERS_AI_MODEL → persona.workersAi.model → 默认 */
export function resolveWorkersAIModel(env: Env, persona: PersonaConfig): string {
  return (
    env.WORKERS_AI_MODEL?.trim() ||
    persona.workersAi?.model?.trim() ||
    DEFAULT_WORKERS_AI_MODEL
  );
}

export function resolveOpenAICredentials(env: Env): {
  endpoint: string;
  apiKey: string;
} {
  const endpoint = env.OPENAI_ENDPOINT?.trim();
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!endpoint || !apiKey) {
    throw new Error(
      "OpenAI API configuration missing. Set secrets OPENAI_ENDPOINT and OPENAI_API_KEY " +
        "(optional: OPENAI_MODEL or OPENAI_MODEL_<PERSONA_ID>). " +
        "Example: wrangler secret put OPENAI_ENDPOINT"
    );
  }

  return { endpoint, apiKey };
}

/** nako → NAKO；my-bot → MY_BOT */
export function personaIdToEnvSuffix(personaId: string | undefined): string {
  return (personaId || "nako").toUpperCase().replace(/[^\w]/g, "_");
}

/**
 * OPENAI_MODEL_<ID> → OPENAI_MODEL → persona.openai.model → 默认
 * 人设专属 secret 动态读取，新人设无需改 Env 类型。
 */
export function resolveOpenAIModelForId(
  env: Env,
  personaId: string | undefined,
  persona: PersonaConfig
): string {
  const suffix = personaIdToEnvSuffix(personaId);
  const envMap = env as unknown as Record<string, string | undefined>;
  const perPersona = envMap[`OPENAI_MODEL_${suffix}`]?.trim() || "";

  return (
    perPersona ||
    env.OPENAI_MODEL?.trim() ||
    persona.openai?.model?.trim() ||
    DEFAULT_OPENAI_MODEL
  );
}

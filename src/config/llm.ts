// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env } from "../types";
import type { PersonaConfig } from "../personas/base";

export const DEFAULT_WORKERS_AI_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
export const DEFAULT_OPENAI_MODEL = "deepseek-chat";

/** WORKERS_AI_MODEL → persona.workersAi.model → 默认 */
export function resolveWorkersAIModel(env: Env, persona: PersonaConfig): string {
  return (
    env.WORKERS_AI_MODEL?.trim() ||
    persona.workersAi?.model?.trim() ||
    DEFAULT_WORKERS_AI_MODEL
  );
}

/** nako → NAKO；my-bot → MY_BOT */
export function personaIdToEnvSuffix(personaId: string | undefined): string {
  return (personaId || "nako").toUpperCase().replace(/[^\w]/g, "_");
}

/** OPENAI_ENDPOINT_<ID> / OPENAI_API_KEY_<ID> → 全局 OPENAI_* */
export function resolveOpenAICredentials(
  env: Env,
  personaId?: string
): {
  endpoint: string;
  apiKey: string;
} {
  const suffix = personaIdToEnvSuffix(personaId);
  const envMap = env as unknown as Record<string, string | undefined>;

  const endpoint =
    envMap[`OPENAI_ENDPOINT_${suffix}`]?.trim() ||
    env.OPENAI_ENDPOINT?.trim() ||
    "";
  const apiKey =
    envMap[`OPENAI_API_KEY_${suffix}`]?.trim() ||
    env.OPENAI_API_KEY?.trim() ||
    "";

  if (!endpoint || !apiKey) {
    throw new Error(
      "OpenAI API configuration missing. Set OPENAI_ENDPOINT + OPENAI_API_KEY " +
        "(optional per-persona: OPENAI_ENDPOINT_<ID> / OPENAI_API_KEY_<ID> / OPENAI_MODEL_<ID>). " +
        "Example: wrangler secret put OPENAI_ENDPOINT"
    );
  }

  return { endpoint, apiKey };
}

/** OPENAI_MODEL_<ID> → OPENAI_MODEL → persona.openai.model → 默认 */
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

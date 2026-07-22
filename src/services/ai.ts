// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env, HistoryMessage, AIResponse } from "../types";
import type { ModelProvider } from "../models/base";
import { WorkersAIProvider } from "../models/workers-ai";
import { OpenAIProvider } from "../models/openai";
import { getPersona } from "../personas";
import {
  resolveOpenAICredentials,
  resolveOpenAIModelForId,
  resolveWorkersAIModel,
} from "../config/llm";

function createModelProvider(env: Env, personaName?: string): ModelProvider {
  const persona = getPersona(personaName);

  if (persona.provider === "openai") {
    const { endpoint, apiKey } = resolveOpenAICredentials(env);
    const model = resolveOpenAIModelForId(env, personaName, persona);

    return new OpenAIProvider(
      endpoint,
      apiKey,
      model,
      persona.modelConfig
    );
  }

  const model = resolveWorkersAIModel(env, persona);
  return new WorkersAIProvider(env.AI, persona.modelConfig, model);
}

export async function generateAIResponse(
  env: Env,
  userMessage: string,
  userId: string,
  history: HistoryMessage[],
  stream: boolean = false,
  personaName?: string
): Promise<AIResponse | ReadableStream> {
  const persona = getPersona(personaName);
  const provider = createModelProvider(env, personaName);
  const systemPrompt = persona.getSystemPrompt();

  return provider.chat(systemPrompt, userMessage, userId, history, stream, personaName);
}

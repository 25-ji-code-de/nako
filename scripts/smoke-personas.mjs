// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

// Direct provider smoke check using production prompts and model configuration.
// Bypasses Worker authentication and sticker handling; incurs provider API charges.
// Run: npm run smoke:personas -- --turns=1 [--persona=yui]

import fs from "node:fs";
import { parseArgs, parseEnv } from "node:util";
import { getPersona } from "../src/personas/index.ts";
import { OpenAIProvider } from "../src/models/openai.ts";
import {
  resolveOpenAICredentials,
  resolveOpenAIModelForId,
} from "../src/config/llm.ts";

const devVars = new URL("../.dev.vars", import.meta.url);
const env = {
  ...(fs.existsSync(devVars) ? parseEnv(fs.readFileSync(devVars, "utf8")) : {}),
  ...process.env,
};
const { values } = parseArgs({
  options: {
    turns: { type: "string", default: "3" },
    persona: { type: "string" },
  },
});
const turnLimit = Number(values.turns);
if (!Number.isInteger(turnLimit) || turnLimit < 1 || turnLimit > 3) {
  throw new Error("--turns must be an integer from 1 to 3");
}

const scenarios = {
  nako: ["在吗", "今天好累啊", "你是不是机器人"],
  asagi: ["在吗", "你今天心情怎么样", "正常说话好不好，别用我们"],
  miku: ["今天好累啊", "miku你喜欢吃什么", "你是AI吧"],
  yui: ["唯在吗", "你最近在cos什么", "你cos好好看啊"],
};
if (values.persona && !Object.hasOwn(scenarios, values.persona)) {
  throw new Error(`Unknown persona. Available: ${Object.keys(scenarios).join(", ")}`);
}

let failures = 0;
console.log("Production persona prompts; direct provider calls incur API charges.");
for (const [id, turns] of Object.entries(scenarios)) {
  if (values.persona && values.persona !== id) continue;

  let apiKey = "";
  try {
    const persona = getPersona(id);
    if (persona.provider !== "openai") {
      throw new Error("This smoke script only supports OpenAI-compatible providers");
    }
    const credentials = resolveOpenAICredentials(env, id);
    apiKey = credentials.apiKey;
    const model = resolveOpenAIModelForId(env, id, persona);
    const provider = new OpenAIProvider(
      credentials.endpoint,
      apiKey,
      model,
      persona.modelConfig
    );
    const history = [];
    console.log(`\n========== ${id} @ ${model} ==========`);

    for (const message of turns.slice(0, turnLimit)) {
      console.log(`USER: ${message}`);
      const started = Date.now();
      const result = await provider.chat(
        persona.getSystemPrompt(), message, "TestUser", history, false, id
      );
      const content = result.response.trim();
      if (!content) throw new Error("Provider returned an empty final reply");
      console.log(`BOT: (${Date.now() - started}ms) ${content.replace(/\n/g, " / ")}`);
      console.log(`TOKENS: input=${result.usage.promptTokens} output=${result.usage.completionTokens}`);
      history.push(
        { userId: "TestUser", message, isBot: false },
        { userId: id, message: content, isBot: true }
      );
    }
  } catch (error) {
    failures++;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${id}: ${apiKey ? message.replaceAll(apiKey, "[REDACTED]") : message}`);
  }
}
process.exitCode = failures ? 1 : 0;

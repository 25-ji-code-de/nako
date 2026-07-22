// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ModelConfig } from "../models/base";

export interface PersonaConfig {
  name: string;
  getSystemPrompt(): string;
  provider: "workers-ai" | "openai";
  /** provider=openai 时；模型可被 OPENAI_MODEL[_<ID>] 覆盖 */
  openai?: {
    model: string;
  };
  /** provider=workers-ai 时；可被 WORKERS_AI_MODEL 覆盖 */
  workersAi?: {
    model: string;
  };
  modelConfig?: ModelConfig;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

// Request types
export interface HistoryMessage {
  userId: string;
  message: string;
  isBot: boolean;
}

export interface ChatRequest {
  userId: string;
  message: string;
  history?: HistoryMessage[];
  stream?: boolean;
}

// Response types
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatSuccessResponse {
  success: true;
  response: string;
  reasoningContent?: string;
  usage: TokenUsage;
}

export interface ChatErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ChatResponse = ChatSuccessResponse | ChatErrorResponse;

// AI Service types
export interface AIResponse {
  response: string;
  reasoningContent?: string;
  usage: TokenUsage;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Environment bindings
export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  AUTH_DB: D1Database; // SEKAI Pass
  DB: D1Database; // pjsekai 统计
  ENVIRONMENT?: string;

  // OpenAI 兼容（secret / .dev.vars）
  OPENAI_ENDPOINT?: string;
  OPENAI_API_KEY?: string;
  /** 全局模型覆盖；低于 OPENAI_MODEL_<ID>，见 config/llm.ts */
  OPENAI_MODEL?: string;
  // 人设专属：OPENAI_MODEL_<注册 id 大写>，运行时动态读，不在此枚举

  WORKERS_AI_MODEL?: string;
}

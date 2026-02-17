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
  stream?: boolean;  // Enable streaming response
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
  reasoningContent?: string;  // Optional reasoning/thinking process
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
  reasoningContent?: string;  // Optional reasoning/thinking process
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
  AUTH_DB: D1Database;  // SEKAI Pass 数据库
  DB: D1Database;  // pjsekai 数据库（用于统计）
  ENVIRONMENT?: string;

  // OpenAI 格式 API 配置（从 Cloudflare Secrets 获取）
  OPENAI_ENDPOINT?: string;  // OpenAI 兼容 API 端点
  OPENAI_API_KEY?: string;   // API Key (sk-xxx)
}

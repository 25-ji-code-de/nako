// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ModelProvider, ModelConfig } from "./base";
import type { HistoryMessage, AIResponse } from "../types";
import { appendUserMessage, formatChatHistory } from "./format-history";

/** OpenAI 兼容 API 提供商 */
export class OpenAIProvider implements ModelProvider {
  private readonly fullEndpoint: string;

  constructor(
    endpoint: string,
    private apiKey: string,
    private model: string = "gpt-3.5-turbo",
    private config: ModelConfig = {}
  ) {
    this.fullEndpoint = this.normalizeEndpoint(endpoint);
  }

  /** 补全到 …/v1/chat/completions（已是完整路径则不动） */
  private normalizeEndpoint(endpoint: string): string {
    let normalized = endpoint.replace(/\/+$/, "");

    if (normalized.endsWith("/chat/completions")) {
      return normalized;
    }
    if (normalized.endsWith("/v1")) {
      return normalized + "/chat/completions";
    }
    return normalized + "/v1/chat/completions";
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    userId: string,
    history: HistoryMessage[],
    stream: boolean = false,
    personaName?: string
  ): Promise<AIResponse | ReadableStream> {
    const historyMessages = formatChatHistory(history, personaName, {
      limit: 30,
      mergeConsecutive: true,
    });
    appendUserMessage(historyMessages, userId, userMessage);

    const messages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
    ];

    const requestBody = {
      model: this.model,
      messages,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 1024,
      top_p: this.config.topP ?? 0.9,
      frequency_penalty: this.config.frequencyPenalty ?? 0,
      presence_penalty: this.config.presencePenalty ?? 0,
      stream,
    };

    const response = await fetch(this.fullEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    if (stream) {
      return response.body as ReadableStream;
    }

    const result = (await response.json()) as any;
    const responseText = result.choices?.[0]?.message?.content || "";

    return {
      response: responseText,
      usage: {
        promptTokens: result.usage?.prompt_tokens || 0,
        completionTokens: result.usage?.completion_tokens || 0,
        totalTokens: result.usage?.total_tokens || 0,
      },
    };
  }
}

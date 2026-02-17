// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ModelProvider, ModelConfig } from "./base";
import type { HistoryMessage, AIResponse } from "../types";

/**
 * OpenAI 格式 API 提供商（支持任何兼容 OpenAI 格式的 API）
 */
export class OpenAIProvider implements ModelProvider {
  private readonly fullEndpoint: string;

  constructor(
    endpoint: string,
    private apiKey: string,
    private model: string = "gpt-3.5-turbo",
    private config: ModelConfig = {}
  ) {
    // 智能补全endpoint路径，支持多种格式
    this.fullEndpoint = this.normalizeEndpoint(endpoint);
  }

  /**
   * 规范化endpoint，自动补全 /v1/chat/completions
   * 支持的输入格式：
   * - https://api.example.com → https://api.example.com/v1/chat/completions
   * - https://api.example.com/ → https://api.example.com/v1/chat/completions
   * - https://api.example.com/v1 → https://api.example.com/v1/chat/completions
   * - https://api.example.com/v1/ → https://api.example.com/v1/chat/completions
   * - https://api.example.com/v1/chat/completions → https://api.example.com/v1/chat/completions (不变)
   */
  private normalizeEndpoint(endpoint: string): string {
    // 移除末尾的斜杠
    let normalized = endpoint.replace(/\/+$/, '');

    // 如果已经包含完整路径，直接返回
    if (normalized.endsWith('/chat/completions')) {
      return normalized;
    }

    // 如果以 /v1 结尾，补全 /chat/completions
    if (normalized.endsWith('/v1')) {
      return normalized + '/chat/completions';
    }

    // 否则补全 /v1/chat/completions
    return normalized + '/v1/chat/completions';
  }

  /**
   * 将历史消息转换为 role-based 消息数组
   * @param history 历史消息数组
   * @param currentPersonaName 当前PERSONA的名称（userId字段中的值）
   */
  private formatHistory(history: HistoryMessage[], currentPersonaName?: string): Array<{ role: string; content: string }> {
    if (!history || history.length === 0) return [];

    return history
      .slice(-20)  // Keep only last 20 messages for context
      .map(msg => {
        // 只有当前PERSONA的消息才是assistant，其他都是user
        const isCurrentPersona = msg.isBot && currentPersonaName && msg.userId === currentPersonaName;
        const role = isCurrentPersona ? "assistant" : "user";

        // assistant不加前缀，user加前缀以区分不同说话者
        const content = isCurrentPersona ? msg.message : `[${msg.userId}]: ${msg.message}`;

        return { role, content };
      });
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    userId: string,
    history: HistoryMessage[],
    stream: boolean = false,
    personaName?: string
  ): Promise<AIResponse | ReadableStream> {
    const messages = [
      { role: "system", content: systemPrompt },
      ...this.formatHistory(history, personaName),
      { role: "user", content: `[${userId}]: ${userMessage}` }
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
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    if (stream) {
      return response.body as ReadableStream;
    } else {
      const result = await response.json() as any;
      const responseText = result.choices?.[0]?.message?.content || "";

      return {
        response: responseText,
        usage: {
          promptTokens: result.usage?.prompt_tokens || 0,
          completionTokens: result.usage?.completion_tokens || 0,
          totalTokens: result.usage?.total_tokens || 0,
        }
      };
    }
  }
}

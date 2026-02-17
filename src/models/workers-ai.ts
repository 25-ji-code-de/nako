// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ModelProvider, ModelConfig } from "./base";
import type { HistoryMessage, AIResponse } from "../types";

/**
 * Workers AI 模型提供商（使用 Qwen 3 30B）
 */
export class WorkersAIProvider implements ModelProvider {
  constructor(
    private ai: Ai,
    private config: ModelConfig = {}
  ) {}

  /**
   * 将历史消息转换为 role-based 消息数组，合并连续同用户消息
   * @param history 历史消息数组
   * @param currentPersonaName 当前PERSONA的名称（userId字段中的值）
   */
  private formatHistory(history: HistoryMessage[], currentPersonaName?: string): Array<{ role: string; content: string }> {
    if (!history || history.length === 0) return [];

    const recent = history.slice(-30);
    const merged: Array<{ role: string; content: string }> = [];

    for (const msg of recent) {
      // 关键逻辑：只有当前PERSONA的消息才是assistant，其他都是user
      const isCurrentPersona = msg.isBot && currentPersonaName && msg.userId === currentPersonaName;
      const role = isCurrentPersona ? "assistant" : "user";

      // assistant不加前缀（代表"我"），user加前缀以区分不同说话者
      const content = isCurrentPersona ? msg.message : `[${msg.userId}]: ${msg.message}`;
      const last = merged[merged.length - 1];

      // 合并连续同 role 的消息
      if (last && last.role === role) {
        last.content += "\n" + content;
      } else {
        merged.push({ role, content });
      }
    }

    return merged;
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    userId: string,
    history: HistoryMessage[],
    stream: boolean = false,
    personaName?: string
  ): Promise<AIResponse | ReadableStream> {
    const historyMessages = this.formatHistory(history, personaName);
    const currentMessage = { role: "user", content: `[${userId}]: ${userMessage}` };

    // 如果最后一条历史也是 user，合并当前消息
    const last = historyMessages[historyMessages.length - 1];
    if (last && last.role === "user") {
      last.content += "\n" + currentMessage.content;
    } else {
      historyMessages.push(currentMessage);
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
    ];

    const modelConfig = {
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 1024,
      top_p: this.config.topP ?? 0.85,
      frequency_penalty: this.config.frequencyPenalty ?? 0.15,
      presence_penalty: this.config.presencePenalty ?? 0.2,
    };

    if (stream) {
      // Return streaming response
      const streamResponse = await this.ai.run("@cf/qwen/qwen3-30b-a3b-fp8", {
        messages,
        ...modelConfig,
        stream: true,
      }) as ReadableStream;

      return streamResponse;
    } else {
      // Return complete response
      const result = await this.ai.run("@cf/qwen/qwen3-30b-a3b-fp8", {
        messages,
        ...modelConfig,
      }) as any;

      // Extract response text from Chat Completion Response format
      const responseText = result.choices?.[0]?.message?.content || "";
      const reasoningContent = result.choices?.[0]?.message?.reasoning_content;

      return {
        response: responseText,
        reasoningContent: reasoningContent || undefined,
        usage: {
          promptTokens: result.usage?.prompt_tokens || 0,
          completionTokens: result.usage?.completion_tokens || 0,
          totalTokens: result.usage?.total_tokens || 0,
        }
      };
    }
  }
}

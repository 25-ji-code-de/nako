// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ModelProvider, ModelConfig } from "./base.ts";
import type { HistoryMessage, AIResponse } from "../types/index.ts";
import { appendUserMessage, formatChatHistory } from "./format-history.ts";

/** Workers AI；默认 @cf/qwen/qwen3-30b-a3b-fp8，可用 WORKERS_AI_MODEL 覆盖 */
export class WorkersAIProvider implements ModelProvider {
  constructor(
    private ai: Ai,
    private config: ModelConfig = {},
    private model: string = "@cf/qwen/qwen3-30b-a3b-fp8"
  ) {}

  /** content 为空时从 reasoning 抠短回复（Qwen3 常见） */
  private extractFromReasoning(reasoning: string): string {
    const text = reasoning.trim();
    if (!text) return "";

    const afterThink = text.split(/<\/think>/i);
    if (afterThink.length > 1) {
      const tail = afterThink[afterThink.length - 1].trim();
      if (tail && tail.length <= 200) return tail;
    }

    const marked = text.match(
      /(?:最终回复|直接输出|回复内容|输出回复|所以回复|回复)[：:]\s*[「"'『]?([^\n「」"'』]+)[」"'』]?/
    );
    if (marked?.[1]) {
      const s = marked[1].trim();
      if (s.length >= 1 && s.length <= 200) return s;
    }

    const metaLine =
      /^(好的|用户|根据|规则|需要|检查|现在|首先|不过|所以我|这时候|我需要|按照|分析|考虑|思考|让我|我应该|接下来|综上|总[结而]|therefore|the user|i (need|should|will)|let me)\b/i;

    const lines = text
      .split(/\n+/)
      .map((l) => l.replace(/^[\s\-*•\d.、]+/, "").trim())
      .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
        .replace(/^["「『]|["」』]$/g, "")
        .replace(/^→\s*/, "")
        .trim();
      if (!line || metaLine.test(line)) continue;
      if (
        line.length >= 1 &&
        line.length <= 120 &&
        /[぀-ヿ㐀-鿿가-힯a-zA-Z0-9\u{1F300}-\u{1FAFF}]/u.test(line)
      ) {
        return line;
      }
    }
    return "";
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

    // CF Qwen3：enable_thinking=false 易导致 content 空；默认 true，仅 false 时显式传
    const enableThinking = this.config.enableThinking ?? true;

    const messages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
    ];

    const modelConfig: Record<string, unknown> = {
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 1024,
      top_p: this.config.topP ?? 0.85,
      frequency_penalty: this.config.frequencyPenalty ?? 0.15,
      presence_penalty: this.config.presencePenalty ?? 0.2,
    };
    if (enableThinking === false) {
      modelConfig.chat_template_kwargs = { enable_thinking: false };
    }

    if (stream) {
      return (await this.ai.run(this.model as any, {
        messages,
        ...modelConfig,
        stream: true,
      })) as ReadableStream;
    }

    const result = (await this.ai.run(this.model as any, {
      messages,
      ...modelConfig,
    })) as any;

    let responseText = (result.choices?.[0]?.message?.content || "").trim();
    const reasoningContent = result.choices?.[0]?.message?.reasoning_content;

    if (!responseText && typeof reasoningContent === "string") {
      responseText = this.extractFromReasoning(reasoningContent);
      if (responseText) {
        console.warn(
          `[workers-ai] empty content; recovered ${responseText.length} chars from reasoning (model=${this.model})`
        );
      } else {
        console.warn(
          `[workers-ai] empty content and reasoning fallback failed (model=${this.model}, reasoningLen=${reasoningContent.length})`
        );
      }
    }

    return {
      response: responseText,
      reasoningContent: undefined,
      usage: {
        promptTokens: result.usage?.prompt_tokens || 0,
        completionTokens: result.usage?.completion_tokens || 0,
        totalTokens: result.usage?.total_tokens || 0,
      },
    };
  }
}

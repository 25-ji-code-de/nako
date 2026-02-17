// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env, ChatRequest } from "../types";
import { validateChatRequest } from "../utils/validation";
import { createSuccessResponse, createErrorResponse } from "../utils/response";
import { generateAIResponse } from "../services/ai";
import { getStickerRecommendation, insertStickerIntoMessage } from "../services/sticker";
import type { User } from "../middleware/auth";
import { getPersona } from "../personas";

export async function handleChat(request: Request, env: Env, user: User): Promise<Response> {
  // 从 URL 查询参数获取 persona
  const url = new URL(request.url);
  const personaName = url.searchParams.get("persona") || undefined;
  try {
    // Parse request body
    let body: ChatRequest;
    try {
      body = await request.json() as ChatRequest;
    } catch (e) {
      return createErrorResponse("INVALID_JSON", "Invalid JSON in request body");
    }

    // Validate request
    const validation = validateChatRequest(body);
    if (!validation.valid) {
      return createErrorResponse("INVALID_REQUEST", validation.error!);
    }

    // 验证 persona 是否存在
    try {
      getPersona(personaName);
    } catch (error) {
      return createErrorResponse("INVALID_PERSONA", (error as Error).message);
    }

    // Generate AI response
    const aiResponse = await generateAIResponse(
      env,
      body.message,
      body.userId,
      body.history || [],
      body.stream || false,
      personaName
    );

    // Handle streaming response
    if (body.stream) {
      // For streaming, pass through immediately and add sticker at the end
      return handleStreamingWithSticker(aiResponse as ReadableStream, env, body, personaName);
    }

    // Handle non-streaming response
    const response = aiResponse as import("../types").AIResponse;

    // Remove AI-generated sticker tags
    let cleanResponse = response.response.replace(/\[stamp\d+\]/g, '');

    // Get sticker recommendation (if VECTORIZE is available)
    let finalResponse = cleanResponse;
    if (env.VECTORIZE) {
      try {
        const recentMessages = body.history
          ?.slice(-10)
          .map(h => h.message) || [];

        const recommendedSticker = await getStickerRecommendation(
          env.AI,
          env.VECTORIZE,
          body.message,
          cleanResponse,
          recentMessages
        );

        if (recommendedSticker) {
          finalResponse = insertStickerIntoMessage(cleanResponse, recommendedSticker);
        }
      } catch (error) {
        console.error("Failed to get sticker recommendation:", error);
        // Continue without sticker
      }
    }

    return createSuccessResponse(finalResponse, response.usage, response.reasoningContent);

  } catch (error) {
    console.error("Error in handleChat:", error);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "An internal error occurred",
      500
    );
  } finally {
    // 上报使用统计（异步，不阻塞响应）
    reportUsage(env, user, personaName).catch(err => {
      console.error("Failed to report usage:", err);
    });
  }
}

/**
 * Handle streaming response with sticker insertion
 * Strategy: Pass through stream immediately, append sticker at the end
 */
async function handleStreamingWithSticker(
  stream: ReadableStream,
  env: Env,
  body: ChatRequest,
  personaName?: string
): Promise<Response> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let fullResponse = "";
  let buffer = "";

  const newStream = new ReadableStream({
    async start(controller) {
      try {
        // Pass through the original stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode and accumulate
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                // Don't forward [DONE] yet
                continue;
              }

              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }

          // Forward the original chunk
          controller.enqueue(value);
        }

        // Remove AI-generated sticker tags from response
        fullResponse = fullResponse.replace(/\[stamp\d+\]/g, '');

        // Now get sticker recommendation
        if (env.VECTORIZE && fullResponse) {
          try {
            const recentMessages = body.history
              ?.slice(-10)
              .map(h => h.message) || [];

            const recommendedSticker = await getStickerRecommendation(
              env.AI,
              env.VECTORIZE,
              body.message,
              fullResponse,
              recentMessages
            );

            if (recommendedSticker) {
              const stickerText = `[${recommendedSticker}]`;
              const stickerChunk = {
                id: "sticker-" + Date.now(),
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: "@cf/qwen/qwen3-30b-a3b-fp8",
                choices: [{
                  index: 0,
                  delta: { content: stickerText },
                  logprobs: null,
                  finish_reason: null
                }]
              };
              const sseData = `data: ${JSON.stringify(stickerChunk)}\n\n`;
              controller.enqueue(encoder.encode(sseData));
            }
          } catch (error) {
            console.error("Failed to get sticker recommendation:", error);
          }
        }

        // Send [DONE]
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('Stream error:', error);
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });

  return new Response(newStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

/**
 * 上报使用统计（直接写入数据库）
 */
async function reportUsage(env: Env, user: User, personaName?: string): Promise<void> {
  const persona = personaName || "nako";
  try {
    const date = new Date().toISOString().split('T')[0];
    const now = Date.now();

    // 插入活动记录
    await env.DB.prepare(`
      INSERT INTO user_activities (user_id, project, event_type, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      user.id,
      'nako',
      `${persona}_conversation`,
      JSON.stringify({ timestamp: now, persona }),
      now
    ).run();

    // 更新统计数据
    await env.DB.prepare(`
      INSERT INTO user_stats (user_id, project, metric_name, metric_value, date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, project, metric_name, date)
      DO UPDATE SET
        metric_value = CAST(metric_value AS INTEGER) + 1,
        updated_at = ?
    `).bind(
      user.id,
      'nako',
      `${persona}_conversations`,
      '1',
      date,
      now,
      now,
      now
    ).run();
  } catch (error) {
    console.error('Error reporting usage:', error);
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env } from "../types/index.ts";
import { createErrorResponse, CORS_JSON_HEADERS } from "../utils/response.ts";
import { searchStickersWithScores, extractRecentStickers } from "../services/sticker.ts";
import {
  normalizeTopK,
  normalizeExcludeRecent,
  PROMPT_MAX_LEN,
} from "./recommend-params.ts";

interface RecommendRequest {
  prompt: string;
  excludeRecent?: string[];  // Recent messages to extract used stickers
  topK?: number;             // Number of stickers to return (default: 5)
}

interface StickerResult {
  assetbundleName: string;
  name: string;
  score: number;  // Similarity score (0-1)
}

interface RecommendResponse {
  success: true;
  stickers: StickerResult[];
  query: string;
}

interface ParsedParams {
  prompt: string;
  topK: number;
  /** 归一后一定是数组，可能为空 —— 不再有 undefined 这个第三态 */
  excludeRecent: string[];
}

function parseGetRequest(request: Request): ParsedParams | Response {
  const url = new URL(request.url);
  const promptParam = url.searchParams.get("prompt");

  if (!promptParam || promptParam.trim().length === 0) {
    return createErrorResponse("INVALID_REQUEST", "prompt query parameter is required");
  }

  const prompt = promptParam.trim();
  if (prompt.length > PROMPT_MAX_LEN) {
    return createErrorResponse("INVALID_REQUEST", `prompt too long (max ${PROMPT_MAX_LEN} characters)`);
  }

  return {
    prompt,
    topK: normalizeTopK(url.searchParams.get("topK")),
    // comma-separated 形式
    excludeRecent: normalizeExcludeRecent(url.searchParams.get("excludeRecent")),
  };
}

async function parsePostRequest(request: Request): Promise<ParsedParams | Response> {
  let body: RecommendRequest;
  try {
    body = await request.json() as RecommendRequest;
  } catch (e) {
    return createErrorResponse("INVALID_JSON", "Invalid JSON in request body");
  }

  // Validate prompt
  if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    return createErrorResponse("INVALID_REQUEST", "prompt is required and must be a non-empty string");
  }

  const prompt = body.prompt.trim();
  if (prompt.length > PROMPT_MAX_LEN) {
    return createErrorResponse("INVALID_REQUEST", `prompt too long (max ${PROMPT_MAX_LEN} characters)`);
  }

  // 与 GET 走同一套归一 —— 两个入口是同一个操作，不该给出不同结果
  return {
    prompt,
    topK: normalizeTopK(body.topK),
    excludeRecent: normalizeExcludeRecent(body.excludeRecent),
  };
}

function createSuccessResponse(results: StickerResult[], query: string): Response {
  const response: RecommendResponse = {
    success: true,
    stickers: results,
    query
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: CORS_JSON_HEADERS,
  });
}

export async function handleRecommend(request: Request, env: Env): Promise<Response> {
  try {
    // Check if VECTORIZE is available
    if (!env.VECTORIZE) {
      return createErrorResponse(
        "VECTORIZE_UNAVAILABLE",
        "Sticker recommendation service is not available",
        503
      );
    }

    // Parse request parameters
    let params: ParsedParams | Response;
    if (request.method === "GET") {
      params = parseGetRequest(request);
    } else if (request.method === "POST") {
      params = await parsePostRequest(request);
    } else {
      return createErrorResponse("METHOD_NOT_ALLOWED", "Only GET and POST methods are supported", 405);
    }

    // If parsing returned an error response, return it
    if (params instanceof Response) {
      return params;
    }

    // normalizeExcludeRecent 保证这里一定是 string[]（可能为空）
    const excludeIds = params.excludeRecent.length > 0
      ? extractRecentStickers(params.excludeRecent, 10)
      : undefined;

    // Search for stickers with scores
    const results = await searchStickersWithScores(
      env.AI,
      env.VECTORIZE,
      params.prompt,
      params.topK,
      excludeIds
    );

    return createSuccessResponse(results, params.prompt);

  } catch (error) {
    console.error("Error in handleRecommend:", error);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "An internal error occurred",
      500
    );
  }
}

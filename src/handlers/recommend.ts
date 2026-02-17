// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env } from "../types";
import { createErrorResponse } from "../utils/response";
import { searchStickersWithScores, extractRecentStickers } from "../services/sticker";

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
  excludeRecent?: string[];
}

function parseGetRequest(request: Request): ParsedParams | Response {
  const url = new URL(request.url);
  const promptParam = url.searchParams.get("prompt");

  if (!promptParam || promptParam.trim().length === 0) {
    return createErrorResponse("INVALID_REQUEST", "prompt query parameter is required");
  }

  const prompt = promptParam.trim();

  const topKParam = url.searchParams.get("topK");
  let topK = topKParam ? parseInt(topKParam, 10) : 5;
  if (isNaN(topK) || topK < 1 || topK > 20) {
    topK = 5;
  }

  // excludeRecent can be passed as comma-separated values
  const excludeParam = url.searchParams.get("excludeRecent");
  const excludeRecent = excludeParam
    ? excludeParam.split(",").map(s => s.trim()).filter(s => s.length > 0)
    : undefined;

  return { prompt, topK, excludeRecent };
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
  const topK = body.topK && body.topK > 0 && body.topK <= 20 ? body.topK : 5;
  const excludeRecent = body.excludeRecent;

  return { prompt, topK, excludeRecent };
}

function createSuccessResponse(results: StickerResult[], query: string): Response {
  const response: RecommendResponse = {
    success: true,
    stickers: results,
    query
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
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

    // Extract recently used stickers to exclude
    const excludeIds = params.excludeRecent && Array.isArray(params.excludeRecent)
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

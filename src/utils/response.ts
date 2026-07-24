// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ChatSuccessResponse, ChatErrorResponse, TokenUsage } from "../types";

const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-Content-Type-Options": "nosniff",
};

export function createSuccessResponse(
  response: string,
  usage: TokenUsage,
  reasoningContent?: string,
): Response {
  const body: ChatSuccessResponse = {
    success: true,
    response,
    usage,
  };

  if (reasoningContent) {
    body.reasoningContent = reasoningContent;
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400,
): Response {
  const body: ChatErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

export { JSON_HEADERS as CORS_JSON_HEADERS };

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ChatSuccessResponse, ChatErrorResponse, TokenUsage } from "../types";

export function createSuccessResponse(
  response: string,
  usage: TokenUsage,
  reasoningContent?: string
): Response {
  const body: ChatSuccessResponse = {
    success: true,
    response,
    usage,
  };

  // Only include reasoningContent if it exists
  if (reasoningContent) {
    body.reasoningContent = reasoningContent;
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400
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
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

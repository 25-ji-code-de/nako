// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env } from "./types";
import { handleChat } from "./handlers/chat";
import { handleRecommend } from "./handlers/recommend";
import { authenticate } from "./middleware/auth";
import { createErrorResponse } from "./utils/response";

const CORS_PREFLIGHT_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_PREFLIGHT_HEADERS,
      });
    }

    // Public health / index (no auth) — useful for uptime checks
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      (url.pathname === "/" || url.pathname === "/health")
    ) {
      const body = JSON.stringify({
        service: "nako",
        status: "ok",
        version: "1.0.0",
        routes: ["/api/chat", "/api/recommend"],
      });
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // 认证检查（所有业务 API 都需要认证）
    const user = await authenticate(request, env);
    if (!user) {
      return createErrorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env, user);
    }

    if (
      (request.method === "GET" || request.method === "POST") &&
      url.pathname === "/api/recommend"
    ) {
      return handleRecommend(request, env);
    }

    return createErrorResponse("NOT_FOUND", "Not Found", 404);
  },
};

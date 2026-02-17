// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env } from "./types";
import { handleChat } from "./handlers/chat";
import { handleRecommend } from "./handlers/recommend";
import { authenticate } from "./middleware/auth";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // 认证检查（所有 API 都需要认证）
    const user = await authenticate(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required"
        }
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    // Route to chat handler
    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env, user);
    }

    // Route to recommend handler (GET or POST)
    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/api/recommend") {
      return handleRecommend(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

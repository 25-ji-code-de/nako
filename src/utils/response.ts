// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

// 响应工具 —— 现在是 @25-ji-code-de/sekai-worker-kit 之上的适配层。
//
// 迁移前 CORS 头在本仓被写了三遍（这里、chat.ts、recommend.ts），
// 各仓之间也各写各的（gateway 有独立 middleware，storage-worker 散落 9 处）。

import { errorResponse, CORS_HEADERS, JSON_HEADERS } from "@25-ji-code-de/sekai-worker-kit";
import type { ChatSuccessResponse, TokenUsage } from "../types/index.ts";

/**
 * nako 的 JSON 响应头。
 *
 * 方法集收窄为本仓实际暴露的 GET / POST / OPTIONS
 * （worker-kit 的默认值还含 PUT / DELETE / HEAD）。
 */
export const CORS_JSON_HEADERS: Record<string, string> = {
  ...JSON_HEADERS,
  ...CORS_HEADERS,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** SSE 流式响应的头。与上面共用同一套 CORS 值，避免第四份拷贝。 */
export const CORS_STREAM_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

/**
 * 成功响应。
 *
 * 形状是 nako 专有的 `{ success, response, usage }` —— **不是**生态通用信封。
 * nightcord 的 nako-ai-service 读的就是 `data.response`，不能包成 `{ data }`。
 */
export function createSuccessResponse(
  response: string,
  usage: TokenUsage,
  reasoningContent?: string,
): Response {
  const body: ChatSuccessResponse = { success: true, response, usage };
  if (reasoningContent) {
    body.reasoningContent = reasoningContent;
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: CORS_JSON_HEADERS,
  });
}

/**
 * 错误响应 `{ success: false, error: { code, message }, message }`。
 *
 * 结构与迁移前一致，只多了顶层 `message` 兼容镜像（供读 `body.message`
 * 的客户端使用）以及 `Cache-Control: no-store`。
 *
 * 参数顺序与迁移前相同，13 个调用点无需改动。
 */
/**
 * RFC 6750 §3：Bearer 保护的资源在 401 时**必须**给出挑战头。
 * 它是客户端唯一能机器读取的「我该怎么认证」信号。
 *
 * 实测（2026-07-27）线上没有：
 *
 *     $ curl -i https://nako.nightcord.de5.net/api/chat
 *     HTTP/1.1 401 Unauthorized
 *     ...（没有 WWW-Authenticate）
 *
 * ── 为什么还要 Expose-Headers ────────────────────────────────────
 *
 * 浏览器默认只让脚本读到 CORS 安全清单里那几个响应头。不暴露的话，
 * 服务端发了、DevTools 里也看得见，而客户端 `res.headers.get(...)`
 * 返回 `null` —— 等于白发。nightcord 的聊天前端正是浏览器里的 SPA。
 *
 * sekai-worker-kit#2 把它加进了共享的 CORS_HEADERS，但本仓 pin 的是
 * `#v0.1.1`，那边发新 tag 之前到不了这里。等版本号跟上之后这两行可以删掉。
 */
const BEARER_CHALLENGE: Record<string, string> = {
  "WWW-Authenticate": "Bearer",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400,
): Response {
  return errorResponse(code, message, status, {
    headers: status === 401 ? { ...CORS_JSON_HEADERS, ...BEARER_CHALLENGE } : CORS_JSON_HEADERS,
  });
}

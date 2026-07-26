// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ValidationResult } from "../types/index.ts";

const MAX_MESSAGE_LEN = 2000;
const MAX_USER_ID_LEN = 128;
const MAX_HISTORY = 50;
const MAX_HISTORY_MSG_LEN = 2000;

/**
 * userId 会以 `[${userId}]: ` 的形式拼进发给模型的 prompt
 * （见 models/format-history.ts）。控制字符 —— 尤其是换行 —— 能破坏这个
 * 标签格式，让内容看起来像是另一个说话人或另一条指令。
 *
 * 在群聊里这是**跨用户**的：nightcord 把聊天室里其他人的消息也作为 history
 * 发给 Nako，所以 A 的昵称会出现在 B 的 prompt 里。
 */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

function validateUserIdField(value: unknown, label: string): string | null {
  if (typeof value !== "string") {
    return `${label} must be a string`;
  }
  if (value.length === 0) {
    return `${label} must not be empty`;
  }
  if (value.length > MAX_USER_ID_LEN) {
    return `${label} too long (max ${MAX_USER_ID_LEN})`;
  }
  if (CONTROL_CHARS.test(value)) {
    return `${label} must not contain control characters`;
  }
  return null;
}

export function validateChatRequest(body: unknown): ValidationResult {
  if (body == null || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (!b.userId) {
    return { valid: false, error: "Missing or invalid userId" };
  }
  const userIdError = validateUserIdField(b.userId, "userId");
  if (userIdError) {
    return { valid: false, error: userIdError };
  }

  if (!b.message || typeof b.message !== "string") {
    return { valid: false, error: "Missing or invalid message" };
  }
  if (b.message.length > MAX_MESSAGE_LEN) {
    return { valid: false, error: `Message too long (max ${MAX_MESSAGE_LEN} characters)` };
  }
  if (b.message.trim().length === 0) {
    return { valid: false, error: "Message must not be empty" };
  }

  if (b.history !== undefined) {
    if (!Array.isArray(b.history)) {
      return { valid: false, error: "History must be an array" };
    }
    if (b.history.length > MAX_HISTORY) {
      return { valid: false, error: `History too long (max ${MAX_HISTORY} items)` };
    }
    for (let i = 0; i < b.history.length; i++) {
      const item = b.history[i];
      if (item == null || typeof item !== "object") {
        return { valid: false, error: `History[${i}] must be an object` };
      }
      const h = item as Record<string, unknown>;
      if (typeof h.message !== "string") {
        return { valid: false, error: `History[${i}].message must be a string` };
      }
      if (h.message.length > MAX_HISTORY_MSG_LEN) {
        return { valid: false, error: `History[${i}].message too long` };
      }
      // 此前 history 项只校验了 message —— userId 与 isBot 完全不校验。
      // userId 无界意味着整体负载上限（50 × 2000 字符）可以被绕过，
      // 而且它会原样拼进 prompt 的说话人标签。
      const historyUserIdError = validateUserIdField(h.userId, `History[${i}].userId`);
      if (historyUserIdError) {
        return { valid: false, error: historyUserIdError };
      }
      if (h.isBot !== undefined && typeof h.isBot !== "boolean") {
        return { valid: false, error: `History[${i}].isBot must be a boolean` };
      }
    }
  }

  if (b.stream !== undefined && typeof b.stream !== "boolean") {
    return { valid: false, error: "stream must be a boolean" };
  }

  return { valid: true };
}

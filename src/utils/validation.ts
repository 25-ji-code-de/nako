// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { ValidationResult } from "../types";

const MAX_MESSAGE_LEN = 2000;
const MAX_USER_ID_LEN = 128;
const MAX_HISTORY = 50;
const MAX_HISTORY_MSG_LEN = 2000;

export function validateChatRequest(body: unknown): ValidationResult {
  if (body == null || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (!b.userId || typeof b.userId !== "string") {
    return { valid: false, error: "Missing or invalid userId" };
  }
  if (b.userId.length > MAX_USER_ID_LEN) {
    return { valid: false, error: `userId too long (max ${MAX_USER_ID_LEN})` };
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
    }
  }

  if (b.stream !== undefined && typeof b.stream !== "boolean") {
    return { valid: false, error: "stream must be a boolean" };
  }

  return { valid: true };
}

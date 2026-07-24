// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { HistoryMessage } from "../types";

export type ChatRoleMessage = { role: string; content: string };

export interface FormatHistoryOptions {
  /** 最近 N 条，默认 30 */
  limit?: number;
  /** 合并连续同 role，默认 true */
  mergeConsecutive?: boolean;
}

/**
 * 群聊历史 → role messages。
 * 当前 persona 的 bot → assistant；其余 → user，带 [userId]: 前缀。
 * 空 message 跳过，避免上游对空 content 报错。
 */
export function formatChatHistory(
  history: HistoryMessage[] | undefined,
  currentPersonaName?: string,
  options: FormatHistoryOptions = {}
): ChatRoleMessage[] {
  if (!history || history.length === 0) return [];

  const limit = options.limit ?? 30;
  const mergeConsecutive = options.mergeConsecutive ?? true;
  const recent = history.slice(-limit);

  const mapped: ChatRoleMessage[] = [];
  for (const msg of recent) {
    if (!msg || typeof msg.message !== "string") continue;
    const text = msg.message.trim();
    if (!text) continue;
    const isCurrentPersona =
      !!msg.isBot && !!currentPersonaName && msg.userId === currentPersonaName;
    mapped.push({
      role: isCurrentPersona ? "assistant" : "user",
      content: isCurrentPersona ? text : `[${msg.userId}]: ${text}`,
    });
  }

  if (!mergeConsecutive) return mapped;

  const merged: ChatRoleMessage[] = [];
  for (const item of mapped) {
    const last = merged[merged.length - 1];
    if (last && last.role === item.role) {
      last.content += "\n" + item.content;
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

/** 追加当前 user；末尾已是 user 则合并 */
export function appendUserMessage(
  messages: ChatRoleMessage[],
  userId: string,
  userMessage: string
): ChatRoleMessage[] {
  const current: ChatRoleMessage = {
    role: "user",
    content: `[${userId}]: ${userMessage}`,
  };
  const last = messages[messages.length - 1];
  if (last && last.role === "user") {
    last.content += "\n" + current.content;
    return messages;
  }
  messages.push(current);
  return messages;
}

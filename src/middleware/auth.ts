// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

// 认证中间件 - 验证 SEKAI Pass 的 access token

import type { Env } from "../types";

export interface User {
  id: string;
  username: string;
  email: string;
}

/**
 * 验证 access token
 * 直接查询 SEKAI Pass 数据库，避免额外的网络请求
 */
export async function authenticate(request: Request, env: Env): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // 查询 SEKAI Pass 数据库验证 token
    const result = await env.AUTH_DB.prepare(`
      SELECT
        at.user_id,
        at.expires_at,
        u.username,
        u.email
      FROM access_tokens at
      JOIN users u ON at.user_id = u.id
      WHERE at.token = ?
    `).bind(token).first();

    if (!result) {
      return null;
    }

    // 检查 token 是否过期
    const expiresAt = result.expires_at as number;
    if (expiresAt < Date.now()) {
      return null;
    }

    return {
      id: result.user_id as string,
      username: result.username as string,
      email: result.email as string
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

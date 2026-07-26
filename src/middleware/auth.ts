// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

// 认证中间件 —— 实现已移至 @25-ji-code-de/sekai-worker-kit。
//
// 此前这个文件与 gateway/src/middleware/auth.js 是同一个函数的 TS / JS
// 两份逐字拷贝（相同的 SQL、相同的 MAX_TOKEN_LEN = 512、相同的过期判断）。
//
// 行为不变：任何失败路径返回 null，不抛异常。
// 返回值新增 clientId 与 scopes —— access_tokens 的这两列此前从未被读取。
//
// 想收紧 scope 时：authenticate(request, env, { requireScopes: ['profile'] })

export { authenticate, extractBearerToken, MAX_TOKEN_LEN } from "@25-ji-code-de/sekai-worker-kit";
export type { SekaiUser } from "@25-ji-code-de/sekai-worker-kit";

/**
 * @deprecated 请改用 worker-kit 的 `SekaiUser`。
 * 保留以兼容本仓既有的 `import type { User }`。
 */
export type { SekaiUser as User } from "@25-ji-code-de/sekai-worker-kit";

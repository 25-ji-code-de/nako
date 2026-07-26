// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

/**
 * /recommend 的参数归一。
 *
 * GET 与 POST 是**同一个操作的两个入口**，此前各写各的：
 *
 *   topK          GET 走 parseInt 再夹逼；POST 只判 `x > 0 && x <= 20`
 *                 → POST 传 "10" 会原样穿过去（字符串），传 3.7 会得到小数，
 *                   传 true 也过（true > 0 是 true）。最后交给 Vectorize。
 *   excludeRecent GET 一定得到 string[]；POST 直接原样透传
 *                 → 传 [null] 时 extractRecentStickers 里 msg.match 抛，
 *                   500 而不是 400
 *
 * 两个入口对同一个操作给出不同结果，而且不报错。放在这里共用，
 * 让它们不可能再漂移。
 */

/** topK 的取值范围与默认值。 */
export const TOP_K_DEFAULT = 5;
export const TOP_K_MIN = 1;
export const TOP_K_MAX = 20;

/** prompt 长度上限。 */
export const PROMPT_MAX_LEN = 500;

/** excludeRecent 最多看多少条（再多也没意义，只用来抽最近用过的贴纸）。 */
export const EXCLUDE_RECENT_MAX = 50;

/**
 * 归一 topK：非法一律回落到默认值。
 *
 * 接受数字与数字字符串（GET 只能给字符串），其余（布尔、对象、NaN、
 * 小数、越界）一律 TOP_K_DEFAULT。
 */
export function normalizeTopK(value: unknown): number {
  // 只认数字与数字字符串。**布尔被这一条挡掉**：原来的写法是
  // `body.topK && body.topK > 0 && body.topK <= 20`，而 `true > 0` 为真，
  // 于是 topK 会变成布尔值传给 Vectorize。
  if (typeof value !== "number" && typeof value !== "string") return TOP_K_DEFAULT;

  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return TOP_K_DEFAULT;

  const i = Math.trunc(n);
  if (i < TOP_K_MIN || i > TOP_K_MAX) return TOP_K_DEFAULT;
  return i;
}

/**
 * 归一 excludeRecent：任何形状都得到 string[]（可能为空）。
 *
 * 非数组 → []；数组里的非字符串元素**跳过**而不是让下游 .match 抛。
 */
export function normalizeExcludeRecent(value: unknown): string[] {
  if (typeof value === "string") {
    // GET 的 comma-separated 形式
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(-EXCLUDE_RECENT_MAX);
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .slice(-EXCLUDE_RECENT_MAX);
}

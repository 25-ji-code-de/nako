// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

import type { Env } from "../types";

interface StickerMetadata {
  assetbundleName: string;
  name: string;
}

interface VectorMatch {
  id: string;
  score: number;
  metadata: StickerMetadata;
}

interface RerankResult {
  assetbundleName: string;
  score: number;
  metadata: StickerMetadata;
}

/**
 * Determine if a sticker should be recommended based on message characteristics
 */
export function needsSticker(userMsg: string, nakoReply: string): boolean {
  if (userMsg.length <= 3) return Math.random() > 0.5;
  if (nakoReply.length <= 5) return true;
  if (nakoReply.length > 20) return Math.random() > 0.7;
  return Math.random() > 0.5;
}

/**
 * Extract sticker IDs from recent messages
 */
export function extractRecentStickers(history: string[], limit: number = 5): Set<string> {
  const recentStickers = new Set<string>();
  const stickerRegex = /\[stamp\d+\]/g;

  // Check last N messages
  for (const msg of history.slice(-limit)) {
    const matches = msg.match(stickerRegex);
    if (matches) {
      matches.forEach(match => {
        const stickerId = match.slice(1, -1); // Remove [ and ]
        recentStickers.add(stickerId);
      });
    }
  }

  return recentStickers;
}

/**
 * Generate embedding for query text using Qwen embedding model
 */
async function generateQueryEmbedding(ai: Ai, query: string): Promise<number[]> {
  const response = await ai.run("@cf/qwen/qwen3-embedding-0.6b", {
    text: query,
  }) as any;

  return response.data[0];
}

/**
 * Search for similar stickers using Vectorize
 */
async function searchVectorize(
  vectorize: VectorizeIndex,
  queryVector: number[],
  topK: number = 20,
  excludeIds?: Set<string>
): Promise<VectorMatch[]> {
  // Fetch more results if we need to exclude some
  const fetchCount = excludeIds && excludeIds.size > 0 ? topK + excludeIds.size : topK;

  const results = await vectorize.query(queryVector, {
    topK: fetchCount,
    returnMetadata: true,
  });

  // Filter out excluded stickers
  let matches = results.matches.map(match => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata as StickerMetadata,
  }));

  if (excludeIds && excludeIds.size > 0) {
    matches = matches.filter(m => !excludeIds.has(m.metadata.assetbundleName));
  }

  return matches.slice(0, topK);
}

/**
 * Rerank results using a small model for better relevance
 * Uses Llama 3.2 3B for fast reranking
 */
async function rerankResults(
  ai: Ai,
  query: string,
  candidates: VectorMatch[]
): Promise<RerankResult[]> {
  if (candidates.length === 0) return [];

  // For small candidate sets, skip LLM reranking
  if (candidates.length <= 3) {
    return candidates.map(c => ({
      assetbundleName: c.metadata.assetbundleName,
      score: c.score * 100,
      metadata: c.metadata,
    }));
  }

  // Create reranking prompt
  const candidateList = candidates
    .map((c, idx) => `${idx + 1}. ${c.metadata.name}`)
    .join('\n');

  const prompt = `给定用户查询和候选表情包列表，请为每个候选项评分（0-100），分数越高表示与查询越相关。

用户查询：${query}

候选表情包：
${candidateList}

请以JSON格式返回评分结果，格式如下：
{"scores": [分数1, 分数2, ...]}

只返回JSON，不要其他内容。`;

  try {
    const response = await ai.run("@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 300,
    }) as any;

    const content = response.response || response.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("Failed to parse rerank response, using original scores");
      return candidates.map(c => ({
        assetbundleName: c.metadata.assetbundleName,
        score: c.score * 100,
        metadata: c.metadata,
      }));
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const scores = parsed.scores || [];

    // Combine rerank scores with original vector scores
    const reranked = candidates.map((c, idx) => {
      const rerankScore = scores[idx] || 0;
      // Weighted combination: 70% rerank, 30% vector similarity
      const combinedScore = (rerankScore * 0.7) + (c.score * 100 * 0.3);

      return {
        assetbundleName: c.metadata.assetbundleName,
        score: combinedScore,
        metadata: c.metadata,
      };
    });

    // Sort by combined score
    return reranked.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("Rerank failed:", error);
    // Fallback to original vector scores
    return candidates.map(c => ({
      assetbundleName: c.metadata.assetbundleName,
      score: c.score * 100,
      metadata: c.metadata,
    }));
  }
}

/**
 * Search for stickers based on query text
 * Returns top matching sticker assetbundleNames
 */
export async function searchStickers(
  ai: Ai,
  vectorize: VectorizeIndex,
  query: string,
  topK: number = 5,
  excludeIds?: Set<string>
): Promise<string[]> {
  try {
    // Step 1: Generate query embedding
    const queryVector = await generateQueryEmbedding(ai, query);

    // Step 2: Search Vectorize for similar stickers
    const candidates = await searchVectorize(vectorize, queryVector, topK, excludeIds);

    if (candidates.length === 0) {
      return [];
    }

    // Step 3: Rerank results using small LLM (commented out - not very useful)
    // const reranked = await rerankResults(ai, query, candidates);
    // return reranked.slice(0, topK).map(r => r.assetbundleName);

    // Return results directly based on vector similarity
    return candidates.slice(0, topK).map(c => c.metadata.assetbundleName);
  } catch (error) {
    console.error("Sticker search failed:", error);
    return [];
  }
}

/**
 * Search for stickers with scores and metadata
 * Returns detailed results including similarity scores
 */
export async function searchStickersWithScores(
  ai: Ai,
  vectorize: VectorizeIndex,
  query: string,
  topK: number = 5,
  excludeIds?: Set<string>
): Promise<Array<{ assetbundleName: string; name: string; score: number }>> {
  try {
    // Step 1: Generate query embedding
    const queryVector = await generateQueryEmbedding(ai, query);

    // Step 2: Search Vectorize for similar stickers
    const candidates = await searchVectorize(vectorize, queryVector, topK, excludeIds);

    if (candidates.length === 0) {
      return [];
    }

    // Return results with scores and metadata
    return candidates.slice(0, topK).map(c => ({
      assetbundleName: c.metadata.assetbundleName,
      name: c.metadata.name,
      score: c.score
    }));
  } catch (error) {
    console.error("Sticker search failed:", error);
    return [];
  }
}

/**
 * Get sticker recommendation based on conversation context
 */
export async function getStickerRecommendation(
  ai: Ai,
  vectorize: VectorizeIndex,
  userMessage: string,
  nakoReply: string,
  recentMessages: string[]
): Promise<string | null> {
  // Check if sticker is needed
  if (!needsSticker(userMessage, nakoReply)) {
    return null;
  }

  // Extract recently used stickers to avoid repetition
  const recentStickers = extractRecentStickers(recentMessages, 10);

  // Combine user message and Nako's reply for better context
  const searchQuery = `${userMessage}\n回复：${nakoReply}`;

  const results = await searchStickers(ai, vectorize, searchQuery, 1, recentStickers);

  return results.length > 0 ? results[0] : null;
}

/**
 * Insert sticker into message at appropriate position
 */
export function insertStickerIntoMessage(message: string, stickerId: string): string {
  // If message is very short, append at end
  if (message.length <= 5) {
    return `${message}[${stickerId}]`;
  }

  // For longer messages, insert randomly in the middle or at end
  const insertPosition = Math.random();

  if (insertPosition < 0.3) {
    // Insert at beginning
    return `[${stickerId}]${message}`;
  } else if (insertPosition < 0.7) {
    // Insert in middle (after punctuation if possible)
    const punctuationMatch = message.match(/[。！？，、~…]/);
    if (punctuationMatch && punctuationMatch.index) {
      const pos = punctuationMatch.index + 1;
      return message.slice(0, pos) + `[${stickerId}]` + message.slice(pos);
    }
    // Fallback: insert at middle
    const mid = Math.floor(message.length / 2);
    return message.slice(0, mid) + `[${stickerId}]` + message.slice(mid);
  } else {
    // Insert at end
    return `${message}[${stickerId}]`;
  }
}

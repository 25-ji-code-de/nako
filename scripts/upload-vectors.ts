// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

/**
 * Upload sticker embeddings to Cloudflare Vectorize
 * Run this script after prepare-stickers.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface ProcessedSticker {
  assetbundleName: string;
  name: string;
}

interface VectorRecord {
  id: string;
  values: number[];
  metadata: {
    assetbundleName: string;
    name: string;
  };
}

async function generateEmbedding(
  text: string,
  accountId: string,
  apiKey: string,
  email: string,
  retries: number = 3
): Promise<number[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/qwen/qwen3-embedding-0.6b`,
        {
          method: 'POST',
          headers: {
            'X-Auth-Email': email,
            'X-Auth-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        // If rate limited, wait and retry
        if (response.status === 429) {
          if (attempt < retries) {
            const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${retries}...`);
            await sleep(waitTime);
            continue;
          }
        }

        throw new Error(`Failed to generate embedding: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result.result.data[0];
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Wait before retry
      await sleep(1000 * (attempt + 1));
    }
  }

  throw new Error('Failed after all retries');
}

async function uploadVectors(
  vectors: VectorRecord[],
  accountId: string,
  apiKey: string,
  email: string,
  indexName: string
): Promise<void> {
  const batchSize = 100;

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/indexes/${indexName}/insert`,
      {
        method: 'POST',
        headers: {
          'X-Auth-Email': email,
          'X-Auth-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vectors: batch }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload batch ${i / batchSize + 1}: ${response.statusText} - ${errorText}`);
    }

    console.log(`✓ Uploaded batch ${i / batchSize + 1}/${Math.ceil(vectors.length / batchSize)}`);
  }
}

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiKey = process.env.CLOUDFLARE_API_KEY;
  const email = process.env.CLOUDFLARE_EMAIL;
  const indexName = process.env.VECTORIZE_INDEX_NAME || 'sticker-embeddings';

  if (!accountId || !apiKey || !email) {
    throw new Error('Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_KEY, and CLOUDFLARE_EMAIL environment variables');
  }

  const processedPath = path.join(__dirname, '..', 'processed-stickers.json');
  const progressPath = path.join(__dirname, '..', 'upload-progress.json');

  console.log('Reading processed stickers...');
  const stickers: ProcessedSticker[] = JSON.parse(fs.readFileSync(processedPath, 'utf-8'));

  // Load progress if exists
  let completedIds = new Set<string>();
  if (fs.existsSync(progressPath)) {
    const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
    completedIds = new Set(progress.completed || []);
    console.log(`Resuming from progress: ${completedIds.size} stickers already completed`);
  }

  console.log(`Generating embeddings for ${stickers.length} stickers...`);
  const vectors: VectorRecord[] = [];

  for (let i = 0; i < stickers.length; i++) {
    const sticker = stickers[i];

    // Skip if already completed
    if (completedIds.has(sticker.assetbundleName)) {
      if ((i + 1) % 50 === 0) {
        console.log(`Skipped ${i + 1}/${stickers.length} (already completed)`);
      }
      continue;
    }

    try {
      const embedding = await generateEmbedding(sticker.name, accountId, apiKey, email);

      vectors.push({
        id: sticker.assetbundleName,
        values: embedding,
        metadata: {
          assetbundleName: sticker.assetbundleName,
          name: sticker.name,
        },
      });

      // Mark as completed
      completedIds.add(sticker.assetbundleName);

      // Save progress every 10 items
      if (vectors.length % 10 === 0) {
        fs.writeFileSync(progressPath, JSON.stringify({ completed: Array.from(completedIds) }));
        console.log(`Generated ${completedIds.size}/${stickers.length} embeddings`);
      }

      // Add delay to avoid rate limiting (200ms between requests)
      await sleep(200);
    } catch (error) {
      console.error(`Failed to process sticker ${sticker.assetbundleName}:`, error);
      // Save progress before exiting
      fs.writeFileSync(progressPath, JSON.stringify({ completed: Array.from(completedIds) }));
      throw error; // Stop on error
    }
  }

  console.log(`\nGenerating NDJSON file for ${vectors.length} vectors...`);

  // Save vectors as NDJSON for wrangler
  const ndjsonPath = path.join(__dirname, '..', 'vectors-to-upload.ndjson');
  const ndjsonLines = vectors.map(v => JSON.stringify(v)).join('\n');
  fs.writeFileSync(ndjsonPath, ndjsonLines);

  console.log(`✓ Saved to ${ndjsonPath}`);
  console.log('\nNow run: npm run upload-to-vectorize');

  // Clean up progress file on success
  if (fs.existsSync(progressPath)) {
    fs.unlinkSync(progressPath);
  }
}

main().catch(console.error);

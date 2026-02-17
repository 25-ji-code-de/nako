// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

/**
 * Upload vectors to Vectorize using wrangler CLI
 * This is more reliable than using the REST API directly
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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

async function main() {
  const vectorsPath = path.join(__dirname, '..', 'vectors-to-upload.ndjson');

  // Check if vectors file exists
  if (!fs.existsSync(vectorsPath)) {
    console.error('Error: vectors-to-upload.ndjson not found');
    console.error('Please run the embedding generation script first');
    process.exit(1);
  }

  const indexName = process.env.VECTORIZE_INDEX_NAME || 'sticker-embeddings';

  console.log(`Uploading vectors to index: ${indexName}`);
  console.log('Using wrangler CLI...\n');

  try {
    // Use wrangler to insert vectors
    execSync(
      `npx wrangler vectorize insert ${indexName} --file=${vectorsPath}`,
      { stdio: 'inherit' }
    );

    console.log('\n✓ All vectors uploaded successfully!');

    // Clean up the vectors file
    fs.unlinkSync(vectorsPath);
    console.log('✓ Cleaned up temporary files');
  } catch (error) {
    console.error('Failed to upload vectors:', error);
    process.exit(1);
  }
}

main().catch(console.error);

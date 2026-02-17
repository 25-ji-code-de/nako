// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 The 25-ji-code-de Team

/**
 * Preprocess stickers.json to prepare data for vectorization
 * This script extracts meaningful text from stickers and creates embeddings
 */

import * as fs from 'fs';
import * as path from 'path';

interface Sticker {
  id: number;
  stampType: string;
  seq: number;
  name: string;
  assetbundleName: string;
  balloonAssetbundleName: string;
  characterId1: number;
  gameCharacterUnitId?: number;
  archiveDisplayType: string;
  archivePublishedAt: number;
  description: string;
}

interface ProcessedSticker {
  assetbundleName: string;
  name: string;
}

function processStickers(stickers: Sticker[]): ProcessedSticker[] {
  return stickers.map(sticker => ({
    assetbundleName: sticker.assetbundleName,
    name: sticker.name.replace(/^\[表情\]/, '').trim(),
  }));
}

async function main() {
  const stickersPath = path.join(__dirname, '..', 'stickers.json');
  const outputPath = path.join(__dirname, '..', 'processed-stickers.json');

  console.log('Reading stickers.json...');
  const stickersData = JSON.parse(fs.readFileSync(stickersPath, 'utf-8'));

  console.log(`Processing ${stickersData.length} stickers...`);
  const processed = processStickers(stickersData);

  console.log('Writing processed data...');
  fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));

  console.log(`✓ Processed ${processed.length} stickers`);
  console.log(`✓ Output saved to: ${outputPath}`);

  // Print sample
  console.log('\nSample processed sticker:');
  console.log(JSON.stringify(processed[0], null, 2));
}

main().catch(console.error);

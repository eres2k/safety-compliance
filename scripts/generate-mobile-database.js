#!/usr/bin/env node

/**
 * Mobile Database Generator
 *
 * Transforms the full eu_safety_laws databases into Android-compatible format.
 * This script is the single transformation point to derive mobile bundles
 * from the source of truth databases.
 *
 * Input: eu_safety_laws/{at,de,nl}/{country}_database.json (schema v2.0.0)
 * Output: android-app/app/src/main/assets/laws/{country}_database.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EU_LAWS_DIR = path.join(__dirname, '..', 'eu_safety_laws');
const ANDROID_ASSETS_DIR = path.join(__dirname, '..', 'android-app', 'app', 'src', 'main', 'assets', 'laws');

// Maximum characters for full_text in mobile version (to reduce size)
const MAX_FULL_TEXT_LENGTH = 10000;

/**
 * Transform a document from web format to mobile format
 */
function transformDocument(doc) {
  // Extract and concatenate section text for full_text
  let fullText = '';
  if (doc.chapters) {
    for (const chapter of doc.chapters) {
      if (chapter.sections) {
        for (const section of chapter.sections) {
          if (section.text) {
            fullText += `${section.title}\n${section.text}\n\n`;
          }
        }
      }
    }
  }

  // Truncate if too long
  if (fullText.length > MAX_FULL_TEXT_LENGTH) {
    fullText = fullText.substring(0, MAX_FULL_TEXT_LENGTH) + '\n\n[Content truncated for mobile - view full version online]';
  }

  // Get the human-readable description
  const description = doc.whs_summary?.description || `${doc.abbreviation || doc.title} - ${doc.category || 'Workplace safety legislation'}`;

  // Build mobile-compatible document
  return {
    id: doc.id,
    title: doc.title,
    abbreviation: doc.abbreviation,
    description: doc.title_en || doc.title,
    type: doc.type,
    summary: description,
    whs_summary: description,
    keywords: doc.keywords || [],
    content: {
      full_text: fullText.trim() || null,
      available: fullText.length > 0,
      format: 'text'
    }
  };
}

/**
 * Generate mobile database for a specific country
 */
function generateMobileDatabase(country) {
  const inputPath = path.join(EU_LAWS_DIR, country, `${country}_database.json`);
  const outputPath = path.join(ANDROID_ASSETS_DIR, `${country}_database.json`);

  if (!fs.existsSync(inputPath)) {
    console.log(`  Skipping ${country.toUpperCase()}: source database not found`);
    return { success: false, reason: 'not found' };
  }

  console.log(`  Processing ${country.toUpperCase()}...`);

  try {
    const sourceData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    // Verify schema version
    if (sourceData.schema_version !== '2.0.0') {
      console.log(`    Warning: Source is schema ${sourceData.schema_version || 'unknown'}, expected 2.0.0`);
    }

    // Transform documents
    const laws = sourceData.documents.map(transformDocument);

    // Build mobile database structure
    const mobileDatabase = {
      laws: laws
    };

    // Ensure output directory exists
    fs.mkdirSync(ANDROID_ASSETS_DIR, { recursive: true });

    // Write output
    fs.writeFileSync(outputPath, JSON.stringify(mobileDatabase, null, 2));

    // Calculate sizes
    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.statSync(outputPath).size;
    const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);

    console.log(`    Converted ${laws.length} documents`);
    console.log(`    Source: ${(inputSize / 1024).toFixed(1)} KB`);
    console.log(`    Output: ${(outputSize / 1024).toFixed(1)} KB (${reduction}% reduction)`);

    return {
      success: true,
      documentCount: laws.length,
      inputSize,
      outputSize,
      reduction: parseFloat(reduction)
    };
  } catch (error) {
    console.error(`    Error: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

/**
 * Main function
 */
function main() {
  console.log('='.repeat(60));
  console.log('Mobile Database Generator');
  console.log('='.repeat(60));
  console.log(`\nSource: ${EU_LAWS_DIR}`);
  console.log(`Output: ${ANDROID_ASSETS_DIR}\n`);

  const countries = ['at', 'de', 'nl'];
  const results = {};

  for (const country of countries) {
    results[country] = generateMobileDatabase(country);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Generation Summary');
  console.log('='.repeat(60));

  let totalDocs = 0;
  let totalInputSize = 0;
  let totalOutputSize = 0;

  for (const [country, result] of Object.entries(results)) {
    const status = result.success ? 'OK' : 'FAILED';
    console.log(`  ${country.toUpperCase()}: ${status}`);
    if (result.success) {
      totalDocs += result.documentCount;
      totalInputSize += result.inputSize;
      totalOutputSize += result.outputSize;
    }
  }

  if (totalInputSize > 0) {
    const totalReduction = ((1 - totalOutputSize / totalInputSize) * 100).toFixed(1);
    console.log(`\nTotal: ${totalDocs} documents`);
    console.log(`Size: ${(totalInputSize / 1024).toFixed(1)} KB -> ${(totalOutputSize / 1024).toFixed(1)} KB (${totalReduction}% reduction)`);
  }

  const allSuccess = Object.values(results).every(r => r.success);
  process.exit(allSuccess ? 0 : 1);
}

main();

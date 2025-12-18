#!/usr/bin/env node
/**
 * Semantic Tagging Script for Law Database
 * Uses AI to tag law sections with Amazon Logistics roles and equipment
 *
 * This script processes law data and adds semantic tags for:
 * - Amazon Logistics roles (Packer, Forklift_Operator, etc.)
 * - Equipment (Forklift, Conveyor, PPE, etc.)
 * - Hazards identified in the regulation
 * - Keywords for enhanced search
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node scripts/generate-semantic-tags.js
 *   GEMINI_API_KEY=your_key node scripts/generate-semantic-tags.js --country=AT
 *
 * Or create a .env file with GEMINI_API_KEY
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration - Optimized for Gemini 3.0 Flash (1K RPM, 1M TPM, 10K RPD)
const CONFIG = {
  dataDir: path.join(__dirname, '../src/data/laws'),
  outputDir: path.join(__dirname, '../src/data/laws'),
  geminiModel: 'gemini-3-flash-preview',
  maxRetries: 3,
  retryDelayMs: 1000,
  rateLimitDelayMs: 100, // 100ms between requests (~600 RPM with margin)
  batchSize: 10, // Process 10 sections per API call
  maxSectionsPerBatch: 10, // Max sections per API call
  maxParallelFiles: 2, // Reduced parallel files to stay under 1K RPM limit
  maxOutputTokens: 8192, // Gemini 3 supports larger outputs
}

// Available role tags
const ROLE_TAGS = [
  'Packer',
  'Pick_Associate',
  'Stower',
  'Dock_Clerk',
  'Forklift_Operator',
  'Sortation_Associate',
  'Problem_Solver',
  'Safety_Coordinator',
  'Area_Manager',
  'Delivery_Driver'
]

// Available equipment tags
const EQUIPMENT_TAGS = [
  'Forklift',
  'Pallet_Jack',
  'Conveyor',
  'Scanner',
  'Ladder',
  'Cart',
  'PPE',
  'Kiva_Robot',
  'Loading_Dock',
  'Racking'
]

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

// Generate semantic tags for MULTIPLE sections in a single API call (batched)
// This reduces API calls by ~80% compared to individual calls
async function generateTagsForBatch(sections, apiKey) {
  const sectionsText = sections.map((s, i) =>
    `[SECTION_${i}] ${s.number || s.id}:\n${(s.text || s.content || '').substring(0, 400)}`
  ).join('\n\n---\n\n')

  const prompt = `You are a logistics safety expert. Analyze these ${sections.length} regulations and tag each with relevant Amazon Logistics roles and equipment.

REGULATIONS:
${sectionsText}

AVAILABLE ROLE TAGS (use only these):
${ROLE_TAGS.map(r => `- ${r}`).join('\n')}

AVAILABLE EQUIPMENT TAGS (use only these):
${EQUIPMENT_TAGS.map(e => `- ${e}`).join('\n')}

OUTPUT FORMAT (JSON array, one object per section, in order):
[
  {"roles": ["Role1"], "equipment": ["Equipment1"], "hazards": ["hazard1"], "keywords": ["keyword1"]},
  {"roles": ["Role2"], "equipment": ["Equipment2"], "hazards": ["hazard2"], "keywords": ["keyword2"]}
]

Return ONLY the JSON array, no explanation, no markdown.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${CONFIG.geminiModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: CONFIG.maxOutputTokens,
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Extract JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('No JSON array found in response')
  }

  try {
    const tagsArray = JSON.parse(jsonMatch[0])
    // Validate and filter each result
    return tagsArray.map(tags => ({
      roles: (tags.roles || []).filter(r => ROLE_TAGS.includes(r)),
      equipment: (tags.equipment || []).filter(e => EQUIPMENT_TAGS.includes(e)),
      hazards: (tags.hazards || []).slice(0, 5),
      keywords: (tags.keywords || []).slice(0, 10),
    }))
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e.message}`)
  }
}

// Legacy single-section function (fallback)
async function generateTagsForSection(sectionText, sectionNumber, apiKey) {
  const results = await generateTagsForBatch([{ number: sectionNumber, text: sectionText }], apiKey)
  return results[0]
}

// Process a single law file with BATCHED API calls
async function processLawFile(filename, apiKey) {
  const filePath = path.join(CONFIG.dataDir, filename)

  if (!fs.existsSync(filePath)) {
    log(`File not found: ${filePath}`, colors.yellow)
    return null
  }

  log(`\nProcessing: ${filename}`, colors.cyan)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  let processedCount = 0
  let errorCount = 0

  // Collect all untagged sections first
  const untaggedSections = []
  for (const law of data.laws || []) {
    if (!law.chapters) continue
    for (const chapter of law.chapters) {
      if (!chapter.sections) continue
      for (const section of chapter.sections) {
        if (section.semantic_tags) continue // Skip already tagged
        const sectionText = section.text || section.content || ''
        if (sectionText.length < 50) continue // Skip very short sections
        untaggedSections.push({ section, sectionText })
      }
    }
  }

  log(`  Found ${untaggedSections.length} untagged sections`, colors.blue)

  // Process in batches
  for (let i = 0; i < untaggedSections.length; i += CONFIG.maxSectionsPerBatch) {
    const batch = untaggedSections.slice(i, i + CONFIG.maxSectionsPerBatch)
    const batchNum = Math.floor(i / CONFIG.maxSectionsPerBatch) + 1
    const totalBatches = Math.ceil(untaggedSections.length / CONFIG.maxSectionsPerBatch)

    log(`  Processing batch ${batchNum}/${totalBatches} (${batch.length} sections)...`, colors.cyan)

    try {
      const sectionsForApi = batch.map(b => ({
        number: b.section.number || b.section.id,
        text: b.sectionText
      }))

      const tagsArray = await generateTagsForBatch(sectionsForApi, apiKey)

      // Apply tags to sections
      for (let j = 0; j < batch.length; j++) {
        if (tagsArray[j]) {
          batch[j].section.semantic_tags = tagsArray[j]
          processedCount++
          log(`    Tagged ${batch[j].section.number || batch[j].section.id}: ${tagsArray[j].roles.length} roles, ${tagsArray[j].equipment.length} equipment`, colors.green)
        }
      }

      // Rate limiting between batches
      if (i + CONFIG.maxSectionsPerBatch < untaggedSections.length) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelayMs))
      }
    } catch (error) {
      errorCount += batch.length
      log(`    Batch error: ${error.message}`, colors.red)

      // Retry delay on error
      await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelayMs))
    }
  }

  // Save updated file
  const outputPath = path.join(CONFIG.outputDir, filename)
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')

  log(`Completed ${filename}: ${processedCount} tagged, ${errorCount} errors`, colors.blue)
  return { processed: processedCount, errors: errorCount }
}

// Generate a summary index of all tags
function generateTagIndex(dataDir) {
  const index = {
    byRole: {},
    byEquipment: {},
    byKeyword: {},
  }

  // Initialize
  ROLE_TAGS.forEach(r => { index.byRole[r] = [] })
  EQUIPMENT_TAGS.forEach(e => { index.byEquipment[e] = [] })

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const filePath = path.join(dataDir, file)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const country = file.replace('.json', '').toUpperCase()

    for (const law of data.laws || []) {
      for (const chapter of law.chapters || []) {
        for (const section of chapter.sections || []) {
          if (!section.semantic_tags) continue

          const ref = {
            country,
            lawId: law.id,
            lawTitle: law.title,
            sectionNumber: section.number,
            sectionTitle: section.title,
          }

          // Index by role
          for (const role of section.semantic_tags.roles || []) {
            if (!index.byRole[role]) index.byRole[role] = []
            index.byRole[role].push(ref)
          }

          // Index by equipment
          for (const equip of section.semantic_tags.equipment || []) {
            if (!index.byEquipment[equip]) index.byEquipment[equip] = []
            index.byEquipment[equip].push(ref)
          }

          // Index by keyword
          for (const keyword of section.semantic_tags.keywords || []) {
            const kw = keyword.toLowerCase()
            if (!index.byKeyword[kw]) index.byKeyword[kw] = []
            index.byKeyword[kw].push(ref)
          }
        }
      }
    }
  }

  return index
}

// Main function
async function main() {
  log('\n=== Semantic Tagging Script ===\n', colors.bright)

  // Get API key
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    log('Error: GEMINI_API_KEY environment variable not set', colors.red)
    log('Usage: GEMINI_API_KEY=your_key node scripts/generate-semantic-tags.js', colors.yellow)
    process.exit(1)
  }

  // Parse arguments
  const args = process.argv.slice(2)
  const countryArg = args.find(a => a.startsWith('--country='))
  const country = countryArg ? countryArg.split('=')[1].toLowerCase() : null
  const generateIndex = args.includes('--index')

  // Determine files to process
  let files = []
  if (country) {
    files = [`${country}.json`]
  } else {
    files = fs.readdirSync(CONFIG.dataDir).filter(f => f.endsWith('.json'))
  }

  log(`Files to process: ${files.join(', ')} (parallel: ${CONFIG.maxParallelFiles} workers)`, colors.blue)

  // Process files in parallel batches
  let totalProcessed = 0
  let totalErrors = 0

  // Process files in parallel chunks
  for (let i = 0; i < files.length; i += CONFIG.maxParallelFiles) {
    const batch = files.slice(i, i + CONFIG.maxParallelFiles)
    log(`\nProcessing batch ${Math.floor(i / CONFIG.maxParallelFiles) + 1}/${Math.ceil(files.length / CONFIG.maxParallelFiles)}: ${batch.join(', ')}`, colors.cyan)

    const results = await Promise.all(
      batch.map(file => processLawFile(file, apiKey).catch(err => {
        log(`Error processing ${file}: ${err.message}`, colors.red)
        return { processed: 0, errors: 1 }
      }))
    )

    for (const result of results) {
      if (result) {
        totalProcessed += result.processed
        totalErrors += result.errors
      }
    }
  }

  log(`\n=== Summary ===`, colors.bright)
  log(`Total sections tagged: ${totalProcessed}`, colors.green)
  log(`Total errors: ${totalErrors}`, colors.red)

  // Generate index if requested
  if (generateIndex) {
    log(`\nGenerating tag index...`, colors.cyan)
    const index = generateTagIndex(CONFIG.dataDir)
    const indexPath = path.join(CONFIG.dataDir, 'semantic-tags-index.json')
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')
    log(`Index saved to: ${indexPath}`, colors.green)

    // Print summary
    log(`\nTag Coverage:`, colors.blue)
    for (const role of ROLE_TAGS) {
      log(`  ${role}: ${index.byRole[role]?.length || 0} sections`)
    }
  }

  log('\nDone!', colors.green)
}

main().catch(error => {
  log(`Fatal error: ${error.message}`, colors.red)
  process.exit(1)
})

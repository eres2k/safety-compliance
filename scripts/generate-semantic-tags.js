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

// Configuration
const CONFIG = {
  dataDir: path.join(__dirname, '../src/data/laws'),
  outputDir: path.join(__dirname, '../src/data/laws'),
  geminiModel: 'gemini-2.0-flash',
  maxRetries: 3,
  retryDelayMs: 2000,
  rateLimitDelayMs: 500, // Delay between API calls
  batchSize: 5, // Process sections in batches
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

// Generate semantic tags for a section using AI
async function generateTagsForSection(sectionText, sectionNumber, apiKey) {
  const prompt = `You are a logistics safety expert. Analyze this regulation and tag it with relevant Amazon Logistics roles and equipment.

REGULATION:
${sectionText.substring(0, 2000)}

AVAILABLE ROLE TAGS (use only these):
${ROLE_TAGS.map(r => `- ${r}`).join('\n')}

AVAILABLE EQUIPMENT TAGS (use only these):
${EQUIPMENT_TAGS.map(e => `- ${e}`).join('\n')}

OUTPUT FORMAT (JSON only, no explanation, no markdown):
{
  "roles": ["Role1", "Role2"],
  "equipment": ["Equipment1", "Equipment2"],
  "hazards": ["brief hazard 1", "brief hazard 2"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  try {
    const tags = JSON.parse(jsonMatch[0])
    // Validate and filter tags
    return {
      roles: (tags.roles || []).filter(r => ROLE_TAGS.includes(r)),
      equipment: (tags.equipment || []).filter(e => EQUIPMENT_TAGS.includes(e)),
      hazards: (tags.hazards || []).slice(0, 5),
      keywords: (tags.keywords || []).slice(0, 10),
    }
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e.message}`)
  }
}

// Process a single law file
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

  // Process each law in the file
  for (const law of data.laws || []) {
    if (!law.chapters) continue

    for (const chapter of law.chapters) {
      if (!chapter.sections) continue

      for (const section of chapter.sections) {
        // Skip if already tagged
        if (section.semantic_tags) {
          continue
        }

        const sectionText = section.text || section.content || ''
        if (sectionText.length < 50) continue // Skip very short sections

        try {
          const tags = await generateTagsForSection(
            sectionText,
            section.number || section.id,
            apiKey
          )

          section.semantic_tags = tags
          processedCount++

          log(`  Tagged ${section.number || section.id}: ${tags.roles.length} roles, ${tags.equipment.length} equipment`, colors.green)

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelayMs))
        } catch (error) {
          errorCount++
          log(`  Error tagging ${section.number}: ${error.message}`, colors.red)

          // Retry delay on error
          await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelayMs))
        }
      }
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

  log(`Files to process: ${files.join(', ')}`, colors.blue)

  // Process files
  let totalProcessed = 0
  let totalErrors = 0

  for (const file of files) {
    const result = await processLawFile(file, apiKey)
    if (result) {
      totalProcessed += result.processed
      totalErrors += result.errors
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

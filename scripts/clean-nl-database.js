#!/usr/bin/env node
/**
 * Netherlands Law Database Cleanup Script
 * Uses Gemini AI to clean and format Dutch law content from wetten.overheid.nl
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node scripts/clean-nl-database.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration - Optimized for Gemini 3.0 Flash (1K RPM, 1M TPM, 10K RPD)
const CONFIG = {
  inputFile: path.join(__dirname, '../eu_safety_laws/nl/nl_database.json'),
  outputFile: path.join(__dirname, '../eu_safety_laws/nl/nl_database_cleaned.json'),
  backupFile: path.join(__dirname, '../eu_safety_laws/nl/nl_database_backup.json'),
  geminiModel: 'gemini-3-flash-preview',
  maxRetries: 3,
  retryDelayMs: 2000,
  rateLimitDelayMs: 100, // 100ms between requests (~600 RPM with margin)
  maxOutputTokens: 8192, // Gemini 3 supports larger outputs
}

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logError(message) {
  console.error(`${colors.red}ERROR: ${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green')
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan')
}

/**
 * Get API key from environment or .env file
 */
function getApiKey() {
  let apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    const envPath = path.join(__dirname, '../.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8')
      const match = envContent.match(/GEMINI_API_KEY=(.+)/)
      if (match) {
        apiKey = match[1].trim()
      }
    }
  }

  if (!apiKey) {
    apiKey = process.env.VITE_GEMINI_API_KEY
  }

  return apiKey
}

/**
 * Call Gemini API
 */
async function callGemini(apiKey, prompt, systemPrompt) {
  // Use v1 API for gemini-3-flash support
  const url = `https://generativelanguage.googleapis.com/v1/models/${CONFIG.geminiModel}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: CONFIG.maxOutputTokens,
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error?.message || `HTTP ${response.status}`
    throw new Error(`Gemini API error: ${errorMessage}`)
  }

  const data = await response.json()
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!generatedText) {
    throw new Error('No response generated from Gemini')
  }

  return generatedText
}

/**
 * Call Gemini with retry logic
 */
async function callGeminiWithRetry(apiKey, prompt, systemPrompt) {
  let lastError

  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      return await callGemini(apiKey, prompt, systemPrompt)
    } catch (error) {
      lastError = error
      logWarning(`Attempt ${attempt}/${CONFIG.maxRetries} failed: ${error.message}`)

      if (attempt < CONFIG.maxRetries) {
        const delay = CONFIG.retryDelayMs * attempt
        logInfo(`Retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }

  throw lastError
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Clean full_text content using Gemini
 */
async function cleanFullText(apiKey, fullText, lawTitle) {
  const systemPrompt = `You are a legal text formatter. Your task is to clean Dutch law text scraped from wetten.overheid.nl.

REMOVE the following website UI elements:
1. "Toon relaties in LiDO"
2. "Maak een permanente link"
3. "Toon wetstechnische informatie"
4. "Druk het regelingonderdeel af"
5. "Sla het regelingonderdeel op"
6. "[Wijziging(en) zonder datum inwerkingtreding aanwezig. Zie het wijzigingenoverzicht.]"
7. Navigation elements (breadcrumbs, menu items)
8. Any other UI boilerplate not part of the actual law text

KEEP:
1. All actual law content (artikelen, leden, definities)
2. Article numbers and titles (Artikel 1, Artikel 2, etc.)
3. Subsection markers (1, 2, 3 or a, b, c)
4. Legal definitions and their explanations
5. References to other laws and articles

FORMAT:
1. Each article (Artikel) should start on a new line
2. Subsections should be clearly numbered
3. Maintain proper paragraph breaks
4. Keep the text in Dutch

Return ONLY the cleaned law text, no explanations.`

  const prompt = `Clean this Dutch law text for "${lawTitle}":

${fullText.substring(0, 30000)}`

  return await callGeminiWithRetry(apiKey, prompt, systemPrompt)
}

/**
 * Clean section text (removes common boilerplate patterns)
 */
function cleanSectionTextBasic(text) {
  if (!text) return text

  // Remove wetten.overheid.nl boilerplate
  let cleaned = text
    .replace(/Toon relaties in LiDO\s*/gi, '')
    .replace(/Maak een permanente link\s*/gi, '')
    .replace(/Toon wetstechnische informatie\s*/gi, '')
    .replace(/\.{3,}\s*/g, '') // Remove "..."
    .replace(/Druk het regelingonderdeel af\s*/gi, '')
    .replace(/Sla het regelingonderdeel op\s*/gi, '')
    .replace(/\[Wijziging\(en\)[^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || text
}

/**
 * Clean section text using Gemini for complex cases
 */
async function cleanSectionText(apiKey, text, sectionTitle, lawTitle) {
  if (!text || text.length < 100) return cleanSectionTextBasic(text)

  const systemPrompt = `Clean this Dutch law section text. Remove website UI elements like "Toon relaties in LiDO", "Maak een permanente link", etc. Keep only the actual legal content. Return cleaned text only.`

  const prompt = `Clean this section from "${lawTitle}" - ${sectionTitle}:

${text.substring(0, 10000)}`

  try {
    return await callGeminiWithRetry(apiKey, prompt, systemPrompt)
  } catch {
    // Fallback to basic cleaning
    return cleanSectionTextBasic(text)
  }
}

/**
 * Process a single document
 */
async function processDocument(apiKey, doc, index, total) {
  const title = doc.abbreviation || doc.title || `Document ${index + 1}`
  logInfo(`[${index + 1}/${total}] Processing: ${title}`)

  const cleanedDoc = { ...doc }

  // Clean full_text if present
  if (doc.full_text && doc.full_text.length > 100) {
    try {
      cleanedDoc.full_text = await cleanFullText(apiKey, doc.full_text, title)
      logSuccess(`Cleaned full_text for ${title}`)
    } catch (error) {
      logError(`Failed to clean full_text for ${title}: ${error.message}`)
    }
  }

  // Clean section texts in chapters
  if (doc.chapters && Array.isArray(doc.chapters)) {
    cleanedDoc.chapters = []

    for (const chapter of doc.chapters) {
      const cleanedChapter = { ...chapter, sections: [] }

      if (chapter.sections && Array.isArray(chapter.sections)) {
        for (const section of chapter.sections) {
          const cleanedText = await cleanSectionText(
            apiKey,
            section.text,
            section.title || section.number,
            title
          )
          cleanedChapter.sections.push({ ...section, text: cleanedText })
          await sleep(300) // Rate limit between sections
        }
      }

      cleanedDoc.chapters.push(cleanedChapter)
    }
  }

  logSuccess(`Processed ${title}`)
  return cleanedDoc
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(60))
  log('Netherlands Law Database Cleanup Script', 'blue')
  console.log('='.repeat(60) + '\n')

  const apiKey = getApiKey()
  if (!apiKey) {
    logError('GEMINI_API_KEY not found!')
    console.log('\nPlease set the API key using one of these methods:')
    console.log('  1. Environment variable: export GEMINI_API_KEY=your_key')
    console.log('  2. Create a .env file with: GEMINI_API_KEY=your_key')
    console.log('  3. Inline: GEMINI_API_KEY=your_key node scripts/clean-nl-database.js')
    process.exit(1)
  }
  logSuccess('API key found')

  if (!fs.existsSync(CONFIG.inputFile)) {
    logError(`Input file not found: ${CONFIG.inputFile}`)
    process.exit(1)
  }
  logSuccess(`Input file: ${CONFIG.inputFile}`)

  logInfo('Reading database...')
  let database
  try {
    const content = fs.readFileSync(CONFIG.inputFile, 'utf-8')
    database = JSON.parse(content)
  } catch (error) {
    logError(`Failed to read/parse database: ${error.message}`)
    process.exit(1)
  }

  const documents = database.documents || []
  logSuccess(`Loaded ${documents.length} documents`)

  // Create backup
  logInfo('Creating backup...')
  try {
    fs.writeFileSync(CONFIG.backupFile, JSON.stringify(database, null, 2))
    logSuccess(`Backup created: ${CONFIG.backupFile}`)
  } catch (error) {
    logWarning(`Failed to create backup: ${error.message}`)
  }

  // Process documents
  console.log('\n' + '-'.repeat(40))
  log('Processing documents...', 'blue')
  console.log('-'.repeat(40) + '\n')

  const cleanedDocuments = []
  const errors = []

  for (let i = 0; i < documents.length; i++) {
    try {
      const cleanedDoc = await processDocument(apiKey, documents[i], i, documents.length)
      cleanedDocuments.push(cleanedDoc)
      await sleep(CONFIG.rateLimitDelayMs)
    } catch (error) {
      logError(`Failed to process document ${i + 1}: ${error.message}`)
      errors.push({ index: i, title: documents[i].title, error: error.message })
      cleanedDocuments.push(documents[i])
    }
  }

  // Save cleaned database
  console.log('\n' + '-'.repeat(40))
  log('Saving results...', 'blue')
  console.log('-'.repeat(40) + '\n')

  const cleanedDatabase = {
    ...database,
    metadata: {
      ...database.metadata,
      cleaned_at: new Date().toISOString(),
      cleaning_errors: errors.length,
    },
    documents: cleanedDocuments,
  }

  try {
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(cleanedDatabase, null, 2))
    logSuccess(`Cleaned database saved: ${CONFIG.outputFile}`)
  } catch (error) {
    logError(`Failed to save cleaned database: ${error.message}`)
    process.exit(1)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  log('Summary', 'blue')
  console.log('='.repeat(60))
  console.log(`Total documents: ${documents.length}`)
  console.log(`Successfully cleaned: ${documents.length - errors.length}`)
  console.log(`Errors: ${errors.length}`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(e => {
      console.log(`  - ${e.title}: ${e.error}`)
    })
  }

  console.log(`\nOutput file: ${CONFIG.outputFile}`)
  console.log(`Backup file: ${CONFIG.backupFile}`)

  console.log('\nTo apply changes, run:')
  console.log(`  mv ${CONFIG.outputFile} ${CONFIG.inputFile}`)

  console.log('\n' + '='.repeat(60) + '\n')
}

main().catch(error => {
  logError(`Unexpected error: ${error.message}`)
  console.error(error)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Austrian Law Database Cleanup Script
 * Uses Gemini AI to clean and format Austrian RIS law content
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node scripts/clean-at-database.js
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
  inputFile: path.join(__dirname, '../eu_safety_laws/at/at_database.json'),
  outputFile: path.join(__dirname, '../eu_safety_laws/at/at_database_cleaned.json'),
  backupFile: path.join(__dirname, '../eu_safety_laws/at/at_database_backup.json'),
  geminiModel: 'gemini-2.5-flash',
  maxRetries: 3,
  retryDelayMs: 2000,
  rateLimitDelayMs: 1000, // Delay between API calls to avoid rate limits
}

// ANSI colors for console output
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
 * Check for API key
 */
function getApiKey() {
  // Try environment variable first
  let apiKey = process.env.GEMINI_API_KEY

  // Try to load from .env file if not in environment
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

  // Also check for VITE_ prefixed version
  if (!apiKey) {
    apiKey = process.env.VITE_GEMINI_API_KEY
  }

  return apiKey
}

/**
 * Call Gemini API to clean text
 */
async function callGemini(apiKey, prompt, systemPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent output
        maxOutputTokens: 8192,
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

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Clean full_text content using Gemini
 */
async function cleanFullText(apiKey, fullText, lawTitle) {
  const systemPrompt = `You are a legal text formatter. Your task is to clean Austrian law text that was scraped from the RIS (Rechtsinformationssystem) website.

REMOVE the following:
1. Navigation boilerplate (Seitenbereiche, Zum Inhalt, Accesskey, Navigationsleiste, etc.)
2. Website UI elements (Druckansicht, Andere Formate, etc.)
3. Duplicate text where both abbreviated (§ 1 Abs. 1) AND written-out (Paragraph eins, Absatz eins) forms appear - keep ONLY the abbreviated form
4. Double commas (,,) that result from removing duplicates
5. Amendment history at the start (BGBl references, CELEX numbers, etc.) - but keep inline BGBl references within the law text

KEEP:
1. All actual law content (sections, paragraphs, definitions)
2. Section numbers and titles (§ 1, § 2, etc.)
3. Subsection markers ((1), (2), etc.)
4. Inline legal references to other laws

FORMAT:
1. Each section (§) should start on a new line
2. Subsections ((1), (2)) should be clearly separated
3. Maintain proper paragraph breaks
4. Keep the text in German

Return ONLY the cleaned law text, no explanations or comments.`

  const prompt = `Clean this Austrian law text for "${lawTitle}":

${fullText.substring(0, 30000)}` // Limit input size

  return await callGeminiWithRetry(apiKey, prompt, systemPrompt)
}

/**
 * Clean section text (shorter content in chapters)
 */
function cleanSectionText(text) {
  if (!text) return text

  // Remove duplicate written-out forms
  // Pattern: "Paragraph eins," or "Absatz eins," etc.
  let cleaned = text
    .replace(/Paragraph \w+,?\s*/gi, '')
    .replace(/Absatz \w+,?\s*/gi, '')
    .replace(/Ziffer \w+,?\s*/gi, '')
    .replace(/Litera \w+,?\s*/gi, '')
    .replace(/,\s*,/g, ',') // Remove double commas
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  return cleaned || text // Return original if cleaned is empty
}

/**
 * Process a single document
 */
async function processDocument(apiKey, doc, index, total) {
  const title = doc.title || doc.abbreviation || `Document ${index + 1}`
  logInfo(`[${index + 1}/${total}] Processing: ${title}`)

  const cleanedDoc = { ...doc }

  // Clean full_text if present
  if (doc.full_text && doc.full_text.length > 100) {
    try {
      cleanedDoc.full_text = await cleanFullText(apiKey, doc.full_text, title)
      logSuccess(`Cleaned full_text for ${title}`)
    } catch (error) {
      logError(`Failed to clean full_text for ${title}: ${error.message}`)
      // Keep original on error
    }
  }

  // Clean section texts in chapters
  if (doc.chapters && Array.isArray(doc.chapters)) {
    cleanedDoc.chapters = doc.chapters.map(chapter => ({
      ...chapter,
      sections: chapter.sections?.map(section => ({
        ...section,
        text: cleanSectionText(section.text),
      })) || [],
    }))
  }

  return cleanedDoc
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(60))
  log('Austrian Law Database Cleanup Script', 'blue')
  console.log('='.repeat(60) + '\n')

  // Check API key
  const apiKey = getApiKey()
  if (!apiKey) {
    logError('GEMINI_API_KEY not found!')
    console.log('\nPlease set the API key using one of these methods:')
    console.log('  1. Environment variable: export GEMINI_API_KEY=your_key')
    console.log('  2. Create a .env file with: GEMINI_API_KEY=your_key')
    console.log('  3. Inline: GEMINI_API_KEY=your_key node scripts/clean-at-database.js')
    process.exit(1)
  }
  logSuccess('API key found')

  // Check input file
  if (!fs.existsSync(CONFIG.inputFile)) {
    logError(`Input file not found: ${CONFIG.inputFile}`)
    process.exit(1)
  }
  logSuccess(`Input file: ${CONFIG.inputFile}`)

  // Read database
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

      // Rate limit delay
      if (i < documents.length - 1) {
        await sleep(CONFIG.rateLimitDelayMs)
      }
    } catch (error) {
      logError(`Failed to process document ${i + 1}: ${error.message}`)
      errors.push({ index: i, title: documents[i].title, error: error.message })
      cleanedDocuments.push(documents[i]) // Keep original on error
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

// Run
main().catch(error => {
  logError(`Unexpected error: ${error.message}`)
  console.error(error)
  process.exit(1)
})

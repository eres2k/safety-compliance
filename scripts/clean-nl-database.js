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

// Configuration - Optimized for Gemini 2.5 Flash (2K RPM, 4M TPM)
const CONFIG = {
  inputFile: path.join(__dirname, '../eu_safety_laws/nl/nl_database.json'),
  outputFile: path.join(__dirname, '../eu_safety_laws/nl/nl_database_cleaned.json'),
  backupFile: path.join(__dirname, '../eu_safety_laws/nl/nl_database_backup.json'),
  geminiModel: 'gemini-2.5-flash-lite',  // 4K RPM for batch processing
  maxRetries: 3,
  retryDelayMs: 2000,
  rateLimitDelayMs: 50,
  maxOutputTokens: 8192,
}

// Official Arbowet (Arbeidsomstandighedenwet) section titles
// Source: https://wetten.overheid.nl/BWBR0010346/geldend
const ARBOWET_SECTION_TITLES = {
  // Hoofdstuk 1 - Definities en toepassingsgebied
  '1': 'Definities',
  '2': 'Uitbreiding toepassingsgebied',
  // Hoofdstuk 2 - Arbeidsomstandighedenbeleid
  '3': 'Arbobeleid',
  '4': 'Aanpassing arbeidsplaats werknemer met structurele functionele beperking',
  '5': 'Inventarisatie en evaluatie van risico\'s',
  '6': 'Voorkoming en beperking van zware ongevallen waarbij gevaarlijke stoffen zijn betrokken',
  '7': 'Informatie aan het publiek',
  '8': 'Voorlichting en onderricht',
  '9': 'Melding en registratie van arbeidsongevallen en beroepsziekten',
  '10': 'Voorkomen van gevaar voor derden',
  '11': 'Algemene verplichtingen van de werknemers',
  // Hoofdstuk 3 - Samenwerking, overleg, bijzondere rechten en deskundige bijstand
  '12': 'Samenwerking, overleg en bijzondere rechten van werknemers',
  '13': 'Bijstand deskundige werknemers op het gebied van preventie en bescherming',
  '14': 'Maatwerkregeling aanvullende deskundige bijstand',
  '14a': 'Vangnetregeling aanvullende deskundige bijstand',
  '14b': 'Basiscontract arbodienstverlening',
  '15': 'Deskundige bijstand op het gebied van bedrijfshulpverlening',
  // Hoofdstuk 4 - Bijzondere verplichtingen
  '16': 'Nadere regels met betrekking tot arbeidsomstandigheden',
  '17': 'Maatwerk door werkgevers en werknemers',
  '18': 'Arbeidsgezondheidskundig onderzoek',
  '19': 'Verschillende werkgevers',
  '20': 'Certificatie',
  '21': 'Verplichting tot geheimhouding',
  '22': 'Toetredingsovereenkomst en centraal orgaan',
  '23': 'Jaarverslag',
  // Hoofdstuk 5 - Toezicht en ambtelijke bevelen
  '24': 'Ambtenaren belast met het toezicht',
  '25': 'Toezicht op instellingen',
  '26': 'Geheimhouding',
  '27': 'Eis tot naleving',
  '28': 'Stillegging van het werk',
  '29': 'Taak ondernemingsraad bij niet-naleving',
  // Hoofdstuk 6 - Vrijstellingen, ontheffingen en beroep
  '30': 'Vrijstelling en ontheffing',
  '31': 'Beroep',
  // Hoofdstuk 7 - Sancties
  '32': 'Strafbepaling',
  '33': 'Overtredingen',
  '33a': 'Bestuurlijke boete',
  '34': 'Hoogte bestuurlijke boete en recidive',
  '35': 'Procedure bestuurlijke boete',
  '36': 'Betaling bestuurlijke boete',
  '37': 'Verjaring',
  '38': 'Overgangsrecht',
  '39': 'Beperking arbeid',
  '40': 'Namen en bedragen',
  '41': 'Boetebesluit arbeidsomstandighedenwet',
  '42': 'Inwerkingtreding sanctiebepalingen',
  '43': 'Intrekking',
  // Hoofdstuk 8 - Overgangs- en slotbepalingen
  '44': 'Kosten',
  '45': 'Overgangsbepaling',
  '46': 'Citeertitel',
  '47': 'Inwerkingtreding',
}

// Official Arbeidstijdenwet section titles
// Source: https://wetten.overheid.nl/BWBR0007671/geldend
const ARBEIDSTIJDENWET_SECTION_TITLES = {
  // Hoofdstuk 1 - Algemene bepalingen
  '1:1': 'Begripsbepalingen',
  '1:2': 'Toepassingsgebied',
  '1:3': 'Karakter van de wet',
  '1:4': 'Doelvoorschriften',
  // Hoofdstuk 2 - Arbeids- en rusttijden
  '2:1': 'Arbeidstijd per dag',
  '2:2': 'Arbeidstijd per week',
  '2:3': 'Arbeidstijd per periode',
  '2:4': 'Rusttijd per dag',
  '2:5': 'Rusttijd per week',
  '2:6': 'Pauze',
  '2:7': 'Wekelijkse rust',
  // Hoofdstuk 3 - Nachtarbeid
  '3:1': 'Begripsbepaling',
  '3:2': 'Nachtarbeid',
  '3:3': 'Rusttijd na nachtdienst',
  // Hoofdstuk 4 - Consignatie
  '4:1': 'Consignatie',
  '4:2': 'Bereikbaarheidsdienst',
  '4:3': 'Aanwezigheidsdienst',
  // Hoofdstuk 5 - Bijzondere bepalingen
  '5:1': 'Afwijkingen door werkgever en werknemer',
  '5:2': 'Collectieve regeling',
  '5:3': 'Afwijking bij ministeriële regeling',
  '5:4': 'Ontheffing',
  '5:5': 'Medische keuring',
  '5:6': 'Registratie',
  '5:7': 'Bewaarplicht',
  '5:8': 'Informatieverstrekking',
  '5:9': 'Melding',
  '5:10': 'Zondagsarbeid',
  '5:11': 'Feestdagen',
  '5:12': 'Zondagsrust',
  // Hoofdstuk 6 - Handhaving
  '6:1': 'Toezicht',
  '6:2': 'Bestuurlijke boete',
  '6:3': 'Strafbepaling',
  // Hoofdstuk 7 - Slotbepalingen
  '7:1': 'Evaluatie',
  '7:2': 'Citeertitel',
  '7:3': 'Inwerkingtreding',
}

// Map of all Dutch law section titles by abbreviation
const NL_SECTION_TITLES = {
  ARBOWET: ARBOWET_SECTION_TITLES,
  ARBEIDSTIJDENWET: ARBEIDSTIJDENWET_SECTION_TITLES,
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
  // Use v1beta API for gemini-2.5-flash
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
 * Get official section title for any Dutch law
 * Converts "1" to "Artikel 1. Definities" (or equivalent title)
 */
function getNLSectionTitle(sectionNumber, currentTitle, abbreviation) {
  if (!sectionNumber || !abbreviation) return currentTitle

  // Normalize abbreviation (handle case variations)
  const abbrevUpper = abbreviation.toUpperCase().replace(/\s+/g, '')

  // Get the title map for this law
  const titleMap = NL_SECTION_TITLES[abbrevUpper]
  if (!titleMap) return currentTitle

  // Extract section number key
  const sectionKey = sectionNumber.toString().toLowerCase()

  // Try exact match first
  let officialTitle = titleMap[sectionKey]

  // If no match, try removing 'a', 'b' suffixes and matching base number
  if (!officialTitle) {
    const numMatch = sectionKey.match(/^(\d+[a-z]?)$/i)
    if (numMatch) {
      officialTitle = titleMap[numMatch[1].toLowerCase()]
    }
  }

  if (officialTitle) {
    return `Artikel ${sectionNumber}. ${officialTitle}`
  }

  return currentTitle
}

/**
 * Update section titles with official titles for all supported NL laws
 */
function updateSectionTitles(chapters, abbreviation) {
  if (!chapters || !Array.isArray(chapters) || !abbreviation) {
    return chapters
  }

  // Check if we have title mappings for this law
  const abbrevUpper = abbreviation.toUpperCase().replace(/\s+/g, '')
  if (!NL_SECTION_TITLES[abbrevUpper]) {
    return chapters
  }

  return chapters.map(chapter => ({
    ...chapter,
    sections: chapter.sections?.map(section => ({
      ...section,
      title: getNLSectionTitle(section.number, section.title, abbreviation),
    })) || [],
  }))
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

  // Update section titles with official NL law titles
  if (cleanedDoc.chapters && cleanedDoc.abbreviation) {
    const abbrevUpper = cleanedDoc.abbreviation.toUpperCase().replace(/\s+/g, '')
    if (NL_SECTION_TITLES[abbrevUpper]) {
      cleanedDoc.chapters = updateSectionTitles(cleanedDoc.chapters, cleanedDoc.abbreviation)
      const sectionCount = cleanedDoc.chapters.reduce((sum, ch) => sum + (ch.sections?.length || 0), 0)
      logSuccess(`Updated ${sectionCount} section titles for ${abbrevUpper}`)
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

/**
 * Fix section titles only (without Gemini API)
 * This can be run with: node scripts/clean-nl-database.js --titles-only
 *
 * Supports all NL laws with title mappings: Arbowet, Arbeidstijdenwet
 */
async function fixTitlesOnly() {
  console.log('\n' + '='.repeat(60))
  log('Dutch Law Section Titles Fix Script', 'blue')
  console.log('='.repeat(60) + '\n')

  // Show supported laws
  const supportedLaws = Object.keys(NL_SECTION_TITLES).join(', ')
  logInfo(`Supported laws: ${supportedLaws}`)

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

  // Process documents - only update titles for supported laws
  console.log('\n' + '-'.repeat(40))
  log('Updating section titles...', 'blue')
  console.log('-'.repeat(40) + '\n')

  let totalSectionsUpdated = 0
  let lawsUpdated = []
  const updatedDocuments = documents.map(doc => {
    const abbrevUpper = doc.abbreviation?.toUpperCase().replace(/\s+/g, '')
    if (doc.chapters && abbrevUpper && NL_SECTION_TITLES[abbrevUpper]) {
      const updatedChapters = updateSectionTitles(doc.chapters, doc.abbreviation)
      const sectionCount = updatedChapters.reduce((sum, ch) => sum + (ch.sections?.length || 0), 0)
      totalSectionsUpdated += sectionCount
      lawsUpdated.push(abbrevUpper)
      logSuccess(`Updated ${sectionCount} sections in ${doc.abbreviation}`)
      return { ...doc, chapters: updatedChapters }
    }
    return doc
  })

  // Save updated database directly to input file
  console.log('\n' + '-'.repeat(40))
  log('Saving results...', 'blue')
  console.log('-'.repeat(40) + '\n')

  const updatedDatabase = {
    ...database,
    metadata: {
      ...database.metadata,
      titles_updated_at: new Date().toISOString(),
    },
    documents: updatedDocuments,
  }

  try {
    fs.writeFileSync(CONFIG.inputFile, JSON.stringify(updatedDatabase, null, 2))
    logSuccess(`Updated database saved: ${CONFIG.inputFile}`)
  } catch (error) {
    logError(`Failed to save database: ${error.message}`)
    process.exit(1)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  log('Summary', 'blue')
  console.log('='.repeat(60))
  console.log(`Total documents: ${documents.length}`)
  console.log(`Laws with title updates: ${lawsUpdated.join(', ') || 'None'}`)
  console.log(`Total sections updated: ${totalSectionsUpdated}`)
  console.log('\n' + '='.repeat(60) + '\n')
}

// Run appropriate function based on command line argument
if (process.argv.includes('--titles-only')) {
  fixTitlesOnly().catch(error => {
    logError(`Unexpected error: ${error.message}`)
    console.error(error)
    process.exit(1)
  })
} else {
  main().catch(error => {
    logError(`Unexpected error: ${error.message}`)
    console.error(error)
    process.exit(1)
  })
}

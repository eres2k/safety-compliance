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

// Configuration - Optimized for Gemini 3.0 Flash (1K RPM, 1M TPM, 10K RPD)
const CONFIG = {
  inputFile: path.join(__dirname, '../eu_safety_laws/at/at_database.json'),
  outputFile: path.join(__dirname, '../eu_safety_laws/at/at_database_cleaned.json'),
  backupFile: path.join(__dirname, '../eu_safety_laws/at/at_database_backup.json'),
  geminiModel: 'gemini-3-flash',
  maxRetries: 3,
  retryDelayMs: 2000,
  rateLimitDelayMs: 100, // 100ms between requests (~600 RPM with margin)
  maxOutputTokens: 8192, // Gemini 3 supports larger outputs
}

// Official ASchG (ArbeitnehmerInnenschutzgesetz) section titles
// Source: https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910
const ASCHG_SECTION_TITLES = {
  // 1. Abschnitt - Allgemeine Bestimmungen
  '1': 'Geltungsbereich',
  '2': 'Begriffsbestimmungen',
  // 2. Abschnitt - Arbeitgeber
  '3': 'Allgemeine Pflichten der Arbeitgeber',
  '4': 'Ermittlung und Beurteilung der Gefahren; Festlegung von Maßnahmen',
  '5': 'Sicherheits- und Gesundheitsschutzdokumente',
  '6': 'Einsatz der Arbeitnehmer',
  '7': 'Grundsätze der Gefahrenverhütung',
  '8': 'Koordination',
  '9': 'Überlassung',
  '10': 'Bestellung von Sicherheitsvertrauenspersonen',
  '11': 'Aufgaben, Information und Beiziehung der Sicherheitsvertrauenspersonen',
  '12': 'Information',
  '13': 'Anhörung und Beteiligung der Arbeitnehmer',
  '14': 'Unterweisung',
  // 3. Abschnitt - Arbeitnehmer
  '15': 'Pflichten der Arbeitnehmer',
  '16': 'Besondere Pflichten der Arbeitnehmer',
  // 4. Abschnitt - Arbeitsstätten
  '17': 'Allgemeine Anforderungen an Arbeitsstätten',
  '18': 'Nichtraucherschutz',
  '19': 'Brandschutz und Explosionsschutz',
  '20': 'Erste Hilfe',
  '21': 'Arbeitsstätten in Gebäuden',
  '22': 'Arbeitsstätten im Freien',
  '23': 'Baustellen',
  '24': 'Auswärtige Arbeitsstellen',
  '25': 'Lärm, Erschütterungen, Strahlung',
  '26': 'Beleuchtung, Raumklima',
  // 5. Abschnitt - Arbeitsmittel
  '27': 'Allgemeine Bestimmungen über die Beschaffenheit',
  '28': 'Aufstellung, Wartung und Prüfung',
  '29': 'Besondere Bestimmungen über die Beschaffenheit von Arbeitsmitteln',
  '30': 'Anforderungen an die Benutzung',
  '31': 'Schutzeinrichtungen',
  '32': 'Ergonomie',
  '33': 'Brandschutz und Maßnahmen zur Brandbekämpfung',
  // 6. Abschnitt - Arbeitsstoffe
  '34': 'Allgemeine Bestimmungen',
  '35': 'Grenzwerte',
  '36': 'Besondere Bestimmungen',
  '37': 'Messungen',
  '38': 'Krebserzeugende, erbgutverändernde und fortpflanzungsgefährdende Arbeitsstoffe',
  '39': 'Biologische Arbeitsstoffe',
  '40': 'Persönliche Schutzausrüstung',
  '41': 'Vorsorgemaßnahmen bei Unfällen',
  '42': 'Verbotsbestimmungen',
  // 7. Abschnitt - Gesundheitsüberwachung
  '43': 'Verpflichtung zur Gesundheitsüberwachung',
  '44': 'Zuständige Ärzte',
  '45': 'Pflichten der Arbeitgeber',
  '46': 'Rechte und Pflichten der Arbeitnehmer',
  '47': 'Befunde; Bescheinigungen',
  '48': 'Eignungs- und Folgeuntersuchungen',
  '49': 'Sonstige besondere Untersuchungen',
  '50': 'Übermittlung von Daten',
  // 8. Abschnitt - Präventivdienste
  '51': 'Beschäftigung von Sicherheitsfachkräften',
  '52': 'Anforderungen an Sicherheitsfachkräfte',
  '53': 'Übertragung der Aufgaben von Sicherheitsfachkräften an eigene Arbeitnehmer',
  '54': 'Aufgaben der Sicherheitsfachkräfte',
  '55': 'Weitere Fachleute',
  '56': 'Arbeitsmedizinische Zentren',
  '57': 'Meldepflicht',
  '58': 'Sicherheitstechnische Zentren',
  '59': 'Beschäftigung von Arbeitsmedizinern',
  '60': 'Anforderungen an Arbeitsmediziner',
  '61': 'Sonstige geeignete Fachleute',
  '62': 'Arbeitspsychologen und sonstige geeignete Fachleute',
  '63': 'Verhinderung der Präventivfachkräfte',
  '64': 'Tätigkeitsberichte',
  '65': 'Informations- und Begehungspflichten',
  '66': 'Aufgaben der Arbeitsmediziner',
  '67': 'Stellung der Präventivfachkräfte',
  '68': 'Präventionszeit; Einsatzzeit',
  '69': 'Präventionszeit bei Baustellen',
  '70': 'Fachkundige Personen; Präventivdienste',
  '71': 'Begehung durch Präventivdienste',
  '72': 'Information der Präventivfachkräfte',
  '73': 'Beiziehung von Präventivfachkräften',
  '74': 'Pflichtenübertragung',
  '75': 'Zusammenarbeit der Präventivfachkräfte',
  '76': 'Arbeitsschutzausschüsse',
  '77': 'Zentral-Arbeitsinspektorat',
  '78': 'Sicherheitstechnische und arbeitsmedizinische Betreuung der Arbeitnehmer von Gebietskörperschaften',
  '79': 'Aufgaben, Rechte und Pflichten der sicherheitstechnischen und arbeitsmedizinischen Zentren',
  '80': 'Verordnungsermächtigung',
  '81': 'Arbeitsinspektion',
  '82': 'Strafbestimmungen',
  '83': 'Verfahrensbestimmungen',
  // 9. Abschnitt - Behörden und Verfahren
  '84': 'Vorarbeiten für Verordnungen',
  '85': 'Betretungsrecht',
  '86': 'Auskunftsrecht',
  '87': 'Weitere Aufgaben und Befugnisse',
  '88': 'Beratung und Überwachung',
  '89': 'Mitwirkungspflichten',
  '90': 'Ausnahmen',
  '91': 'Bescheidmäßige Vorschreibung',
  '92': 'Übertretungen',
  '93': 'Zusammenarbeit',
  '94': 'Datenschutz',
  // 10. Abschnitt - Übergangs- und Schlussbestimmungen
  '95': 'Verweisungen',
  '96': 'Übergangsbestimmungen',
  '97': 'Übergangsbestimmungen für das 9. Hauptstück',
  '98': 'Außerkrafttreten',
  '99': 'Inkrafttreten',
  '100': 'Vollziehung',
  '101': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 60/2015',
  '102': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 126/2017',
  '103': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 100/2018',
  '104': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 68/2019',
  '105': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 131/2020',
  '106': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 42/2021',
  '107': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 148/2022',
  '108': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 168/2023',
  '109': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 37/2024',
  '110': 'Übergangsbestimmung zur Novelle BGBl. I Nr. 92/2024',
  // Additional sections with letter suffixes
  '4a': 'Präventivdienste für Baustellen',
  '5a': 'Ermittlung und Beurteilung der Gefahren bei Baustellen',
  '7a': 'Koordination bei Baustellen',
  '8a': 'Vorankündigung',
  '10a': 'Sicherheitsvertrauenspersonen auf Baustellen',
  '17a': 'Sicherheits- und Gesundheitsschutzkennzeichnung',
  '18a': 'Rauchverbot',
  '19a': 'Maßnahmen zur Ersten Hilfe',
  '20a': 'Erste-Hilfe-Beauftragung',
  '25a': 'Elektromagnetische Felder',
  '25b': 'Optische Strahlung',
  '40a': 'Arbeitskleidung',
  '40b': 'Reinigung und Aufbewahrung',
  '42a': 'Aufbewahrung und Lagerung',
  '48a': 'Eignungsuntersuchung für Taucher',
  '68a': 'Präventionszeit für Sicherheitsfachkräfte',
  '68b': 'Präventionszeit für Arbeitsmediziner',
  '82a': 'Strafbestimmungen für Arbeitgeber',
  '82b': 'Strafbestimmungen für Arbeitnehmer',
  '82c': 'Strafbestimmungen für sonstige Personen',
  '83a': 'Gemeinsame Verfahrensbestimmungen',
  '93a': 'Zusammenarbeit mit anderen Behörden',
  '93b': 'Zusammenarbeit auf Gemeinschaftsebene',
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
        temperature: 0.1, // Low temperature for consistent output
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
 * Get official section title for ASchG sections
 * Converts "§ 1" to "§ 1. Geltungsbereich"
 */
function getASchGSectionTitle(sectionNumber, currentTitle) {
  if (!sectionNumber) return currentTitle

  // Extract section number (e.g., "1", "4a", "25b")
  const numMatch = sectionNumber.toString().match(/^(\d+[a-z]?)$/i)
  if (!numMatch) return currentTitle

  const sectionNum = numMatch[1].toLowerCase()
  const officialTitle = ASCHG_SECTION_TITLES[sectionNum]

  if (officialTitle) {
    return `§ ${sectionNumber}. ${officialTitle}`
  }

  return currentTitle
}

/**
 * Update section titles with official ASchG titles
 */
function updateSectionTitles(chapters, abbreviation) {
  // Only apply to ASchG documents
  if (abbreviation?.toUpperCase() !== 'ASCHG') {
    return chapters
  }

  if (!chapters || !Array.isArray(chapters)) {
    return chapters
  }

  return chapters.map(chapter => ({
    ...chapter,
    sections: chapter.sections?.map(section => ({
      ...section,
      title: getASchGSectionTitle(section.number, section.title),
    })) || [],
  }))
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

  // Update section titles with official ASchG titles
  if (cleanedDoc.chapters && cleanedDoc.abbreviation) {
    cleanedDoc.chapters = updateSectionTitles(cleanedDoc.chapters, cleanedDoc.abbreviation)
    const sectionCount = cleanedDoc.chapters.reduce((sum, ch) => sum + (ch.sections?.length || 0), 0)
    logSuccess(`Updated ${sectionCount} section titles with official ASchG titles`)
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

/**
 * Fix section titles only (without Gemini API)
 * This can be run with: node scripts/clean-at-database.js --titles-only
 */
async function fixTitlesOnly() {
  console.log('\n' + '='.repeat(60))
  log('ASchG Section Titles Fix Script', 'blue')
  console.log('='.repeat(60) + '\n')

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

  // Process documents - only update titles
  console.log('\n' + '-'.repeat(40))
  log('Updating section titles...', 'blue')
  console.log('-'.repeat(40) + '\n')

  let totalSectionsUpdated = 0
  const updatedDocuments = documents.map(doc => {
    if (doc.chapters && doc.abbreviation?.toUpperCase() === 'ASCHG') {
      const updatedChapters = updateSectionTitles(doc.chapters, doc.abbreviation)
      const sectionCount = updatedChapters.reduce((sum, ch) => sum + (ch.sections?.length || 0), 0)
      totalSectionsUpdated += sectionCount
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
    logError(`Failed to save updated database: ${error.message}`)
    process.exit(1)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  log('Summary', 'blue')
  console.log('='.repeat(60))
  console.log(`Total documents processed: ${documents.length}`)
  console.log(`Total sections updated: ${totalSectionsUpdated}`)
  console.log(`\nBackup file: ${CONFIG.backupFile}`)
  console.log('\n' + '='.repeat(60) + '\n')
}

// Parse command-line arguments and run
const args = process.argv.slice(2)
if (args.includes('--titles-only')) {
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

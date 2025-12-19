/**
 * Shared Cleaning Utilities for EU Safety Laws
 * Consolidates Python/JS duplication - single source of truth for cleaning logic
 */

const fs = require('fs')
const path = require('path')

// Load centralized config
let config = {}
try {
  const configPath = path.join(__dirname, '../../eu_safety_laws/config.json')
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
} catch (e) {
  console.warn('Could not load config.json, using defaults')
}

/**
 * German number word to digit mappings
 */
const GERMAN_ORDINALS = config.german_number_patterns?.ordinals || {
  'erster': '1', 'erste': '1', 'ersten': '1',
  'zweiter': '2', 'zweite': '2', 'zweiten': '2',
  'dritter': '3', 'dritte': '3', 'dritten': '3',
  'vierter': '4', 'vierte': '4', 'vierten': '4',
  'fünfter': '5', 'fünfte': '5', 'fünften': '5',
  'sechster': '6', 'sechste': '6', 'sechsten': '6',
  'siebter': '7', 'siebte': '7', 'siebten': '7', 'siebenter': '7',
  'achter': '8', 'achte': '8', 'achten': '8',
  'neunter': '9', 'neunte': '9', 'neunten': '9',
  'zehnter': '10', 'zehnte': '10', 'zehnten': '10',
  'elfter': '11', 'elfte': '11', 'elften': '11',
  'zwölfter': '12', 'zwölfte': '12', 'zwölften': '12',
  'dreizehnter': '13', 'dreizehnte': '13', 'dreizehnten': '13',
  'vierzehnter': '14', 'vierzehnte': '14', 'vierzehnten': '14',
  'fünfzehnter': '15', 'fünfzehnte': '15', 'fünfzehnten': '15'
}

const GERMAN_CARDINALS = config.german_number_patterns?.cardinals || {
  'eins': '1', 'ein': '1', 'eine': '1', 'einem': '1', 'einen': '1',
  'zwei': '2',
  'drei': '3',
  'vier': '4',
  'fünf': '5',
  'sechs': '6',
  'sieben': '7',
  'acht': '8',
  'neun': '9',
  'zehn': '10',
  'elf': '11',
  'zwölf': '12'
}

/**
 * Boilerplate patterns to remove by country
 */
const BOILERPLATE_PATTERNS = {
  AT: [
    /^Seitenbereiche:[\s\S]*?Barrierefreiheitserklärung[\s\S]*?\)/im,
    /^Seitenbereiche:.*$/gim,
    /Zum Inhalt\s*\([^)]*\)/gi,
    /Zur Navigationsleiste\s*\([^)]*\)/gi,
    /Kontakt\s*\([^)]*\)/gi,
    /Impressum\s*\([^)]*\)/gi,
    /Datenschutzerklärung\s*\([^)]*\)/gi,
    /Barrierefreiheitserklärung\s*\([^)]*\)/gi,
    /Accesskey\s*\d+/gi,
    /^\s*\(\s*\)\s*$/gm
  ],
  DE: [
    /Drucken\s*(als PDF|PDF)?/gi,
    /Textversion\s*(PDF)?/gi,
    /Service-Navigation/gi,
    /Servicebereich/gi
  ],
  NL: [
    /^Zoeken.*$/gim,
    /^Menu$/gim,
    /^Service$/gim,
    /Naar de inhoud/gi,
    /Naar de navigatie/gi
  ]
}

/**
 * Section title mappings by country and law
 */
const SECTION_TITLES = config.section_title_mappings || {}

/**
 * Remove boilerplate text from law content
 */
function removeBoilerplate(text, country = 'DE') {
  if (!text) return ''

  let cleaned = text
  const patterns = BOILERPLATE_PATTERNS[country] || []

  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '')
  }

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  return cleaned
}

/**
 * Convert German number words to digits
 */
function convertGermanNumbers(text) {
  if (!text) return ''

  let result = text

  // Convert ordinals (erster -> 1.)
  Object.entries(GERMAN_ORDINALS).forEach(([word, digit]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    result = result.replace(regex, digit + '.')
  })

  // Convert cardinals in context (Paragraph eins -> § 1)
  // Only when preceded by section markers
  Object.entries(GERMAN_CARDINALS).forEach(([word, digit]) => {
    // Paragraph X / Absatz X / Ziffer X patterns
    const patterns = [
      new RegExp(`(Paragraph)\\s+${word}\\b`, 'gi'),
      new RegExp(`(Absatz)\\s+${word}\\b`, 'gi'),
      new RegExp(`(Ziffer)\\s+${word}\\b`, 'gi'),
      new RegExp(`(Punkt)\\s+${word}\\b`, 'gi')
    ]

    patterns.forEach(pattern => {
      result = result.replace(pattern, (match, prefix) => {
        if (prefix.toLowerCase() === 'paragraph') return `§ ${digit}`
        return `${prefix} ${digit}`
      })
    })
  })

  return result
}

/**
 * Remove duplicate expanded notation from Austrian legal documents
 * The source contains both abbreviated (§ 1, Abs. 1) and expanded (Paragraph eins, Absatz eins)
 */
function cleanDuplicateNotation(text) {
  if (!text) return ''

  let cleaned = text

  // Remove standalone expanded paragraphs (Paragraph eins -> remove)
  const expandedPatterns = [
    // Standalone "Paragraph X" on its own line
    /^\s*Paragraph\s+(eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|dreizehn|vierzehn|fünfzehn)\s*$/gim,
    // Standalone "Absatz X"
    /^\s*Absatz\s+(eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s*$/gim,
    // Standalone "Ziffer X"
    /^\s*Ziffer\s+(eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s*$/gim
  ]

  expandedPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '')
  })

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  return cleaned
}

/**
 * Extract table of contents from law text
 * Returns array of {section, title} objects
 */
function extractTableOfContents(text, country = 'DE') {
  const toc = []

  if (!text) return toc

  // Country-specific TOC patterns
  const patterns = {
    AT: [
      // Austrian pattern: "§ 1 Geltungsbereich"
      /§\s*(\d+[a-z]?)\s+([A-ZÄÖÜ][^\n§]+?)(?=\n|$)/gm,
      // "1. Abschnitt - Title"
      /(\d+)\.\s*Abschnitt\s*[-–]?\s*([^\n]+)/gm
    ],
    DE: [
      // German pattern: "§ 1 Zielsetzung und Anwendungsbereich"
      /§\s*(\d+[a-z]?)\s+([A-ZÄÖÜ][^\n§]+?)(?=\n|$)/gm,
      // "Abschnitt I Title"
      /Abschnitt\s+([IVX]+|[1-9]\d*)\s+([^\n]+)/gm
    ],
    NL: [
      // Dutch pattern: "Artikel 1. Begripsbepalingen"
      /Artikel\s*(\d+[a-z]?)\.\s*([^\n]+)/gm,
      // "Hoofdstuk 1 Title"
      /Hoofdstuk\s*(\d+[a-z]?)\s+([^\n]+)/gm
    ]
  }

  const countryPatterns = patterns[country] || patterns.DE

  for (const pattern of countryPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const section = match[1].trim()
      const title = match[2].trim()
        .replace(/[.,:;]$/, '') // Remove trailing punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace

      // Skip if title looks like content, not a title
      if (title.length > 100 || /\d{4}/.test(title)) continue

      toc.push({ section, title })
    }
  }

  // Remove duplicates
  const seen = new Set()
  return toc.filter(item => {
    const key = `${item.section}:${item.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Get section title from centralized mappings
 */
function getSectionTitle(country, lawAbbr, sectionNum) {
  const countryMappings = SECTION_TITLES[country]
  if (!countryMappings) return null

  const lawMappings = countryMappings[lawAbbr]
  if (!lawMappings) return null

  return lawMappings[sectionNum] || null
}

/**
 * Standardize section numbering format
 */
function standardizeSectionNumber(rawNumber, country = 'DE') {
  if (!rawNumber) return ''

  let num = rawNumber.toString().trim()

  // Remove redundant prefixes
  num = num.replace(/^§\s*/i, '')
  num = num.replace(/^Artikel\s*/i, '')
  num = num.replace(/^Art\.\s*/i, '')
  num = num.replace(/^\(\s*/, '').replace(/\s*\)$/, '')

  // Normalize letter suffixes (1a, 1b)
  num = num.replace(/\s*([a-z])$/i, '$1')

  return num.trim()
}

/**
 * Format section number for display
 */
function formatSectionNumber(sectionNum, country = 'DE') {
  const num = standardizeSectionNumber(sectionNum, country)
  if (!num) return ''

  if (country === 'NL') {
    return `Artikel ${num}`
  }

  return `§ ${num}`
}

/**
 * Validate law structure after cleaning
 */
function validateLawStructure(law, country = 'DE') {
  const errors = []
  const warnings = []

  // Check required fields
  const requiredFields = config.validation?.required_fields || ['id', 'abbreviation', 'title']
  for (const field of requiredFields) {
    if (!law[field]) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // Check content
  const content = law.content?.full_text || law.full_text || ''
  const minLength = config.validation?.min_content_length || 500
  if (content.length < minLength) {
    warnings.push(`Content is very short (${content.length} chars, expected ${minLength}+)`)
  }

  // Check for section markers
  const structurePattern = config.validation?.structure_patterns?.[country] || /§\s*\d+/
  const regex = new RegExp(structurePattern)
  if (!regex.test(content)) {
    warnings.push('No section markers found in content')
  }

  // Check chapters/sections count
  const chapters = law.chapters || []
  const minSections = config.validation?.min_section_count || 3
  const sectionCount = chapters.reduce((sum, ch) => sum + (ch.sections?.length || 0), 0)
  if (sectionCount < minSections) {
    warnings.push(`Low section count: ${sectionCount} (expected ${minSections}+)`)
  }

  // Check for boilerplate contamination
  const boilerplateKeywords = ['Seitenbereiche:', 'Navigationsleiste', 'Accesskey', 'Barrierefreiheitserklärung']
  for (const keyword of boilerplateKeywords) {
    if (content.includes(keyword)) {
      warnings.push(`Possible boilerplate contamination: "${keyword}"`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      contentLength: content.length,
      chapterCount: chapters.length,
      sectionCount
    }
  }
}

/**
 * Check if source is supplementary (AUVA, DGUV, etc.)
 */
function isSupplementarySource(law) {
  if (!law) return false

  const patterns = config.supplementary_source_patterns || [
    'merkblatt', 'merkbuch', 'm.plus', 'guideline', 'handbook',
    'information', 'supplement', 'dguv vorschrift', 'dguv regel',
    'dguv information', 'trbs', 'trgs', 'asr', 'pgs'
  ]

  const type = (law.type || '').toLowerCase()
  const category = (law.category || '').toLowerCase()
  const abbr = (law.abbreviation || '').toLowerCase()

  return patterns.some(p =>
    type.includes(p) || category.includes(p) || abbr.includes(p)
  )
}

/**
 * Find content start (skip boilerplate header)
 */
function findContentStart(text, country = 'DE') {
  if (!text) return 0

  const markers = config.cleaning?.content_start_markers || [
    '§\\s*1',
    'Artikel\\s*1',
    '1\\.\\s*Abschnitt',
    'Allgemeine Bestimmungen',
    'Geltungsbereich'
  ]

  for (const markerStr of markers) {
    const marker = new RegExp(markerStr, 'im')
    const match = text.match(marker)
    if (match && match.index < text.length * 0.4) {
      return match.index
    }
  }

  return 0
}

/**
 * Clean law text - full pipeline
 */
function cleanLawText(text, country = 'DE') {
  if (!text) return ''

  // Step 1: Remove boilerplate
  let cleaned = removeBoilerplate(text, country)

  // Step 2: Skip to content start
  const startIndex = findContentStart(cleaned, country)
  if (startIndex > 0) {
    cleaned = cleaned.substring(startIndex)
  }

  // Step 3: Clean duplicate notation (Austrian)
  if (country === 'AT') {
    cleaned = cleanDuplicateNotation(cleaned)
  }

  // Step 4: Normalize whitespace
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned
}

/**
 * Generate content hash for caching
 */
function generateContentHash(content) {
  if (!content) return null

  // Simple hash for caching - not cryptographic
  let hash = 0
  const str = content.toString()
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

module.exports = {
  // Configuration
  GERMAN_ORDINALS,
  GERMAN_CARDINALS,
  BOILERPLATE_PATTERNS,
  SECTION_TITLES,

  // Core cleaning functions
  removeBoilerplate,
  convertGermanNumbers,
  cleanDuplicateNotation,
  cleanLawText,

  // TOC and structure
  extractTableOfContents,
  getSectionTitle,
  standardizeSectionNumber,
  formatSectionNumber,

  // Validation
  validateLawStructure,
  isSupplementarySource,

  // Utilities
  findContentStart,
  generateContentHash
}

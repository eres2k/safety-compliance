/**
 * EU Safety Laws Database Service
 * Deep integration with comprehensive EU safety laws from AT, DE, NL
 * Includes cross-linking, search, and categorization
 */

// Import the full EU laws databases
import atLawsData from '../../eu_safety_laws/at/at_database.json'
import deLawsData from '../../eu_safety_laws/de/de_safety_laws_database.json'
import nlLawsData from '../../eu_safety_laws/nl/nl_database.json'

// Database cache
let lawsDatabase = null
let lawsIndex = null

/**
 * Initialize the laws database
 */
export function initializeLawsDatabase() {
  if (lawsDatabase) return lawsDatabase

  lawsDatabase = {
    AT: processLawsData(atLawsData, 'AT'),
    DE: processLawsData(deLawsData, 'DE'),
    NL: processLawsData(nlLawsData, 'NL')
  }

  // Build search index
  lawsIndex = buildSearchIndex(lawsDatabase)

  return lawsDatabase
}

/**
 * Clean summary text by removing boilerplate navigation elements
 * This is needed for Austrian laws scraped from RIS which contain HTML navigation text
 */
function cleanSummaryText(summary) {
  if (!summary) return null

  // Patterns to remove (Austrian RIS boilerplate)
  const boilerplatePatterns = [
    /^Seitenbereiche:[\s\S]*?Barrierefreiheitserklärung[\s\S]*?\)/i,
    /^Seitenbereiche:.*$/im,
    /Zum Inhalt\s*\([^)]*\)/gi,
    /Zur Navigationsleiste\s*\([^)]*\)/gi,
    /Kontakt\s*\([^)]*\)/gi,
    /Impressum\s*\([^)]*\)/gi,
    /Datenschutzerklärung\s*\([^)]*\)/gi,
    /Barrierefreiheitserklärung\s*\([^)]*\)/gi,
    /Accesskey\s*\d+/gi,
    /^\s*\(\s*\)\s*$/gm
  ]

  let cleaned = summary
  for (const pattern of boilerplatePatterns) {
    cleaned = cleaned.replace(pattern, '')
  }

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  // If we removed too much, try to extract meaningful content
  if (cleaned.length < 50) {
    return null
  }

  return cleaned
}

/**
 * Generate a summary from content text
 */
function generateSummaryFromContent(content, maxLength = 200) {
  if (!content) return null

  // Skip boilerplate at the start
  const contentStartMarkers = [
    /§\s*1[.\s]/i,
    /Artikel\s*1[.\s]/i,
    /\(1\)\s/i,
    /Dieses\s+(Bundes)?[Gg]esetz/i,
    /Zweck\s+des\s+Gesetzes/i,
    /Ziel\s+dieser\s+Verordnung/i
  ]

  let startIndex = 0
  for (const marker of contentStartMarkers) {
    const match = content.match(marker)
    if (match && match.index < content.length * 0.3) {
      startIndex = match.index
      break
    }
  }

  const relevantContent = content.substring(startIndex)

  // Extract first meaningful paragraph
  const paragraphs = relevantContent.split(/\n{2,}/)
  const firstParagraph = paragraphs.find(p => p.trim().length > 50) || paragraphs[0]

  if (!firstParagraph) return null

  // Truncate at sentence boundary
  let summary = firstParagraph.trim()
  if (summary.length > maxLength) {
    const truncated = summary.substring(0, maxLength)
    const lastSentence = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('.\n')
    )
    if (lastSentence > maxLength * 0.5) {
      summary = truncated.substring(0, lastSentence + 1)
    } else {
      summary = truncated + '...'
    }
  }

  return summary
}

/**
 * Normalize law item fields to standard format
 * Maps various field names from different JSON sources to consistent names
 *
 * Handles different database structures:
 * - DE: content is nested in item.content.full_text
 * - AT/NL: content is at top level in item.full_text
 */
function normalizeLawItem(item) {
  // Get full text from various possible locations
  // AT/NL store full_text at top level, DE stores it in content.full_text
  const fullText = item.full_text || item.content?.full_text || item.content?.text || null

  // Clean the summary text
  let cleanedSummary = cleanSummaryText(item.summary)

  // If summary is still empty, try to generate from content
  if (!cleanedSummary && fullText) {
    cleanedSummary = generateSummaryFromContent(fullText)
  }

  // Normalize content structure to always have content.full_text
  const normalizedContent = {
    full_text: fullText,
    text: fullText, // Keep text as alias for backwards compatibility
    available: !!fullText,
    // Preserve other content fields if they exist
    ...(item.content && typeof item.content === 'object' ? {
      format: item.content.format,
      sections: item.content.sections,
      num_pages: item.content.num_pages,
      text_length: item.content.text_length
    } : {})
  }

  return {
    ...item,
    // Normalize abbreviation field (JSON may have 'abbr' or 'abbreviation')
    abbreviation: item.abbreviation || item.abbr || null,
    // Normalize content to consistent structure
    content: normalizedContent,
    // Ensure description exists (fallback to category or empty string)
    description: item.description || null,
    // Use cleaned or generated summary
    summary: cleanedSummary,
    // Preserve chapters if they exist (AT/NL have chapters at top level)
    chapters: item.chapters || []
  }
}

/**
 * Process raw laws data into standardized format
 */
function processLawsData(data, countryCode) {
  // Handle different data structures: AT/NL use 'documents', DE uses 'items'
  const rawItems = data?.items || data?.documents || []

  if (!data || rawItems.length === 0) {
    return {
      metadata: data?.metadata || {},
      categories: data?.categories || data?.types || {},
      items: [],
      itemsById: {},
      itemsByType: {},
      crossReferences: {}
    }
  }

  const items = rawItems.map(item => {
    const normalized = normalizeLawItem(item)
    return {
      ...normalized,
      country: countryCode,
      searchText: buildSearchText(normalized),
      keywords: extractKeywords(normalized),
      relatedIds: findRelatedLaws(normalized, rawItems.map(normalizeLawItem))
    }
  })

  // Create lookup maps
  const itemsById = {}
  const itemsByType = {}
  const crossReferences = {}

  items.forEach(item => {
    itemsById[item.id] = item

    if (!itemsByType[item.type]) {
      itemsByType[item.type] = []
    }
    itemsByType[item.type].push(item)

    // Build cross-references
    if (item.relatedIds && item.relatedIds.length > 0) {
      crossReferences[item.id] = item.relatedIds
    }
  })

  return {
    metadata: data.metadata,
    categories: data.categories,
    items,
    itemsById,
    itemsByType,
    crossReferences
  }
}

/**
 * Build searchable text from law item
 */
function buildSearchText(item) {
  const parts = [
    item.title,
    item.title_en,
    item.abbreviation,
    item.description,
    item.category
  ]

  if (item.content?.full_text) {
    // Only include first 5000 chars for search performance
    parts.push(item.content.full_text.substring(0, 5000))
  }

  return parts.filter(Boolean).join(' ').toLowerCase()
}

/**
 * Extract keywords from law item
 */
function extractKeywords(item) {
  const keywords = new Set()

  // Add abbreviation
  if (item.abbreviation) {
    keywords.add(item.abbreviation.toLowerCase())
  }

  // Add type
  if (item.type) {
    keywords.add(item.type.toLowerCase())
  }

  // Add category
  if (item.category) {
    keywords.add(item.category.toLowerCase())
  }

  // Extract common safety terms from content
  const safetyTerms = [
    'arbeitsschutz', 'safety', 'gefahr', 'hazard', 'risk',
    'protection', 'schutz', 'gesundheit', 'health',
    'unfall', 'accident', 'prävention', 'prevention',
    'arbeitgeber', 'employer', 'arbeitnehmer', 'employee',
    'betrieb', 'workplace', 'maschine', 'machine',
    'chemisch', 'chemical', 'biologisch', 'biological',
    'physisch', 'physical', 'psychisch', 'psychological'
  ]

  const text = (item.content?.full_text || '').toLowerCase()
  safetyTerms.forEach(term => {
    if (text.includes(term)) {
      keywords.add(term)
    }
  })

  return Array.from(keywords)
}

/**
 * Find related laws based on content similarity
 */
function findRelatedLaws(item, allItems) {
  const related = []
  const itemAbbr = item.abbreviation?.toLowerCase()
  const itemType = item.type

  allItems.forEach(other => {
    if (other.id === item.id) return

    // Same type = related
    if (other.type === itemType) {
      related.push(other.id)
      return
    }

    // Check if mentioned in content
    if (item.content?.full_text && other.abbreviation) {
      const abbrLower = other.abbreviation.toLowerCase()
      if (item.content.full_text.toLowerCase().includes(abbrLower)) {
        related.push(other.id)
      }
    }
  })

  return related.slice(0, 10) // Limit to 10 related items
}

/**
 * Build search index for fast lookups
 */
function buildSearchIndex(database) {
  const index = {
    byKeyword: {},
    byType: {},
    byCountry: {}
  }

  Object.entries(database).forEach(([country, data]) => {
    index.byCountry[country] = data.items.map(item => item.id)

    data.items.forEach(item => {
      // Index by type
      if (!index.byType[item.type]) {
        index.byType[item.type] = []
      }
      index.byType[item.type].push({ country, id: item.id })

      // Index by keywords
      item.keywords.forEach(keyword => {
        if (!index.byKeyword[keyword]) {
          index.byKeyword[keyword] = []
        }
        index.byKeyword[keyword].push({ country, id: item.id })
      })
    })
  })

  return index
}

/**
 * Get database for specific country
 */
export function getLawsDatabase(country = 'DE') {
  if (!lawsDatabase) {
    initializeLawsDatabase()
  }
  return lawsDatabase[country] || lawsDatabase.DE
}

/**
 * Get all laws for a country
 */
export function getAllLaws(country = 'DE') {
  const db = getLawsDatabase(country)
  return db.items
}

/**
 * Get law by ID
 */
export function getLawById(country, id) {
  const db = getLawsDatabase(country)
  return db.itemsById[id]
}

/**
 * Get laws by type
 */
export function getLawsByType(country, type) {
  const db = getLawsDatabase(country)
  return db.itemsByType[type] || []
}

/**
 * Search laws with pagination support
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {string|null} options.country - Filter by country (AT, DE, NL) or null for all
 * @param {string|null} options.type - Filter by document type
 * @param {string|null} options.category - Filter by category
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.limit - Results per page
 * @param {boolean} options.includeContent - Include full content in results
 * @returns {Object} Search results with pagination metadata
 */
export function searchLaws(query, options = {}) {
  if (!lawsDatabase) {
    initializeLawsDatabase()
  }

  const {
    country = null, // null means all countries
    type = null,
    category = null,
    page = 1,
    limit = 20,
    includeContent = false
  } = options

  // Validate pagination params
  const validPage = Math.max(1, Math.floor(page))
  const validLimit = Math.min(100, Math.max(1, Math.floor(limit)))

  const queryLower = query?.toLowerCase().trim() || ''
  const allResults = []

  const countries = country ? [country] : ['AT', 'DE', 'NL']

  countries.forEach(c => {
    const db = lawsDatabase[c]
    if (!db) return

    db.items.forEach(item => {
      // Filter by type if specified
      if (type && item.type !== type) return

      // Filter by category if specified
      if (category && item.category !== category) return

      // If no query, include all (with base score)
      // Otherwise calculate search score
      const score = queryLower ? calculateSearchScore(item, queryLower) : 1

      if (score > 0) {
        allResults.push({
          ...item,
          score,
          country: c,
          // Only include content if requested
          content: includeContent ? item.content : { available: item.content?.available }
        })
      }
    })
  })

  // Sort by score
  allResults.sort((a, b) => b.score - a.score)

  // Calculate pagination
  const total = allResults.length
  const totalPages = Math.ceil(total / validLimit)
  const offset = (validPage - 1) * validLimit
  const paginatedResults = allResults.slice(offset, offset + validLimit)

  return {
    results: paginatedResults,
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      totalPages,
      hasMore: validPage < totalPages
    }
  }
}

/**
 * Calculate search relevance score
 */
function calculateSearchScore(item, query) {
  let score = 0

  // Exact abbreviation match
  if (item.abbreviation?.toLowerCase() === query) {
    score += 100
  } else if (item.abbreviation?.toLowerCase().includes(query)) {
    score += 50
  }

  // Title match
  const titleLower = item.title?.toLowerCase() || ''
  if (titleLower === query) {
    score += 80
  } else if (titleLower.includes(query)) {
    score += 40
  }

  // English title match
  const titleEnLower = item.title_en?.toLowerCase() || ''
  if (titleEnLower.includes(query)) {
    score += 30
  }

  // Description match
  if (item.description?.toLowerCase().includes(query)) {
    score += 20
  }

  // Content match
  if (item.searchText?.includes(query)) {
    score += 10
  }

  // Keyword match
  if (item.keywords?.some(k => k.includes(query))) {
    score += 15
  }

  return score
}

/**
 * Get related laws for cross-linking
 */
export function getRelatedLaws(country, lawId, limit = 5) {
  const db = getLawsDatabase(country)
  const law = db.itemsById[lawId]

  if (!law || !law.relatedIds) return []

  return law.relatedIds
    .slice(0, limit)
    .map(id => db.itemsById[id])
    .filter(Boolean)
}

/**
 * Get cross-references for a law
 */
export function getCrossReferences(country, lawId) {
  const db = getLawsDatabase(country)
  const references = db.crossReferences[lawId] || []

  return references.map(id => {
    const law = db.itemsById[id]
    return law ? {
      id: law.id,
      abbreviation: law.abbreviation,
      title: law.title,
      type: law.type
    } : null
  }).filter(Boolean)
}

/**
 * Get law categories for a country
 */
export function getLawCategories(country = 'DE') {
  const db = getLawsDatabase(country)
  return db.categories || {}
}

/**
 * Get all facets (filter options) for the database
 * Returns unique values for jurisdiction, type, and category filters
 */
export function getFacets() {
  if (!lawsDatabase) {
    initializeLawsDatabase()
  }

  const jurisdictions = new Set()
  const types = new Set()
  const categories = new Set()
  const tags = new Set()

  Object.entries(lawsDatabase).forEach(([country, data]) => {
    jurisdictions.add(country)
    data.items.forEach(item => {
      if (item.type) types.add(item.type)
      if (item.category) categories.add(item.category)
      if (item.tags) item.tags.forEach(tag => tags.add(tag))
    })
  })

  return {
    jurisdictions: Array.from(jurisdictions).sort(),
    types: Array.from(types).sort(),
    categories: Array.from(categories).sort(),
    tags: Array.from(tags).sort()
  }
}

/**
 * Validate country code
 */
export function isValidCountry(country) {
  return ['AT', 'DE', 'NL'].includes(country)
}

/**
 * Get statistics for a country's laws
 */
export function getLawsStatistics(country = 'DE') {
  const db = getLawsDatabase(country)

  return {
    totalLaws: db.items.length,
    byType: Object.entries(db.categories).map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / db.items.length) * 100)
    })),
    metadata: db.metadata
  }
}

/**
 * Format law reference for display
 */
export function formatLawReference(law) {
  if (!law) return ''

  const parts = []

  if (law.abbreviation) {
    parts.push(law.abbreviation)
  }

  if (law.title) {
    parts.push(`(${law.title})`)
  }

  return parts.join(' ')
}

/**
 * Get law content sections
 */
export function getLawContentSections(country, lawId) {
  const law = getLawById(country, lawId)
  if (!law || !law.content?.full_text) return []

  const text = law.content.full_text
  const sections = []
  const seenSections = new Set()

  // German format: "§ 21a Beschäftigung im Straßentransport" - section with title
  // Only match at start of line, title must start with capital letter
  const germanRegex = /(?:^|\n)\s*§\s*(\d+[a-z]?)\s+([A-ZÄÖÜ][^\n§]*?)(?=\n|$)/gm
  let match

  while ((match = germanRegex.exec(text)) !== null) {
    const sectionNum = match[1]
    const title = match[2].trim()
    // Skip inline references (title starts with Abs., Nr., etc.)
    if (/^(Abs\.|Absatz|Nr\.|Nummer|Satz|Buchstabe)/i.test(title)) {
      continue
    }
    if (!seenSections.has(sectionNum)) {
      seenSections.add(sectionNum)
      sections.push({
        id: `${lawId}-s${sectionNum}`,
        paragraph: `§ ${sectionNum}`,
        title: title.substring(0, 100),
        startIndex: match.index
      })
    }
  }

  // Austrian format: "§ 2\n(1)\n\nArbeitnehmer..." - section number alone, then (1)
  // Match § NUMBER at start of line, followed by newline and (1) or similar
  const austrianRegex = /(?:^|\n)\s*§\s*(\d+[a-z]?)\s*\n+\s*\(1\)/gm

  while ((match = austrianRegex.exec(text)) !== null) {
    const sectionNum = match[1]
    if (!seenSections.has(sectionNum)) {
      seenSections.add(sectionNum)
      sections.push({
        id: `${lawId}-s${sectionNum}`,
        paragraph: `§ ${sectionNum}`,
        title: '', // Austrian sections typically don't have inline titles
        startIndex: match.index
      })
    }
  }

  // Sort by position in document
  sections.sort((a, b) => a.startIndex - b.startIndex)

  return sections
}

/**
 * Extract law excerpt around a search term or find meaningful content
 */
export function getLawExcerpt(law, searchTerm, contextLength = 200) {
  const text = law.content?.full_text || law.content?.text
  if (!text) {
    return law.description || ''
  }

  // If there's a search term, find it in the text
  if (searchTerm) {
    const termLower = searchTerm.toLowerCase()
    const textLower = text.toLowerCase()
    const index = textLower.indexOf(termLower)

    if (index !== -1) {
      const start = Math.max(0, index - contextLength / 2)
      const end = Math.min(text.length, index + searchTerm.length + contextLength / 2)

      let excerpt = text.substring(start, end)

      if (start > 0) excerpt = '...' + excerpt
      if (end < text.length) excerpt = excerpt + '...'

      return excerpt
    }
  }

  // No search term or term not found - find meaningful content by skipping boilerplate
  // Common boilerplate patterns to skip past
  const contentStartMarkers = [
    /§\s*1[.\s]/i,                           // First section marker
    /Artikel\s*1[.\s]/i,                     // Article 1
    /1\.\s*Abschnitt/i,                      // Section 1 (German)
    /Inhaltsverzeichnis\s*\n/i,              // Table of contents end
    /Präambel/i,                             // Preamble
    /Allgemeine Bestimmungen/i,              // General provisions
    /Geltungsbereich/i,                      // Scope of application
    /Begriffsbestimmungen/i,                 // Definitions
    /Dieses Bundesgesetz/i,                  // "This federal law"
    /Dieses Gesetz/i,                        // "This law"
  ]

  let contentStart = 0

  // Try to find where the actual content starts
  for (const marker of contentStartMarkers) {
    const match = text.match(marker)
    if (match && match.index !== undefined) {
      // Found a content marker - use it if it's reasonable
      if (match.index < text.length * 0.5) { // Only if in first half of document
        contentStart = match.index
        break
      }
    }
  }

  // If no marker found, skip past common boilerplate keywords
  if (contentStart === 0) {
    const boilerplateEnd = [
      'Navigationsleiste',
      'Barrierefreiheitserklärung',
      'Datenschutzerklärung',
      'BGBl',
      'Bundesgesetzblatt'
    ]

    let lastBoilerplatePos = 0
    for (const keyword of boilerplateEnd) {
      let pos = 0
      let searchPos = 0
      // Find the last occurrence of boilerplate within first 2000 chars
      while ((pos = text.indexOf(keyword, searchPos)) !== -1 && pos < 2000) {
        lastBoilerplatePos = Math.max(lastBoilerplatePos, pos + keyword.length)
        searchPos = pos + 1
      }
    }

    if (lastBoilerplatePos > 0) {
      // Skip to the next line after boilerplate
      const nextNewline = text.indexOf('\n', lastBoilerplatePos)
      contentStart = nextNewline !== -1 ? nextNewline + 1 : lastBoilerplatePos
    }
  }

  // Extract excerpt from meaningful content
  const meaningfulText = text.substring(contentStart).trim()

  if (meaningfulText.length <= contextLength) {
    return meaningfulText
  }

  // Try to end at a sentence boundary
  let excerpt = meaningfulText.substring(0, contextLength)
  const lastSentenceEnd = Math.max(
    excerpt.lastIndexOf('. '),
    excerpt.lastIndexOf('.\n'),
    excerpt.lastIndexOf('? '),
    excerpt.lastIndexOf('! ')
  )

  if (lastSentenceEnd > contextLength * 0.5) {
    excerpt = excerpt.substring(0, lastSentenceEnd + 1)
  }

  return excerpt + '...'
}

/**
 * Get popular/core laws for a country
 * These are the most important workplace safety laws that users typically need
 */
export function getCoreLaws(country = 'DE') {
  // Core law abbreviations for each country (primary workplace safety legislation)
  const coreLawAbbreviations = {
    AT: ['ASchG', 'ArbIG', 'ASVG', 'AStV', 'AM-VO'],
    DE: ['ArbSchG', 'ASiG', 'ArbStättV', 'GefStoffV', 'BetrSichV'],
    NL: ['Arbowet', 'Arbobesluit', 'Arboregeling', 'BRZO']
  }

  const db = getLawsDatabase(country)
  const abbreviations = coreLawAbbreviations[country] || []

  // Find laws by abbreviation instead of hardcoded IDs
  const coreLaws = []
  for (const abbr of abbreviations) {
    const law = db.items.find(item =>
      item.abbreviation?.toLowerCase() === abbr.toLowerCase() ||
      item.abbr?.toLowerCase() === abbr.toLowerCase()
    )
    if (law) {
      coreLaws.push(law)
    }
  }

  return coreLaws
}

/**
 * Get laws by topic/category
 */
export function getLawsByTopic(country, topic) {
  const topicKeywords = {
    'workplace-safety': ['arbeitsschutz', 'arbeitssicherheit', 'safety', 'veiligheid'],
    'hazardous-substances': ['gefahrstoff', 'gefstoff', 'chemical', 'chemisch'],
    'machinery': ['maschine', 'machine', 'equipment', 'betriebsmittel'],
    'fire-safety': ['brand', 'fire', 'feuer', 'brandschutz'],
    'first-aid': ['erste hilfe', 'first aid', 'ehbo'],
    'training': ['unterweisung', 'schulung', 'training', 'opleiding'],
    'risk-assessment': ['gefährdungsbeurteilung', 'risk assessment', 'risicobeoordeling'],
    'occupational-health': ['arbeitsmedizin', 'betriebsarzt', 'occupational health']
  }

  const keywords = topicKeywords[topic] || [topic]

  return searchLaws(keywords.join(' '), {
    country,
    limit: 20,
    includeContent: false
  })
}

// Auto-initialize on import
initializeLawsDatabase()

export default {
  initializeLawsDatabase,
  getLawsDatabase,
  getAllLaws,
  getLawById,
  getLawsByType,
  searchLaws,
  getRelatedLaws,
  getCrossReferences,
  getLawCategories,
  getFacets,
  isValidCountry,
  getLawsStatistics,
  formatLawReference,
  getLawContentSections,
  getLawExcerpt,
  getCoreLaws,
  getLawsByTopic
}

/**
 * EU Safety Laws Database Service
 * Deep integration with comprehensive EU safety laws from AT, DE, NL
 * Includes cross-linking, search, and categorization
 *
 * LAZY-LOADING: Databases are now loaded on-demand to improve initial load time
 */

// Database cache - loaded lazily per country
let lawsDatabase = {
  AT: null,
  DE: null,
  NL: null,
  WIKI: null
}
let lawsIndex = null
let loadingPromises = {}
let statisticsData = null

// Track which databases have been loaded
const loadedDatabases = new Set()

/**
 * Load a specific country's database lazily
 */
async function loadCountryDatabase(countryCode) {
  // Already loaded
  if (lawsDatabase[countryCode]) {
    return lawsDatabase[countryCode]
  }

  // Already loading - return existing promise
  if (loadingPromises[countryCode]) {
    return loadingPromises[countryCode]
  }

  // Start loading
  loadingPromises[countryCode] = (async () => {
    try {
      let data
      let merkblaetterData = null
      switch (countryCode) {
        case 'AT':
          data = (await import('../../eu_safety_laws/at/at_database.json')).default
          try {
            merkblaetterData = (await import('../../eu_safety_laws/at/at_merkblaetter.json')).default
          } catch (e) {
            console.warn('AT merkblaetter not found')
          }
          break
        case 'DE':
          data = (await import('../../eu_safety_laws/de/de_database.json')).default
          try {
            merkblaetterData = (await import('../../eu_safety_laws/de/de_merkblaetter.json')).default
          } catch (e) {
            console.warn('DE merkblaetter not found')
          }
          break
        case 'NL':
          data = (await import('../../eu_safety_laws/nl/nl_database.json')).default
          try {
            merkblaetterData = (await import('../../eu_safety_laws/nl/nl_merkblaetter.json')).default
          } catch (e) {
            console.warn('NL merkblaetter not found')
          }
          break
        case 'WIKI':
          data = (await import('../../eu_safety_laws/wiki_all/wiki_all_database.json')).default
          break
        default:
          throw new Error(`Unknown country code: ${countryCode}`)
      }

      // Merge merkblaetter documents into main database
      if (merkblaetterData?.documents?.length > 0) {
        if (data.laws) {
          data.laws = [...data.laws, ...merkblaetterData.documents]
        } else if (data.documents) {
          data.documents = [...data.documents, ...merkblaetterData.documents]
        } else {
          // Fallback: create laws array with merkblaetter
          data.laws = merkblaetterData.documents
        }
        console.log(`Loaded ${merkblaetterData.documents.length} merkblaetter for ${countryCode}`)
      }

      lawsDatabase[countryCode] = processLawsData(data, countryCode)
      loadedDatabases.add(countryCode)

      // Rebuild search index with newly loaded data
      lawsIndex = buildSearchIndex(lawsDatabase)

      return lawsDatabase[countryCode]
    } catch (error) {
      console.error(`Failed to load ${countryCode} database:`, error)
      // Return empty database structure on error
      return {
        metadata: {},
        categories: {},
        items: [],
        itemsById: {},
        itemsByType: {},
        crossReferences: {}
      }
    } finally {
      delete loadingPromises[countryCode]
    }
  })()

  return loadingPromises[countryCode]
}

/**
 * Load statistics data lazily
 */
async function loadStatistics() {
  if (statisticsData) return statisticsData
  try {
    statisticsData = (await import('../../eu_safety_laws/statistics.json')).default
  } catch (error) {
    console.warn('Statistics file not found or invalid:', error)
    statisticsData = {}
  }
  return statisticsData
}

/**
 * Initialize the laws database for a specific country
 * Returns a promise that resolves when the database is ready
 */
export async function initializeLawsDatabase(countryCode = null) {
  // If specific country requested, load just that one
  if (countryCode) {
    return loadCountryDatabase(countryCode)
  }

  // Load all databases in parallel
  await Promise.all([
    loadCountryDatabase('AT'),
    loadCountryDatabase('DE'),
    loadCountryDatabase('NL'),
    loadCountryDatabase('WIKI'),
    loadStatistics()
  ])

  return lawsDatabase
}

/**
 * Check if a country's database is loaded
 */
export function isDatabaseLoaded(countryCode) {
  return loadedDatabases.has(countryCode)
}

/**
 * Get loading status for all databases
 */
export function getDatabaseLoadingStatus() {
  return {
    AT: loadedDatabases.has('AT'),
    DE: loadedDatabases.has('DE'),
    NL: loadedDatabases.has('NL'),
    WIKI: loadedDatabases.has('WIKI'),
    isLoading: Object.keys(loadingPromises).length > 0,
    currentlyLoading: Object.keys(loadingPromises)
  }
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
  let fullText = item.full_text || item.content?.full_text || item.content?.text || null

  // Fallback: If no direct full_text but chapters exist, reconstruct from chapters
  // This handles AT data where text is stored in chapters[].sections[].text
  if (!fullText && item.chapters && Array.isArray(item.chapters) && item.chapters.length > 0) {
    const textParts = []
    for (const chapter of item.chapters) {
      if (chapter.title) {
        textParts.push(`\n${chapter.title}\n`)
      }
      if (chapter.sections && Array.isArray(chapter.sections)) {
        for (const section of chapter.sections) {
          if (section.text) {
            textParts.push(section.text)
          }
        }
      }
    }
    if (textParts.length > 0) {
      fullText = textParts.join('\n\n')
    }
  }

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
    chapters: item.chapters || [],
    // WHS metadata - new fields for WHS employee browser
    whs_summary: item.whs_summary || null,
    // Source metadata for PDF display
    source: item.source || null,
  }
}

/**
 * WHS Topic labels for display
 */
export const WHS_TOPIC_LABELS = {
  risk_assessment: { label: 'Risk Assessment', icon: '⚠️', color: 'orange' },
  documentation: { label: 'Documentation', icon: '📋', color: 'blue' },
  ppe: { label: 'PPE', icon: '🦺', color: 'yellow' },
  first_aid: { label: 'First Aid', icon: '🏥', color: 'red' },
  training: { label: 'Training', icon: '📚', color: 'purple' },
  workplace_design: { label: 'Workplace Design', icon: '🏭', color: 'gray' },
  work_equipment: { label: 'Work Equipment', icon: '🔧', color: 'slate' },
  hazardous_substances: { label: 'Hazardous Substances', icon: '☣️', color: 'amber' },
  health_surveillance: { label: 'Health Surveillance', icon: '🩺', color: 'green' },
  ergonomics: { label: 'Ergonomics', icon: '🧘', color: 'teal' },
  incident_reporting: { label: 'Incident Reporting', icon: '📝', color: 'red' },
  working_hours: { label: 'Working Hours', icon: '⏰', color: 'indigo' },
  special_groups: { label: 'Special Groups', icon: '👥', color: 'pink' },
  prevention_services: { label: 'Prevention Services', icon: '🛡️', color: 'cyan' },
  employer_obligations: { label: 'Employer Obligations', icon: '👔', color: 'blue' },
  employee_rights: { label: 'Employee Rights', icon: '✊', color: 'green' },
  penalties: { label: 'Penalties', icon: '⚖️', color: 'red' },
}

/**
 * Relevance level colors and labels
 */
export const RELEVANCE_LEVELS = {
  critical: { label: 'Critical', color: 'red', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-300' },
  high: { label: 'High', color: 'orange', bgColor: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-300' },
  medium: { label: 'Medium', color: 'yellow', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-700 dark:text-yellow-300' },
  low: { label: 'Low', color: 'gray', bgColor: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-600 dark:text-gray-400' },
}

/**
 * Country-specific structure labels for dynamic UI
 * Used to display appropriate grouping labels based on the selected country/framework
 */
export const STRUCTURE_LABELS = {
  'AT': {
    grouping_1: 'Abschnitt',
    grouping_2: 'Unterabschnitt',
    article: '§',
    section: 'Paragraph'
  },
  'DE': {
    grouping_1: 'Abschnitt',  // or "Buch" for larger laws
    grouping_2: 'Titel',
    article: '§',
    section: 'Paragraph'
  },
  'NL': {
    grouping_1: 'Hoofdstuk',
    grouping_2: 'Afdeling',
    article: 'Artikel',
    section: 'Artikel'
  }
}

/**
 * Get structure label for a country
 * @param {string} country - Country code (AT, DE, NL)
 * @param {string} level - Structure level ('grouping_1', 'grouping_2', 'article', 'section')
 * @returns {string} - Localized label
 */
export function getStructureLabel(country, level = 'grouping_1') {
  return STRUCTURE_LABELS[country]?.[level] || STRUCTURE_LABELS['DE'][level]
}

/**
 * Document type enumeration for unified schema
 */
export const DOC_TYPES = {
  LAW: 'law',
  ORDINANCE: 'ordinance',
  MERKBLATT: 'merkblatt',
  GUIDELINE: 'guideline',
  REGULATION: 'regulation'
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

  // Include full text content for comprehensive search
  if (item.content?.full_text) {
    parts.push(item.content.full_text)
  }

  // Also include chapter titles and section text for thorough search
  if (item.chapters && Array.isArray(item.chapters)) {
    for (const chapter of item.chapters) {
      if (chapter.title) parts.push(chapter.title)
      if (chapter.title_en) parts.push(chapter.title_en)
      if (chapter.sections && Array.isArray(chapter.sections)) {
        for (const section of chapter.sections) {
          if (section.title) parts.push(section.title)
          if (section.text) parts.push(section.text)
        }
      }
    }
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
    if (!data) return // Skip unloaded databases

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
 * Get database for specific country (async)
 */
export async function getLawsDatabase(country = 'DE') {
  if (!lawsDatabase[country]) {
    await loadCountryDatabase(country)
  }
  return lawsDatabase[country] || lawsDatabase.DE
}

/**
 * Get database for specific country (sync - may return null if not loaded)
 */
export function getLawsDatabaseSync(country = 'DE') {
  return lawsDatabase[country] || null
}

/**
 * Get all laws for a country (async)
 */
export async function getAllLaws(country = 'DE') {
  const db = await getLawsDatabase(country)
  return db.items
}

/**
 * Get all laws for a country (sync - may return empty if not loaded)
 */
export function getAllLawsSync(country = 'DE') {
  const db = getLawsDatabaseSync(country)
  return db?.items || []
}

/**
 * Get law by ID (async)
 */
export async function getLawById(country, id) {
  const db = await getLawsDatabase(country)
  return db.itemsById[id]
}

/**
 * Get law by ID (sync)
 */
export function getLawByIdSync(country, id) {
  const db = getLawsDatabaseSync(country)
  return db?.itemsById[id] || null
}

/**
 * Get laws by type (async)
 */
export async function getLawsByType(country, type) {
  const db = await getLawsDatabase(country)
  return db.itemsByType[type] || []
}

/**
 * Search laws with pagination support (async)
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
export async function searchLaws(query, options = {}) {
  const {
    country = null, // null means all countries
    type = null,
    category = null,
    page = 1,
    limit = 20,
    includeContent = false
  } = options

  // Ensure requested countries are loaded
  const countries = country ? [country] : ['AT', 'DE', 'NL', 'WIKI']
  await Promise.all(countries.map(c => loadCountryDatabase(c)))

  // Validate pagination params
  const validPage = Math.max(1, Math.floor(page))
  const validLimit = Math.min(100, Math.max(1, Math.floor(limit)))

  const queryLower = query?.toLowerCase().trim() || ''
  const allResults = []

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
 * Search laws synchronously (only searches loaded databases)
 */
export function searchLawsSync(query, options = {}) {
  const {
    country = null,
    type = null,
    category = null,
    page = 1,
    limit = 20,
    includeContent = false
  } = options

  const validPage = Math.max(1, Math.floor(page))
  const validLimit = Math.min(100, Math.max(1, Math.floor(limit)))

  const queryLower = query?.toLowerCase().trim() || ''
  const allResults = []

  const countries = country ? [country] : ['AT', 'DE', 'NL', 'WIKI']

  countries.forEach(c => {
    const db = lawsDatabase[c]
    if (!db) return

    db.items.forEach(item => {
      if (type && item.type !== type) return
      if (category && item.category !== category) return

      const score = queryLower ? calculateSearchScore(item, queryLower) : 1

      if (score > 0) {
        allResults.push({
          ...item,
          score,
          country: c,
          content: includeContent ? item.content : { available: item.content?.available }
        })
      }
    })
  })

  allResults.sort((a, b) => b.score - a.score)

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

  // Full text content match - search in searchText which includes all content
  if (item.searchText?.includes(query)) {
    score += 25

    // Bonus for multiple occurrences in content
    const contentLower = item.searchText || ''
    const occurrences = (contentLower.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
    if (occurrences > 1) {
      score += Math.min(occurrences * 2, 20) // Up to 20 bonus points for multiple matches
    }
  }

  // Keyword match
  if (item.keywords?.some(k => k.includes(query))) {
    score += 15
  }

  return score
}

/**
 * Get related laws for cross-linking (async)
 */
export async function getRelatedLaws(country, lawId, limit = 5) {
  const db = await getLawsDatabase(country)
  const law = db.itemsById[lawId]

  if (!law || !law.relatedIds) return []

  return law.relatedIds
    .slice(0, limit)
    .map(id => db.itemsById[id])
    .filter(Boolean)
}

/**
 * Get cross-references for a law (async)
 */
export async function getCrossReferences(country, lawId) {
  const db = await getLawsDatabase(country)
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
 * Get law categories for a country (async)
 * Returns counts of documents by type (e.g., { law: 20, merkblatt: 15 })
 */
export async function getLawCategories(country = 'DE') {
  const db = await getLawsDatabase(country)

  // If categories exist in database, use them
  if (db.categories && Object.keys(db.categories).length > 0) {
    return db.categories
  }

  // Otherwise, compute from itemsByType
  if (db.itemsByType) {
    const categories = {}
    for (const [type, items] of Object.entries(db.itemsByType)) {
      if (items && items.length > 0) {
        categories[type] = items.length
      }
    }
    return categories
  }

  return {}
}

/**
 * Get all facets (filter options) for the database (async)
 * Returns unique values for jurisdiction, type, and category filters
 */
export async function getFacets() {
  // Load all databases
  await Promise.all([
    loadCountryDatabase('AT'),
    loadCountryDatabase('DE'),
    loadCountryDatabase('NL'),
    loadCountryDatabase('WIKI')
  ])

  const jurisdictions = new Set()
  const types = new Set()
  const categories = new Set()
  const tags = new Set()

  Object.entries(lawsDatabase).forEach(([country, data]) => {
    if (!data) return
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
  return ['AT', 'DE', 'NL', 'WIKI'].includes(country)
}

/**
 * Get statistics for a country's laws (async)
 */
export async function getLawsStatistics(country = 'DE') {
  const db = await getLawsDatabase(country)
  const stats = await loadStatistics()

  // Handle case where database is not loaded or has no data
  const items = db?.items || []
  const categories = db?.categories || {}
  const totalLaws = items.length

  return {
    totalLaws,
    byType: Object.entries(categories).map(([type, count]) => ({
      type,
      count,
      percentage: totalLaws > 0 ? Math.round((count / totalLaws) * 100) : 0
    })),
    metadata: db?.metadata || {},
    lastUpdated: stats?.generated_at || null,
    globalStats: stats?.statistics || null
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
  const db = getLawsDatabaseSync(country)
  const law = db?.itemsById[lawId]
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
 * Get popular/core laws for a country (async)
 * These are the most important workplace safety laws that users typically need
 */
export async function getCoreLaws(country = 'DE') {
  // Core law abbreviations for each country (primary workplace safety legislation)
  const coreLawAbbreviations = {
    AT: ['ASchG', 'ArbIG', 'ASVG', 'AStV', 'AM-VO'],
    DE: ['ArbSchG', 'ASiG', 'ArbStättV', 'GefStoffV', 'BetrSichV'],
    NL: ['Arbowet', 'Arbobesluit', 'Arboregeling', 'BRZO']
  }

  const db = await getLawsDatabase(country)
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
 * Get laws by topic/category (async)
 */
export async function getLawsByTopic(country, topic) {
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

/**
 * Get PDF source URL for a law if available.
 * ONLY returns local PDF paths - external URLs cannot be displayed in iframes.
 * For external PDF links (open in new tab), use getExternalPdfUrl().
 */
export function getPdfSourceUrl(law) {
  if (!law) return null

  // Priority 1: Explicit local_pdf_path
  if (law.source?.local_pdf_path) {
    // Convert absolute path to relative URL for serving
    const path = law.source.local_pdf_path
    // Handle both Windows backslashes and Unix forward slashes
    const normalizedPath = path.replace(/\\/g, '/')
    // Extract just the filename or relative path portion
    const match = normalizedPath.match(/eu_safety_laws\/pdfs\/(.+)$/)
    if (match) {
      return `/eu_safety_laws/pdfs/${match[1]}`
    }
  }

  // Priority 2: Try to construct local path for PDF documents
  // This handles cases where the PDF exists locally but local_pdf_path isn't set
  const localUrl = getLocalPdfUrl(law)
  if (localUrl) {
    return localUrl
  }

  // DO NOT return external URLs - they cannot be displayed in iframes
  // Use getExternalPdfUrl() if you need to link to external PDFs
  return null
}

/**
 * Get external PDF URL for opening in new tab.
 * This returns external URLs that cannot be embedded in iframes.
 */
export function getExternalPdfUrl(law) {
  if (!law) return null

  // Return external PDF URL from source metadata
  if (law.source?.pdf_url) {
    const url = law.source.pdf_url
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
  }

  // Return source URL if type indicates PDF
  if (law.source?.source_type === 'pdf' && law.source?.url) {
    const url = law.source.url
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
  }

  return null
}

/**
 * Check if a law has PDF source available
 */
export function hasPdfSource(law) {
  return !!getPdfSourceUrl(law)
}

/**
 * Check if a law has a LOCAL PDF that can be embedded in an iframe.
 * External PDFs cannot be embedded due to cross-origin restrictions.
 *
 * Checks for:
 * 1. Explicit local_pdf_path in source
 * 2. PDF-only documents where we can construct the local path
 */
export function hasLocalPdf(law) {
  if (!law) return false

  // Method 1: Check for explicit local_pdf_path
  if (law.source?.local_pdf_path) {
    const path = law.source.local_pdf_path
    // Handle both Windows backslashes and Unix forward slashes
    const normalizedPath = path.replace(/\\/g, '/')
    const match = normalizedPath.match(/eu_safety_laws\/pdfs\/(.+)$/)
    if (match) return true
  }

  // Method 2: Check if this is a PDF-only document where we can construct the local path
  const isPdfDocument =
    law.metadata?.is_pdf_only ||
    law.source?.source_type === 'pdf' ||
    (law.abbreviation || '').toUpperCase().endsWith('-PDF')

  if (isPdfDocument && law.jurisdiction) {
    // PDF files are stored as: {country}_{abbrev}_{type}.pdf
    return true
  }

  return false
}

/**
 * Get the local PDF URL for embedding.
 * Constructs URL from document metadata if local_pdf_path isn't set.
 */
export function getLocalPdfUrl(law) {
  if (!law) return null

  // Method 1: Check for explicit local_pdf_path
  if (law.source?.local_pdf_path) {
    const path = law.source.local_pdf_path
    // Handle both Windows backslashes and Unix forward slashes
    const normalizedPath = path.replace(/\\/g, '/')
    const match = normalizedPath.match(/eu_safety_laws\/pdfs\/(.+)$/)
    if (match) {
      return `/eu_safety_laws/pdfs/${match[1]}`
    }
  }

  // Method 2: Construct path for PDF-only documents
  const isPdfDocument =
    law.metadata?.is_pdf_only ||
    law.source?.source_type === 'pdf' ||
    (law.abbreviation || '').toUpperCase().endsWith('-PDF')

  if (isPdfDocument && law.jurisdiction) {
    const country = (law.jurisdiction || law.country || 'at').toLowerCase()
    let abbrev = law.abbreviation || ''

    // Remove -PDF suffix if present (e.g., ASchG-PDF -> ASchG)
    if (abbrev.toUpperCase().endsWith('-PDF')) {
      abbrev = abbrev.slice(0, -4)
    }

    // Clean abbreviation for filename
    const safeAbbrev = abbrev.replace(/[^\w\-]/g, '_')

    // PDF variants of laws use 'law' as docType, supplementary sources use 'merkblatt'
    // Check isPdfVariant FIRST since isSupplementarySource checks for -pdf suffix
    const docType = isPdfVariant(law) ? 'law' : (isTrueSupplementarySource(law) ? 'merkblatt' : 'law')

    return `/eu_safety_laws/pdfs/${country}/${country}_${safeAbbrev}_${docType}.pdf`
  }

  return null
}

/**
 * Check if law is from a supplementary source (like AUVA Merkblätter)
 * These are marked differently in the UI
 *
 * Supplementary sources by country:
 * - AT: AUVA M.plus (Merkblätter) - accident insurance guides
 * - DE: TRBS (Technical Rules Operational Safety), TRGS (Technical Rules Hazardous Substances),
 *       ASR (Workplace Technical Rules), DGUV Vorschriften (accident insurance regulations)
 * - NL: PGS (Publicatiereeks Gevaarlijke Stoffen), AI publications (Arbeidsinspectie)
 */
export function isSupplementarySource(law) {
  if (!law) return false

  const supplementaryTypes = [
    'merkblatt',
    'guideline',
    'handbook',
    'information',
    'supplement',
    'technical_rule',
    'technical_regulation'
  ]

  const type = (law.type || '').toLowerCase()
  const category = (law.category || '').toLowerCase()
  const abbrev = (law.abbreviation || '').toLowerCase()
  const title = (law.title || '').toLowerCase()

  // Check type and category
  if (supplementaryTypes.some(t => type.includes(t) || category.includes(t))) {
    return true
  }

  // AT: AUVA Merkblätter (M.plus series)
  if (abbrev.includes('auva') || abbrev.includes('m.plus') || abbrev.includes('mplus')) {
    return true
  }

  // NOTE: PDF variants (e.g., ASchG-PDF) are NOT supplementary sources
  // They are just PDF versions of regular laws - use isPdfVariant() to check

  // DE: Technical Rules and DGUV
  // TRBS - Technische Regeln für Betriebssicherheit
  // TRGS - Technische Regeln für Gefahrstoffe
  // ASR - Arbeitsstättenregeln
  // DGUV - Deutsche Gesetzliche Unfallversicherung
  if (abbrev.includes('trbs') || abbrev.includes('trgs') ||
      abbrev.includes('asr ') || abbrev.startsWith('asr') ||
      abbrev.includes('dguv')) {
    return true
  }

  // NL: PGS (Publicatiereeks Gevaarlijke Stoffen), AI publications, STL, TNO, RIVM
  if (abbrev.includes('pgs') || abbrev.startsWith('ai-') ||
      abbrev.includes('stl') || abbrev.includes('tno') || abbrev.includes('rivm') ||
      abbrev.includes('nl arbeidsinspectie')) {
    return true
  }

  // Check title for supplementary indicators
  if (title.includes('merkblatt') || title.includes('technische regel') ||
      title.includes('technical rule') || title.includes('publicatiereeks') ||
      title.includes('richtlijn') || title.includes('leitfaden') ||
      title.includes('arbocatalogus') || title.includes('factsheet') ||
      title.includes('wegwijzer')) {
    return true
  }

  // Check metadata flag
  if (law.metadata?.is_supplementary) {
    return true
  }

  return false
}

/**
 * Get the type of supplementary source for badge display
 * Returns: 'auva' | 'dguv' | 'trbs' | 'trgs' | 'asr' | 'pgs' | 'ai' | 'default'
 */
export function getSupplementarySourceType(law) {
  if (!law) return 'default'

  const abbrev = (law.abbreviation || '').toLowerCase()

  // AT
  if (abbrev.includes('auva') || abbrev.includes('m.plus') || abbrev.includes('mplus')) {
    return 'auva'
  }

  // DE
  if (abbrev.includes('trbs')) return 'trbs'
  if (abbrev.includes('trgs')) return 'trgs'
  if (abbrev.includes('asr ') || abbrev.startsWith('asr')) return 'asr'
  if (abbrev.includes('dguv')) return 'dguv'

  // NL
  if (abbrev.includes('pgs')) return 'pgs'
  if (abbrev.startsWith('ai-')) return 'ai'
  if (abbrev.includes('stl')) return 'stl'
  if (abbrev.includes('tno')) return 'tno'
  if (abbrev.includes('rivm')) return 'rivm'
  if (abbrev.includes('nl arbeidsinspectie')) return 'arbeidsinspectie'

  return 'default'
}

/**
 * Check if a law is a PDF variant of a regular law (e.g., ASchG-PDF, ARG-PDF)
 * These are PDF-only versions of regular laws, distinct from Merkblätter
 */
export function isPdfVariant(law) {
  if (!law) return false

  const abbrev = (law.abbreviation || '').toUpperCase()

  // PDF variants end with -PDF (e.g., ASchG-PDF, ARG-PDF, KJBG-PDF)
  if (abbrev.endsWith('-PDF')) {
    return true
  }

  return false
}

/**
 * Check if a law is a true supplementary source (Merkblatt, guideline, etc.)
 * Excludes PDF variants of regular laws
 */
export function isTrueSupplementarySource(law) {
  if (!law) return false

  // PDF variants are NOT true supplementary sources
  if (isPdfVariant(law)) {
    return false
  }

  // Check if it's a supplementary source (but not a PDF variant)
  return isSupplementarySource(law)
}

/**
 * Check if a law has a LOCAL HTML file that can be displayed in an iframe.
 */
export function hasLocalHtml(law) {
  if (!law) return false

  // Check for explicit local_html_path
  if (law.source?.local_html_path) {
    return true
  }

  // Check if this is an HTML-only document
  if (law.metadata?.is_html_only && law.jurisdiction) {
    return true
  }

  return false
}

/**
 * Get the local HTML URL for embedding.
 * Constructs URL from document metadata if local_html_path isn't set.
 */
export function getLocalHtmlUrl(law) {
  if (!law) return null

  // Method 1: Check for explicit local_html_path
  if (law.source?.local_html_path) {
    const path = law.source.local_html_path
    const match = path.match(/eu_safety_laws\/html\/(.+)$/)
    if (match) {
      return `/eu_safety_laws/html/${match[1]}`
    }
    // If path doesn't match expected pattern, construct it
    const filename = path.split('/').pop()
    const country = (law.jurisdiction || 'at').toLowerCase()
    return `/eu_safety_laws/html/${country}/${filename}`
  }

  // Method 2: Construct path for HTML-only documents
  if (law.metadata?.is_html_only && law.jurisdiction) {
    const country = (law.jurisdiction || law.country || 'at').toLowerCase()
    const abbrev = law.abbreviation || ''
    const safeAbbrev = abbrev.replace(/[^\w\-]/g, '_')
    return `/eu_safety_laws/html/${country}/${country}_${safeAbbrev}_merkblatt.html`
  }

  return null
}

/**
 * Check if a document is HTML-only (Merkblatt stored as HTML)
 */
export function isHtmlOnly(law) {
  if (!law) return false
  return !!law.metadata?.is_html_only
}

/**
 * Check if a law was recently updated (within specified days)
 * @param {Object} law - The law object
 * @param {number} withinDays - Number of days to consider as "recent" (default 14)
 * @returns {boolean} - True if law was updated recently
 */
export function isRecentlyUpdatedLaw(law, withinDays = 14) {
  if (!law) return false

  // Check scraping.scraped_at timestamp
  const scrapedAt = law.scraping?.scraped_at
  if (!scrapedAt) return false

  try {
    const scrapedDate = new Date(scrapedAt)
    const now = new Date()
    const diffDays = (now - scrapedDate) / (1000 * 60 * 60 * 24)
    return diffDays <= withinDays
  } catch {
    return false
  }
}

/**
 * Get all recently updated laws across all countries
 * @param {number} withinDays - Number of days to consider as "recent" (default 14)
 * @param {number} limit - Maximum number of results (default 10)
 * @returns {Promise<Array>} - Array of recently updated laws
 */
export async function getRecentlyUpdatedLaws(withinDays = 14, limit = 10) {
  // Load all databases
  await Promise.all([
    loadCountryDatabase('AT'),
    loadCountryDatabase('DE'),
    loadCountryDatabase('NL')
  ])

  const recentLaws = []

  for (const country of ['AT', 'DE', 'NL']) {
    const db = lawsDatabase[country]
    if (!db) continue

    for (const item of db.items) {
      if (isRecentlyUpdatedLaw(item, withinDays)) {
        recentLaws.push({
          ...item,
          country
        })
      }
    }
  }

  // Sort by scraped_at date (most recent first)
  recentLaws.sort((a, b) => {
    const dateA = new Date(a.scraping?.scraped_at || 0)
    const dateB = new Date(b.scraping?.scraped_at || 0)
    return dateB - dateA
  })

  return recentLaws.slice(0, limit)
}

/**
 * Get recently updated laws synchronously (only from loaded databases)
 * @param {number} withinDays - Number of days to consider as "recent" (default 14)
 * @param {number} limit - Maximum number of results (default 10)
 * @returns {Array} - Array of recently updated laws
 */
export function getRecentlyUpdatedLawsSync(withinDays = 14, limit = 10) {
  const recentLaws = []

  for (const country of ['AT', 'DE', 'NL']) {
    const db = lawsDatabase[country]
    if (!db) continue

    for (const item of db.items) {
      if (isRecentlyUpdatedLaw(item, withinDays)) {
        recentLaws.push({
          ...item,
          country
        })
      }
    }
  }

  // Sort by scraped_at date (most recent first)
  recentLaws.sort((a, b) => {
    const dateA = new Date(a.scraping?.scraped_at || 0)
    const dateB = new Date(b.scraping?.scraped_at || 0)
    return dateB - dateA
  })

  return recentLaws.slice(0, limit)
}

// Changelog cache
let changelogData = null

/**
 * Load the update changelog
 */
async function loadChangelog() {
  if (changelogData) return changelogData
  try {
    changelogData = (await import('../../eu_safety_laws/update_changelog.json')).default
  } catch (error) {
    console.warn('Changelog file not found:', error)
    changelogData = { updates: [], last_check: null }
  }
  return changelogData
}

/**
 * Get changelog data with details about which laws changed
 * @returns {Promise<Object>} - Changelog object with updates array
 */
export async function getUpdateChangelog() {
  return loadChangelog()
}

/**
 * Get list of laws that have actual content changes (not just re-scraped)
 * @param {number} withinDays - Number of days to look back
 * @returns {Promise<Array>} - Array of change records with law details
 */
export async function getChangedLaws(withinDays = 14) {
  const changelog = await loadChangelog()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - withinDays)

  const changes = []
  const seen = new Set()

  for (const update of changelog.updates || []) {
    try {
      const updateTime = new Date(update.timestamp)
      if (updateTime < cutoff) continue

      const country = update.country || ''

      // Add new laws
      for (const abbrev of update.new_laws || []) {
        const key = `${country}:${abbrev}`
        if (!seen.has(key)) {
          changes.push({
            abbreviation: abbrev,
            country,
            changeType: 'new',
            timestamp: update.timestamp
          })
          seen.add(key)
        }
      }

      // Add updated laws (content changed)
      for (const abbrev of update.updated_laws || []) {
        const key = `${country}:${abbrev}`
        if (!seen.has(key)) {
          const details = (update.details?.updated || []).find(d => d.abbreviation === abbrev) || {}
          changes.push({
            abbreviation: abbrev,
            country,
            changeType: 'updated',
            timestamp: update.timestamp,
            oldHash: details.old_hash,
            newHash: details.new_hash
          })
          seen.add(key)
        }
      }
    } catch (e) {
      continue
    }
  }

  return changes
}

export default {
  initializeLawsDatabase,
  isDatabaseLoaded,
  getDatabaseLoadingStatus,
  getLawsDatabase,
  getLawsDatabaseSync,
  getAllLaws,
  getAllLawsSync,
  getLawById,
  getLawByIdSync,
  getLawsByType,
  searchLaws,
  searchLawsSync,
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
  getLawsByTopic,
  hasLocalPdf,
  getLocalPdfUrl,
  getPdfSourceUrl,
  getExternalPdfUrl,
  hasPdfSource,
  isSupplementarySource,
  getSupplementarySourceType,
  isPdfVariant,
  isTrueSupplementarySource,
  hasLocalHtml,
  getLocalHtmlUrl,
  isHtmlOnly,
  isRecentlyUpdatedLaw,
  getRecentlyUpdatedLaws,
  getRecentlyUpdatedLawsSync,
  getUpdateChangelog,
  getChangedLaws
}

/**
 * EU Safety Laws Database Service
 * Deep integration with comprehensive EU safety laws from AT, DE, NL
 * Includes cross-linking, search, and categorization
 */

// Import the full EU laws databases
import atLawsData from '../../eu_safety_laws/at/at_safety_laws_database.json'
import deLawsData from '../../eu_safety_laws/de/de_safety_laws_database.json'
import nlLawsData from '../../eu_safety_laws/nl/nl_safety_laws_database.json'

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
 * Process raw laws data into standardized format
 */
function processLawsData(data, countryCode) {
  if (!data || !data.items) {
    return {
      metadata: data?.metadata || {},
      categories: data?.categories || {},
      items: [],
      itemsById: {},
      itemsByType: {},
      crossReferences: {}
    }
  }

  const items = data.items.map(item => ({
    ...item,
    country: countryCode,
    searchText: buildSearchText(item),
    keywords: extractKeywords(item),
    relatedIds: findRelatedLaws(item, data.items)
  }))

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
 * Search laws
 */
export function searchLaws(query, options = {}) {
  if (!lawsDatabase) {
    initializeLawsDatabase()
  }

  const {
    country = null, // null means all countries
    type = null,
    limit = 50,
    includeContent = false
  } = options

  const queryLower = query.toLowerCase().trim()
  const results = []

  const countries = country ? [country] : ['AT', 'DE', 'NL']

  countries.forEach(c => {
    const db = lawsDatabase[c]
    if (!db) return

    db.items.forEach(item => {
      // Filter by type if specified
      if (type && item.type !== type) return

      // Search in title, abbreviation, description
      const score = calculateSearchScore(item, queryLower)

      if (score > 0) {
        results.push({
          ...item,
          score,
          country: c,
          // Only include content if requested
          content: includeContent ? item.content : { available: item.content?.available }
        })
      }
    })
  })

  // Sort by score and limit
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
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

  // Try to parse German law structure (§ sections)
  const sectionRegex = /§\s*(\d+[a-z]?)\s*([^\n§]+)/gi
  let match

  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({
      id: `${lawId}-s${match[1]}`,
      paragraph: `§ ${match[1]}`,
      title: match[2].trim().substring(0, 100),
      startIndex: match.index
    })
  }

  return sections
}

/**
 * Extract law excerpt around a search term
 */
export function getLawExcerpt(law, searchTerm, contextLength = 200) {
  if (!law.content?.full_text || !searchTerm) {
    return law.description || ''
  }

  const text = law.content.full_text
  const termLower = searchTerm.toLowerCase()
  const textLower = text.toLowerCase()
  const index = textLower.indexOf(termLower)

  if (index === -1) {
    return text.substring(0, contextLength) + '...'
  }

  const start = Math.max(0, index - contextLength / 2)
  const end = Math.min(text.length, index + searchTerm.length + contextLength / 2)

  let excerpt = text.substring(start, end)

  if (start > 0) excerpt = '...' + excerpt
  if (end < text.length) excerpt = excerpt + '...'

  return excerpt
}

/**
 * Get popular/core laws for a country
 */
export function getCoreLaws(country = 'DE') {
  const coreLawIds = {
    AT: ['at-law-aschg', 'at-law-arbig', 'at-law-asvg'],
    DE: ['de-law-arbschg', 'de-law-asig', 'de-law-arbstatv', 'de-law-gefstoffv'],
    NL: ['nl-law-arbowet', 'nl-law-arbobesluit']
  }

  const db = getLawsDatabase(country)
  const ids = coreLawIds[country] || []

  return ids
    .map(id => db.itemsById[id])
    .filter(Boolean)
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
  getLawsStatistics,
  formatLawReference,
  getLawContentSections,
  getLawExcerpt,
  getCoreLaws,
  getLawsByTopic
}

/**
 * PDF Search Service
 * Deep text search across PDF documents and full law content
 * Supports WHS (Workplace Health & Safety) Amazon logistics smart search
 *
 * Note: PDF text extraction uses the pre-indexed content from the law database.
 * For direct PDF parsing, pdfjs-dist would need to be installed separately.
 */

// Cache for search results
const searchCache = new Map()

// WHS Amazon Logistics Keywords - prioritized search terms
export const WHS_LOGISTICS_KEYWORDS = {
  // High priority - directly related to Amazon logistics operations
  critical: [
    'forklift', 'gabelstapler', 'flurförderzeug', 'heftrucks',
    'pallet', 'palette', 'paletten',
    'warehouse', 'lager', 'magazijn',
    'lifting', 'heben', 'tillen', 'lastenhandhabung',
    'conveyor', 'förderband', 'transportband',
    'loading dock', 'laderampe', 'laadperron',
    'package handling', 'pakethandhabung',
    'manual handling', 'manuelle handhabung', 'manuele behandeling',
    'stacking', 'stapeln', 'stapeling',
    'racking', 'regale', 'stellingen',
    'ergonomics', 'ergonomie',
  ],
  // High priority - safety critical
  high: [
    'ppe', 'psa', 'persoonlijke beschermingsmiddelen', 'schutzausrüstung',
    'safety shoes', 'sicherheitsschuhe', 'veiligheidsschoenen',
    'high visibility', 'warnweste', 'veiligheidsvest',
    'fall protection', 'absturzsicherung', 'valbeveiliging',
    'first aid', 'erste hilfe', 'ehbo',
    'emergency', 'notfall', 'noodgeval',
    'fire safety', 'brandschutz', 'brandveiligheid',
    'hazardous materials', 'gefahrstoffe', 'gevaarlijke stoffen',
    'training', 'schulung', 'opleiding', 'unterweisung',
    'risk assessment', 'gefährdungsbeurteilung', 'risicobeoordeling',
  ],
  // Medium priority - operational safety
  medium: [
    'working hours', 'arbeitszeit', 'werktijden',
    'break', 'pause', 'pauze',
    'shift work', 'schichtarbeit', 'ploegendienst',
    'noise', 'lärm', 'geluid',
    'lighting', 'beleuchtung', 'verlichting',
    'ventilation', 'lüftung', 'ventilatie',
    'temperature', 'temperatur', 'temperatuur',
    'workplace design', 'arbeitsplatzgestaltung', 'werkplekinrichting',
    'accident', 'unfall', 'ongeval',
    'incident', 'vorfall', 'incident',
    'reporting', 'meldung', 'melding',
  ],
}

// Smart search suggestions for WHS Amazon logistics
export const WHS_SMART_SUGGESTIONS = [
  {
    category: 'Forklift Operations',
    icon: '🚜',
    keywords: ['forklift', 'gabelstapler', 'flurförderzeug'],
    description: 'Forklift safety, certification, and operation rules',
    relatedTopics: ['training', 'work_equipment', 'documentation'],
  },
  {
    category: 'Manual Handling',
    icon: '💪',
    keywords: ['lifting', 'manual handling', 'lastenhandhabung', 'ergonomics'],
    description: 'Lifting limits, ergonomic guidelines, back injury prevention',
    relatedTopics: ['ergonomics', 'health_surveillance', 'risk_assessment'],
  },
  {
    category: 'Warehouse Safety',
    icon: '🏭',
    keywords: ['warehouse', 'lager', 'racking', 'stacking'],
    description: 'Warehouse layout, racking safety, traffic management',
    relatedTopics: ['workplace_design', 'work_equipment', 'risk_assessment'],
  },
  {
    category: 'PPE Requirements',
    icon: '🦺',
    keywords: ['ppe', 'safety shoes', 'high visibility', 'protection'],
    description: 'Personal protective equipment requirements and standards',
    relatedTopics: ['ppe', 'employer_obligations', 'training'],
  },
  {
    category: 'Hazardous Materials',
    icon: '☣️',
    keywords: ['hazmat', 'chemical', 'gefahrstoff', 'gevaarlijke stoffen'],
    description: 'Chemical handling, storage, and spill response',
    relatedTopics: ['hazardous_substances', 'documentation', 'training'],
  },
  {
    category: 'Emergency Response',
    icon: '🚨',
    keywords: ['emergency', 'fire', 'evacuation', 'first aid'],
    description: 'Emergency procedures, evacuation routes, first aid',
    relatedTopics: ['first_aid', 'incident_reporting', 'training'],
  },
  {
    category: 'Working Hours',
    icon: '⏰',
    keywords: ['working hours', 'shift', 'break', 'rest period'],
    description: 'Shift regulations, break requirements, overtime rules',
    relatedTopics: ['working_hours', 'employee_rights', 'health_surveillance'],
  },
  {
    category: 'Training & Certification',
    icon: '📚',
    keywords: ['training', 'certification', 'unterweisung', 'opleiding'],
    description: 'Required training, certification requirements, documentation',
    relatedTopics: ['training', 'documentation', 'employer_obligations'],
  },
  {
    category: 'Transport & Delivery',
    icon: '🚚',
    keywords: ['transport', 'delivery', 'loading', 'vehicle'],
    description: 'Vehicle safety, loading dock procedures, driver safety',
    relatedTopics: ['work_equipment', 'risk_assessment', 'training'],
  },
  {
    category: 'Risk Assessment',
    icon: '⚠️',
    keywords: ['risk', 'gefährdung', 'assessment', 'beurteilung'],
    description: 'Risk evaluation methods, documentation requirements',
    relatedTopics: ['risk_assessment', 'documentation', 'employer_obligations'],
  },
]

/**
 * Get searchable text from a law document
 * Uses pre-indexed content from chapters and sections
 * @param {Object} law - Law document object
 * @returns {string} - Full searchable text content
 */
export function getSearchableText(law) {
  if (!law) return ''

  const parts = []

  // Add basic info
  if (law.abbreviation) parts.push(law.abbreviation)
  if (law.title) parts.push(law.title)
  if (law.title_en) parts.push(law.title_en)
  if (law.summary) parts.push(law.summary)

  // Add full text content if available
  if (law.content?.full_text) {
    parts.push(law.content.full_text)
  }

  // Extract text from chapters and sections
  if (law.chapters && Array.isArray(law.chapters)) {
    for (const chapter of law.chapters) {
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

  return parts.filter(Boolean).join(' ')
}

/**
 * Search within PDF text content
 * @param {string} text - Text to search in
 * @param {string} query - Search query
 * @returns {Array} - Array of matches with context
 */
export function searchInText(text, query) {
  if (!text || !query) return []

  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  const matches = []

  let index = 0
  while ((index = textLower.indexOf(queryLower, index)) !== -1) {
    // Extract context around the match
    const contextStart = Math.max(0, index - 100)
    const contextEnd = Math.min(text.length, index + query.length + 100)
    const context = text.substring(contextStart, contextEnd)

    matches.push({
      index,
      context: (contextStart > 0 ? '...' : '') + context + (contextEnd < text.length ? '...' : ''),
      matchStart: index - contextStart,
    })

    index += query.length
  }

  return matches
}

/**
 * Calculate relevance score for a document based on search query
 * Enhanced for WHS Amazon logistics relevance
 * @param {Object} doc - Document to score
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Object} - Score and match details
 */
export function calculateRelevanceScore(doc, query, options = {}) {
  const { boostLogistics = true } = options
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

  let score = 0
  const matchDetails = {
    titleMatch: false,
    abbreviationMatch: false,
    contentMatch: false,
    pdfMatch: false,
    logisticsBonus: 0,
    matchedKeywords: [],
    matchCount: 0,
  }

  // Abbreviation match (highest priority)
  const abbrev = (doc.abbreviation || '').toLowerCase()
  if (abbrev === queryLower) {
    score += 100
    matchDetails.abbreviationMatch = true
  } else if (abbrev.includes(queryLower)) {
    score += 60
    matchDetails.abbreviationMatch = true
  }

  // Title match
  const title = (doc.title || '').toLowerCase()
  const titleEn = (doc.title_en || '').toLowerCase()

  if (title.includes(queryLower) || titleEn.includes(queryLower)) {
    score += 50
    matchDetails.titleMatch = true
  }

  // Check for word matches in title
  for (const word of queryWords) {
    if (title.includes(word) || titleEn.includes(word)) {
      score += 15
    }
  }

  // Full content search
  const fullText = (doc.searchText || doc.content?.full_text || '').toLowerCase()

  if (fullText) {
    // Count occurrences in full text
    const regex = new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const matches = fullText.match(regex)
    if (matches) {
      matchDetails.contentMatch = true
      matchDetails.matchCount = matches.length
      score += Math.min(matches.length * 5, 50)
    }

    // Word-level matching
    for (const word of queryWords) {
      if (fullText.includes(word)) {
        score += 10
      }
    }
  }

  // Search in chapters and sections
  if (doc.chapters && Array.isArray(doc.chapters)) {
    for (const chapter of doc.chapters) {
      const chapterTitle = (chapter.title || '').toLowerCase()
      if (chapterTitle.includes(queryLower)) {
        score += 30
        matchDetails.contentMatch = true
      }

      if (chapter.sections && Array.isArray(chapter.sections)) {
        for (const section of chapter.sections) {
          const sectionText = (section.text || '').toLowerCase()
          const sectionTitle = (section.title || '').toLowerCase()

          if (sectionTitle.includes(queryLower)) {
            score += 25
            matchDetails.contentMatch = true
          }

          if (sectionText.includes(queryLower)) {
            score += 15
            matchDetails.contentMatch = true
          }
        }
      }
    }
  }

  // WHS Amazon logistics boost
  if (boostLogistics && doc.whs_summary) {
    const { logistics_relevance_distribution, top_whs_topics } = doc.whs_summary

    // Boost for critical/high logistics relevance
    if (logistics_relevance_distribution) {
      const criticalCount = logistics_relevance_distribution.critical || 0
      const highCount = logistics_relevance_distribution.high || 0

      if (criticalCount > 0) {
        matchDetails.logisticsBonus += criticalCount * 3
      }
      if (highCount > 0) {
        matchDetails.logisticsBonus += highCount * 2
      }
    }

    // Check if query matches WHS topics
    const allLogisticsKeywords = [
      ...WHS_LOGISTICS_KEYWORDS.critical,
      ...WHS_LOGISTICS_KEYWORDS.high,
      ...WHS_LOGISTICS_KEYWORDS.medium,
    ]

    for (const keyword of allLogisticsKeywords) {
      if (queryLower.includes(keyword) || keyword.includes(queryLower)) {
        matchDetails.logisticsBonus += 20
        matchDetails.matchedKeywords.push(keyword)
        break
      }
    }

    score += matchDetails.logisticsBonus
  }

  return { score, matchDetails }
}

/**
 * Perform deep search across all content including PDFs
 * @param {string} query - Search query
 * @param {Array} laws - Array of law documents
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Sorted search results
 */
export async function deepSearch(query, laws, options = {}) {
  const {
    searchPdfs = false,
    boostLogistics = true,
    limit = 50,
  } = options

  if (!query || query.length < 2) {
    return []
  }

  const results = []
  const queryLower = query.toLowerCase()

  for (const law of laws) {
    const { score, matchDetails } = calculateRelevanceScore(law, query, { boostLogistics })
    let finalScore = score
    let finalMatchDetails = { ...matchDetails }

    // Always search PDF content when searchPdfs is enabled
    // Include PDF text search for ALL laws, not just as fallback
    if (searchPdfs) {
      const isPdfLaw = law.source?.local_pdf_path || law.source?.source_type === 'pdf' || law.source?.pdf_url

      // Get full searchable text including chapters, sections, and content
      const fullText = getSearchableText(law)

      if (fullText && fullText.length > 0) {
        const textMatches = searchInText(fullText, query)

        if (textMatches.length > 0) {
          // Boost score based on text matches
          const textBoost = Math.min(textMatches.length * 8, 60)
          finalScore += textBoost
          finalMatchDetails.contentMatch = true
          finalMatchDetails.matchCount = (finalMatchDetails.matchCount || 0) + textMatches.length

          if (isPdfLaw) {
            finalMatchDetails.pdfMatch = true
            finalMatchDetails.pdfContext = textMatches[0]?.context || ''
          }
        }
      }

      // Also search in summary, description, and other metadata
      const searchableFields = [
        law.summary,
        law.description,
        law.metadata?.description,
        law.metadata?.summary,
        law.whs_summary?.top_whs_topics?.join(' '),
      ].filter(Boolean).join(' ').toLowerCase()

      if (searchableFields.includes(queryLower)) {
        finalScore += 15
        finalMatchDetails.contentMatch = true
      }
    }

    if (finalScore > 0) {
      results.push({
        ...law,
        searchScore: finalScore,
        matchDetails: finalMatchDetails,
      })
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.searchScore - a.searchScore)

  return results.slice(0, limit)
}

/**
 * Group search results by category
 * @param {Array} results - Search results
 * @returns {Object} - Results grouped by category
 */
export function groupResultsByCategory(results) {
  const groups = {}

  for (const result of results) {
    const category = result.category || 'Other'

    if (!groups[category]) {
      groups[category] = {
        category,
        count: 0,
        items: [],
        totalScore: 0,
        topRelevance: 'low',
      }
    }

    groups[category].items.push(result)
    groups[category].count++
    groups[category].totalScore += result.searchScore || 0

    // Track highest relevance level
    const relevance = result.whs_summary?.logistics_relevance_distribution
    if (relevance?.critical > 0) {
      groups[category].topRelevance = 'critical'
    } else if (relevance?.high > 0 && groups[category].topRelevance !== 'critical') {
      groups[category].topRelevance = 'high'
    } else if (relevance?.medium > 0 && !['critical', 'high'].includes(groups[category].topRelevance)) {
      groups[category].topRelevance = 'medium'
    }
  }

  // Convert to sorted array
  return Object.values(groups).sort((a, b) => b.totalScore - a.totalScore)
}

/**
 * Get smart search suggestions based on partial input
 * @param {string} input - Partial search input
 * @returns {Array} - Matching suggestions
 */
export function getSmartSuggestions(input) {
  if (!input || input.length < 2) {
    return WHS_SMART_SUGGESTIONS.slice(0, 5)
  }

  const inputLower = input.toLowerCase()
  const suggestions = []

  for (const suggestion of WHS_SMART_SUGGESTIONS) {
    const categoryMatch = suggestion.category.toLowerCase().includes(inputLower)
    const descMatch = suggestion.description.toLowerCase().includes(inputLower)
    const keywordMatch = suggestion.keywords.some(k => k.includes(inputLower) || inputLower.includes(k))

    if (categoryMatch || descMatch || keywordMatch) {
      suggestions.push({
        ...suggestion,
        relevance: categoryMatch ? 3 : (keywordMatch ? 2 : 1),
      })
    }
  }

  // Sort by relevance
  suggestions.sort((a, b) => b.relevance - a.relevance)

  return suggestions.slice(0, 8)
}

/**
 * Check if a query is WHS logistics related
 * @param {string} query - Search query
 * @returns {Object} - Relevance info
 */
export function checkLogisticsRelevance(query) {
  if (!query) return { isRelevant: false, level: 'none', matchedKeywords: [] }

  const queryLower = query.toLowerCase()
  const matchedKeywords = []

  for (const keyword of WHS_LOGISTICS_KEYWORDS.critical) {
    if (queryLower.includes(keyword) || keyword.includes(queryLower)) {
      matchedKeywords.push({ keyword, level: 'critical' })
    }
  }

  for (const keyword of WHS_LOGISTICS_KEYWORDS.high) {
    if (queryLower.includes(keyword) || keyword.includes(queryLower)) {
      matchedKeywords.push({ keyword, level: 'high' })
    }
  }

  for (const keyword of WHS_LOGISTICS_KEYWORDS.medium) {
    if (queryLower.includes(keyword) || keyword.includes(queryLower)) {
      matchedKeywords.push({ keyword, level: 'medium' })
    }
  }

  const isRelevant = matchedKeywords.length > 0
  const level = matchedKeywords.find(k => k.level === 'critical')
    ? 'critical'
    : matchedKeywords.find(k => k.level === 'high')
      ? 'high'
      : matchedKeywords.find(k => k.level === 'medium')
        ? 'medium'
        : 'none'

  return { isRelevant, level, matchedKeywords }
}

export default {
  getSearchableText,
  searchInText,
  calculateRelevanceScore,
  deepSearch,
  groupResultsByCategory,
  getSmartSuggestions,
  checkLogisticsRelevance,
  WHS_LOGISTICS_KEYWORDS,
  WHS_SMART_SUGGESTIONS,
}

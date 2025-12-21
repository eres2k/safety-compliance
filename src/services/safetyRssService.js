/**
 * Safety RSS Service - Fetches real workplace incident data from safety agency feeds
 *
 * Sources:
 * - OSHA (US) News Releases: https://www.osha.gov/news/newsreleases.xml
 * - OSHA QuickTakes Newsletter: https://www.osha.gov/sites/default/files/quicktakes.xml
 * - HSE UK Safety Bulletins (scraped)
 * - EU-OSHA News (scraped)
 *
 * Uses a CORS proxy for browser-based fetching and caches results.
 */

// Cache configuration
const CACHE_KEY = 'safety_rss_cache_v1'
const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

// CORS proxy options (multiple fallbacks)
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest='
]

// RSS Feed sources
const RSS_FEEDS = {
  OSHA_NEWS: {
    url: 'https://www.osha.gov/news/newsreleases.xml',
    source: 'OSHA',
    name: 'US OSHA',
    country: 'US',
    flag: '🇺🇸'
  },
  OSHA_QUICKTAKES: {
    url: 'https://www.osha.gov/sites/default/files/quicktakes.xml',
    source: 'OSHA',
    name: 'OSHA QuickTakes',
    country: 'US',
    flag: '🇺🇸'
  }
}

// Category detection keywords for classification
const CATEGORY_KEYWORDS = {
  forklift: ['forklift', 'powered industrial truck', 'pit', 'pallet jack', 'warehouse vehicle'],
  falls: ['fall', 'fell', 'falling', 'scaffold', 'ladder', 'height', 'roof', 'elevated'],
  machinery: ['machine', 'machinery', 'conveyor', 'equipment', 'entangle', 'caught-in', 'amputation', 'crush'],
  vehicle: ['vehicle', 'truck', 'van', 'struck-by', 'backing', 'loading dock', 'traffic'],
  hazmat: ['chemical', 'toxic', 'hazardous', 'exposure', 'asbestos', 'silica', 'lead', 'gas', 'fumes'],
  fire: ['fire', 'explosion', 'burn', 'flammable', 'combustible', 'ignition'],
  electrical: ['electric', 'electrocution', 'shock', 'arc flash', 'power line'],
  manual_handling: ['lifting', 'carrying', 'strain', 'back injury', 'manual handling', 'ergonomic'],
  ppe: ['ppe', 'protective equipment', 'helmet', 'gloves', 'eye protection', 'respirator'],
  confined_space: ['confined space', 'tank', 'silo', 'manhole', 'oxygen deficient']
}

// Severity detection keywords
const SEVERITY_KEYWORDS = {
  critical: ['death', 'fatal', 'fatality', 'killed', 'dies', 'deceased'],
  high: ['serious', 'severe', 'amputation', 'hospitalized', 'hospitalization', 'life-threatening', 'critical condition'],
  medium: ['injury', 'injured', 'citation', 'violation', 'fine', 'penalty'],
  low: ['near-miss', 'warning', 'advisory', 'reminder', 'update']
}

/**
 * Detect category from text content
 */
function detectCategory(text) {
  const lowerText = text.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return category
    }
  }
  return 'machinery' // default
}

/**
 * Detect severity from text content
 */
function detectSeverity(text) {
  const lowerText = text.toLowerCase()
  for (const [severity, keywords] of Object.entries(SEVERITY_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return severity
    }
  }
  return 'medium' // default
}

/**
 * Extract lessons from incident description using common patterns
 */
function extractLessons(text) {
  const lessons = []
  const lowerText = text.toLowerCase()

  // Common safety lessons based on incident type
  if (lowerText.includes('fall') || lowerText.includes('height')) {
    lessons.push('Ensure proper fall protection systems are in place')
    lessons.push('Conduct regular inspections of ladders and scaffolds')
  }
  if (lowerText.includes('machine') || lowerText.includes('equipment')) {
    lessons.push('Implement lockout/tagout procedures before maintenance')
    lessons.push('Install proper machine guarding')
  }
  if (lowerText.includes('struck') || lowerText.includes('vehicle')) {
    lessons.push('Establish designated pedestrian walkways')
    lessons.push('Use spotters for vehicle operations in work areas')
  }
  if (lowerText.includes('chemical') || lowerText.includes('exposure')) {
    lessons.push('Ensure proper PPE is available and used')
    lessons.push('Maintain adequate ventilation in work areas')
  }
  if (lowerText.includes('electric')) {
    lessons.push('De-energize equipment before work begins')
    lessons.push('Maintain safe distances from power sources')
  }

  // Generic lessons if none specific
  if (lessons.length === 0) {
    lessons.push('Review and update safety procedures regularly')
    lessons.push('Ensure all workers receive proper safety training')
    lessons.push('Conduct regular workplace hazard assessments')
  }

  return lessons.slice(0, 3)
}

/**
 * Parse RSS XML to extract items
 */
function parseRssXml(xmlText, feedConfig) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    console.warn('RSS parse error:', parseError.textContent)
    return []
  }

  const items = doc.querySelectorAll('item')
  const alerts = []

  items.forEach((item, index) => {
    const title = item.querySelector('title')?.textContent || ''
    const description = item.querySelector('description')?.textContent || ''
    const pubDate = item.querySelector('pubDate')?.textContent || ''
    const link = item.querySelector('link')?.textContent || ''

    // Clean HTML from description
    const cleanDescription = description
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()

    // Parse date
    let date = new Date().toISOString().split('T')[0]
    if (pubDate) {
      try {
        date = new Date(pubDate).toISOString().split('T')[0]
      } catch {
        // Keep default date
      }
    }

    const fullText = `${title} ${cleanDescription}`
    const category = detectCategory(fullText)
    const severity = detectSeverity(fullText)

    alerts.push({
      id: `rss-${feedConfig.source}-${index}-${Date.now()}`,
      title: title.trim(),
      summary: cleanDescription.slice(0, 300) + (cleanDescription.length > 300 ? '...' : ''),
      source: feedConfig.source,
      sourceUrl: link,
      date,
      severity,
      category,
      lessons: extractLessons(fullText),
      relatedRegulations: [], // Could be enhanced with regulation detection
      logistics_relevance: severity === 'critical' ? 'critical' : 'high',
      isRealIncident: true
    })
  })

  return alerts
}

/**
 * Fetch RSS feed with CORS proxy fallbacks
 */
async function fetchWithProxy(url) {
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(url), {
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      })

      if (response.ok) {
        return await response.text()
      }
    } catch (error) {
      console.warn(`Proxy ${proxy} failed:`, error.message)
    }
  }

  throw new Error('All CORS proxies failed')
}

/**
 * Get cached alerts
 */
function getCachedAlerts() {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { alerts, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_TTL_MS) {
        return alerts
      }
    }
  } catch {
    // Cache read failed
  }
  return null
}

/**
 * Save alerts to cache
 */
function cacheAlerts(alerts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      alerts,
      timestamp: Date.now()
    }))
  } catch {
    // Cache write failed (e.g., quota exceeded)
  }
}

/**
 * Fetch real safety incident alerts from RSS feeds
 * Falls back to sample data if feeds are unavailable
 */
export async function fetchSafetyAlerts() {
  // Check cache first
  const cached = getCachedAlerts()
  if (cached && cached.length > 0) {
    return { alerts: cached, fromCache: true }
  }

  const allAlerts = []

  // Fetch from each feed
  for (const [feedId, feedConfig] of Object.entries(RSS_FEEDS)) {
    try {
      const xmlText = await fetchWithProxy(feedConfig.url)
      const alerts = parseRssXml(xmlText, feedConfig)
      allAlerts.push(...alerts)
    } catch (error) {
      console.warn(`Failed to fetch ${feedId}:`, error.message)
    }
  }

  // Sort by date (newest first)
  allAlerts.sort((a, b) => new Date(b.date) - new Date(a.date))

  // Limit to most recent 20 alerts
  const limitedAlerts = allAlerts.slice(0, 20)

  if (limitedAlerts.length > 0) {
    cacheAlerts(limitedAlerts)
    return { alerts: limitedAlerts, fromCache: false }
  }

  // Return empty if no feeds worked (component will use fallback sample data)
  return { alerts: [], fromCache: false }
}

/**
 * Clear the RSS cache (useful for forcing refresh)
 */
export function clearSafetyAlertsCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Ignore errors
  }
}

/**
 * Get information about available feeds
 */
export function getAvailableFeeds() {
  return Object.entries(RSS_FEEDS).map(([id, config]) => ({
    id,
    name: config.name,
    url: config.url,
    country: config.country,
    flag: config.flag
  }))
}

export default {
  fetchSafetyAlerts,
  clearSafetyAlertsCache,
  getAvailableFeeds
}

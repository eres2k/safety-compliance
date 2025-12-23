/**
 * Safety RSS Service - Fetches workplace safety news from safety agency feeds
 *
 * Sources:
 * - Germany: BAuA, BMAS (Federal safety authorities)
 * - Austria: AUVA (via OTS press wire)
 * - Netherlands: Nederlandse Arbeidsinspectie
 * - EU-wide: EU-OSHA (European Agency for Safety and Health)
 * - US: OSHA (Occupational Safety and Health Administration)
 *
 * Uses a CORS proxy for browser-based fetching and caches results.
 */

// Cache configuration
const CACHE_KEY = 'safety_rss_cache_v2'
const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

// RSS to JSON API (more reliable than CORS proxies)
const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url='

// CORS proxy fallbacks (less reliable, used if rss2json fails)
const CORS_PROXIES = [
  { prefix: 'https://api.allorigins.win/get?url=', isJson: true },
  { prefix: 'https://corsproxy.io/?', isJson: false }
]

// RSS Feed sources - tested and working EU safety feeds
const RSS_FEEDS = {
  // Germany - DGUV (German Social Accident Insurance) - TESTED OK
  DGUV: {
    url: 'https://www.dguv.de/de/index.xml.jsp',
    source: 'DGUV',
    name: 'DGUV Germany',
    country: 'DE',
    flag: '🇩🇪'
  },
  // Austria - AUVA (Austrian Workers Compensation Board) - TESTED OK
  AUVA: {
    url: 'https://auva.at/rss',
    source: 'AUVA',
    name: 'AUVA Austria',
    country: 'AT',
    flag: '🇦🇹'
  },
  // Netherlands - Safety Podcast feed
  NL_SAFETY: {
    url: 'https://anchor.fm/s/2c638298/podcast/rss',
    source: 'NL_PODCAST',
    name: 'NL Safety Podcast',
    country: 'NL',
    flag: '🇳🇱'
  },
  // EU-OSHA - News - TESTED OK
  EUOSHA_NEWS: {
    url: 'https://osha.europa.eu/rss-feeds/latest/news.xml',
    source: 'EUOSHA',
    name: 'EU-OSHA News',
    country: 'EU',
    flag: '🇪🇺'
  }
}

// Category detection keywords for classification (multilingual: EN, DE, NL)
const CATEGORY_KEYWORDS = {
  forklift: [
    'forklift', 'powered industrial truck', 'pit', 'pallet jack', 'warehouse vehicle',
    'gabelstapler', 'stapler', 'flurförderzeug', 'hubwagen', // German
    'heftruck', 'vorkheftruck', 'palletwagen' // Dutch
  ],
  falls: [
    'fall', 'fell', 'falling', 'scaffold', 'ladder', 'height', 'roof', 'elevated',
    'absturz', 'sturz', 'gerüst', 'leiter', 'höhe', 'dach', // German
    'val', 'vallen', 'steiger', 'ladder', 'hoogte', 'dak' // Dutch
  ],
  machinery: [
    'machine', 'machinery', 'conveyor', 'equipment', 'entangle', 'caught-in', 'amputation', 'crush',
    'maschine', 'förderband', 'quetschung', 'amputation', 'einzug', // German
    'machine', 'transportband', 'beknelling', 'amputatie' // Dutch
  ],
  vehicle: [
    'vehicle', 'truck', 'van', 'struck-by', 'backing', 'loading dock', 'traffic',
    'fahrzeug', 'lkw', 'lieferwagen', 'laderampe', 'verkehr', // German
    'voertuig', 'vrachtwagen', 'bestelwagen', 'laadperron', 'verkeer' // Dutch
  ],
  hazmat: [
    'chemical', 'toxic', 'hazardous', 'exposure', 'asbestos', 'silica', 'lead', 'gas', 'fumes',
    'chemikalie', 'giftig', 'gefahrstoff', 'asbest', 'blei', 'dämpfe', // German
    'chemisch', 'giftig', 'gevaarlijk', 'asbest', 'lood', 'dampen' // Dutch
  ],
  fire: [
    'fire', 'explosion', 'burn', 'flammable', 'combustible', 'ignition',
    'brand', 'feuer', 'explosion', 'verbrennung', 'entzündung', // German
    'brand', 'explosie', 'verbranding', 'ontvlambaar' // Dutch
  ],
  electrical: [
    'electric', 'electrocution', 'shock', 'arc flash', 'power line',
    'elektrisch', 'stromschlag', 'strom', 'hochspannung', // German
    'elektrisch', 'elektrocutie', 'schok', 'hoogspanning' // Dutch
  ],
  manual_handling: [
    'lifting', 'carrying', 'strain', 'back injury', 'manual handling', 'ergonomic',
    'heben', 'tragen', 'rücken', 'ergonomie', 'lastenhandhabung', // German
    'tillen', 'dragen', 'rug', 'ergonomie', 'fysieke belasting' // Dutch
  ],
  ppe: [
    'ppe', 'protective equipment', 'helmet', 'gloves', 'eye protection', 'respirator',
    'psa', 'schutzausrüstung', 'helm', 'handschuhe', 'schutzbrille', 'atemschutz', // German
    'pbm', 'beschermingsmiddel', 'helm', 'handschoenen', 'veiligheidsbril' // Dutch
  ],
  confined_space: [
    'confined space', 'tank', 'silo', 'manhole', 'oxygen deficient',
    'enger raum', 'tank', 'silo', 'schacht', 'sauerstoffmangel', // German
    'besloten ruimte', 'tank', 'silo', 'put', 'zuurstoftekort' // Dutch
  ]
}

// Severity detection keywords (multilingual: EN, DE, NL)
const SEVERITY_KEYWORDS = {
  critical: [
    'death', 'fatal', 'fatality', 'killed', 'dies', 'deceased',
    'tod', 'tödlich', 'gestorben', 'todesfall', // German
    'dood', 'dodelijk', 'overleden', 'fataal' // Dutch
  ],
  high: [
    'serious', 'severe', 'amputation', 'hospitalized', 'hospitalization', 'life-threatening', 'critical condition',
    'schwer', 'schwerverletzt', 'amputation', 'krankenhaus', 'lebensgefahr', // German
    'ernstig', 'zwaargewond', 'amputatie', 'ziekenhuis', 'levensgevaar' // Dutch
  ],
  medium: [
    'injury', 'injured', 'citation', 'violation', 'fine', 'penalty',
    'verletzung', 'verletzt', 'verstoß', 'strafe', 'bußgeld', // German
    'letsel', 'gewond', 'overtreding', 'boete' // Dutch
  ],
  low: [
    'near-miss', 'warning', 'advisory', 'reminder', 'update',
    'beinahe-unfall', 'warnung', 'hinweis', // German
    'bijna-ongeval', 'waarschuwing', 'advies' // Dutch
  ]
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
 * Returns lessons in the language of the source feed
 */
function extractLessons(text, feedConfig) {
  const lessons = []
  const lowerText = text.toLowerCase()
  const country = feedConfig?.country || 'US'

  // Lesson templates by language
  const lessonsByLang = {
    DE: {
      fall: ['Absturzsicherung überprüfen und sicherstellen', 'Leitern und Gerüste regelmäßig inspizieren'],
      machine: ['Lockout/Tagout-Verfahren vor Wartungsarbeiten durchführen', 'Ordnungsgemäße Maschinenschutzvorrichtungen installieren'],
      vehicle: ['Fußgängerwege klar markieren', 'Bei Fahrzeugbewegungen Einweiser einsetzen'],
      chemical: ['Geeignete PSA bereitstellen und deren Verwendung sicherstellen', 'Für ausreichende Belüftung sorgen'],
      electric: ['Anlagen vor Arbeiten spannungsfrei schalten', 'Sicherheitsabstände zu Stromquellen einhalten'],
      generic: ['Sicherheitsverfahren regelmäßig überprüfen', 'Alle Mitarbeiter in Arbeitssicherheit schulen', 'Gefährdungsbeurteilungen durchführen']
    },
    AT: {
      fall: ['Absturzsicherung gemäß ASchG überprüfen', 'Leitern und Gerüste regelmäßig kontrollieren'],
      machine: ['LOTO-Verfahren vor Instandhaltung durchführen', 'Schutzeinrichtungen an Maschinen prüfen'],
      vehicle: ['Verkehrswege für Fußgänger kennzeichnen', 'Einweiser bei Fahrzeugbewegungen einsetzen'],
      chemical: ['PSA gemäß AM-VO bereitstellen', 'Ausreichende Lüftung sicherstellen'],
      electric: ['Freischaltung vor Arbeiten durchführen', 'Sicherheitsabstände einhalten'],
      generic: ['Sicherheitsmaßnahmen regelmäßig überprüfen', 'Schulungen gemäß ASchG durchführen', 'Gefährdungsbeurteilung aktualisieren']
    },
    NL: {
      fall: ['Valbeveiliging controleren en garanderen', 'Ladders en steigers regelmatig inspecteren'],
      machine: ['Lockout/tagout procedures voor onderhoud toepassen', 'Juiste machineafschermingen installeren'],
      vehicle: ['Loopwegen duidelijk markeren', 'Verkeersregelaars inzetten bij voertuigbewegingen'],
      chemical: ['Geschikte PBM beschikbaar stellen en gebruik waarborgen', 'Voor voldoende ventilatie zorgen'],
      electric: ['Installaties spanningsloos maken voor werkzaamheden', 'Veilige afstanden tot stroombronnen aanhouden'],
      generic: ['Veiligheidsprocedures regelmatig evalueren', 'Alle medewerkers trainen in arbeidsveiligheid', 'Risico-inventarisatie uitvoeren']
    },
    EN: {
      fall: ['Ensure proper fall protection systems are in place', 'Conduct regular inspections of ladders and scaffolds'],
      machine: ['Implement lockout/tagout procedures before maintenance', 'Install proper machine guarding'],
      vehicle: ['Establish designated pedestrian walkways', 'Use spotters for vehicle operations in work areas'],
      chemical: ['Ensure proper PPE is available and used', 'Maintain adequate ventilation in work areas'],
      electric: ['De-energize equipment before work begins', 'Maintain safe distances from power sources'],
      generic: ['Review and update safety procedures regularly', 'Ensure all workers receive proper safety training', 'Conduct regular workplace hazard assessments']
    }
  }

  // Use appropriate language lessons (default to English for EU and US)
  const lang = ['DE', 'AT'].includes(country) ? (country === 'AT' ? 'AT' : 'DE') :
               country === 'NL' ? 'NL' : 'EN'
  const langLessons = lessonsByLang[lang] || lessonsByLang.EN

  // Match by incident type
  if (lowerText.includes('fall') || lowerText.includes('height') || lowerText.includes('absturz') || lowerText.includes('val')) {
    lessons.push(...langLessons.fall)
  }
  if (lowerText.includes('machine') || lowerText.includes('equipment') || lowerText.includes('maschine') || lowerText.includes('machine')) {
    lessons.push(...langLessons.machine)
  }
  if (lowerText.includes('struck') || lowerText.includes('vehicle') || lowerText.includes('fahrzeug') || lowerText.includes('voertuig')) {
    lessons.push(...langLessons.vehicle)
  }
  if (lowerText.includes('chemical') || lowerText.includes('exposure') || lowerText.includes('chemikalie') || lowerText.includes('chemisch')) {
    lessons.push(...langLessons.chemical)
  }
  if (lowerText.includes('electric') || lowerText.includes('strom') || lowerText.includes('elektrisch')) {
    lessons.push(...langLessons.electric)
  }

  // Generic lessons if none specific
  if (lessons.length === 0) {
    lessons.push(...langLessons.generic)
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
      lessons: extractLessons(fullText, feedConfig),
      relatedRegulations: [], // Could be enhanced with regulation detection
      logistics_relevance: severity === 'critical' ? 'critical' : 'high',
      isRealIncident: true
    })
  })

  return alerts
}

/**
 * Parse rss2json.com API response into alerts
 */
function parseRss2JsonResponse(data, feedConfig) {
  if (data.status !== 'ok' || !data.items || !Array.isArray(data.items)) {
    return []
  }

  const alerts = []

  data.items.forEach((item, index) => {
    const title = item.title || ''
    const description = item.description || item.content || ''

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
    if (item.pubDate) {
      try {
        date = new Date(item.pubDate).toISOString().split('T')[0]
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
      sourceUrl: item.link || '',
      date,
      severity,
      category,
      lessons: extractLessons(fullText, feedConfig),
      relatedRegulations: [],
      logistics_relevance: severity === 'critical' ? 'critical' : 'high',
      isRealIncident: true
    })
  })

  return alerts
}

/**
 * Fetch RSS feed using rss2json.com API (primary method)
 */
async function fetchWithRss2Json(url, feedConfig) {
  const response = await fetch(RSS2JSON_API + encodeURIComponent(url))

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (data.status !== 'ok') {
    throw new Error(data.message || 'API returned error status')
  }

  return parseRss2JsonResponse(data, feedConfig)
}

/**
 * Check if content looks like valid XML/RSS
 */
function isValidXml(content) {
  if (!content || typeof content !== 'string') return false
  const trimmed = content.trim()
  return trimmed.startsWith('<?xml') ||
         trimmed.startsWith('<rss') ||
         trimmed.startsWith('<feed') ||
         trimmed.startsWith('<RDF')
}

/**
 * Fetch RSS feed with CORS proxy fallbacks (secondary method)
 */
async function fetchWithProxy(url) {
  const errors = []

  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxy.prefix + encodeURIComponent(url), {
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      })

      if (!response.ok) {
        errors.push(`${proxy.prefix}: HTTP ${response.status}`)
        continue
      }

      let content
      if (proxy.isJson) {
        const json = await response.json()
        content = json.contents
      } else {
        content = await response.text()
      }

      if (!isValidXml(content)) {
        errors.push(`${proxy.prefix}: Received HTML instead of XML`)
        continue
      }

      return content
    } catch (error) {
      errors.push(`${proxy.prefix}: ${error.message}`)
    }
  }

  throw new Error(`All CORS proxies failed: ${errors.join('; ')}`)
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
 * Fetch a single feed using rss2json first, then CORS proxies as fallback
 */
async function fetchSingleFeed(feedId, feedConfig) {
  // Try rss2json.com first (most reliable)
  try {
    const alerts = await fetchWithRss2Json(feedConfig.url, feedConfig)
    if (alerts.length > 0) {
      return alerts
    }
  } catch {
    // rss2json failed, try CORS proxies
  }

  // Fallback to CORS proxies
  try {
    const xmlText = await fetchWithProxy(feedConfig.url)
    return parseRssXml(xmlText, feedConfig)
  } catch {
    // CORS proxies failed, will use sample data
  }

  return []
}

/**
 * Fetch safety alerts from RSS feeds
 * Falls back to sample data if feeds are unavailable
 */
export async function fetchSafetyAlerts() {
  // Check cache first
  const cached = getCachedAlerts()
  if (cached && cached.length > 0) {
    return { alerts: cached, fromCache: true }
  }

  const allAlerts = []

  // Fetch from each feed (in parallel for speed)
  const feedPromises = Object.entries(RSS_FEEDS).map(([feedId, feedConfig]) =>
    fetchSingleFeed(feedId, feedConfig)
  )

  const results = await Promise.allSettled(feedPromises)

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allAlerts.push(...result.value)
    }
  })

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

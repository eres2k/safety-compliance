const FRAMEWORK_CONTEXT = {
  AT: 'Austrian ASchG (ArbeitnehmerInnenschutzgesetz)',
  DE: 'German DGUV and ArbSchG (Arbeitsschutzgesetz)',
  NL: 'Dutch Arbowet (Arbeidsomstandighedenwet)'
}

// Map framework (jurisdiction) to the language for law content
// Used to ensure law summaries are generated in the law's native language
const FRAMEWORK_TO_LANGUAGE = {
  AT: 'de',  // Austrian laws should be summarized in German
  DE: 'de',  // German laws should be summarized in German
  NL: 'nl'   // Dutch laws should be summarized in Dutch
}

const LANGUAGE_CONTEXT = {
  en: 'Respond in English.',
  de: 'Antworten Sie auf Deutsch. Alle Ausgaben müssen auf Deutsch sein.',
  nl: 'Antwoord in het Nederlands. Alle output moet in het Nederlands zijn.'
}

// Supplementary document context for AI recommendations
// These are PDF-only technical rules and guidelines that complement the main laws
const SUPPLEMENTARY_DOCS_CONTEXT = {
  AT: {
    description: 'Austrian supplementary documents (AUVA Merkblätter, Arbeitsinspektorat guides)',
    documents: [
      { abbr: 'AUVA M.plus 012', topic: 'summer heat prevention', keywords: ['heat', 'temperature', 'climate'] },
      { abbr: 'AUVA M.plus 019', topic: 'noise regulations', keywords: ['noise', 'hearing', 'dB', 'decibel'] },
      { abbr: 'AUVA M.plus 022', topic: 'telework/remote work', keywords: ['telework', 'home office', 'remote'] },
      { abbr: 'AUVA M.plus 040', topic: 'workplace evaluation', keywords: ['evaluation', 'risk assessment', 'hazard'] },
      { abbr: 'AUVA M.plus 070', topic: 'display screen workstations', keywords: ['screen', 'VDU', 'computer', 'ergonomics'] },
      { abbr: 'AUVA M.plus 301', topic: 'safety representatives', keywords: ['SVP', 'safety rep', 'representative'] },
      { abbr: 'AUVA M.plus 302', topic: 'safety organization', keywords: ['organization', 'management', 'structure'] },
      { abbr: 'AUVA M.plus 330', topic: 'employee instruction/training', keywords: ['training', 'instruction', 'unterweisung'] },
      { abbr: 'AUVA M.plus 361', topic: 'fire protection', keywords: ['fire', 'brand', 'extinguisher'] },
      { abbr: 'AUVA M.plus 369', topic: 'explosion protection', keywords: ['explosion', 'ATEX', 'flammable'] },
      { abbr: 'AUVA M.plus 700', topic: 'hazardous substances', keywords: ['chemical', 'substance', 'hazardous'] },
      { abbr: 'AUVA M 030', topic: 'maintenance safety', keywords: ['maintenance', 'repair', 'lockout'] },
      { abbr: 'AUVA M 041', topic: 'first aid', keywords: ['first aid', 'emergency', 'erste hilfe'] },
      { abbr: 'AUVA M 080', topic: 'PPE/personal protective equipment', keywords: ['PPE', 'protective', 'equipment', 'PSA'] },
      { abbr: 'AUVA M 105', topic: 'machine safety', keywords: ['machine', 'equipment', 'guard'] },
      { abbr: 'AUVA M 364', topic: 'electrical safety', keywords: ['electrical', 'electric', 'voltage'] },
      { abbr: 'AUVA M 391', topic: 'ladders and steps', keywords: ['ladder', 'step', 'leiter'] },
      { abbr: 'AUVA M 480', topic: 'forklift safety', keywords: ['forklift', 'hubstapler', 'PIT', 'truck'] },
      { abbr: 'AUVA M 705', topic: 'hazardous substances', keywords: ['chemical', 'toxic', 'gefahrstoff'] },
      { abbr: 'AUVA M 830', topic: 'fall protection', keywords: ['fall', 'absturz', 'height', 'harness'] },
      { abbr: 'AUVA E 13', topic: 'psychological stress evaluation', keywords: ['stress', 'mental', 'psychological', 'psychisch'] },
      { abbr: 'AI Arbeitsstätten', topic: 'workplace facility design', keywords: ['facility', 'workplace', 'design', 'layout'] },
      { abbr: 'AI Brandalarm', topic: 'fire alarm and evacuation drills', keywords: ['fire alarm', 'evacuation', 'drill', 'räumung'] },
      { abbr: 'AI Lärm', topic: 'workplace noise hazards', keywords: ['noise', 'lärm', 'hearing'] }
    ]
  },
  DE: {
    description: 'German technical rules (ASR, DGUV Vorschrift, DGUV Information, TRBS, TRGS)',
    documents: [
      { abbr: 'DGUV Vorschrift 1', topic: 'prevention principles/fundamentals', keywords: ['prevention', 'prävention', 'grundsätze', 'unterweisung', 'training', 'gefährdungsbeurteilung', 'risk assessment', 'pflichten', 'duties', 'employer', 'employee'] },
      { abbr: 'DGUV Vorschrift 2', topic: 'occupational physicians and safety specialists', keywords: ['betriebsarzt', 'physician', 'fachkraft', 'sifa', 'arbeitssicherheit', 'occupational health', 'arbeitsmedizin'] },
      { abbr: 'DGUV Vorschrift 3', topic: 'electrical installations and equipment', keywords: ['electrical', 'elektrisch', 'strom', 'voltage', 'installation', 'betriebsmittel', 'prüfung'] },
      { abbr: 'DGUV Vorschrift 52', topic: 'cranes', keywords: ['crane', 'kran', 'hoist', 'lifting', 'hebezug', 'lastaufnahme'] },
      { abbr: 'DGUV Vorschrift 54', topic: 'winches, lifting and pulling devices', keywords: ['winch', 'winde', 'hub', 'zug', 'seil', 'pulling', 'lifting device'] },
      { abbr: 'DGUV Vorschrift 68', topic: 'industrial trucks/forklifts', keywords: ['forklift', 'stapler', 'flurförderzeug', 'gabelstapler', 'pallet jack', 'industrial truck', 'PIT'] },
      { abbr: 'DGUV Vorschrift 70', topic: 'vehicles', keywords: ['vehicle', 'fahrzeug', 'transport', 'lkw', 'truck', 'loading', 'ladung'] },
      { abbr: 'ASR V3', topic: 'risk assessment', keywords: ['risk', 'gefährdungsbeurteilung', 'assessment'] },
      { abbr: 'ASR V3a.2', topic: 'accessible workplace design', keywords: ['accessibility', 'disability', 'barrier-free'] },
      { abbr: 'ASR A1.2', topic: 'room dimensions and floor space', keywords: ['space', 'dimension', 'room', 'floor'] },
      { abbr: 'ASR A1.3', topic: 'safety signage', keywords: ['sign', 'signage', 'marking', 'kennzeichnung'] },
      { abbr: 'ASR A1.8', topic: 'traffic routes', keywords: ['traffic', 'route', 'walkway', 'verkehrsweg'] },
      { abbr: 'ASR A2.1', topic: 'fall protection', keywords: ['fall', 'absturz', 'height', 'railing'] },
      { abbr: 'ASR A2.2', topic: 'fire prevention', keywords: ['fire', 'brand', 'extinguisher', 'prevention'] },
      { abbr: 'ASR A3.4', topic: 'workplace lighting', keywords: ['light', 'lighting', 'beleuchtung', 'lux'] },
      { abbr: 'ASR A3.5', topic: 'room temperature', keywords: ['temperature', 'heat', 'cold', 'climate'] },
      { abbr: 'DGUV 212-016', topic: 'warning clothing/high-vis', keywords: ['high-vis', 'visibility', 'warnkleidung', 'reflective'] },
      { abbr: 'DGUV 207-019', topic: 'health service safety', keywords: ['health', 'medical', 'gesundheitsdienst'] },
      { abbr: 'DGUV 209-030', topic: 'press inspection', keywords: ['press', 'machine', 'inspection', 'prüfung'] }
    ]
  },
  NL: {
    description: 'Dutch arbocatalogi, PGS guidelines, STL transport/warehouse guides, TNO research',
    documents: [
      { abbr: 'STL Warehouse', topic: 'warehouse/distribution center safety', keywords: ['warehouse', 'magazijn', 'distribution', 'storage'] },
      { abbr: 'STL Transport Logistiek', topic: 'transport and logistics safety', keywords: ['transport', 'logistics', 'delivery', 'driver'] },
      { abbr: 'STL Verticaal Transport', topic: 'vertical transport/cranes', keywords: ['crane', 'hoist', 'lifting', 'verticaal'] },
      { abbr: 'STL Onderhoudswerkplaats', topic: 'maintenance workshop safety', keywords: ['maintenance', 'workshop', 'onderhoud', 'repair'] },
      { abbr: 'PGS 15', topic: 'hazardous substance storage', keywords: ['hazardous', 'storage', 'chemical', 'gevaarlijke stoffen'] },
      { abbr: 'PGS 30.3', topic: 'hazardous liquid storage', keywords: ['liquid', 'flammable', 'vloeistof'] },
      { abbr: 'TNO Wegwijzer', topic: 'physical workload guide', keywords: ['lifting', 'carrying', 'pushing', 'pulling', 'ergonomics'] },
      { abbr: 'TNO Factsheet 2023', topic: 'physical workload statistics', keywords: ['workload', 'statistics', 'research'] },
      { abbr: 'Arbocatalogus Transport Warehouse', topic: 'transport and warehouse standards', keywords: ['transport', 'warehouse', 'logistics'] },
      { abbr: 'Arbocatalogus Kantoor', topic: 'office environment safety', keywords: ['office', 'kantoor', 'desk', 'VDU'] },
      { abbr: 'Volandis Ladders Trappen', topic: 'ladder and stair safety', keywords: ['ladder', 'stair', 'trap', 'leider'] },
      { abbr: 'Volandis Lichamelijke Belasting', topic: 'physical workload in construction', keywords: ['physical', 'lifting', 'ergonomics'] },
      { abbr: 'Volandis Geluid Trillingen', topic: 'noise and vibration', keywords: ['noise', 'vibration', 'geluid', 'trilling'] },
      { abbr: 'Volandis Rolsteigers', topic: 'mobile scaffolding', keywords: ['scaffolding', 'steiger', 'mobile'] }
    ]
  }
}

/**
 * Get relevant supplementary document recommendations based on topic keywords
 * @param {string} framework - The jurisdiction (AT, DE, NL)
 * @param {string} topic - The topic being discussed
 * @returns {string[]} - Array of relevant document abbreviations
 */
function getRelevantSupplementaryDocs(framework, topic) {
  const docs = SUPPLEMENTARY_DOCS_CONTEXT[framework]?.documents || []
  if (!topic || docs.length === 0) return []

  const topicLower = topic.toLowerCase()
  const matches = []

  for (const doc of docs) {
    // Check if any keyword matches the topic
    const keywordMatch = doc.keywords.some(kw => topicLower.includes(kw.toLowerCase()))
    const topicMatch = topicLower.includes(doc.topic.toLowerCase())

    if (keywordMatch || topicMatch) {
      matches.push(doc.abbr)
    }
  }

  return matches.slice(0, 5) // Return top 5 matches
}

/**
 * Build supplementary document context for AI prompts
 * @param {string} framework - The jurisdiction (AT, DE, NL)
 * @param {string} topic - Optional topic to filter recommendations
 * @returns {string} - Formatted string for AI prompt
 */
function buildSupplementaryDocContext(framework, topic = null) {
  const context = SUPPLEMENTARY_DOCS_CONTEXT[framework]
  if (!context) return ''

  let docList = context.documents.map(d => `- ${d.abbr}: ${d.topic}`).join('\n')

  // If topic provided, highlight relevant docs
  if (topic) {
    const relevant = getRelevantSupplementaryDocs(framework, topic)
    if (relevant.length > 0) {
      return `
SUPPLEMENTARY DOCUMENTS AVAILABLE (${context.description}):
Most relevant for this topic:
${relevant.map(abbr => {
  const doc = context.documents.find(d => d.abbr === abbr)
  return `★ ${abbr}: ${doc?.topic || ''}`
}).join('\n')}

Other available documents:
${context.documents.filter(d => !relevant.includes(d.abbr)).slice(0, 10).map(d => `- ${d.abbr}: ${d.topic}`).join('\n')}

IMPORTANT: When relevant, recommend specific supplementary documents by their abbreviation (e.g., "For detailed guidance, refer to ${relevant[0] || 'AUVA M.plus 040'}").`
    }
  }

  return `
SUPPLEMENTARY DOCUMENTS AVAILABLE (${context.description}):
${docList}

IMPORTANT: When relevant to the topic, recommend specific supplementary documents by their abbreviation for additional practical guidance.`
}

/**
 * Get the appropriate output language for law-related content.
 * For law summaries, use the law's native language (based on framework/jurisdiction).
 * This ensures Austrian laws are summarized in German, Dutch laws in Dutch, etc.
 *
 * @param {string} framework - The jurisdiction (AT, DE, NL)
 * @param {string} userLanguage - The user's preferred language (fallback)
 * @returns {string} The language code to use for AI output
 */
function getLawOutputLanguage(framework, userLanguage) {
  // For law content, prefer the framework's native language
  if (framework && FRAMEWORK_TO_LANGUAGE[framework]) {
    return FRAMEWORK_TO_LANGUAGE[framework]
  }
  // Fallback to user's language preference
  return userLanguage || 'en'
}

// Language-specific labels for AI output formatting
const LANGUAGE_LABELS = {
  en: {
    whatThisSectionCovers: 'What this section covers',
    keyRequirements: 'Key requirements from this text',
    complianceRelevance: 'Compliance relevance',
    documentationActions: 'Documentation/Actions',
    noRequirements: 'This section covers [scope/definitions/exceptions/etc.] - no direct compliance requirements',
    noDocumentation: 'No specific documentation requirements in this section'
  },
  de: {
    whatThisSectionCovers: 'Was dieser Abschnitt behandelt',
    keyRequirements: 'Wichtige Anforderungen aus diesem Text',
    complianceRelevance: 'Relevanz für Compliance',
    documentationActions: 'Dokumentation/Maßnahmen',
    noRequirements: 'Dieser Abschnitt behandelt [Geltungsbereich/Definitionen/Ausnahmen/etc.] - keine direkten Compliance-Anforderungen',
    noDocumentation: 'Keine spezifischen Dokumentationsanforderungen in diesem Abschnitt'
  },
  nl: {
    whatThisSectionCovers: 'Wat dit artikel behandelt',
    keyRequirements: 'Belangrijke vereisten uit deze tekst',
    complianceRelevance: 'Relevantie voor compliance',
    documentationActions: 'Documentatie/Acties',
    noRequirements: 'Dit artikel behandelt [toepassingsgebied/definities/uitzonderingen/etc.] - geen directe compliance-vereisten',
    noDocumentation: 'Geen specifieke documentatievereisten in dit artikel'
  }
}

// ============================================
// AI Response Cache - Reduces token usage
// ============================================
// Increment CACHE_VERSION when cache format changes to invalidate old entries
// v4: Changed to use user's language setting from site preferences
// v5: Invalidated old cache to fix stale responses issue (2025-12-19)
const CACHE_VERSION = 'v5_'
const CACHE_PREFIX = 'ai_cache_' + CACHE_VERSION
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours (reduced from 24)

// Clean up old version cache entries on module load
try {
  const oldKeys = Object.keys(localStorage).filter(k =>
    k.startsWith('ai_cache_') && !k.startsWith(CACHE_PREFIX)
  )
  oldKeys.forEach(k => localStorage.removeItem(k))
} catch {
  // Ignore errors during cleanup
}

// Simple hash function (djb2) for consistent cache keys
function simpleHash(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

function generateCacheKey(type, ...args) {
  // Build a unique identifier from all args
  // For simplify_both: [lawText, sectionTitle, framework, language]
  // Use framework + language + full sectionTitle + hash of lawText for uniqueness
  const reorderedArgs = args.length >= 4
    ? [args[2], args[3], args[1], simpleHash(args[0] || '')] // framework, language, title, hash(lawText)
    : args
  const keyParts = reorderedArgs.join('|')
  // Use hash of the full key parts + prefix of sectionTitle for readability
  const hash = simpleHash(keyParts)
  const sectionTitle = args.length >= 4 ? args[1] : ''
  const readablePart = sectionTitle.substring(0, 30).replace(/[^a-zA-Z0-9§]/g, '_')
  return `${CACHE_PREFIX}${type}_${readablePart}_${hash}`
}

function getCachedResponse(cacheKey) {
  try {
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const { response, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey)
      return null
    }
    return response
  } catch {
    return null
  }
}

function setCachedResponse(cacheKey, response) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      response,
      timestamp: Date.now()
    }))
  } catch (e) {
    // localStorage might be full, clear old cache entries
    clearOldCache()
  }
}

function clearOldCache() {
  try {
    // Also remove old version cache entries (ai_cache_ without current version)
    const allCacheKeys = Object.keys(localStorage).filter(k => k.startsWith('ai_cache_'))
    allCacheKeys.forEach(k => {
      if (!k.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(k) // Remove old version entries
      }
    })

    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
    // Remove oldest half of cache entries
    const entries = keys.map(k => {
      try {
        const { timestamp } = JSON.parse(localStorage.getItem(k))
        return { key: k, timestamp }
      } catch {
        return { key: k, timestamp: 0 }
      }
    }).sort((a, b) => a.timestamp - b.timestamp)

    entries.slice(0, Math.ceil(entries.length / 2)).forEach(e => {
      localStorage.removeItem(e.key)
    })
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Clear all AI response cache entries (both old and current versions)
 * Call this to force fresh AI responses
 * @returns {number} Number of cache entries removed
 */
export function clearAllAICache() {
  try {
    const allCacheKeys = Object.keys(localStorage).filter(k => k.startsWith('ai_cache_'))
    const count = allCacheKeys.length
    allCacheKeys.forEach(k => localStorage.removeItem(k))
    console.log(`[AI Cache] Cleared ${count} cached AI responses`)
    return count
  } catch (e) {
    console.error('[AI Cache] Error clearing cache:', e)
    return 0
  }
}

function buildSystemPrompt(framework, language, topic = null) {
  const supplementaryContext = buildSupplementaryDocContext(framework, topic)
  return `You are a WHS legal expert for ${FRAMEWORK_CONTEXT[framework]}.
Cite specific paragraphs. Be practical and concise.
${LANGUAGE_CONTEXT[language]}
${supplementaryContext}`
}

// Helper function to normalize escaped newlines in AI responses
// This fixes issues where AI returns literal \n instead of actual newlines
export function normalizeNewlines(text) {
  if (!text || typeof text !== 'string') return text
  // Replace escaped newlines with actual newlines
  return text.replace(/\\n/g, '\n')
}

// Helper function to clean and parse JSON from AI responses
function cleanAndParseJSON(response) {
  if (!response) return null

  let cleanedResponse = response.trim()

  // Remove markdown code blocks if present
  // Handle ```json ... ``` or ``` ... ```
  const jsonBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    cleanedResponse = jsonBlockMatch[1].trim()
  }

  // Try to find JSON object or array in the response
  const jsonMatch = cleanedResponse.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (jsonMatch) {
    cleanedResponse = jsonMatch[1]
  }

  try {
    return JSON.parse(cleanedResponse)
  } catch (e) {
    console.warn('Failed to parse AI response as JSON:', e.message)
    // Return the cleaned string if parsing fails
    return cleanedResponse
  }
}

// Format parsed JSON back to a readable string for display
function formatJSONForDisplay(data) {
  if (typeof data === 'string') return data

  try {
    return JSON.stringify(data, null, 2)
  } catch (e) {
    return String(data)
  }
}

// ============================================
// Rate Limiter for Content Generation
// Using 120 second delay between requests
// Can be bypassed with password unlock
// Persists across page reloads via localStorage
// ============================================
const RATE_LIMIT_MS = 120 * 1000 // 120 seconds
const MAX_CONCURRENT_REQUESTS = 5 // Allow up to 5 concurrent requests
const LAST_REQUEST_STORAGE_KEY = 'ai_last_request_time'

// Load lastRequestTime from localStorage to persist across page reloads
function getLastRequestTime() {
  try {
    const stored = localStorage.getItem(LAST_REQUEST_STORAGE_KEY)
    return stored ? parseInt(stored, 10) : 0
  } catch {
    return 0
  }
}

function setLastRequestTime(time) {
  try {
    localStorage.setItem(LAST_REQUEST_STORAGE_KEY, time.toString())
  } catch {
    // localStorage not available
  }
}

let lastRequestTime = getLastRequestTime()
let activeRequests = 0
let requestQueue = Promise.resolve()

// ============================================
// Unlock State Management
// Allows bypassing the 120s rate limit
// ============================================
const UNLOCK_STORAGE_KEY = 'ai_rate_limit_unlocked'

/**
 * Check if the rate limit is currently unlocked
 * @returns {boolean}
 */
export function isRateLimitUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Set the unlock state
 * @param {boolean} unlocked
 */
function setUnlockState(unlocked) {
  try {
    if (unlocked) {
      sessionStorage.setItem(UNLOCK_STORAGE_KEY, 'true')
    } else {
      sessionStorage.removeItem(UNLOCK_STORAGE_KEY)
    }
  } catch {
    // sessionStorage not available
  }
}

/**
 * Verify password with the server and unlock rate limit if valid
 * @param {string} password
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function verifyUnlockPassword(password) {
  try {
    const response = await fetch('/.netlify/functions/verify-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })

    const data = await response.json()

    if (data.success) {
      setUnlockState(true)
      // Reset the last request time so user doesn't have to wait
      lastRequestTime = 0
      setLastRequestTime(0)
    }

    return data
  } catch (error) {
    return {
      success: false,
      message: 'Failed to verify password'
    }
  }
}

/**
 * Lock the rate limit again (re-enable 120s delay)
 */
export function lockRateLimit() {
  setUnlockState(false)
}

/**
 * Enforces a global rate limit on API requests.
 * Returns a promise that resolves when it's safe to make the next request.
 * Skips the 120s delay if rate limit is unlocked.
 */
async function waitForRateLimit() {
  // Wait if we've hit max concurrent requests
  while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Skip the 120s delay if unlocked
  if (isRateLimitUnlocked()) {
    console.log('[Rate Limit] Unlocked - skipping delay')
    const now = Date.now()
    lastRequestTime = now
    setLastRequestTime(now)
    activeRequests++
    return
  }

  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  const waitTime = Math.max(0, RATE_LIMIT_MS - timeSinceLastRequest)

  if (waitTime > 0) {
    console.log(`[Rate Limit] Waiting ${(waitTime / 1000).toFixed(1)}s before next request...`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  const requestTime = Date.now()
  lastRequestTime = requestTime
  setLastRequestTime(requestTime)
  activeRequests++
}

/**
 * Mark a request as completed (decrement active count)
 */
function requestCompleted() {
  activeRequests = Math.max(0, activeRequests - 1)
}

/**
 * Queue requests with rate limiting - allows concurrent execution up to MAX_CONCURRENT_REQUESTS
 */
function queueRequest(requestFn) {
  requestQueue = requestQueue.then(async () => {
    await waitForRateLimit()
    try {
      return await requestFn()
    } finally {
      requestCompleted()
    }
  }).catch(err => {
    requestCompleted()
    console.error('[Rate Limit] Request failed:', err.message)
    throw err
  })
  return requestQueue
}

/**
 * Execute multiple requests in parallel with rate limiting
 * @param {Array<Function>} requestFns - Array of async functions to execute
 * @returns {Promise<Array>} - Results of all requests
 */
export async function executeParallel(requestFns) {
  const results = await Promise.allSettled(
    requestFns.map(fn => queueRequest(fn))
  )
  return results.map(r => r.status === 'fulfilled' ? r.value : null)
}

/**
 * Get the current rate limit status
 * @returns {object} { isLimited: boolean, remainingSeconds: number, activeRequests: number, isUnlocked: boolean }
 */
export function getRateLimitStatus() {
  const unlocked = isRateLimitUnlocked()
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  const remainingMs = Math.max(0, RATE_LIMIT_MS - timeSinceLastRequest)

  // When unlocked, only concurrent request limit applies (no 120s timer)
  const isLimited = unlocked
    ? activeRequests >= MAX_CONCURRENT_REQUESTS
    : remainingMs > 0 || activeRequests >= MAX_CONCURRENT_REQUESTS

  return {
    isLimited,
    isUnlocked: unlocked,
    remainingSeconds: unlocked ? 0 : Math.ceil(remainingMs / 1000),
    rateLimitSeconds: RATE_LIMIT_MS / 1000,
    activeRequests,
    maxConcurrent: MAX_CONCURRENT_REQUESTS
  }
}

// Retry helper for transient failures with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options)

      // Retry on transient server errors:
      // - 429: Rate Limited
      // - 503: Service Unavailable
      // - 504: Gateway Timeout (upstream server didn't respond in time)
      const isRetryableStatus = response.status === 429 || response.status === 503 || response.status === 504
      if (isRetryableStatus && i < maxRetries) {
        const delay = Math.pow(2, i) * 1000 // Exponential backoff: 1s, 2s, 4s
        console.log(`[AI Service] Retrying after ${response.status} error (attempt ${i + 1}/${maxRetries}, waiting ${delay}ms)`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }

      return response
    } catch (error) {
      if (i < maxRetries) {
        const delay = Math.pow(2, i) * 1000 // Exponential backoff: 1s, 2s, 4s
        console.log(`[AI Service] Retrying after network error (attempt ${i + 1}/${maxRetries}, waiting ${delay}ms)`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw error
    }
  }
}

export async function generateAIResponse(prompt, framework, language, topic = null) {
  // Use rate-limited queue for all AI requests
  return queueRequest(async () => {
    const response = await fetchWithRetry('/.netlify/functions/ai-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        systemPrompt: buildSystemPrompt(framework, language, topic)
      })
    })

    if (!response.ok) {
      let errorMessage = 'AI request failed'
      let errorDetails = ''
      try {
        const error = await response.json()
        errorMessage = error.message || 'AI service error'
        errorDetails = error.details || ''

        // Log detailed error for debugging
        console.error('[AI Service] Error response:', {
          status: response.status,
          message: errorMessage,
          details: errorDetails,
          model: error.model
        })
      } catch {
        errorMessage = `AI service error (HTTP ${response.status})`
      }

      // Create user-friendly error with details
      const fullError = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage
      throw new Error(fullError)
    }

    const data = await response.json()

    // Log successful response info
    if (data.model) {
      console.log('[AI Service] Response from model:', data.model, data.cached ? '(cached)' : '')
    }

    return data.response
  })
}

export async function explainSection(section, framework, language) {
  const sectionTitle = section.paragraph || section.title || ''
  const prompt = `Explain this legal provision in simple terms.

${sectionTitle}
${section.content}

Format your response as readable text with these sections:

📖 SUMMARY
A brief plain language summary of what this provision means.

🔑 KEY POINTS
- List the main points

👔 EMPLOYER DUTIES
- What employers must do

👷 EMPLOYEE RIGHTS
- What employees can expect

💡 PRACTICAL TIPS
- Actionable advice for implementation

📚 RELATED RESOURCES
- If relevant, recommend a supplementary document (AUVA/DGUV/ASR/STL/PGS) for additional practical guidance on this topic

Be concise and use simple language.`

  const response = await generateAIResponse(prompt, framework, language, sectionTitle)
  return normalizeNewlines(response)
}

// Station type specific context for enhanced prompts
const STATION_TYPE_CONTEXT = {
  DS: 'Delivery Station (DS) - package sortation, driver dispatch, last-mile delivery operations',
  SC: 'Sort Center (SC) - large-scale package sorting, conveyor systems, high-volume operations',
  FLEX: 'Flex Station - flexible delivery operations with independent contractors',
  SSD: 'Sub Same Day (SSD) - ultra-fast delivery operations with high pace requirements',
  RURAL: 'Rural Delivery Station - remote operations with extended driving routes'
}

export async function checkCompliance(companySize, industry, topic, framework, language, stationType, stationLabel) {
  const stationContext = STATION_TYPE_CONTEXT[stationType] || 'Delivery Station'

  const prompt = `You are a workplace health and safety expert specializing in Amazon delivery logistics operations in Europe.

Provide a comprehensive compliance checklist for an Amazon ${stationLabel || stationType} (${stationContext}) with ${companySize} employees regarding "${topic}".

IMPORTANT CONTEXT:
- This is an Amazon Last Mile Logistics facility
- Station Type: ${stationLabel || stationType}
- Focus on practical, actionable requirements specific to delivery station operations
- Consider common activities: package handling, van loading/unloading, sortation, driver briefings, PIT operations

Format your response as readable text with these sections:

📋 REQUIREMENTS
- List each requirement with its legal citation (e.g., "§ X.Y")
- Include brief description of what's required
- Highlight requirements specific to ${stationLabel || stationType} operations

🏢 STATION-SPECIFIC CONSIDERATIONS
- List requirements specific to ${stationLabel || stationType} type operations
- Consider peak season implications if relevant
- Include driver and associate-specific requirements

📄 REQUIRED DOCUMENTATION
- List all documents that must be maintained
- Include inspection logs, training records, risk assessments

👥 PERSONNEL REQUIREMENTS
- List any required safety roles or certifications
- Include PIT operator certifications if relevant
- Safety representatives, first aiders, fire wardens

⏰ DEADLINES & FREQUENCIES
- List recurring tasks and their frequencies
- Training renewals, equipment inspections, audits

⚠️ PRIORITIES & RISK LEVELS
- HIGH PRIORITY: Immediate safety requirements
- MEDIUM PRIORITY: Standard compliance items
- LOW PRIORITY: Best practice recommendations

⚠️ PENALTIES FOR NON-COMPLIANCE
- List potential consequences
- Include fine ranges where applicable

✅ IMPLEMENTATION STEPS
- List actionable steps to achieve compliance
- Prioritize by urgency and impact

📚 RECOMMENDED SUPPLEMENTARY DOCUMENTS
- List 2-3 relevant supplementary documents (AUVA/DGUV/ASR/STL/PGS docs) that provide detailed practical guidance
- Format: "For [specific topic], refer to [Document Abbreviation]"
- Example: "For detailed forklift safety guidelines, refer to AUVA M 480"

Be concise and practical. Use bullet points. Include specific legal citations from ${FRAMEWORK_CONTEXT[framework]}.`

  const response = await generateAIResponse(prompt, framework, language, topic)
  return normalizeNewlines(response)
}

export async function generateDocument(templateName, inputs, framework, language) {
  const inputDetails = Object.entries(inputs)
    .map(([key, value]) => `${key}: ${value || 'Not specified'}`)
    .join('\n')

  const prompt = `Generate a ${templateName} document with the following details:

${inputDetails}

Format as a professional document with:

📄 DOCUMENT TITLE
[Title based on template type]

📋 DOCUMENT CONTENT
[Main content organized in clear sections with headings]

📜 LEGAL REFERENCES
- List applicable legal citations

✍️ SIGNATURE FIELDS
- List who needs to sign (if applicable)

📅 DATE & VALIDITY
- When this document is effective

Use professional formatting with clear headings and bullet points.`

  const response = await generateAIResponse(prompt, framework, language)
  return normalizeNewlines(response)
}

export async function lookupRegulation(topic, companySize, framework, language) {
  const prompt = `What are the specific legal requirements for "${topic}" in a delivery station with ${companySize || 'any number of'} employees?

Format your response as readable text with these sections:

📜 LEGAL REQUIREMENTS
- List each requirement with its specific legal citation (§ reference)
- Include brief description

🔧 IMPLEMENTATION STEPS
- Practical steps to implement each requirement

📄 REQUIRED DOCUMENTATION
- List records and documents to maintain

⏰ DEADLINES & FREQUENCIES
- Inspection intervals, training renewals, etc.

⚠️ PENALTIES
- Consequences of non-compliance

☑️ COMPLIANCE CHECKLIST
- Quick checklist items to verify compliance

📚 SUPPLEMENTARY GUIDANCE
- Recommend 1-2 relevant supplementary documents (AUVA/DGUV/ASR/STL/PGS) for detailed practical guidance
- Format: "For more details on [topic], see [Document Abbreviation]"

Be concise and practical. Use bullet points. Include specific legal citations.`

  const response = await generateAIResponse(prompt, framework, language, topic)
  return normalizeNewlines(response)
}

export async function generateFlowchart(lawText, framework, language) {
  // Check cache first
  const cacheKey = generateCacheKey('flowchart', lawText.substring(0, 500), framework, language)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  const prompt = `You are a visual logic expert. Create a Mermaid.js flowchart to explain this regulation.

RULES:
1. Use 'graph TD' (Top-Down) orientation.
2. Use concise node labels (max 8 words per line).
3. Focus on "If/Then" decision points in the law (e.g., "Is height > 2m?", "Are hazardous substances present?").
4. Use diamond shapes for decisions (e.g., {Decision?})
5. Use rounded rectangles for actions (e.g., (Action))
6. Use rectangles for requirements (e.g., [Requirement])
7. Include Yes/No or appropriate labels on decision arrows.
8. Keep the flowchart practical and actionable for workplace safety managers.
9. Output ONLY the raw Mermaid syntax string. No markdown code blocks, no backticks, no explanation.

Regulation text:
${lawText.substring(0, 4000)}`

  const response = await generateAIResponse(prompt, framework, language)
  const normalizedResponse = normalizeNewlines(response)
  setCachedResponse(cacheKey, normalizedResponse)
  return normalizedResponse
}

// Feature 2: Legalese Complexity Slider - Simplify legal text
// Combined function that returns BOTH levels in a single API call (saves ~50% tokens)
export async function simplifyForBothLevels(lawText, sectionTitle, framework, language) {
  // Use the user's language preference from site settings
  const outputLang = language || 'en'

  // Check cache first - include outputLang in cache key since it affects output
  const cacheKey = generateCacheKey('simplify_both', lawText.substring(0, 500), sectionTitle, framework, outputLang)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  // Get language-specific labels based on the user's language setting
  const labels = LANGUAGE_LABELS[outputLang] || LANGUAGE_LABELS.en

  // Validate that we have actual content to analyze
  if (!lawText || lawText.trim().length < 20) {
    const noContentMsg = {
      en: { manager: `**${labels.whatThisSectionCovers}:**\n- Section "${sectionTitle}" - No content available for analysis\n\n**Key requirements:**\n- Unable to extract requirements - section content is empty or too short`, associate: `📖 This section "${sectionTitle}" doesn't have content to explain yet.\n❓ Ask your manager for more information!` },
      de: { manager: `**${labels.whatThisSectionCovers}:**\n- Abschnitt "${sectionTitle}" - Kein Inhalt zur Analyse verfügbar\n\n**Wichtige Anforderungen:**\n- Keine Anforderungen extrahierbar - Abschnittsinhalt ist leer oder zu kurz`, associate: `📖 Dieser Abschnitt "${sectionTitle}" hat noch keinen Inhalt zum Erklären.\n❓ Frag deinen Vorgesetzten für mehr Infos!` },
      nl: { manager: `**${labels.whatThisSectionCovers}:**\n- Artikel "${sectionTitle}" - Geen inhoud beschikbaar voor analyse\n\n**Belangrijke vereisten:**\n- Geen vereisten te extraheren - artikelinhoud is leeg of te kort`, associate: `📖 Dit artikel "${sectionTitle}" heeft nog geen inhoud om uit te leggen.\n❓ Vraag je manager voor meer informatie!` }
    }
    return noContentMsg[outputLang] || noContentMsg.en
  }

  // Language-specific prompt parts - use outputLang for consistent output
  const langInstructions = {
    en: 'Respond ENTIRELY in English.',
    de: 'Antworten Sie VOLLSTÄNDIG auf Deutsch. Alle Überschriften, Texte und Erklärungen müssen auf Deutsch sein.',
    nl: 'Antwoord VOLLEDIG in het Nederlands. Alle koppen, teksten en uitleg moeten in het Nederlands zijn.'
  }

  const prompt = `You are analyzing a SPECIFIC legal section. Your job is to summarize ONLY what is written in the text below.

IMPORTANT: ${langInstructions[outputLang] || langInstructions.en}

=== SECTION BEING ANALYZED ===
Section: ${sectionTitle || 'Legal Provision'}

--- BEGIN LEGAL TEXT ---
${lawText.substring(0, 4000)}
--- END LEGAL TEXT ---

=== CRITICAL INSTRUCTIONS ===
1. ONLY summarize what appears in the text between "BEGIN LEGAL TEXT" and "END LEGAL TEXT"
2. DO NOT invent requirements that are not in the text
3. DO NOT add generic workplace safety advice
4. If the text is about scope, definitions, or exceptions - say exactly that
5. QUOTE actual phrases from the text using quotation marks
6. Reference paragraph numbers: "(1)" = Abs. 1, "1." = Punkt 1, "§ X" = cite it

=== OUTPUT FORMAT ===

---MANAGER---
**${labels.whatThisSectionCovers}:**
- [1-2 sentences describing what THIS specific text is about]

**${labels.keyRequirements}:**
- [List ONLY requirements that appear IN THE TEXT ABOVE]
- [Quote the exact language where possible]
- [If no actionable requirements, write: "${labels.noRequirements}"]

**${labels.complianceRelevance}:**
- [Connect the SPECIFIC content above to warehouse operations]

**${labels.documentationActions}:**
- [List ONLY actions required by THIS text, with citations]
- [If none, write: "${labels.noDocumentation}"]

---ASSOCIATE---
[5 simple bullet points with emoji explaining what THIS text says]
- Each bullet under 10 words
- Use words a child would understand
- Reference actual content from the text above

=== REMEMBER ===
- Your summary must match the content provided
- If someone reads your summary, they should recognize it matches the original text
- Do not add information that is not in the text
- ${langInstructions[outputLang] || langInstructions.en}`

  const response = await generateAIResponse(prompt, framework, outputLang)

  // Normalize escaped newlines
  const normalizedResponse = normalizeNewlines(response)

  // Parse the combined response
  const result = { manager: '', associate: '' }
  const managerMatch = normalizedResponse.match(/---MANAGER---\s*([\s\S]*?)(?=---ASSOCIATE---|$)/i)
  const associateMatch = normalizedResponse.match(/---ASSOCIATE---\s*([\s\S]*?)$/i)

  if (managerMatch) result.manager = managerMatch[1].trim()
  if (associateMatch) result.associate = associateMatch[1].trim()

  // Language-specific fallback messages
  const fallbackMessages = {
    en: {
      associateDefault: `📖 This section "${sectionTitle}" explains important rules.\n🔍 Read it carefully to understand what it says.\n❓ Ask your manager if you have questions!`,
      managerDefault: `**${labels.whatThisSectionCovers}:**\n- ${sectionTitle || 'See section text'}\n\n**${labels.keyRequirements}:**\n- Review the original text for specific requirements\n\n**${labels.complianceRelevance}:**\n- Assess based on section content\n\n**${labels.documentationActions}:**\n- Refer to original legal text`,
      associateAmbiguous: `📖 This part "${sectionTitle}" has important information.\n🔍 Grown-ups need to read it carefully.\n❓ Ask your boss what it means!`
    },
    de: {
      associateDefault: `📖 Dieser Abschnitt "${sectionTitle}" erklärt wichtige Regeln.\n🔍 Lies ihn aufmerksam durch.\n❓ Frag deinen Vorgesetzten bei Fragen!`,
      managerDefault: `**${labels.whatThisSectionCovers}:**\n- ${sectionTitle || 'Siehe Abschnittstext'}\n\n**${labels.keyRequirements}:**\n- Originaltext prüfen für spezifische Anforderungen\n\n**${labels.complianceRelevance}:**\n- Basierend auf Abschnittsinhalt bewerten\n\n**${labels.documentationActions}:**\n- Siehe Originalgesetzestext`,
      associateAmbiguous: `📖 Dieser Teil "${sectionTitle}" hat wichtige Infos.\n🔍 Erwachsene müssen das genau lesen.\n❓ Frag deinen Chef was es bedeutet!`
    },
    nl: {
      associateDefault: `📖 Dit artikel "${sectionTitle}" legt belangrijke regels uit.\n🔍 Lees het zorgvuldig door.\n❓ Vraag je manager als je vragen hebt!`,
      managerDefault: `**${labels.whatThisSectionCovers}:**\n- ${sectionTitle || 'Zie artikeltekst'}\n\n**${labels.keyRequirements}:**\n- Controleer originele tekst voor specifieke vereisten\n\n**${labels.complianceRelevance}:**\n- Beoordeel op basis van artikelinhoud\n\n**${labels.documentationActions}:**\n- Zie originele wettekst`,
      associateAmbiguous: `📖 Dit deel "${sectionTitle}" heeft belangrijke informatie.\n🔍 Volwassenen moeten dit goed lezen.\n❓ Vraag je baas wat het betekent!`
    }
  }
  const msgs = fallbackMessages[outputLang] || fallbackMessages.en

  // Fallback if parsing fails - try to create meaningful defaults that reference the section
  if (!result.manager && !result.associate) {
    // If no headers found, check if content looks like manager or associate style
    const hasManagerStyle = normalizedResponse.match(/(?:obligations|deadlines|documentation|compliance|covers|requirements|Anforderungen|Pflichten|Dokumentation|vereisten|verplichtingen)/i)
    const hasELI5Style = normalizedResponse.match(/[👷⚠️✅❌🚫💡🦺🏥📋👥📖]/)

    if (hasManagerStyle && !hasELI5Style) {
      result.manager = normalizedResponse
      result.associate = msgs.associateDefault
    } else if (hasELI5Style && !hasManagerStyle) {
      result.associate = normalizedResponse
      result.manager = msgs.managerDefault
    } else {
      // Genuinely ambiguous - provide distinct defaults that reference the section
      result.manager = normalizedResponse
      result.associate = msgs.associateAmbiguous
    }
  } else if (!result.manager) {
    result.manager = msgs.managerDefault
  } else if (!result.associate) {
    result.associate = msgs.associateDefault
  }

  setCachedResponse(cacheKey, result)
  return result
}

// Legacy functions - now use cache and can optionally use combined function
export async function simplifyForManager(lawText, sectionTitle, framework, language) {
  // Check cache first
  const cacheKey = generateCacheKey('simplify_manager', lawText.substring(0, 500), sectionTitle, framework, language)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  // Validate input
  if (!lawText || lawText.trim().length < 20) {
    return `**Section:** ${sectionTitle}\n\n**Status:** No content available for analysis.`
  }

  const prompt = `You are a Workplace Health and Safety (WHS) expert. Analyze ONLY the legal text provided below.

=== SECTION ===
${sectionTitle || 'Legal Provision'}

--- BEGIN LEGAL TEXT ---
${lawText.substring(0, 3000)}
--- END LEGAL TEXT ---

=== INSTRUCTIONS ===
1. ONLY summarize what is written in the text above
2. DO NOT add generic safety advice not in the text
3. Quote specific phrases from the text
4. Include legal citations (§ X Abs. Y) for each point
5. If this section has no actionable requirements, say so clearly

=== OUTPUT FORMAT ===
**Key WHS obligations from this text:**
- [List ONLY obligations that appear in the text above]

**Compliance deadlines:**
- [List ONLY deadlines mentioned in the text, or "None specified in this section"]

**Documentation required:**
- [List ONLY documentation requirements from the text, or "None specified in this section"]

Keep it under 150 words. Be specific to THIS text.`

  const response = await generateAIResponse(prompt, framework, language)
  const normalizedResponse = normalizeNewlines(response)
  setCachedResponse(cacheKey, normalizedResponse)
  return normalizedResponse
}

export async function simplifyForAssociate(lawText, sectionTitle, framework, language) {
  // Check cache first
  const cacheKey = generateCacheKey('simplify_associate', lawText.substring(0, 500), sectionTitle, framework, language)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  // Validate input
  if (!lawText || lawText.trim().length < 20) {
    return `📖 This section "${sectionTitle}" doesn't have content to explain yet.\n❓ Ask your manager for more information!`
  }

  const prompt = `Explain what THIS SPECIFIC text says using simple words a 5-year-old would understand.

=== TEXT TO EXPLAIN ===
Section: ${sectionTitle || 'Safety Rule'}

--- BEGIN TEXT ---
${lawText.substring(0, 2000)}
--- END TEXT ---

=== INSTRUCTIONS ===
1. Explain ONLY what the text above actually says
2. Do NOT add general safety advice not in the text
3. Use words a 5-year-old knows
4. Maximum 5 bullet points with emoji
5. Each bullet under 10 words
6. Reference the actual content from the text

=== GOOD EXAMPLES ===
- "👷 Big people at work need helmets!"
- "⚠️ Tell a grown-up if something looks dangerous!"
- "✅ Everyone gets breaks to rest!"

=== BAD EXAMPLES (too formal) ===
- "Employers must ensure PPE compliance"
- "Employees have the right to refuse unsafe work"

Your explanation must relate to the actual text provided above.`

  const response = await generateAIResponse(prompt, framework, language)
  const normalizedResponse = normalizeNewlines(response)
  setCachedResponse(cacheKey, normalizedResponse)
  return normalizedResponse
}

// Feature 3: Cross-Border Harmonizer - Find equivalent laws across jurisdictions
export async function findEquivalentLaw(lawText, sourceFramework, targetFramework, language) {
  // Check cache first
  const cacheKey = generateCacheKey('equivalent', lawText.substring(0, 300), sourceFramework, targetFramework, language)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  const prompt = `Compare ${sourceFramework} regulation with ${targetFramework} equivalent.

SOURCE (${sourceFramework}):
${lawText.substring(0, 1000)}

FORMAT:
---EQUIVALENT---
[${targetFramework} paragraph/article citation]

---COMPARISON---
| Aspect | ${sourceFramework} | ${targetFramework} |
[3 key points]

---DIFFERENCES---
⚠️ [Key differences, one per line]

---RECOMMENDATION---
[One sentence]

---SUPPLEMENTARY_DOCS---
📚 For practical guidance on this topic, consider:
- ${sourceFramework}: [Relevant supplementary document]
- ${targetFramework}: [Relevant supplementary document]`

  const response = await generateAIResponse(prompt, sourceFramework, language)
  const normalizedResponse = normalizeNewlines(response)
  setCachedResponse(cacheKey, normalizedResponse)
  return normalizedResponse
}

// Feature 3b: Multi-Country Comparison - Compare laws across all 3 jurisdictions
export async function compareMultipleCountries(lawText, sourceFramework, language) {
  // Check cache first
  const cacheKey = generateCacheKey('multi_country', lawText.substring(0, 300), sourceFramework, language)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  const prompt = `You are a WHS legal expert. Compare this ${sourceFramework} regulation across Austria (AT), Germany (DE), and Netherlands (NL).

SOURCE REGULATION (${sourceFramework}):
${lawText.substring(0, 1000)}

IMPORTANT: You MUST use these EXACT section markers in your response:

---TOPIC---
[Topic name in 5-10 words]

---AT_PROVISION---
[ASchG § citation + brief description. If source is AT, describe this provision. If no equivalent, write "No direct equivalent - see [related provision]"]

---DE_PROVISION---
[ArbSchG/DGUV § citation + brief description. If source is DE, describe this provision. If no equivalent, write "No direct equivalent - see [related provision]"]

---NL_PROVISION---
[Arbowet Artikel citation + brief description. If source is NL, describe this provision. If no equivalent, write "No direct equivalent - see [related provision]"]

---COMPARISON_TABLE---
| Aspect | AT | DE | NL |
|--------|-----|-----|-----|
| [Row 1] | [AT value] | [DE value] | [NL value] |
| [Row 2] | [AT value] | [DE value] | [NL value] |
| [Row 3] | [AT value] | [DE value] | [NL value] |

---KEY_DIFFERENCES---
⚠️ First key difference between jurisdictions
⚠️ Second key difference between jurisdictions
⚠️ Third key difference between jurisdictions

---HARMONIZATION_TIPS---
✅ First practical tip for cross-border compliance
✅ Second practical tip for cross-border compliance
✅ Third practical tip for cross-border compliance

---SUPPLEMENTARY_DOCS---
📚 AT: [Recommend relevant AUVA/AI document for this topic]
📚 DE: [Recommend relevant ASR/DGUV document for this topic]
📚 NL: [Recommend relevant STL/PGS/Arbocatalogus document for this topic]

Use the exact markers above. Be specific with legal citations.`

  const response = await generateAIResponse(prompt, sourceFramework, language)
  const normalizedResponse = normalizeNewlines(response)
  setCachedResponse(cacheKey, normalizedResponse)
  return normalizedResponse
}

// Feature 4: Semantic Tagging - Tag law text with roles and equipment
export async function generateSemanticTags(lawText, sectionNumber, framework, language) {
  // Check cache first
  const cacheKey = generateCacheKey('semantic_tags', lawText.substring(0, 300), sectionNumber, framework)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  const prompt = `You are a logistics safety expert. Analyze this regulation and tag it with relevant logistics roles and equipment.

REGULATION:
${lawText.substring(0, 2000)}

AVAILABLE ROLE TAGS (use only these):
- Packer
- Pick_Associate
- Stower
- Dock_Clerk
- Forklift_Operator
- Sortation_Associate
- Problem_Solver
- Safety_Coordinator
- Area_Manager
- Delivery_Driver

AVAILABLE EQUIPMENT TAGS (use only these):
- Forklift
- Pallet_Jack
- Conveyor
- Scanner
- Ladder
- Cart
- PPE
- Kiva_Robot
- Loading_Dock
- Racking

OUTPUT FORMAT (JSON only, no explanation):
{
  "roles": ["Role1", "Role2"],
  "equipment": ["Equipment1", "Equipment2"],
  "hazards": ["brief hazard 1", "brief hazard 2"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`

  const response = await generateAIResponse(prompt, framework, language)
  const parsed = cleanAndParseJSON(response)
  const formatted = formatJSONForDisplay(parsed)
  setCachedResponse(cacheKey, formatted)
  return formatted
}

/**
 * Translate law text to a different language
 * Used for cross-language reading (e.g., translating Dutch law text to German)
 * @param {string} lawText - The law text to translate
 * @param {string} sourceLanguage - Source language code (de, nl, en)
 * @param {string} targetLanguage - Target language code (de, nl, en)
 * @param {string} framework - The jurisdiction context
 * @returns {Promise<string>} - Translated text
 */
export async function translateLawText(lawText, sourceLanguage, targetLanguage, framework) {
  if (!lawText || lawText.trim().length < 10) {
    return lawText
  }

  // Check cache first
  const cacheKey = generateCacheKey('translate', lawText.substring(0, 500), sourceLanguage, targetLanguage, framework)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  const languageNames = {
    en: 'English',
    de: 'German (Deutsch)',
    nl: 'Dutch (Nederlands)'
  }

  const prompt = `You are a legal translator specializing in workplace health and safety (WHS) legislation.

Translate the following ${languageNames[sourceLanguage] || sourceLanguage} legal text to ${languageNames[targetLanguage] || targetLanguage}.

IMPORTANT:
- Maintain all legal terminology accurately
- Preserve the structure and formatting (paragraph numbers, bullet points, etc.)
- Keep section references (§, Artikel, etc.) intact
- Do not add explanations or commentary
- Return ONLY the translation, nothing else

=== TEXT TO TRANSLATE ===
${lawText}

=== TRANSLATION (${languageNames[targetLanguage] || targetLanguage}) ===`

  const response = await generateAIResponse(prompt, framework, targetLanguage)
  const normalizedResponse = normalizeNewlines(response).trim()

  setCachedResponse(cacheKey, normalizedResponse)
  return normalizedResponse
}

// Export supplementary document helpers for use in chatbot and other components
export { getRelevantSupplementaryDocs, buildSupplementaryDocContext, SUPPLEMENTARY_DOCS_CONTEXT }

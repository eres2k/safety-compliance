import { getStore } from "@netlify/blobs"

// ============================================
// Admin Settings - Configurable system settings
// Stored persistently in Netlify Blobs
// ============================================

const SETTINGS_STORE = 'admin-settings'
const SETTINGS_KEY = 'system-settings'
const ERROR_LOGS_STORE = 'error-logs'

// Default settings
const DEFAULT_SETTINGS = {
  ai: {
    clientRateLimitSeconds: 120,     // Client-side wait between requests
    serverRateLimitPerMinute: 10,    // Server-side requests per minute per IP
    serverBanThreshold: 20,          // Requests/min that trigger a 24h ban
    cacheTTLHours: 48,               // Cache time-to-live
    primaryModel: 'gemini-3.0-flash',
    fallbackModel: 'gemini-2.5-flash',
    maxOutputTokens: 8192,
    temperature: 0.3,
    maxInputLength: 5000
  },
  features: {
    chatbotEnabled: true,
    simplifyEnabled: true,
    flowchartEnabled: true,
    crossBorderEnabled: true,
    multiCountryEnabled: true,
    translateEnabled: true,
    complianceEnabled: true
  },
  scraper: {
    autoUpdateEnabled: true,
    updateIntervalDays: 14,
    countries: ['AT', 'DE', 'NL']
  }
}

// Constant-time string comparison
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function verifyAdmin(event) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false
  const authHeader = event.headers['authorization'] || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  return timingSafeEqual(token, adminPassword)
}

function getSettingsStore(context) {
  return getStore({
    name: SETTINGS_STORE,
    siteID: context.site?.id || process.env.SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN || context.clientContext?.identity?.token
  })
}

function getErrorStore(context) {
  return getStore({
    name: ERROR_LOGS_STORE,
    siteID: context.site?.id || process.env.SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN || context.clientContext?.identity?.token
  })
}

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers }
  }

  // All endpoints require admin auth
  if (!verifyAdmin(event)) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ message: 'Unauthorized' })
    }
  }

  const params = event.queryStringParameters || {}

  // GET: Retrieve settings, errors, or cache stats
  if (event.httpMethod === 'GET') {
    const action = params.action || 'settings'

    try {
      if (action === 'settings') {
        const store = getSettingsStore(context)
        let settings = await store.get(SETTINGS_KEY, { type: 'json' })
        if (!settings) {
          settings = DEFAULT_SETTINGS
          // Initialize with defaults
          await store.setJSON(SETTINGS_KEY, settings)
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ settings, defaults: DEFAULT_SETTINGS })
        }
      }

      if (action === 'errors') {
        const errorStore = getErrorStore(context)
        const offset = parseInt(params.offset) || 0
        const limit = Math.min(parseInt(params.limit) || 50, 200)

        let index = await errorStore.get('error-index', { type: 'json' })
        if (!index) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ entries: [], total: 0, offset, limit })
          }
        }

        const total = index.entries.length
        const entries = index.entries.slice(offset, offset + limit)

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ entries, total, offset, limit })
        }
      }

      if (action === 'error-detail') {
        const errorStore = getErrorStore(context)
        const errorId = params.id
        if (!errorId) {
          return { statusCode: 400, headers, body: JSON.stringify({ message: 'Missing id' }) }
        }
        const entry = await errorStore.get(errorId, { type: 'json' })
        return {
          statusCode: entry ? 200 : 404,
          headers,
          body: JSON.stringify(entry || { message: 'Not found' })
        }
      }

      if (action === 'cache-stats') {
        // Proxy to cache-stats logic inline
        const cacheStore = getStore({
          name: "ai-cache",
          siteID: context.site?.id || process.env.SITE_ID,
          token: process.env.NETLIFY_AUTH_TOKEN || context.clientContext?.identity?.token
        })

        const { blobs } = await cacheStore.list()
        let totalSize = 0
        let oldestTimestamp = Date.now()
        let newestTimestamp = 0
        const entries = []

        // Only read first 100 for stats (performance)
        const blobsToRead = blobs.slice(0, 100)
        for (const blob of blobsToRead) {
          try {
            const data = await cacheStore.get(blob.key, { type: 'json' })
            if (data && data.timestamp) {
              const size = JSON.stringify(data).length
              totalSize += size
              if (data.timestamp < oldestTimestamp) oldestTimestamp = data.timestamp
              if (data.timestamp > newestTimestamp) newestTimestamp = data.timestamp
              entries.push({
                key: blob.key,
                timestamp: data.timestamp,
                age: Math.round((Date.now() - data.timestamp) / (1000 * 60 * 60)) + 'h',
                size: Math.round(size / 1024) + 'KB',
                model: data.model || 'unknown'
              })
            }
          } catch { /* skip */ }
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            totalEntries: blobs.length,
            sampledEntries: blobsToRead.length,
            totalSizeKB: Math.round(totalSize / 1024),
            oldestEntry: oldestTimestamp < Date.now() ? new Date(oldestTimestamp).toISOString() : null,
            newestEntry: newestTimestamp > 0 ? new Date(newestTimestamp).toISOString() : null,
            cacheTTL: '48 hours',
            entries: entries.slice(0, 50)
          })
        }
      }

      // Public settings - no auth required for client-side consumption
      if (action === 'public') {
        const store = getSettingsStore(context)
        let settings = await store.get(SETTINGS_KEY, { type: 'json' })
        if (!settings) settings = DEFAULT_SETTINGS
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            clientRateLimitSeconds: settings.ai?.clientRateLimitSeconds || DEFAULT_SETTINGS.ai.clientRateLimitSeconds,
            features: settings.features || DEFAULT_SETTINGS.features
          })
        }
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid action. Use: settings, errors, error-detail, cache-stats' })
      }
    } catch (error) {
      console.error('[Admin Settings] GET error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: 'Internal error', details: error.message })
      }
    }
  }

  // POST: Update settings or clear data
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body)
      const { action } = body

      if (action === 'update-settings') {
        const store = getSettingsStore(context)
        const { settings: newSettings } = body

        // Merge with defaults to ensure all fields exist
        let current = await store.get(SETTINGS_KEY, { type: 'json' }) || DEFAULT_SETTINGS
        const merged = {
          ai: { ...current.ai, ...newSettings.ai },
          features: { ...current.features, ...newSettings.features },
          scraper: { ...current.scraper, ...newSettings.scraper },
          updatedAt: new Date().toISOString(),
          updatedBy: 'admin'
        }

        await store.setJSON(SETTINGS_KEY, merged)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, settings: merged })
        }
      }

      if (action === 'reset-settings') {
        const store = getSettingsStore(context)
        await store.setJSON(SETTINGS_KEY, { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() })
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, settings: DEFAULT_SETTINGS })
        }
      }

      if (action === 'clear-cache') {
        const cacheStore = getStore({
          name: "ai-cache",
          siteID: context.site?.id || process.env.SITE_ID,
          token: process.env.NETLIFY_AUTH_TOKEN || context.clientContext?.identity?.token
        })
        const { blobs } = await cacheStore.list()
        let cleared = 0
        for (const blob of blobs) {
          try {
            await cacheStore.delete(blob.key)
            cleared++
          } catch { /* skip */ }
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, cleared })
        }
      }

      if (action === 'clear-errors') {
        const errorStore = getErrorStore(context)
        await errorStore.setJSON('error-index', { entries: [] })
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        }
      }

      if (action === 'clear-logs') {
        const logStore = getStore({
          name: "chat-logs",
          siteID: context.site?.id || process.env.SITE_ID,
          token: process.env.NETLIFY_AUTH_TOKEN || context.clientContext?.identity?.token
        })
        await logStore.setJSON('log-index', { entries: [] })
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        }
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid action' })
      }
    } catch (error) {
      console.error('[Admin Settings] POST error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: 'Internal error', details: error.message })
      }
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) }
}

import { getStore } from "@netlify/blobs"

// ============================================
// Chat Log Management - Server-side logging
// Uses Netlify Blobs for persistent storage
// ============================================

const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD'
const CHAT_LOGS_STORE = 'chat-logs'
const CHAT_LOG_INDEX_KEY = 'log-index'
const MAX_INDEX_ENTRIES = 5000

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function getStore_(context) {
  return getStore({
    name: CHAT_LOGS_STORE,
    siteID: context.site?.id || process.env.SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN || context.clientContext?.identity?.token
  })
}

// Verify admin password from request
function verifyAdmin(event) {
  const adminPassword = process.env[ADMIN_PASSWORD_ENV]
  if (!adminPassword) {
    console.warn('[Admin] ADMIN_PASSWORD not set in environment')
    return false
  }

  // Check Authorization header
  const authHeader = event.headers['authorization'] || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  return timingSafeEqual(token, adminPassword)
}

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers }
  }

  // POST: Log a new chat interaction (called internally by ai-generate)
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body)
      const { action } = body

      // Internal action: log a chat interaction
      if (action === 'log') {
        const { logEntry, internalSecret } = body
        // Verify internal secret to prevent external abuse
        const expectedSecret = process.env.INTERNAL_FUNCTION_SECRET || 'default-internal-secret'
        if (!timingSafeEqual(internalSecret || '', expectedSecret)) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ message: 'Unauthorized' })
          }
        }

        const store = getStore_(context)
        const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

        // Store the individual log entry
        await store.setJSON(logId, {
          ...logEntry,
          id: logId,
          timestamp: new Date().toISOString()
        })

        // Update the index
        try {
          let index = await store.get(CHAT_LOG_INDEX_KEY, { type: 'json' }) || { entries: [] }
          index.entries.unshift({
            id: logId,
            timestamp: new Date().toISOString(),
            ip: logEntry.ip || 'unknown',
            model: logEntry.model || 'unknown',
            cached: logEntry.cached || false,
            promptLength: logEntry.promptLength || 0,
            blocked: logEntry.blocked || false
          })
          // Keep index manageable
          if (index.entries.length > MAX_INDEX_ENTRIES) {
            index.entries = index.entries.slice(0, MAX_INDEX_ENTRIES)
          }
          await store.setJSON(CHAT_LOG_INDEX_KEY, index)
        } catch (indexError) {
          console.error('[Chat Logs] Index update error (non-fatal):', indexError.message)
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, logId })
        }
      }

      // Admin action: verify admin credentials
      if (action === 'verify') {
        const { password } = body
        const adminPassword = process.env[ADMIN_PASSWORD_ENV]
        if (!adminPassword) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'Admin not configured' })
          }
        }
        const valid = timingSafeEqual(password || '', adminPassword)
        return {
          statusCode: valid ? 200 : 401,
          headers,
          body: JSON.stringify({ success: valid, message: valid ? 'Authenticated' : 'Invalid password' })
        }
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid action' })
      }
    } catch (error) {
      console.error('[Chat Logs] POST error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: 'Internal error' })
      }
    }
  }

  // GET: Retrieve chat logs (admin only)
  if (event.httpMethod === 'GET') {
    if (!verifyAdmin(event)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Unauthorized. Provide admin token via Authorization header.' })
      }
    }

    const params = event.queryStringParameters || {}
    const action = params.action || 'list'

    try {
      const store = getStore_(context)

      if (action === 'list') {
        // Return the log index with pagination
        const offset = parseInt(params.offset) || 0
        const limit = Math.min(parseInt(params.limit) || 50, 200)

        let index = await store.get(CHAT_LOG_INDEX_KEY, { type: 'json' })
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

      if (action === 'detail') {
        // Return a specific log entry
        const logId = params.id
        if (!logId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ message: 'Missing id parameter' })
          }
        }

        const entry = await store.get(logId, { type: 'json' })
        if (!entry) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: 'Log entry not found' })
          }
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(entry)
        }
      }

      if (action === 'stats') {
        // Return aggregate statistics
        let index = await store.get(CHAT_LOG_INDEX_KEY, { type: 'json' })
        if (!index) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              totalLogs: 0,
              last24h: 0,
              last7d: 0,
              cachedPercent: 0,
              blockedCount: 0,
              uniqueIPs: 0,
              modelBreakdown: {}
            })
          }
        }

        const now = Date.now()
        const day = 24 * 60 * 60 * 1000
        const entries = index.entries

        const last24h = entries.filter(e => now - new Date(e.timestamp).getTime() < day).length
        const last7d = entries.filter(e => now - new Date(e.timestamp).getTime() < 7 * day).length
        const cachedCount = entries.filter(e => e.cached).length
        const blockedCount = entries.filter(e => e.blocked).length
        const uniqueIPs = new Set(entries.map(e => e.ip)).size
        const modelBreakdown = {}
        entries.forEach(e => {
          const model = e.model || 'unknown'
          modelBreakdown[model] = (modelBreakdown[model] || 0) + 1
        })

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            totalLogs: entries.length,
            last24h,
            last7d,
            cachedPercent: entries.length > 0 ? Math.round(cachedCount / entries.length * 100) : 0,
            blockedCount,
            uniqueIPs,
            modelBreakdown
          })
        }
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid action. Use: list, detail, stats' })
      }
    } catch (error) {
      console.error('[Chat Logs] GET error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: 'Internal error' })
      }
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ message: 'Method not allowed' })
  }
}

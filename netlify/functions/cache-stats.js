import { getStore } from "@netlify/blobs"

export async function handler(event, context) {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    }
  }

  try {
    // On Netlify: auto-configured. Locally: needs NETLIFY_AUTH_TOKEN + SITE_ID
    const store = getStore({
      name: "ai-cache",
      siteID: context.site?.id || process.env.SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN || context.clientContext?.identity?.token
    })

    if (!store) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Cache store not available' })
      }
    }

    // List all cached items
    const { blobs } = await store.list()

    let totalSize = 0
    let oldestTimestamp = Date.now()
    let newestTimestamp = 0
    const entries = []

    for (const blob of blobs) {
      try {
        const data = await store.get(blob.key, { type: 'json' })
        if (data && data.timestamp) {
          const size = JSON.stringify(data).length
          totalSize += size
          if (data.timestamp < oldestTimestamp) oldestTimestamp = data.timestamp
          if (data.timestamp > newestTimestamp) newestTimestamp = data.timestamp
          entries.push({
            key: blob.key,
            timestamp: data.timestamp,
            age: Math.round((Date.now() - data.timestamp) / (1000 * 60 * 60)) + 'h',
            size: Math.round(size / 1024) + 'KB'
          })
        }
      } catch (e) {
        // Skip entries that can't be read
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cacheStats: {
          totalEntries: blobs.length,
          totalSizeKB: Math.round(totalSize / 1024),
          oldestEntry: oldestTimestamp < Date.now() ? new Date(oldestTimestamp).toISOString() : null,
          newestEntry: newestTimestamp > 0 ? new Date(newestTimestamp).toISOString() : null,
          cacheTTL: '48 hours'
        },
        entries: entries.slice(0, 50) // Return first 50 entries
      })
    }
  } catch (error) {
    console.error('Cache stats error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error fetching cache stats',
        details: error.message
      })
    }
  }
}

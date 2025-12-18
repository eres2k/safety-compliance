import { getStore } from "@netlify/blobs"

// ============================================
// Optimized for Gemini 3.0 Flash
// Rate Limits: 1K RPM, 1M TPM, 10K RPD
// ============================================

// Cache TTL: 48 hours - important to stay within daily limits
const CACHE_TTL_SECONDS = 48 * 60 * 60

// Model configuration - Gemini 3 Flash
const GEMINI_MODEL = 'gemini-3-flash'
const MAX_OUTPUT_TOKENS = 8192
const TEMPERATURE = 0.2  // Lower temperature for more consistent legal analysis

// Generate a cache key from prompt and system prompt
function generateCacheKey(prompt, systemPrompt) {
  const combined = `${prompt || ''}_${systemPrompt || ''}`
  // Create a simple hash - use base64 encoding of first 200 chars
  const hash = Buffer.from(combined.substring(0, 200)).toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 64)
  return `ai_cache_${hash}`
}

// Retry helper with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)

      // If rate limited (429) or server error (5xx), retry
      if (response.status === 429 || response.status >= 500) {
        if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
          await new Promise(r => setTimeout(r, delay))
          continue
        }
      }

      return response
    } catch (error) {
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw error
    }
  }
}

export async function handler(event, context) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    }
  }

  // Get API key from environment variable
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'AI service not configured. Please set GEMINI_API_KEY in Netlify environment variables.'
      })
    }
  }

  try {
    const { prompt, systemPrompt, skipCache } = JSON.parse(event.body)

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Prompt is required' })
      }
    }

    // Initialize Netlify Blobs store
    // On Netlify: auto-configured. Locally: needs NETLIFY_AUTH_TOKEN + SITE_ID
    const store = getStore({
      name: "ai-cache",
      siteID: context.site?.id || process.env.SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN || context.clientContext?.identity?.token
    })

    const cacheKey = generateCacheKey(prompt, systemPrompt)

    // Check cache first (unless skipCache is true)
    if (!skipCache && store) {
      try {
        const cached = await store.get(cacheKey, { type: 'json' })
        if (cached && cached.response && cached.timestamp) {
          const age = Date.now() - cached.timestamp
          const ageHours = Math.round(age / (1000 * 60 * 60))

          // Check if cache is still valid (48 hours)
          if (age < CACHE_TTL_SECONDS * 1000) {
            console.log(`Cache hit for key ${cacheKey} (${ageHours}h old)`)
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Cache': 'HIT',
                'X-Cache-Age': `${ageHours}h`
              },
              body: JSON.stringify({
                response: cached.response,
                cached: true,
                cacheAge: `${ageHours}h`
              })
            }
          }
        }
      } catch (cacheError) {
        console.log('Cache read error (non-fatal):', cacheError.message)
      }
    }

    // Use gemini-3-flash via v1beta API
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          generationConfig: {
            temperature: TEMPERATURE,
            maxOutputTokens: MAX_OUTPUT_TOKENS
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Gemini API error:', errorData)
      return {
        statusCode: response.status,
        body: JSON.stringify({
          message: 'AI service error',
          details: errorData.error?.message || 'Unknown error'
        })
      }
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!generatedText) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'No response generated from AI' })
      }
    }

    // Store in cache
    if (store) {
      try {
        await store.setJSON(cacheKey, {
          response: generatedText,
          timestamp: Date.now(),
          promptHash: cacheKey
        })
        console.log(`Cached response for key ${cacheKey}`)
      } catch (cacheError) {
        console.log('Cache write error (non-fatal):', cacheError.message)
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      },
      body: JSON.stringify({
        response: generatedText,
        cached: false
      })
    }
  } catch (error) {
    console.error('Function error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        details: error.message
      })
    }
  }
}

import { getStore } from "@netlify/blobs"

// ============================================
// Optimized for Gemini 2.0 Flash (stable)
// Gemini 3.0 Flash released Dec 17, 2025 - using 2.0 for stability
// Rate Limits: 1K RPM, 1M TPM, 10K RPD
// ============================================

// Cache TTL: 48 hours - important to stay within daily limits
const CACHE_TTL_SECONDS = 48 * 60 * 60

// Model configuration - using Gemini 3 Flash (1K RPM, 1M TPM)
// Options: 'gemini-3-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'
const GEMINI_MODEL = 'gemini-3-flash'
const FALLBACK_MODEL = 'gemini-2.0-flash'  // Fallback if primary fails
const MAX_OUTPUT_TOKENS = 8192
const TEMPERATURE = 0.2  // Lower temperature for more consistent legal analysis

// Simple hash function (djb2) for cache keys - same as client-side
function simpleHash(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// Generate a cache key from prompt and system prompt
// Uses full systemPrompt (contains framework/language) + hash of prompt for uniqueness
function generateCacheKey(prompt, systemPrompt) {
  // Hash the full prompt content to catch differences anywhere in the text
  const promptHash = simpleHash(prompt || '')
  // Include systemPrompt directly since it contains framework/language context
  // This ensures different frameworks get different cache keys
  const systemHash = simpleHash(systemPrompt || '')
  return `ai_cache_${systemHash}_${promptHash}`
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

    // Helper function to call Gemini API with a specific model
    async function callGeminiAPI(model) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      console.log(`Calling Gemini API with model: ${model}`)

      return fetchWithRetry(apiUrl, {
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
      })
    }

    // Try primary model first, then fallback if it fails
    let response = await callGeminiAPI(GEMINI_MODEL)
    let usedModel = GEMINI_MODEL

    // If primary model fails with 404 (model not found) or 400 (bad request), try fallback
    if (!response.ok && (response.status === 404 || response.status === 400)) {
      console.log(`Primary model ${GEMINI_MODEL} failed with ${response.status}, trying fallback: ${FALLBACK_MODEL}`)
      response = await callGeminiAPI(FALLBACK_MODEL)
      usedModel = FALLBACK_MODEL
    }

    if (!response.ok) {
      let errorData = {}
      try {
        errorData = await response.json()
      } catch (e) {
        errorData = { error: { message: `HTTP ${response.status}` } }
      }
      console.error(`Gemini API error (model: ${usedModel}):`, errorData)

      // Provide more specific error messages
      let errorMessage = 'AI service error'
      const details = errorData.error?.message || 'Unknown error'

      if (response.status === 429) {
        errorMessage = 'Rate limit exceeded - please wait a moment'
      } else if (response.status === 404) {
        errorMessage = 'AI model not available - contact support'
      } else if (response.status === 403) {
        errorMessage = 'API access denied - check API key configuration'
      } else if (response.status >= 500) {
        errorMessage = 'AI service temporarily unavailable'
      }

      return {
        statusCode: response.status,
        body: JSON.stringify({
          message: errorMessage,
          details: details,
          model: usedModel
        })
      }
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!generatedText) {
      // Check for safety filters or other blocked responses
      const blockReason = data.candidates?.[0]?.finishReason
      const safetyRatings = data.candidates?.[0]?.safetyRatings
      console.error('No text generated. Finish reason:', blockReason, 'Safety:', safetyRatings)

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'No response generated from AI',
          details: blockReason === 'SAFETY' ? 'Content blocked by safety filters' : 'Empty response from model',
          model: usedModel
        })
      }
    }

    console.log(`Successfully generated response using model: ${usedModel}`)

    // Store in cache
    if (store) {
      try {
        await store.setJSON(cacheKey, {
          response: generatedText,
          timestamp: Date.now(),
          promptHash: cacheKey,
          model: usedModel
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
        'X-Cache': 'MISS',
        'X-Model': usedModel
      },
      body: JSON.stringify({
        response: generatedText,
        cached: false,
        model: usedModel
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

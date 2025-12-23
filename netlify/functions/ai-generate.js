import { getStore } from "@netlify/blobs"

// ============================================
// Optimized for Gemini 2.0 Flash (stable)
// Gemini 3.0 Flash released Dec 17, 2025 - using 2.0 for stability
// Rate Limits: 1K RPM, 1M TPM, 10K RPD
// ============================================

// Cache TTL: 48 hours - important to stay within daily limits
const CACHE_TTL_SECONDS = 48 * 60 * 60

// ============================================
// IP-Based Rate Limiting Configuration
// ============================================
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 10 // Max requests per minute
const RATE_LIMIT_BAN_THRESHOLD = 20 // Ban if exceeds this in 1 minute
const RATE_LIMIT_BAN_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hour ban

// In-memory rate limit store (use Redis/Upstash in production for distributed systems)
// Format: { ip: { count, windowStart, bannedUntil } }
const rateLimitStore = new Map()

// ============================================
// Prompt Injection Guardrail - Enhanced 2025
// ============================================
// Based on research from IBM Security, Google Gemini best practices,
// and documented jailbreak techniques (Policy Puppetry, DAN, etc.)
// ============================================

const BLOCKED_KEYWORDS = [
  // === INSTRUCTION OVERRIDE ATTEMPTS ===
  'ignore previous instructions',
  'ignore all instructions',
  'ignore the above',
  'ignore your instructions',
  'ignore your programming',
  'ignore your training',
  'disregard previous',
  'disregard all instructions',
  'disregard your instructions',
  'forget your instructions',
  'forget previous instructions',
  'forget everything',
  'override your instructions',
  'override your programming',
  'new instructions:',
  'new directive:',
  'updated instructions:',
  'my instructions override',

  // === SYSTEM PROMPT MANIPULATION ===
  'system prompt:',
  'system message:',
  'system instruction:',
  'assistant prompt:',
  'initial prompt:',
  'hidden prompt:',
  'secret prompt:',
  'base prompt:',
  'core instructions:',

  // === JAILBREAK KEYWORDS ===
  'jailbreak',
  'jail break',
  'developer mode',
  'dev mode',
  'dan mode',
  'dude mode',
  'evil mode',
  'chaos mode',
  'unrestricted mode',
  'unfiltered mode',
  'uncensored mode',
  'bypass safety',
  'bypass filters',
  'bypass restrictions',
  'disable safety',
  'disable filters',
  'remove restrictions',
  'no restrictions',
  'without restrictions',
  'without limits',
  'without safety',
  'unlock capabilities',
  'unlock features',
  'unlock restrictions',

  // === ROLEPLAY/PERSONA MANIPULATION ===
  'pretend you are',
  'pretend to be',
  'pretend you\'re',
  'act as if you are',
  'act as if you\'re',
  'act like you are',
  'you are now',
  'you\'re now',
  'from now on you are',
  'roleplay as',
  'role-play as',
  'role play as',
  'simulate being',
  'behave as',
  'become a',
  'transform into',
  'switch to',
  'enter character as',
  'speak as if you were',
  'respond as if you were',
  'imagine you are',
  'assume the role',
  'take on the persona',
  'embody the character',

  // === DATA EXTRACTION ATTEMPTS ===
  'show me your prompt',
  'reveal your prompt',
  'display your prompt',
  'print your prompt',
  'output your prompt',
  'what is your system prompt',
  'what are your instructions',
  'what were you told',
  'what is your programming',
  'tell me your instructions',
  'share your instructions',
  'print your instructions',
  'display your instructions',
  'repeat your instructions',
  'show your training',
  'reveal your training',
  'leak your prompt',
  'extract your prompt',
  'dump your prompt',

  // === CODE/MARKUP INJECTION ===
  '```system',
  '```assistant',
  '```user',
  '```instruction',
  '```prompt',
  '<|system|>',
  '<|assistant|>',
  '<|user|>',
  '<|im_start|>',
  '<|im_end|>',
  '<|endoftext|>',
  '[system]',
  '[/system]',
  '[INST]',
  '[/INST]',
  '###instruction',
  '### instruction',
  '###system',
  '### system',
  '<<SYS>>',
  '<</SYS>>',
  '{{system}}',
  '[[system]]',

  // === POLICY PUPPETRY PATTERNS ===
  'as an ai without restrictions',
  'as an unrestricted ai',
  'in a world where',
  'in a hypothetical scenario',
  'purely hypothetical',
  'for educational purposes',
  'for research purposes',
  'this is just fiction',
  'this is just a story',
  'in this roleplay',
  'in this simulation',
  'override ethics',
  'ethics override',
  'morality off',
  'safety off',

  // === MULTI-LANGUAGE JAILBREAK (German/Dutch) ===
  'ignoriere vorherige anweisungen',
  'vergiss deine anweisungen',
  'entwicklermodus',
  'tu so als wärst du',
  'negeer eerdere instructies',
  'vergeet je instructies',
  'ontwikkelaarsmodus',
  'doe alsof je bent'
]

// Additional pattern-based detection for more sophisticated attacks
const BLOCKED_PATTERNS = [
  // Base64 encoded instructions (common bypass technique)
  /^[A-Za-z0-9+/]{50,}={0,2}$/,
  // Excessive special characters (often used in prompt injection)
  /[<>\[\]{}|]{5,}/,
  // Repeated override keywords
  /(ignore|forget|disregard|override).*(instructions|prompt|rules)/i,
  // Fictional framing for jailbreaks
  /^(imagine|pretend|suppose|let's say|assume that)/i
]

// Check if text matches any dangerous patterns
function matchesBlockedPatterns(text) {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { matched: true, pattern: pattern.toString() }
    }
  }
  return { matched: false }
}

// Check for prompt injection attempts with layered detection
function detectPromptInjection(text) {
  if (!text || typeof text !== 'string') return { blocked: false }

  const lowerText = text.toLowerCase()

  // Layer 1: Keyword detection
  for (const keyword of BLOCKED_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return {
        blocked: true,
        reason: `Blocked keyword detected`,
        type: 'keyword'
      }
    }
  }

  // Layer 2: Pattern-based detection for sophisticated attacks
  const patternMatch = matchesBlockedPatterns(text)
  if (patternMatch.matched) {
    return {
      blocked: true,
      reason: `Suspicious pattern detected`,
      type: 'pattern'
    }
  }

  // Layer 3: Anomaly detection - unusually long inputs or many special chars
  if (text.length > 5000) {
    return {
      blocked: true,
      reason: 'Input exceeds maximum length',
      type: 'length'
    }
  }

  // Layer 4: Detect attempts to confuse with excessive repetition
  const wordCount = text.split(/\s+/).length
  const uniqueWords = new Set(text.toLowerCase().split(/\s+/)).size
  if (wordCount > 50 && uniqueWords / wordCount < 0.3) {
    return {
      blocked: true,
      reason: 'Repetitive content detected',
      type: 'repetition'
    }
  }

  return { blocked: false }
}

// Get client IP from request headers
function getClientIP(event) {
  // Netlify/Cloudflare headers for real IP
  return event.headers['x-nf-client-connection-ip'] ||
         event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         event.headers['x-real-ip'] ||
         event.headers['client-ip'] ||
         'unknown'
}

// Clean up expired entries from rate limit store
function cleanupRateLimitStore() {
  const now = Date.now()
  for (const [ip, data] of rateLimitStore.entries()) {
    // Remove if window expired and not banned
    if (data.windowStart + RATE_LIMIT_WINDOW_MS < now && (!data.bannedUntil || data.bannedUntil < now)) {
      rateLimitStore.delete(ip)
    }
  }
}

// Check rate limit for an IP
function checkRateLimit(ip) {
  const now = Date.now()

  // Periodic cleanup (every 100th request)
  if (Math.random() < 0.01) {
    cleanupRateLimitStore()
  }

  let data = rateLimitStore.get(ip)

  if (!data) {
    data = { count: 0, windowStart: now, bannedUntil: null }
    rateLimitStore.set(ip, data)
  }

  // Check if IP is banned
  if (data.bannedUntil && data.bannedUntil > now) {
    const remainingBanSeconds = Math.ceil((data.bannedUntil - now) / 1000)
    return {
      allowed: false,
      banned: true,
      remainingBanSeconds,
      message: `IP temporarily banned. Try again in ${Math.ceil(remainingBanSeconds / 3600)} hours.`
    }
  }

  // Reset window if expired
  if (data.windowStart + RATE_LIMIT_WINDOW_MS < now) {
    data.count = 0
    data.windowStart = now
    data.bannedUntil = null
  }

  // Increment count
  data.count++

  // Check if should be banned (exceeded 20 requests in 1 minute)
  if (data.count > RATE_LIMIT_BAN_THRESHOLD) {
    data.bannedUntil = now + RATE_LIMIT_BAN_DURATION_MS
    console.warn(`[Rate Limit] IP ${ip} banned for 24 hours (exceeded ${RATE_LIMIT_BAN_THRESHOLD} requests)`)
    return {
      allowed: false,
      banned: true,
      remainingBanSeconds: RATE_LIMIT_BAN_DURATION_MS / 1000,
      message: 'Too many requests. IP temporarily banned for 24 hours.'
    }
  }

  // Check if rate limited (exceeded 10 requests in 1 minute)
  if (data.count > RATE_LIMIT_MAX_REQUESTS) {
    const remainingWindowSeconds = Math.ceil((data.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
    return {
      allowed: false,
      banned: false,
      remainingWindowSeconds,
      currentCount: data.count,
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      message: `Rate limit exceeded. Try again in ${remainingWindowSeconds} seconds.`
    }
  }

  // Request allowed
  return {
    allowed: true,
    remainingRequests: RATE_LIMIT_MAX_REQUESTS - data.count,
    currentCount: data.count,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    windowResetSeconds: Math.ceil((data.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
  }
}

// Model configuration for website AI services (user-facing)
// gemini-2.5-flash: 1K RPM, 1M TPM, 10K RPD - best quality/speed balance
// gemini-2.0-flash: 2K RPM, 4M TPM, Unlimited RPD - stable fallback
const GEMINI_MODEL = 'gemini-3.0-flash'
const FALLBACK_MODEL = 'gemini-2.5-flash'  // Fallback if primary fails
const MAX_OUTPUT_TOKENS = 8192
const TEMPERATURE = 0.3  // Lower temperature for more consistent legal analysis

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

  // Get client IP for rate limiting
  const clientIP = getClientIP(event)

  // Check rate limit
  const rateLimitResult = checkRateLimit(clientIP)

  // Build rate limit headers for response
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
    'X-RateLimit-Remaining': String(rateLimitResult.remainingRequests || 0),
    'X-RateLimit-Reset': String(rateLimitResult.windowResetSeconds || 60),
    'X-RateLimit-Current': String(rateLimitResult.currentCount || 0)
  }

  // If rate limited or banned, return 429/403
  if (!rateLimitResult.allowed) {
    const statusCode = rateLimitResult.banned ? 403 : 429
    console.warn(`[Security] Rate limit: IP ${clientIP} - ${rateLimitResult.message}`)

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders,
        'Retry-After': String(rateLimitResult.remainingBanSeconds || rateLimitResult.remainingWindowSeconds || 60)
      },
      body: JSON.stringify({
        message: rateLimitResult.message,
        retryAfter: rateLimitResult.remainingBanSeconds || rateLimitResult.remainingWindowSeconds,
        banned: rateLimitResult.banned || false
      })
    }
  }

  // Get API key from environment variable
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: rateLimitHeaders,
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
        headers: rateLimitHeaders,
        body: JSON.stringify({ message: 'Prompt is required' })
      }
    }

    // Check for prompt injection attempts
    const injectionCheck = detectPromptInjection(prompt)
    if (injectionCheck.blocked) {
      console.warn(`[Security] Prompt injection blocked: IP ${clientIP} - ${injectionCheck.reason}`)
      return {
        statusCode: 400,
        headers: rateLimitHeaders,
        body: JSON.stringify({
          message: 'Invalid request: potentially harmful content detected.',
          blocked: true
        })
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
                'X-Cache-Age': `${ageHours}h`,
                ...rateLimitHeaders
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
      // Use v1beta API which supports systemInstruction and newer models
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
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitHeaders
        },
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
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitHeaders
        },
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
        'X-Model': usedModel,
        ...rateLimitHeaders
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
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders
      },
      body: JSON.stringify({
        message: 'Internal server error',
        details: error.message
      })
    }
  }
}

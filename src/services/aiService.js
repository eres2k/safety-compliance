const FRAMEWORK_CONTEXT = {
  AT: 'Austrian ASchG (ArbeitnehmerInnenschutzgesetz)',
  DE: 'German DGUV and ArbSchG (Arbeitsschutzgesetz)',
  NL: 'Dutch Arbowet (Arbeidsomstandighedenwet)'
}

const LANGUAGE_CONTEXT = {
  en: 'Respond in English.',
  de: 'Antworten Sie auf Deutsch.',
  nl: 'Antwoord in het Nederlands.'
}

// ============================================
// AI Response Cache - Reduces token usage
// ============================================
const CACHE_PREFIX = 'ai_cache_'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function generateCacheKey(type, ...args) {
  const hash = args.join('|').substring(0, 200) // Limit key length
  return `${CACHE_PREFIX}${type}_${btoa(hash).substring(0, 40)}`
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

function buildSystemPrompt(framework, language) {
  return `You are a WHS legal expert for ${FRAMEWORK_CONTEXT[framework]}.
Cite specific paragraphs. Be practical and concise.
${LANGUAGE_CONTEXT[language]}`
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
// Optimized Rate Limiter for Gemini 2.0 Flash
// Gemini limits: 2K RPM, 4M TPM, Unlimited RPD
// Using 3 second delay allows ~20 RPM with safety margin for concurrent users
// ============================================
const RATE_LIMIT_MS = 3 * 1000 // 3 seconds (optimized from 60s for Gemini 2K RPM)
const MAX_CONCURRENT_REQUESTS = 5 // Allow up to 5 concurrent requests
let lastRequestTime = 0
let activeRequests = 0
let requestQueue = Promise.resolve()

/**
 * Enforces a global rate limit on Gemini API requests.
 * Optimized for Gemini 2K RPM - allows concurrent requests with short delays.
 * Returns a promise that resolves when it's safe to make the next request.
 */
async function waitForRateLimit() {
  // Wait if we've hit max concurrent requests
  while (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  const waitTime = Math.max(0, RATE_LIMIT_MS - timeSinceLastRequest)

  if (waitTime > 0) {
    console.log(`[Rate Limit] Waiting ${(waitTime / 1000).toFixed(1)}s before next Gemini request...`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  lastRequestTime = Date.now()
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
 * @returns {object} { isLimited: boolean, remainingSeconds: number, activeRequests: number }
 */
export function getRateLimitStatus() {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  const remainingMs = Math.max(0, RATE_LIMIT_MS - timeSinceLastRequest)

  return {
    isLimited: remainingMs > 0 || activeRequests >= MAX_CONCURRENT_REQUESTS,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    rateLimitSeconds: RATE_LIMIT_MS / 1000,
    activeRequests,
    maxConcurrent: MAX_CONCURRENT_REQUESTS
  }
}

// Retry helper for transient failures
async function fetchWithRetry(url, options, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options)

      // Retry on 503 (Service Unavailable) or 429 (Rate Limited)
      if ((response.status === 503 || response.status === 429) && i < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        continue
      }

      return response
    } catch (error) {
      if (i < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        continue
      }
      throw error
    }
  }
}

export async function generateAIResponse(prompt, framework, language) {
  // Use rate-limited queue for all AI requests
  return queueRequest(async () => {
    const response = await fetchWithRetry('/.netlify/functions/ai-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        systemPrompt: buildSystemPrompt(framework, language)
      })
    })

    if (!response.ok) {
      let errorMessage = 'AI request failed'
      try {
        const error = await response.json()
        errorMessage = error.message || error.details || 'AI service error'
      } catch {
        errorMessage = `AI service error (${response.status})`
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data.response
  })
}

export async function explainSection(section, framework, language) {
  const prompt = `Explain this legal provision in simple terms.

${section.paragraph || section.title}
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

Be concise and use simple language.`

  const response = await generateAIResponse(prompt, framework, language)
  return normalizeNewlines(response)
}

export async function checkCompliance(companySize, industry, topic, framework, language) {
  const prompt = `Provide a compliance checklist for a ${industry} delivery station with ${companySize} employees regarding ${topic}.

Format your response as readable text with these sections:

📋 REQUIREMENTS
- List each requirement with its legal citation (e.g., "§ X.Y")
- Include brief description of what's required

📄 REQUIRED DOCUMENTATION
- List all documents that must be maintained

👥 PERSONNEL REQUIREMENTS
- List any required safety roles or certifications

⏰ DEADLINES & FREQUENCIES
- List recurring tasks and their frequencies

⚠️ PENALTIES FOR NON-COMPLIANCE
- List potential consequences

✅ IMPLEMENTATION STEPS
- List actionable steps to achieve compliance

Be concise and practical. Use bullet points. Include specific legal citations.`

  const response = await generateAIResponse(prompt, framework, language)
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

Be concise and practical. Use bullet points. Include specific legal citations.`

  const response = await generateAIResponse(prompt, framework, language)
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
  // Check cache first
  const cacheKey = generateCacheKey('simplify_both', lawText.substring(0, 500), sectionTitle, framework, language)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  const prompt = `You are an Amazon Workplace Health and Safety (WHS) expert. Create TWO COMPLETELY DIFFERENT versions of this regulation.

===VERSION 1: WHS SUMMARY (for safety managers)===
Write a professional WHS summary with these EXACT sections:

**Key WHS obligations:**
- [List specific compliance requirements with paragraph references]

**Compliance deadlines:**
- [List specific deadlines, frequencies, or "Ongoing" if continuous]

**Documentation required:**
- [List required records and documentation]

Keep it under 150 words. Focus on actionable compliance for Amazon logistics.

===VERSION 2: EXPLAIN LIKE I'M 5 (completely different!)===
Explain this like you're talking to a small child who knows nothing about work or laws:
- Use words a 5-year-old knows (no: compliance, obligations, regulations, employee, employer)
- Think: "The boss has to keep workers safe" instead of "employer obligations"
- Maximum 5 SHORT bullet points with fun emoji
- Each point under 10 words
- Be playful and simple!

Example good ELI5: "👷 Big people at work need helmets to protect their heads!"
Example bad ELI5: "Employers must ensure PPE compliance." (too formal!)

Section: ${sectionTitle || 'Regulation'}

Legal text:
${lawText.substring(0, 2500)}

OUTPUT FORMAT (use these EXACT headers on their own line):
---MANAGER---
**Key WHS obligations:**
- [obligations here]

**Compliance deadlines:**
- [deadlines here]

**Documentation required:**
- [documentation here]

---ASSOCIATE---
[5 simple emoji bullet points for a child]`

  const response = await generateAIResponse(prompt, framework, language)

  // Normalize escaped newlines
  const normalizedResponse = normalizeNewlines(response)

  // Parse the combined response
  const result = { manager: '', associate: '' }
  const managerMatch = normalizedResponse.match(/---MANAGER---\s*([\s\S]*?)(?=---ASSOCIATE---|$)/i)
  const associateMatch = normalizedResponse.match(/---ASSOCIATE---\s*([\s\S]*?)$/i)

  if (managerMatch) result.manager = managerMatch[1].trim()
  if (associateMatch) result.associate = associateMatch[1].trim()

  // Fallback if parsing fails - try to create meaningful defaults
  if (!result.manager && !result.associate) {
    // If no headers found, check if content looks like manager or associate style
    const hasManagerStyle = normalizedResponse.match(/(?:obligations|deadlines|documentation|compliance)/i)
    const hasELI5Style = normalizedResponse.match(/[👷⚠️✅❌🚫💡🦺🏥📋]/)

    if (hasManagerStyle && !hasELI5Style) {
      result.manager = normalizedResponse
      result.associate = '👉 This rule helps keep workers safe at work.\n⚠️ The boss must follow safety rules.\n✅ Everyone should know these rules.'
    } else if (hasELI5Style && !hasManagerStyle) {
      result.associate = normalizedResponse
      result.manager = '**Key WHS obligations:**\n- Review and comply with applicable regulations\n\n**Compliance deadlines:**\n- Ongoing compliance required\n\n**Documentation required:**\n- Maintain compliance records'
    } else {
      // Genuinely ambiguous - provide distinct defaults
      result.manager = normalizedResponse
      result.associate = '👉 This is a safety rule for work.\n⚠️ It helps keep everyone safe.\n✅ Ask your boss if you have questions!'
    }
  } else if (!result.manager) {
    result.manager = '**Key WHS obligations:**\n- Review section for specific requirements\n\n**Compliance deadlines:**\n- Check original text for deadlines\n\n**Documentation required:**\n- Maintain relevant records'
  } else if (!result.associate) {
    result.associate = '👉 This is a safety rule for work.\n⚠️ It helps keep everyone safe.\n✅ Ask your boss if you have questions!'
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

  const prompt = `You are an Amazon Workplace Health and Safety (WHS) expert. Rewrite this legal regulation as a concise WHS SUMMARY.

RULES:
1. Extract key compliance obligations and deadlines relevant to Amazon logistics operations
2. Use bullet points for clarity
3. Format: "Key WHS obligations: [list]" then "Compliance deadlines: [list]" then "Documentation required: [list]"
4. Keep it under 150 words
5. Focus on actionable compliance requirements for delivery station operations
6. Include specific numbers (e.g., "every 12 months", "within 3 days")

Section: ${sectionTitle || 'Regulation'}

Legal text:
${lawText.substring(0, 3000)}`

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

  const prompt = `Explain this safety regulation like you're talking to a 5-year-old child who knows nothing about work or laws.

RULES:
1. Use ONLY words a 5-year-old knows - no: compliance, obligations, regulations, employee, employer, provisions
2. Think: "The boss has to keep workers safe" instead of "employer obligations"
3. Very short sentences - under 10 words each
4. Maximum 5 bullet points with fun emoji
5. Focus ONLY on the basic safety idea
6. Be playful and simple!

GOOD examples:
- "👷 Big people at work need helmets to protect their heads!"
- "⚠️ If something looks dangerous, tell a grown-up right away!"
- "✅ Everyone gets breaks to rest and drink water!"

BAD examples (too formal):
- "Employers must ensure PPE compliance"
- "Employees have the right to refuse unsafe work"

Section: ${sectionTitle || 'Safety Rule'}

Legal text:
${lawText.substring(0, 2000)}`

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
[One sentence]`

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

  const prompt = `You are a logistics safety expert. Analyze this regulation and tag it with relevant Amazon Logistics roles and equipment.

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

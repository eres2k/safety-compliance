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
IMPORTANT: Always respond with valid JSON format only. No markdown, no code blocks, just raw JSON.
${LANGUAGE_CONTEXT[language]}`
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
}

export async function explainSection(section, framework, language) {
  const prompt = `Explain this legal provision in simple terms.

${section.paragraph || section.title}
${section.content}

Return ONLY a valid JSON object with this structure:
{
  "title": "provision title",
  "summary": "brief plain language summary",
  "keyPoints": ["key point 1", "key point 2"],
  "employerDuties": ["duty 1", "duty 2"],
  "employeeRights": ["right 1", "right 2"],
  "practicalTips": ["tip 1", "tip 2"]
}

Be concise. Only include relevant information.`

  return generateAIResponse(prompt, framework, language)
}

export async function checkCompliance(companySize, industry, topic, framework, language) {
  const prompt = `Provide a compliance checklist for a ${industry} company with ${companySize} employees regarding ${topic}.

Return ONLY a valid JSON object with this structure:
{
  "topic": "${topic}",
  "requirements": [
    {
      "title": "requirement title",
      "citation": "legal paragraph reference",
      "description": "brief description"
    }
  ],
  "documentation": ["required document 1", "required document 2"],
  "personnel": ["role requirement if any"],
  "deadlines": [
    {
      "item": "what needs to be done",
      "frequency": "how often"
    }
  ],
  "penalties": ["penalty description"],
  "steps": ["implementation step 1", "implementation step 2"]
}

Be concise. Only include relevant information.`

  return generateAIResponse(prompt, framework, language)
}

export async function generateDocument(templateName, inputs, framework, language) {
  const inputDetails = Object.entries(inputs)
    .map(([key, value]) => `${key}: ${value || 'Not specified'}`)
    .join('\n')

  const prompt = `Generate a ${templateName} document with the following details:

${inputDetails}

Return ONLY a valid JSON object with this structure:
{
  "documentType": "${templateName}",
  "title": "document title",
  "sections": [
    {
      "heading": "section heading",
      "content": "section content"
    }
  ],
  "legalReferences": ["citation 1", "citation 2"],
  "signatureRequired": true,
  "fields": {
    "field_name": "field_value"
  }
}

Be concise. Only include relevant information.`

  return generateAIResponse(prompt, framework, language)
}

export async function lookupRegulation(topic, companySize, framework, language) {
  const prompt = `What are the specific legal requirements for "${topic}" in a company with ${companySize || 'any number of'} employees?

Return ONLY a valid JSON object with this structure:
{
  "topic": "${topic}",
  "legalRequirements": [
    {
      "citation": "paragraph reference",
      "requirement": "brief description"
    }
  ],
  "implementationSteps": ["step 1", "step 2"],
  "documentation": ["required record 1", "required record 2"],
  "deadlines": [
    {
      "task": "what needs to be done",
      "frequency": "how often"
    }
  ],
  "penalties": ["penalty description"],
  "checklist": [
    {
      "item": "checklist item description",
      "required": true
    }
  ]
}

Be concise. Only include relevant information.`

  return generateAIResponse(prompt, framework, language)
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
  setCachedResponse(cacheKey, response)
  return response
}

// Feature 2: Legalese Complexity Slider - Simplify legal text
// Combined function that returns BOTH levels in a single API call (saves ~50% tokens)
export async function simplifyForBothLevels(lawText, sectionTitle, framework, language) {
  // Check cache first
  const cacheKey = generateCacheKey('simplify_both', lawText.substring(0, 500), sectionTitle, framework, language)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  const prompt = `You are a workplace safety expert. Create TWO versions of this regulation.

===MANAGER VERSION===
Rewrite as a concise MANAGER SUMMARY:
- Extract key obligations and deadlines
- Use bullet points for clarity
- Format: "Key obligations:" then "Deadlines:" then "Records required:"
- Keep it under 150 words
- Focus on what managers need to DO

===ASSOCIATE VERSION===
Rewrite as a simple TOOLBOX TALK for floor workers:
- Use simple, direct language (8th grade level)
- Write as direct instructions: "Do this", "Don't do that"
- Maximum 5 bullet points, each under 10 words
- Focus ONLY on what the worker must do personally
- Add safety emoji where helpful (⚠️ 🦺 🔧 ⛑️ 🚫)

Section: ${sectionTitle || 'Regulation'}

Legal text:
${lawText.substring(0, 2500)}

OUTPUT FORMAT (use these exact headers):
---MANAGER---
[manager summary here]

---ASSOCIATE---
[associate toolbox talk here]`

  const response = await generateAIResponse(prompt, framework, language)

  // Parse the combined response
  const result = { manager: '', associate: '' }
  const managerMatch = response.match(/---MANAGER---\s*([\s\S]*?)(?=---ASSOCIATE---|$)/i)
  const associateMatch = response.match(/---ASSOCIATE---\s*([\s\S]*?)$/i)

  if (managerMatch) result.manager = managerMatch[1].trim()
  if (associateMatch) result.associate = associateMatch[1].trim()

  // Fallback if parsing fails - return full response for both
  if (!result.manager && !result.associate) {
    result.manager = response
    result.associate = response
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

  const prompt = `You are a workplace safety expert. Rewrite this legal regulation as a concise MANAGER SUMMARY.

RULES:
1. Extract key obligations and deadlines
2. Use bullet points for clarity
3. Format: "Key obligations: [list]" then "Deadlines: [list]" then "Records required: [list]"
4. Keep it under 150 words
5. Focus on what managers need to DO, not legal theory
6. Include specific numbers (e.g., "every 12 months", "within 3 days")

Section: ${sectionTitle || 'Regulation'}

Legal text:
${lawText.substring(0, 3000)}`

  const response = await generateAIResponse(prompt, framework, language)
  setCachedResponse(cacheKey, response)
  return response
}

export async function simplifyForAssociate(lawText, sectionTitle, framework, language) {
  // Check cache first
  const cacheKey = generateCacheKey('simplify_associate', lawText.substring(0, 500), sectionTitle, framework, language)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  const prompt = `You are a safety trainer. Rewrite this regulation as a simple "TOOLBOX TALK" for warehouse/logistics floor workers.

RULES:
1. Use simple, direct language (8th grade reading level)
2. Write as direct instructions: "Do this", "Don't do that", "Always check..."
3. Maximum 5 bullet points
4. Each point under 10 words
5. Focus ONLY on what the worker personally must do
6. No legal jargon, no paragraph references
7. Add relevant safety icons as emoji where helpful (e.g., ⚠️ 🦺 🔧 ⛑️ 🚫)

Section: ${sectionTitle || 'Safety Rule'}

Legal text:
${lawText.substring(0, 2000)}`

  const response = await generateAIResponse(prompt, framework, language)
  setCachedResponse(cacheKey, response)
  return response
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
  setCachedResponse(cacheKey, response)
  return response
}

// Feature 3b: Multi-Country Comparison - Compare laws across all 3 jurisdictions
export async function compareMultipleCountries(lawText, sourceFramework, language) {
  // Check cache first
  const cacheKey = generateCacheKey('multi_country', lawText.substring(0, 300), sourceFramework, language)
  const cached = getCachedResponse(cacheKey)
  if (cached) return cached

  const prompt = `Compare this ${sourceFramework} regulation across AT, DE, NL.

SOURCE (${sourceFramework}):
${lawText.substring(0, 1000)}

FORMAT:
---TOPIC---
[5-10 words]

---AT_PROVISION---
[§ citation + 1 sentence]

---DE_PROVISION---
[§ citation + 1 sentence]

---NL_PROVISION---
[Artikel citation + 1 sentence]

---COMPARISON_TABLE---
| Aspect | AT | DE | NL |
[4 rows max]

---KEY_DIFFERENCES---
⚠️ [3 differences, one per line]

---HARMONIZATION_TIPS---
✅ [3 tips, one per line]`

  const response = await generateAIResponse(prompt, sourceFramework, language)
  setCachedResponse(cacheKey, response)
  return response
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
  setCachedResponse(cacheKey, response)
  return response
}

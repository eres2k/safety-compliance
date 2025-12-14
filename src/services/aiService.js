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

function buildSystemPrompt(framework, language) {
  return `You are a Workplace Health and Safety legal expert specializing in ${FRAMEWORK_CONTEXT[framework]}.

RULES:
1. ALWAYS cite specific paragraphs (e.g., "§ 25 ASchG" or "§ 5 ArbSchG" or "Artikel 5 Arbowet")
2. Provide practical, actionable guidance
3. Be precise with legal requirements
4. When explaining complex terms, use plain language
5. If unsure, recommend consulting authorities or legal counsel
6. Structure responses with clear sections
7. Include relevant deadlines and penalties where applicable
8. ${LANGUAGE_CONTEXT[language]}

Current Legal Framework: ${framework}
Framework Name: ${FRAMEWORK_CONTEXT[framework]}`
}

export async function generateAIResponse(prompt, framework, language) {
  // Call the Netlify function instead of directly calling Gemini
  const response = await fetch('/.netlify/functions/ai-generate', {
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
    const error = await response.json()
    throw new Error(error.message || 'AI request failed')
  }

  const data = await response.json()
  return data.response
}

export async function explainSection(section, framework, language) {
  const prompt = `Explain this legal provision in simple, plain language that a non-lawyer can understand. Focus on practical implications for employers and employees:

${section.paragraph || section.title}
${section.content}`

  return generateAIResponse(prompt, framework, language)
}

export async function checkCompliance(companySize, industry, topic, framework, language) {
  const prompt = `Provide a detailed compliance checklist for a ${industry} company with ${companySize} employees regarding ${topic}.

Include:
1. Specific legal requirements with paragraph citations
2. Required documentation
3. Personnel requirements (if any)
4. Deadlines and frequencies for reviews/inspections
5. Potential penalties for non-compliance
6. Practical implementation steps

Format the response with clear sections and bullet points.`

  return generateAIResponse(prompt, framework, language)
}

export async function generateDocument(templateName, inputs, framework, language) {
  const inputDetails = Object.entries(inputs)
    .map(([key, value]) => `${key}: ${value || 'Not specified'}`)
    .join('\n')

  const prompt = `Generate a professional ${templateName} document with the following details:

${inputDetails}

The document should:
1. Follow the legal requirements of the current framework
2. Include relevant legal citations
3. Be structured professionally with clear sections
4. Include all necessary fields for compliance
5. Be ready to use (only requiring signature if applicable)

Generate the complete document content in a professional format.`

  return generateAIResponse(prompt, framework, language)
}

export async function lookupRegulation(topic, companySize, framework, language) {
  const prompt = `What are the specific legal requirements for "${topic}" in a company with ${companySize || 'any number of'} employees?

Provide:
1. **Specific Legal Requirements** - Cite exact paragraphs
2. **Practical Implementation Steps** - What exactly needs to be done
3. **Documentation Requirements** - What records must be kept
4. **Frequency/Deadlines** - How often things must be reviewed/done
5. **Penalties for Non-Compliance** - What happens if not followed
6. **Checklist** - A simple yes/no checklist to verify compliance

Be specific and practical. Include all relevant legal citations.`

  return generateAIResponse(prompt, framework, language)
}

/**
 * Generate a Mermaid.js flowchart from legal text
 * Converts dense legal paragraphs into visual decision trees
 */
export async function generateFlowchart(lawText, sectionTitle, framework) {
  const prompt = `You are a visual logic expert. Create a Mermaid.js flowchart to explain this regulation.

RULES:
1. Use 'graph TD' (Top-Down) orientation.
2. Use concise node labels (max 8 words per node).
3. Focus on "If/Then" decision points and key obligations in the law.
4. Use diamond shapes for decisions: {Decision?}
5. Use rounded rectangles for actions: (Action)
6. Use rectangles for requirements: [Requirement]
7. Output ONLY the raw Mermaid syntax string. No markdown code blocks, no explanations.
8. Keep the flowchart focused and readable (max 15 nodes).
9. Use clear Yes/No or specific labels on arrows.

Section Title: ${sectionTitle || 'Legal Provision'}

Regulation Text:
${lawText.substring(0, 4000)}`

  const response = await fetch('/.netlify/functions/ai-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      systemPrompt: `You are a legal visualization expert. Convert legal text into clear Mermaid.js flowcharts. Output ONLY valid Mermaid syntax, nothing else.`
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Flowchart generation failed')
  }

  const data = await response.json()
  // Clean the response - remove any markdown code blocks if present
  let mermaidCode = data.response.trim()
  mermaidCode = mermaidCode.replace(/^```mermaid\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '')
  return mermaidCode
}

/**
 * Simplify legal text to different complexity levels
 * @param {string} lawText - The original legal text
 * @param {string} level - 'legal' | 'manager' | 'associate'
 * @param {string} framework - Country framework (AT, DE, NL)
 * @param {string} language - Language code
 */
export async function simplifyText(lawText, level, framework, language) {
  const levelPrompts = {
    legal: `Present this legal text in its original form with proper legal terminology. Add brief clarifications in brackets where complex terms appear. Keep all legal citations intact.`,

    manager: `Rewrite this legal provision as a Manager Summary.
RULES:
1. Focus on KEY OBLIGATIONS and DEADLINES
2. Use bullet points
3. Start with "Key Requirements:"
4. Include specific timeframes (e.g., "Train staff every 12 months")
5. Mention documentation requirements
6. Include penalties if mentioned
7. Max 150 words
8. Keep legal citations (e.g., "§ 25 ASchG")`,

    associate: `Rewrite this legal provision as a simple "Toolbox Talk" for floor workers.
RULES:
1. Use VERY simple language (8th grade reading level)
2. Focus on what THEY need to DO
3. Use short sentences (max 10 words each)
4. Use bullet points with action verbs
5. NO legal jargon
6. Include safety warnings if relevant
7. Max 80 words
8. Format: "DO:" and "DON'T:" sections if applicable`
  }

  const prompt = `${levelPrompts[level] || levelPrompts.manager}

Original Legal Text:
${lawText.substring(0, 3000)}`

  return generateAIResponse(prompt, framework, language)
}

/**
 * Find semantically equivalent law sections across jurisdictions
 * @param {string} sourceLawText - The source law text to match
 * @param {string} sourceFramework - Source country (AT, DE, NL)
 * @param {string} targetFramework - Target country to search
 * @param {Array} targetLawSections - Array of law sections from target jurisdiction
 */
export async function findSemanticMatch(sourceLawText, sourceTitle, sourceFramework, targetFramework, targetLawSections) {
  // Create a summary of available target sections
  const targetSummary = targetLawSections.slice(0, 50).map(s =>
    `- ${s.number}: ${s.title || ''} (${s.content?.substring(0, 100) || ''}...)`
  ).join('\n')

  const prompt = `You are a cross-border legal harmonization expert.

SOURCE LAW (${FRAMEWORK_CONTEXT[sourceFramework]}):
Title: ${sourceTitle}
Text: ${sourceLawText.substring(0, 2000)}

TARGET JURISDICTION: ${FRAMEWORK_CONTEXT[targetFramework]}
Available sections:
${targetSummary}

TASK: Find the MOST semantically equivalent section(s) in the target jurisdiction.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "matches": [
    {"number": "section_number", "relevance": "high|medium|low", "reason": "brief explanation"}
  ],
  "key_differences": ["difference 1", "difference 2"],
  "compliance_warning": "any critical difference that could cause non-compliance"
}

Output ONLY valid JSON, no markdown.`

  const response = await fetch('/.netlify/functions/ai-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      systemPrompt: `You are an EU workplace safety law expert. Find equivalent regulations across jurisdictions. Output ONLY valid JSON.`
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Semantic matching failed')
  }

  const data = await response.json()
  try {
    // Clean and parse JSON response
    let jsonStr = data.response.trim()
    jsonStr = jsonStr.replace(/^```json\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '')
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error('Failed to parse semantic match response:', e)
    return { matches: [], key_differences: ['Unable to analyze'], compliance_warning: 'Analysis failed' }
  }
}

/**
 * Compare two law sections from different jurisdictions
 */
export async function compareJurisdictions(sourceLaw, targetLaw, sourceFramework, targetFramework, language) {
  const prompt = `Compare these two workplace safety regulations from different EU countries:

SOURCE (${FRAMEWORK_CONTEXT[sourceFramework]}):
${sourceLaw.title || sourceLaw.number}
${sourceLaw.content?.substring(0, 1500) || sourceLaw.text?.substring(0, 1500)}

TARGET (${FRAMEWORK_CONTEXT[targetFramework]}):
${targetLaw.title || targetLaw.number}
${targetLaw.content?.substring(0, 1500) || targetLaw.text?.substring(0, 1500)}

Provide a comparison with:
1. **Common Requirements** - What both regulations require
2. **Key Differences** - Important distinctions (training frequency, documentation, etc.)
3. **Stricter Requirements** - Which jurisdiction is stricter and on what points
4. **Compliance Warning** - Critical differences that could cause non-compliance when transferring processes
5. **Recommendation** - Practical advice for cross-border compliance

Be specific and cite exact requirements from each law.`

  return generateAIResponse(prompt, sourceFramework, language)
}

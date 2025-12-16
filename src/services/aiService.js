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

export async function generateFlowchart(lawText, framework, language) {
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

  return generateAIResponse(prompt, framework, language)
}

// Feature 2: Legalese Complexity Slider - Simplify legal text
export async function simplifyForManager(lawText, sectionTitle, framework, language) {
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

  return generateAIResponse(prompt, framework, language)
}

export async function simplifyForAssociate(lawText, sectionTitle, framework, language) {
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

  return generateAIResponse(prompt, framework, language)
}

// Feature 3: Cross-Border Harmonizer - Find equivalent laws across jurisdictions
export async function findEquivalentLaw(lawText, sourceFramework, targetFramework, language) {
  const frameworkNames = {
    AT: 'Austrian ASchG',
    DE: 'German DGUV/ArbSchG',
    NL: 'Dutch Arbowet'
  }

  const prompt = `You are an EU workplace safety law expert. Analyze this ${frameworkNames[sourceFramework]} regulation and find its equivalent in ${frameworkNames[targetFramework]}.

SOURCE REGULATION (${frameworkNames[sourceFramework]}):
${lawText.substring(0, 2500)}

TASK:
1. Identify the equivalent provision in ${frameworkNames[targetFramework]}
2. Compare the key requirements
3. Highlight IMPORTANT DIFFERENCES that could affect compliance

FORMAT YOUR RESPONSE EXACTLY AS:
---EQUIVALENT---
[Cite the equivalent paragraph/article in ${targetFramework}]

---COMPARISON---
| Requirement | ${sourceFramework} | ${targetFramework} |
|-------------|-----|-----|
[Table comparing 3-5 key points]

---DIFFERENCES---
⚠️ [List critical differences that require attention, each on new line starting with ⚠️]

---RECOMMENDATION---
[One sentence recommendation for cross-border compliance]`

  return generateAIResponse(prompt, sourceFramework, language)
}

// Feature 3b: Multi-Country Comparison - Compare laws across all 3 jurisdictions
export async function compareMultipleCountries(lawText, sourceFramework, language) {
  const frameworkNames = {
    AT: 'Austrian ASchG',
    DE: 'German DGUV/ArbSchG',
    NL: 'Dutch Arbowet'
  }

  const allFrameworks = ['AT', 'DE', 'NL']
  const otherFrameworks = allFrameworks.filter(f => f !== sourceFramework)

  const prompt = `You are an EU workplace safety law expert. Analyze this ${frameworkNames[sourceFramework]} regulation and find equivalent provisions in ALL other EU member state frameworks (${otherFrameworks.map(f => frameworkNames[f]).join(' and ')}).

SOURCE REGULATION (${frameworkNames[sourceFramework]}):
${lawText.substring(0, 2500)}

TASK:
Compare this regulation across all 3 frameworks: ${allFrameworks.map(f => frameworkNames[f]).join(', ')}

FORMAT YOUR RESPONSE EXACTLY AS:
---TOPIC---
[Brief description of the regulation topic in 5-10 words]

---AT_PROVISION---
[For Austrian ASchG: cite specific paragraph (e.g., § 25 ASchG) and 1-2 sentence summary of requirements]

---DE_PROVISION---
[For German DGUV/ArbSchG: cite specific paragraph (e.g., § 5 ArbSchG) and 1-2 sentence summary of requirements]

---NL_PROVISION---
[For Dutch Arbowet: cite specific article (e.g., Artikel 5 Arbowet) and 1-2 sentence summary of requirements]

---COMPARISON_TABLE---
| Aspect | 🇦🇹 Austria | 🇩🇪 Germany | 🇳🇱 Netherlands |
|--------|------------|------------|----------------|
[Compare 4-6 key aspects: requirements, thresholds, deadlines, documentation, penalties, etc.]

---KEY_DIFFERENCES---
⚠️ [List 3-5 critical differences between the frameworks, each on new line starting with ⚠️]

---HARMONIZATION_TIPS---
✅ [3-5 practical tips for companies operating in all 3 countries, each on new line starting with ✅]`

  return generateAIResponse(prompt, sourceFramework, language)
}

// Feature 4: Semantic Tagging - Tag law text with roles and equipment
export async function generateSemanticTags(lawText, sectionNumber, framework, language) {
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

  return generateAIResponse(prompt, framework, language)
}

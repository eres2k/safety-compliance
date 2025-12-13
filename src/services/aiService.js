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

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

// Claude API call helper
async function callClaudeAPI(apiKey, prompt, systemPrompt) {
  const response = await fetchWithRetry(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250414',
        max_tokens: 2048,
        system: systemPrompt || 'You are a helpful assistant specializing in EU safety law compliance.',
        messages: [{ role: 'user', content: prompt }]
      })
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error?.message || `Claude API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || null
}

// Gemini API call helper
async function callGeminiAPI(apiKey, prompt, systemPrompt) {
  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048
        }
      })
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null
}

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    }
  }

  // Get API keys from environment variables
  // Priority: Claude (ANTHROPIC_API_KEY) > Gemini (GEMINI_API_KEY)
  const claudeApiKey = process.env.ANTHROPIC_API_KEY
  const geminiApiKey = process.env.GEMINI_API_KEY

  // Determine which provider to use (can be overridden via AI_PROVIDER env var)
  const preferredProvider = process.env.AI_PROVIDER?.toLowerCase() || 'auto'

  let useProvider = null
  let apiKey = null

  if (preferredProvider === 'claude' && claudeApiKey) {
    useProvider = 'claude'
    apiKey = claudeApiKey
  } else if (preferredProvider === 'gemini' && geminiApiKey) {
    useProvider = 'gemini'
    apiKey = geminiApiKey
  } else if (preferredProvider === 'auto') {
    // Auto: prefer Claude if available, fallback to Gemini
    if (claudeApiKey) {
      useProvider = 'claude'
      apiKey = claudeApiKey
    } else if (geminiApiKey) {
      useProvider = 'gemini'
      apiKey = geminiApiKey
    }
  }

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'AI service not configured. Please set ANTHROPIC_API_KEY or GEMINI_API_KEY in Netlify environment variables.'
      })
    }
  }

  try {
    const { prompt, systemPrompt } = JSON.parse(event.body)

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Prompt is required' })
      }
    }

    let generatedText = null

    if (useProvider === 'claude') {
      generatedText = await callClaudeAPI(apiKey, prompt, systemPrompt)
    } else {
      generatedText = await callGeminiAPI(apiKey, prompt, systemPrompt)
    }

    if (!generatedText) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'No response generated from AI' })
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        response: generatedText,
        provider: useProvider
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

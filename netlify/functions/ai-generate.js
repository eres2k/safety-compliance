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

export async function handler(event) {
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
    const { prompt, systemPrompt } = JSON.parse(event.body)

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Prompt is required' })
      }
    }

    // Use gemini-pro for widest availability
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ response: generatedText })
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

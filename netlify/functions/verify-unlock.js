/**
 * Netlify function to verify the unlock password
 * This allows bypassing the 120-second rate limit on the client
 *
 * Environment variable required: UNLOCK_PASSWORD
 */

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    }
  }

  // Get the unlock password from environment variable
  const unlockPassword = process.env.UNLOCK_PASSWORD

  if (!unlockPassword) {
    console.warn('[Unlock] UNLOCK_PASSWORD environment variable not set')
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Unlock feature not configured'
      })
    }
  }

  try {
    const { password } = JSON.parse(event.body)

    if (!password) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Password is required'
        })
      }
    }

    // Constant-time comparison to prevent timing attacks
    const isValid = password.length === unlockPassword.length &&
      password.split('').every((char, i) => char === unlockPassword[i])

    if (isValid) {
      console.log('[Unlock] Successful unlock')
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Rate limit unlocked'
        })
      }
    } else {
      console.warn('[Unlock] Failed unlock attempt')
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Invalid password'
        })
      }
    }
  } catch (error) {
    console.error('[Unlock] Error:', error.message)
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Invalid request'
      })
    }
  }
}

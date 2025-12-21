import { useState } from 'react'
import { verifyUnlockPassword, lockRateLimit, isRateLimitUnlocked } from '../../services/aiService'

/**
 * UnlockButton - Button to unlock the 120s rate limit with a password
 * Shows a modal for password input when clicked
 */
export function UnlockButton({ variant = 'default', onUnlock }) {
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(isRateLimitUnlocked())

  const handleUnlock = async (e) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    setLoading(true)
    setError('')

    const result = await verifyUnlockPassword(password)

    setLoading(false)

    if (result.success) {
      setIsUnlocked(true)
      setIsOpen(false)
      setPassword('')
      if (onUnlock) onUnlock()
    } else {
      setError(result.message || 'Invalid password')
    }
  }

  const handleLock = () => {
    lockRateLimit()
    setIsUnlocked(false)
  }

  // If already unlocked, show lock button
  if (isUnlocked) {
    return (
      <button
        onClick={handleLock}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
          ${variant === 'compact'
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
            : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        title="Click to re-enable rate limit"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
        Unlocked
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
          ${variant === 'compact'
            ? 'bg-whs-dark-700 text-gray-300 hover:bg-whs-dark-600 border border-whs-dark-500'
            : 'bg-whs-orange-500/20 text-whs-orange-400 hover:bg-whs-orange-500/30 border border-whs-orange-500/30'
          }`}
        title="Unlock rate limit with password"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Unlock
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-whs-dark-800 border border-whs-dark-600 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-whs-orange-500/20 rounded-lg">
                <svg className="w-6 h-6 text-whs-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Unlock Rate Limit</h3>
                <p className="text-sm text-gray-400">Remove the 120s cooldown</p>
              </div>
            </div>

            <form onSubmit={handleUnlock}>
              <div className="mb-4">
                <label htmlFor="unlock-password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  id="unlock-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter unlock password"
                  className="w-full px-4 py-2.5 bg-whs-dark-700 border border-whs-dark-500 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-whs-orange-500 focus:border-transparent"
                  autoFocus
                  disabled={loading}
                />
                {error && (
                  <p className="mt-2 text-sm text-red-400">{error}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    setPassword('')
                    setError('')
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-whs-dark-700 hover:bg-whs-dark-600 rounded-lg transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-whs-orange-500 hover:bg-whs-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </span>
                  ) : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default UnlockButton

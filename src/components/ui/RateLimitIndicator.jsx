import { useState, useEffect } from 'react'
import { getRateLimitStatus } from '../../services/aiService'

/**
 * RateLimitIndicator - Shows countdown when API is rate limited
 * Can be used inline or as a floating indicator
 */
export function RateLimitIndicator({ variant = 'inline', onReady }) {
  const [status, setStatus] = useState({ isLimited: false, remainingSeconds: 0 })

  useEffect(() => {
    // Update status every second
    const updateStatus = () => {
      const newStatus = getRateLimitStatus()
      setStatus(newStatus)

      // Callback when rate limit expires
      if (!newStatus.isLimited && onReady) {
        onReady()
      }
    }

    updateStatus()
    const interval = setInterval(updateStatus, 1000)

    return () => clearInterval(interval)
  }, [onReady])

  if (!status.isLimited) {
    return null
  }

  const progress = ((status.rateLimitSeconds - status.remainingSeconds) / status.rateLimitSeconds) * 100

  if (variant === 'floating') {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-whs-dark-800 border border-whs-dark-600 rounded-xl p-4 shadow-lg animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 transform -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="#334155"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="#f97316"
                strokeWidth="3"
                strokeDasharray={`${progress} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-whs-orange-400">
              {status.remainingSeconds}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-white">AI Cooldown</p>
            <p className="text-xs text-gray-400">{status.remainingSeconds}s remaining</p>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-whs-orange-500/10 border border-whs-orange-500/20 rounded-full">
        <div className="w-4 h-4 border-2 border-whs-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-whs-orange-400 font-medium">{status.remainingSeconds}s</span>
      </div>
    )
  }

  // Default inline variant
  return (
    <div className="flex items-center gap-3 p-3 bg-whs-orange-500/10 border border-whs-orange-500/20 rounded-lg">
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 transform -rotate-90">
          <circle
            cx="16"
            cy="16"
            r="12"
            fill="none"
            stroke="#334155"
            strokeWidth="2"
          />
          <circle
            cx="16"
            cy="16"
            r="12"
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
            strokeDasharray={`${progress} 100`}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-whs-orange-400">AI Rate Limited</p>
        <p className="text-xs text-gray-400">Next request available in {status.remainingSeconds}s</p>
      </div>
      <div className="w-24 h-1.5 bg-whs-dark-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-whs-orange-500 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

/**
 * useRateLimitStatus - Hook to get current rate limit status
 */
export function useRateLimitStatus() {
  const [status, setStatus] = useState({ isLimited: false, remainingSeconds: 0, rateLimitSeconds: 60 })

  useEffect(() => {
    const updateStatus = () => {
      setStatus(getRateLimitStatus())
    }

    updateStatus()
    const interval = setInterval(updateStatus, 1000)

    return () => clearInterval(interval)
  }, [])

  return status
}

export default RateLimitIndicator

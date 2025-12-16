import { useState } from 'react'

const FRAMEWORK_CONFIG = {
  AT: { name: 'Austria', flag: '🇦🇹', color: 'red' },
  DE: { name: 'Germany', flag: '🇩🇪', color: 'yellow' },
  NL: { name: 'Netherlands', flag: '🇳🇱', color: 'orange' }
}

// Parse the AI response into structured sections
function parseComparisonResponse(response) {
  if (!response) return null

  const sections = {
    equivalent: '',
    comparison: '',
    differences: [],
    recommendation: ''
  }

  try {
    // Extract equivalent section
    const equivalentMatch = response.match(/---EQUIVALENT---\s*([\s\S]*?)(?=---COMPARISON---|$)/i)
    if (equivalentMatch) {
      sections.equivalent = equivalentMatch[1].trim()
    }

    // Extract comparison table
    const comparisonMatch = response.match(/---COMPARISON---\s*([\s\S]*?)(?=---DIFFERENCES---|$)/i)
    if (comparisonMatch) {
      sections.comparison = comparisonMatch[1].trim()
    }

    // Extract differences (lines starting with warning emoji)
    const differencesMatch = response.match(/---DIFFERENCES---\s*([\s\S]*?)(?=---RECOMMENDATION---|$)/i)
    if (differencesMatch) {
      const diffText = differencesMatch[1].trim()
      sections.differences = diffText.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('⚠️') || line.length > 0)
    }

    // Extract recommendation
    const recommendationMatch = response.match(/---RECOMMENDATION---\s*([\s\S]*?)$/i)
    if (recommendationMatch) {
      sections.recommendation = recommendationMatch[1].trim()
    }
  } catch {
    // If parsing fails, return the raw response
    return { raw: response }
  }

  return sections
}

export function CrossBorderComparison({
  sourceFramework,
  comparisonData,
  targetFramework,
  isLoading,
  error,
  onClose,
  onCompare
}) {
  const [selectedTarget, setSelectedTarget] = useState(targetFramework || null)

  const availableTargets = Object.keys(FRAMEWORK_CONFIG).filter(f => f !== sourceFramework)
  const sourceConfig = FRAMEWORK_CONFIG[sourceFramework]
  const targetConfig = selectedTarget ? FRAMEWORK_CONFIG[selectedTarget] : null
  const parsedData = comparisonData ? parseComparisonResponse(comparisonData) : null

  const handleCompare = (target) => {
    setSelectedTarget(target)
    onCompare?.(target)
  }

  return (
    <div className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-whs-dark-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌍</span>
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
            Cross-Border Comparison
          </h4>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Target Selection */}
      {!comparisonData && !isLoading && (
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Compare this {sourceConfig?.flag} {sourceConfig?.name} regulation with:
          </p>
          <div className="flex gap-2">
            {availableTargets.map(target => {
              const config = FRAMEWORK_CONFIG[target]
              return (
                <button
                  key={target}
                  onClick={() => handleCompare(target)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-whs-dark-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                >
                  <span className="text-xl">{config.flag}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{config.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="p-8 flex flex-col items-center justify-center">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-3xl">{sourceConfig?.flag}</span>
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-3xl">{targetConfig?.flag}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analyzing cross-border equivalents...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <h5 className="font-semibold text-red-800 dark:text-red-300 mb-1">
                  AI Service Unavailable
                </h5>
                <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                  The AI comparison service is temporarily unavailable. This feature requires an AI service to analyze and compare laws across jurisdictions.
                </p>
                <button
                  onClick={() => selectedTarget && onCompare?.(selectedTarget)}
                  className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {parsedData && !isLoading && !error && (
        <div className="p-4 space-y-4">
          {/* Country Headers */}
          <div className="flex items-center justify-center gap-4 pb-4 border-b border-gray-100 dark:border-whs-dark-700">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{sourceConfig?.flag}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{sourceConfig?.name}</span>
            </div>
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{targetConfig?.flag}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{targetConfig?.name}</span>
            </div>
          </div>

          {/* Raw response fallback */}
          {parsedData.raw && (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {parsedData.raw}
            </div>
          )}

          {/* Equivalent Section */}
          {parsedData.equivalent && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h5 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <span>📌</span> Equivalent Provision
              </h5>
              <p className="text-sm text-blue-700 dark:text-blue-400">{parsedData.equivalent}</p>
            </div>
          )}

          {/* Comparison Table */}
          {parsedData.comparison && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 overflow-x-auto">
              <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <span>📊</span> Comparison
              </h5>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                {parsedData.comparison}
              </div>
            </div>
          )}

          {/* Differences */}
          {parsedData.differences && parsedData.differences.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
              <h5 className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                <span>⚠️</span> Key Differences
              </h5>
              <ul className="space-y-1">
                {parsedData.differences.map((diff, idx) => (
                  <li key={idx} className="text-sm text-amber-700 dark:text-amber-400">
                    {diff}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendation */}
          {parsedData.recommendation && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <h5 className="font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
                <span>✅</span> Recommendation
              </h5>
              <p className="text-sm text-green-700 dark:text-green-400">{parsedData.recommendation}</p>
            </div>
          )}

          {/* Compare with another country */}
          <div className="pt-4 border-t border-gray-100 dark:border-whs-dark-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Compare with another country:</p>
            <div className="flex gap-2">
              {availableTargets.filter(t => t !== selectedTarget).map(target => {
                const config = FRAMEWORK_CONFIG[target]
                return (
                  <button
                    key={target}
                    onClick={() => handleCompare(target)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-whs-dark-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors text-sm"
                  >
                    <span>{config.flag}</span>
                    <span className="text-gray-700 dark:text-gray-300">{config.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CrossBorderComparison

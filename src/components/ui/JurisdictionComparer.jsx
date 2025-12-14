import { useState } from 'react'

const JURISDICTIONS = [
  { code: 'AT', name: 'Austria', flag: '🇦🇹', lawName: 'ASchG' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', lawName: 'ArbSchG' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', lawName: 'Arbowet' }
]

export function JurisdictionSelector({ currentJurisdiction, onSelect, disabled }) {
  const availableJurisdictions = JURISDICTIONS.filter(j => j.code !== currentJurisdiction)

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">Compare with:</span>
      <div className="flex gap-1">
        {availableJurisdictions.map(j => (
          <button
            key={j.code}
            onClick={() => onSelect(j.code)}
            disabled={disabled}
            className={`
              px-3 py-1.5 text-sm rounded-lg border transition-all flex items-center gap-1.5
              ${disabled
                ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-whs-dark-700'
                : 'border-gray-300 dark:border-whs-dark-600 hover:border-whs-orange-500 hover:bg-whs-orange-50 dark:hover:bg-whs-orange-900/20'
              }
            `}
          >
            <span>{j.flag}</span>
            <span>{j.code}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ComparisonView({
  sourceSection,
  targetSection,
  sourceFramework,
  targetFramework,
  comparison,
  isLoading,
  error,
  onClose
}) {
  const sourceJurisdiction = JURISDICTIONS.find(j => j.code === sourceFramework)
  const targetJurisdiction = JURISDICTIONS.find(j => j.code === targetFramework)

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-whs-dark-800 rounded-xl p-6 max-w-4xl w-full">
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-whs-orange-500 border-t-transparent" />
            <span className="text-lg">Finding equivalent regulations...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-whs-dark-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-whs-dark-700 bg-gradient-to-r from-whs-orange-500 to-whs-orange-600 text-white">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <h2 className="text-xl font-bold">Cross-Border Comparison</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="text-red-500 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Side by Side Comparison */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Source */}
                <div className="border border-gray-200 dark:border-whs-dark-700 rounded-lg overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border-b border-gray-200 dark:border-whs-dark-700">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{sourceJurisdiction?.flag}</span>
                      <div>
                        <div className="font-semibold text-blue-700 dark:text-blue-300">
                          {sourceJurisdiction?.name} ({sourceJurisdiction?.lawName})
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {sourceSection.number} {sourceSection.title && `- ${sourceSection.title}`}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 max-h-64 overflow-y-auto text-sm text-gray-700 dark:text-gray-300">
                    {sourceSection.content || sourceSection.text}
                  </div>
                </div>

                {/* Target */}
                <div className="border border-gray-200 dark:border-whs-dark-700 rounded-lg overflow-hidden">
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 border-b border-gray-200 dark:border-whs-dark-700">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{targetJurisdiction?.flag}</span>
                      <div>
                        <div className="font-semibold text-green-700 dark:text-green-300">
                          {targetJurisdiction?.name} ({targetJurisdiction?.lawName})
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {targetSection?.number} {targetSection?.title && `- ${targetSection.title}`}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 max-h-64 overflow-y-auto text-sm text-gray-700 dark:text-gray-300">
                    {targetSection?.content || targetSection?.text || 'No equivalent section found'}
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              {comparison && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <h3 className="font-semibold text-purple-700 dark:text-purple-300">AI Compliance Analysis</h3>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {comparison}
                  </div>
                </div>
              )}

              {/* Warning Banner */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-300">Cross-Border Compliance Notice</p>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                      This AI-generated comparison is for guidance only. Always consult with local legal counsel
                      before transferring processes between jurisdictions. Requirements may differ in implementation details.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SemanticMatchResults({ matches, onSelectMatch, isLoading }) {
  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-whs-dark-800 rounded-lg">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border border-whs-orange-500 border-t-transparent" />
          <span className="text-sm">Finding equivalent sections...</span>
        </div>
      </div>
    )
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-whs-dark-800 rounded-lg text-gray-500 dark:text-gray-400 text-sm">
        No equivalent sections found in target jurisdiction.
      </div>
    )
  }

  const relevanceColors = {
    high: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
    medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
    low: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        Found {matches.length} potentially equivalent section(s):
      </p>
      {matches.map((match, index) => (
        <button
          key={index}
          onClick={() => onSelectMatch(match)}
          className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md ${relevanceColors[match.relevance]}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{match.number}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20">
              {match.relevance} match
            </span>
          </div>
          <p className="text-sm mt-1 opacity-80">{match.reason}</p>
        </button>
      ))}
    </div>
  )
}

export default JurisdictionComparer

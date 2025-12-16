import { useState } from 'react'

const FRAMEWORK_CONFIG = {
  AT: { name: 'Austria', flag: '🇦🇹', color: 'red', bgClass: 'bg-red-50 dark:bg-red-900/20', textClass: 'text-red-700 dark:text-red-300', borderClass: 'border-red-200 dark:border-red-800' },
  DE: { name: 'Germany', flag: '🇩🇪', color: 'yellow', bgClass: 'bg-yellow-50 dark:bg-yellow-900/20', textClass: 'text-yellow-700 dark:text-yellow-300', borderClass: 'border-yellow-200 dark:border-yellow-800' },
  NL: { name: 'Netherlands', flag: '🇳🇱', color: 'orange', bgClass: 'bg-orange-50 dark:bg-orange-900/20', textClass: 'text-orange-700 dark:text-orange-300', borderClass: 'border-orange-200 dark:border-orange-800' }
}

// Parse the AI response into structured sections
function parseMultiCountryResponse(response) {
  if (!response) return null

  const sections = {
    topic: '',
    provisions: {
      AT: '',
      DE: '',
      NL: ''
    },
    comparisonTable: '',
    differences: [],
    harmonizationTips: []
  }

  try {
    // Check if response uses markers format
    const hasMarkers = response.includes('---TOPIC---') || response.includes('---AT_PROVISION---')

    if (hasMarkers) {
      // Extract topic
      const topicMatch = response.match(/---TOPIC---\s*([\s\S]*?)(?=---[A-Z_]+---|$)/i)
      if (topicMatch) {
        sections.topic = topicMatch[1].trim()
      }

      // Extract AT provision
      const atMatch = response.match(/---AT_PROVISION---\s*([\s\S]*?)(?=---[A-Z_]+---|$)/i)
      if (atMatch) {
        sections.provisions.AT = atMatch[1].trim()
      }

      // Extract DE provision
      const deMatch = response.match(/---DE_PROVISION---\s*([\s\S]*?)(?=---[A-Z_]+---|$)/i)
      if (deMatch) {
        sections.provisions.DE = deMatch[1].trim()
      }

      // Extract NL provision
      const nlMatch = response.match(/---NL_PROVISION---\s*([\s\S]*?)(?=---[A-Z_]+---|$)/i)
      if (nlMatch) {
        sections.provisions.NL = nlMatch[1].trim()
      }

      // Extract comparison table
      const tableMatch = response.match(/---COMPARISON_TABLE---\s*([\s\S]*?)(?=---[A-Z_]+---|$)/i)
      if (tableMatch) {
        sections.comparisonTable = tableMatch[1].trim()
      }

      // Extract differences
      const differencesMatch = response.match(/---KEY_DIFFERENCES---\s*([\s\S]*?)(?=---[A-Z_]+---|$)/i)
      if (differencesMatch) {
        const diffText = differencesMatch[1].trim()
        sections.differences = diffText.split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('⚠️') || line.length > 0)
      }

      // Extract harmonization tips
      const tipsMatch = response.match(/---HARMONIZATION_TIPS---\s*([\s\S]*?)$/i)
      if (tipsMatch) {
        const tipsText = tipsMatch[1].trim()
        sections.harmonizationTips = tipsText.split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('✅') || line.length > 0)
      }
    } else {
      // Fallback: parse raw markdown response
      // Look for markdown table anywhere in response
      const tableMatch = response.match(/\|[^\n]+\|[\s\S]*?\|[^\n]+\|/g)
      if (tableMatch) {
        sections.comparisonTable = tableMatch.join('\n')
      }

      // Extract any bullet points as differences
      const bulletPoints = response.match(/^[\s]*[-•⚠️]\s*.+$/gm)
      if (bulletPoints) {
        sections.differences = bulletPoints.map(line => line.trim())
      }

      // If we found a table, use parsed format; otherwise return raw
      if (!sections.comparisonTable) {
        return { raw: response }
      }
    }
  } catch {
    // If parsing fails, return the raw response
    return { raw: response }
  }

  return sections
}

// Parse markdown table into structured data
function parseTable(tableText) {
  if (!tableText) return null

  const lines = tableText.split('\n').filter(line => line.trim())
  if (lines.length < 2) return null

  const rows = []
  for (const line of lines) {
    // Skip separator lines (|---|---| or variations)
    if (/^[\s|:-]+$/.test(line.replace(/\|/g, '').trim())) continue
    if (/^\|[-:\s|]+\|$/.test(line)) continue

    // Extract cells from pipe-separated line
    const cells = line.split('|')
      .map(cell => cell.trim())
      .filter((cell, idx, arr) => {
        // Filter out empty cells at start/end (from leading/trailing pipes)
        if (idx === 0 && cell === '') return false
        if (idx === arr.length - 1 && cell === '') return false
        return true
      })

    if (cells.length >= 2) {
      rows.push(cells)
    }
  }

  if (rows.length < 2) return null

  return {
    headers: rows[0],
    rows: rows.slice(1)
  }
}

export function MultiCountryComparison({
  sourceFramework,
  comparisonData,
  isLoading,
  error,
  onClose,
  onCompare
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const parsedData = comparisonData ? parseMultiCountryResponse(comparisonData) : null
  const tableData = parsedData?.comparisonTable ? parseTable(parsedData.comparisonTable) : null

  const frameworks = ['AT', 'DE', 'NL']

  return (
    <div className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {frameworks.map((fw, idx) => (
              <span key={fw} className="text-xl">
                {FRAMEWORK_CONFIG[fw].flag}
                {idx < frameworks.length - 1 && <span className="mx-1 text-white/50">+</span>}
              </span>
            ))}
          </div>
          <div>
            <h4 className="font-semibold text-sm">
              Multi-Country Comparison
            </h4>
            <p className="text-xs text-white/80">
              Compare across Austria, Germany & Netherlands
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Start Comparison Button */}
      {!comparisonData && !isLoading && (
        <div className="p-6 text-center">
          <div className="flex justify-center gap-4 mb-4">
            {frameworks.map(fw => (
              <div key={fw} className={`px-4 py-3 rounded-lg ${FRAMEWORK_CONFIG[fw].bgClass} border ${FRAMEWORK_CONFIG[fw].borderClass}`}>
                <span className="text-2xl">{FRAMEWORK_CONFIG[fw].flag}</span>
                <p className={`text-xs font-medium mt-1 ${FRAMEWORK_CONFIG[fw].textClass}`}>
                  {FRAMEWORK_CONFIG[fw].name}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Compare this regulation across all 3 EU frameworks to identify equivalent provisions and key differences.
          </p>
          <button
            onClick={() => onCompare?.()}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
          >
            Compare All 3 Countries
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="p-8 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3 mb-4">
            {frameworks.map((fw, idx) => (
              <span key={fw} className="text-3xl animate-pulse" style={{ animationDelay: `${idx * 200}ms` }}>
                {FRAMEWORK_CONFIG[fw].flag}
              </span>
            ))}
          </div>
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Analyzing equivalent provisions across<br />Austria, Germany & Netherlands...
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
                  Service Unavailable
                </h5>
                <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                  The comparison service is temporarily unavailable. This feature requires a service to analyze and compare laws across all 3 jurisdictions.
                </p>
                <button
                  onClick={() => onCompare?.()}
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
        <div>
          {/* Topic Header */}
          {parsedData.topic && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-whs-dark-700 border-b border-gray-200 dark:border-whs-dark-600">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Topic: {parsedData.topic}
              </p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 dark:border-whs-dark-700">
            {[
              { id: 'overview', label: 'Overview', icon: '📋' },
              { id: 'comparison', label: 'Comparison Table', icon: '📊' },
              { id: 'differences', label: 'Differences', icon: '⚠️' },
              { id: 'tips', label: 'Harmonization Tips', icon: '✅' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Raw fallback */}
            {parsedData.raw && (
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {parsedData.raw}
              </div>
            )}

            {/* Overview Tab - Country Provisions */}
            {activeTab === 'overview' && !parsedData.raw && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {frameworks.map(fw => (
                  <div
                    key={fw}
                    className={`rounded-lg p-4 border ${FRAMEWORK_CONFIG[fw].borderClass} ${FRAMEWORK_CONFIG[fw].bgClass}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{FRAMEWORK_CONFIG[fw].flag}</span>
                      <div>
                        <h5 className={`font-semibold ${FRAMEWORK_CONFIG[fw].textClass}`}>
                          {FRAMEWORK_CONFIG[fw].name}
                        </h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {fw === 'AT' ? 'ASchG' : fw === 'DE' ? 'ArbSchG/DGUV' : 'Arbowet'}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {parsedData.provisions[fw] || 'No equivalent provision found'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Comparison Table Tab */}
            {activeTab === 'comparison' && !parsedData.raw && (
              <div className="overflow-x-auto">
                {tableData ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-whs-dark-700">
                        {tableData.headers.map((header, idx) => (
                          <th
                            key={idx}
                            className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-whs-dark-600"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className={rowIdx % 2 === 0 ? 'bg-white dark:bg-whs-dark-800' : 'bg-gray-50 dark:bg-whs-dark-750'}
                        >
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className={`px-4 py-2 border-b border-gray-100 dark:border-whs-dark-700 ${
                                cellIdx === 0 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="bg-gray-50 dark:bg-whs-dark-700 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                      {parsedData.comparisonTable || 'No comparison table available'}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Differences Tab */}
            {activeTab === 'differences' && !parsedData.raw && (
              <div className="space-y-3">
                {parsedData.differences && parsedData.differences.length > 0 ? (
                  parsedData.differences.map((diff, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
                    >
                      <span className="text-lg flex-shrink-0">⚠️</span>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        {diff.replace(/^⚠️\s*/, '')}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No significant differences identified
                  </p>
                )}
              </div>
            )}

            {/* Harmonization Tips Tab */}
            {activeTab === 'tips' && !parsedData.raw && (
              <div className="space-y-3">
                {parsedData.harmonizationTips && parsedData.harmonizationTips.length > 0 ? (
                  parsedData.harmonizationTips.map((tip, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                    >
                      <span className="text-lg flex-shrink-0">✅</span>
                      <p className="text-sm text-green-800 dark:text-green-300">
                        {tip.replace(/^✅\s*/, '')}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No harmonization tips available
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Re-compare Button */}
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-whs-dark-700">
            <button
              onClick={() => onCompare?.()}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-whs-dark-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-whs-dark-600 transition-colors disabled:opacity-50"
            >
              Regenerate Comparison
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MultiCountryComparison

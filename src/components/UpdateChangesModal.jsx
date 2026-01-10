import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Flag icons for countries
const CountryFlag = ({ country }) => {
  const flags = {
    AT: '🇦🇹',
    DE: '🇩🇪',
    NL: '🇳🇱'
  }
  return <span className="text-lg">{flags[country] || country}</span>
}

// Change type badge
const ChangeBadge = ({ type }) => {
  const styles = {
    added: 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300',
    removed: 'bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-300',
    modified: 'bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-300',
    expanded: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800/30 dark:text-emerald-300',
    reduced: 'bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-300',
    reworded: 'bg-purple-100 text-purple-800 dark:bg-purple-800/30 dark:text-purple-300'
  }

  const labels = {
    added: 'Added',
    removed: 'Removed',
    modified: 'Modified',
    expanded: 'Expanded',
    reduced: 'Reduced',
    reworded: 'Reworded'
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[type] || styles.modified}`}>
      {labels[type] || type}
    </span>
  )
}

// Single law change card
const LawChangeCard = ({ change, onViewLaw }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasDetails = (change.added?.length > 0 || change.removed?.length > 0 || change.modified?.length > 0)
  const totalChanges = (change.added?.length || 0) + (change.removed?.length || 0) + (change.modified?.length || 0)

  return (
    <div className="bg-white dark:bg-whs-dark-700 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className={`p-4 ${hasDetails ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-whs-dark-600' : ''}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CountryFlag country={change.country} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {change.abbreviation}
                </h4>
                {change.type === 'new_law' && (
                  <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                    New Law
                  </span>
                )}
                {change.type === 'removed_law' && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded">
                    Removed
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {change.title}
              </p>
              {hasDetails && (
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {change.added?.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="text-green-600">+{change.added.length}</span> added
                    </span>
                  )}
                  {change.removed?.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="text-red-600">-{change.removed.length}</span> removed
                    </span>
                  )}
                  {change.modified?.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="text-blue-600">{change.modified.length}</span> modified
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onViewLaw && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewLaw(change)
                }}
                className="px-3 py-1.5 text-xs font-medium text-whs-orange-600 dark:text-whs-orange-400 hover:bg-whs-orange-50 dark:hover:bg-whs-orange-900/20 rounded-lg transition-colors"
              >
                View Law
              </button>
            )}
            {hasDetails && (
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-gray-50 dark:bg-whs-dark-800">
          {/* Added sections */}
          {change.added?.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Added Sections ({change.added.length})
              </h5>
              <div className="space-y-2">
                {change.added.map((section, idx) => (
                  <div key={idx} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100 text-sm">
                          {section.title || `Section ${section.number}`}
                        </p>
                        {section.chapter && (
                          <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                            {section.chapter}
                          </p>
                        )}
                      </div>
                      <ChangeBadge type="added" />
                    </div>
                    {section.preview && (
                      <p className="text-xs text-green-800 dark:text-green-300 mt-2 line-clamp-2">
                        {section.preview}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Removed sections */}
          {change.removed?.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                </svg>
                Removed Sections ({change.removed.length})
              </h5>
              <div className="space-y-2">
                {change.removed.map((section, idx) => (
                  <div key={idx} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-red-900 dark:text-red-100 text-sm">
                          {section.title || `Section ${section.number}`}
                        </p>
                        {section.chapter && (
                          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                            {section.chapter}
                          </p>
                        )}
                      </div>
                      <ChangeBadge type="removed" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modified sections */}
          {change.modified?.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modified Sections ({change.modified.length})
              </h5>
              <div className="space-y-2">
                {change.modified.slice(0, 10).map((section, idx) => (
                  <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100 text-sm">
                          {section.title || `Section ${section.number}`}
                        </p>
                        {section.chapter && (
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                            {section.chapter}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {section.wordDiff !== 0 && (
                          <span className={`text-xs ${section.wordDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {section.wordDiff > 0 ? '+' : ''}{section.wordDiff} words
                          </span>
                        )}
                        <ChangeBadge type={section.changeType || 'modified'} />
                      </div>
                    </div>
                  </div>
                ))}
                {change.modified.length > 10 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 text-center py-2">
                    +{change.modified.length - 10} more modified sections
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function UpdateChangesModal({ isOpen, onClose, onViewLaw }) {
  const [changes, setChanges] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all, AT, DE, NL

  // Load changelog data
  useEffect(() => {
    if (!isOpen) return

    const loadChanges = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await import('../../eu_safety_laws/law_changes.json')
        setChanges(data.default || data)
      } catch (err) {
        console.error('Failed to load law changes:', err)
        setError('Failed to load change history')
      } finally {
        setLoading(false)
      }
    }

    loadChanges()
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Filter changes by country
  const filteredChanges = changes?.changes?.filter(c =>
    filter === 'all' || c.country === filter
  ) || []

  // Group changes by date
  const groupedChanges = filteredChanges.reduce((acc, change) => {
    const date = new Date(change.timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(change)
    return acc
  }, {})

  // Calculate summary stats
  const stats = {
    total: filteredChanges.length,
    added: filteredChanges.reduce((sum, c) => sum + (c.added?.length || 0), 0),
    removed: filteredChanges.reduce((sum, c) => sum + (c.removed?.length || 0), 0),
    modified: filteredChanges.reduce((sum, c) => sum + (c.modified?.length || 0), 0)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white dark:bg-whs-dark-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Law Update Changes</h2>
              <p className="text-white/80 text-sm">Detailed changelog of recent law updates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 bg-gray-50 dark:bg-whs-dark-700">
          {['all', 'AT', 'DE', 'NL'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-whs-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-whs-dark-500'
              }`}
            >
              {f === 'all' ? 'All Countries' : f === 'AT' ? '🇦🇹 Austria' : f === 'DE' ? '🇩🇪 Germany' : '🇳🇱 Netherlands'}
            </button>
          ))}
        </div>

        {/* Summary stats */}
        {!loading && !error && stats.total > 0 && (
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">{stats.total}</strong> laws changed
            </span>
            {stats.added > 0 && (
              <span className="text-green-600 dark:text-green-400">
                +{stats.added} sections added
              </span>
            )}
            {stats.removed > 0 && (
              <span className="text-red-600 dark:text-red-400">
                -{stats.removed} sections removed
              </span>
            )}
            {stats.modified > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                {stats.modified} sections modified
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600 dark:text-red-400">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p>{error}</p>
            </div>
          ) : filteredChanges.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No changes recorded</p>
              <p className="text-sm mt-1">Changes will appear here after law updates</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedChanges).map(([date, dateChanges]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {date}
                  </h3>
                  <div className="space-y-3">
                    {dateChanges.map((change, idx) => (
                      <LawChangeCard
                        key={`${change.abbreviation}-${idx}`}
                        change={change}
                        onViewLaw={onViewLaw}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-whs-dark-700 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {changes?.generated_at && (
              <>Generated: {new Date(changes.generated_at).toLocaleString()}</>
            )}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default UpdateChangesModal

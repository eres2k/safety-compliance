import { useState } from 'react'
import { useApp } from '../../context/AppContext'

/**
 * SearchHistory - Displays recent searches and saved queries
 * Can be used as a dropdown or panel
 */
export function SearchHistory({ onSelect, onClose, variant = 'dropdown' }) {
  const {
    recentSearches,
    savedQueries,
    saveQuery,
    removeQuery,
    clearRecentSearches,
    clearSavedQueries
  } = useApp()

  const [activeTab, setActiveTab] = useState('recent')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [queryToSave, setQueryToSave] = useState('')
  const [queryName, setQueryName] = useState('')

  const handleSaveQuery = (term) => {
    setQueryToSave(term)
    setQueryName(term.substring(0, 30))
    setSaveModalOpen(true)
  }

  const confirmSaveQuery = () => {
    saveQuery({
      name: queryName,
      query: queryToSave
    })
    setSaveModalOpen(false)
    setQueryToSave('')
    setQueryName('')
  }

  const containerClass = variant === 'panel'
    ? 'bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-lg'
    : 'absolute top-full left-0 right-0 mt-2 bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-xl z-50'

  return (
    <div className={containerClass}>
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-whs-dark-700">
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'recent'
              ? 'text-whs-orange-500 border-b-2 border-whs-orange-500'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Recent ({recentSearches.length})
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'saved'
              ? 'text-whs-orange-500 border-b-2 border-whs-orange-500'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Saved ({savedQueries.length})
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {activeTab === 'recent' ? (
          recentSearches.length > 0 ? (
            <div className="p-2">
              {recentSearches.map((term, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between group px-3 py-2 hover:bg-gray-50 dark:hover:bg-whs-dark-700 rounded-lg"
                >
                  <button
                    onClick={() => onSelect?.(term)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{term}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSaveQuery(term)
                    }}
                    className="p-1 text-gray-400 hover:text-whs-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Save query"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={clearRecentSearches}
                className="w-full mt-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Clear Recent Searches
              </button>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">No recent searches</p>
            </div>
          )
        ) : (
          savedQueries.length > 0 ? (
            <div className="p-2">
              {savedQueries.map((query) => (
                <div
                  key={query.id}
                  className="flex items-center justify-between group px-3 py-2 hover:bg-gray-50 dark:hover:bg-whs-dark-700 rounded-lg"
                >
                  <button
                    onClick={() => onSelect?.(query.query)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <svg className="w-4 h-4 text-whs-orange-500" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{query.name}</span>
                      {query.name !== query.query && (
                        <span className="text-xs text-gray-500 block">{query.query}</span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeQuery(query.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove saved query"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={clearSavedQueries}
                className="w-full mt-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Clear Saved Queries
              </button>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-sm">No saved queries</p>
              <p className="text-xs mt-1">Click the bookmark icon on a recent search to save it</p>
            </div>
          )
        )}
      </div>

      {/* Save Query Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-whs-dark-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Save Query</h3>
            <input
              type="text"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder="Query name..."
              className="w-full px-3 py-2 mb-4 bg-gray-50 dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whs-orange-500"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-whs-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-whs-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSaveQuery}
                disabled={!queryName.trim()}
                className="flex-1 px-4 py-2 text-white bg-whs-orange-500 rounded-lg hover:bg-whs-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchHistory

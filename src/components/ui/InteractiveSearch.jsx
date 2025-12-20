import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAI } from '../../hooks/useAI'
import {
  deepSearch,
  groupResultsByCategory,
  getSmartSuggestions,
  checkLogisticsRelevance,
  WHS_SMART_SUGGESTIONS,
} from '../../services/pdfSearchService'
import {
  WHS_TOPIC_LABELS,
  RELEVANCE_LEVELS,
} from '../../services/euLawsDatabase'

/**
 * InteractiveSearch - Advanced real-time search component
 * Features:
 * - Real-time results as you type
 * - Deep PDF content search
 * - Full text search across all law content
 * - Category-sorted results with visual grouping
 * - WHS Amazon logistics smart suggestions
 */
export function InteractiveSearch({
  onSelectResult,
  onSearch,
  placeholder = 'Search laws, topics, PDF content...',
  className = '',
  laws = [],
  t = {},
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState([])
  const [groupedResults, setGroupedResults] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [searchMode, setSearchMode] = useState('all') // all, laws, content, pdf, topics
  const [showLogisticsHint, setShowLogisticsHint] = useState(false)
  const [logisticsInfo, setLogisticsInfo] = useState(null)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const resultsRef = useRef(null)
  const debounceRef = useRef(null)

  const { askQuestion, isLoading: aiLoading } = useAI()

  // Search modes with icons and descriptions
  const searchModes = [
    { id: 'all', label: 'All', icon: '🔍', desc: 'Search everywhere' },
    { id: 'laws', label: 'Laws', icon: '⚖️', desc: 'Law titles & abbreviations' },
    { id: 'content', label: 'Content', icon: '📄', desc: 'Full text content' },
    { id: 'pdf', label: 'PDFs', icon: '📑', desc: 'Search in PDF documents' },
    { id: 'topics', label: 'Topics', icon: '📋', desc: 'WHS safety topics' },
  ]

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Real-time search with debouncing
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!searchTerm || searchTerm.length < 2) {
      setResults([])
      setGroupedResults([])
      setSuggestions(WHS_SMART_SUGGESTIONS.slice(0, 6))
      setShowLogisticsHint(false)
      return
    }

    // Show suggestions immediately
    const smartSuggestions = getSmartSuggestions(searchTerm)
    setSuggestions(smartSuggestions)

    // Check logistics relevance
    const relevance = checkLogisticsRelevance(searchTerm)
    setLogisticsInfo(relevance)
    setShowLogisticsHint(relevance.isRelevant)

    // Debounce the actual search
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)

      try {
        const searchResults = await deepSearch(searchTerm, laws, {
          searchPdfs: searchMode === 'pdf' || searchMode === 'all',
          boostLogistics: true,
          limit: 50,
        })

        setResults(searchResults)

        // Group results by category
        const grouped = groupResultsByCategory(searchResults)
        setGroupedResults(grouped)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }, 150) // Fast 150ms debounce for real-time feel

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchTerm, searchMode, laws])

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    const totalItems = results.length + suggestions.length

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex])
        } else if (selectedIndex >= results.length) {
          const suggestionIndex = selectedIndex - results.length
          handleSuggestionClick(suggestions[suggestionIndex])
        } else if (searchTerm) {
          executeSearch()
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }, [results, suggestions, selectedIndex, searchTerm])

  // Handle result selection
  const handleResultClick = useCallback((result) => {
    setIsOpen(false)
    setSearchTerm('')
    if (onSelectResult) {
      onSelectResult(result)
    }
  }, [onSelectResult])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion) => {
    const keyword = suggestion.keywords?.[0] || suggestion.category
    setSearchTerm(keyword)
    setIsOpen(true)
  }, [])

  // Execute search callback
  const executeSearch = useCallback(() => {
    if (onSearch && searchTerm) {
      onSearch(searchTerm, searchMode)
    }
  }, [onSearch, searchTerm, searchMode])

  // Get relevance badge color
  const getRelevanceBadge = (level) => {
    const config = RELEVANCE_LEVELS[level] || RELEVANCE_LEVELS.low
    return config
  }

  // Render category group
  const renderCategoryGroup = (group, groupIndex) => (
    <div key={group.category} className="border-b border-gray-100 dark:border-whs-dark-700 last:border-0">
      {/* Category Header */}
      <div className="sticky top-0 bg-gray-50 dark:bg-whs-dark-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {group.category}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-whs-dark-600 text-gray-600 dark:text-gray-400">
            {group.count}
          </span>
        </div>
        {group.topRelevance !== 'low' && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${getRelevanceBadge(group.topRelevance).bgColor} ${getRelevanceBadge(group.topRelevance).textColor}`}>
            {group.topRelevance}
          </span>
        )}
      </div>

      {/* Category Items */}
      <div>
        {group.items.slice(0, 5).map((result, idx) => (
          <button
            key={result.id}
            onClick={() => handleResultClick(result)}
            className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-whs-orange-50 dark:hover:bg-whs-dark-700 transition-colors text-left ${
              selectedIndex === results.indexOf(result)
                ? 'bg-whs-orange-50 dark:bg-whs-dark-700'
                : ''
            }`}
          >
            {/* Country Flag */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-whs-dark-600 flex items-center justify-center text-sm">
              {result.jurisdiction === 'AT' ? '🇦🇹' : result.jurisdiction === 'DE' ? '🇩🇪' : '🇳🇱'}
            </div>

            {/* Result Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {result.abbreviation || result.title?.substring(0, 30)}
                </span>
                {result.matchDetails?.logisticsBonus > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                    🚜 Logistics
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {result.title_en || result.title}
              </p>
              {/* Match info */}
              {result.matchDetails && (
                <div className="flex items-center gap-2 mt-1">
                  {result.matchDetails.contentMatch && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      📄 {result.matchDetails.matchCount || 1} match{result.matchDetails.matchCount > 1 ? 'es' : ''}
                    </span>
                  )}
                  {result.matchDetails.pdfMatch && (
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      📑 PDF match
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Score indicator */}
            <div className="flex-shrink-0 text-right">
              <div className={`text-xs font-medium ${
                result.searchScore > 80 ? 'text-green-600 dark:text-green-400' :
                  result.searchScore > 50 ? 'text-amber-600 dark:text-amber-400' :
                    'text-gray-500 dark:text-gray-400'
              }`}>
                {Math.round(result.searchScore)}%
              </div>
            </div>
          </button>
        ))}
        {group.items.length > 5 && (
          <button
            onClick={() => {
              if (onSearch) onSearch(searchTerm, searchMode)
            }}
            className="w-full px-4 py-2 text-sm text-whs-orange-600 dark:text-whs-orange-400 hover:bg-whs-orange-50 dark:hover:bg-whs-dark-700 text-left"
          >
            + {group.items.length - 5} more in {group.category}
          </button>
        )}
      </div>
    </div>
  )

  // Render WHS topic suggestion
  const renderSuggestion = (suggestion, index) => (
    <button
      key={suggestion.category}
      onClick={() => handleSuggestionClick(suggestion)}
      className={`flex items-start gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-whs-dark-700 transition-colors text-left ${
        selectedIndex === results.length + index
          ? 'bg-gray-100 dark:bg-whs-dark-700'
          : ''
      }`}
    >
      <span className="text-2xl flex-shrink-0">{suggestion.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {suggestion.category}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {suggestion.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {suggestion.keywords.slice(0, 3).map(kw => (
            <span
              key={kw}
              className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-whs-dark-600 text-gray-600 dark:text-gray-400"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>
    </button>
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input Container */}
      <div className="relative group">
        {/* Glow effect on focus */}
        <div className="absolute inset-0 bg-gradient-to-r from-whs-orange-500/20 via-amber-500/20 to-orange-500/20 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />

        <div className="relative flex items-center bg-white dark:bg-whs-dark-700/90 border-2 border-gray-200 dark:border-whs-dark-600 rounded-2xl overflow-hidden focus-within:border-whs-orange-500 dark:focus-within:border-whs-orange-500 transition-all shadow-sm focus-within:shadow-lg">
          {/* Mode selector */}
          <div className="flex-shrink-0 border-r border-gray-200 dark:border-whs-dark-600">
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value)}
              className="h-12 px-3 bg-transparent text-sm font-medium text-gray-600 dark:text-gray-300 focus:outline-none cursor-pointer appearance-none"
              style={{ backgroundImage: 'none' }}
            >
              {searchModes.map(mode => (
                <option key={mode.id} value={mode.id}>
                  {mode.icon} {mode.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
              setSelectedIndex(-1)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 h-12 px-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-base"
          />

          {/* Status indicators */}
          <div className="flex items-center gap-2 px-3">
            {isSearching && (
              <div className="w-5 h-5 border-2 border-whs-orange-500 border-t-transparent rounded-full animate-spin" />
            )}

            {searchTerm && !isSearching && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setResults([])
                  setGroupedResults([])
                  inputRef.current?.focus()
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-whs-dark-600 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Search button */}
            <button
              onClick={executeSearch}
              disabled={isSearching || !searchTerm}
              className="p-2 bg-whs-orange-500 hover:bg-whs-orange-600 disabled:bg-gray-300 dark:disabled:bg-whs-dark-600 text-white rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Logistics relevance hint */}
      {showLogisticsHint && logisticsInfo && (
        <div className="mt-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2">
          <span className="text-lg">🚜</span>
          <span className="text-sm text-amber-700 dark:text-amber-300">
            <strong>Amazon Logistics Relevant:</strong> Your search matches {logisticsInfo.matchedKeywords.length} WHS logistics keywords
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            logisticsInfo.level === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
              logisticsInfo.level === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
          }`}>
            {logisticsInfo.level}
          </span>
        </div>
      )}

      {/* Results Dropdown */}
      {isOpen && (searchTerm.length >= 2 || suggestions.length > 0) && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
        >
          {/* Results count and mode info */}
          {searchTerm && (
            <div className="sticky top-0 z-10 bg-white dark:bg-whs-dark-800 border-b border-gray-100 dark:border-whs-dark-700 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isSearching ? 'Searching...' : (
                    results.length > 0
                      ? `${results.length} results in ${groupedResults.length} categories`
                      : 'No results'
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {searchModes.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setSearchMode(mode.id)}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                      searchMode === mode.id
                        ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300'
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-whs-dark-700'
                    }`}
                    title={mode.desc}
                  >
                    {mode.icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category-grouped results */}
          {groupedResults.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-whs-dark-700">
              {groupedResults.map((group, idx) => renderCategoryGroup(group, idx))}
            </div>
          )}

          {/* Smart Suggestions */}
          {(suggestions.length > 0 && (results.length === 0 || !searchTerm)) && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🚜</span>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  WHS Amazon Logistics Topics
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestions.map((suggestion, idx) => renderSuggestion(suggestion, idx))}
              </div>
            </div>
          )}

          {/* No results state */}
          {searchTerm && !isSearching && results.length === 0 && suggestions.length === 0 && (
            <div className="p-8 text-center">
              <span className="text-4xl mb-3 block">🔍</span>
              <p className="text-gray-600 dark:text-gray-400">
                No results found for "{searchTerm}"
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Try different keywords or switch to PDF search mode
              </p>
            </div>
          )}

          {/* Keyboard hints */}
          <div className="sticky bottom-0 bg-gray-50 dark:bg-whs-dark-900 border-t border-gray-100 dark:border-whs-dark-700 px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-whs-dark-600 font-mono">↑↓</kbd> Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-whs-dark-600 font-mono">Enter</kbd> Select
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-whs-dark-600 font-mono">Esc</kbd> Close
              </span>
            </div>
            <span className="text-whs-orange-500">
              Real-time search enabled
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default InteractiveSearch

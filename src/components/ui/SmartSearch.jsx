import { useState, useEffect, useRef, useCallback } from 'react'
import { useAI } from '../../hooks/useAI'

/**
 * SmartSearch - Multi-mode search component for law browser
 * Supports: Laws, Topic, Fulltext, and PDF content search
 */
export function SmartSearch({
  onSearch,
  onModeChange,
  onAISearch,
  placeholder = 'Smart search...',
  className = '',
  laws = [],
  pdfIndex = null,
  t = {}
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchMode, setSearchMode] = useState('all') // all, laws, topic, fulltext, pdf
  const [isExpanded, setIsExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [aiResults, setAiResults] = useState(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const { askQuestion, isLoading: aiLoading } = useAI()

  // Search modes configuration
  const searchModes = [
    { id: 'all', label: t.search?.all || 'All', icon: '🔍', description: 'Search everywhere' },
    { id: 'laws', label: t.search?.laws || 'Laws', icon: '⚖️', description: 'Law names & abbreviations' },
    { id: 'topic', label: t.search?.topic || 'Topic', icon: '📋', description: 'WHS topics & categories' },
    { id: 'fulltext', label: t.search?.fulltext || 'Fulltext', icon: '📄', description: 'Search in law content' },
    { id: 'pdf', label: t.search?.pdf || 'PDFs', icon: '📑', description: 'Search inside PDF documents' },
  ]

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Generate suggestions based on search term and mode
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSuggestions([])
      return
    }

    const term = searchTerm.toLowerCase()
    let newSuggestions = []

    if (searchMode === 'all' || searchMode === 'laws') {
      // Search in law names and abbreviations
      const lawMatches = laws
        .filter(law =>
          law.abbreviation?.toLowerCase().includes(term) ||
          law.title?.toLowerCase().includes(term) ||
          law.title_en?.toLowerCase().includes(term)
        )
        .slice(0, 5)
        .map(law => ({
          type: 'law',
          icon: '⚖️',
          title: law.abbreviation || law.title,
          subtitle: law.title_en || law.title,
          data: law
        }))
      newSuggestions = [...newSuggestions, ...lawMatches]
    }

    if (searchMode === 'all' || searchMode === 'topic') {
      // Search in topics
      const topicKeywords = [
        { key: 'forklift', label: 'Forklifts & Industrial Trucks', icon: '🚜' },
        { key: 'lifting', label: 'Lifting & Manual Handling', icon: '💪' },
        { key: 'hazmat', label: 'Hazardous Materials', icon: '☢️' },
        { key: 'ppe', label: 'Personal Protective Equipment', icon: '🦺' },
        { key: 'warehouse', label: 'Warehouse Safety', icon: '🏭' },
        { key: 'transport', label: 'Transport & Delivery', icon: '🚚' },
        { key: 'fire', label: 'Fire Safety', icon: '🔥' },
        { key: 'ergonomic', label: 'Ergonomics', icon: '🧘' },
        { key: 'training', label: 'Safety Training', icon: '📚' },
        { key: 'racking', label: 'Racking & Storage', icon: '📦' },
      ]
      const topicMatches = topicKeywords
        .filter(t => t.key.includes(term) || t.label.toLowerCase().includes(term))
        .map(t => ({
          type: 'topic',
          icon: t.icon,
          title: t.label,
          subtitle: `Search for ${t.label.toLowerCase()}`,
          data: t
        }))
      newSuggestions = [...newSuggestions, ...topicMatches]
    }

    setSuggestions(newSuggestions.slice(0, 8))
  }, [searchTerm, searchMode, laws])

  // Handle search execution
  const executeSearch = useCallback(async () => {
    if (!searchTerm.trim()) return

    setIsSearching(true)
    setIsExpanded(false)

    try {
      // Call the parent search handler
      if (onSearch) {
        onSearch(searchTerm, searchMode)
      }

      // For PDF mode, trigger AI-powered search
      if (searchMode === 'pdf' && onAISearch) {
        const prompt = `Search for information about "${searchTerm}" in workplace safety PDFs and documents.
                       Focus on AUVA, DGUV, TRBS, TRGS, ASR, and PGS documents.
                       Return relevant document names, sections, and brief summaries.`

        const result = await askQuestion(prompt, { maxTokens: 1000 })
        if (result) {
          setAiResults({
            query: searchTerm,
            response: result,
            timestamp: new Date().toISOString()
          })
          if (onAISearch) {
            onAISearch(searchTerm, result)
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, [searchTerm, searchMode, onSearch, onAISearch, askQuestion])

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion.title)
    setIsExpanded(false)
    if (onSearch) {
      onSearch(suggestion.title, suggestion.type)
    }
  }

  // Handle mode change
  const handleModeChange = (mode) => {
    setSearchMode(mode)
    if (onModeChange) {
      onModeChange(mode)
    }
  }

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeSearch()
    } else if (e.key === 'Escape') {
      setIsExpanded(false)
    }
  }

  const currentMode = searchModes.find(m => m.id === searchMode)

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-whs-orange-500/20 via-amber-500/20 to-indigo-500/20 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity"></div>

        {/* Mode indicator button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100 dark:bg-whs-dark-600 hover:bg-gray-200 dark:hover:bg-whs-dark-500 transition-colors z-10"
          title={currentMode?.description}
        >
          <span className="text-sm">{currentMode?.icon}</span>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 hidden sm:inline">
            {currentMode?.label}
          </span>
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsExpanded(e.target.value.length >= 2)
          }}
          onFocus={() => searchTerm.length >= 2 && setIsExpanded(true)}
          onKeyDown={handleKeyDown}
          placeholder={currentMode?.description || placeholder}
          className="relative w-full pl-24 sm:pl-28 pr-20 py-2.5 text-sm bg-white dark:bg-whs-dark-700/80 border border-gray-200 dark:border-whs-dark-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-whs-orange-500/50 focus:border-whs-orange-500 transition-all placeholder:text-gray-400"
        />

        {/* Action buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('')
                setSuggestions([])
                setAiResults(null)
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-whs-dark-600 rounded-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={executeSearch}
            disabled={isSearching || aiLoading}
            className="p-1.5 text-white bg-whs-orange-500 hover:bg-whs-orange-600 rounded-lg transition-all disabled:opacity-50"
          >
            {isSearching || aiLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Dropdown Panel */}
      {isExpanded && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Search Modes */}
          <div className="p-2 border-b border-gray-100 dark:border-whs-dark-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 mb-2">
              {t.search?.searchIn || 'Search in'}
            </p>
            <div className="flex flex-wrap gap-1">
              {searchModes.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => handleModeChange(mode.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    searchMode === mode.id
                      ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300 ring-1 ring-whs-orange-300 dark:ring-whs-orange-700'
                      : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-whs-dark-600'
                  }`}
                >
                  <span>{mode.icon}</span>
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-2">
                {t.search?.suggestions || 'Suggestions'}
              </p>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-whs-dark-700 transition-colors text-left"
                >
                  <span className="text-lg">{suggestion.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {suggestion.title}
                    </p>
                    {suggestion.subtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {suggestion.subtitle}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-whs-dark-600">
                    {suggestion.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* PDF Mode Helper */}
          {searchMode === 'pdf' && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-100 dark:border-indigo-800">
              <div className="flex items-start gap-2">
                <span className="text-lg">🤖</span>
                <div>
                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                    {t.search?.aiPowered || 'AI-Powered PDF Search'}
                  </p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {t.search?.aiPoweredDesc || 'Searches through AUVA, DGUV, TRBS, TRGS, ASR, and PGS documents using AI'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="p-2 bg-gray-50 dark:bg-whs-dark-900 border-t border-gray-100 dark:border-whs-dark-700">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-whs-dark-600 font-mono">Enter</kbd> to search</span>
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-whs-dark-600 font-mono">Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}

      {/* AI Results Panel */}
      {aiResults && searchMode === 'pdf' && (
        <div className="mt-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
              <span>🤖</span>
              <span>{t.search?.aiResults || 'AI Search Results'}</span>
            </h4>
            <button
              onClick={() => setAiResults(null)}
              className="p-1 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-2">
            Query: "{aiResults.query}"
          </p>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {aiResults.response}
          </div>
        </div>
      )}
    </div>
  )
}

export default SmartSearch

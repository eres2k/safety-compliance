import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAI } from '../../hooks/useAI'

/**
 * SmartSearch - Redesigned search component with 3 categories
 * Categories: Alles (All), Gesetze (Laws), Richtlinien (Guidelines)
 * Features: Full-text PDF search with smart snippets
 */
export function SmartSearch({
  onSearch,
  onModeChange,
  onAISearch,
  onSelectLaw,
  placeholder = 'Smart search...',
  className = '',
  laws = [],
  pdfIndex = null,
  t = {},
  framework = 'DE'
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all') // all, laws, guidelines
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState({ laws: [], guidelines: [], pdfMatches: [] })
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  const { askQuestion, isLoading: aiLoading } = useAI()

  // Categorize documents into laws and guidelines
  const categorizedDocs = useMemo(() => {
    const lawTypes = ['law', 'ordinance', 'regulation', 'verordnung', 'gesetz']
    const guidelineTypes = ['merkblatt', 'guideline', 'handbook', 'supplement', 'technical_rule', 'information', 'regel', 'richtlinie', 'vorschrift']

    const lawDocs = laws.filter(doc => {
      const type = (doc.type || '').toLowerCase()
      const abbr = (doc.abbreviation || '').toLowerCase()
      // Laws are core legislative documents
      if (lawTypes.some(lt => type.includes(lt))) return true
      if (abbr.includes('aschg') || abbr.includes('arbschg') || abbr.includes('arbowet')) return true
      // Check if NOT a guideline type
      return !guidelineTypes.some(gt => type.includes(gt) || abbr.includes(gt))
    })

    const guidelineDocs = laws.filter(doc => {
      const type = (doc.type || '').toLowerCase()
      const abbr = (doc.abbreviation || '').toLowerCase()
      // Guidelines are supplementary documents
      if (guidelineTypes.some(gt => type.includes(gt))) return true
      if (abbr.includes('trbs') || abbr.includes('trgs') || abbr.includes('asr') ||
          abbr.includes('dguv') || abbr.includes('merkblatt') || abbr.includes('m.plus')) return true
      return false
    })

    return { laws: lawDocs, guidelines: guidelineDocs }
  }, [laws])

  // Tab configuration with counts
  const tabs = useMemo(() => [
    {
      id: 'all',
      label: t.search?.all || 'Alles',
      icon: '🔍',
      count: laws.length,
      description: t.search?.allDesc || 'Suche in allem'
    },
    {
      id: 'laws',
      label: t.search?.laws || 'Gesetze',
      icon: '⚖️',
      count: categorizedDocs.laws.length,
      description: t.search?.lawsDesc || 'Nur Gesetze & Verordnungen'
    },
    {
      id: 'guidelines',
      label: t.search?.guidelines || 'Richtlinien',
      icon: '📋',
      count: categorizedDocs.guidelines.length,
      description: t.search?.guidelinesDesc || 'Merkblätter & technische Regeln'
    },
  ], [t, laws.length, categorizedDocs])

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

  // Extract text snippet around a match
  const extractSnippet = useCallback((text, searchTerm, contextLength = 80) => {
    if (!text || !searchTerm) return null

    const lowerText = text.toLowerCase()
    const lowerSearch = searchTerm.toLowerCase()
    const index = lowerText.indexOf(lowerSearch)

    if (index === -1) return null

    const start = Math.max(0, index - contextLength)
    const end = Math.min(text.length, index + searchTerm.length + contextLength)

    let snippet = text.substring(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < text.length) snippet = snippet + '...'

    return snippet
  }, [])

  // Search in PDF/document content
  const searchInContent = useCallback((doc, term) => {
    if (!term || term.length < 2) return { found: false, snippets: [] }

    const lowerTerm = term.toLowerCase()
    const snippets = []

    // Search in full text content
    const fullText = doc.content?.full_text || doc.content?.text || doc.full_text || ''
    if (fullText) {
      const snippet = extractSnippet(fullText, term, 100)
      if (snippet) {
        snippets.push({ type: 'content', text: snippet, source: 'Volltext' })
      }
    }

    // Search in chapters/sections
    if (doc.chapters && Array.isArray(doc.chapters)) {
      for (const chapter of doc.chapters) {
        if (chapter.sections && Array.isArray(chapter.sections)) {
          for (const section of chapter.sections) {
            if (section.text && section.text.toLowerCase().includes(lowerTerm)) {
              const snippet = extractSnippet(section.text, term, 80)
              if (snippet) {
                snippets.push({
                  type: 'section',
                  text: snippet,
                  source: `${chapter.title || ''} - ${section.title || section.number || ''}`.trim(),
                  sectionId: section.id
                })
              }
              if (snippets.length >= 3) break // Limit snippets per document
            }
          }
        }
        if (snippets.length >= 3) break
      }
    }

    return { found: snippets.length > 0, snippets }
  }, [extractSnippet])

  // Perform search with debouncing
  const performSearch = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setSearchResults({ laws: [], guidelines: [], pdfMatches: [] })
      return
    }

    setIsSearching(true)
    const lowerTerm = term.toLowerCase()

    try {
      // Determine which documents to search based on active tab
      let docsToSearch = laws
      if (activeTab === 'laws') {
        docsToSearch = categorizedDocs.laws
      } else if (activeTab === 'guidelines') {
        docsToSearch = categorizedDocs.guidelines
      }

      // Search in document metadata
      const matchedDocs = docsToSearch
        .map(doc => {
          let score = 0
          const matches = []

          // Exact abbreviation match - highest priority
          if (doc.abbreviation?.toLowerCase() === lowerTerm) {
            score += 100
            matches.push('abbreviation_exact')
          } else if (doc.abbreviation?.toLowerCase().includes(lowerTerm)) {
            score += 50
            matches.push('abbreviation')
          }

          // Title match
          if (doc.title?.toLowerCase().includes(lowerTerm)) {
            score += 40
            matches.push('title')
          }
          if (doc.title_en?.toLowerCase().includes(lowerTerm)) {
            score += 30
            matches.push('title_en')
          }

          // Description match
          if (doc.description?.toLowerCase().includes(lowerTerm)) {
            score += 20
            matches.push('description')
          }

          // Full-text content search
          const contentResult = searchInContent(doc, term)
          if (contentResult.found) {
            score += 25 + Math.min(contentResult.snippets.length * 5, 15)
            matches.push('content')
          }

          // Keywords match
          if (doc.keywords && Array.isArray(doc.keywords)) {
            const keywordMatch = doc.keywords.some(k => k.toLowerCase().includes(lowerTerm))
            if (keywordMatch) {
              score += 15
              matches.push('keywords')
            }
          }

          return {
            ...doc,
            searchScore: score,
            matches,
            snippets: contentResult.snippets
          }
        })
        .filter(doc => doc.searchScore > 0)
        .sort((a, b) => b.searchScore - a.searchScore)

      // Separate into laws and guidelines for "all" tab
      if (activeTab === 'all') {
        const lawResults = matchedDocs.filter(doc => {
          const type = (doc.type || '').toLowerCase()
          const abbr = (doc.abbreviation || '').toLowerCase()
          return !type.includes('merkblatt') && !type.includes('guideline') &&
                 !abbr.includes('trbs') && !abbr.includes('trgs') && !abbr.includes('asr') &&
                 !abbr.includes('m.plus') && !abbr.includes('merkblatt')
        })
        const guidelineResults = matchedDocs.filter(doc => {
          const type = (doc.type || '').toLowerCase()
          const abbr = (doc.abbreviation || '').toLowerCase()
          return type.includes('merkblatt') || type.includes('guideline') ||
                 abbr.includes('trbs') || abbr.includes('trgs') || abbr.includes('asr') ||
                 abbr.includes('m.plus') || abbr.includes('merkblatt') || abbr.includes('dguv')
        })
        setSearchResults({
          laws: lawResults.slice(0, 5),
          guidelines: guidelineResults.slice(0, 5),
          pdfMatches: matchedDocs.filter(d => d.snippets?.length > 0).slice(0, 3)
        })
      } else {
        setSearchResults({
          laws: activeTab === 'laws' ? matchedDocs.slice(0, 8) : [],
          guidelines: activeTab === 'guidelines' ? matchedDocs.slice(0, 8) : [],
          pdfMatches: matchedDocs.filter(d => d.snippets?.length > 0).slice(0, 5)
        })
      }

      // Notify parent component
      if (onSearch) {
        onSearch(term, activeTab, matchedDocs)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, [activeTab, laws, categorizedDocs, searchInContent, onSearch])

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (searchTerm.length >= 2) {
      debounceRef.current = setTimeout(() => {
        performSearch(searchTerm)
      }, 200)
    } else {
      setSearchResults({ laws: [], guidelines: [], pdfMatches: [] })
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchTerm, performSearch])

  // Re-search when tab changes
  useEffect(() => {
    if (searchTerm.length >= 2) {
      performSearch(searchTerm)
    }
  }, [activeTab])

  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    if (onModeChange) {
      onModeChange(tabId)
    }
  }

  // Handle result click
  const handleResultClick = (doc) => {
    setIsExpanded(false)
    if (onSelectLaw) {
      onSelectLaw(doc)
    }
  }

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      performSearch(searchTerm)
    } else if (e.key === 'Escape') {
      setIsExpanded(false)
    }
  }

  // Highlight search term in text
  const highlightMatch = (text, term) => {
    if (!text || !term) return text
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      part.toLowerCase() === term.toLowerCase()
        ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-500/50 text-gray-900 dark:text-white px-0.5 rounded">{part}</mark>
        : part
    )
  }

  const currentTab = tabs.find(t => t.id === activeTab)
  const hasResults = searchResults.laws.length > 0 || searchResults.guidelines.length > 0 || searchResults.pdfMatches.length > 0

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Search Input Container */}
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-whs-orange-500/20 via-amber-500/20 to-indigo-500/20 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity"></div>

        {/* Tab selector button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-whs-dark-600 hover:bg-gray-200 dark:hover:bg-whs-dark-500 transition-colors z-10"
          title={currentTab?.description}
        >
          <span className="text-sm">{currentTab?.icon}</span>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 hidden sm:inline">
            {currentTab?.label}
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
            if (e.target.value.length >= 2) {
              setIsExpanded(true)
            }
          }}
          onFocus={() => {
            if (searchTerm.length >= 2 || hasResults) {
              setIsExpanded(true)
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={currentTab?.description || placeholder}
          className="relative w-full pl-28 sm:pl-32 pr-20 py-3 text-sm bg-white dark:bg-whs-dark-700/80 border border-gray-200 dark:border-whs-dark-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-whs-orange-500/50 focus:border-whs-orange-500 transition-all placeholder:text-gray-400"
        />

        {/* Action buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('')
                setSearchResults({ laws: [], guidelines: [], pdfMatches: [] })
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-whs-dark-600 rounded-lg transition-all"
              title="Suche löschen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={() => performSearch(searchTerm)}
            disabled={isSearching || !searchTerm.trim()}
            className="p-2 text-white bg-whs-orange-500 hover:bg-whs-orange-600 rounded-lg transition-all disabled:opacity-50"
            title="Suchen"
          >
            {isSearching ? (
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
          {/* Tab Selector */}
          <div className="p-3 border-b border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-900">
            <div className="flex gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-whs-orange-500 text-white shadow-lg shadow-whs-orange-500/25'
                      : 'bg-white dark:bg-whs-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-whs-dark-600 border border-gray-200 dark:border-whs-dark-600'
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    activeTab === tab.id
                      ? 'bg-white/20'
                      : 'bg-gray-100 dark:bg-whs-dark-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Results */}
          {searchTerm.length >= 2 && (
            <div className="divide-y divide-gray-100 dark:divide-whs-dark-700">
              {/* "All" tab shows both categories */}
              {activeTab === 'all' && (
                <>
                  {/* Laws Section */}
                  {searchResults.laws.length > 0 && (
                    <div className="p-3">
                      <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        <span>⚖️</span>
                        <span>{t.search?.lawsFound || 'Gesetze'}</span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400 normal-case">
                          {searchResults.laws.length}
                        </span>
                      </h3>
                      <div className="space-y-1">
                        {searchResults.laws.map(doc => (
                          <SearchResultItem
                            key={doc.id}
                            doc={doc}
                            searchTerm={searchTerm}
                            highlightMatch={highlightMatch}
                            onClick={() => handleResultClick(doc)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guidelines Section */}
                  {searchResults.guidelines.length > 0 && (
                    <div className="p-3">
                      <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        <span>📋</span>
                        <span>{t.search?.guidelinesFound || 'Richtlinien'}</span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400 normal-case">
                          {searchResults.guidelines.length}
                        </span>
                      </h3>
                      <div className="space-y-1">
                        {searchResults.guidelines.map(doc => (
                          <SearchResultItem
                            key={doc.id}
                            doc={doc}
                            searchTerm={searchTerm}
                            highlightMatch={highlightMatch}
                            onClick={() => handleResultClick(doc)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Single category results */}
              {activeTab === 'laws' && searchResults.laws.length > 0 && (
                <div className="p-3">
                  <div className="space-y-1">
                    {searchResults.laws.map(doc => (
                      <SearchResultItem
                        key={doc.id}
                        doc={doc}
                        searchTerm={searchTerm}
                        highlightMatch={highlightMatch}
                        onClick={() => handleResultClick(doc)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'guidelines' && searchResults.guidelines.length > 0 && (
                <div className="p-3">
                  <div className="space-y-1">
                    {searchResults.guidelines.map(doc => (
                      <SearchResultItem
                        key={doc.id}
                        doc={doc}
                        searchTerm={searchTerm}
                        highlightMatch={highlightMatch}
                        onClick={() => handleResultClick(doc)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* PDF Content Matches - Smart Snippets */}
              {searchResults.pdfMatches.length > 0 && (
                <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                  <h3 className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">
                    <span>📄</span>
                    <span>{t.search?.contentMatches || 'Volltexttreffer'}</span>
                  </h3>
                  <div className="space-y-3">
                    {searchResults.pdfMatches.map(doc => (
                      <div key={doc.id} className="bg-white dark:bg-whs-dark-800 rounded-lg p-3 shadow-sm">
                        <button
                          onClick={() => handleResultClick(doc)}
                          className="flex items-start gap-2 w-full text-left hover:bg-gray-50 dark:hover:bg-whs-dark-700 -m-1 p-1 rounded transition-colors"
                        >
                          <span className="text-lg">{doc.type?.includes('merkblatt') ? '📋' : '⚖️'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {doc.abbreviation || doc.title?.split(' ').slice(0, 3).join(' ')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {doc.title_en || doc.title}
                            </p>
                          </div>
                        </button>

                        {/* Snippets */}
                        <div className="mt-2 space-y-2">
                          {doc.snippets?.slice(0, 2).map((snippet, idx) => (
                            <div key={idx} className="pl-6 border-l-2 border-indigo-300 dark:border-indigo-600">
                              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-0.5">
                                {snippet.source}
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {highlightMatch(snippet.text, searchTerm)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {!hasResults && searchTerm.length >= 2 && !isSearching && (
                <div className="p-8 text-center">
                  <span className="text-4xl mb-3 block">🔍</span>
                  <p className="text-gray-500 dark:text-gray-400">
                    {t.search?.noResults || 'Keine Ergebnisse gefunden für'} "{searchTerm}"
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t.search?.tryDifferent || 'Versuchen Sie einen anderen Suchbegriff'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quick Help when no search term */}
          {searchTerm.length < 2 && (
            <div className="p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {t.search?.hint || 'Geben Sie mindestens 2 Zeichen ein um zu suchen'}
              </p>
              <div className="flex flex-wrap gap-2">
                {['ASchG', 'PPE', 'Erste Hilfe', 'DGUV', 'Gefährdung'].map(term => (
                  <button
                    key={term}
                    onClick={() => {
                      setSearchTerm(term)
                      performSearch(term)
                    }}
                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-whs-dark-600 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-2 bg-gray-50 dark:bg-whs-dark-900 border-t border-gray-100 dark:border-whs-dark-700">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-whs-dark-600 font-mono">Enter</kbd>
                {' '}{t.search?.toSearch || 'suchen'}
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-whs-dark-600 font-mono">Esc</kbd>
                {' '}{t.search?.toClose || 'schließen'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Search Result Item Component
function SearchResultItem({ doc, searchTerm, highlightMatch, onClick }) {
  const isGuideline = doc.type?.includes('merkblatt') || doc.type?.includes('guideline') ||
                      doc.abbreviation?.toLowerCase().includes('trbs') ||
                      doc.abbreviation?.toLowerCase().includes('dguv')

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-whs-dark-700 rounded-lg transition-colors text-left group"
    >
      <span className="text-xl mt-0.5">{isGuideline ? '📋' : '⚖️'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-whs-orange-600 dark:group-hover:text-whs-orange-400 transition-colors">
            {highlightMatch(doc.abbreviation || doc.title?.split(' ')[0], searchTerm)}
          </p>
          {doc.searchScore >= 50 && (
            <span className="px-1.5 py-0.5 bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-600 dark:text-whs-orange-400 text-xs rounded font-medium">
              Top
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {highlightMatch(doc.title_en || doc.title, searchTerm)}
        </p>
        {doc.snippets?.length > 0 && (
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {doc.snippets.length} Texttreffer
          </p>
        )}
      </div>
      <svg className="w-4 h-4 text-gray-400 group-hover:text-whs-orange-500 transition-colors mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

export default SmartSearch

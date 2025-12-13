import { useState, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Card, CardContent, SearchInput, Skeleton } from '../ui'
import {
  getAllLaws,
  searchLaws,
  getLawById,
  getRelatedLaws,
  getLawCategories,
  getLawExcerpt,
  formatLawReference
} from '../../services/euLawsDatabase'

// Highlight search terms in text
function highlightText(text, term) {
  if (!term || !text) return text
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = String(text).split(regex)
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="highlight-search">{part}</mark>
      : part
  )
}

// Law type badge colors
const typeColors = {
  law: 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300',
  dguv_regulation: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  dguv_rule: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  dguv_information: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
}

export function LawBrowser({ onBack }) {
  const { t, framework, isBookmarked, toggleBookmark, addRecentSearch } = useApp()
  const { explainSection, isLoading: aiLoading } = useAI()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLaw, setSelectedLaw] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [explanation, setExplanation] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'

  // Get all laws and categories
  const allLaws = useMemo(() => getAllLaws(framework), [framework])
  const categories = useMemo(() => getLawCategories(framework), [framework])

  // Filter and search laws
  const filteredLaws = useMemo(() => {
    let results = allLaws

    // Filter by category
    if (selectedCategory !== 'all') {
      results = results.filter(law => law.type === selectedCategory)
    }

    // Search if term exists
    if (searchTerm.trim()) {
      results = searchLaws(searchTerm, {
        country: framework,
        type: selectedCategory !== 'all' ? selectedCategory : null,
        limit: 100
      })
    }

    return results
  }, [allLaws, searchTerm, selectedCategory, framework])

  // Get related laws for selected law
  const relatedLaws = useMemo(() => {
    if (!selectedLaw) return []
    return getRelatedLaws(framework, selectedLaw.id, 5)
  }, [selectedLaw, framework])

  // Handle search
  const handleSearch = useCallback((term) => {
    setSearchTerm(term)
    if (term.trim()) {
      addRecentSearch(term)
    }
  }, [addRecentSearch])

  // Handle AI explanation
  const handleExplain = async () => {
    if (!selectedLaw) return
    try {
      const response = await explainSection({
        title: selectedLaw.title,
        content: selectedLaw.content?.full_text?.substring(0, 3000) || selectedLaw.description
      })
      setExplanation(response)
    } catch (error) {
      setExplanation(t.api?.error || 'Failed to generate explanation')
    }
  }

  // Select a law
  const selectLaw = (law) => {
    setSelectedLaw(law)
    setExplanation('')
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-whs-orange-500 dark:hover:text-whs-orange-400 transition-colors mb-4 group"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">{t.common?.back || 'Back'}</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.modules?.lawBrowser?.title || 'Law Browser'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Browse {filteredLaws.length} laws and regulations from the EU safety database
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-whs-dark-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-whs-dark-700 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-whs-dark-700'}`}
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-whs-dark-700 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-whs-dark-700'}`}
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onSearch={handleSearch}
          onClear={() => setSearchTerm('')}
          placeholder={t.common?.searchPlaceholder || 'Search laws, regulations, keywords...'}
        />

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-whs-orange-500 text-white shadow-md'
                : 'bg-gray-100 dark:bg-whs-dark-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-whs-dark-700'
            }`}
          >
            All ({allLaws.length})
          </button>
          {Object.entries(categories).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setSelectedCategory(type)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedCategory === type
                  ? 'bg-whs-orange-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-whs-dark-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-whs-dark-700'
              }`}
            >
              {type.replace(/_/g, ' ')} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Laws List */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-whs-dark-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Laws & Regulations
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filteredLaws.length} items found
              </p>
            </div>

            <div className="overflow-y-auto h-[calc(100%-80px)]">
              {filteredLaws.length > 0 ? (
                <div className={viewMode === 'grid' ? 'p-4 grid grid-cols-1 gap-3' : 'divide-y divide-gray-100 dark:divide-whs-dark-700'}>
                  {filteredLaws.slice(0, 50).map((law) => (
                    <button
                      key={law.id}
                      onClick={() => selectLaw(law)}
                      className={`w-full text-left transition-all ${
                        viewMode === 'grid'
                          ? `p-4 rounded-xl border ${
                              selectedLaw?.id === law.id
                                ? 'border-whs-orange-500 bg-whs-orange-50 dark:bg-whs-orange-900/20'
                                : 'border-gray-100 dark:border-whs-dark-700 hover:border-whs-orange-300 dark:hover:border-whs-orange-700 hover:bg-gray-50 dark:hover:bg-whs-dark-700'
                            }`
                          : `p-4 ${
                              selectedLaw?.id === law.id
                                ? 'bg-whs-orange-50 dark:bg-whs-orange-900/20'
                                : 'hover:bg-gray-50 dark:hover:bg-whs-dark-800'
                            }`
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[law.type] || typeColors.law}`}>
                              {law.abbreviation || law.type}
                            </span>
                            {isBookmarked(law.id) && (
                              <svg className="w-4 h-4 text-whs-orange-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            )}
                          </div>
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {highlightText(law.title, searchTerm)}
                          </h4>
                          {law.title_en && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {highlightText(law.title_en, searchTerm)}
                            </p>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium">No results found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Law Detail */}
        <div className="lg:col-span-3">
          <Card className="h-[600px] overflow-hidden">
            {selectedLaw ? (
              <>
                <div className="p-5 border-b border-gray-100 dark:border-whs-dark-700">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeColors[selectedLaw.type] || typeColors.law}`}>
                          {selectedLaw.type?.replace(/_/g, ' ')}
                        </span>
                        {(selectedLaw.enacted || selectedLaw.category) && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {selectedLaw.enacted ? `Enacted: ${selectedLaw.enacted}` : selectedLaw.category}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {(selectedLaw.abbreviation || selectedLaw.abbr) && (
                          <span className="text-whs-orange-500">{selectedLaw.abbreviation || selectedLaw.abbr} - </span>
                        )}
                        {selectedLaw.title}
                      </h3>
                      {selectedLaw.title_en && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {selectedLaw.title_en}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleBookmark(selectedLaw.id)}
                      className={`p-2 rounded-xl transition-all ${
                        isBookmarked(selectedLaw.id)
                          ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-500'
                          : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-400 hover:text-whs-orange-500'
                      }`}
                      aria-label={isBookmarked(selectedLaw.id) ? 'Remove bookmark' : 'Add bookmark'}
                    >
                      <svg className="w-5 h-5" fill={isBookmarked(selectedLaw.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto h-[calc(100%-180px)] p-5">
                  {/* Category */}
                  {selectedLaw.category && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Category</h4>
                      <span className="inline-block px-3 py-1 bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300 rounded-lg text-sm">
                        {selectedLaw.category}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      {selectedLaw.description || 'No description available for this law.'}
                    </p>
                  </div>

                  {/* Content excerpt */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Content Excerpt</h4>
                    {(selectedLaw.content?.full_text || selectedLaw.content?.text) ? (
                      <div className="bg-gray-50 dark:bg-whs-dark-700 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {highlightText(
                          getLawExcerpt(selectedLaw, searchTerm, 800),
                          searchTerm
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 italic">No content excerpt available for this law.</p>
                    )}
                  </div>

                  {/* Source */}
                  {selectedLaw.source && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Source</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedLaw.source.name}
                        </span>
                        {selectedLaw.source.url && (
                          <a
                            href={selectedLaw.source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-whs-orange-500 hover:text-whs-orange-600 text-sm inline-flex items-center gap-1"
                          >
                            View source
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Related Laws */}
                  {relatedLaws.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Related Laws</h4>
                      <div className="flex flex-wrap gap-2">
                        {relatedLaws.map(related => (
                          <button
                            key={related.id}
                            onClick={() => selectLaw(related)}
                            className="law-reference"
                          >
                            {related.abbreviation || related.title?.substring(0, 20)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Explanation */}
                  {explanation && (
                    <div className="mt-4 p-4 bg-whs-info-500/10 dark:bg-whs-info-500/20 border border-whs-info-500/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-whs-info-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <h4 className="font-medium text-whs-info-600 dark:text-whs-info-400">AI Explanation</h4>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">{explanation}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-900/50">
                  <div className="flex gap-3">
                    <Button
                      onClick={handleExplain}
                      loading={aiLoading}
                      disabled={aiLoading}
                      className="flex-1"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Explain with AI
                    </Button>
                    {selectedLaw.source?.pdf_url && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(selectedLaw.source.pdf_url, '_blank')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <CardContent className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-whs-dark-700 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Select a Law
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-xs">
                  Choose a law or regulation from the list to view its details, get AI explanations, and find related regulations.
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default LawBrowser

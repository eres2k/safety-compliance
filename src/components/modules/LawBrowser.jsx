import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Card, CardContent, SearchInput } from '../ui'
import {
  getAllLaws,
  searchLaws,
  getLawById,
  getRelatedLaws,
  getLawCategories,
  formatLawReference
} from '../../services/euLawsDatabase'

// Parse law text into sections
function parseLawSections(text) {
  if (!text) return []

  const sections = []
  // Match § sections and Artikel
  const sectionRegex = /(?:^|\n)(§\s*(\d+[a-z]?)\s*\.?\s*([^\n]*)|(?:Artikel|Art\.?)\s*(\d+[a-z]?)\s*\.?\s*([^\n]*))/gi

  let match
  while ((match = sectionRegex.exec(text)) !== null) {
    const isArticle = !!match[4]
    const number = isArticle ? match[4] : match[2]
    const title = (isArticle ? match[5] : match[3])?.trim() || ''
    const prefix = isArticle ? 'Art.' : '§'

    sections.push({
      id: `section-${number}`,
      number: `${prefix} ${number}`,
      title: title.substring(0, 80),
      index: match.index
    })
  }

  // Add content to each section
  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].index
    const end = i < sections.length - 1 ? sections[i + 1].index : text.length
    sections[i].content = text.substring(start, end).trim()
  }

  return sections
}

// Skip boilerplate and get clean text
function getCleanLawText(text) {
  if (!text) return ''

  // Find where real content starts
  const markers = [
    /§\s*1[.\s\n]/i,
    /Artikel\s*1[.\s]/i,
    /1\.\s*Abschnitt/i,
    /Allgemeine Bestimmungen/i,
    /Geltungsbereich/i,
  ]

  let startIndex = 0
  for (const marker of markers) {
    const match = text.match(marker)
    if (match && match.index < text.length * 0.4) {
      startIndex = match.index
      break
    }
  }

  return text.substring(startIndex)
}

// Law type badge colors
const typeColors = {
  law: 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300',
  ordinance: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
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
  const [activeSection, setActiveSection] = useState(null)
  const [searchInLaw, setSearchInLaw] = useState('')

  const contentRef = useRef(null)
  const sectionRefs = useRef({})

  // Get all laws and categories
  const allLaws = useMemo(() => getAllLaws(framework), [framework])
  const categories = useMemo(() => getLawCategories(framework), [framework])

  // Filter and search laws
  const filteredLaws = useMemo(() => {
    let results = allLaws
    if (selectedCategory !== 'all') {
      results = results.filter(law => law.type === selectedCategory)
    }
    if (searchTerm.trim()) {
      results = searchLaws(searchTerm, {
        country: framework,
        type: selectedCategory !== 'all' ? selectedCategory : null,
        limit: 100
      })
    }
    return results
  }, [allLaws, searchTerm, selectedCategory, framework])

  // Parse sections for selected law
  const lawSections = useMemo(() => {
    if (!selectedLaw) return []
    const text = selectedLaw.content?.full_text || selectedLaw.content?.text || ''
    return parseLawSections(getCleanLawText(text))
  }, [selectedLaw])

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!searchInLaw.trim()) return lawSections
    const term = searchInLaw.toLowerCase()
    return lawSections.filter(s =>
      s.number.toLowerCase().includes(term) ||
      s.title.toLowerCase().includes(term) ||
      s.content.toLowerCase().includes(term)
    )
  }, [lawSections, searchInLaw])

  // Get related laws
  const relatedLaws = useMemo(() => {
    if (!selectedLaw) return []
    return getRelatedLaws(framework, selectedLaw.id, 5)
  }, [selectedLaw, framework])

  // Scroll to section
  const scrollToSection = useCallback((sectionId) => {
    const element = sectionRefs.current[sectionId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(sectionId)
    }
  }, [])

  // Handle search
  const handleSearch = useCallback((term) => {
    setSearchTerm(term)
    if (term.trim()) addRecentSearch(term)
  }, [addRecentSearch])

  // Handle AI explanation
  const handleExplain = async () => {
    if (!selectedLaw) return
    try {
      const text = selectedLaw.content?.full_text || selectedLaw.content?.text || ''
      const response = await explainSection({
        title: selectedLaw.title,
        content: text.substring(0, 3000) || selectedLaw.description
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
    setActiveSection(null)
    setSearchInLaw('')
  }

  const hasContent = selectedLaw?.content?.full_text || selectedLaw?.content?.text

  return (
    <div className="animate-fade-in h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-whs-orange-500 transition-colors mb-3 group"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">{t.common?.back || 'Back'}</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.modules?.lawBrowser?.title || 'Law Browser'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {filteredLaws.length} laws and regulations
            </p>
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'bg-whs-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-whs-dark-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              All ({allLaws.length})
            </button>
            {Object.entries(categories).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setSelectedCategory(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === type
                    ? 'bg-whs-orange-500 text-white'
                    : 'bg-gray-100 dark:bg-whs-dark-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {type} ({count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onSearch={handleSearch}
          onClear={() => setSearchTerm('')}
          placeholder="Search laws..."
        />
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex gap-4 h-[calc(100%-140px)]">

        {/* Left: Law List */}
        <div className="w-72 flex-shrink-0">
          <Card className="h-full overflow-hidden">
            <div className="p-3 border-b border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Laws & Regulations</h3>
            </div>
            <div className="overflow-y-auto h-[calc(100%-48px)]">
              {filteredLaws.slice(0, 50).map((law) => (
                <button
                  key={law.id}
                  onClick={() => selectLaw(law)}
                  className={`w-full text-left p-3 border-b border-gray-50 dark:border-whs-dark-800 transition-colors ${
                    selectedLaw?.id === law.id
                      ? 'bg-whs-orange-50 dark:bg-whs-orange-900/20 border-l-4 border-l-whs-orange-500'
                      : 'hover:bg-gray-50 dark:hover:bg-whs-dark-800'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[law.type] || typeColors.law}`}>
                      {law.abbreviation || law.abbr || law.type}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
                    {law.title}
                  </h4>
                  {law.title_en && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                      {law.title_en}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Middle: Section Navigation (when law selected) */}
        {selectedLaw && lawSections.length > 0 && (
          <div className="w-56 flex-shrink-0">
            <Card className="h-full overflow-hidden">
              <div className="p-3 border-b border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Sections ({lawSections.length})</h3>
                <input
                  type="text"
                  value={searchInLaw}
                  onChange={(e) => setSearchInLaw(e.target.value)}
                  placeholder="Search sections..."
                  className="mt-2 w-full px-2 py-1 text-sm bg-white dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-whs-orange-500"
                />
              </div>
              <div className="overflow-y-auto h-[calc(100%-84px)]">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-gray-50 dark:border-whs-dark-800 ${
                      activeSection === section.id
                        ? 'bg-whs-orange-50 dark:bg-whs-orange-900/20 text-whs-orange-700 dark:text-whs-orange-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-whs-dark-800'
                    }`}
                  >
                    <span className="font-semibold text-whs-orange-500">{section.number}</span>
                    {section.title && (
                      <span className="ml-1 line-clamp-1">{section.title}</span>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Right: Law Content */}
        <div className="flex-1 min-w-0">
          <Card className="h-full overflow-hidden">
            {selectedLaw ? (
              <div className="h-full flex flex-col">
                {/* Law Header */}
                <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-whs-dark-700 bg-gradient-to-r from-whs-orange-500 to-whs-orange-600 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                          {selectedLaw.type}
                        </span>
                        {selectedLaw.category && (
                          <span className="px-2 py-0.5 bg-white/20 rounded text-xs">
                            {selectedLaw.category}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold">
                        {selectedLaw.abbreviation || selectedLaw.abbr} - {selectedLaw.title}
                      </h3>
                      {selectedLaw.title_en && (
                        <p className="text-white/80 text-sm mt-1">{selectedLaw.title_en}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleBookmark(selectedLaw.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          isBookmarked(selectedLaw.id) ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        <svg className="w-5 h-5" fill={isBookmarked(selectedLaw.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                      {selectedLaw.source?.url && (
                        <a
                          href={selectedLaw.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Law Content */}
                <div ref={contentRef} className="flex-1 overflow-y-auto">
                  {hasContent ? (
                    <div className="p-6">
                      {/* Source info */}
                      {selectedLaw.source && (
                        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                          <span className="font-medium text-blue-700 dark:text-blue-300">Source:</span>
                          <span className="ml-2 text-blue-600 dark:text-blue-400">{selectedLaw.source.name}</span>
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
                                className="px-3 py-1 bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300 rounded-lg text-sm hover:bg-whs-orange-200 dark:hover:bg-whs-orange-900/50 transition-colors"
                              >
                                {related.abbreviation || related.title?.substring(0, 20)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sections */}
                      {filteredSections.length > 0 ? (
                        <div className="space-y-8">
                          {filteredSections.map((section) => (
                            <div
                              key={section.id}
                              id={section.id}
                              ref={(el) => (sectionRefs.current[section.id] = el)}
                              className="scroll-mt-4"
                            >
                              <div className="flex items-baseline gap-3 mb-3 pb-2 border-b-2 border-whs-orange-200 dark:border-whs-orange-800">
                                <span className="text-2xl font-bold text-whs-orange-500">
                                  {section.number}
                                </span>
                                {section.title && (
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {section.title}
                                  </h3>
                                )}
                              </div>
                              <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-gray-100 dark:border-whs-dark-700">
                                {section.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Raw text fallback */
                        <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {getCleanLawText(selectedLaw.content?.full_text || selectedLaw.content?.text)}
                        </div>
                      )}

                      {/* AI Explanation */}
                      {explanation && (
                        <div className="mt-8 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <h4 className="font-semibold text-purple-700 dark:text-purple-300">AI Explanation</h4>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{explanation}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
                      <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium mb-2">No content available</p>
                      <p className="text-sm text-center mb-4">The full text for this law has not been loaded.</p>
                      {selectedLaw.source?.url && (
                        <a
                          href={selectedLaw.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-whs-orange-500 hover:text-whs-orange-600 flex items-center gap-2"
                        >
                          View on official source
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="flex-shrink-0 p-3 border-t border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleExplain}
                      loading={aiLoading}
                      disabled={aiLoading}
                      size="sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Explain with AI
                    </Button>
                    {selectedLaw.source?.pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(selectedLaw.source.pdf_url, '_blank')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              </div>
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
                  Choose a law from the list to read its full content with section navigation.
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

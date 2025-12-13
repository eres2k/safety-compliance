import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Button, Card } from '../ui'

/**
 * Parse raw law text into structured sections
 */
function parseLawSections(text) {
  if (!text) return { sections: [], cleanedText: '' }

  // Skip boilerplate header content
  const boilerplatePatterns = [
    /^.*?(?=§\s*1[.\s\n]|Artikel\s*1|1\.\s*Teil|1\.\s*Abschnitt|Präambel|INHALTSVERZEICHNIS)/is,
  ]

  let cleanedText = text
  for (const pattern of boilerplatePatterns) {
    const match = text.match(pattern)
    if (match && match[0].length < text.length * 0.3) {
      cleanedText = text.substring(match[0].length)
      break
    }
  }

  const sections = []

  // Match German law sections: § 1, § 2a, § 10, etc.
  // Also match "Artikel 1", "Art. 1", etc.
  const sectionRegex = /(?:^|\n)(§\s*(\d+[a-z]?)\s*\.?\s*([^\n]*?)(?:\n|$)|(Artikel|Art\.?)\s*(\d+[a-z]?)\s*\.?\s*([^\n]*?)(?:\n|$))/gi

  let lastIndex = 0
  let match

  while ((match = sectionRegex.exec(cleanedText)) !== null) {
    const isArticle = !!match[4]
    const number = isArticle ? match[5] : match[2]
    const title = (isArticle ? match[6] : match[3])?.trim() || ''
    const prefix = isArticle ? (match[4].startsWith('Art') ? 'Art.' : 'Artikel') : '§'

    sections.push({
      id: `section-${prefix.replace('.', '')}-${number}`.toLowerCase(),
      number: `${prefix} ${number}`,
      title: title,
      startIndex: match.index,
      fullMatch: match[0]
    })
  }

  // Calculate content for each section (from start to next section)
  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].startIndex + sections[i].fullMatch.length
    const end = i < sections.length - 1 ? sections[i + 1].startIndex : cleanedText.length
    sections[i].content = cleanedText.substring(start, end).trim()
  }

  return { sections, cleanedText }
}

/**
 * Parse subsections within a section (1), (2), etc.
 */
function parseSubsections(content) {
  if (!content) return []

  const subsections = []
  const regex = /(?:^|\n)\((\d+[a-z]?)\)\s*/g
  let match
  let lastIndex = 0

  while ((match = regex.exec(content)) !== null) {
    if (lastIndex > 0) {
      // Add content to previous subsection
      subsections[subsections.length - 1].content = content.substring(lastIndex, match.index).trim()
    }
    subsections.push({
      number: `(${match[1]})`,
      startIndex: match.index,
      content: ''
    })
    lastIndex = match.index + match[0].length
  }

  // Add remaining content to last subsection
  if (subsections.length > 0) {
    subsections[subsections.length - 1].content = content.substring(lastIndex).trim()
  }

  return subsections
}

/**
 * Render cross-references as clickable links
 */
function renderWithReferences(text, onReferenceClick) {
  if (!text) return null

  // Match references like "§ 1", "§§ 1 bis 5", "Art. 3", etc.
  const refRegex = /(§§?\s*\d+[a-z]?(?:\s*(?:bis|und|,)\s*\d+[a-z]?)*|Art(?:ikel)?\.?\s*\d+[a-z]?)/g

  const parts = []
  let lastIndex = 0
  let match

  while ((match = refRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }

    // Add clickable reference
    const ref = match[1]
    parts.push(
      <button
        key={match.index}
        onClick={() => onReferenceClick(ref)}
        className="text-whs-orange-500 hover:text-whs-orange-600 hover:underline font-medium"
      >
        {ref}
      </button>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts
}

/**
 * Full Law Viewer Component
 */
export function LawViewer({ law, onClose, onNavigateToLaw }) {
  const [activeSection, setActiveSection] = useState(null)
  const [tocCollapsed, setTocCollapsed] = useState(false)
  const [searchInLaw, setSearchInLaw] = useState('')
  const contentRef = useRef(null)
  const sectionRefs = useRef({})

  // Parse the law content into sections
  const { sections, cleanedText } = useMemo(() => {
    const text = law?.content?.full_text || law?.content?.text || ''
    return parseLawSections(text)
  }, [law])

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!searchInLaw.trim()) return sections
    const term = searchInLaw.toLowerCase()
    return sections.filter(s =>
      s.number.toLowerCase().includes(term) ||
      s.title.toLowerCase().includes(term) ||
      s.content.toLowerCase().includes(term)
    )
  }, [sections, searchInLaw])

  // Scroll to section
  const scrollToSection = useCallback((sectionId) => {
    const element = sectionRefs.current[sectionId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(sectionId)
    }
  }, [])

  // Handle reference click
  const handleReferenceClick = useCallback((ref) => {
    // Extract section number from reference
    const match = ref.match(/§\s*(\d+[a-z]?)|Art(?:ikel)?\.?\s*(\d+[a-z]?)/i)
    if (match) {
      const num = match[1] || match[2]
      const prefix = ref.startsWith('Art') ? 'art' : '§'
      const sectionId = `section-${prefix}-${num}`.toLowerCase()

      // Check if section exists in current law
      const section = sections.find(s => s.id === sectionId)
      if (section) {
        scrollToSection(sectionId)
      }
    }
  }, [sections, scrollToSection])

  // Track scroll position to highlight active section in TOC
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop

      for (const section of sections) {
        const element = sectionRefs.current[section.id]
        if (element) {
          const rect = element.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          if (rect.top >= containerRect.top && rect.top <= containerRect.top + 200) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [sections])

  if (!law) return null

  const hasContent = sections.length > 0 || cleanedText

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-4 md:inset-8 bg-white dark:bg-whs-dark-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 p-4 md:p-6 border-b border-gray-200 dark:border-whs-dark-700 bg-gradient-to-r from-whs-orange-500 to-whs-orange-600">
          <div className="flex items-start justify-between gap-4">
            <div className="text-white">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                  {law.type?.replace(/_/g, ' ')}
                </span>
                {law.category && (
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                    {law.category}
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">
                {law.abbreviation || law.abbr} - {law.title}
              </h2>
              {law.title_en && (
                <p className="text-white/80 mt-1">{law.title_en}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search within law */}
          <div className="mt-4 relative">
            <input
              type="text"
              value={searchInLaw}
              onChange={(e) => setSearchInLaw(e.target.value)}
              placeholder="Search within this law..."
              className="w-full md:w-96 px-4 py-2 pl-10 bg-white/20 text-white placeholder-white/60 rounded-xl border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Table of Contents Sidebar */}
          {sections.length > 0 && (
            <div className={`flex-shrink-0 border-r border-gray-200 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800 transition-all duration-300 ${tocCollapsed ? 'w-12' : 'w-64 md:w-80'}`}>
              <div className="h-full flex flex-col">
                {/* TOC Header */}
                <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-whs-dark-700">
                  {!tocCollapsed && (
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                      Table of Contents ({sections.length})
                    </h3>
                  )}
                  <button
                    onClick={() => setTocCollapsed(!tocCollapsed)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-whs-dark-700 rounded-lg transition-colors"
                    aria-label={tocCollapsed ? 'Expand' : 'Collapse'}
                  >
                    <svg className={`w-5 h-5 text-gray-500 transition-transform ${tocCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                </div>

                {/* TOC List */}
                {!tocCollapsed && (
                  <div className="flex-1 overflow-y-auto p-2">
                    {filteredSections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
                          activeSection === section.id
                            ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-whs-dark-700'
                        }`}
                      >
                        <span className="font-medium text-whs-orange-500">{section.number}</span>
                        {section.title && (
                          <span className="ml-2 truncate">{section.title}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Law Content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto">
            {hasContent ? (
              <div className="p-6 md:p-8 max-w-4xl">
                {/* Source info */}
                {law.source && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">Source: {law.source.name}</span>
                      {law.source.url && (
                        <a
                          href={law.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-sm hover:underline flex items-center gap-1"
                        >
                          View original
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Sections */}
                {sections.length > 0 ? (
                  <div className="space-y-8">
                    {filteredSections.map((section) => {
                      const subsections = parseSubsections(section.content)

                      return (
                        <div
                          key={section.id}
                          id={section.id}
                          ref={(el) => (sectionRefs.current[section.id] = el)}
                          className="scroll-mt-4"
                        >
                          {/* Section Header */}
                          <div className="flex items-baseline gap-3 mb-4 pb-2 border-b border-gray-200 dark:border-whs-dark-700">
                            <span className="text-2xl font-bold text-whs-orange-500">
                              {section.number}
                            </span>
                            {section.title && (
                              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {section.title}
                              </h3>
                            )}
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}${window.location.pathname}#${section.id}`
                                navigator.clipboard.writeText(url)
                              }}
                              className="ml-auto p-1 text-gray-400 hover:text-whs-orange-500 transition-colors"
                              title="Copy link to section"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                          </div>

                          {/* Section Content */}
                          <div className="prose prose-gray dark:prose-invert max-w-none">
                            {subsections.length > 0 ? (
                              <div className="space-y-4">
                                {subsections.map((sub, idx) => (
                                  <div key={idx} className="flex gap-3">
                                    <span className="flex-shrink-0 font-medium text-gray-500 dark:text-gray-400 w-8">
                                      {sub.number}
                                    </span>
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                      {renderWithReferences(sub.content, handleReferenceClick)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {renderWithReferences(section.content, handleReferenceClick)}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* Raw text fallback */
                  <div className="prose prose-gray dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {cleanedText}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg font-medium">No content available</p>
                <p className="text-sm mt-1">This law's full text has not been loaded yet.</p>
                {law.source?.url && (
                  <a
                    href={law.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 text-whs-orange-500 hover:text-whs-orange-600 flex items-center gap-2"
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
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {sections.length > 0 && (
                <span>{sections.length} sections</span>
              )}
              {law.content?.full_text && (
                <span className="ml-4">{Math.round(law.content.full_text.length / 1000)}k characters</span>
              )}
            </div>
            <div className="flex gap-3">
              {law.source?.pdf_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(law.source.pdf_url, '_blank')}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </Button>
              )}
              <Button onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LawViewer

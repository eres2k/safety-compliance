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

// Remove duplicate expanded notation text from Austrian legal documents
// The source data contains both abbreviated (§ 1, Abs. 1, Z 1) and expanded (Paragraph eins, Absatz eins, Ziffer eins) versions
function cleanDuplicateText(text) {
  if (!text) return ''

  const lines = text.split('\n')
  const cleanedLines = []

  // Standalone expanded notation patterns (these are always duplicates)
  const standaloneExpandedPatterns = [
    /^Paragraph\s+\d+[a-z]?\s*,?\s*$/i,           // "Paragraph 13 c,"
    /^Paragraph\s+\d+\s+[a-z]\s*,?\s*$/i,         // "Paragraph 52 a,"
    /^Paragraph\s+eins\s*,?\s*$/i,                // "Paragraph eins,"
    /^Absatz\s+(eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+[a-z]?)\s*,?\s*$/i,  // "Absatz eins"
    /^Ziffer\s+(eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+)\s*,?\s*$/i,        // "Ziffer eins"
    /^Litera\s+[a-z]\s*,?\s*$/i,                  // "Litera a"
    /^Anmerkung,\s/i,                             // "Anmerkung, Paragraph..."
    /^Text$/i,                                     // Just "Text" by itself (navigation element)
    /^Abschnitt$/i,                                // Just "Abschnitt" by itself
  ]

  // Patterns indicating the line contains expanded notation (duplicates of abbreviated)
  const expandedContentPatterns = [
    /Bundesgesetzblatt\s+(Teil\s+\w+,?\s*)?Nr\.\s+\d+\s+aus\s+\d+/i,  // "Bundesgesetzblatt Nr. 359 aus 1928"
    /Paragraph\s+\d+[a-z]?\s*,\s*Absatz/i,        // "Paragraph 7, Absatz eins"
    /gemäß\s+Paragraph\s+\d+/i,                   // "gemäß Paragraph 7"
    /Paragraphen\s+\d+[a-z]?\s+(bis|und|,)/i,     // "Paragraphen 4 und 5"
    /Absatz\s+(eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+[a-z]?)\s*,?\s*(und|bis|Ziffer)/i, // "Absatz eins, Ziffer"
    /des\s+Paragraph\s+\d+/i,                     // "des Paragraph 7"
    /nach\s+Paragraph\s+\d+/i,                    // "nach Paragraph 14"
    /im\s+Sinne\s+des\s+Paragraph/i,              // "im Sinne des Paragraph"
    /\(Paragraph\s+\d+/i,                         // "(Paragraph 12 c)"
    /Artikel\s+römisch\s+/i,                      // "Artikel römisch VI"
    /Sitzung\s+\d+/i,                             // "Sitzung 1" (wrong expansion of "S. 1")
  ]

  // Function to normalize text for comparison (convert expanded to abbreviated)
  const normalizeToAbbreviated = (line) => {
    return line
      .replace(/Paragraph\s+(\d+[a-z]?)\s*,?/gi, '§ $1')
      .replace(/Paragraphen\s+/gi, '§§ ')
      .replace(/Absatz\s+eins/gi, 'Abs. 1')
      .replace(/Absatz\s+zwei/gi, 'Abs. 2')
      .replace(/Absatz\s+drei/gi, 'Abs. 3')
      .replace(/Absatz\s+vier/gi, 'Abs. 4')
      .replace(/Absatz\s+fünf/gi, 'Abs. 5')
      .replace(/Absatz\s+sechs/gi, 'Abs. 6')
      .replace(/Absatz\s+sieben/gi, 'Abs. 7')
      .replace(/Absatz\s+acht/gi, 'Abs. 8')
      .replace(/Absatz\s+neun/gi, 'Abs. 9')
      .replace(/Absatz\s+zehn/gi, 'Abs. 10')
      .replace(/Absatz\s+(\d+[a-z]?)/gi, 'Abs. $1')
      .replace(/Ziffer\s+eins/gi, 'Z 1')
      .replace(/Ziffer\s+zwei/gi, 'Z 2')
      .replace(/Ziffer\s+drei/gi, 'Z 3')
      .replace(/Ziffer\s+(\d+)/gi, 'Z $1')
      .replace(/Litera\s+([a-z])/gi, 'lit. $1')
      .replace(/Bundesgesetzblatt\s+Teil\s+eins,?\s*Nr\.\s+(\d+)\s+aus\s+(\d+),?/gi, 'BGBl. I Nr. $1/$2')
      .replace(/Bundesgesetzblatt\s+Teil\s+zwei,?\s*Nr\.\s+(\d+)\s+aus\s+(\d+),?/gi, 'BGBl. II Nr. $1/$2')
      .replace(/Bundesgesetzblatt\s+Nr\.\s+(\d+)\s+aus\s+(\d+),?/gi, 'BGBl. Nr. $1/$2')
      .replace(/Sitzung\s+(\d+)/gi, 'S. $1')
      .replace(/römisch\s+([IVX]+)/gi, '$1')
      .toLowerCase()
      .trim()
  }

  // Keep track of recent normalized content to detect duplicates
  const recentContent = []
  const MAX_RECENT = 5

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Keep empty lines (but not multiple in a row)
    if (!line) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('')
      }
      continue
    }

    // Skip standalone expanded notation lines
    if (standaloneExpandedPatterns.some(pattern => pattern.test(line))) {
      continue
    }

    // Check if this line has expanded content patterns
    const hasExpandedContent = expandedContentPatterns.some(pattern => pattern.test(line))

    if (hasExpandedContent) {
      // Normalize this line and check if we've seen similar content recently
      const normalized = normalizeToAbbreviated(line)

      // Check if any recent line has similar normalized content
      const isDuplicate = recentContent.some(recent => {
        // Compare normalized versions - if they're very similar, it's a duplicate
        const similarity = getSimilarity(recent, normalized)
        return similarity > 0.85
      })

      if (isDuplicate) {
        continue // Skip this duplicate expanded line
      }
    }

    // Add the line and track its normalized form
    cleanedLines.push(line)
    const normalizedLine = normalizeToAbbreviated(line)
    recentContent.push(normalizedLine)
    if (recentContent.length > MAX_RECENT) {
      recentContent.shift()
    }
  }

  let result = cleanedLines.join('\n')

  // Also clean inline duplicates where "Paragraph X" appears right after "§ X"
  // e.g., "§ 52a. Paragraph 52 a, Elektronische..." -> "§ 52a. Elektronische..."
  result = result
    .replace(/§\s*(\d+[a-z]?)\.?\s*Paragraph\s+\d+\s*[a-z]?\s*,\s*/gi, '§ $1. ')
    .replace(/§\s*(\d+)\.?\s*Paragraph\s+\d+\s*,\s*/gi, '§ $1. ')
    // Remove duplicate section number patterns like "§ 1. (1)" appearing twice
    .replace(/\n(§\s*\d+[a-z]?\.?\s*)\n\1/gi, '\n$1')

  return result
}

// Simple similarity check between two strings
function getSimilarity(str1, str2) {
  if (!str1 || !str2) return 0
  if (str1 === str2) return 1

  const len1 = str1.length
  const len2 = str2.length
  const maxLen = Math.max(len1, len2)

  if (maxLen === 0) return 1

  // Count matching characters at same positions
  let matches = 0
  const minLen = Math.min(len1, len2)
  for (let i = 0; i < minLen; i++) {
    if (str1[i] === str2[i]) matches++
  }

  return matches / maxLen
}

// Pre-process Austrian law text to fix section format
// Converts multi-line format to single-line format:
// "§ 1.\nParagraph eins,\nGeltungsbereich" -> "§ 1. Geltungsbereich"
function preprocessAustrianText(text) {
  if (!text) return ''

  let result = text

  // Fix table of contents format: "§ X.\nParagraph X,\nTitle" -> "§ X. Title"
  // This handles the multi-line format in the TOC
  result = result.replace(
    /§\s*(\d+[a-z]?)\.?\s*\n\s*Paragraph\s+[\w\s]+,\s*\n\s*([^\n]+)/gi,
    '§ $1. $2'
  )

  // Also handle inline expanded notation: "§ 1. Paragraph eins, Title" -> "§ 1. Title"
  result = result.replace(
    /§\s*(\d+[a-z]?)\.?\s*Paragraph\s+[\w\s]+,\s*/gi,
    '§ $1. '
  )

  // Clean up "Paragraph X," standalone lines that might remain
  result = result.replace(/^\s*Paragraph\s+[\w\s]+,\s*$/gim, '')

  // Clean multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

// Parse law text into sections
function parseLawSections(text) {
  if (!text) return []

  // First pre-process to fix Austrian multi-line format
  let processedText = preprocessAustrianText(text)

  // Then clean duplicate expanded notation
  const cleanedText = cleanDuplicateText(processedText)

  const sectionsMap = new Map() // Use map to deduplicate by section number
  const chapters = [] // Track Abschnitt (chapter) headers

  // First, extract chapter headers (Abschnitt)
  const chapterRegex = /(\d+)\.\s*Abschnitt[:\s]+([^\n]+)/gi
  let chapterMatch
  while ((chapterMatch = chapterRegex.exec(cleanedText)) !== null) {
    chapters.push({
      number: chapterMatch[1],
      title: chapterMatch[2].trim(),
      index: chapterMatch.index
    })
  }

  // Match § sections and Artikel - capture the full header line
  const sectionRegex = /(?:^|\n)(§\s*(\d+[a-z]?)\s*\.?\s*([^\n]*)|(?:Artikel|Art\.?)\s*(\d+[a-z]?)\s*\.?\s*([^\n]*))/gi

  let match
  const matches = []
  while ((match = sectionRegex.exec(cleanedText)) !== null) {
    const isArticle = !!match[4]
    const number = isArticle ? match[4] : match[2]
    let title = (isArticle ? match[5] : match[3])?.trim() || ''
    const prefix = isArticle ? 'Art.' : '§'
    const headerLength = match[0].length

    // Clean title - remove any remaining "Paragraph X," patterns
    title = title.replace(/^Paragraph\s+[\w\s]+,\s*/i, '').trim()

    // Also remove patterns like "(1)" at the start if it's just that
    if (/^\(\d+\)\s*$/.test(title)) {
      title = ''
    }

    matches.push({
      id: `section-${number}`,
      number: `${prefix} ${number}`,
      title: title.substring(0, 80),
      index: match.index,
      headerEnd: match.index + headerLength,
      rawNumber: number
    })
  }

  // Add content to each section, skipping the header line
  for (let i = 0; i < matches.length; i++) {
    const section = matches[i]
    const contentStart = section.headerEnd
    const contentEnd = i < matches.length - 1 ? matches[i + 1].index : cleanedText.length
    let content = cleanedText.substring(contentStart, contentEnd).trim()

    // If title is empty, try to extract it from the first line of content
    if (!section.title && content) {
      const firstLine = content.split('\n')[0].trim()
      // Check if first line looks like a title (short, no punctuation at end except period)
      if (firstLine && firstLine.length < 80 && !/^\(\d+\)/.test(firstLine) && !/^Absatz/.test(firstLine)) {
        section.title = firstLine
        content = content.substring(firstLine.length).trim()
      }
    }

    // Skip duplicate entries (table of contents vs actual content)
    // Keep the one with more content
    const existingSection = sectionsMap.get(section.rawNumber)
    if (existingSection) {
      // Keep the section with more substantial content
      if (content.length > existingSection.content.length) {
        sectionsMap.set(section.rawNumber, { ...section, content })
      }
    } else {
      sectionsMap.set(section.rawNumber, { ...section, content })
    }
  }

  // Build final sections array with chapter headers
  const allSections = []

  // Add Abschnitt headers as special sections
  for (const chapter of chapters) {
    allSections.push({
      id: `chapter-${chapter.number}`,
      number: `${chapter.number}. Abschnitt`,
      title: chapter.title,
      content: '',
      rawNumber: `0.${chapter.number}`, // Sort before actual sections
      isChapter: true,
      index: chapter.index
    })
  }

  // Add regular sections
  allSections.push(...Array.from(sectionsMap.values()))

  // Sort by position in document (index), with chapters coming first in their group
  return allSections.sort((a, b) => {
    // If both have index, sort by index
    if (a.index !== undefined && b.index !== undefined) {
      return a.index - b.index
    }
    // Otherwise sort by raw number
    const numA = parseFloat(a.rawNumber.replace(/[a-z]/gi, '.1')) || 0
    const numB = parseFloat(b.rawNumber.replace(/[a-z]/gi, '.1')) || 0
    return numA - numB
  })
}

// Skip boilerplate and get clean text
function getCleanLawText(text) {
  if (!text) return ''

  // First pre-process Austrian format, then clean duplicates
  const processedText = preprocessAustrianText(text)
  const cleanedText = cleanDuplicateText(processedText)

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
    const match = cleanedText.match(marker)
    if (match && match.index < cleanedText.length * 0.4) {
      startIndex = match.index
      break
    }
  }

  return cleanedText.substring(startIndex)
}

// Format text with proper structure (paragraphs, lists, etc.)
function formatLawText(text) {
  if (!text) return null

  const lines = text.split('\n')
  const elements = []
  let currentParagraph = []
  let inList = false
  let listItems = []

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const content = currentParagraph.join(' ').trim()
      if (content) {
        elements.push({ type: 'paragraph', content })
      }
      currentParagraph = []
    }
  }

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push({ type: 'list', items: [...listItems] })
      listItems = []
      inList = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Empty line - end current paragraph
    if (!line) {
      flushList()
      flushParagraph()
      continue
    }

    // Section headers (§ or Artikel)
    if (/^(§\s*\d+[a-z]?|Art\.?\s*\d+|Artikel\s*\d+)/i.test(line)) {
      flushList()
      flushParagraph()
      elements.push({ type: 'section', content: line })
      continue
    }

    // Numbered list items (1., 2., etc. or a), b), etc.)
    const numberedMatch = line.match(/^(\d+\.|[a-z]\)|[a-z]\.|[ivxIVX]+\.)\s+(.+)/)
    if (numberedMatch) {
      flushParagraph()
      inList = true
      listItems.push(numberedMatch[2])
      continue
    }

    // Bullet-like patterns (-, *, •)
    const bulletMatch = line.match(/^[-*•]\s+(.+)/)
    if (bulletMatch) {
      flushParagraph()
      inList = true
      listItems.push(bulletMatch[1])
      continue
    }

    // Ziffer patterns (Z 1, Z 2, etc.)
    const zifferMatch = line.match(/^Z\s+\d+[.:]\s*(.+)/)
    if (zifferMatch) {
      flushParagraph()
      inList = true
      listItems.push(zifferMatch[1] || line)
      continue
    }

    // Regular text
    if (inList && !line.startsWith(' ')) {
      flushList()
    }
    currentParagraph.push(line)
  }

  flushList()
  flushParagraph()

  return elements
}

// Render formatted elements
function FormattedText({ text }) {
  const elements = formatLawText(text)
  if (!elements || elements.length === 0) {
    return <div className="whitespace-pre-wrap">{text}</div>
  }

  return (
    <div className="space-y-4">
      {elements.map((el, idx) => {
        switch (el.type) {
          case 'section':
            return (
              <h4 key={idx} className="font-semibold text-whs-orange-600 dark:text-whs-orange-400 mt-6 first:mt-0">
                {el.content}
              </h4>
            )
          case 'list':
            return (
              <ul key={idx} className="list-disc list-inside space-y-1 pl-4 text-gray-700 dark:text-gray-300">
                {el.items.map((item, i) => (
                  <li key={i} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            )
          case 'paragraph':
          default:
            return (
              <p key={idx} className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {el.content}
              </p>
            )
        }
      })}
    </div>
  )
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
  const [isLoading, setIsLoading] = useState(false)
  const [prevFramework, setPrevFramework] = useState(framework)

  const contentRef = useRef(null)
  const sectionRefs = useRef({})

  // Handle framework switching with loading state
  useEffect(() => {
    if (framework !== prevFramework) {
      setIsLoading(true)
      setSelectedLaw(null)
      setSelectedCategory('all')
      setSearchTerm('')

      // Small delay to show loading state and allow data to process
      const timer = setTimeout(() => {
        setIsLoading(false)
        setPrevFramework(framework)
      }, 150)

      return () => clearTimeout(timer)
    }
  }, [framework, prevFramework])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCategory, framework])

  // Get all laws and categories
  const allLaws = useMemo(() => getAllLaws(framework), [framework])
  const categories = useMemo(() => getLawCategories(framework), [framework])

  // Filter and search laws with pagination
  const { filteredLaws, pagination } = useMemo(() => {
    if (searchTerm.trim()) {
      // Use paginated search
      const result = searchLaws(searchTerm, {
        country: framework,
        type: selectedCategory !== 'all' ? selectedCategory : null,
        page: currentPage,
        limit: pageSize
      })
      return { filteredLaws: result.results, pagination: result.pagination }
    }

    // Manual filtering for non-search browsing
    let results = allLaws
    if (selectedCategory !== 'all') {
      results = results.filter(law => law.type === selectedCategory)
    }

    // Manual pagination
    const total = results.length
    const totalPages = Math.ceil(total / pageSize)
    const offset = (currentPage - 1) * pageSize
    const paginatedResults = results.slice(offset, offset + pageSize)

    return {
      filteredLaws: paginatedResults,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages,
        hasMore: currentPage < totalPages
      }
    }
  }, [allLaws, searchTerm, selectedCategory, framework, currentPage, pageSize])

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
    // Reset section refs to avoid stale references
    sectionRefs.current = {}
    // Scroll content to top
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
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
              {pagination.total} laws and regulations
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
      <div className="flex gap-4 h-[calc(100%-140px)] relative">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-whs-dark-900/80 z-10 flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-whs-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Loading {framework} laws...
              </span>
            </div>
          </div>
        )}

        {/* Left: Law List */}
        <div className="w-72 flex-shrink-0">
          <Card className="h-full overflow-hidden">
            <div className="p-3 border-b border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Laws & Regulations</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {pagination.total} total
                {pagination.totalPages > 1 && ` (page ${pagination.page}/${pagination.totalPages})`}
              </p>
            </div>
            <div className="overflow-y-auto h-[calc(100%-72px)]">
              {filteredLaws.map((law) => (
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
            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="p-2 border-t border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-200 dark:bg-whs-dark-700 hover:bg-gray-300 dark:hover:bg-whs-dark-600"
                >
                  Prev
                </button>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasMore}
                  className="px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-200 dark:bg-whs-dark-700 hover:bg-gray-300 dark:hover:bg-whs-dark-600"
                >
                  Next
                </button>
              </div>
            )}
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
                      section.isChapter
                        ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold'
                        : ''
                    } ${
                      activeSection === section.id
                        ? 'bg-whs-orange-50 dark:bg-whs-orange-900/20 text-whs-orange-700 dark:text-whs-orange-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-whs-dark-800'
                    }`}
                  >
                    <span className={`font-semibold ${section.isChapter ? 'text-blue-600 dark:text-blue-400' : 'text-whs-orange-500'}`}>
                      {section.number}
                    </span>
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
                              {section.isChapter ? (
                                /* Chapter header (Abschnitt) - styled as a divider */
                                <div className="mt-8 mb-4 py-3 px-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                                  <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                    {section.number}: {section.title}
                                  </h2>
                                </div>
                              ) : (
                                /* Regular section (§) */
                                <>
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
                                  <div className="pl-4 border-l-2 border-gray-100 dark:border-whs-dark-700">
                                    <FormattedText text={section.content} />
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Raw text fallback */
                        <FormattedText text={getCleanLawText(selectedLaw.content?.full_text || selectedLaw.content?.text)} />
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

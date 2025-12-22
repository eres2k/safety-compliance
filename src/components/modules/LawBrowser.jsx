import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Card, CardContent, LawVisualizer, ComplexitySlider, SimplifiedContent, CrossBorderComparison, MultiCountryComparison, PdfViewer, PdfSourceBadge, SupplementaryBadge, TypewriterText, OverwriteText, useRateLimitStatus, SmartSearch, InteractiveSearch } from '../ui'
import { getRateLimitStatus } from '../../services/aiService'
import {
  getAllLawsSync,
  getRelatedLaws,
  getLawCategories,
  initializeLawsDatabase,
  isDatabaseLoaded,
  WHS_TOPIC_LABELS,
  RELEVANCE_LEVELS,
  STRUCTURE_LABELS,
  getStructureLabel,
  DOC_TYPES,
  hasPdfSource,
  getPdfSourceUrl,
  isSupplementarySource,
  hasLocalPdf,
  getLocalPdfUrl,
  isPdfVariant,
  isTrueSupplementarySource,
  hasLocalHtml,
  getLocalHtmlUrl,
  isHtmlOnly,
  isRecentlyUpdatedLaw
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

// Highlight search term in text - returns JSX with highlighted matches
// Adds data-search-match attribute for navigation between matches
function highlightText(text, searchTerm) {
  if (!text || !searchTerm || searchTerm.trim().length === 0) {
    return text
  }

  const term = searchTerm.trim()
  // Escape special regex characters
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedTerm})`, 'gi')
  const parts = text.split(regex)

  if (parts.length === 1) {
    return text
  }

  return parts.map((part, index) => {
    if (part.toLowerCase() === term.toLowerCase()) {
      return (
        <mark
          key={index}
          data-search-match="true"
          className="bg-yellow-300 dark:bg-yellow-500/50 text-gray-900 dark:text-white px-0.5 rounded transition-all"
        >
          {part}
        </mark>
      )
    }
    return part
  })
}

// Apply WHS crosslinks to text - makes WHS terms clickable
// This function is applied within the component to have access to crosslink data and handlers
function createCrosslinkHighlighter(crosslinks, onCrosslinkClick) {
  if (!crosslinks || Object.keys(crosslinks).length === 0) {
    return (text) => text
  }

  // Sort terms by length (longest first) to match longer terms first
  const sortedTerms = Object.keys(crosslinks).sort((a, b) => b.length - a.length)

  // Create regex pattern that matches whole words only
  const escapedTerms = sortedTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi')

  return function applyCrosslinks(text) {
    if (!text || typeof text !== 'string') return text

    const parts = text.split(pattern)
    if (parts.length === 1) return text

    return parts.map((part, index) => {
      // Check if this part matches any crosslink term (case-insensitive)
      const matchedTerm = sortedTerms.find(term =>
        term.toLowerCase() === part.toLowerCase()
      )

      if (matchedTerm) {
        const data = crosslinks[matchedTerm]
        return (
          <button
            key={index}
            onClick={(e) => onCrosslinkClick(e, matchedTerm, data)}
            className="text-whs-orange-600 dark:text-whs-orange-400 hover:underline cursor-pointer font-medium inline"
            title={`${data.title}: ${data.summary?.substring(0, 100)}...`}
          >
            {part}
          </button>
        )
      }
      return part
    })
  }
}

// German ordinal words to numbers mapping
const germanOrdinals = {
  'erster': '1', 'erste': '1', 'ersten': '1',
  'zweiter': '2', 'zweite': '2', 'zweiten': '2',
  'dritter': '3', 'dritte': '3', 'dritten': '3',
  'vierter': '4', 'vierte': '4', 'vierten': '4',
  'fünfter': '5', 'fünfte': '5', 'fünften': '5',
  'sechster': '6', 'sechste': '6', 'sechsten': '6',
  'siebter': '7', 'siebte': '7', 'siebten': '7', 'siebenter': '7',
  'achter': '8', 'achte': '8', 'achten': '8',
  'neunter': '9', 'neunte': '9', 'neunten': '9',
  'zehnter': '10', 'zehnte': '10', 'zehnten': '10',
  'elfter': '11', 'elfte': '11', 'elften': '11',
  'zwölfter': '12', 'zwölfte': '12', 'zwölften': '12'
}

// Convert German ordinal word to number
function ordinalToNumber(word) {
  return germanOrdinals[word.toLowerCase()] || word
}

// Parse law text into sections with Abschnitt groupings (AT/DE) or Artikel format (NL)
function parseLawSections(text, framework = 'AT') {
  if (!text) return []

  // First clean duplicate expanded notation
  const cleanedText = cleanDuplicateText(text)

  // Detect if this is Dutch/NL law (uses Artikel format)
  const isArtikelFormat = /Artikel\s+\d+\./i.test(cleanedText)

  const sectionsMap = new Map()

  if (isArtikelFormat) {
    // Parse Dutch "Artikel X. Title" or "Artikel X.Y. Title" format
    // Detect if this is "Artikel X.Y" format (with Hoofdstuk grouping)
    const hasHoofdstukFormat = /Artikel\s+\d+\.\d+/i.test(cleanedText)

    // Parse Hoofdstuk titles if present
    const hoofdstukTitles = new Map()
    if (hasHoofdstukFormat) {
      const hoofdstukPattern = /Hoofdstuk\s+(\d+)[\.\s:]+([^\n]*)/gi
      let hMatch
      while ((hMatch = hoofdstukPattern.exec(cleanedText)) !== null) {
        const num = hMatch[1]
        let title = hMatch[2].trim()
        // Clean up title - remove "Artikel" references
        title = title.replace(/\s*Artikel\s+\d+.*$/i, '').trim()
        if (title && !hoofdstukTitles.has(num)) {
          hoofdstukTitles.set(num, title)
        }
      }
    }

    // Match both formats: "Artikel X." and "Artikel X.Y."
    const artikelRegex = hasHoofdstukFormat
      ? /Artikel\s+(\d+)\.(\d+[a-z]?)\.?\s*([^\n]*)/gi
      : /Artikel\s+(\d+[a-z]?)\.\s*([^\n]+)/gi

    let match
    const matches = []

    while ((match = artikelRegex.exec(cleanedText)) !== null) {
      if (hasHoofdstukFormat) {
        // "Artikel X.Y. Title" format
        const hoofdstukNum = match[1]
        const artikelSub = match[2]
        const fullNumber = `${hoofdstukNum}.${artikelSub}`
        const title = (match[3] || '').trim()
        matches.push({
          id: `artikel-${fullNumber}`,
          number: `Artikel ${fullNumber}`,
          title: title,
          index: match.index,
          headerEnd: match.index + match[0].length,
          rawNumber: fullNumber,
          hoofdstukNum: hoofdstukNum
        })
      } else {
        // Simple "Artikel X. Title" format
        const number = match[1]
        const title = match[2].trim()
        matches.push({
          id: `artikel-${number}`,
          number: `Artikel ${number}`,
          title: title,
          index: match.index,
          headerEnd: match.index + match[0].length,
          rawNumber: number
        })
      }
    }

    // Add content to each section - keep the one with most content
    for (let i = 0; i < matches.length; i++) {
      const section = matches[i]
      const contentEnd = i < matches.length - 1 ? matches[i + 1].index : cleanedText.length
      let content = cleanedText.substring(section.headerEnd, contentEnd).trim()

      // Build abschnitt (Hoofdstuk) info for grouped format
      let hoofdstukInfo = null
      if (hasHoofdstukFormat && section.hoofdstukNum) {
        hoofdstukInfo = {
          number: section.hoofdstukNum,
          title: hoofdstukTitles.get(section.hoofdstukNum) || '',
          displayName: `Hoofdstuk ${section.hoofdstukNum}`
        }
      }

      const existingSection = sectionsMap.get(section.rawNumber)
      if (existingSection) {
        if (content.length > existingSection.content.length) {
          sectionsMap.set(section.rawNumber, { ...section, content, abschnitt: hoofdstukInfo })
        }
      } else if (content.length > 5) {
        sectionsMap.set(section.rawNumber, { ...section, content, abschnitt: hoofdstukInfo })
      }
    }
  } else {
    // Parse Austrian/German "§ X" format with Abschnitt groupings
    // Strategy: Parse the TOC to determine which § belongs to which Abschnitt

    // Detect format:
    // - Austrian: "1. Abschnitt", "2. Abschnitt"
    // - German: "Erster Abschnitt", "Zweiter Abschnitt"
    const ordinalPattern = Object.keys(germanOrdinals).join('|')
    const hasGermanOrdinals = new RegExp(`(${ordinalPattern})\\s+Abschnitt`, 'i').test(cleanedText)

    // Step 1: Find the TOC section and parse Abschnitt -> § mappings
    const tocMatch = cleanedText.match(/INHALTSVERZEICHNIS|Inhaltsverzeichnis|INHALT/i)
    const tocStart = tocMatch ? tocMatch.index : 0

    // Find where actual content starts (after TOC, where § 1 has actual content)
    const contentStartMatch = cleanedText.match(/§\s*1\.?\s+[A-ZÄÖÜ][a-zäöüß]+[^\n]*\n/i)
    const contentStart = contentStartMatch ? contentStartMatch.index : cleanedText.length * 0.3

    // Extract TOC portion
    const tocContent = cleanedText.substring(tocStart, contentStart)

    // Parse Abschnitt headers from TOC
    const abschnittPositions = []

    if (hasGermanOrdinals) {
      // German format: "Erster Abschnitt", "Zweiter Abschnitt", etc.
      const germanAbschnittRegex = new RegExp(`(${ordinalPattern})\\s+Abschnitt[:\\s]*([^\\n]*)`, 'gi')
      let abMatch
      while ((abMatch = germanAbschnittRegex.exec(tocContent)) !== null) {
        const ordinalWord = abMatch[1]
        const number = ordinalToNumber(ordinalWord)
        abschnittPositions.push({
          number: number,
          title: abMatch[2].trim(),
          tocIndex: abMatch.index,
          displayName: `${abMatch[1]} Abschnitt`,
          firstParagraph: null,
          lastParagraph: null
        })
      }
    } else {
      // Austrian format: "1. Abschnitt", "2. Abschnitt", etc.
      const abschnittTocRegex = /(\d+)\.\s*Abschnitt[:\s]*([^\n]*)/gi
      let abMatch
      while ((abMatch = abschnittTocRegex.exec(tocContent)) !== null) {
        abschnittPositions.push({
          number: abMatch[1],
          title: abMatch[2].trim(),
          tocIndex: abMatch.index,
          displayName: `${abMatch[1]}. Abschnitt`,
          firstParagraph: null,
          lastParagraph: null
        })
      }
    }

    // Sort by number to ensure correct order
    abschnittPositions.sort((a, b) => parseInt(a.number) - parseInt(b.number))

    // For each Abschnitt, find the § numbers that appear after it in the TOC
    for (let i = 0; i < abschnittPositions.length; i++) {
      const ab = abschnittPositions[i]
      const nextAbStart = i < abschnittPositions.length - 1
        ? abschnittPositions[i + 1].tocIndex
        : tocContent.length

      // Extract the TOC portion for this Abschnitt
      const abschnittTocSection = tocContent.substring(ab.tocIndex, nextAbStart)

      // Find all § numbers in this section
      const paragraphMatches = [...abschnittTocSection.matchAll(/§\s*(\d+[a-z]?)\.?/gi)]
      if (paragraphMatches.length > 0) {
        ab.firstParagraph = paragraphMatches[0][1]
        ab.lastParagraph = paragraphMatches[paragraphMatches.length - 1][1]
      }
    }

    // Build a lookup: paragraph number -> Abschnitt
    const paragraphToAbschnitt = new Map()
    for (const ab of abschnittPositions) {
      if (ab.firstParagraph && ab.lastParagraph) {
        const first = parseInt(ab.firstParagraph.replace(/[a-z]/gi, ''))
        const last = parseInt(ab.lastParagraph.replace(/[a-z]/gi, ''))
        for (let p = first; p <= last; p++) {
          paragraphToAbschnitt.set(p, ab)
        }
        // Also handle letter variants like 52a, 77a, etc.
        const abIndex = abschnittPositions.indexOf(ab)
        const nextAbIndex = abschnittPositions[abIndex + 1]?.tocIndex || tocContent.length
        const letterVariants = [...tocContent.substring(ab.tocIndex, nextAbIndex)
          .matchAll(/§\s*(\d+)([a-z])\.?/gi)]
        for (const variant of letterVariants) {
          paragraphToAbschnitt.set(`${variant[1]}${variant[2]}`, ab)
        }
      }
    }

    // Step 2: Parse actual content - find all § sections with their content
    const mainContent = cleanedText.substring(contentStart)
    const sectionRegex = /(?:^|\n)\s*§\s*(\d+[a-z]?)\s*\.?\s*([^\n]*)/gi
    let match
    const matches = []

    while ((match = sectionRegex.exec(mainContent)) !== null) {
      const number = match[1]
      let title = (match[2] || '').trim()

      // Clean up title - remove Abschnitt references and content markers
      title = title.replace(/^\d+\.\s*Abschnitt[:\s]*/i, '').trim()
      title = title.replace(new RegExp(`^(${ordinalPattern})\\s+Abschnitt[:\\s]*`, 'i'), '').trim()
      title = title.replace(/^\(1\).*$/i, '').trim()

      matches.push({
        id: `section-${number}`,
        number: `§ ${number}`,
        title: title.substring(0, 100),
        index: match.index,
        headerEnd: match.index + match[0].length,
        rawNumber: number,
        rawNumeric: parseInt(number.replace(/[a-z]/gi, ''))
      })
    }

    // Step 3: Assign content and Abschnitt to each section
    for (let i = 0; i < matches.length; i++) {
      const section = matches[i]
      const contentEnd = i < matches.length - 1 ? matches[i + 1].index : mainContent.length
      let content = mainContent.substring(section.headerEnd, contentEnd).trim()

      // Clean content - remove Abschnitt headers from content (both formats)
      content = content.replace(/^\s*\d+\.\s*Abschnitt[^\n]*\n*/gi, '').trim()
      content = content.replace(new RegExp(`^\\s*(${ordinalPattern})\\s+Abschnitt[^\\n]*\\n*`, 'gi'), '').trim()

      // Find Abschnitt based on paragraph number (from TOC mapping)
      let assignedAbschnitt = paragraphToAbschnitt.get(section.rawNumeric)
      // Also try with letter variant
      if (!assignedAbschnitt && /[a-z]/i.test(section.rawNumber)) {
        assignedAbschnitt = paragraphToAbschnitt.get(section.rawNumber.toLowerCase())
      }

      // Keep the section with more content when deduplicating
      const existingSection = sectionsMap.get(section.rawNumber)
      if (existingSection) {
        if (content.length > existingSection.content.length) {
          sectionsMap.set(section.rawNumber, { ...section, content, abschnitt: assignedAbschnitt })
        }
      } else if (content.length > 10) {
        sectionsMap.set(section.rawNumber, { ...section, content, abschnitt: assignedAbschnitt })
      }
    }
  }

  // Convert map to array and sort by section number
  return Array.from(sectionsMap.values()).sort((a, b) => {
    const numA = parseFloat(a.rawNumber.replace(/[a-z]/gi, '.1')) || 0
    const numB = parseFloat(b.rawNumber.replace(/[a-z]/gi, '.1')) || 0
    return numA - numB
  })
}

// Skip boilerplate and get clean text
function getCleanLawText(text) {
  if (!text) return ''

  // First apply duplicate text cleaning
  const cleanedText = cleanDuplicateText(text)

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

// Preprocess text to split inline Absätze onto separate lines
// Handles Austrian/German legal text where (1), (2), (3) may be on the same line
function preprocessLawText(text) {
  if (!text) return text

  let processed = text
    // Split inline Absätze: "(1) text (2) text" -> "(1) text\n(2) text"
    .replace(/\s+\((\d+[a-z]?)\)\s+/g, '\n($1) ')
    // Normalize Austrian numbered lists: "1 . Item" or "1. Item" within text
    .replace(/(\s)(\d+)\s*\.\s+([A-ZÄÖÜ])/g, '$1\n$2. $3')
    // Split on semicolon followed by letter for definitions (common in NL/AT)
    .replace(/;\s*([a-z])\.\s+/gi, ';\n$1. ')
    // Ensure section headers are on their own line
    .replace(/([.;:])\s*(§\s*\d+)/g, '$1\n$2')

  return processed
}

// Format text with proper structure (paragraphs, lists, etc.)
// Handles German legal formatting where numbered items (1., 2.) belong to their parent Absatz
function formatLawText(text) {
  if (!text) return null

  // Preprocess to handle inline formatting issues
  const preprocessed = preprocessLawText(text)
  const lines = preprocessed.split('\n')
  const elements = []
  let currentParagraph = []
  let inList = false
  let listItems = []
  let currentAbsatz = null // Track current Absatz for attaching sub-items

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
      // If we have a current Absatz, attach list items to it
      if (currentAbsatz && elements.length > 0 && elements[elements.length - 1] === currentAbsatz) {
        currentAbsatz.subItems = [...currentAbsatz.subItems, ...listItems]
      } else {
        elements.push({ type: 'list', items: [...listItems] })
      }
      listItems = []
      inList = false
    }
  }

  const flushAbsatz = () => {
    if (currentAbsatz) {
      flushList()
      currentAbsatz = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Empty line - end current paragraph/list but preserve Absatz context for following items
    if (!line) {
      flushList()
      flushParagraph()
      // Check if next non-empty line is a numbered item that belongs to current Absatz
      let nextNonEmpty = i + 1
      while (nextNonEmpty < lines.length && !lines[nextNonEmpty].trim()) nextNonEmpty++
      if (nextNonEmpty < lines.length) {
        const nextLine = lines[nextNonEmpty].trim()
        // If next line is NOT a numbered item (1., 2., a), etc.), end Absatz context
        if (!nextLine.match(/^(\d+\.|[a-z]\)|[a-z]\.|[ivxIVX]+\.)\s+/)) {
          flushAbsatz()
        }
      }
      continue
    }

    // Skip standalone "§" or "Artikel" without numbers (redundant artifacts)
    if (/^§\s*$/i.test(line) || /^Artikel\s*$/i.test(line)) {
      continue
    }

    // Section headers (§ or Artikel with number)
    if (/^(§\s*\d+[a-z]?|Art\.?\s*\d+|Artikel\s*\d+)/i.test(line)) {
      flushAbsatz()
      flushList()
      flushParagraph()
      elements.push({ type: 'section', content: line })
      continue
    }

    // Paragraph numbers like (1), (2), (3) - German Absätze
    // These are distinct paragraphs within a section and should be highlighted
    const absatzMatch = line.match(/^\((\d+[a-z]?)\)\s*(.*)/)
    if (absatzMatch) {
      flushAbsatz()
      flushList()
      flushParagraph()
      currentAbsatz = { type: 'absatz', number: absatzMatch[1], content: absatzMatch[2] || '', subItems: [] }
      elements.push(currentAbsatz)
      continue
    }

    // Dutch lid numbers: bare number followed by space and text starting with capital letter
    // e.g., "1 Bij of krachtens algemene maatregel..." or "2 De in het eerste lid..."
    // Must not match numbered lists like "1. Item" or "1 a. Item"
    const dutchLidMatch = line.match(/^(\d+)\s+([A-ZÄÖÜÀ-ÿ].*)/)
    if (dutchLidMatch && !line.match(/^\d+\s+[a-z][\.\)]/)) {
      flushAbsatz()
      flushList()
      flushParagraph()
      currentAbsatz = { type: 'absatz', number: dutchLidMatch[1], content: dutchLidMatch[2] || '', subItems: [] }
      elements.push(currentAbsatz)
      continue
    }

    // Dutch definition with colon: "term: definition;" - treat as a definition item
    const definitionMatch = line.match(/^([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s\-]+):\s*(.+)/)
    if (definitionMatch && !line.startsWith('http') && line.length < 500) {
      flushParagraph()
      inList = true
      listItems.push({ marker: '•', content: `**${definitionMatch[1]}:** ${definitionMatch[2]}` })
      continue
    }

    // Numbered list items (1., 2., etc. or a), b), etc. or a., b., etc.)
    // Also matches Austrian "1 ." format and numeric lists within sections
    const numberedMatch = line.match(/^(\d+\s*\.|[a-z]\)|[a-z]\.|[ivxIVX]+\.)\s+(.+)/)
    if (numberedMatch && !line.match(/^\d+\.\s*(Abschnitt|Artikel|Hoofdstuk)/i)) {
      // Check if this is actually a subsection indicator (should be absatz) vs a list item
      // If it starts with a number/letter and we're not in an Absatz context, treat as absatz
      const isNumericList = /^\d+\s*\./.test(numberedMatch[1])
      const isLetteredList = /^[a-z]\./.test(numberedMatch[1])

      if ((isNumericList || isLetteredList) && !currentAbsatz) {
        // Check if the previous element is an absatz ending with ":" - these introduce lists
        // e.g., "(2) Beschäftigte im Sinne dieses Gesetzes sind:" followed by "1. ..., 2. ..."
        const lastElement = elements[elements.length - 1]
        if (lastElement?.type === 'absatz' && lastElement.content?.trim().endsWith(':')) {
          // Restore absatz context - numbered items belong to the previous absatz as subItems
          currentAbsatz = lastElement
        } else {
          // This is a numbered or lettered paragraph - treat as absatz
          flushAbsatz()
          flushList()
          flushParagraph()
          const num = numberedMatch[1].replace(/\s*\.\s*$/, '')
          currentAbsatz = { type: 'absatz', number: num, content: numberedMatch[2] || '', subItems: [] }
          elements.push(currentAbsatz)
          continue
        }
      }
      // Treat as list item (when inside an existing absatz)
      flushParagraph()
      inList = true
      listItems.push({ marker: numberedMatch[1].trim(), content: numberedMatch[2] })
      continue
    }

    // Bullet-like patterns (-, *, •)
    const bulletMatch = line.match(/^[-*•]\s+(.+)/)
    if (bulletMatch) {
      flushParagraph()
      inList = true
      listItems.push({ marker: '•', content: bulletMatch[1] })
      continue
    }

    // Ziffer patterns (Z 1, Z 2, etc.)
    const zifferMatch = line.match(/^(Z\s+\d+)[.:]\s*(.+)/)
    if (zifferMatch) {
      flushParagraph()
      inList = true
      listItems.push({ marker: zifferMatch[1], content: zifferMatch[2] || line })
      continue
    }

    // Regular text - if we're in an Absatz and have accumulated text, append to content
    if (currentAbsatz && !inList && currentParagraph.length === 0) {
      // Continuation of Absatz content
      currentAbsatz.content += (currentAbsatz.content ? ' ' : '') + line
      continue
    }

    // Regular text
    if (inList && !line.startsWith(' ')) {
      flushList()
    }
    currentParagraph.push(line)
  }

  flushAbsatz()
  flushList()
  flushParagraph()

  return elements
}

// Patterns for detecting law references that should be deep-linked
const LAW_REFERENCE_PATTERNS = [
  // German/Austrian patterns: § 1, § 1 ASchG, § 1 Abs. 2, § 1 Abs. 2 Z 3, etc.
  /§\s*(\d+[a-z]?)\s*(?:Abs\.?\s*(\d+))?\s*(?:Z\.?\s*(\d+))?\s*(?:(ASchG|AZG|ARG|MSchG|KJBG|AStV|DOK-VO|AM-VO|ESV|PSA-V|BauV|ArbSchG|ASiG|ArbZG|MuSchG|JArbSchG|ArbStättV|BetrSichV|GefStoffV))?/gi,
  // Dutch patterns: Artikel 3, Art. 3 Arbowet, etc.
  /(?:Artikel|Art\.?)\s*(\d+[a-z]?)\s*(?:lid\s*(\d+))?\s*(?:(Arbowet|Arbobesluit|Arboregeling|BRZO))?/gi,
  // DGUV/TRBS/TRGS/ASR patterns
  /(?:DGUV|TRBS|TRGS|ASR)\s*([\w\-\.]+)/gi
]

// Create law reference highlighter for deep-linking to laws
// Accepts callbacks: { onClick, onHover, onLeave } for click and hover functionality
function createLawReferenceHighlighter(callbacks) {
  // Support both old (single function) and new (object with callbacks) API
  const onLawClick = typeof callbacks === 'function' ? callbacks : callbacks?.onClick
  const onLawHover = typeof callbacks === 'object' ? callbacks?.onHover : null
  const onLawLeave = typeof callbacks === 'object' ? callbacks?.onLeave : null

  return function applyLawLinks(text) {
    if (!text || typeof text !== 'string') return text

    // Combined pattern for all law references
    const combinedPattern = /(?:§\s*\d+[a-z]?(?:\s*Abs\.?\s*\d+)?(?:\s*Z\.?\s*\d+)?(?:\s*(?:ASchG|AZG|ARG|MSchG|KJBG|AStV|DOK-VO|AM-VO|ESV|PSA-V|BauV|ArbSchG|ASiG|ArbZG|MuSchG|JArbSchG|ArbStättV|BetrSichV|GefStoffV))?|(?:Artikel|Art\.?)\s*\d+[a-z]?(?:\s*lid\s*\d+)?(?:\s*(?:Arbowet|Arbobesluit|Arboregeling|BRZO))?|(?:DGUV|TRBS|TRGS|ASR)\s*[\w\-\.]+)/gi

    const parts = []
    let lastIndex = 0
    let match

    while ((match = combinedPattern.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }

      // Parse the matched reference
      const ref = match[0]
      const lawInfo = parseLawReference(ref)

      if (lawInfo && onLawClick) {
        parts.push(
          <button
            key={match.index}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onLawClick(lawInfo)
            }}
            onMouseEnter={onLawHover ? (e) => onLawHover(e, lawInfo) : undefined}
            onMouseLeave={onLawLeave || undefined}
            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium inline bg-blue-50 dark:bg-blue-900/20 px-1 rounded"
            title={`Navigate to ${ref}`}
          >
            {ref}
          </button>
        )
      } else {
        parts.push(ref)
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length > 1 ? parts : text
  }
}

// Parse law reference to extract law abbreviation and section
function parseLawReference(ref) {
  if (!ref) return null

  // German/Austrian patterns
  const germanMatch = ref.match(/§\s*(\d+[a-z]?)(?:\s*Abs\.?\s*(\d+))?(?:\s*Z\.?\s*(\d+))?\s*(?:(ASchG|AZG|ARG|MSchG|KJBG|AStV|DOK-VO|AM-VO|ESV|PSA-V|BauV|ArbSchG|ASiG|ArbZG|MuSchG|JArbSchG|ArbStättV|BetrSichV|GefStoffV))?/i)
  if (germanMatch) {
    return {
      type: 'section',
      section: germanMatch[1],
      subsection: germanMatch[2] || null,
      point: germanMatch[3] || null,
      law: germanMatch[4] || null,
      country: germanMatch[4] && ['ASchG', 'AZG', 'ARG', 'MSchG', 'KJBG', 'AStV', 'DOK-VO', 'AM-VO', 'ESV', 'PSA-V', 'BauV'].includes(germanMatch[4]) ? 'AT' : 'DE',
      raw: ref
    }
  }

  // Dutch patterns
  const dutchMatch = ref.match(/(?:Artikel|Art\.?)\s*(\d+[a-z]?)(?:\s*lid\s*(\d+))?\s*(?:(Arbowet|Arbobesluit|Arboregeling|BRZO))?/i)
  if (dutchMatch) {
    return {
      type: 'article',
      section: dutchMatch[1],
      subsection: dutchMatch[2] || null,
      law: dutchMatch[3] || null,
      country: 'NL',
      raw: ref
    }
  }

  // DGUV/TRBS/TRGS/ASR patterns
  const technicalMatch = ref.match(/(DGUV|TRBS|TRGS|ASR)\s*([\w\-\.]+)/i)
  if (technicalMatch) {
    return {
      type: 'technical',
      lawType: technicalMatch[1].toUpperCase(),
      number: technicalMatch[2],
      country: 'DE',
      raw: ref
    }
  }

  return null
}

// Render formatted elements with optional search term highlighting and WHS crosslinks
function FormattedText({ text, searchTerm = '', crosslinks = {}, onCrosslinkClick = null, onLawReferenceClick = null, onLawReferenceHover = null, onLawReferenceLeave = null }) {
  const elements = formatLawText(text)

  // Create crosslink highlighter if crosslinks are available
  const applyCrosslinks = useMemo(() => {
    if (!crosslinks || Object.keys(crosslinks).length === 0 || !onCrosslinkClick) {
      return (t) => t
    }
    return createCrosslinkHighlighter(crosslinks, onCrosslinkClick)
  }, [crosslinks, onCrosslinkClick])

  // Create law reference highlighter with click and hover handlers
  const applyLawLinks = useMemo(() => {
    if (!onLawReferenceClick) return (t) => t
    return createLawReferenceHighlighter({
      onClick: onLawReferenceClick,
      onHover: onLawReferenceHover,
      onLeave: onLawReferenceLeave
    })
  }, [onLawReferenceClick, onLawReferenceHover, onLawReferenceLeave])

  // Combined function that applies law links, crosslinks, and search highlighting
  const processText = useCallback((t) => {
    if (!t) return t

    // Helper to process a single text part
    const processTextPart = (text) => {
      if (typeof text !== 'string') return text

      // First apply law links (returns array or string)
      const withLawLinks = applyLawLinks(text)

      // Then apply crosslinks to each string part
      if (Array.isArray(withLawLinks)) {
        return withLawLinks.map((part, i) => {
          if (typeof part === 'string') {
            const withCrosslinks = applyCrosslinks(part)
            if (Array.isArray(withCrosslinks)) {
              return withCrosslinks.map((cpart, j) => {
                if (typeof cpart === 'string') {
                  return <span key={`${i}-${j}`}>{highlightText(cpart, searchTerm)}</span>
                }
                return cpart
              })
            }
            return <span key={i}>{highlightText(withCrosslinks, searchTerm)}</span>
          }
          return part // Keep JSX elements (law link buttons)
        })
      }

      // No law links found, apply crosslinks
      const withCrosslinks = applyCrosslinks(withLawLinks)
      if (Array.isArray(withCrosslinks)) {
        return withCrosslinks.map((part, i) => {
          if (typeof part === 'string') {
            return <span key={i}>{highlightText(part, searchTerm)}</span>
          }
          return part // Keep JSX elements (crosslink buttons)
        })
      }
      return highlightText(withCrosslinks, searchTerm)
    }

    return processTextPart(t)
  }, [applyLawLinks, applyCrosslinks, searchTerm])

  if (!elements || elements.length === 0) {
    return <div className="whitespace-pre-wrap">{processText(text)}</div>
  }

  // Helper to render list items (handles both string and {marker, content} formats)
  // Fixed: Use list-none when items have markers to avoid double numbering (1. a., 2. b., etc.)
  const renderListItems = (items, isSubList = false) => {
    // Check if any items have markers - if so, don't use CSS list-decimal
    const hasMarkers = items.some(item => typeof item === 'object' && item.marker)

    return (
      <ul className={`space-y-1.5 ${isSubList ? 'mt-2 ml-4 border-l-2 border-gray-300 dark:border-gray-600 pl-3' : 'pl-4'} ${hasMarkers ? 'list-none' : 'list-decimal list-inside'} text-sm text-gray-700 dark:text-gray-300`}>
        {items.map((item, i) => {
          const content = typeof item === 'string' ? item : item.content
          const marker = typeof item === 'object' ? item.marker : null
          return (
            <li key={i} className="leading-relaxed">
              {marker && (
                <span className="inline-block min-w-[2rem] font-medium text-gray-600 dark:text-gray-400 mr-1">
                  {marker}
                </span>
              )}
              <span>{processText(content)}</span>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="space-y-3">
      {elements.map((el, idx) => {
        switch (el.type) {
          case 'section':
            return (
              <h4 key={idx} className="text-base font-semibold text-whs-orange-600 dark:text-whs-orange-400 mt-5 first:mt-0">
                {processText(el.content)}
              </h4>
            )
          case 'absatz':
            // German paragraph (Absatz) with number like (1), (2) - styled with border for visibility
            // Now supports subItems (numbered points that belong to the Absatz)
            return (
              <div key={idx} className="border-l-3 border-whs-orange-400 dark:border-whs-orange-600 pl-4 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-r my-2">
                <div className="flex items-start gap-2">
                  <span className="inline-block bg-whs-orange-100 dark:bg-whs-orange-900/40 text-whs-orange-700 dark:text-whs-orange-300 px-2 py-0.5 rounded text-sm font-semibold flex-shrink-0">
                    ({el.number})
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {processText(el.content)}
                  </span>
                </div>
                {/* Render sub-items (numbered points belonging to this Absatz) */}
                {el.subItems && el.subItems.length > 0 && renderListItems(el.subItems, true)}
              </div>
            )
          case 'list':
            return (
              <div key={idx}>
                {renderListItems(el.items)}
              </div>
            )
          case 'paragraph':
          default:
            return (
              <p key={idx} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {processText(el.content)}
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
  merkblatt: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  guideline: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  dguv_regulation: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  dguv_rule: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  dguv_information: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
}

// WHS Relevance Badge component
function RelevanceBadge({ level }) {
  const config = RELEVANCE_LEVELS[level] || RELEVANCE_LEVELS.low
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  )
}

// WHS Topic Tag component
function TopicTag({ topicId, small = false }) {
  const topic = WHS_TOPIC_LABELS[topicId]
  if (!topic) return null

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ${small ? 'text-xs' : 'text-sm'}`}>
      <span>{topic.icon}</span>
      <span>{topic.label}</span>
    </span>
  )
}

// WHS Summary Panel component
function WHSSummaryPanel({ summary }) {
  if (!summary) return null

  const { total_sections, logistics_relevance_distribution, top_whs_topics, critical_sections_count } = summary

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 mb-6">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <span>📊</span>
        <span>WHS Analysis Summary</span>
      </h4>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{total_sections}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Sections</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{critical_sections_count}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">High Priority</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {logistics_relevance_distribution?.critical || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Critical for Logistics</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {logistics_relevance_distribution?.high || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">High Relevance</div>
        </div>
      </div>

      {/* Top Topics */}
      {top_whs_topics && top_whs_topics.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Top WHS Topics:</div>
          <div className="flex flex-wrap gap-2">
            {top_whs_topics.slice(0, 6).map(([topicId, count]) => (
              <span key={topicId} className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded-lg text-sm">
                <span>{WHS_TOPIC_LABELS[topicId]?.icon || '📌'}</span>
                <span className="text-gray-700 dark:text-gray-300">{WHS_TOPIC_LABELS[topicId]?.label || topicId}</span>
                <span className="text-xs text-gray-500">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to shorten law titles for display
// e.g., "DGUV & Arbeitsschutzgesetz (ArbSchG)" -> "DGUV"
// e.g., "ASchG - ArbeitnehmerInnenschutzgesetz" -> "ASchG"
function getShortenedLawName(law) {
  if (!law) return ''

  // Use abbreviation if available
  const abbr = law.abbreviation || law.abbr
  if (abbr) return abbr

  // Extract short name from title
  const title = law.title || law.name || ''

  // Common patterns for German/Austrian law names
  // DGUV & Arbeitsschutzgesetz (ArbSchG) -> DGUV
  if (title.includes('DGUV')) return 'DGUV'

  // ASchG - ArbeitnehmerInnenschutzgesetz -> ASchG
  const dashMatch = title.match(/^([A-Z][A-Za-z-]+)\s*-/)
  if (dashMatch) return dashMatch[1]

  // Look for abbreviation in parentheses like (ArbSchG)
  const parenMatch = title.match(/\(([A-Z][A-Za-z]+)\)/)
  if (parenMatch) return parenMatch[1]

  // Arbowet - Arbeidsomstandighedenwet -> Arbowet
  const firstWord = title.split(/\s*[-–]\s*/)[0].trim()
  if (firstWord.length <= 15) return firstWord

  // Fallback: return first part up to 15 chars
  return title.substring(0, 15) + (title.length > 15 ? '...' : '')
}

export function LawBrowser({ onBack, initialLawId, initialCountry, initialSection, initialSearchQuery, onNavigationConsumed, onLawChange }) {
  const { t, framework, setFramework, language, isBookmarked, toggleBookmark, addRecentSearch } = useApp()
  const { generateFlowchart, simplifyForBothLevels, findEquivalentLaw, compareMultipleCountries, translateLawText, isLoading: aiLoading } = useAI()

  // Rate limit status for disabling AI buttons
  const [rateLimitInfo, setRateLimitInfo] = useState({ isLimited: false, remainingSeconds: 0 })

  // Update rate limit status periodically
  useEffect(() => {
    const updateRateLimit = () => {
      const status = getRateLimitStatus()
      setRateLimitInfo(status)
    }

    updateRateLimit()
    const interval = setInterval(updateRateLimit, 1000)
    return () => clearInterval(interval)
  }, [])

  // Debounce refs to prevent duplicate API calls
  const pendingSimplifyRef = useRef({}) // Track pending simplification requests by sectionId

  const [searchTerm, setSearchTerm] = useState(initialSearchQuery || '')
  const [selectedLaw, setSelectedLaw] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [activeSection, setActiveSection] = useState(null)
  const [searchInLaw, setSearchInLaw] = useState('') // Section number/title filter
  const [contentSearchTerm, setContentSearchTerm] = useState('') // Full text content search
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0) // Current match navigation index
  const [totalMatchCount, setTotalMatchCount] = useState(0) // Total matches found
  const [relevanceFilter, setRelevanceFilter] = useState('all') // all, critical, high, medium, low
  const [isLoading, setIsLoading] = useState(false)
  const [prevFramework, setPrevFramework] = useState(framework)
  const [prevLanguage, setPrevLanguage] = useState(language)

  // Flowchart visualization state
  const [flowchartData, setFlowchartData] = useState(null)
  const [flowchartSectionId, setFlowchartSectionId] = useState(null)
  const [flowchartLoading, setFlowchartLoading] = useState(false)

  // Feature 2: Complexity Slider state - per-section reading level
  const [sectionComplexityLevels, setSectionComplexityLevels] = useState({}) // { sectionId: 'legal' | 'manager' | 'associate' }
  const [simplifiedContent, setSimplifiedContent] = useState({}) // Cache: { sectionId: { manager: '', associate: '' } }
  const [simplifyLoading, setSimplifyLoading] = useState(false)
  const [activeSimplifySectionId, setActiveSimplifySectionId] = useState(null)

  // Feature 3: Cross-Border Comparison state
  const [showCrossBorder, setShowCrossBorder] = useState(false)
  const [crossBorderData, setCrossBorderData] = useState(null)
  const [crossBorderTarget, setCrossBorderTarget] = useState(null)
  const [crossBorderLoading, setCrossBorderLoading] = useState(false)
  const [crossBorderError, setCrossBorderError] = useState(null)
  const [crossBorderSection, setCrossBorderSection] = useState(null) // Section being compared

  // Feature 3b: Multi-Country Comparison state (compare all 3 countries)
  const [showMultiCountry, setShowMultiCountry] = useState(false)
  const [multiCountryData, setMultiCountryData] = useState(null)
  const [multiCountryLoading, setMultiCountryLoading] = useState(false)
  const [multiCountryError, setMultiCountryError] = useState(null)

  // Section collapse state - all collapsed by default
  const [expandedSections, setExpandedSections] = useState({})

  // Chapter collapse state for middle column - all collapsed by default
  const [expandedChapters, setExpandedChapters] = useState({})

  // Comparison Modal state
  const [comparisonModal, setComparisonModal] = useState({ open: false, type: null, section: null })

  // Wikipedia Modal state
  const [wikiModal, setWikiModal] = useState({ open: false, lawAbbr: null })
  const [wikiIndex, setWikiIndex] = useState({}) // { lawAbbr: { title, url, summary } }
  const [whsCrosslinks, setWhsCrosslinks] = useState({}) // WHS term -> Wikipedia article mappings

  // PDF Viewer Modal state
  const [pdfModal, setPdfModal] = useState({ open: false, url: null, title: null })
  const [wikiContent, setWikiContent] = useState(null) // HTML content for modal
  const [wikiLoading, setWikiLoading] = useState(false)
  const [crosslinkPopup, setCrosslinkPopup] = useState({ open: false, term: null, data: null, x: 0, y: 0 })

  // Law reference hover preview state (for hovering over §4, Artikel 5, etc. in text)
  const [lawRefPreview, setLawRefPreview] = useState({ open: false, section: null, lawInfo: null, x: 0, y: 0 })
  const lawRefPreviewTimeoutRef = useRef(null)

  // Copy link feedback popup state
  const [copyFeedback, setCopyFeedback] = useState({ show: false, x: 0, y: 0 })

  const contentRef = useRef(null)
  const sectionRefs = useRef({})

  // Database loading state
  const [databaseLoading, setDatabaseLoading] = useState(false)
  const [databaseReady, setDatabaseReady] = useState(isDatabaseLoaded(framework))

  // Handle framework switching with loading state - loads database lazily
  useEffect(() => {
    if (framework !== prevFramework) {
      setIsLoading(true)
      setSelectedLaw(null)
      setSelectedCategory('all')
      setSearchTerm('')
      // CRITICAL: Clear AI response caches to prevent cross-framework contamination
      setSimplifiedContent({})
      setSectionComplexityLevels({})

      // Load the database for the new framework
      const loadDatabase = async () => {
        if (!isDatabaseLoaded(framework)) {
          setDatabaseLoading(true)
          try {
            await initializeLawsDatabase(framework)
            setDatabaseReady(true)
          } catch (error) {
            console.error(`Failed to load ${framework} database:`, error)
          } finally {
            setDatabaseLoading(false)
          }
        } else {
          setDatabaseReady(true)
        }

        setIsLoading(false)
        setPrevFramework(framework)
      }

      loadDatabase()
    }
  }, [framework, prevFramework])

  // Handle language change - clear AI response caches
  // AI responses are language-specific, so cached content becomes invalid when language changes
  useEffect(() => {
    if (language !== prevLanguage) {
      // Clear AI response caches to ensure fresh content in new language
      setSimplifiedContent({})
      setSectionComplexityLevels({})
      setPrevLanguage(language)
    }
  }, [language, prevLanguage])

  // Ensure database is loaded on initial mount
  useEffect(() => {
    if (!isDatabaseLoaded(framework)) {
      const loadInitialDatabase = async () => {
        setDatabaseLoading(true)
        try {
          await initializeLawsDatabase(framework)
          setDatabaseReady(true)
        } catch (error) {
          console.error(`Failed to load ${framework} database:`, error)
        } finally {
          setDatabaseLoading(false)
        }
      }
      loadInitialDatabase()
    } else {
      setDatabaseReady(true)
    }
  }, [])

  // Handle initial law navigation from other modules (e.g., ComplianceChecker)
  useEffect(() => {
    if (!initialLawId) return

    const navigateToInitialLaw = async () => {
      // If a different country is specified, switch to it first
      const targetCountry = initialCountry || framework
      if (targetCountry !== framework) {
        setFramework(targetCountry)
      }

      // Ensure the target database is loaded
      if (!isDatabaseLoaded(targetCountry)) {
        setDatabaseLoading(true)
        try {
          await initializeLawsDatabase(targetCountry)
        } catch (error) {
          console.error(`Failed to load ${targetCountry} database:`, error)
          onNavigationConsumed?.()
          return
        } finally {
          setDatabaseLoading(false)
        }
      }

      // Find and select the law (search by ID first, then by abbreviation)
      const laws = getAllLawsSync(targetCountry)
      const targetLaw = laws.find(law => law.id === initialLawId) ||
                        laws.find(law => law.abbreviation?.toLowerCase() === initialLawId?.toLowerCase())

      if (targetLaw) {
        setSelectedLaw(targetLaw)
        setSearchTerm('') // Clear any existing search
        setSelectedCategory('all') // Reset category filter
        // Add to audit trail
        addRecentSearch(targetLaw.abbreviation || targetLaw.title)

        // Scroll to specific section if provided
        if (initialSection) {
          // Find the section in the law data to get section.id and chapter info
          const normalizedInitialSection = initialSection.replace(/[§\s]/g, '')
          let foundSection = null
          let foundChapter = null

          if (targetLaw.chapters) {
            for (const chapter of targetLaw.chapters) {
              if (chapter.sections) {
                for (const section of chapter.sections) {
                  const sectionNum = section.number?.replace(/[§\s]/g, '')
                  if (sectionNum === normalizedInitialSection || section.id === initialSection) {
                    foundSection = section
                    foundChapter = chapter.abschnitt?.number || 'ungrouped'
                    break
                  }
                }
              }
              if (foundSection) break
            }
          }

          if (foundSection) {
            // Close all other sections and chapters, open only the linked one
            setExpandedSections({ [foundSection.id]: true })
            setExpandedChapters({ [foundChapter]: true })
          }

          // Wait for the law content to render, then scroll to section
          setTimeout(() => {
            const sectionElement = document.querySelector(`[data-section-id="${initialSection}"]`) ||
                                   document.querySelector(`[data-section-number="${normalizedInitialSection}"]`)
            if (sectionElement) {
              sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
              // Highlight briefly
              sectionElement.classList.add('ring-2', 'ring-whs-orange-500', 'ring-offset-2', 'transition-all')
              setTimeout(() => {
                sectionElement.classList.remove('ring-2', 'ring-whs-orange-500', 'ring-offset-2')
              }, 2000)
            }
          }, 300)
        }
      }

      // Clear the navigation request
      onNavigationConsumed?.()
    }

    navigateToInitialLaw()
  }, [initialLawId, initialCountry, initialSection, framework, setFramework, onNavigationConsumed, addRecentSearch])

  // Handle initial search query from other modules (e.g., Warehouse Visualization)
  useEffect(() => {
    if (!initialSearchQuery || initialLawId) return // Skip if no query or if navigating to specific law

    // Set the search term
    setSearchTerm(initialSearchQuery)
    setSelectedLaw(null) // Clear any selected law to show search results
    setSelectedCategory('all') // Reset category filter

    // Add to recent searches
    addRecentSearch(initialSearchQuery)

    // Clear the navigation request
    onNavigationConsumed?.()
  }, [initialSearchQuery, initialLawId, onNavigationConsumed, addRecentSearch])

  // Load Wikipedia index for current framework
  useEffect(() => {
    async function loadWikiIndex() {
      try {
        const countryCode = framework.toLowerCase()
        const response = await fetch(`/eu_safety_laws/${countryCode}/wikipedia/wiki_index.json`)
        if (response.ok) {
          const data = await response.json()
          setWikiIndex(data.articles || {})
          setWhsCrosslinks(data.whs_crosslinks || {})
        }
      } catch (e) {
        // Wikipedia index not available - not an error
        setWikiIndex({})
        setWhsCrosslinks({})
      }
    }
    loadWikiIndex()
  }, [framework])

  // Handle crosslink click - show popup with Wikipedia info
  const handleCrosslinkClick = useCallback((e, term, data) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.target.getBoundingClientRect()
    setCrosslinkPopup({
      open: true,
      term,
      data,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8
    })
  }, [])

  // Close crosslink popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (crosslinkPopup.open && !e.target.closest('.crosslink-popup')) {
        setCrosslinkPopup({ open: false, term: null, data: null, x: 0, y: 0 })
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [crosslinkPopup.open])

  // Close law reference preview when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (lawRefPreview.open && !e.target.closest('.law-ref-preview-popup')) {
        setLawRefPreview({ open: false, section: null, lawInfo: null, x: 0, y: 0 })
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [lawRefPreview.open])

  // Cleanup law reference preview timeout on unmount
  useEffect(() => {
    return () => {
      if (lawRefPreviewTimeoutRef.current) {
        clearTimeout(lawRefPreviewTimeoutRef.current)
      }
    }
  }, [])

  // Close law reference preview
  const closeLawRefPreview = useCallback(() => {
    setLawRefPreview({ open: false, section: null, lawInfo: null, x: 0, y: 0 })
  }, [])

  // Function to open Wikipedia modal
  const openWikiModal = async (lawAbbr) => {
    setWikiModal({ open: true, lawAbbr })
    setWikiLoading(true)
    setWikiContent(null)

    try {
      const countryCode = framework.toLowerCase()
      const response = await fetch(`/eu_safety_laws/${countryCode}/wikipedia/${lawAbbr}_wiki.html`)
      if (response.ok) {
        const html = await response.text()
        setWikiContent(html)
      }
    } catch (e) {
      console.error('Error loading Wikipedia article:', e)
    } finally {
      setWikiLoading(false)
    }
  }

  // Function to open PDF modal
  const openPdfModal = useCallback((law) => {
    const pdfUrl = getPdfSourceUrl(law)
    if (pdfUrl) {
      setPdfModal({
        open: true,
        url: pdfUrl,
        title: law.abbreviation || law.title || 'PDF Document'
      })
    }
  }, [])

  // Close PDF modal
  const closePdfModal = useCallback(() => {
    setPdfModal({ open: false, url: null, title: null })
  }, [])

  // Inline document view state (PDF/HTML in right column)
  const [inlineDocView, setInlineDocView] = useState(null) // { type: 'pdf' | 'html', url: string, title: string, law: object }

  // Collapsible sections for left column (Merkblätter, PDFs collapsed by default)
  const [collapsedLeftSections, setCollapsedLeftSections] = useState({
    merkblaetter: true,
    lawPdfs: true
  })

  // Subcategory filter for DE merkblaetter (ASR, DGUV, TRBS, TRGS)
  const [selectedSubcategory, setSelectedSubcategory] = useState('all')

  // Per-section translation state
  const [translatedContent, setTranslatedContent] = useState({}) // { sectionId: { translatedText, isTyping } }
  const [translationLoading, setTranslationLoading] = useState(false)
  const [translationEnabled, setTranslationEnabled] = useState(false) // Global toggle for translation feature

  // Get all laws and categories (uses sync function - database must be loaded)
  const allLaws = useMemo(() => {
    if (!databaseReady) return []
    return getAllLawsSync(framework)
  }, [framework, databaseReady])

  // Categories state (loaded async)
  const [categories, setCategories] = useState({})

  // Load categories when database is ready
  useEffect(() => {
    if (databaseReady) {
      getLawCategories(framework).then(cats => setCategories(cats || {}))
    }
  }, [framework, databaseReady])

  // Filter and search laws (no pagination - use scrolling)
  // Uses direct text search similar to right column content search
  const filteredLaws = useMemo(() => {
    let results = allLaws

    // Filter out category placeholder entries (e.g., _category_regulations, _category_manual_handling)
    // These are internal organization entries, not real laws
    results = results.filter(law => !law.abbreviation?.startsWith('_category_'))

    // Filter by category first
    if (selectedCategory !== 'all') {
      results = results.filter(law => law.type === selectedCategory)
    }

    // Apply full text search - similar approach to right column search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()

      // Normalize technical rule abbreviations for fuzzy matching
      // "ASR 3.5" -> "asr a3.5", "TRBS 1111" -> "trbs 1111"
      const normalizeTechnicalAbbrev = (text) => {
        if (!text) return ''
        let normalized = text.toLowerCase().trim()
        normalized = normalized.replace(/[-_.]/g, ' ').replace(/\s+/g, ' ')
        normalized = normalized.replace(/asr\s*a?(\d)/g, 'asr a$1')
        normalized = normalized.replace(/(trbs|trgs)\s*(\d)/g, '$1 $2')
        normalized = normalized.replace(/dguv\s*(\d)/g, 'dguv $1')
        return normalized
      }

      const normalizedTerm = normalizeTechnicalAbbrev(term)

      results = results.filter(law => {
        // Search in law title
        if (law.title?.toLowerCase().includes(term)) return true
        // Search in English title
        if (law.title_en?.toLowerCase().includes(term)) return true
        // Search in abbreviation (with fuzzy matching for technical rules)
        const abbrevLower = (law.abbreviation || '').toLowerCase()
        if (abbrevLower.includes(term)) return true
        // Fuzzy match for technical abbreviations like ASR, TRBS, TRGS, DGUV
        const normalizedAbbrev = normalizeTechnicalAbbrev(law.abbreviation)
        if (normalizedAbbrev.includes(normalizedTerm) || normalizedTerm.includes(normalizedAbbrev)) return true
        // Search in description
        if (law.description?.toLowerCase().includes(term)) return true
        // Search in subcategory (for technical rules like ASR, TRBS)
        if (law.subcategory?.toLowerCase().includes(term)) return true
        if (law.subcategory_name?.toLowerCase().includes(term)) return true
        // Search in full text content
        if (law.content?.full_text?.toLowerCase().includes(term)) return true
        if (law.content?.text?.toLowerCase().includes(term)) return true
        // Search in chapters and sections
        if (law.chapters && Array.isArray(law.chapters)) {
          for (const chapter of law.chapters) {
            if (chapter.title?.toLowerCase().includes(term)) return true
            if (chapter.title_en?.toLowerCase().includes(term)) return true
            if (chapter.sections && Array.isArray(chapter.sections)) {
              for (const section of chapter.sections) {
                if (section.title?.toLowerCase().includes(term)) return true
                if (section.text?.toLowerCase().includes(term)) return true
              }
            }
          }
        }
        return false
      })
    }

    return results
  }, [allLaws, searchTerm, selectedCategory])

  // Separate laws into categories for display:
  // 1. Regular laws (text-based)
  // 2. Merkblätter (AUVA M.plus, DGUV, TRBS, etc.) - supplementary documents
  // 3. Law PDFs (PDF-only versions of regular laws like ASchG-PDF)
  const { regularLaws, merkblaetter, lawPdfs } = useMemo(() => {
    const regular = []
    const supplements = []
    const pdfs = []

    for (const law of filteredLaws) {
      // PDF variants go to separate "Law PDFs" category
      if (isPdfVariant(law)) {
        pdfs.push(law)
        continue
      }

      // Check if it's a true supplementary source (Merkblatt, DGUV, etc.)
      if (isTrueSupplementarySource(law) || law.type === 'merkblatt') {
        supplements.push(law)
      }
      // Regular law
      else {
        regular.push(law)
      }
    }

    // Sort alphabetically by abbreviation/title for better organization
    const sortByName = (a, b) => {
      const nameA = (a.abbreviation || a.title || '').toLowerCase()
      const nameB = (b.abbreviation || b.title || '').toLowerCase()
      return nameA.localeCompare(nameB)
    }

    supplements.sort(sortByName)
    pdfs.sort(sortByName)
    regular.sort(sortByName)

    return { regularLaws: regular, merkblaetter: supplements, lawPdfs: pdfs }
  }, [filteredLaws])

  // Get unique subcategories from merkblaetter (for DE)
  const merkblaetterSubcategories = useMemo(() => {
    if (framework !== 'DE') return []
    const subcats = new Set()
    for (const law of merkblaetter) {
      if (law.subcategory) {
        subcats.add(law.subcategory)
      }
    }
    return Array.from(subcats).sort()
  }, [merkblaetter, framework])

  // Filter merkblaetter by subcategory (for DE)
  const filteredMerkblaetter = useMemo(() => {
    if (framework !== 'DE' || selectedSubcategory === 'all') {
      return merkblaetter
    }
    return merkblaetter.filter(law => law.subcategory === selectedSubcategory)
  }, [merkblaetter, selectedSubcategory, framework])

  // Helper function to extract section title from text content when database title is incomplete
  const extractTitleFromText = (text, sectionNumber) => {
    if (!text) return ''

    // Normalize spacing issues (common in AT laws: "§ 3 . " instead of "§ 3. ")
    const normalizedText = text.replace(/\s+\.\s+/g, '. ').replace(/\s+\./g, '.')

    // Get just the number part for pattern matching
    const numberPattern = sectionNumber.replace(/[§\s.]/g, '').replace(/([a-z])/i, '$1?')

    const patterns = [
      // "§ 1. Geltungsbereich" or "§ 3. Jugendliche im Sinne..." - title after section number
      new RegExp(`§\\s*${numberPattern}\\.?\\s+([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ\\s]+?)(?:\\s+(?:im Sinne|gemäß|nach|sind|ist|haben|wird|werden|kann|darf)|\\.|$)`, 'im'),
      // Simpler pattern: "§ X. Title" where title is capitalized phrase
      new RegExp(`§\\s*${numberPattern}\\.?\\s+([A-ZÄÖÜ][a-zäöüß]+(?:\\s+[a-zäöüßA-ZÄÖÜ]+){0,5})`, 'im'),
      // "Geltungsbereich\n§ 1." - title before section number
      new RegExp(`^([A-ZÄÖÜ][a-zäöüß]+(?:\\s+[A-Za-zäöüßÄÖÜ]+)*)\\s*\\n\\s*§\\s*${numberPattern}`, 'im'),
      // For NL: "Artikel X. Title"
      new RegExp(`Artikel\\s*${numberPattern}\\.?\\s+([A-Za-z][^\\n]{3,50})`, 'im'),
      // ABSCHNITT N\nTitle - look for title after ABSCHNITT header
      /ABSCHNITT\s+\d+[a-z]?\s*\n([A-ZÄÖÜ][^\n]{3,50})/im
    ]

    for (const pattern of patterns) {
      const match = normalizedText.match(pattern)
      if (match && match[1]) {
        let title = match[1].trim()
        // Clean up - remove section number patterns and parenthetical starts
        title = title.replace(/^\(?\d+\)?\s*/, '').trim()
        title = title.replace(/^§\s*\d+[a-z]?\.?\s*/i, '').trim()
        // Remove trailing punctuation
        title = title.replace(/[.,:;]$/, '').trim()
        if (title && title.length > 2 && title.length < 100) {
          return title
        }
      }
    }
    return ''
  }

  // Helper function to clean section content - removes redundant section number at start
  const cleanSectionContent = (text, sectionNumber) => {
    if (!text) return ''

    let cleaned = text

    // Remove "§ X:" or "§ X." or "Artikel X:" or "Artikel X." prefix from beginning
    // These duplicate the section header that's already shown
    cleaned = cleaned.replace(/^(§\s*\d+[a-z]?|Artikel\s*\d+[a-z]?)[.:]\s*/i, '').trim()

    // For NL laws: Remove patterns like "Artikel 1. :1. Begrippen:" at start of content
    // This handles the Dutch internal numbering format
    cleaned = cleaned.replace(/^Artikel\s*\d+[a-z]?\.\s*:?\d*:?\d+[a-z]?\.?\s*[^:\n]+:\s*/i, '').trim()

    // Also handle simpler patterns like ":1. Begrippen:" at start
    cleaned = cleaned.replace(/^:?\d*:?\d+[a-z]?\.?\s*[^:\n]+:\s*/i, '').trim()

    // Remove standalone "§" or "Artikel" at the very beginning (without number)
    cleaned = cleaned.replace(/^§\s*\n/i, '').trim()
    cleaned = cleaned.replace(/^Artikel\s*\n/i, '').trim()

    // Remove section title line if it duplicates the header (e.g., "§ 3 Gefahrenklassen\n")
    cleaned = cleaned.replace(/^(§\s*\d+[a-z]?\s+[^\n]+)\n/i, '').trim()
    cleaned = cleaned.replace(/^(Artikel\s*\d+[a-z]?\.\s*[^\n]+)\n/i, '').trim()

    // Clean up AT law spacing issues (". ." -> "." and extra spaces before periods)
    cleaned = cleaned.replace(/\s+\.\s+\./g, '.').replace(/\s+\./g, '.')

    return cleaned
  }

  // Helper function to clean section titles from internal numbering artifacts
  const cleanSectionTitle = (title, sectionNumber, jurisdiction) => {
    if (!title) return ''

    let cleaned = title.trim()

    // Step 1: Remove "Artikel X." or "§ X." prefix (handles "Artikel 1. :1. Begrippen", "§ 3. Title")
    cleaned = cleaned.replace(/^(§\s*\d+[a-z]?\.?|Artikel\s*\d+[a-z]?\.?)\s*/i, '').trim()

    // Step 2: Remove Dutch internal numbering patterns at start
    // Handle ":1", ":1.", ":1:" patterns (colon + digits + optional punctuation)
    cleaned = cleaned.replace(/^:\d+[a-z]?[.:]?\s*/i, '').trim()

    // Handle "1:1", "2:1" patterns (digits + colon + digits)
    cleaned = cleaned.replace(/^\d+:\d+[a-z]?[.:]?\s*/i, '').trim()

    // Step 3: Remove standalone single/double digits that are just article number echoes
    // e.g., "5" from "Artikel 35. 5", "0" from "Artikel 40. 0"
    if (/^\d{1,2}$/.test(cleaned)) {
      cleaned = ''
    }

    // Step 4: Handle AT "§ 0" preamble sections
    if (jurisdiction === 'AT' && sectionNumber === '0' && !cleaned) {
      cleaned = 'Langtitel'
    }

    return cleaned
  }

  // Parse sections for selected law - use pre-parsed chapters if available
  const lawSections = useMemo(() => {
    if (!selectedLaw) return []

    // Check if we have pre-parsed chapters from the scraper
    if (selectedLaw.chapters && selectedLaw.chapters.length > 0) {
      const sections = []
      for (const chapter of selectedLaw.chapters) {
        if (chapter.sections) {
          for (const section of chapter.sections) {
            // Extract title from database or from text content
            let sectionTitle = cleanSectionTitle(section.title, section.number, selectedLaw.jurisdiction)

            // If title is empty or just whitespace, try to extract from text content
            if (!sectionTitle && section.text) {
              sectionTitle = extractTitleFromText(section.text, section.number)
            }

            // Determine display number - handle AT preamble sections (number "0")
            let displayNumber
            if (section.number?.startsWith('§') || section.number?.startsWith('Artikel')) {
              displayNumber = section.number
            } else if (selectedLaw.jurisdiction === 'AT' && section.number === '0') {
              displayNumber = 'Präambel'
            } else {
              displayNumber = framework === 'NL' ? `Artikel ${section.number}` : `§ ${section.number}`
            }

            sections.push({
              id: section.id,
              number: displayNumber,
              title: sectionTitle,
              content: cleanSectionContent(section.text, section.number),
              rawNumber: section.number,
              abschnitt: {
                number: chapter.number,
                title: chapter.title_en || chapter.title,
                displayName: chapter.title
              },
              // WHS metadata from scraper
              whs_topics: section.whs_topics || [],
              amazon_logistics_relevance: section.amazon_logistics_relevance || null
            })
          }
        }
      }
      return sections
    }

    // Fallback to parsing from text
    const text = selectedLaw.content?.full_text || selectedLaw.content?.text || ''
    return parseLawSections(getCleanLawText(text), framework)
  }, [selectedLaw, framework])

  // Filter sections by search and relevance
  const filteredSections = useMemo(() => {
    let filtered = lawSections

    // Filter by relevance level
    if (relevanceFilter !== 'all') {
      filtered = filtered.filter(s => {
        const level = s.amazon_logistics_relevance?.level
        if (relevanceFilter === 'critical') return level === 'critical'
        if (relevanceFilter === 'high') return level === 'critical' || level === 'high'
        if (relevanceFilter === 'medium') return level === 'critical' || level === 'high' || level === 'medium'
        return true
      })
    }

    // Filter by section number/title/content (section sidebar filter)
    // Now also searches in section content for collapsed sections
    if (searchInLaw.trim()) {
      const term = searchInLaw.toLowerCase()
      filtered = filtered.filter(s =>
        s.number?.toLowerCase().includes(term) ||
        s.title?.toLowerCase().includes(term) ||
        s.content?.toLowerCase().includes(term)
      )
    }

    // Filter by content search term (full text search in right column)
    // Searches section content, title, chapter/Abschnitt title, and WHS topics
    if (contentSearchTerm.trim()) {
      const term = contentSearchTerm.toLowerCase()
      filtered = filtered.filter(s => {
        // Search in section content
        if (s.content?.toLowerCase().includes(term)) return true
        // Search in section title
        if (s.title?.toLowerCase().includes(term)) return true
        // Search in chapter/Abschnitt title
        if (s.abschnitt?.title?.toLowerCase().includes(term)) return true
        if (s.abschnitt?.displayName?.toLowerCase().includes(term)) return true
        // Search in WHS topic labels
        if (s.whs_topics?.some(topic => {
          const label = WHS_TOPIC_LABELS[topic.id]?.label?.toLowerCase()
          return label && label.includes(term)
        })) return true
        // Search in section number
        if (s.number?.toLowerCase().includes(term)) return true
        return false
      })
    }

    return filtered
  }, [lawSections, searchInLaw, contentSearchTerm, relevanceFilter])

  // Calculate total match count across all filtered sections
  useEffect(() => {
    if (!contentSearchTerm.trim()) {
      setTotalMatchCount(0)
      setCurrentMatchIndex(0)
      return
    }

    const term = contentSearchTerm.trim().toLowerCase()
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedTerm, 'gi')

    let count = 0
    filteredSections.forEach(section => {
      // Count matches in content
      if (section.content) {
        const contentMatches = section.content.match(regex)
        count += contentMatches ? contentMatches.length : 0
      }
      // Count matches in title
      if (section.title) {
        const titleMatches = section.title.match(regex)
        count += titleMatches ? titleMatches.length : 0
      }
    })

    setTotalMatchCount(count)
    setCurrentMatchIndex(count > 0 ? 1 : 0)
  }, [filteredSections, contentSearchTerm])

  // Navigate to specific match by index
  const navigateToMatch = useCallback((index) => {
    if (totalMatchCount === 0 || !contentSearchTerm.trim()) return

    // Normalize index (1-based, wrapping)
    let targetIndex = index
    if (targetIndex < 1) targetIndex = totalMatchCount
    if (targetIndex > totalMatchCount) targetIndex = 1

    setCurrentMatchIndex(targetIndex)

    // Find all highlight marks in order
    const marks = document.querySelectorAll('[data-search-match="true"]')
    if (marks.length > 0 && targetIndex <= marks.length) {
      const targetMark = marks[targetIndex - 1]

      // Remove active class from all marks
      marks.forEach(m => m.classList.remove('ring-2', 'ring-whs-orange-500'))

      // Add active class to target mark
      targetMark.classList.add('ring-2', 'ring-whs-orange-500')

      // Scroll to the mark
      targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [totalMatchCount, contentSearchTerm])

  // Navigate to next/previous match
  const goToNextMatch = useCallback(() => {
    navigateToMatch(currentMatchIndex + 1)
  }, [navigateToMatch, currentMatchIndex])

  const goToPrevMatch = useCallback(() => {
    navigateToMatch(currentMatchIndex - 1)
  }, [navigateToMatch, currentMatchIndex])

  // Related laws state (loaded async)
  const [relatedLaws, setRelatedLaws] = useState([])

  // Load related laws when a law is selected
  useEffect(() => {
    if (!selectedLaw) {
      setRelatedLaws([])
      return
    }

    getRelatedLaws(framework, selectedLaw.id, 5)
      .then(laws => setRelatedLaws(laws || []))
      .catch(err => {
        console.error('Failed to load related laws:', err)
        setRelatedLaws([])
      })
  }, [selectedLaw, framework])

  // Scroll to section and expand it (and its chapter)
  const scrollToSection = useCallback((sectionId) => {
    const element = sectionRefs.current[sectionId]
    if (element) {
      // Find the section to get its chapter
      const section = filteredSections.find(s => s.id === sectionId)
      const chapterKey = section?.abschnitt?.number || 'ungrouped'

      // Expand the chapter and section
      setExpandedChapters(prev => ({ ...prev, [chapterKey]: true }))
      setExpandedSections(prev => ({ ...prev, [sectionId]: true }))

      // Small delay to allow expansion before scrolling
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
      setActiveSection(sectionId)
    }
  }, [filteredSections])

  // Select a law - defined early as useCallback so it can be used in handleLawReferenceClick
  const selectLaw = useCallback((law, section = null) => {
    setSelectedLaw(law)
    setActiveSection(null)
    setSearchInLaw('')
    setContentSearchTerm('')

    // Update URL for direct linking
    if (onLawChange && law) {
      const country = law.jurisdiction || law.country || framework
      onLawChange(law.id, country, section)
    }

    // For PDF-only documents (like ASR, DGUV, etc.), automatically show the PDF viewer
    const isPdfOnly = law?.metadata?.is_pdf_only || law?.source?.source_type === 'pdf'
    if (isPdfOnly) {
      const pdfUrl = getPdfSourceUrl(law)
      if (pdfUrl) {
        setInlineDocView({ type: 'pdf', url: pdfUrl, title: law.abbreviation || law.title, law })
      } else {
        setInlineDocView(null)
      }
    } else {
      // Clear inline document view for regular laws
      setInlineDocView(null)
    }

    // Reset flowchart state
    setFlowchartData(null)
    setFlowchartSectionId(null)
    // Reset complexity slider state - per-section
    setSectionComplexityLevels({})
    setSimplifiedContent({})
    // Reset translation state
    setTranslatedContent({})
    setTranslationEnabled(false)
    // Reset cross-border state
    setShowCrossBorder(false)
    setCrossBorderData(null)
    setCrossBorderTarget(null)
    setCrossBorderError(null)
    setCrossBorderSection(null)
    // Reset multi-country state
    setShowMultiCountry(false)
    setMultiCountryData(null)
    setMultiCountryError(null)
    // Reset section collapse state - all collapsed by default
    setExpandedSections({})
    // Reset chapter collapse state - all collapsed by default
    setExpandedChapters({})
    // Reset comparison modal
    setComparisonModal({ open: false, type: null, section: null })
    // Reset section refs to avoid stale references
    sectionRefs.current = {}
    // Scroll content to top
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [onLawChange, framework])

  // Handle search
  const handleSearch = useCallback((term) => {
    setSearchTerm(term)
    if (term.trim()) addRecentSearch(term)
  }, [addRecentSearch])

  // Handle flowchart generation for a section
  const handleGenerateFlowchart = async (section) => {
    if (!section || flowchartLoading) return

    // If clicking the same section, toggle off
    if (flowchartSectionId === section.id && flowchartData) {
      setFlowchartData(null)
      setFlowchartSectionId(null)
      return
    }

    setFlowchartLoading(true)
    setFlowchartSectionId(section.id)
    setFlowchartData(null)

    try {
      const lawContext = selectedLaw ? `Law: ${selectedLaw.abbreviation || selectedLaw.title}\n` : ''
      const sectionText = `${section.number}${section.title ? ` - ${section.title}` : ''}\n\n${section.content}`
      const response = await generateFlowchart(lawContext + sectionText)
      setFlowchartData(response)
    } catch (error) {
      console.error('Flowchart generation error:', error)
      setFlowchartData(null)
      setFlowchartSectionId(null)
    } finally {
      setFlowchartLoading(false)
    }
  }

  // Close flowchart
  const closeFlowchart = () => {
    setFlowchartData(null)
    setFlowchartSectionId(null)
  }

  // Feature 2: Handle complexity level change for a specific section
  // Optimized: Uses combined API call to fetch both levels at once (saves ~50% tokens)
  const handleComplexityChange = async (level, section) => {
    if (!section) return

    // Update this section's reading level
    setSectionComplexityLevels(prev => ({
      ...prev,
      [section.id]: level
    }))

    if (level === 'legal') return

    // Check cache first
    const cached = simplifiedContent[section.id]?.[level]
    if (cached) return

    // Debounce: prevent duplicate requests for same section
    if (pendingSimplifyRef.current[section.id]) return
    pendingSimplifyRef.current[section.id] = true

    setSimplifyLoading(true)
    setActiveSimplifySectionId(section.id)

    try {
      // Include law abbreviation in title to ensure unique cache key across different laws
      const lawAbbr = selectedLaw?.abbreviation || selectedLaw?.abbr || ''
      const sectionTitle = `${lawAbbr} ${section.number}${section.title ? ` - ${section.title}` : ''}`

      // Use combined function to get BOTH levels in one API call
      const response = await simplifyForBothLevels(section.content, sectionTitle)

      // Cache BOTH results from single API call
      setSimplifiedContent(prev => ({
        ...prev,
        [section.id]: {
          ...prev[section.id],
          manager: response.manager,
          associate: response.associate
        }
      }))
    } catch (error) {
      console.error('Simplification error:', error)
    } finally {
      setSimplifyLoading(false)
      setActiveSimplifySectionId(null)
      delete pendingSimplifyRef.current[section.id]
    }
  }

  // Feature 3: Handle cross-border comparison for a section
  const handleCrossBorderCompare = async (targetFramework, section = null) => {
    if (crossBorderLoading) return

    // Use stored section if none provided
    const sectionToCompare = section || crossBorderSection

    setCrossBorderLoading(true)
    setCrossBorderTarget(targetFramework)
    setCrossBorderData(null)
    setCrossBorderError(null)

    try {
      let lawContext
      if (sectionToCompare) {
        // Compare specific section - keep context short for API
        const sectionTitle = `${sectionToCompare.number}${sectionToCompare.title ? ` - ${sectionToCompare.title}` : ''}`
        lawContext = `${selectedLaw?.abbreviation || ''}\n${sectionTitle}\n\n${sectionToCompare.content?.substring(0, 800) || ''}`
      } else {
        // Compare whole law (fallback)
        const lawText = selectedLaw?.content?.full_text || selectedLaw?.content?.text || selectedLaw?.description || ''
        lawContext = `${selectedLaw?.abbreviation || selectedLaw?.title}\n\n${lawText.substring(0, 800)}`
      }
      const response = await findEquivalentLaw(lawContext, targetFramework)
      setCrossBorderData(response)
    } catch (error) {
      console.error('Cross-border comparison error:', error)
      setCrossBorderError(error.message || 'Service unavailable')
      setCrossBorderData(null)
    } finally {
      setCrossBorderLoading(false)
    }
  }

  // Close cross-border comparison
  const closeCrossBorder = () => {
    setShowCrossBorder(false)
    setCrossBorderData(null)
    setCrossBorderTarget(null)
    setCrossBorderSection(null)
    setCrossBorderError(null)
  }

  // Feature 3b: Handle multi-country comparison for a section (all 3 countries)
  const handleMultiCountryCompare = async (section = null) => {
    if (multiCountryLoading) return

    setMultiCountryLoading(true)
    setMultiCountryData(null)
    setMultiCountryError(null)

    try {
      let lawContext
      if (section) {
        // Compare specific section - keep context short for API
        const sectionTitle = `${section.number}${section.title ? ` - ${section.title}` : ''}`
        lawContext = `${selectedLaw?.abbreviation || ''}\n${sectionTitle}\n\n${section.content?.substring(0, 800) || ''}`
      } else {
        // Compare whole law (fallback)
        const lawText = selectedLaw?.content?.full_text || selectedLaw?.content?.text || selectedLaw?.description || ''
        lawContext = `${selectedLaw?.abbreviation || selectedLaw?.title}\n\n${lawText.substring(0, 800)}`
      }
      const response = await compareMultipleCountries(lawContext)
      setMultiCountryData(response)
    } catch (error) {
      console.error('Multi-country comparison error:', error)
      setMultiCountryError(error.message || 'Service unavailable')
      setMultiCountryData(null)
    } finally {
      setMultiCountryLoading(false)
    }
  }

  // Close multi-country comparison
  const closeMultiCountry = () => {
    setShowMultiCountry(false)
    setMultiCountryData(null)
    setMultiCountryError(null)
  }

  // Handle click on law reference - deep link to the specific law/section
  const handleLawReferenceClick = useCallback((lawInfo) => {
    if (!lawInfo) return

    // Find the matching law
    let targetLaw = null
    let isCurrentLaw = false

    if (lawInfo.law) {
      // Specific law mentioned - search for it
      targetLaw = allLaws.find(law =>
        law.abbreviation?.toLowerCase() === lawInfo.law.toLowerCase() ||
        law.abbr?.toLowerCase() === lawInfo.law.toLowerCase()
      )
      // Check if the found law is the same as the current law
      if (targetLaw && selectedLaw && targetLaw.id === selectedLaw.id) {
        isCurrentLaw = true
      }
    } else if (lawInfo.type === 'technical') {
      // DGUV/TRBS etc - search by combination
      const searchTerm = `${lawInfo.lawType} ${lawInfo.number}`
      targetLaw = allLaws.find(law =>
        law.abbreviation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        law.title?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      // Check if the found law is the same as the current law
      if (targetLaw && selectedLaw && targetLaw.id === selectedLaw.id) {
        isCurrentLaw = true
      }
    }

    // If no specific law found but we have a section, it's a reference within the current law
    if (!targetLaw && selectedLaw && lawInfo.section) {
      targetLaw = selectedLaw
      isCurrentLaw = true
    }

    // If still no law and we have country info, might need to switch framework
    if (!targetLaw && lawInfo.country && lawInfo.country !== framework) {
      // The law is in a different country - we need to switch frameworks
      console.log(`Law reference points to ${lawInfo.country}, would need to switch frameworks`)
      // For now, just show an alert - in a full implementation, this would trigger a framework switch
      return
    }

    if (targetLaw && lawInfo.section) {
      // If it's a reference within the current law, scroll to the section without resetting
      if (isCurrentLaw) {
        // Find the section by number in lawSections (which are already parsed for current law)
        const targetSectionNum = lawInfo.section
        const section = lawSections.find(s => {
          const sectionNum = s.number?.replace(/[§\s]/g, '')
          return sectionNum === targetSectionNum
        })

        if (section) {
          // Use scrollToSection which properly handles chapter/section expansion
          scrollToSection(section.id)
          return
        }
      }

      // Different law - select it and try to scroll to section
      selectLaw(targetLaw, lawInfo.section ? `§ ${lawInfo.section}` : null)

      // If we have a section reference, try to find and select it after the law loads
      if (targetLaw.chapters) {
        // Search through chapters and sections for matching section number
        for (const chapter of targetLaw.chapters) {
          if (chapter.sections) {
            for (const section of chapter.sections) {
              const sectionNum = section.number?.replace(/[§\s]/g, '')
              if (sectionNum === lawInfo.section) {
                // Found the section - expand it and scroll to it
                setTimeout(() => {
                  setExpandedSections(prev => ({ ...prev, [section.id]: true }))
                  setActiveSection(section)
                  // Scroll to the section element by its id
                  const element = document.getElementById(section.id)
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }, 100)
                return
              }
            }
          }
        }
      }
    } else if (targetLaw) {
      // No section reference, just select the law
      selectLaw(targetLaw, null)
    }
  }, [allLaws, selectedLaw, framework, selectLaw, setExpandedSections, setActiveSection, lawSections, scrollToSection])

  // Handle hover on law reference - show preview popup
  const handleLawReferenceHover = useCallback((e, lawInfo) => {
    if (!lawInfo) return

    // Clear any pending timeout
    if (lawRefPreviewTimeoutRef.current) {
      clearTimeout(lawRefPreviewTimeoutRef.current)
    }

    // Capture rect synchronously before setTimeout (e.currentTarget is null inside setTimeout)
    const target = e.currentTarget
    if (!target) return
    const rect = target.getBoundingClientRect()

    // Set a delay before showing the preview
    lawRefPreviewTimeoutRef.current = setTimeout(() => {
      // Find the section content for preview
      let targetSection = null
      let targetLaw = null

      if (lawInfo.law) {
        // Specific law mentioned - search for it
        targetLaw = allLaws.find(law =>
          law.abbreviation?.toLowerCase() === lawInfo.law.toLowerCase() ||
          law.abbr?.toLowerCase() === lawInfo.law.toLowerCase()
        )
      }

      // If no specific law found but we have a section, it's a reference within the current law
      if (!targetLaw && selectedLaw && lawInfo.section) {
        targetLaw = selectedLaw
      }

      if (targetLaw && lawInfo.section) {
        // Check if it's the current law - use lawSections for faster lookup
        if (targetLaw.id === selectedLaw?.id) {
          targetSection = lawSections.find(s => {
            const sectionNum = s.number?.replace(/[§\s]/g, '')
            return sectionNum === lawInfo.section
          })
        } else if (targetLaw.chapters) {
          // Different law - search through chapters
          for (const chapter of targetLaw.chapters) {
            if (chapter.sections) {
              for (const section of chapter.sections) {
                const sectionNum = section.number?.replace(/[§\s]/g, '')
                if (sectionNum === lawInfo.section) {
                  // Build a section object similar to lawSections format
                  targetSection = {
                    id: section.id,
                    number: section.number?.startsWith('§') ? section.number : `§ ${section.number}`,
                    title: section.title,
                    content: section.text || section.content,
                    whs_topics: section.whs_topics,
                    amazon_logistics_relevance: section.amazon_logistics_relevance
                  }
                  break
                }
              }
              if (targetSection) break
            }
          }
        }
      }

      if (targetSection) {
        setLawRefPreview({
          open: true,
          section: targetSection,
          lawInfo,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8
        })
      }
    }, 300) // 300ms delay
  }, [allLaws, selectedLaw, lawSections])

  // Handle mouse leave on law reference
  const handleLawReferenceLeave = useCallback(() => {
    if (lawRefPreviewTimeoutRef.current) {
      clearTimeout(lawRefPreviewTimeoutRef.current)
      lawRefPreviewTimeoutRef.current = null
    }
  }, [])

  // Get source language for current framework
  const getSourceLanguage = () => {
    switch (framework) {
      case 'AT':
      case 'DE':
        return 'de'
      case 'NL':
        return 'nl'
      default:
        return 'de'
    }
  }

  // Handle translation for a section
  const handleTranslateSection = async (section, targetLang) => {
    if (!section || !targetLang || translationLoading) return
    if (rateLimitInfo.isLimited) return // Prevent requests during rate limit

    const sectionId = section.id
    const sourceLanguage = getSourceLanguage()

    // Skip if already translated or same language
    if (translatedContent[sectionId]?.language === targetLang) return
    if (sourceLanguage === targetLang) {
      // Same language - just show original
      setTranslatedContent(prev => ({
        ...prev,
        [sectionId]: { translatedText: null, isTyping: false, language: targetLang }
      }))
      return
    }

    // Start translation
    setTranslatedContent(prev => ({
      ...prev,
      [sectionId]: { translatedText: null, isTyping: true, language: targetLang }
    }))
    setTranslationLoading(true)

    try {
      const textToTranslate = section.content || ''
      const translated = await translateLawText(textToTranslate, sourceLanguage, targetLang)

      setTranslatedContent(prev => ({
        ...prev,
        [sectionId]: { translatedText: translated, isTyping: false, language: targetLang }
      }))
    } catch (error) {
      console.error('Translation error:', error)
      setTranslatedContent(prev => ({
        ...prev,
        [sectionId]: { translatedText: null, isTyping: false, language: null, error: error.message }
      }))
    } finally {
      setTranslationLoading(false)
    }
  }

  // Toggle section expand/collapse
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  // Toggle chapter expand/collapse in middle column
  const toggleChapter = (chapterKey) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterKey]: !prev[chapterKey]
    }))
  }

  // Open comparison modal
  const openComparisonModal = (type, section) => {
    setComparisonModal({ open: true, type, section })
    if (type === 'multi') {
      handleMultiCountryCompare(section)
    }
  }

  // Close comparison modal
  const closeComparisonModal = () => {
    setComparisonModal({ open: false, type: null, section: null })
    closeMultiCountry()
    closeCrossBorder()
  }

  const hasContent = selectedLaw?.content?.full_text || selectedLaw?.content?.text
  const isPdfOnly = selectedLaw?.metadata?.is_pdf_only || (hasPdfSource(selectedLaw) && !hasContent)
  const isHtmlOnlyDoc = isHtmlOnly(selectedLaw)

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
              {t.lawBrowser?.categoryAll || 'All'} ({allLaws.length})
            </button>
            {Object.entries(categories).map(([type, count]) => {
              // Translate category type labels
              const getCategoryLabel = (categoryType) => {
                switch(categoryType.toLowerCase()) {
                  case 'law':
                    return t.lawBrowser?.categoryLaw || 'Laws'
                  case 'merkblatt':
                    return t.lawBrowser?.categoryGuidance || 'Guidance'
                  default:
                    return categoryType
                }
              }
              return (
                <button
                  key={type}
                  onClick={() => setSelectedCategory(type)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedCategory === type
                      ? 'bg-whs-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-whs-dark-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {getCategoryLabel(type)} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Interactive Search Bar - Real-time search with category grouping */}
        <div className="mt-4">
          <InteractiveSearch
            laws={allLaws}
            t={t}
            onSelectResult={(result, searchTermFromSearch) => {
              // Select the law using the selectLaw function which handles PDF-only documents
              selectLaw(result)
              setSearchTerm('')

              // If a search term was provided, use it to highlight content and expand matching sections
              if (searchTermFromSearch && searchTermFromSearch.trim()) {
                // Set contentSearchTerm for highlighting
                const term = searchTermFromSearch.trim()
                setContentSearchTerm(term)

                const termLower = term.toLowerCase()
                const sectionsToExpand = {}
                const chaptersToExpand = {}

                // Check if we have pre-parsed chapters from the database
                if (result.chapters && result.chapters.length > 0) {
                  // Use section IDs from the database
                  for (const chapter of result.chapters) {
                    if (chapter.sections) {
                      for (const section of chapter.sections) {
                        const contentLower = (section.text || '').toLowerCase()
                        const titleLower = (section.title || '').toLowerCase()

                        if (contentLower.includes(termLower) || titleLower.includes(termLower)) {
                          sectionsToExpand[section.id] = true
                          // Also expand the chapter/abschnitt
                          if (chapter.number) {
                            chaptersToExpand[chapter.number] = true
                          }
                        }
                      }
                    }
                  }
                } else {
                  // Fallback to parsing from text
                  const lawContent = result.content?.full_text || result.content?.text || ''
                  if (lawContent) {
                    const sections = parseLawSections(lawContent, result.jurisdiction || framework)

                    sections.forEach(section => {
                      const contentLower = (section.content || '').toLowerCase()
                      const titleLower = (section.title || '').toLowerCase()

                      if (contentLower.includes(termLower) || titleLower.includes(termLower)) {
                        sectionsToExpand[section.id] = true
                        // Also expand the chapter/abschnitt if present
                        if (section.abschnitt) {
                          chaptersToExpand[section.abschnitt.number] = true
                        }
                      }
                    })
                  }
                }

                // Expand all matching sections and chapters
                if (Object.keys(sectionsToExpand).length > 0) {
                  setExpandedSections(sectionsToExpand)
                  setExpandedChapters(chaptersToExpand)
                }
              }
            }}
            onSearch={(term, mode) => {
              // Support all search modes from SmartSearch and InteractiveSearch
              // modes: 'all', 'laws', 'topic', 'fulltext', 'pdf', 'content', 'topics'
              if (mode === 'laws' || mode === 'all') {
                setSearchTerm(term)
              }
              // 'fulltext', 'content', and 'pdf' all search in law text content
              if (mode === 'content' || mode === 'fulltext' || mode === 'pdf' || mode === 'all') {
                setContentSearchTerm(term)
                // Also set searchTerm for PDF/fulltext to filter the law list
                if (mode === 'fulltext' || mode === 'pdf') {
                  setSearchTerm(term)
                }
              }
              if (mode === 'topics' || mode === 'topic') {
                // Search by topic - filter based on WHS topics
                setSearchTerm(term)
              }
            }}
            placeholder={t.search?.smartSearch || 'Search laws, topics, PDF content...'}
            className="max-w-3xl"
          />
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex gap-4 h-[calc(100%-180px)] relative">
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

        {/* Left: Law List - Modern Card Design */}
        <div className="w-72 flex-shrink-0">
          <Card className="h-full overflow-hidden flex flex-col bg-white/80 dark:bg-whs-dark-900/80 backdrop-blur-sm shadow-xl border-0 ring-1 ring-gray-200/50 dark:ring-whs-dark-700/50">
            {/* Header with gradient accent */}
            <div className="p-4 border-b border-gray-100 dark:border-whs-dark-700 bg-gradient-to-br from-gray-50 via-white to-gray-50/50 dark:from-whs-dark-800 dark:via-whs-dark-800 dark:to-whs-dark-900 flex-shrink-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-whs-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-whs-orange-500/20">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm tracking-tight">{t.lawBrowser?.lawsAndRegs || 'Laws & Regulations'}</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    {regularLaws.length} {t.lawBrowser?.laws || 'laws'}
                    {merkblaetter.length > 0 && ` · ${merkblaetter.length} ${t.lawBrowser?.merkbl || 'Merkbl.'}`}
                  </p>
                </div>
              </div>
              {/* Modern search bar */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-whs-orange-500/20 to-amber-500/20 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-whs-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search laws..."
                  className="relative w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-whs-dark-700/80 border border-gray-200 dark:border-whs-dark-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-whs-orange-500/50 focus:border-whs-orange-500 transition-all placeholder:text-gray-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-whs-dark-600 rounded-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {/* Regular Laws Section */}
              {regularLaws.length > 0 && (
                <div className="space-y-1">
                  {regularLaws.map((law) => (
                    <button
                      key={law.id}
                      onClick={() => selectLaw(law)}
                      className={`group w-full text-left p-3 rounded-xl transition-all duration-200 ${
                        selectedLaw?.id === law.id
                          ? 'bg-gradient-to-r from-whs-orange-50 to-amber-50/50 dark:from-whs-orange-900/30 dark:to-amber-900/20 shadow-md shadow-whs-orange-500/10 ring-1 ring-whs-orange-200 dark:ring-whs-orange-800'
                          : 'hover:bg-gray-50 dark:hover:bg-whs-dark-800/80 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wide ${typeColors[law.type] || typeColors.law} shadow-sm`}>
                          {law.abbreviation || law.abbr || law.type}
                        </span>
                        {isRecentlyUpdatedLaw(law) && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 shadow-sm animate-pulse" title={t.dashboard?.recentlyUpdated || 'Recently Updated'}>
                            {t.common?.updated || 'New'}
                          </span>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          {hasPdfSource(law) && (
                            <span className="w-6 h-6 flex items-center justify-center rounded-md bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400" title="PDF document available">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                          {wikiIndex[law.abbreviation] && (
                            <span className="w-6 h-6 flex items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-500" title="Wikipedia article available">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.451-.314.271-.615.812-.916 1.619l-4.476 11.781c-.053.209-.18.315-.376.315s-.329-.105-.4-.315l-3.04-6.476-.066-.135-3.179 6.582c-.041.209-.165.315-.369.315-.201 0-.336-.106-.406-.315l-3.156-7.098"/>
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 group-hover:text-whs-orange-600 dark:group-hover:text-whs-orange-400 transition-colors">
                        {t.lawTitles?.[framework]?.[law.abbreviation]?.de ||
                         t.lawTitles?.[framework]?.[law.abbreviation]?.nl ||
                         law.title_en || law.shortTitle || getShortenedLawName(law)}
                      </h4>
                      {(t.lawTitles?.[framework]?.[law.abbreviation]?.en || law.title_en) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                          {t.lawTitles?.[framework]?.[law.abbreviation]?.en || law.title_en}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Merkblätter / Supplements Section (blue styling) - Collapsible */}
              {merkblaetter.length > 0 && (
                <>
                  <button
                    onClick={() => setCollapsedLeftSections(prev => ({ ...prev, merkblaetter: !prev.merkblaetter }))}
                    className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-y border-blue-100 dark:border-blue-800 sticky top-0 z-10 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-blue-500 transition-transform ${collapsedLeftSections.merkblaetter ? '' : 'rotate-90'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                      </svg>
                      <span className="font-semibold text-blue-700 dark:text-blue-300 text-sm flex-1 text-left">
                        {t.lawBrowser?.supplementaryDocs || (
                          framework === 'AT' ? 'AUVA Merkblätter' :
                          framework === 'DE' ? 'DGUV / Technische Regeln' :
                          framework === 'NL' ? 'Arbocatalogi' :
                          'Supplementary Documents'
                        )}
                      </span>
                      <span className="text-xs text-blue-500 dark:text-blue-400">({filteredMerkblaetter.length})</span>
                    </div>
                  </button>
                  {/* Subcategory filter dropdown for DE */}
                  {!collapsedLeftSections.merkblaetter && framework === 'DE' && merkblaetterSubcategories.length > 0 && (
                    <div className="px-3 py-2 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800">
                      <select
                        value={selectedSubcategory}
                        onChange={(e) => setSelectedSubcategory(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-whs-dark-700 text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="all">{t.lawBrowser?.allCategories || 'All Categories'} ({merkblaetter.length})</option>
                        {merkblaetterSubcategories.map(subcat => (
                          <option key={subcat} value={subcat}>
                            {subcat} ({merkblaetter.filter(m => m.subcategory === subcat).length})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {!collapsedLeftSections.merkblaetter && filteredMerkblaetter.map((law) => (
                    <button
                      key={law.id}
                      onClick={() => {
                        if (hasLocalPdf(law) || hasPdfSource(law)) {
                          const pdfUrl = getPdfSourceUrl(law)
                          setInlineDocView({ type: 'pdf', url: pdfUrl, title: law.abbreviation || law.title, law })
                          setSelectedLaw(null)
                          // Update URL for direct linking even for PDF views
                          if (onLawChange && law) {
                            const country = law.jurisdiction || law.country || framework
                            onLawChange(law.id, country, null)
                          }
                        } else {
                          selectLaw(law)
                          setInlineDocView(null)
                        }
                      }}
                      className={`w-full text-left p-3 border-b border-gray-50 dark:border-whs-dark-800 transition-colors ${
                        inlineDocView?.law?.id === law.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                          : 'hover:bg-gray-50 dark:hover:bg-whs-dark-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {law.abbreviation || law.abbr || 'Merkblatt'}
                        </span>
                        {isRecentlyUpdatedLaw(law) && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700" title={t.dashboard?.recentlyUpdated || 'Recently Updated'}>
                            {t.common?.updated || 'Updated'}
                          </span>
                        )}
                        {(hasLocalPdf(law) || hasPdfSource(law)) ? (
                          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20" title="PDF available - click to view">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                          </svg>
                        )}
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
                        {law.title_en || law.title || getShortenedLawName(law)}
                      </h4>
                      {law.metadata?.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                          {law.metadata.description}
                        </p>
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* Law PDFs Section (red styling) - PDF-only versions of laws - Collapsible */}
              {lawPdfs.length > 0 && (
                <>
                  <button
                    onClick={() => setCollapsedLeftSections(prev => ({ ...prev, lawPdfs: !prev.lawPdfs }))}
                    className="w-full px-3 py-2 bg-red-50 dark:bg-red-900/20 border-y border-red-100 dark:border-red-800 sticky top-0 z-10 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-red-500 transition-transform ${collapsedLeftSections.lawPdfs ? '' : 'rotate-90'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold text-red-700 dark:text-red-300 text-sm flex-1 text-left">
                        {t.lawBrowser?.lawPdfs || 'Gesetzes-PDFs'}
                      </span>
                      <span className="text-xs text-red-500 dark:text-red-400">({lawPdfs.length})</span>
                    </div>
                  </button>
                  {!collapsedLeftSections.lawPdfs && lawPdfs.map((law) => (
                    <button
                      key={law.id}
                      onClick={() => {
                        const pdfUrl = getPdfSourceUrl(law)
                        setInlineDocView({ type: 'pdf', url: pdfUrl, title: law.abbreviation || law.title, law })
                        setSelectedLaw(null)
                        // Update URL for direct linking
                        if (onLawChange && law) {
                          const country = law.jurisdiction || law.country || framework
                          onLawChange(law.id, country, null)
                        }
                      }}
                      className={`w-full text-left p-3 border-b border-gray-50 dark:border-whs-dark-800 transition-colors ${
                        inlineDocView?.law?.id === law.id
                          ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500'
                          : 'hover:bg-gray-50 dark:hover:bg-whs-dark-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          {(law.abbreviation || law.abbr || 'PDF').replace(/-PDF$/i, '')}
                        </span>
                        {isRecentlyUpdatedLaw(law) && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700" title={t.dashboard?.recentlyUpdated || 'Recently Updated'}>
                            {t.common?.updated || 'Updated'}
                          </span>
                        )}
                        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20" title="PDF document">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
                        {(law.title_en || law.title || law.abbreviation || '').replace(/-PDF$/i, ' (PDF)')}
                      </h4>
                    </button>
                  ))}
                </>
              )}

            </div>
          </Card>
        </div>

        {/* Middle: Section Navigation (when law selected) - Modern Design */}
        {selectedLaw && lawSections.length > 0 && (
          <div className="w-64 flex-shrink-0">
            <Card className="h-full overflow-hidden bg-white/80 dark:bg-whs-dark-900/80 backdrop-blur-sm shadow-xl border-0 ring-1 ring-gray-200/50 dark:ring-whs-dark-700/50">
              <div className="p-4 border-b border-gray-100 dark:border-whs-dark-700 bg-gradient-to-br from-slate-50 via-white to-slate-50/50 dark:from-whs-dark-800 dark:via-whs-dark-800 dark:to-whs-dark-900">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                      {t.sections?.title || 'Sections'}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      {filteredSections.length} of {lawSections.length} sections
                    </p>
                  </div>
                </div>
                <input
                  type="text"
                  value={searchInLaw}
                  onChange={(e) => setSearchInLaw(e.target.value)}
                  placeholder={t.common?.filterBySection || "Filter sections..."}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-whs-dark-700/80 border border-gray-200 dark:border-whs-dark-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-gray-400"
                />
                {/* Relevance Filter Pills - Modern style */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['all', 'critical', 'high', 'medium'].map(level => {
                    const levelColors = {
                      all: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 ring-gray-200 dark:ring-gray-700',
                      critical: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-800',
                      high: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-800',
                      medium: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 ring-yellow-200 dark:ring-yellow-800'
                    }
                    return (
                      <button
                        key={level}
                        onClick={() => setRelevanceFilter(level)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                          relevanceFilter === level
                            ? 'bg-gradient-to-r from-whs-orange-500 to-amber-500 text-white shadow-md shadow-whs-orange-500/20 ring-2 ring-whs-orange-300 dark:ring-whs-orange-700'
                            : `${levelColors[level]} hover:ring-2 ring-1`
                        }`}
                      >
                        {level === 'all' ? (t.common?.all || 'All') : RELEVANCE_LEVELS[level]?.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="overflow-y-auto h-[calc(100%-140px)] p-2">
                {(() => {
                  // Group sections by chapter/Abschnitt
                  const groupedSections = filteredSections.reduce((acc, section) => {
                    const chapterKey = section.abschnitt?.number || 'ungrouped'
                    if (!acc[chapterKey]) {
                      acc[chapterKey] = {
                        abschnitt: section.abschnitt,
                        sections: []
                      }
                    }
                    acc[chapterKey].sections.push(section)
                    return acc
                  }, {})

                  return Object.entries(groupedSections).map(([chapterKey, { abschnitt, sections }]) => {
                    const isChapterExpanded = expandedChapters[chapterKey] ?? false
                    // Use dynamic labels based on country/framework
                    const groupingLabel = getStructureLabel(framework, 'grouping_1')
                    const chapterTitle = abschnitt?.displayName || abschnitt?.title || `${chapterKey}. ${groupingLabel}`

                    return (
                      <div key={chapterKey} className="mb-2">
                        {/* Chapter Header - Modern collapsible style */}
                        <button
                          onClick={() => toggleChapter(chapterKey)}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-200 sticky top-0 z-10 ${
                            isChapterExpanded
                              ? 'bg-gradient-to-r from-indigo-100 to-purple-100/50 dark:from-indigo-900/40 dark:to-purple-900/30 text-indigo-800 dark:text-indigo-200 shadow-sm ring-1 ring-indigo-200/50 dark:ring-indigo-700/50'
                              : 'bg-gray-100/80 dark:bg-whs-dark-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-whs-dark-700/80'
                          }`}
                          title={chapterTitle}
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isChapterExpanded
                              ? 'bg-indigo-500 text-white shadow-sm'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                          }`}>
                            <svg
                              className={`w-3 h-3 transition-transform duration-200 ${isChapterExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <span className="flex-1 text-left line-clamp-2 font-semibold">{chapterTitle}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isChapterExpanded
                              ? 'bg-indigo-200/50 dark:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                            {sections.length}
                          </span>
                        </button>

                        {/* Sections within chapter - only shown when expanded */}
                        {isChapterExpanded && (
                          <div className="mt-1 space-y-1 ml-2 pl-2 border-l-2 border-indigo-200 dark:border-indigo-800">
                            {sections.map((section) => {
                              const relevanceLevel = section.amazon_logistics_relevance?.level
                              const relevanceStyles = {
                                critical: 'ring-red-300 dark:ring-red-700 bg-red-50/50 dark:bg-red-900/10',
                                high: 'ring-orange-300 dark:ring-orange-700 bg-orange-50/50 dark:bg-orange-900/10',
                                medium: 'ring-yellow-300 dark:ring-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10',
                                low: ''
                              }
                              const relevanceIndicator = {
                                critical: 'bg-red-500',
                                high: 'bg-orange-500',
                                medium: 'bg-yellow-500',
                                low: 'bg-gray-300 dark:bg-gray-600'
                              }

                              return (
                                <div
                                  key={section.id}
                                  className={`rounded-lg overflow-hidden transition-all duration-200 ${
                                    activeSection === section.id
                                      ? 'ring-2 ring-whs-orange-400 dark:ring-whs-orange-600 shadow-md'
                                      : relevanceLevel ? `ring-1 ${relevanceStyles[relevanceLevel]}` : ''
                                  }`}
                                >
                                  <button
                                    onClick={() => scrollToSection(section.id)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-all duration-200 ${
                                      activeSection === section.id
                                        ? 'bg-gradient-to-r from-whs-orange-50 to-amber-50 dark:from-whs-orange-900/30 dark:to-amber-900/20'
                                        : 'bg-white/80 dark:bg-whs-dark-800/60 hover:bg-gray-50 dark:hover:bg-whs-dark-700/80'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {/* Relevance indicator dot */}
                                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${relevanceIndicator[relevanceLevel] || relevanceIndicator.low}`}></span>
                                      <span className={`text-sm font-extrabold ${
                                        activeSection === section.id
                                          ? 'text-whs-orange-600 dark:text-whs-orange-400'
                                          : 'text-gray-900 dark:text-white'
                                      }`}>{section.number}</span>
                                      {section.whs_topics && section.whs_topics.length > 0 && (
                                        <span className="text-sm ml-auto opacity-60">
                                          {WHS_TOPIC_LABELS[section.whs_topics[0]?.id]?.icon || ''}
                                        </span>
                                      )}
                                    </div>
                                    {section.title && (
                                      <div className={`text-xs line-clamp-2 mt-1.5 font-semibold ${
                                        activeSection === section.id
                                          ? 'text-whs-orange-700 dark:text-whs-orange-300'
                                          : 'text-gray-700 dark:text-gray-300'
                                      }`} title={section.title}>
                                        {highlightText(section.title, searchInLaw)}
                                      </div>
                                    )}
                                  </button>
                                  {/* Compare buttons - Compact modern style */}
                                  <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50/80 dark:bg-whs-dark-900/50 border-t border-gray-100 dark:border-whs-dark-700">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openComparisonModal('multi', section)
                                      }}
                                      disabled={rateLimitInfo.isLimited}
                                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                                        rateLimitInfo.isLimited
                                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                          : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                                      }`}
                                      title={rateLimitInfo.isLimited ? `${t.common?.rateLimited || 'Please wait'} (${rateLimitInfo.remainingSeconds}s)` : (t.common?.compareAllCountries || "Compare this section across all 3 countries")}
                                    >
                                      <span>🌍</span>
                                      <span>{t.common?.compareAll || 'All'}</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setCrossBorderSection(section)
                                        openComparisonModal('cross', section)
                                      }}
                                      disabled={rateLimitInfo.isLimited}
                                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                                        rateLimitInfo.isLimited
                                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                          : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                                      }`}
                                      title={rateLimitInfo.isLimited ? `${t.common?.rateLimited || 'Please wait'} (${rateLimitInfo.remainingSeconds}s)` : (t.common?.compareTwoCountries || "Compare this section with another country")}
                                    >
                                      <span>↔️</span>
                                      <span>{t.common?.compare || 'Compare'}</span>
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </Card>
          </div>
        )}

        {/* Right: Law Content - Modern Design */}
        <div className="flex-1 min-w-0">
          <Card className="h-full overflow-hidden bg-white/90 dark:bg-whs-dark-900/90 backdrop-blur-sm shadow-xl border-0 ring-1 ring-gray-200/50 dark:ring-whs-dark-700/50">
            {/* Inline PDF/HTML View */}
            {inlineDocView ? (
              <div className="h-full flex flex-col">
                {/* Header for inline document */}
                <div className="flex-shrink-0 p-3 border-b border-gray-100 dark:border-whs-dark-700 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h3 className="font-bold">{inlineDocView.title}</h3>
                        <p className="text-xs text-white/80">{inlineDocView.type === 'pdf' ? 'PDF Document' : 'HTML Document'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={inlineDocView.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        title={t.common?.openNewTab || "Open in new tab"}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <a
                        href={inlineDocView.url}
                        download
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        title={t.common?.download || "Download"}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                      <button
                        onClick={() => setInlineDocView(null)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        title={t.common?.close || "Close"}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                {/* Inline document content */}
                <div className="flex-1">
                  {inlineDocView.type === 'pdf' ? (
                    <iframe
                      src={inlineDocView.url}
                      className="w-full h-full border-0"
                      title={inlineDocView.title}
                    />
                  ) : (
                    <iframe
                      src={inlineDocView.url}
                      className="w-full h-full border-0 bg-white"
                      title={inlineDocView.title}
                    />
                  )}
                </div>
              </div>
            ) : selectedLaw ? (
              <div className="h-full flex flex-col">
                {/* Law Header - Modern gradient design */}
                <div className="flex-shrink-0 p-5 border-b border-whs-orange-400/20 dark:border-whs-orange-700/30 bg-gradient-to-br from-whs-orange-500 via-whs-orange-600 to-amber-600 text-white relative overflow-hidden">
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
                  </div>
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
                          {selectedLaw.type}
                        </span>
                        {selectedLaw.category && (
                          <span className="px-3 py-1 bg-white/15 backdrop-blur-sm rounded-lg text-xs font-medium">
                            {selectedLaw.category}
                          </span>
                        )}
                        {isRecentlyUpdatedLaw(selectedLaw) && (
                          <span className="px-2 py-1 bg-emerald-400/30 backdrop-blur-sm rounded-lg text-xs font-bold uppercase tracking-wider animate-pulse">
                            Updated
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight leading-tight">
                        {t.lawTitles?.[framework]?.[selectedLaw.abbreviation]?.de ||
                         t.lawTitles?.[framework]?.[selectedLaw.abbreviation]?.nl ||
                         getShortenedLawName(selectedLaw)}
                      </h3>
                      {(t.lawTitles?.[framework]?.[selectedLaw.abbreviation]?.en || selectedLaw.title_en) && (
                        <p className="text-white/80 text-sm mt-2 font-medium">
                          {t.lawTitles?.[framework]?.[selectedLaw.abbreviation]?.en || selectedLaw.title_en}
                        </p>
                      )}
                    </div>
                    {/* Action buttons - Modern glass style */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleBookmark(selectedLaw.id)}
                        className={`p-2.5 rounded-xl transition-all duration-200 backdrop-blur-sm ${
                          isBookmarked(selectedLaw.id)
                            ? 'bg-white/30 shadow-lg shadow-white/10'
                            : 'bg-white/10 hover:bg-white/25 hover:shadow-md'
                        }`}
                        title={isBookmarked(selectedLaw.id) ? 'Remove bookmark' : 'Add bookmark'}
                      >
                        <svg className="w-5 h-5" fill={isBookmarked(selectedLaw.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                      {/* PDF Download Button */}
                      {hasPdfSource(selectedLaw) && (
                        <button
                          onClick={() => openPdfModal(selectedLaw)}
                          className="p-2.5 bg-white/10 hover:bg-white/25 rounded-xl transition-all duration-200 backdrop-blur-sm hover:shadow-md"
                          title={t.common?.viewOfficialPdf || 'View/Download Official PDF'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11v6m0 0l-2-2m2 2l2-2" />
                          </svg>
                        </button>
                      )}
                      {selectedLaw.source?.url && (
                        <a
                          href={selectedLaw.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-white/10 hover:bg-white/25 rounded-xl transition-all duration-200 backdrop-blur-sm hover:shadow-md"
                          title={t.common?.viewOfficialSource || 'View official source'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                      <button
                        onClick={() => wikiIndex[selectedLaw.abbreviation] && openWikiModal(selectedLaw.abbreviation)}
                        disabled={!wikiIndex[selectedLaw.abbreviation]}
                        className={`p-2.5 rounded-xl transition-all duration-200 backdrop-blur-sm ${
                          wikiIndex[selectedLaw.abbreviation]
                            ? 'bg-white/10 hover:bg-white/25 hover:shadow-md cursor-pointer'
                            : 'bg-white/5 opacity-40 cursor-not-allowed'
                        }`}
                        title={wikiIndex[selectedLaw.abbreviation]
                          ? `Wikipedia: ${wikiIndex[selectedLaw.abbreviation]?.title || selectedLaw.abbreviation}`
                          : 'No Wikipedia article available'
                        }
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.451-.314.271-.615.812-.916 1.619l-4.476 11.781c-.053.209-.18.315-.376.315s-.329-.105-.4-.315l-3.04-6.476-.066-.135-3.179 6.582c-.041.209-.165.315-.369.315-.201 0-.336-.106-.406-.315l-3.156-7.098"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Full Text Search in Law - Modern design */}
                {hasContent && lawSections.length > 0 && (
                  <div className="flex-shrink-0 px-5 py-3 border-b border-gray-100 dark:border-whs-dark-700 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-whs-dark-800 dark:to-whs-dark-900">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-whs-orange-500/10 to-amber-500/10 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-whs-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={contentSearchTerm}
                        onChange={(e) => setContentSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && totalMatchCount > 0) {
                            e.preventDefault()
                            if (e.shiftKey) {
                              goToPrevMatch()
                            } else {
                              goToNextMatch()
                            }
                          }
                        }}
                        placeholder={t.common?.fullTextSearch || "Full text search in this law..."}
                        className="relative w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-whs-dark-700/80 border border-gray-200 dark:border-whs-dark-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-whs-orange-500/50 focus:border-whs-orange-500 transition-all shadow-sm placeholder:text-gray-400"
                      />
                      {contentSearchTerm && (
                        <button
                          onClick={() => setContentSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-whs-dark-600 rounded-lg transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {contentSearchTerm && (
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-whs-orange-500 animate-pulse"></span>
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                            {totalMatchCount > 0 ? (
                              <>
                                <span className="text-whs-orange-600 dark:text-whs-orange-400 font-bold">{currentMatchIndex}</span>
                                <span className="mx-0.5">/</span>
                                <span className="text-whs-orange-600 dark:text-whs-orange-400 font-bold">{totalMatchCount}</span>
                                {' '}match{totalMatchCount !== 1 ? 'es' : ''} in {filteredSections.length} section{filteredSections.length !== 1 ? 's' : ''}
                              </>
                            ) : (
                              <>No matches found</>
                            )}
                          </p>
                        </div>
                        {totalMatchCount > 0 && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={goToPrevMatch}
                              className="p-1.5 text-gray-500 hover:text-whs-orange-600 dark:text-gray-400 dark:hover:text-whs-orange-400 hover:bg-gray-100 dark:hover:bg-whs-dark-600 rounded-lg transition-all"
                              title="Previous match (↑)"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={goToNextMatch}
                              className="p-1.5 text-gray-500 hover:text-whs-orange-600 dark:text-gray-400 dark:hover:text-whs-orange-400 hover:bg-gray-100 dark:hover:bg-whs-dark-600 rounded-lg transition-all"
                              title="Next match (↓)"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Law Content */}
                <div ref={contentRef} className="flex-1 overflow-y-auto">
                  {isHtmlOnlyDoc && hasLocalHtml(selectedLaw) ? (
                    /* HTML-Only Document Display - Merkblätter stored as HTML */
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                          </svg>
                          <span className="font-medium text-blue-700 dark:text-blue-300 text-sm">
                            {selectedLaw.abbreviation || selectedLaw.title || 'Merkblatt'}
                          </span>
                        </div>
                        <a
                          href={getLocalHtmlUrl(selectedLaw)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 bg-blue-100 dark:bg-blue-900/40 rounded transition-colors"
                          title="Open in new tab"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          New Tab
                        </a>
                      </div>
                      <iframe
                        src={getLocalHtmlUrl(selectedLaw)}
                        className="flex-1 w-full border-0 bg-white"
                        title={selectedLaw.abbreviation || selectedLaw.title || 'Merkblatt'}
                      />
                    </div>
                  ) : isPdfOnly ? (
                    /* PDF-Only Document Display */
                    hasLocalPdf(selectedLaw) ? (
                      /* Local PDF - Embed directly in iframe */
                      <div className="h-full flex flex-col">
                        <PdfViewer
                          url={getLocalPdfUrl(selectedLaw)}
                          title={selectedLaw.abbreviation || selectedLaw.title || 'PDF Document'}
                          className="flex-1"
                        />
                      </div>
                    ) : (
                      /* PDF not available locally - show info message */
                      <div className="p-6">
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-2xl p-8 text-center border border-gray-200 dark:border-gray-700">
                          <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {selectedLaw.abbreviation || 'PDF Document'}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                            {selectedLaw.metadata?.description || selectedLaw.title_en || selectedLaw.title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                            PDF not available locally. Run the scraper to download this document.
                          </p>
                          {selectedLaw.source && (
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                              Source: {selectedLaw.source.authority || 'Official Source'}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  ) : hasContent ? (
                    <div className="p-6">
                      {/* WHS Summary Panel */}
                      {selectedLaw.whs_summary && (
                        <WHSSummaryPanel summary={selectedLaw.whs_summary} />
                      )}

                      {/* Source info */}
                      {selectedLaw.source && (
                        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                          <span className="font-medium text-blue-700 dark:text-blue-300">Source:</span>
                          <span className="ml-2 text-blue-600 dark:text-blue-400">{selectedLaw.source.authority || selectedLaw.source.name}</span>
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
                          {(() => {
                            let currentAbschnitt = null
                            return filteredSections.map((section) => {
                              const showAbschnittHeader = section.abschnitt && section.abschnitt.number !== currentAbschnitt?.number
                              if (showAbschnittHeader) {
                                currentAbschnitt = section.abschnitt
                              }

                              return (
                                <div key={section.id}>
                                  {showAbschnittHeader && section.abschnitt && (
                                    <div className="mb-6 mt-8 first:mt-0 p-4 bg-gradient-to-r from-whs-orange-50 to-transparent dark:from-whs-orange-900/20 dark:to-transparent rounded-lg border-l-4 border-whs-orange-500">
                                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {section.abschnitt.displayName || `${section.abschnitt.number}. ${getStructureLabel(framework, 'grouping_1')}`}
                                      </h2>
                                      <p className="text-gray-600 dark:text-gray-400 font-medium">
                                        {section.abschnitt.title}
                                      </p>
                                    </div>
                                  )}
                                  <div
                                    id={section.id}
                                    ref={(el) => (sectionRefs.current[section.id] = el)}
                                    className="scroll-mt-4"
                                    data-section-id={section.id}
                                    data-section-number={section.number?.replace(/[§\s]/g, '')}
                                  >
                                    {/* Section Header with WHS Relevance - Clickable to expand/collapse */}
                                    <div
                                      className="flex items-start gap-2 mb-2 pb-2 border-b border-whs-orange-200 dark:border-whs-orange-800"
                                    >
                                      <button
                                        onClick={() => toggleSection(section.id)}
                                        className="flex-1 flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-whs-dark-800 transition-colors rounded-lg px-2 py-1 -ml-2 text-left"
                                      >
                                        <svg
                                          className={`w-4 h-4 text-gray-400 transition-transform mt-0.5 flex-shrink-0 ${expandedSections[section.id] ? 'rotate-90' : ''}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        <span className="text-base font-bold text-whs-orange-500 flex-shrink-0">
                                          {section.number}
                                        </span>
                                        {section.title && (
                                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                                            {highlightText(section.title, contentSearchTerm)}
                                          </h3>
                                        )}
                                      </button>
                                      {/* Copy link button for direct linking */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const url = `${window.location.origin}${window.location.pathname}?law=${selectedLaw.id}&country=${selectedLaw.jurisdiction || framework}&section=${encodeURIComponent(section.number)}`
                                          navigator.clipboard.writeText(url).then(() => {
                                            // Show popup feedback near the button
                                            const rect = e.target.closest('button').getBoundingClientRect()
                                            setCopyFeedback({ show: true, x: rect.left, y: rect.top - 40 })
                                            setTimeout(() => setCopyFeedback({ show: false, x: 0, y: 0 }), 2000)
                                          })
                                        }}
                                        className="flex-shrink-0 p-1 text-gray-400 hover:text-whs-orange-500 transition-colors"
                                        title={t.lawBrowser?.copyLink || 'Copy link to this section'}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                      </button>
                                      {/* Wiki link button */}
                                      {wikiIndex[selectedLaw?.abbreviation] && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openWikiModal(selectedLaw.abbreviation)
                                          }}
                                          className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                          title="View Wikipedia article"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        </button>
                                      )}
                                      {/* WHS Relevance Badge */}
                                      {section.amazon_logistics_relevance && (
                                        <div className="flex-shrink-0">
                                          <RelevanceBadge level={section.amazon_logistics_relevance.level} />
                                        </div>
                                      )}
                                    </div>

                                    {/* Collapsible Content */}
                                    {expandedSections[section.id] && (
                                      <>
                                        {/* WHS Topics Tags */}
                                        {section.whs_topics && section.whs_topics.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-3">
                                            {section.whs_topics.slice(0, 4).map(topic => (
                                              <TopicTag key={topic.id} topicId={topic.id} small />
                                            ))}
                                          </div>
                                        )}

                                        {/* Feature 2: Complexity Slider + Translate Button - per-section reading level */}
                                        <div className="mb-3 flex flex-wrap items-center gap-3">
                                          <ComplexitySlider
                                            currentLevel={sectionComplexityLevels[section.id] || 'legal'}
                                            onLevelChange={(level) => handleComplexityChange(level, section)}
                                            isLoading={simplifyLoading && activeSimplifySectionId === section.id}
                                            disabled={rateLimitInfo.isLimited}
                                            t={t}
                                          />

                                          {/* Per-section Translation Button - shown only in legal view */}
                                          {(sectionComplexityLevels[section.id] || 'legal') === 'legal' && (
                                            <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                              <span className="text-sm px-2 text-gray-500 dark:text-gray-400">🌐</span>
                                              {translatedContent[section.id]?.isTyping ? (
                                                <div className="flex items-center gap-2 px-2 py-1 text-sm text-whs-orange-500">
                                                  <div className="w-3 h-3 border-2 border-whs-orange-300 border-t-whs-orange-500 rounded-full animate-spin"></div>
                                                  <span className="text-xs">{t.translation?.translating || 'Translating...'}</span>
                                                </div>
                                              ) : translatedContent[section.id]?.translatedText ? (
                                                <>
                                                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md">
                                                    {translatedContent[section.id]?.language === 'de' ? '🇩🇪' : translatedContent[section.id]?.language === 'nl' ? '🇳🇱' : '🇬🇧'} {t.translation?.translated || 'Translated'}
                                                  </span>
                                                  <button
                                                    onClick={() => setTranslatedContent(prev => ({ ...prev, [section.id]: null }))}
                                                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                    title={t.translation?.showOriginal || 'Show original'}
                                                  >
                                                    ✕
                                                  </button>
                                                </>
                                              ) : (
                                                ['de', 'nl', 'en'].filter(lang => lang !== getSourceLanguage()).map(lang => (
                                                  <button
                                                    key={lang}
                                                    onClick={() => handleTranslateSection(section, lang)}
                                                    disabled={rateLimitInfo.isLimited || translationLoading}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={rateLimitInfo.isLimited ? `${t.common?.rateLimited || 'Please wait'} (${rateLimitInfo.remainingSeconds}s)` : `${t.translation?.translateTo || 'Translate to'} ${lang === 'de' ? t.translation?.german || 'German' : lang === 'nl' ? t.translation?.dutch || 'Dutch' : t.translation?.english || 'English'}`}
                                                  >
                                                    <span>{lang === 'de' ? '🇩🇪' : lang === 'nl' ? '🇳🇱' : '🇬🇧'}</span>
                                                    <span className="hidden sm:inline">{lang === 'de' ? 'DE' : lang === 'nl' ? 'NL' : 'EN'}</span>
                                                  </button>
                                                ))
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {/* Section Content - switches based on complexity level and translation */}
                                        <div className="pl-4 border-l-2 border-gray-100 dark:border-whs-dark-700">
                                          {(sectionComplexityLevels[section.id] || 'legal') === 'legal' ? (
                                            <>
                                              {/* Show original content with translation overwriting effect */}
                                              {translatedContent[section.id]?.isTyping ? (
                                                /* Loading state while translation is being fetched */
                                                <div className="relative">
                                                  <div className="text-gray-300 dark:text-gray-600 select-none">
                                                    <FormattedText text={section.content} searchTerm={contentSearchTerm} crosslinks={whsCrosslinks} onCrosslinkClick={handleCrosslinkClick} onLawReferenceClick={handleLawReferenceClick} onLawReferenceHover={handleLawReferenceHover} onLawReferenceLeave={handleLawReferenceLeave} />
                                                  </div>
                                                  <div className="absolute inset-0 flex items-start">
                                                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 bg-white dark:bg-whs-dark-800 pr-2">
                                                      <div className="w-4 h-4 border-2 border-whs-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                                      <span>{t.translation?.translating || 'Translating...'}</span>
                                                    </div>
                                                  </div>
                                                </div>
                                              ) : translatedContent[section.id]?.translatedText ? (
                                                /* Translation complete - show overwrite effect with formatted text after */
                                                <OverwriteText
                                                  originalText={section.content}
                                                  translatedText={translatedContent[section.id].translatedText}
                                                  speed={3}
                                                  className="text-gray-800 dark:text-gray-200"
                                                  renderComplete={(text) => (
                                                    <FormattedText
                                                      text={text}
                                                      searchTerm={contentSearchTerm}
                                                      crosslinks={whsCrosslinks}
                                                      onCrosslinkClick={handleCrosslinkClick}
                                                      onLawReferenceClick={handleLawReferenceClick}
                                                      onLawReferenceHover={handleLawReferenceHover}
                                                      onLawReferenceLeave={handleLawReferenceLeave}
                                                    />
                                                  )}
                                                  renderDuring={(text) => (
                                                    <FormattedText
                                                      text={text}
                                                      searchTerm={contentSearchTerm}
                                                      crosslinks={whsCrosslinks}
                                                      onCrosslinkClick={handleCrosslinkClick}
                                                      onLawReferenceClick={handleLawReferenceClick}
                                                      onLawReferenceHover={handleLawReferenceHover}
                                                      onLawReferenceLeave={handleLawReferenceLeave}
                                                    />
                                                  )}
                                                />
                                              ) : (
                                                /* Original content when no translation */
                                                <FormattedText text={section.content} searchTerm={contentSearchTerm} crosslinks={whsCrosslinks} onCrosslinkClick={handleCrosslinkClick} onLawReferenceClick={handleLawReferenceClick} onLawReferenceHover={handleLawReferenceHover} onLawReferenceLeave={handleLawReferenceLeave} />
                                              )}
                                            </>
                                          ) : (
                                            <SimplifiedContent
                                              content={simplifiedContent[section.id]?.[sectionComplexityLevels[section.id]] || null}
                                              level={sectionComplexityLevels[section.id]}
                                              isLoading={simplifyLoading && activeSimplifySectionId === section.id}
                                              t={t}
                                              wikiArticles={
                                                sectionComplexityLevels[section.id] === 'manager' && selectedLaw?.abbreviation && wikiIndex[selectedLaw.abbreviation]
                                                  ? [{ abbr: selectedLaw.abbreviation, title: wikiIndex[selectedLaw.abbreviation]?.title || selectedLaw.abbreviation }]
                                                  : []
                                              }
                                              onWikiClick={openWikiModal}
                                            />
                                          )}
                                          {/* Show original text link when viewing simplified */}
                                          {(sectionComplexityLevels[section.id] || 'legal') !== 'legal' && simplifiedContent[section.id]?.[sectionComplexityLevels[section.id]] && (
                                            <button
                                              onClick={() => handleComplexityChange('legal', section)}
                                              className="mt-3 text-xs text-gray-500 dark:text-gray-400 hover:text-whs-orange-500 underline"
                                            >
                                              {t.complexity?.viewOriginal || 'View original legal text'}
                                            </button>
                                          )}
                                        </div>

                                        {/* Visualize Button */}
                                        <div className="mt-4 flex items-center gap-2">
                                          <button
                                            onClick={() => handleGenerateFlowchart(section)}
                                            disabled={(flowchartLoading && flowchartSectionId === section.id) || rateLimitInfo.isLimited}
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                                              flowchartSectionId === section.id && flowchartData
                                                ? 'bg-whs-orange-500 text-white'
                                                : 'bg-whs-orange-50 dark:bg-whs-orange-900/20 text-whs-orange-700 dark:text-whs-orange-300 hover:bg-whs-orange-100 dark:hover:bg-whs-orange-900/30'
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                            title={rateLimitInfo.isLimited ? `${t.common?.rateLimited || 'Please wait'} (${rateLimitInfo.remainingSeconds}s)` : (flowchartSectionId === section.id && flowchartData ? (t.common?.hideFlowchart || 'Hide Flowchart') : (t.common?.visualize || 'Visualize'))}
                                          >
                                            {flowchartLoading && flowchartSectionId === section.id ? (
                                              <>
                                                <div className="w-4 h-4 border-2 border-whs-orange-300 border-t-whs-orange-600 rounded-full animate-spin"></div>
                                                <span>{t.common?.generating || 'Generating...'}</span>
                                              </>
                                            ) : (
                                              <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                                </svg>
                                                <span>{flowchartSectionId === section.id && flowchartData ? (t.common?.hideFlowchart || 'Hide Flowchart') : (t.common?.visualize || 'Visualize')}</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </>
                                    )}

                                    {/* Flowchart Visualization */}
                                    {flowchartSectionId === section.id && flowchartData && (
                                      <div className="mt-4">
                                        <LawVisualizer
                                          chartSyntax={flowchartData}
                                          onClose={closeFlowchart}
                                          title={`${section.number}${section.title ? ` - ${section.title}` : ''}`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      ) : (
                        /* Raw text fallback */
                        <FormattedText text={getCleanLawText(selectedLaw.content?.full_text || selectedLaw.content?.text)} searchTerm={contentSearchTerm} crosslinks={whsCrosslinks} onCrosslinkClick={handleCrosslinkClick} onLawReferenceClick={handleLawReferenceClick} onLawReferenceHover={handleLawReferenceHover} onLawReferenceLeave={handleLawReferenceLeave} />
                      )}

                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
                      <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium mb-2">{t.common?.noContentAvailable || 'No content available'}</p>
                      <p className="text-sm text-center mb-4">{t.common?.noContentDescription || 'The full text for this law has not been loaded.'}</p>
                      {selectedLaw.source?.url && (
                        <a
                          href={selectedLaw.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-whs-orange-500 hover:text-whs-orange-600 flex items-center gap-2"
                        >
                          {t.common?.viewOnOfficialSource || 'View on official source'}
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
                  <div className="flex items-center gap-2">
                    {/* Supplementary Source Badge */}
                    {isSupplementarySource(selectedLaw) && (
                      <SupplementaryBadge
                        sourceType={
                          selectedLaw.abbreviation?.toLowerCase().includes('auva') ? 'merkblatt' :
                          selectedLaw.abbreviation?.toLowerCase().includes('dguv') ? 'dguv' :
                          selectedLaw.abbreviation?.toLowerCase().includes('trbs') ? 'trbs' :
                          selectedLaw.abbreviation?.toLowerCase().includes('trgs') ? 'trgs' :
                          selectedLaw.abbreviation?.toLowerCase().includes('asr') ? 'asr' :
                          selectedLaw.abbreviation?.toLowerCase().includes('pgs') ? 'pgs' :
                          'default'
                        }
                      />
                    )}

                    {/* PDF Button - opens in modal instead of new tab */}
                    {hasPdfSource(selectedLaw) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPdfModal(selectedLaw)}
                        className="flex items-center gap-1"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        View PDF
                      </Button>
                    )}

                    {/* HTML Source Button - for NL laws with local HTML files */}
                    {hasLocalHtml(selectedLaw) && !isHtmlOnlyDoc && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(getLocalHtmlUrl(selectedLaw), '_blank')}
                        className="flex items-center gap-1"
                        title="View official HTML source"
                      >
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        View Source
                      </Button>
                    )}

                    {/* External Link - open source URL */}
                    {selectedLaw.source?.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(selectedLaw.source.url, '_blank')}
                        title="Open source website"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
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

      {/* Comparison Modal */}
      {comparisonModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-whs-dark-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-whs-dark-700 bg-gradient-to-r from-whs-orange-500 to-whs-orange-600 text-white">
              <div>
                <h2 className="text-lg font-bold">
                  {comparisonModal.type === 'multi' ? '🌍 Multi-Country Comparison' : '↔️ Cross-Border Comparison'}
                </h2>
                {comparisonModal.section && (
                  <p className="text-sm text-white/80">
                    {comparisonModal.section.number} {comparisonModal.section.title && `- ${comparisonModal.section.title}`}
                  </p>
                )}
              </div>
              <button
                onClick={closeComparisonModal}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {comparisonModal.type === 'multi' ? (
                <MultiCountryComparison
                  sourceFramework={framework}
                  comparisonData={multiCountryData}
                  isLoading={multiCountryLoading}
                  error={multiCountryError}
                  onClose={closeComparisonModal}
                  onCompare={() => handleMultiCountryCompare(comparisonModal.section)}
                />
              ) : (
                <CrossBorderComparison
                  sourceFramework={framework}
                  comparisonData={crossBorderData}
                  targetFramework={crossBorderTarget}
                  isLoading={crossBorderLoading}
                  error={crossBorderError}
                  onClose={closeComparisonModal}
                  onCompare={(target) => handleCrossBorderCompare(target, comparisonModal.section)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wikipedia Modal */}
      {wikiModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-whs-dark-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-whs-dark-700 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📖</span>
                <div>
                  <h2 className="text-lg font-bold">
                    Wikipedia: {wikiIndex[wikiModal.lawAbbr]?.title || wikiModal.lawAbbr}
                  </h2>
                  {wikiIndex[wikiModal.lawAbbr]?.url && (
                    <a
                      href={wikiIndex[wikiModal.lawAbbr].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white/80 hover:text-white underline"
                    >
                      Open in Wikipedia ↗
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => setWikiModal({ open: false, lawAbbr: null })}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              {wikiLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                </div>
              ) : wikiContent ? (
                <iframe
                  srcDoc={wikiContent}
                  className="w-full h-full min-h-[60vh]"
                  title="Wikipedia Article"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                  <p>No Wikipedia article available for this law.</p>
                  <p className="text-sm mt-2">Try running the Wikipedia scraper first.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WHS Crosslink Popup */}
      {crosslinkPopup.open && crosslinkPopup.data && (
        <div
          className="crosslink-popup fixed z-50 bg-white dark:bg-whs-dark-800 rounded-lg shadow-xl border border-gray-200 dark:border-whs-dark-600 p-4 max-w-sm"
          style={{
            left: Math.min(crosslinkPopup.x, window.innerWidth - 320),
            top: Math.min(crosslinkPopup.y, window.innerHeight - 200),
            transform: 'translateX(-50%)'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-whs-orange-100 dark:bg-whs-orange-900/30 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-whs-orange-600 dark:text-whs-orange-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.451-.314.271-.615.812-.916 1.619l-4.476 11.781c-.053.209-.18.315-.376.315s-.329-.105-.4-.315l-3.04-6.476-.066-.135-3.179 6.582c-.041.209-.165.315-.369.315-.201 0-.336-.106-.406-.315l-3.156-7.098"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                {crosslinkPopup.data.title}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-3">
                {crosslinkPopup.data.summary}
              </p>
              <a
                href={crosslinkPopup.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-whs-orange-600 dark:text-whs-orange-400 hover:underline"
              >
                <span>Read on Wikipedia</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            <button
              onClick={() => setCrosslinkPopup({ open: false, term: null, data: null, x: 0, y: 0 })}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Law Reference Hover Preview Popup (for §4, Artikel 5, etc. in text) */}
      {lawRefPreview.open && lawRefPreview.section && (
        <div
          className="law-ref-preview-popup fixed z-50 bg-white dark:bg-whs-dark-800 rounded-lg shadow-2xl border border-blue-200 dark:border-blue-800 max-w-md max-h-80 overflow-hidden"
          style={{
            left: Math.min(Math.max(lawRefPreview.x, 220), window.innerWidth - 220),
            top: Math.min(lawRefPreview.y, window.innerHeight - 340),
            transform: 'translateX(-50%)'
          }}
          onMouseEnter={() => {
            // Keep popup open when mouse enters the popup itself
            if (lawRefPreviewTimeoutRef.current) {
              clearTimeout(lawRefPreviewTimeoutRef.current)
              lawRefPreviewTimeoutRef.current = null
            }
          }}
          onMouseLeave={closeLawRefPreview}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="font-bold text-sm">{lawRefPreview.section.number}</span>
              {lawRefPreview.section.title && (
                <span className="text-sm opacity-90 truncate">{lawRefPreview.section.title}</span>
              )}
            </div>
            <button
              onClick={closeLawRefPreview}
              className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content Preview */}
          <div className="p-4 overflow-y-auto max-h-96">
            {/* WHS Topics */}
            {lawRefPreview.section.whs_topics && lawRefPreview.section.whs_topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {lawRefPreview.section.whs_topics.slice(0, 3).map(topic => (
                  <span
                    key={topic.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  >
                    {WHS_TOPIC_LABELS[topic.id]?.label || topic.id}
                  </span>
                ))}
              </div>
            )}

            {/* Full paragraph content */}
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {lawRefPreview.section.content ? (
                <p className="whitespace-pre-wrap">
                  {lawRefPreview.section.content}
                </p>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">
                  {t.lawBrowser?.noContentPreview || 'No content available'}
                </p>
              )}
            </div>
          </div>

          {/* Footer - Click to navigate hint */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-whs-dark-700 border-t border-gray-100 dark:border-whs-dark-600">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              {t.lawBrowser?.clickToNavigate || 'Click to navigate to this section'}
            </p>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {pdfModal.open && (
        <PdfViewer
          url={pdfModal.url}
          title={pdfModal.title}
          isModal={true}
          onClose={closePdfModal}
        />
      )}

      {/* Copy Link Feedback Popup */}
      {copyFeedback.show && (
        <div
          className="fixed z-50 px-3 py-2 bg-green-600 text-white text-sm rounded-lg shadow-lg animate-fade-in"
          style={{ left: copyFeedback.x, top: copyFeedback.y }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            {t.lawBrowser?.linkCopied || 'Link copied!'}
          </div>
        </div>
      )}
    </div>
  )
}

export default LawBrowser

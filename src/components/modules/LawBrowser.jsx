import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Card, CardContent, LawVisualizer, ComplexitySlider, SimplifiedContent, CrossBorderComparison, MultiCountryComparison } from '../ui'
import {
  getAllLaws,
  getRelatedLaws,
  getLawCategories,
  WHS_TOPIC_LABELS,
  RELEVANCE_LEVELS
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
          className="bg-yellow-300 dark:bg-yellow-500/50 text-gray-900 dark:text-white px-0.5 rounded"
        >
          {part}
        </mark>
      )
    }
    return part
  })
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

// Format text with proper structure (paragraphs, lists, etc.)
// Handles German legal formatting where numbered items (1., 2.) belong to their parent Absatz
function formatLawText(text) {
  if (!text) return null

  const lines = text.split('\n')
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
        currentAbsatz.subItems = [...listItems]
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

    // Section headers (§ or Artikel)
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

    // Dutch "lid" format: "1. content" or "2. content" at start of line (article subsections)
    const dutchLidMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (dutchLidMatch && !line.match(/^(\d+)\.\s*Abschnitt/i)) {
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
    const numberedMatch = line.match(/^([a-z]\)|[a-z]\.|[ivxIVX]+\.)\s+(.+)/)
    if (numberedMatch) {
      flushParagraph()
      inList = true
      listItems.push({ marker: numberedMatch[1], content: numberedMatch[2] })
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

// Render formatted elements with optional search term highlighting
function FormattedText({ text, searchTerm = '' }) {
  const elements = formatLawText(text)
  if (!elements || elements.length === 0) {
    return <div className="whitespace-pre-wrap">{highlightText(text, searchTerm)}</div>
  }

  // Helper to render list items (handles both string and {marker, content} formats)
  const renderListItems = (items, isSubList = false) => (
    <ol className={`space-y-1.5 ${isSubList ? 'mt-2 ml-4 border-l-2 border-gray-300 dark:border-gray-600 pl-3' : 'list-decimal list-inside pl-4'} text-sm text-gray-700 dark:text-gray-300`}>
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
            <span>{highlightText(content, searchTerm)}</span>
          </li>
        )
      })}
    </ol>
  )

  return (
    <div className="space-y-3">
      {elements.map((el, idx) => {
        switch (el.type) {
          case 'section':
            return (
              <h4 key={idx} className="text-base font-semibold text-whs-orange-600 dark:text-whs-orange-400 mt-5 first:mt-0">
                {highlightText(el.content, searchTerm)}
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
                    {highlightText(el.content, searchTerm)}
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
                {highlightText(el.content, searchTerm)}
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

export function LawBrowser({ onBack }) {
  const { t, framework, isBookmarked, toggleBookmark, addRecentSearch } = useApp()
  const { generateFlowchart, simplifyForBothLevels, findEquivalentLaw, compareMultipleCountries, isLoading: aiLoading } = useAI()

  // Debounce refs to prevent duplicate API calls
  const pendingSimplifyRef = useRef({}) // Track pending simplification requests by sectionId

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLaw, setSelectedLaw] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [activeSection, setActiveSection] = useState(null)
  const [searchInLaw, setSearchInLaw] = useState('') // Section number/title filter
  const [contentSearchTerm, setContentSearchTerm] = useState('') // Full text content search
  const [relevanceFilter, setRelevanceFilter] = useState('all') // all, critical, high, medium, low
  const [isLoading, setIsLoading] = useState(false)
  const [prevFramework, setPrevFramework] = useState(framework)

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
  const [wikiContent, setWikiContent] = useState(null) // HTML content for modal
  const [wikiLoading, setWikiLoading] = useState(false)

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

  // Load Wikipedia index for current framework
  useEffect(() => {
    async function loadWikiIndex() {
      try {
        const countryCode = framework.toLowerCase()
        const response = await fetch(`/eu_safety_laws/${countryCode}/wikipedia/wiki_index.json`)
        if (response.ok) {
          const data = await response.json()
          setWikiIndex(data.articles || {})
        }
      } catch (e) {
        // Wikipedia index not available - not an error
        setWikiIndex({})
      }
    }
    loadWikiIndex()
  }, [framework])

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
  // Uses direct text search similar to right column content search
  const { filteredLaws, pagination } = useMemo(() => {
    let results = allLaws

    // Filter by category first
    if (selectedCategory !== 'all') {
      results = results.filter(law => law.type === selectedCategory)
    }

    // Apply full text search - similar approach to right column search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      results = results.filter(law => {
        // Search in law title
        if (law.title?.toLowerCase().includes(term)) return true
        // Search in English title
        if (law.title_en?.toLowerCase().includes(term)) return true
        // Search in abbreviation
        if (law.abbreviation?.toLowerCase().includes(term)) return true
        // Search in description
        if (law.description?.toLowerCase().includes(term)) return true
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
  }, [allLaws, searchTerm, selectedCategory, currentPage, pageSize])

  // Helper function to extract section title from text content when database title is incomplete
  const extractTitleFromText = (text, sectionNumber) => {
    if (!text) return ''

    // Try to find the title from the text content
    // Pattern 1: "§ X. Title" or "§ X Title" at the beginning
    const numberPattern = sectionNumber.replace(/[§\s.]/g, '').replace(/([a-z])/i, '$1?')
    const patterns = [
      // "Geltungsbereich\n§ 1." - title before section number
      new RegExp(`^([A-ZÄÖÜ][a-zäöüß]+(?:\\s+[A-Za-zäöüßÄÖÜ]+)*)\\s*\\n\\s*§\\s*${numberPattern}`, 'im'),
      // "§ 1. Geltungsbereich" - title after section number on same line
      new RegExp(`§\\s*${numberPattern}\\.?\\s+([A-ZÄÖÜ][^\\n]{3,50})`, 'im'),
      // ABSCHNITT N\nTitle - look for title after ABSCHNITT header
      /ABSCHNITT\s+\d+[a-z]?\s*\n([A-ZÄÖÜ][^\n]{3,50})/im
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        let title = match[1].trim()
        // Clean up - remove section number patterns and parenthetical starts
        title = title.replace(/^\(?\d+\)?\s*/, '').trim()
        title = title.replace(/^§\s*\d+[a-z]?\.?\s*/i, '').trim()
        if (title && title.length > 2 && title.length < 100) {
          return title
        }
      }
    }
    return ''
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
            let sectionTitle = section.title?.replace(/^(§\s*\d+[a-z]?\.?|Artikel\s*\d+\.?)\s*/i, '').trim() || ''

            // If title is empty or just whitespace, try to extract from text content
            if (!sectionTitle && section.text) {
              sectionTitle = extractTitleFromText(section.text, section.number)
            }

            sections.push({
              id: section.id,
              number: section.number?.startsWith('§') || section.number?.startsWith('Artikel')
                ? section.number
                : (framework === 'NL' ? `Artikel ${section.number}` : `§ ${section.number}`),
              title: sectionTitle,
              content: section.text || '',
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

    // Filter by section number/title (section sidebar filter)
    if (searchInLaw.trim()) {
      const term = searchInLaw.toLowerCase()
      filtered = filtered.filter(s =>
        s.number.toLowerCase().includes(term) ||
        s.title.toLowerCase().includes(term)
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

  // Get related laws
  const relatedLaws = useMemo(() => {
    if (!selectedLaw) return []
    return getRelatedLaws(framework, selectedLaw.id, 5)
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
      const sectionTitle = `${section.number}${section.title ? ` - ${section.title}` : ''}`

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

  // Select a law
  const selectLaw = (law) => {
    setSelectedLaw(law)
    setActiveSection(null)
    setSearchInLaw('')
    setContentSearchTerm('')
    // Reset flowchart state
    setFlowchartData(null)
    setFlowchartSectionId(null)
    // Reset complexity slider state - per-section
    setSectionComplexityLevels({})
    setSimplifiedContent({})
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
                    {wikiIndex[law.abbreviation] && (
                      <span className="text-xs" title="Wikipedia article available">📖</span>
                    )}
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
          <div className="w-64 flex-shrink-0">
            <Card className="h-full overflow-hidden">
              <div className="p-3 border-b border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {t.sections?.title || 'Sections'} ({filteredSections.length}/{lawSections.length})
                </h3>
                <input
                  type="text"
                  value={searchInLaw}
                  onChange={(e) => setSearchInLaw(e.target.value)}
                  placeholder={t.common?.filterBySection || "Filter by section number/title..."}
                  className="mt-2 w-full px-2 py-1 text-sm bg-white dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-whs-orange-500"
                />
                {/* Relevance Filter */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {['all', 'critical', 'high', 'medium'].map(level => (
                    <button
                      key={level}
                      onClick={() => setRelevanceFilter(level)}
                      className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                        relevanceFilter === level
                          ? 'bg-whs-orange-500 text-white'
                          : level === 'all'
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
                            : `${RELEVANCE_LEVELS[level]?.bgColor || ''} ${RELEVANCE_LEVELS[level]?.textColor || ''} hover:opacity-80`
                      }`}
                    >
                      {level === 'all' ? (t.common?.all || 'All') : RELEVANCE_LEVELS[level]?.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-y-auto h-[calc(100%-120px)]">
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
                    const chapterTitle = abschnitt?.displayName || abschnitt?.title || `${chapterKey}. Abschnitt`

                    return (
                      <div key={chapterKey} className="border-b border-gray-200 dark:border-whs-dark-600">
                        {/* Chapter Header - Clickable to expand/collapse */}
                        <button
                          onClick={() => toggleChapter(chapterKey)}
                          className="w-full px-3 py-2 bg-gray-100 dark:bg-whs-dark-700 text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-whs-dark-600 transition-colors sticky top-0 z-10"
                          title={chapterTitle}
                        >
                          <svg
                            className={`w-4 h-4 flex-shrink-0 transition-transform ${isChapterExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="flex-1 text-left line-clamp-2">{chapterTitle}</span>
                          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">({sections.length})</span>
                        </button>

                        {/* Sections within chapter - only shown when expanded */}
                        {isChapterExpanded && sections.map((section) => {
                          const relevanceLevel = section.amazon_logistics_relevance?.level
                          const relevanceColor = relevanceLevel === 'critical' ? 'border-l-red-500' :
                            relevanceLevel === 'high' ? 'border-l-orange-500' :
                            relevanceLevel === 'medium' ? 'border-l-yellow-500' : 'border-l-transparent'

                          return (
                            <div key={section.id} className={`border-b border-gray-50 dark:border-whs-dark-800 border-l-4 ${relevanceColor}`}>
                              <button
                                onClick={() => scrollToSection(section.id)}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                  activeSection === section.id
                                    ? 'bg-whs-orange-50 dark:bg-whs-orange-900/20 text-whs-orange-700 dark:text-whs-orange-300'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-whs-dark-800'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-whs-orange-500">{section.number}</span>
                                  {section.whs_topics && section.whs_topics.length > 0 && (
                                    <span className="text-xs opacity-60">
                                      {WHS_TOPIC_LABELS[section.whs_topics[0]?.id]?.icon || ''}
                                    </span>
                                  )}
                                </div>
                                {section.title && (
                                  <div className="text-xs line-clamp-2 mt-0.5 opacity-75" title={section.title}>{highlightText(section.title, searchInLaw)}</div>
                                )}
                              </button>
                              {/* Compare buttons for each section */}
                              <div className="flex items-center gap-1 px-2 pb-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openComparisonModal('multi', section)
                                  }}
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                                  title={t.common?.compareAllCountries || "Compare this section across all 3 countries"}
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
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                                  title={t.common?.compareTwoCountries || "Compare this section with another country"}
                                >
                                  <span>↔️</span>
                                  <span>{t.common?.compare || 'Compare'}</span>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                })()}
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
                        {getShortenedLawName(selectedLaw)}
                      </h3>
                      {selectedLaw.title_en && (
                        <p className="text-white/80 text-sm mt-1">{selectedLaw.title_en}</p>
                      )}
                      {/* Wikipedia article link shown inline with title */}
                      {wikiIndex[selectedLaw.abbreviation] && (
                        <button
                          onClick={() => openWikiModal(selectedLaw.abbreviation)}
                          className="inline-flex items-center gap-1 mt-1 text-white/70 hover:text-white text-xs transition-colors"
                        >
                          <span>📖</span>
                          <span className="underline">
                            {wikiIndex[selectedLaw.abbreviation]?.title || 'Wikipedia article'}
                          </span>
                        </button>
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
                          title="View official source"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                      {wikiIndex[selectedLaw.abbreviation] && (
                        <button
                          onClick={() => openWikiModal(selectedLaw.abbreviation)}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
                          title={`Wikipedia: ${wikiIndex[selectedLaw.abbreviation]?.title || selectedLaw.abbreviation}`}
                        >
                          <span className="text-base">📖</span>
                          <span className="text-sm font-medium hidden sm:inline truncate max-w-[150px]">
                            {wikiIndex[selectedLaw.abbreviation]?.title || 'Wikipedia'}
                          </span>
                          <span className="text-sm font-medium sm:hidden">Wiki</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Full Text Search in Law */}
                {hasContent && lawSections.length > 0 && (
                  <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={contentSearchTerm}
                        onChange={(e) => setContentSearchTerm(e.target.value)}
                        placeholder={t.common?.fullTextSearch || "Full text search in this law..."}
                        className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whs-orange-500 focus:border-transparent"
                      />
                      {contentSearchTerm && (
                        <button
                          onClick={() => setContentSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {contentSearchTerm && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Found {filteredSections.length} matching section{filteredSections.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                {/* Law Content */}
                <div ref={contentRef} className="flex-1 overflow-y-auto">
                  {hasContent ? (
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
                                        {section.abschnitt.displayName || `${section.abschnitt.number}. Abschnitt`}
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
                                  >
                                    {/* Section Header with WHS Relevance - Clickable to expand/collapse */}
                                    <div className="flex items-start gap-2 mb-2 pb-2 border-b border-whs-orange-200 dark:border-whs-orange-800">
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

                                        {/* Feature 2: Complexity Slider - per-section reading level */}
                                        <div className="mb-3">
                                          <ComplexitySlider
                                            currentLevel={sectionComplexityLevels[section.id] || 'legal'}
                                            onLevelChange={(level) => handleComplexityChange(level, section)}
                                            isLoading={simplifyLoading && activeSimplifySectionId === section.id}
                                            t={t}
                                          />
                                        </div>

                                        {/* Section Content - switches based on this section's complexity level */}
                                        <div className="pl-4 border-l-2 border-gray-100 dark:border-whs-dark-700">
                                          {(sectionComplexityLevels[section.id] || 'legal') === 'legal' ? (
                                            <FormattedText text={section.content} searchTerm={contentSearchTerm} />
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
                                            disabled={flowchartLoading && flowchartSectionId === section.id}
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                                              flowchartSectionId === section.id && flowchartData
                                                ? 'bg-whs-orange-500 text-white'
                                                : 'bg-whs-orange-50 dark:bg-whs-orange-900/20 text-whs-orange-700 dark:text-whs-orange-300 hover:bg-whs-orange-100 dark:hover:bg-whs-orange-900/30'
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                          >
                                            {flowchartLoading && flowchartSectionId === section.id ? (
                                              <>
                                                <div className="w-4 h-4 border-2 border-whs-orange-300 border-t-whs-orange-600 rounded-full animate-spin"></div>
                                                <span>Generating...</span>
                                              </>
                                            ) : (
                                              <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                                </svg>
                                                <span>{flowchartSectionId === section.id && flowchartData ? 'Hide Flowchart' : 'Visualize'}</span>
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
                        <FormattedText text={getCleanLawText(selectedLaw.content?.full_text || selectedLaw.content?.text)} searchTerm={contentSearchTerm} />
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
    </div>
  )
}

export default LawBrowser

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
  formatLawReference,
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

export function LawBrowser({ onBack }) {
  const { t, framework, isBookmarked, toggleBookmark, addRecentSearch } = useApp()
  const { explainSection, isLoading: aiLoading } = useAI()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLaw, setSelectedLaw] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [explanation, setExplanation] = useState('')
  const [activeSection, setActiveSection] = useState(null)
  const [searchInLaw, setSearchInLaw] = useState('')
  const [relevanceFilter, setRelevanceFilter] = useState('all') // all, critical, high, medium, low
  const [isLoading, setIsLoading] = useState(false)
  const [prevFramework, setPrevFramework] = useState(framework)
  const [expandedSections, setExpandedSections] = useState(new Set()) // Sections collapsed by default

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

  // Parse sections for selected law - use pre-parsed chapters if available
  const lawSections = useMemo(() => {
    if (!selectedLaw) return []

    // Check if we have pre-parsed chapters from the scraper
    if (selectedLaw.chapters && selectedLaw.chapters.length > 0) {
      const sections = []
      for (const chapter of selectedLaw.chapters) {
        if (chapter.sections) {
          for (const section of chapter.sections) {
            sections.push({
              id: section.id,
              number: section.number?.startsWith('§') || section.number?.startsWith('Artikel')
                ? section.number
                : (framework === 'NL' ? `Artikel ${section.number}` : `§ ${section.number}`),
              title: section.title?.replace(/^(§\s*\d+[a-z]?\.?|Artikel\s*\d+\.?)\s*/i, '').trim() || '',
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

    // Filter by search term
    if (searchInLaw.trim()) {
      const term = searchInLaw.toLowerCase()
      filtered = filtered.filter(s =>
        s.number.toLowerCase().includes(term) ||
        s.title.toLowerCase().includes(term) ||
        s.content.toLowerCase().includes(term)
      )
    }

    return filtered
  }, [lawSections, searchInLaw, relevanceFilter])

  // Get related laws
  const relatedLaws = useMemo(() => {
    if (!selectedLaw) return []
    return getRelatedLaws(framework, selectedLaw.id, 5)
  }, [selectedLaw, framework])

  // Reset expanded sections when law changes
  useEffect(() => {
    setExpandedSections(new Set())
  }, [selectedLaw?.id])

  // Toggle section expansion
  const toggleSection = useCallback((sectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }, [])

  // Expand all sections
  const expandAllSections = useCallback(() => {
    setExpandedSections(new Set(filteredSections.map(s => s.id)))
  }, [filteredSections])

  // Collapse all sections
  const collapseAllSections = useCallback(() => {
    setExpandedSections(new Set())
  }, [])

  // Scroll to section
  const scrollToSection = useCallback((sectionId) => {
    const element = sectionRefs.current[sectionId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(sectionId)
      // Also expand the section when scrolling to it
      setExpandedSections(prev => new Set(prev).add(sectionId))
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
          <div className="w-64 flex-shrink-0">
            <Card className="h-full overflow-hidden">
              <div className="p-3 border-b border-gray-100 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-800">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Sections ({filteredSections.length}/{lawSections.length})
                </h3>
                <input
                  type="text"
                  value={searchInLaw}
                  onChange={(e) => setSearchInLaw(e.target.value)}
                  placeholder="Search sections..."
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
                      {level === 'all' ? 'All' : RELEVANCE_LEVELS[level]?.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-y-auto h-[calc(100%-120px)]">
                {(() => {
                  let currentAbschnitt = null
                  return filteredSections.map((section) => {
                    const abschnittHeader = section.abschnitt && section.abschnitt.number !== currentAbschnitt?.number
                      ? (currentAbschnitt = section.abschnitt, section.abschnitt)
                      : null

                    const relevanceLevel = section.amazon_logistics_relevance?.level
                    const relevanceColor = relevanceLevel === 'critical' ? 'border-l-red-500' :
                      relevanceLevel === 'high' ? 'border-l-orange-500' :
                      relevanceLevel === 'medium' ? 'border-l-yellow-500' : 'border-l-transparent'

                    return (
                      <div key={section.id}>
                        {abschnittHeader && (
                          <div className="px-3 py-2 bg-gray-100 dark:bg-whs-dark-700 text-xs font-bold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-whs-dark-600 sticky top-0">
                            {abschnittHeader.displayName || `${abschnittHeader.number}. Abschnitt`}
                          </div>
                        )}
                        <button
                          onClick={() => scrollToSection(section.id)}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-gray-50 dark:border-whs-dark-800 border-l-4 ${relevanceColor} ${
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
                            <div className="text-xs line-clamp-1 mt-0.5 opacity-75">{section.title}</div>
                          )}
                        </button>
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
                        <div className="space-y-4">
                          {/* Expand/Collapse All buttons */}
                          <div className="flex justify-end gap-2 mb-4">
                            <button
                              onClick={expandAllSections}
                              className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-whs-orange-500 dark:hover:text-whs-orange-400 transition-colors"
                            >
                              Expand All
                            </button>
                            <button
                              onClick={collapseAllSections}
                              className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-whs-orange-500 dark:hover:text-whs-orange-400 transition-colors"
                            >
                              Collapse All
                            </button>
                          </div>
                          {(() => {
                            let currentAbschnitt = null
                            return filteredSections.map((section) => {
                              const showAbschnittHeader = section.abschnitt && section.abschnitt.number !== currentAbschnitt?.number
                              if (showAbschnittHeader) {
                                currentAbschnitt = section.abschnitt
                              }
                              const isExpanded = expandedSections.has(section.id)

                              return (
                                <div key={section.id}>
                                  {showAbschnittHeader && section.abschnitt && (
                                    <div className="mb-4 mt-6 first:mt-0 p-4 bg-gradient-to-r from-whs-orange-50 to-transparent dark:from-whs-orange-900/20 dark:to-transparent rounded-lg border-l-4 border-whs-orange-500">
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
                                    className="scroll-mt-4 border border-gray-200 dark:border-whs-dark-700 rounded-lg overflow-hidden"
                                  >
                                    {/* Collapsible Section Header */}
                                    <button
                                      onClick={() => toggleSection(section.id)}
                                      className="w-full flex flex-col md:flex-row md:items-center gap-2 p-3 bg-gray-50 dark:bg-whs-dark-800 hover:bg-gray-100 dark:hover:bg-whs-dark-700 transition-colors text-left"
                                    >
                                      <div className="flex items-center gap-3 flex-1">
                                        <svg
                                          className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        <span className="text-xl font-bold text-whs-orange-500">
                                          {section.number}
                                        </span>
                                        {section.title && (
                                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                            {section.title}
                                          </h3>
                                        )}
                                      </div>
                                      {/* WHS Relevance Badge */}
                                      {section.amazon_logistics_relevance && (
                                        <RelevanceBadge level={section.amazon_logistics_relevance.level} />
                                      )}
                                    </button>

                                    {/* Expandable Content */}
                                    {isExpanded && (
                                      <div className="p-4 border-t border-gray-200 dark:border-whs-dark-700">
                                        {/* WHS Topics Tags */}
                                        {section.whs_topics && section.whs_topics.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-3">
                                            {section.whs_topics.slice(0, 4).map(topic => (
                                              <TopicTag key={topic.id} topicId={topic.id} small />
                                            ))}
                                          </div>
                                        )}

                                        {/* Section Content */}
                                        <div className="pl-4 border-l-2 border-gray-100 dark:border-whs-dark-700">
                                          <FormattedText text={section.content} />
                                        </div>
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

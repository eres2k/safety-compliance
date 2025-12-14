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
// The RIS format has:
// "§ 1\nText\n1. Abschnitt\nAllgemeine Bestimmungen\nGeltungsbereich\n§ 1.\nParagraph eins,\n(1)\nAbsatz eins\nActual content..."
function preprocessAustrianText(text) {
  if (!text) return ''

  let result = text

  // Remove standalone expanded notation lines
  result = result.replace(/^\s*Paragraph\s+[\wäöü\s]+,?\s*$/gim, '')
  result = result.replace(/^\s*Absatz\s+[\wäöü\s]+\s*$/gim, '')
  result = result.replace(/^\s*Ziffer\s+[\wäöü\s]+\s*$/gim, '')
  result = result.replace(/^\s*Litera\s+[a-z]\s*$/gim, '')
  result = result.replace(/^\s*Sub-Litera[,\s]+[a-z][,\s]+[a-z]\s*$/gim, '')
  result = result.replace(/^\s*Anmerkung,.*$/gim, '')

  // Remove "BGBl. römisch eins" expanded form
  result = result.replace(/BGBl\.\s*römisch\s+eins/gi, 'BGBl. I')

  // Process line by line to remove duplicate expanded content
  const lines = result.split('\n')
  const cleanedLines = []
  const seenContent = new Map() // Map normalized content to line index

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Skip lines that are just expanded notation markers
    if (/^(Paragraph|Absatz|Ziffer|Litera|Sub-Litera|Anmerkung)[,\s]/i.test(trimmedLine)) {
      continue
    }

    // Check if this line is a duplicate with expanded notation
    // Lines with "Bundesgesetzblatt" are expanded versions of "BGBl." lines
    if (trimmedLine.includes('Bundesgesetzblatt') || trimmedLine.includes('römisch')) {
      // Normalize: convert expanded form to abbreviated for comparison
      const normalized = trimmedLine
        .replace(/Bundesgesetzblatt\s+Teil\s+eins,?\s*/gi, 'BGBl. I ')
        .replace(/Bundesgesetzblatt\s+Teil\s+zwei,?\s*/gi, 'BGBl. II ')
        .replace(/Bundesgesetzblatt\s+Nr\.\s*/gi, 'BGBl. Nr. ')
        .replace(/,\s*Nr\.\s*(\d+)\s+aus\s+(\d+),?/gi, ' Nr. $1/$2')
        .replace(/\s+aus\s+(\d+),?/gi, '/$1')
        .replace(/römisch\s+eins/gi, 'I')
        .replace(/Paragraph\s+\d+[a-z]?,?\s*/gi, '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim()

      // Check if we've seen similar content
      let isDuplicate = false
      for (const [seenNorm] of seenContent) {
        // Check for substantial overlap
        if (seenNorm.length > 30 && normalized.length > 30) {
          const shorter = seenNorm.length < normalized.length ? seenNorm : normalized
          const longer = seenNorm.length < normalized.length ? normalized : seenNorm
          if (longer.includes(shorter.substring(0, 30))) {
            isDuplicate = true
            break
          }
        }
      }
      if (isDuplicate) continue
    }

    // Track content for duplicate detection
    const normalizedForTracking = trimmedLine.toLowerCase().replace(/\s+/g, ' ').trim()
    if (normalizedForTracking.length > 30) {
      seenContent.set(normalizedForTracking, i)
    }

    cleanedLines.push(line)
  }

  result = cleanedLines.join('\n')

  // Clean multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

// Pre-process Dutch (NL) law text to remove boilerplate
function preprocessDutchText(text) {
  if (!text) return ''

  let result = text

  // Remove Dutch legal database boilerplate lines
  const boilerplatePatterns = [
    /^\s*Toon relaties in LiDO\s*$/gim,
    /^\s*Maak een permanente link\s*$/gim,
    /^\s*Toon wetstechnische informatie\s*$/gim,
    /^\s*\.\.\.\s*$/gim,
    /^\s*Druk het regelingonderdeel af\s*$/gim,
    /^\s*Sla het regelingonderdeel op\s*$/gim,
    /^\s*\[Wijziging\(en\)[^\]]*\]\s*$/gim,
    /^\s*wijzigingenoverzicht\s*$/gim,
  ]

  for (const pattern of boilerplatePatterns) {
    result = result.replace(pattern, '')
  }

  // Clean multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

// Detect country from text patterns
function detectCountry(text) {
  if (!text) return 'unknown'

  // Austrian patterns - check for RIS specific markers
  if (/§\s*\d+\s*\n\s*Text\s*\n/i.test(text)) {
    return 'AT'
  }

  // Dutch patterns
  if (text.includes('Toon relaties in LiDO') || text.includes('regelingonderdeel') || /Artikel\s+\d+[a-z]?\.\s+/i.test(text)) {
    return 'NL'
  }

  // German patterns - plain text with § but no "Text" marker
  if (/^\s*§\s*\d+[a-z]?\s+[A-Z]/m.test(text) || (text.includes('Absatz') && !text.includes('Bundesgesetzblatt'))) {
    return 'DE'
  }

  // Check for Austrian expanded notation
  if (text.includes('Bundesgesetzblatt') || text.includes('BGBl.')) {
    return 'AT'
  }

  return 'unknown'
}

// Parse law text into sections based on country-specific patterns
function parseLawSections(text, framework) {
  if (!text) return []

  const country = framework || detectCountry(text)

  if (country === 'NL') {
    return parseDutchLawSections(text)
  }

  if (country === 'DE') {
    return parseGermanLawSections(text)
  }

  // Default: Austrian parsing
  return parseAustrianLawSections(text)
}

// Parse German law sections (simpler format without "Text" markers)
function parseGermanLawSections(text) {
  if (!text) return []

  const sections = []

  // German laws use "§ X Title" format directly
  // Match § followed by number and title on same or next line
  const sectionRegex = /§\s*(\d+[a-z]?)\s+([A-ZÄÖÜ][^\n]*?)(?=\n|$)/g
  let match
  const sectionMatches = []

  while ((match = sectionRegex.exec(text)) !== null) {
    sectionMatches.push({
      number: match[1],
      title: match[2].trim(),
      index: match.index,
      headerEnd: match.index + match[0].length
    })
  }

  // If no matches with title, try just § X pattern
  if (sectionMatches.length === 0) {
    const simpleRegex = /§\s*(\d+[a-z]?)/g
    while ((match = simpleRegex.exec(text)) !== null) {
      sectionMatches.push({
        number: match[1],
        title: '',
        index: match.index,
        headerEnd: match.index + match[0].length
      })
    }
  }

  // Process each section
  for (let i = 0; i < sectionMatches.length; i++) {
    const section = sectionMatches[i]
    const contentStart = section.headerEnd
    const contentEnd = i < sectionMatches.length - 1
      ? sectionMatches[i + 1].index
      : text.length

    let content = text.substring(contentStart, contentEnd).trim()

    // Extract title from first line if not already captured
    let title = section.title
    if (!title && content) {
      const firstLine = content.split('\n')[0].trim()
      if (firstLine && firstLine.length < 100 && !/^\(\d+\)/.test(firstLine)) {
        title = firstLine
        content = content.substring(firstLine.length).trim()
      }
    }

    sections.push({
      id: `section-${section.number}`,
      number: `§ ${section.number}`,
      title: title.substring(0, 100),
      content: content,
      rawNumber: section.number,
      isChapter: false
    })
  }

  return sections
}

// Parse Dutch law sections
function parseDutchLawSections(text) {
  if (!text) return []

  const cleanedText = preprocessDutchText(text)
  const sections = []

  // Match "Artikel X. Title" or "Artikel Xa. Title" patterns
  const sectionRegex = /Artikel\s+(\d+[a-z]?)\.\s+([^\n]+)/gi
  let match
  const sectionMatches = []

  while ((match = sectionRegex.exec(cleanedText)) !== null) {
    sectionMatches.push({
      number: match[1],
      title: match[2].trim(),
      index: match.index,
      headerEnd: match.index + match[0].length
    })
  }

  // Process each section
  for (let i = 0; i < sectionMatches.length; i++) {
    const section = sectionMatches[i]
    const contentStart = section.headerEnd
    const contentEnd = i < sectionMatches.length - 1
      ? sectionMatches[i + 1].index
      : cleanedText.length

    let content = cleanedText.substring(contentStart, contentEnd).trim()

    // Remove remaining boilerplate at start of content
    content = content.replace(/^[\s\n]*(?:Toon relaties|Maak een|Druk het|Sla het)[^\n]*\n*/gi, '')

    sections.push({
      id: `section-${section.number}`,
      number: `Art. ${section.number}`,
      title: section.title.substring(0, 100),
      content: content,
      rawNumber: section.number,
      isChapter: false
    })
  }

  return sections
}

// Parse Austrian/German law sections
function parseAustrianLawSections(text) {
  if (!text) return []

  // First pre-process to remove expanded notation
  const cleanedText = preprocessAustrianText(text)

  const sections = []
  const chapters = new Map()

  // Find the start of actual content
  const contentStart = cleanedText.search(/(?:§\s*[01]|Art\.?\s*[01])\s*\n\s*(?:Langtitel|Text)/i)
  if (contentStart === -1) {
    const fallbackStart = cleanedText.search(/(?:§|Art\.?)\s*\d+[a-z]?\s*\n\s*Text\s*\n/i)
    if (fallbackStart === -1) return []
  }

  const contentText = contentStart !== -1 ? cleanedText.substring(contentStart) : cleanedText

  // Match sections by "§ X\nText\n" or "Art. X\nText\n" pattern
  const sectionRegex = /(?:§|Art\.?)\s*(\d+[a-z]?)\s*\n\s*Text\s*\n/gi
  const sectionMatches = []
  let match

  while ((match = sectionRegex.exec(contentText)) !== null) {
    const isArticle = match[0].toLowerCase().startsWith('art')
    sectionMatches.push({
      number: match[1],
      index: match.index,
      headerEnd: match.index + match[0].length,
      prefix: isArticle ? 'Art.' : '§'
    })
  }

  // Process each section
  for (let i = 0; i < sectionMatches.length; i++) {
    const section = sectionMatches[i]
    const contentStart = section.headerEnd
    const contentEnd = i < sectionMatches.length - 1
      ? sectionMatches[i + 1].index
      : contentText.length

    let sectionContent = contentText.substring(contentStart, contentEnd).trim()
    let title = ''
    let chapterInfo = null

    // Check if section starts with a chapter header
    // Handle both formats: "1. Abschnitt\nTitle" and "ABSCHNITT 1\nTitle"
    let chapterMatch = sectionContent.match(/^(\d+)\.\s*(Abschnitt|Hauptstück|Teil)[:\s]*\n([^\n]+)\n/i)
    if (!chapterMatch) {
      // Try uppercase format: "ABSCHNITT 1\nTitle"
      chapterMatch = sectionContent.match(/^(ABSCHNITT|HAUPTSTÜCK|TEIL)\s+(\d+)[:\s]*\n([^\n]+)\n/i)
      if (chapterMatch) {
        // Swap the groups to normalize - number should be first
        chapterMatch = [chapterMatch[0], chapterMatch[2], chapterMatch[1], chapterMatch[3]]
      }
    }
    if (chapterMatch) {
      chapterInfo = {
        number: chapterMatch[1],
        title: chapterMatch[3].trim()
      }
      chapters.set(chapterMatch[1], chapterInfo.title)
      sectionContent = sectionContent.substring(chapterMatch[0].length).trim()
    }

    // Extract section title
    const lines = sectionContent.split('\n')
    let titleLineIndex = 0

    for (let j = 0; j < Math.min(5, lines.length); j++) {
      const line = lines[j].trim()
      if (line && !line.match(/^(?:§|Art\.?)\s*\d+[a-z]?\.?\s*$/) && !line.match(/^\(\d+\)$/)) {
        title = line
        titleLineIndex = j
        break
      }
    }

    let actualContent = lines.slice(titleLineIndex + 1).join('\n').trim()
    actualContent = actualContent.replace(/^(?:§|Art\.?)\s*\d+[a-z]?\.?\s*\n?/i, '').trim()

    // Add chapter entry (without "Abschnitt" word - just number and title)
    if (chapterInfo) {
      sections.push({
        id: `chapter-${chapterInfo.number}`,
        number: chapterInfo.number,
        title: chapterInfo.title,
        content: '',
        rawNumber: `0.${chapterInfo.number}`,
        isChapter: true,
        sectionIndex: i
      })
    }

    sections.push({
      id: `section-${section.number}`,
      number: `${section.prefix} ${section.number}`,
      title: title.substring(0, 100),
      content: actualContent,
      rawNumber: section.number,
      isChapter: false,
      chapterNumber: chapterInfo?.number,
      sectionIndex: i
    })
  }

  return sections
}

// Skip boilerplate and get clean text
function getCleanLawText(text) {
  if (!text) return ''

  // Pre-process Austrian format
  const cleanedText = preprocessAustrianText(text)

  // Find where real content starts (§ 0 or § 1 with Text marker)
  const contentStart = cleanedText.search(/§\s*[01]\s*\n\s*(?:Langtitel|Text)/i)
  if (contentStart !== -1) {
    return cleanedText.substring(contentStart)
  }

  // Fallback: find first section marker
  const markers = [
    /§\s*1[.\s\n]/i,
    /1\.\s*Abschnitt/i,
    /Allgemeine Bestimmungen/i,
  ]

  for (const marker of markers) {
    const match = cleanedText.match(marker)
    if (match && match.index < cleanedText.length * 0.4) {
      return cleanedText.substring(match.index)
    }
  }

  return cleanedText
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
  const [collapsedChapters, setCollapsedChapters] = useState(new Set())

  const contentRef = useRef(null)
  const sectionRefs = useRef({})

  // Toggle chapter collapse
  const toggleChapter = useCallback((chapterNumber) => {
    setCollapsedChapters(prev => {
      const next = new Set(prev)
      if (next.has(chapterNumber)) {
        next.delete(chapterNumber)
      } else {
        next.add(chapterNumber)
      }
      return next
    })
  }, [])

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
    const text = selectedLaw.full_text || selectedLaw.content?.full_text || selectedLaw.content?.text || ''
    return parseLawSections(text, framework)
  }, [selectedLaw, framework])

  // Group sections by chapter for collapsible display
  const groupedSections = useMemo(() => {
    const groups = []
    let currentChapter = null

    for (const section of lawSections) {
      if (section.isChapter) {
        currentChapter = {
          chapter: section,
          sections: []
        }
        groups.push(currentChapter)
      } else if (currentChapter) {
        currentChapter.sections.push(section)
      } else {
        // Section without chapter
        groups.push({ chapter: null, sections: [section] })
      }
    }

    return groups
  }, [lawSections])

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
          <div className="w-64 flex-shrink-0">
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
                {groupedSections.map((group, groupIdx) => (
                  <div key={groupIdx}>
                    {/* Chapter header with collapse toggle */}
                    {group.chapter && (
                      <button
                        onClick={() => toggleChapter(group.chapter.number)}
                        className="w-full text-left px-3 py-2.5 text-sm font-semibold bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">{group.chapter.number}.</span>
                          <span className="text-gray-800 dark:text-gray-200 truncate">{group.chapter.title}</span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-blue-500 flex-shrink-0 transition-transform ${collapsedChapters.has(group.chapter.number) ? '' : 'rotate-180'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                    {/* Sections in this chapter (collapsible) */}
                    {(!group.chapter || !collapsedChapters.has(group.chapter.number)) && group.sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-gray-50 dark:border-whs-dark-800 ${
                          group.chapter ? 'pl-5' : ''
                        } ${
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
                                /* Chapter header - styled as a divider */
                                <div className="mt-8 mb-4 py-3 px-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                                  <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                    {section.number}. {section.title}
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

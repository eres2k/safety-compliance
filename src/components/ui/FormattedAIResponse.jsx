import React from 'react'

/**
 * FormattedAIResponse - Renders AI responses with proper formatting
 * Handles:
 * - Emoji section headers
 * - Bullet points (- or •)
 * - Numbered lists
 * - Bold text (**text** or __text__)
 * - Proper paragraph spacing
 * - Clickable law references
 */

// Common law abbreviations for detection
const LAW_ABBREVIATIONS = [
  // Austrian
  'ASchG', 'ArbIG', 'AZG', 'KSchG', 'ARG', 'KJBG', 'MSchG', 'GlBG', 'AVRAG', 'BauKG',
  'AM-VO', 'AStV', 'AMVO', 'VGÜ', 'ESV', 'PSA-V', 'BS', 'BauV', 'DOK-VO', 'AAV',
  'AUVA', 'Merkblatt',
  // German
  'DGUV', 'ArbSchG', 'ArbStättV', 'BetrSichV', 'GefStoffV', 'BioStoffV', 'LärmVibrationsArbSchV',
  'ArbMedVV', 'LasthandhabV', 'PSA-BV', 'ASiG', 'JArbSchG', 'MuSchG', 'ArbZG',
  'TRBS', 'TRGS', 'ASR', 'PGS', 'DGUV Vorschrift', 'DGUV Regel', 'DGUV Information',
  // Dutch
  'Arbowet', 'Arbobesluit', 'Arboregeling', 'ATW', 'WAB', 'BW', 'WOR', 'ARBO',
  // EU
  'EU-Richtlinie', 'Richtlinie', 'Verordnung'
]

// Create regex pattern for law references
const createLawReferencePattern = () => {
  // Escape special regex characters in abbreviations
  const escapedAbbrs = LAW_ABBREVIATIONS.map(abbr =>
    abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ).join('|')

  // Pattern matches:
  // 1. "§ X AbbName" or "§§ X-Y AbbName" (German/Austrian section references)
  // 2. "Artikel X AbbName" or "Art. X" (Dutch/EU article references)
  // 3. Standalone abbreviations with optional numbers (e.g., "DGUV Vorschrift 1")
  return new RegExp(
    `(§§?\\s*\\d+[a-z]?(?:\\s*(?:bis|[-–])\\s*\\d+[a-z]?)?(?:\\s+(?:Abs\\.?|Absatz)\\s*\\d+)?(?:\\s+(?:${escapedAbbrs})))|` +
    `((?:Artikel|Art\\.)\\s*\\d+(?:\\.\\d+)?(?:\\s+(?:${escapedAbbrs})))|` +
    `(\\b(?:${escapedAbbrs})(?:\\s+(?:Vorschrift|Regel|Information|Nr\\.|Nummer))?\\s*\\d*\\b)`,
    'gi'
  )
}

const LAW_REFERENCE_PATTERN = createLawReferencePattern()

// Find law ID from reference text
function findLawIdFromReference(referenceText, allLaws) {
  if (!allLaws || allLaws.length === 0) return null

  const normalizedRef = referenceText.toLowerCase().trim()

  // Try to find a matching law
  for (const law of allLaws) {
    const abbr = (law.abbreviation || law.abbr || '').toLowerCase()
    const title = (law.title || '').toLowerCase()

    // Check if reference contains the abbreviation
    if (abbr && normalizedRef.includes(abbr)) {
      return { id: law.id, country: law.jurisdiction || law.country }
    }

    // Check for DGUV pattern matching
    if (normalizedRef.includes('dguv') && abbr.includes('dguv')) {
      // Try to match specific DGUV Vorschrift/Regel/Information number
      const dguNumberMatch = normalizedRef.match(/dguv\s*(?:vorschrift|regel|information)?\s*(\d+)/i)
      const lawNumberMatch = abbr.match(/dguv\s*(?:vorschrift|regel|information)?\s*(\d+)/i)
      if (dguNumberMatch && lawNumberMatch && dguNumberMatch[1] === lawNumberMatch[1]) {
        return { id: law.id, country: law.jurisdiction || law.country }
      }
    }
  }

  return null
}

export function FormattedAIResponse({ content, className = '', onLawClick, allLaws = [] }) {
  if (!content) return null

  // Try to parse JSON if it looks like JSON
  let textContent = content
  if (typeof content === 'string' && content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content)
      // If it's a JSON object, extract meaningful content
      textContent = formatJsonContent(parsed)
    } catch {
      // Not valid JSON, use as-is
      textContent = content
    }
  }

  // Parse and render the content
  const sections = parseContent(textContent)

  return (
    <div className={`space-y-4 ${className}`}>
      {sections.map((section, index) => (
        <Section key={index} section={section} onLawClick={onLawClick} allLaws={allLaws} />
      ))}
    </div>
  )
}

// Format JSON content into readable text
function formatJsonContent(obj, depth = 0) {
  if (typeof obj === 'string') return obj
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj)
  if (Array.isArray(obj)) {
    return obj.map(item => formatJsonContent(item, depth)).join('\n')
  }
  if (typeof obj === 'object' && obj !== null) {
    const lines = []
    for (const [key, value] of Object.entries(obj)) {
      const formattedKey = formatKey(key)
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        lines.push(`**${formattedKey}:** ${value}`)
      } else if (Array.isArray(value)) {
        lines.push(`**${formattedKey}:**`)
        value.forEach(item => {
          if (typeof item === 'string') {
            lines.push(`• ${item}`)
          } else {
            lines.push(formatJsonContent(item, depth + 1))
          }
        })
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`**${formattedKey}:**`)
        lines.push(formatJsonContent(value, depth + 1))
      }
    }
    return lines.join('\n')
  }
  return ''
}

// Format camelCase or snake_case keys to readable text
function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}

// Parse content into sections
function parseContent(text) {
  if (!text || typeof text !== 'string') return []

  const lines = text.split('\n')
  const sections = []
  let currentSection = null
  let currentItems = []

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      // Empty line - might indicate section break
      if (currentItems.length > 0) {
        if (!currentSection) {
          currentSection = { type: 'paragraph', content: [] }
        }
        currentSection.content.push(...currentItems)
        currentItems = []
      }
      continue
    }

    // Check if this is a section header (starts with emoji or is all caps with colon)
    const emojiMatch = trimmedLine.match(/^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])\s*(.+)/u)
    const headerMatch = trimmedLine.match(/^([A-ZÄÖÜ][A-ZÄÖÜ\s]+):?\s*$/i) && trimmedLine.endsWith(':')

    if (emojiMatch) {
      // Save previous section
      if (currentSection) {
        if (currentItems.length > 0) {
          currentSection.content.push(...currentItems)
          currentItems = []
        }
        if (currentSection.content.length > 0 || currentSection.header) {
          sections.push(currentSection)
        }
      }

      currentSection = {
        type: 'section',
        emoji: emojiMatch[1],
        header: emojiMatch[2].replace(/:$/, ''),
        content: []
      }
      continue
    }

    // Check for bold header lines (e.g., "**Compliance Status:**")
    const boldHeaderMatch = trimmedLine.match(/^\*\*(.+?)\*\*:?\s*$/)
    if (boldHeaderMatch && !trimmedLine.includes('• ') && !trimmedLine.includes('- ')) {
      // Save previous section
      if (currentSection) {
        if (currentItems.length > 0) {
          currentSection.content.push(...currentItems)
          currentItems = []
        }
        if (currentSection.content.length > 0 || currentSection.header) {
          sections.push(currentSection)
        }
      }

      currentSection = {
        type: 'section',
        header: boldHeaderMatch[1],
        content: []
      }
      continue
    }

    // Check for bullet points
    const bulletMatch = trimmedLine.match(/^[-•]\s+(.+)/)
    if (bulletMatch) {
      currentItems.push({ type: 'bullet', text: bulletMatch[1] })
      continue
    }

    // Check for numbered list
    const numberMatch = trimmedLine.match(/^(\d+)[.)]\s+(.+)/)
    if (numberMatch) {
      currentItems.push({ type: 'numbered', number: numberMatch[1], text: numberMatch[2] })
      continue
    }

    // Regular text line
    currentItems.push({ type: 'text', text: trimmedLine })
  }

  // Don't forget the last section
  if (currentSection) {
    if (currentItems.length > 0) {
      currentSection.content.push(...currentItems)
    }
    if (currentSection.content.length > 0 || currentSection.header) {
      sections.push(currentSection)
    }
  } else if (currentItems.length > 0) {
    sections.push({ type: 'paragraph', content: currentItems })
  }

  return sections
}

// Render a section
function Section({ section, onLawClick, allLaws }) {
  if (section.type === 'paragraph') {
    return (
      <div className="space-y-2">
        {section.content.map((item, index) => (
          <ContentItem key={index} item={item} onLawClick={onLawClick} allLaws={allLaws} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {section.header && (
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          {section.emoji && (
            <span className="text-xl">{section.emoji}</span>
          )}
          <span>{section.header}</span>
        </h3>
      )}
      <div className="space-y-1 pl-1">
        {section.content.map((item, index) => (
          <ContentItem key={index} item={item} onLawClick={onLawClick} allLaws={allLaws} />
        ))}
      </div>
    </div>
  )
}

// Render a content item (bullet, numbered, or text)
function ContentItem({ item, onLawClick, allLaws }) {
  const formattedText = formatText(item.text, onLawClick, allLaws)

  if (item.type === 'bullet') {
    return (
      <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span className="text-whs-orange-500 mt-1">•</span>
        <span>{formattedText}</span>
      </div>
    )
  }

  if (item.type === 'numbered') {
    return (
      <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span className="text-whs-orange-500 font-medium min-w-[1.5rem]">{item.number}.</span>
        <span>{formattedText}</span>
      </div>
    )
  }

  return (
    <p className="text-sm text-gray-700 dark:text-gray-300">
      {formattedText}
    </p>
  )
}

// Format inline text (bold, law references, etc.)
function formatText(text, onLawClick, allLaws) {
  if (!text) return null

  // First, split by bold markers
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)

  return parts.map((part, partIndex) => {
    // Check for bold
    const boldMatch = part.match(/^\*\*(.+)\*\*$/) || part.match(/^__(.+)__$/)
    if (boldMatch) {
      // Process law references inside bold text too
      return (
        <strong key={partIndex} className="font-semibold text-gray-900 dark:text-white">
          {processLawReferences(boldMatch[1], onLawClick, allLaws, `${partIndex}-bold`)}
        </strong>
      )
    }

    // Process law references in regular text
    return (
      <React.Fragment key={partIndex}>
        {processLawReferences(part, onLawClick, allLaws, partIndex)}
      </React.Fragment>
    )
  })
}

// Process text to find and linkify law references
function processLawReferences(text, onLawClick, allLaws, keyPrefix) {
  if (!text || !onLawClick) return text

  // Reset the regex lastIndex for fresh matching
  LAW_REFERENCE_PATTERN.lastIndex = 0

  const result = []
  let lastIndex = 0
  let match

  while ((match = LAW_REFERENCE_PATTERN.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push(
        <React.Fragment key={`${keyPrefix}-text-${lastIndex}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>
      )
    }

    const matchedText = match[0]
    const lawInfo = findLawIdFromReference(matchedText, allLaws)

    if (lawInfo) {
      // Render as clickable link
      result.push(
        <button
          key={`${keyPrefix}-law-${match.index}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onLawClick(lawInfo.id, lawInfo.country)
          }}
          className="inline-flex items-center gap-1 text-whs-orange-600 dark:text-whs-orange-400 hover:text-whs-orange-700 dark:hover:text-whs-orange-300 hover:underline font-medium transition-colors cursor-pointer"
          title={`View ${matchedText} in Law Browser`}
        >
          {matchedText}
          <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      )
    } else {
      // No matching law found, render as highlighted text (still recognizable as law reference)
      result.push(
        <span
          key={`${keyPrefix}-lawref-${match.index}`}
          className="text-whs-orange-600 dark:text-whs-orange-400 font-medium"
        >
          {matchedText}
        </span>
      )
    }

    lastIndex = match.index + matchedText.length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(
      <React.Fragment key={`${keyPrefix}-text-end`}>
        {text.slice(lastIndex)}
      </React.Fragment>
    )
  }

  return result.length > 0 ? result : text
}

export default FormattedAIResponse

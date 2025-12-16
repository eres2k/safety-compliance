import React from 'react'

/**
 * FormattedAIResponse - Renders AI responses with proper formatting
 * Handles:
 * - Emoji section headers
 * - Bullet points (- or •)
 * - Numbered lists
 * - Bold text (**text** or __text__)
 * - Proper paragraph spacing
 */
export function FormattedAIResponse({ content, className = '' }) {
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
        <Section key={index} section={section} />
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
function Section({ section }) {
  if (section.type === 'paragraph') {
    return (
      <div className="space-y-2">
        {section.content.map((item, index) => (
          <ContentItem key={index} item={item} />
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
          <ContentItem key={index} item={item} />
        ))}
      </div>
    </div>
  )
}

// Render a content item (bullet, numbered, or text)
function ContentItem({ item }) {
  const formattedText = formatText(item.text)

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

// Format inline text (bold, etc.)
function formatText(text) {
  if (!text) return null

  // Split by bold markers and render
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)

  return parts.map((part, index) => {
    // Check for bold
    const boldMatch = part.match(/^\*\*(.+)\*\*$/) || part.match(/^__(.+)__$/)
    if (boldMatch) {
      return (
        <strong key={index} className="font-semibold text-gray-900 dark:text-white">
          {boldMatch[1]}
        </strong>
      )
    }
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

export default FormattedAIResponse

import { useState, useEffect, useCallback, useRef } from 'react'

// Default complexity levels with English fallbacks
const getComplexityLevels = (t) => [
  { id: 'legal', label: t?.complexity?.legal || 'Legal Text', icon: '⚖️', description: t?.complexity?.legalDescription || 'Original legal language' },
  { id: 'manager', label: t?.complexity?.manager || 'WHS Summary', icon: '📋', description: t?.complexity?.managerDescription || 'Amazon WHS key obligations & compliance requirements' },
  { id: 'associate', label: t?.complexity?.associate || "Explain like I'm 5", icon: '💡', description: t?.complexity?.associateDescription || 'Simple explanation anyone can understand' }
]

export function ComplexitySlider({
  currentLevel = 'legal',
  onLevelChange,
  isLoading = false,
  disabled = false,
  t = {}
}) {
  const [activeLevel, setActiveLevel] = useState(currentLevel)
  const sliderRef = useRef(null)
  const complexityLevels = getComplexityLevels(t)

  useEffect(() => {
    setActiveLevel(currentLevel)
  }, [currentLevel])

  const handleLevelChange = useCallback((levelId) => {
    if (disabled || isLoading) return
    setActiveLevel(levelId)
    onLevelChange?.(levelId)
  }, [disabled, isLoading, onLevelChange])

  const activeIndex = complexityLevels.findIndex(l => l.id === activeLevel)

  return (
    <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <span className="text-sm px-2 text-gray-500 dark:text-gray-400">{t?.complexity?.reading || 'Reading:'}</span>
      {complexityLevels.map((level) => (
        <button
          key={level.id}
          onClick={() => handleLevelChange(level.id)}
          disabled={disabled || isLoading}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
            disabled || isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          } ${
            activeLevel === level.id
              ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title={level.description}
        >
          <span>{level.icon}</span>
          <span className="hidden sm:inline">{level.label}</span>
        </button>
      ))}
      {isLoading && (
        <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin ml-1"></div>
      )}
    </div>
  )
}

// Parse WHS Summary sections from content (supports multiple formats)
function parseWHSSections(content) {
  const sections = {
    overview: [],
    requirements: [],
    relevance: [],
    actions: []
  }

  const parseBullets = (text) => {
    if (!text) return []
    return text
      .split(/[\n\r]+/)
      .map(line => line.replace(/^[\s*•\-–]+/, '').trim())
      .filter(line => line.length > 0 && !line.match(/^(?:\*\*)?(?:Key WHS|Compliance|Documentation|What this|Key requirements|Actions|\.\.\.)/i))
  }

  // Try to parse structured format - multiple header variations
  const overviewPatterns = [
    /(?:\*\*)?What this section covers:?(?:\*\*)?[\s\n]*([\s\S]*?)(?=(?:\*\*)?Key requirements|(?:\*\*)?Compliance|$)/i,
  ]
  const requirementsPatterns = [
    /(?:\*\*)?Key requirements from this text:?(?:\*\*)?[\s\n]*([\s\S]*?)(?=(?:\*\*)?Compliance|(?:\*\*)?Documentation|$)/i,
    /(?:\*\*)?Key WHS obligations:?(?:\*\*)?[\s\n]*([\s\S]*?)(?=(?:\*\*)?Compliance|(?:\*\*)?Documentation|$)/i,
  ]
  const relevancePatterns = [
    /(?:\*\*)?Compliance relevance(?:\s+for Amazon)?:?(?:\*\*)?[\s\n]*([\s\S]*?)(?=(?:\*\*)?Documentation|$)/i,
    /(?:\*\*)?Compliance deadlines:?(?:\*\*)?[\s\n]*([\s\S]*?)(?=(?:\*\*)?Documentation|$)/i,
  ]
  const actionsPatterns = [
    /(?:\*\*)?Documentation(?:\/Actions)?(?:\s+needed)?:?(?:\*\*)?[\s\n]*([\s\S]*?)$/i,
    /(?:\*\*)?Documentation required:?(?:\*\*)?[\s\n]*([\s\S]*?)$/i,
  ]

  // Try each pattern until we find a match
  for (const pattern of overviewPatterns) {
    const match = content.match(pattern)
    if (match && sections.overview.length === 0) {
      sections.overview = parseBullets(match[1])
    }
  }
  for (const pattern of requirementsPatterns) {
    const match = content.match(pattern)
    if (match && sections.requirements.length === 0) {
      sections.requirements = parseBullets(match[1])
    }
  }
  for (const pattern of relevancePatterns) {
    const match = content.match(pattern)
    if (match && sections.relevance.length === 0) {
      sections.relevance = parseBullets(match[1])
    }
  }
  for (const pattern of actionsPatterns) {
    const match = content.match(pattern)
    if (match && sections.actions.length === 0) {
      sections.actions = parseBullets(match[1])
    }
  }

  return sections
}

// Parse ELI5 bullet points
function parseELI5Content(content) {
  return content
    .split(/[\n\r]+/)
    .map(line => line.replace(/^[\s*•\-–\d.]+/, '').trim())
    .filter(line => line.length > 0)
}

// WHS Section Component
function WHSSection({ icon, title, items, color }) {
  if (!items || items.length === 0) return null

  const colorClasses = {
    orange: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800',
    blue: 'bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 border-blue-200 dark:border-blue-800',
    purple: 'bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 border-purple-200 dark:border-purple-800',
    green: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
  }

  const iconBg = {
    orange: 'bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-sm',
    blue: 'bg-gradient-to-br from-blue-400 to-sky-500 text-white shadow-sm',
    purple: 'bg-gradient-to-br from-purple-400 to-fuchsia-500 text-white shadow-sm',
    green: 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-sm'
  }

  const titleColor = {
    orange: 'text-orange-800 dark:text-orange-200',
    blue: 'text-blue-800 dark:text-blue-200',
    purple: 'text-purple-800 dark:text-purple-200',
    green: 'text-green-800 dark:text-green-200'
  }

  const bulletColor = {
    orange: 'text-orange-400 dark:text-orange-500',
    blue: 'text-blue-400 dark:text-blue-500',
    purple: 'text-purple-400 dark:text-purple-500',
    green: 'text-green-400 dark:text-green-500'
  }

  return (
    <div className={`rounded-xl p-4 ${colorClasses[color]} border shadow-sm`}>
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-8 h-8 rounded-lg ${iconBg[color]} flex items-center justify-center text-base`}>{icon}</span>
        <h6 className={`font-bold ${titleColor[color]} text-sm tracking-wide`}>{title}</h6>
      </div>
      <ul className="space-y-2 ml-11">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2 leading-relaxed">
            <span className={`${bulletColor[color]} mt-1.5 flex-shrink-0`}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8">
                <circle cx="4" cy="4" r="3"/>
              </svg>
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Simplified content display component
export function SimplifiedContent({ content, level, isLoading, t = {}, wikiArticles = [], onWikiClick }) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
      </div>
    )
  }

  if (!content) return null

  const levelConfig = {
    legal: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      icon: '⚖️',
      title: t?.complexity?.legalFull || 'Original Legal Text'
    },
    manager: {
      bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: '📋',
      title: t?.complexity?.manager || 'WHS Summary'
    },
    associate: {
      bg: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
      border: 'border-green-200 dark:border-green-800',
      icon: '💡',
      title: t?.complexity?.associate || "Explain like I'm 5"
    }
  }

  const config = levelConfig[level] || levelConfig.legal

  // For manager level, parse and display structured WHS sections
  if (level === 'manager') {
    const sections = parseWHSSections(content)
    const hasStructuredContent = sections.overview.length > 0 || sections.requirements.length > 0 || sections.relevance.length > 0 || sections.actions.length > 0

    return (
      <div className={`rounded-2xl p-5 ${config.bg} border ${config.border} shadow-md`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-blue-200 dark:border-blue-700">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <span className="text-xl">{config.icon}</span>
          </div>
          <div>
            <h5 className="font-bold text-gray-900 dark:text-white text-lg">{config.title}</h5>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t?.whs?.subtitle || "Key obligations & compliance requirements"}</p>
          </div>
        </div>

        {hasStructuredContent ? (
          <div className="space-y-4">
            <WHSSection
              icon="📋"
              title={t?.whs?.overview || "What This Section Covers"}
              items={sections.overview}
              color="blue"
            />
            <WHSSection
              icon="✅"
              title={t?.whs?.requirements || "Key Requirements"}
              items={sections.requirements}
              color="orange"
            />
            <WHSSection
              icon="🏭"
              title={t?.whs?.relevance || "Compliance Relevance"}
              items={sections.relevance}
              color="purple"
            />
            <WHSSection
              icon="📄"
              title={t?.whs?.actions || "Documentation/Actions Needed"}
              items={sections.actions}
              color="green"
            />
          </div>
        ) : (
          <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-white/50 dark:bg-gray-800/50 p-4 rounded-xl">
            {content}
          </div>
        )}

        {/* Related Wikipedia Articles */}
        {wikiArticles && wikiArticles.length > 0 && (
          <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">📖</span>
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                {t?.whs?.relatedWiki || "Related Wikipedia Articles"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {wikiArticles.map((article, idx) => (
                <button
                  key={idx}
                  onClick={() => onWikiClick?.(article.abbr)}
                  className="text-xs px-2 py-1 bg-white/50 dark:bg-gray-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 transition-colors"
                >
                  📖 {article.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // For associate (ELI5) level, display friendly bullet points
  if (level === 'associate') {
    const bullets = parseELI5Content(content)

    return (
      <div className={`rounded-xl p-4 ${config.bg} border ${config.border} shadow-sm`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">{config.icon}</span>
          <h5 className="font-bold text-gray-900 dark:text-white">{config.title}</h5>
        </div>

        {bullets.length > 0 ? (
          <div className="space-y-2">
            {bullets.map((bullet, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-2 bg-white/50 dark:bg-gray-800/30 rounded-lg"
              >
                <span className="text-lg mt-0.5">
                  {bullet.match(/^[^\w\s]/) ? bullet.charAt(0) : '👉'}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {bullet.replace(/^[^\w\s]\s*/, '')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        )}
      </div>
    )
  }

  // Default/legal level
  return (
    <div className={`rounded-lg p-4 ${config.bg} border ${config.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{config.icon}</span>
        <h5 className="font-semibold text-gray-900 dark:text-white text-sm">{config.title}</h5>
      </div>
      <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    </div>
  )
}

export default ComplexitySlider

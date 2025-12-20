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

// WHS Section Component - Modern card design with improved visual hierarchy
function WHSSection({ icon, title, items, color, priority = 'normal' }) {
  if (!items || items.length === 0) return null

  const colorClasses = {
    orange: 'bg-gradient-to-br from-orange-50 via-amber-50/50 to-orange-50/30 dark:from-orange-950/40 dark:via-amber-950/20 dark:to-orange-950/10 border-orange-200/80 dark:border-orange-800/60',
    blue: 'bg-gradient-to-br from-blue-50 via-sky-50/50 to-blue-50/30 dark:from-blue-950/40 dark:via-sky-950/20 dark:to-blue-950/10 border-blue-200/80 dark:border-blue-800/60',
    purple: 'bg-gradient-to-br from-purple-50 via-fuchsia-50/50 to-purple-50/30 dark:from-purple-950/40 dark:via-fuchsia-950/20 dark:to-purple-950/10 border-purple-200/80 dark:border-purple-800/60',
    green: 'bg-gradient-to-br from-green-50 via-emerald-50/50 to-green-50/30 dark:from-green-950/40 dark:via-emerald-950/20 dark:to-green-950/10 border-green-200/80 dark:border-green-800/60',
    red: 'bg-gradient-to-br from-red-50 via-rose-50/50 to-red-50/30 dark:from-red-950/40 dark:via-rose-950/20 dark:to-red-950/10 border-red-200/80 dark:border-red-800/60',
    yellow: 'bg-gradient-to-br from-yellow-50 via-amber-50/50 to-yellow-50/30 dark:from-yellow-950/40 dark:via-amber-950/20 dark:to-yellow-950/10 border-yellow-200/80 dark:border-yellow-800/60'
  }

  const iconBg = {
    orange: 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/25',
    blue: 'bg-gradient-to-br from-blue-500 to-sky-600 text-white shadow-lg shadow-blue-500/25',
    purple: 'bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white shadow-lg shadow-purple-500/25',
    green: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25',
    red: 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25',
    yellow: 'bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/25'
  }

  const titleColor = {
    orange: 'text-orange-900 dark:text-orange-100',
    blue: 'text-blue-900 dark:text-blue-100',
    purple: 'text-purple-900 dark:text-purple-100',
    green: 'text-green-900 dark:text-green-100',
    red: 'text-red-900 dark:text-red-100',
    yellow: 'text-yellow-900 dark:text-yellow-100'
  }

  const bulletColor = {
    orange: 'text-orange-500 dark:text-orange-400',
    blue: 'text-blue-500 dark:text-blue-400',
    purple: 'text-purple-500 dark:text-purple-400',
    green: 'text-green-500 dark:text-green-400',
    red: 'text-red-500 dark:text-red-400',
    yellow: 'text-yellow-500 dark:text-yellow-400'
  }

  const checkIcons = {
    orange: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
      </svg>
    ),
    blue: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    purple: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    green: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    red: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    yellow: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  const priorityBadge = priority === 'high' ? (
    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
      Priority
    </span>
  ) : null

  return (
    <div className={`rounded-2xl p-5 ${colorClasses[color]} border backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300`}>
      {/* Header with icon and title */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg[color]} flex items-center justify-center text-lg transform hover:scale-105 transition-transform`}>
          {icon}
        </div>
        <div className="flex-1 flex items-center gap-2">
          <h6 className={`font-bold ${titleColor[color]} text-sm tracking-wide uppercase`}>{title}</h6>
          {priorityBadge}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{items.length} items</span>
      </div>

      {/* Divider */}
      <div className={`h-px bg-gradient-to-r from-transparent via-${color}-200 dark:via-${color}-700 to-transparent mb-4`}></div>

      {/* Items list with modern styling */}
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="group flex items-start gap-3 p-2.5 rounded-xl bg-white/50 dark:bg-gray-900/30 hover:bg-white/80 dark:hover:bg-gray-900/50 transition-all duration-200"
          >
            <span className={`${bulletColor[color]} mt-0.5 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity`}>
              {checkIcons[color] || checkIcons.orange}
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
              {item}
            </span>
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
      <div className="animate-pulse space-y-4 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          ))}
        </div>
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
      bg: 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-900/50 dark:via-blue-950/30 dark:to-indigo-950/20',
      border: 'border-slate-200/80 dark:border-slate-700/60',
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
      <div className={`rounded-3xl p-6 ${config.bg} border ${config.border} shadow-lg backdrop-blur-sm`}>
        {/* Modern Header with gradient accent */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-500/5 dark:via-indigo-500/5 dark:to-purple-500/5 rounded-2xl"></div>
          <div className="relative flex items-center gap-4 p-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/30 dark:shadow-blue-500/20 transform hover:scale-105 transition-transform">
              <span className="text-2xl">{config.icon}</span>
            </div>
            <div className="flex-1">
              <h5 className="font-bold text-gray-900 dark:text-white text-xl tracking-tight">{config.title}</h5>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t?.whs?.subtitle || "Key obligations & compliance requirements"}</p>
            </div>
            {/* Quick stats */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              {sections.requirements.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className="font-medium text-orange-700 dark:text-orange-300">{sections.requirements.length} requirements</span>
                </div>
              )}
              {sections.actions.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="font-medium text-green-700 dark:text-green-300">{sections.actions.length} actions</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasStructuredContent ? (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Overview - Full width */}
            {sections.overview.length > 0 && (
              <div className="md:col-span-2">
                <WHSSection
                  icon="📋"
                  title={t?.whs?.overview || "What This Section Covers"}
                  items={sections.overview}
                  color="blue"
                />
              </div>
            )}
            {/* Requirements - Prominent placement */}
            {sections.requirements.length > 0 && (
              <div className={sections.relevance.length === 0 && sections.actions.length === 0 ? 'md:col-span-2' : ''}>
                <WHSSection
                  icon="✅"
                  title={t?.whs?.requirements || "Key Requirements"}
                  items={sections.requirements}
                  color="orange"
                  priority={sections.requirements.length > 3 ? 'high' : 'normal'}
                />
              </div>
            )}
            {/* Relevance */}
            {sections.relevance.length > 0 && (
              <WHSSection
                icon="🏭"
                title={t?.whs?.relevance || "Compliance Relevance"}
                items={sections.relevance}
                color="purple"
              />
            )}
            {/* Actions - Full width if alone or many items */}
            {sections.actions.length > 0 && (
              <div className={sections.actions.length > 3 || (sections.requirements.length === 0 && sections.relevance.length === 0) ? 'md:col-span-2' : ''}>
                <WHSSection
                  icon="📄"
                  title={t?.whs?.actions || "Documentation/Actions Needed"}
                  items={sections.actions}
                  color="green"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-white/60 dark:bg-gray-800/60 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
            {content}
          </div>
        )}

        {/* Related Wikipedia Articles - Modern card style */}
        {wikiArticles && wikiArticles.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-gray-200 dark:from-slate-800 dark:to-gray-900 flex items-center justify-center">
                <span className="text-sm">📖</span>
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t?.whs?.relatedWiki || "Related Wikipedia Articles"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {wikiArticles.map((article, idx) => (
                <button
                  key={idx}
                  onClick={() => onWikiClick?.(article.abbr)}
                  className="group flex items-center gap-2 text-sm px-3 py-2 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <span className="text-base group-hover:scale-110 transition-transform">📖</span>
                  <span className="font-medium">{article.title}</span>
                  <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
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

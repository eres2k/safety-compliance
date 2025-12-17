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

// Simplified content display component
export function SimplifiedContent({ content, level, isLoading, t = {} }) {
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
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: '📋',
      title: t?.complexity?.manager || 'WHS Summary'
    },
    associate: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      icon: '💡',
      title: t?.complexity?.associate || "Explain like I'm 5"
    }
  }

  const config = levelConfig[level] || levelConfig.legal

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

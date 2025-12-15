import { useState, useEffect, useCallback, useRef } from 'react'

const COMPLEXITY_LEVELS = [
  { id: 'legal', label: 'Legal Text', icon: '⚖️', description: 'Original legal language' },
  { id: 'manager', label: 'Manager Summary', icon: '📋', description: 'Key obligations & deadlines' },
  { id: 'associate', label: 'Toolbox Talk', icon: '🦺', description: 'Simple worker instructions' }
]

export function ComplexitySlider({
  currentLevel = 'legal',
  onLevelChange,
  isLoading = false,
  disabled = false
}) {
  const [activeLevel, setActiveLevel] = useState(currentLevel)
  const sliderRef = useRef(null)

  useEffect(() => {
    setActiveLevel(currentLevel)
  }, [currentLevel])

  const handleLevelChange = useCallback((levelId) => {
    if (disabled || isLoading) return
    setActiveLevel(levelId)
    onLevelChange?.(levelId)
  }, [disabled, isLoading, onLevelChange])

  const activeIndex = COMPLEXITY_LEVELS.findIndex(l => l.id === activeLevel)

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
            Reading Level
          </h4>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-xs">Simplifying...</span>
          </div>
        )}
      </div>

      {/* Slider Track */}
      <div ref={sliderRef} className="relative">
        {/* Background Track */}
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full relative">
          {/* Active Fill */}
          <div
            className="absolute h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(activeIndex / (COMPLEXITY_LEVELS.length - 1)) * 100}%` }}
          />
        </div>

        {/* Level Buttons */}
        <div className="flex justify-between mt-1">
          {COMPLEXITY_LEVELS.map((level, index) => (
            <button
              key={level.id}
              onClick={() => handleLevelChange(level.id)}
              disabled={disabled || isLoading}
              className={`relative flex flex-col items-center transition-all ${
                disabled || isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
            >
              {/* Dot Indicator */}
              <div
                className={`w-4 h-4 rounded-full border-2 -mt-3 transition-all ${
                  activeIndex >= index
                    ? 'bg-blue-500 border-blue-500 scale-110'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                } ${activeLevel === level.id ? 'ring-2 ring-blue-300 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
              />

              {/* Label */}
              <div className="mt-2 text-center">
                <span className="text-lg">{level.icon}</span>
                <p className={`text-xs font-medium mt-1 ${
                  activeLevel === level.id
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {level.label}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Current Level Description */}
      <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-800">
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          {COMPLEXITY_LEVELS.find(l => l.id === activeLevel)?.description}
        </p>
      </div>
    </div>
  )
}

// Simplified content display component
export function SimplifiedContent({ content, level, isLoading }) {
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
      title: 'Original Legal Text'
    },
    manager: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: '📋',
      title: 'Manager Summary'
    },
    associate: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      icon: '🦺',
      title: 'Toolbox Talk'
    }
  }

  const config = levelConfig[level] || levelConfig.legal

  return (
    <div className={`rounded-lg p-4 ${config.bg} border ${config.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{config.icon}</span>
        <h5 className="font-semibold text-gray-900 dark:text-white text-sm">{config.title}</h5>
        {level !== 'legal' && (
          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
            AI Simplified
          </span>
        )}
      </div>
      <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    </div>
  )
}

export default ComplexitySlider

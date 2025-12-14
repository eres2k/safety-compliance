import { useState } from 'react'

const COMPLEXITY_LEVELS = [
  {
    id: 'legal',
    label: 'Legal Text',
    description: 'Original legal language',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    )
  },
  {
    id: 'manager',
    label: 'Manager Summary',
    description: 'Key obligations & deadlines',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    )
  },
  {
    id: 'associate',
    label: 'Toolbox Talk',
    description: 'Simple floor worker guide',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  }
]

export function ComplexitySlider({ value, onChange, isLoading, disabled }) {
  const currentIndex = COMPLEXITY_LEVELS.findIndex(l => l.id === value)

  return (
    <div className="bg-gray-50 dark:bg-whs-dark-800 rounded-lg p-3 border border-gray-200 dark:border-whs-dark-700">
      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500 dark:text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <span>Reading Level</span>
        {isLoading && (
          <div className="animate-spin rounded-full h-3 w-3 border border-whs-orange-500 border-t-transparent ml-auto" />
        )}
      </div>

      {/* Toggle buttons */}
      <div className="flex rounded-lg bg-gray-200 dark:bg-whs-dark-700 p-1">
        {COMPLEXITY_LEVELS.map((level) => (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            disabled={disabled || isLoading}
            className={`
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all
              ${value === level.id
                ? 'bg-white dark:bg-whs-dark-600 text-whs-orange-600 dark:text-whs-orange-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }
              ${(disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={level.description}
          >
            {level.icon}
            <span className="hidden sm:inline">{level.label}</span>
          </button>
        ))}
      </div>

      {/* Current level description */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        {COMPLEXITY_LEVELS[currentIndex]?.description}
      </p>
    </div>
  )
}

export function SimplifiedContent({ content, level, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-whs-dark-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-whs-dark-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-whs-dark-700 rounded w-5/6" />
        <div className="h-4 bg-gray-200 dark:bg-whs-dark-700 rounded w-2/3" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-500 dark:text-red-400 text-sm">
        Failed to simplify text: {error}
      </div>
    )
  }

  if (!content) return null

  // Style based on level
  const levelStyles = {
    legal: 'prose prose-sm dark:prose-invert max-w-none',
    manager: 'prose prose-sm dark:prose-invert max-w-none prose-li:marker:text-whs-orange-500',
    associate: 'text-lg leading-relaxed'
  }

  // For associate level, render with special formatting
  if (level === 'associate') {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-r-lg">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold text-yellow-700 dark:text-yellow-300">Toolbox Talk</span>
        </div>
        <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {content}
        </div>
      </div>
    )
  }

  // For manager level, render with bullet styling
  if (level === 'manager') {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="font-semibold text-blue-700 dark:text-blue-300">Manager Summary</span>
        </div>
        <div className={levelStyles[level]}>
          <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </div>
    )
  }

  // Legal text - original formatting
  return (
    <div className={levelStyles[level]}>
      <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {content}
      </div>
    </div>
  )
}

export default ComplexitySlider

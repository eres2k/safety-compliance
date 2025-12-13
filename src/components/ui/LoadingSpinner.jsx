// Loading Spinner Component
export function LoadingSpinner({ size = 'md', className = '', color = 'orange' }) {
  const sizes = {
    xs: 'h-4 w-4',
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }

  const colors = {
    orange: 'text-whs-orange-500',
    white: 'text-white',
    gray: 'text-gray-400 dark:text-gray-500',
    current: 'text-current'
  }

  return (
    <svg
      className={`animate-spin ${sizes[size]} ${colors[color]} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// Loading Overlay Component
export function LoadingOverlay({
  message = 'Loading...',
  fullScreen = false,
  transparent = false
}) {
  const overlayClasses = fullScreen
    ? 'fixed inset-0 z-50'
    : 'absolute inset-0'

  return (
    <div
      className={`
        ${overlayClasses}
        flex flex-col items-center justify-center
        ${transparent
          ? 'bg-white/60 dark:bg-whs-dark-900/60 backdrop-blur-sm'
          : 'bg-white dark:bg-whs-dark-900'
        }
      `}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <LoadingSpinner size="xl" color="orange" />
          <div className="absolute inset-0 animate-ping">
            <LoadingSpinner size="xl" color="orange" className="opacity-30" />
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-medium">{message}</p>
      </div>
    </div>
  )
}

// Skeleton Loading Component
export function Skeleton({ className = '', variant = 'text', lines = 1 }) {
  const variants = {
    text: 'h-4 rounded',
    title: 'h-6 rounded',
    avatar: 'h-12 w-12 rounded-full',
    thumbnail: 'h-20 w-20 rounded-lg',
    card: 'h-40 rounded-2xl',
    button: 'h-10 w-24 rounded-xl'
  }

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`
              animate-pulse bg-gray-200 dark:bg-whs-dark-700
              ${variants.text}
              ${i === lines - 1 ? 'w-3/4' : 'w-full'}
            `}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`
        animate-pulse bg-gray-200 dark:bg-whs-dark-700
        ${variants[variant]}
        ${className}
      `}
    />
  )
}

// Card Skeleton Component
export function CardSkeleton({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-whs-dark-800 rounded-2xl p-5 ${className}`}>
      <div className="flex items-start gap-4">
        <Skeleton variant="thumbnail" />
        <div className="flex-1 space-y-3">
          <Skeleton variant="title" className="w-3/4" />
          <Skeleton variant="text" lines={2} />
        </div>
      </div>
    </div>
  )
}

// Progress Spinner Component
export function ProgressSpinner({
  progress = 0,
  size = 'md',
  showValue = true,
  className = ''
}) {
  const sizes = {
    sm: { size: 40, stroke: 3 },
    md: { size: 60, stroke: 4 },
    lg: { size: 80, stroke: 5 },
    xl: { size: 120, stroke: 6 }
  }

  const { size: svgSize, stroke } = sizes[size]
  const radius = (svgSize - stroke) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={svgSize} height={svgSize} className="transform -rotate-90">
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className="text-gray-200 dark:text-whs-dark-700"
        />
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-whs-orange-500 transition-all duration-500 ease-out"
        />
      </svg>
      {showValue && (
        <span className="absolute text-sm font-semibold text-gray-700 dark:text-gray-300">
          {Math.round(progress)}%
        </span>
      )}
    </div>
  )
}

// Dots Loading Component
export function DotsLoading({ className = '' }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-whs-orange-500 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  )
}

export default LoadingSpinner

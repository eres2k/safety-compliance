import { forwardRef } from 'react'

const variants = {
  primary: `
    bg-gradient-to-r from-whs-orange-500 to-whs-orange-600
    hover:from-whs-orange-600 hover:to-whs-orange-700
    text-white shadow-md
    hover:shadow-lg hover:shadow-whs-orange-500/25
    focus:ring-whs-orange-500/50
    dark:from-whs-orange-500 dark:to-whs-orange-600
    dark:hover:from-whs-orange-400 dark:hover:to-whs-orange-500
  `,
  secondary: `
    bg-gray-100 dark:bg-whs-dark-700
    text-gray-700 dark:text-gray-200
    hover:bg-gray-200 dark:hover:bg-whs-dark-600
    focus:ring-gray-500/30 dark:focus:ring-whs-dark-500/50
    border border-gray-200 dark:border-whs-dark-600
  `,
  success: `
    bg-gradient-to-r from-whs-success-500 to-whs-success-600
    hover:from-whs-success-600 hover:to-whs-success-700
    text-white shadow-md
    hover:shadow-lg hover:shadow-whs-success-500/25
    focus:ring-whs-success-500/50
  `,
  danger: `
    bg-gradient-to-r from-whs-danger-500 to-whs-danger-600
    hover:from-whs-danger-600 hover:to-whs-danger-700
    text-white shadow-md
    hover:shadow-lg hover:shadow-whs-danger-500/25
    focus:ring-whs-danger-500/50
  `,
  outline: `
    bg-transparent
    border-2 border-whs-orange-500 dark:border-whs-orange-400
    text-whs-orange-600 dark:text-whs-orange-400
    hover:bg-whs-orange-500 hover:text-white
    dark:hover:bg-whs-orange-500 dark:hover:text-white
    focus:ring-whs-orange-500/50
  `,
  ghost: `
    bg-transparent
    text-gray-700 dark:text-gray-300
    hover:bg-gray-100 dark:hover:bg-whs-dark-700
    focus:ring-gray-500/30
  `,
  glass: `
    bg-white/10 dark:bg-white/5
    backdrop-blur-md
    border border-white/20 dark:border-white/10
    text-white
    hover:bg-white/20 dark:hover:bg-white/10
    focus:ring-white/30
  `
}

const sizes = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg'
}

const iconSizes = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6'
}

export const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  rounded = 'xl',
  ...props
}, ref) => {
  const roundedClasses = {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    full: 'rounded-full'
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-4 focus:ring-offset-2
        dark:focus:ring-offset-whs-dark-900
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        active:scale-[0.98]
        ${roundedClasses[rounded]}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <svg className={`animate-spin ${iconSizes[size]}`} fill="none" viewBox="0 0 24 24">
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
          <span className="loading-dots">Loading</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className={iconSizes[size]}>{icon}</span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <span className={iconSizes[size]}>{icon}</span>
          )}
        </>
      )}
    </button>
  )
})

Button.displayName = 'Button'

// Icon Button Component
export const IconButton = forwardRef(({
  children,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const iconButtonSizes = {
    xs: 'p-1',
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
    xl: 'p-3'
  }

  return (
    <Button
      ref={ref}
      variant={variant}
      className={`${iconButtonSizes[size]} ${className}`}
      {...props}
    >
      {children}
    </Button>
  )
})

IconButton.displayName = 'IconButton'

export default Button

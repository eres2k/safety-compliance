import { forwardRef, useState } from 'react'

const inputVariants = {
  default: `
    bg-white dark:bg-whs-dark-800
    border-2 border-gray-200 dark:border-whs-dark-600
    focus:border-whs-orange-500 dark:focus:border-whs-orange-500
    focus:ring-4 focus:ring-whs-orange-500/20
  `,
  filled: `
    bg-gray-100 dark:bg-whs-dark-700
    border-2 border-transparent
    focus:border-whs-orange-500 dark:focus:border-whs-orange-500
    focus:bg-white dark:focus:bg-whs-dark-800
    focus:ring-4 focus:ring-whs-orange-500/20
  `,
  outline: `
    bg-transparent
    border-2 border-gray-300 dark:border-whs-dark-500
    focus:border-whs-orange-500 dark:focus:border-whs-orange-500
    focus:ring-4 focus:ring-whs-orange-500/20
  `,
  glass: `
    bg-white/50 dark:bg-white/5
    backdrop-blur-md
    border border-gray-200/50 dark:border-white/10
    focus:border-whs-orange-500/50 dark:focus:border-whs-orange-500/50
    focus:ring-4 focus:ring-whs-orange-500/20
    text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-white/60
  `
}

const inputSizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'px-5 py-4 text-base'
}

export const Input = forwardRef(({
  label,
  error,
  hint,
  variant = 'default',
  size = 'md',
  icon,
  iconPosition = 'left',
  className = '',
  containerClassName = '',
  labelClassName = '',
  ...props
}, ref) => {
  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 ${labelClassName}`}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full rounded-xl
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            transition-all duration-200
            focus:outline-none
            disabled:bg-gray-100 dark:disabled:bg-whs-dark-700
            disabled:cursor-not-allowed disabled:opacity-60
            ${inputVariants[variant]}
            ${inputSizes[size]}
            ${icon && iconPosition === 'left' ? 'pl-10' : ''}
            ${icon && iconPosition === 'right' ? 'pr-10' : ''}
            ${error ? 'border-whs-danger-500 focus:border-whs-danger-500 focus:ring-whs-danger-500/20' : ''}
            ${className}
          `}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
      </div>
      {hint && !error && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-sm text-whs-danger-500 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

// Search Input Component
export const SearchInput = forwardRef(({
  onSearch,
  onClear,
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  ...props
}, ref) => {
  const [internalValue, setInternalValue] = useState(value || '')
  const currentValue = value !== undefined ? value : internalValue

  const handleClear = () => {
    setInternalValue('')
    onClear?.()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(currentValue)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        ref={ref}
        type="text"
        value={currentValue}
        onChange={(e) => {
          setInternalValue(e.target.value)
          onChange?.(e)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`
          w-full pl-12 pr-10 py-3 rounded-xl
          bg-white dark:bg-whs-dark-800
          border-2 border-gray-200 dark:border-whs-dark-600
          text-gray-900 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500
          focus:border-whs-orange-500 dark:focus:border-whs-orange-500
          focus:ring-4 focus:ring-whs-orange-500/20
          focus:outline-none
          transition-all duration-200
        `}
        {...props}
      />
      {currentValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
})

SearchInput.displayName = 'SearchInput'

// Textarea Component
export const Textarea = forwardRef(({
  label,
  error,
  hint,
  variant = 'default',
  rows = 4,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={`
          w-full px-4 py-3 rounded-xl
          text-gray-900 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500
          transition-all duration-200
          focus:outline-none
          resize-none
          ${inputVariants[variant]}
          ${error ? 'border-whs-danger-500 focus:border-whs-danger-500 focus:ring-whs-danger-500/20' : ''}
          ${className}
        `}
        {...props}
      />
      {hint && !error && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-sm text-whs-danger-500">{error}</p>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'

export default Input

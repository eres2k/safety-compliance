import { forwardRef, useState, useRef, useEffect } from 'react'

const selectVariants = {
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
  `
}

const selectSizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'px-5 py-4 text-base'
}

export const Select = forwardRef(({
  label,
  error,
  hint,
  options = [],
  placeholder,
  variant = 'default',
  size = 'md',
  icon,
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
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
            {icon}
          </div>
        )}
        <select
          ref={ref}
          className={`
            w-full rounded-xl
            text-gray-900 dark:text-gray-100
            transition-all duration-200
            focus:outline-none
            disabled:bg-gray-100 dark:disabled:bg-whs-dark-700
            disabled:cursor-not-allowed disabled:opacity-60
            appearance-none cursor-pointer
            ${selectVariants[variant]}
            ${selectSizes[size]}
            ${icon ? 'pl-10' : ''}
            pr-10
            ${error ? 'border-whs-danger-500 focus:border-whs-danger-500 focus:ring-whs-danger-500/20' : ''}
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" className="text-gray-400">
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="text-gray-900 dark:text-gray-100 dark:bg-whs-dark-800"
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
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

Select.displayName = 'Select'

// Custom Dropdown Select with better styling
export function CustomSelect({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`w-full ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full px-4 py-3 rounded-xl text-left
            bg-white dark:bg-whs-dark-800
            border-2 border-gray-200 dark:border-whs-dark-600
            text-gray-900 dark:text-gray-100
            hover:border-gray-300 dark:hover:border-whs-dark-500
            focus:outline-none focus:border-whs-orange-500
            focus:ring-4 focus:ring-whs-orange-500/20
            transition-all duration-200
            flex items-center justify-between
          `}
        >
          <span className={selectedOption ? '' : 'text-gray-400 dark:text-gray-500'}>
            {selectedOption?.label || placeholder}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 py-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-xl shadow-lg animate-fade-in-down">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`
                  w-full px-4 py-2.5 text-left
                  hover:bg-whs-orange-50 dark:hover:bg-whs-orange-900/20
                  transition-colors duration-150
                  ${option.value === value
                    ? 'bg-whs-orange-50 dark:bg-whs-orange-900/20 text-whs-orange-600 dark:text-whs-orange-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Select

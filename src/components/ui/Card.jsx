const cardVariants = {
  default: `
    bg-white dark:bg-whs-dark-800
    border border-gray-100 dark:border-whs-dark-700
    shadow-md dark:shadow-card-dark
  `,
  elevated: `
    bg-white dark:bg-whs-dark-800
    border border-gray-100 dark:border-whs-dark-700
    shadow-lg dark:shadow-card-hover-dark
  `,
  glass: `
    bg-white/70 dark:bg-whs-dark-800/70
    backdrop-blur-lg
    border border-white/30 dark:border-whs-dark-600/50
    shadow-lg
  `,
  outline: `
    bg-transparent
    border-2 border-gray-200 dark:border-whs-dark-600
  `,
  accent: `
    bg-white dark:bg-whs-dark-800
    border border-gray-100 dark:border-whs-dark-700
    border-l-4 border-l-whs-orange-500
    shadow-md dark:shadow-card-dark
  `,
  gradient: `
    bg-gradient-to-br from-white to-gray-50
    dark:from-whs-dark-800 dark:to-whs-dark-900
    border border-gray-100 dark:border-whs-dark-700
    shadow-md dark:shadow-card-dark
  `
}

export function Card({
  children,
  className = '',
  variant = 'default',
  hover = false,
  glow = false,
  onClick,
  animated = false,
  ...props
}) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={`
        rounded-2xl
        transition-all duration-300 ease-out
        ${cardVariants[variant]}
        ${hover ? `
          hover:shadow-xl dark:hover:shadow-card-hover-dark
          hover:-translate-y-1
          cursor-pointer
        ` : ''}
        ${glow ? 'hover:shadow-glow' : ''}
        ${onClick ? 'text-left w-full focus:outline-none focus:ring-4 focus:ring-whs-orange-500/30' : ''}
        ${animated ? 'animate-fade-in-up' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({
  children,
  className = '',
  withBorder = true,
  gradient = false
}) {
  return (
    <div
      className={`
        p-5
        ${withBorder ? 'border-b border-gray-100 dark:border-whs-dark-700' : ''}
        ${gradient ? 'bg-gradient-to-r from-whs-orange-500/5 to-transparent' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function CardContent({ children, className = '', padded = true }) {
  return (
    <div className={`${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({
  children,
  className = '',
  withBorder = true,
  gradient = false
}) {
  return (
    <div
      className={`
        p-4
        rounded-b-2xl
        ${withBorder ? 'border-t border-gray-100 dark:border-whs-dark-700' : ''}
        ${gradient ? 'bg-gradient-to-b from-transparent to-gray-50 dark:to-whs-dark-900' : 'bg-gray-50 dark:bg-whs-dark-900/50'}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

// Stats Card Component
export function StatsCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  className = ''
}) {
  const trendColors = {
    up: 'text-whs-success-500',
    down: 'text-whs-danger-500',
    neutral: 'text-gray-500 dark:text-gray-400'
  }

  return (
    <Card className={`p-5 ${className}`} hover>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <p className={`text-sm mt-1 ${trendColors[trend]}`}>
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trendValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-whs-orange-100 dark:bg-whs-orange-900/30 rounded-xl">
            <span className="text-2xl text-whs-orange-600 dark:text-whs-orange-400">{icon}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

// Feature Card Component
export function FeatureCard({
  icon,
  title,
  description,
  onClick,
  className = '',
  accentColor = 'orange'
}) {
  const accentColors = {
    orange: 'from-whs-orange-500 to-whs-orange-600',
    yellow: 'from-whs-yellow-500 to-whs-yellow-600',
    green: 'from-whs-success-500 to-whs-success-600',
    blue: 'from-whs-info-500 to-whs-info-600',
    red: 'from-whs-danger-500 to-whs-danger-600'
  }

  return (
    <Card
      onClick={onClick}
      hover
      glow
      className={`group ${className}`}
    >
      <CardContent>
        <div
          className={`
            w-14 h-14 rounded-xl mb-4
            bg-gradient-to-br ${accentColors[accentColor]}
            flex items-center justify-center
            group-hover:scale-110 transition-transform duration-300
            shadow-lg shadow-whs-orange-500/20
          `}
        >
          <span className="text-2xl text-white">{icon}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}

export default Card

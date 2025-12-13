export function ModuleCard({
  icon,
  title,
  description,
  gradient = 'from-whs-orange-500 to-whs-orange-600',
  badge,
  onClick,
  delay = 0
}) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white dark:bg-whs-dark-800 rounded-2xl p-6 text-left w-full border border-gray-100 dark:border-whs-dark-700 shadow-md dark:shadow-card-dark hover:shadow-xl dark:hover:shadow-card-hover-dark hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-whs-orange-500/30 overflow-hidden animate-fade-in-up"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Hover Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-whs-orange-500/0 to-whs-orange-500/0 group-hover:from-whs-orange-500/5 group-hover:to-transparent transition-all duration-300" />

      {/* Glow effect on hover */}
      <div className="absolute -inset-px bg-gradient-to-r from-whs-orange-500/0 via-whs-orange-500/0 to-whs-orange-500/0 group-hover:from-whs-orange-500/20 group-hover:via-transparent group-hover:to-whs-orange-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />

      <div className="relative z-10">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
          <div className="text-white">
            {icon}
          </div>
        </div>

        {/* Badge */}
        {badge && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300 mb-3">
            {badge}
          </span>
        )}

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-whs-orange-600 dark:group-hover:text-whs-orange-400 transition-colors">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {description}
        </p>

        {/* Arrow indicator */}
        <div className="mt-4 flex items-center text-whs-orange-500 dark:text-whs-orange-400 text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all duration-300">
          <span>Explore</span>
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  )
}

export default ModuleCard

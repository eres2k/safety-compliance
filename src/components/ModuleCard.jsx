import { useApp } from '../context/AppContext'

const frameworkBorders = {
  AT: 'border-l-red-600',
  DE: 'border-l-yellow-500',
  NL: 'border-l-orange-500'
}

export function ModuleCard({ icon, title, description, onClick }) {
  const { framework } = useApp()

  return (
    <button
      onClick={onClick}
      className={`
        bg-white rounded-xl p-6 shadow-md text-left w-full
        border-l-4 ${frameworkBorders[framework]}
        hover:shadow-lg hover:-translate-y-0.5
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      `}
    >
      <div className="text-3xl mb-3" aria-hidden="true">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  )
}

export default ModuleCard

import { useApp } from '../context/AppContext'
import { ModuleCard } from './ModuleCard'

export function Dashboard({ onModuleSelect }) {
  const { t } = useApp()

  const modules = [
    {
      id: 'lawBrowser',
      icon: '📚',
      title: t.modules.lawBrowser.title,
      description: t.modules.lawBrowser.description
    },
    {
      id: 'complianceChecker',
      icon: '✅',
      title: t.modules.complianceChecker.title,
      description: t.modules.complianceChecker.description
    },
    {
      id: 'documentGenerator',
      icon: '📄',
      title: t.modules.documentGenerator.title,
      description: t.modules.documentGenerator.description
    },
    {
      id: 'quickReference',
      icon: '⚡',
      title: t.modules.quickReference.title,
      description: t.modules.quickReference.description
    },
    {
      id: 'regulationLookup',
      icon: '🔍',
      title: t.modules.regulationLookup.title,
      description: t.modules.regulationLookup.description
    }
  ]

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {modules.map((module) => (
        <ModuleCard
          key={module.id}
          icon={module.icon}
          title={module.title}
          description={module.description}
          onClick={() => onModuleSelect(module.id)}
        />
      ))}
    </div>
  )
}

export default Dashboard

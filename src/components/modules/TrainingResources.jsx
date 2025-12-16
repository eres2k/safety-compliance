import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { Card, CardContent, Button } from '../ui'

// Training resource categories and data
const TRAINING_CATEGORIES = [
  { id: 'onboarding', label: 'New Employee Onboarding', icon: '🎓' },
  { id: 'safety-basics', label: 'Safety Basics', icon: '🛡️' },
  { id: 'manual-handling', label: 'Manual Handling', icon: '📦' },
  { id: 'driving-safety', label: 'Driving Safety', icon: '🚗' },
  { id: 'emergency', label: 'Emergency Procedures', icon: '🚨' },
  { id: 'ppe', label: 'PPE & Equipment', icon: '🦺' },
  { id: 'first-aid', label: 'First Aid', icon: '🏥' },
  { id: 'ergonomics', label: 'Ergonomics', icon: '🪑' },
  { id: 'hazmat', label: 'Hazardous Materials', icon: '☠️' },
  { id: 'mental-health', label: 'Mental Health & Wellbeing', icon: '🧠' }
]

// Training resources by framework
const TRAINING_RESOURCES = {
  AT: [
    {
      id: 'at-1',
      category: 'onboarding',
      title: 'Sicherheitsunterweisung - Grundlagen',
      description: 'Pflichtunterweisung für neue Mitarbeiter gemäß § 14 ASchG',
      type: 'video',
      duration: '45 min',
      legalRef: '§ 14 ASchG',
      url: '#',
      required: true
    },
    {
      id: 'at-2',
      category: 'manual-handling',
      title: 'Richtiges Heben und Tragen',
      description: 'Schulung zur Lastenhandhabung nach VOLV',
      type: 'interactive',
      duration: '30 min',
      legalRef: '§ 62-64 ASchG, VOLV',
      url: '#',
      required: true
    },
    {
      id: 'at-3',
      category: 'first-aid',
      title: 'Erste Hilfe Auffrischung',
      description: 'Jährliche Auffrischung der Erste-Hilfe-Kenntnisse',
      type: 'course',
      duration: '4 hours',
      legalRef: '§ 26 ASchG',
      url: '#',
      required: true
    },
    {
      id: 'at-4',
      category: 'driving-safety',
      title: 'Sicheres Fahren im Lieferverkehr',
      description: 'Defensives Fahren und Ladungssicherung',
      type: 'video',
      duration: '60 min',
      legalRef: 'StVO, FSG',
      url: '#',
      required: false
    },
    {
      id: 'at-5',
      category: 'emergency',
      title: 'Brandschutz und Evakuierung',
      description: 'Verhalten im Brandfall, Fluchwege, Sammelplätze',
      type: 'interactive',
      duration: '25 min',
      legalRef: '§ 25 ASchG, TRVB',
      url: '#',
      required: true
    }
  ],
  DE: [
    {
      id: 'de-1',
      category: 'onboarding',
      title: 'Erstunterweisung Arbeitsschutz',
      description: 'Grundlegende Unterweisung nach § 12 ArbSchG',
      type: 'video',
      duration: '45 min',
      legalRef: '§ 12 ArbSchG',
      url: '#',
      required: true
    },
    {
      id: 'de-2',
      category: 'manual-handling',
      title: 'Lastenhandhabung',
      description: 'Schulung nach Lastenhandhabungsverordnung',
      type: 'interactive',
      duration: '30 min',
      legalRef: 'LasthandhabV, DGUV Info 208-033',
      url: '#',
      required: true
    },
    {
      id: 'de-3',
      category: 'driving-safety',
      title: 'Sicherheit im Straßenverkehr',
      description: 'DGUV Vorschrift 70 - Fahrzeuge',
      type: 'course',
      duration: '90 min',
      legalRef: 'DGUV Vorschrift 70',
      url: '#',
      required: true
    },
    {
      id: 'de-4',
      category: 'emergency',
      title: 'Notfall und Evakuierung',
      description: 'Verhalten im Notfall gemäß ASR A2.3',
      type: 'interactive',
      duration: '20 min',
      legalRef: '§ 10 ArbSchG, ASR A2.3',
      url: '#',
      required: true
    },
    {
      id: 'de-5',
      category: 'mental-health',
      title: 'Psychische Belastungen erkennen',
      description: 'Gefährdungsbeurteilung psychischer Belastung',
      type: 'webinar',
      duration: '60 min',
      legalRef: '§ 5 ArbSchG, GDA-Leitlinie',
      url: '#',
      required: false
    },
    {
      id: 'de-6',
      category: 'ppe',
      title: 'Persönliche Schutzausrüstung',
      description: 'Auswahl, Nutzung und Pflege von PSA',
      type: 'video',
      duration: '25 min',
      legalRef: 'PSA-BV, DGUV Regel 112-989',
      url: '#',
      required: true
    }
  ],
  NL: [
    {
      id: 'nl-1',
      category: 'onboarding',
      title: 'Voorlichting Arbeidsomstandigheden',
      description: 'Verplichte instructie volgens Arbowet Art. 8',
      type: 'video',
      duration: '45 min',
      legalRef: 'Arbowet Art. 8',
      url: '#',
      required: true
    },
    {
      id: 'nl-2',
      category: 'manual-handling',
      title: 'Tillen en Dragen',
      description: 'Training fysieke belasting',
      type: 'interactive',
      duration: '30 min',
      legalRef: 'Arbobesluit Art. 5.2-5.4',
      url: '#',
      required: true
    },
    {
      id: 'nl-3',
      category: 'driving-safety',
      title: 'Veilig Rijden',
      description: 'Verkeersveiligheid voor bezorgers',
      type: 'course',
      duration: '60 min',
      legalRef: 'Arbobesluit Art. 7.17a',
      url: '#',
      required: true
    },
    {
      id: 'nl-4',
      category: 'emergency',
      title: 'BHV Training',
      description: 'Bedrijfshulpverlening basics',
      type: 'course',
      duration: '4 hours',
      legalRef: 'Arbowet Art. 15',
      url: '#',
      required: true
    },
    {
      id: 'nl-5',
      category: 'mental-health',
      title: 'Werkdruk en Stress',
      description: 'Herkennen en aanpakken van werkstress',
      type: 'webinar',
      duration: '45 min',
      legalRef: 'Arbobesluit Art. 2.15',
      url: '#',
      required: false
    }
  ]
}

const TYPE_ICONS = {
  video: '🎬',
  interactive: '🖥️',
  course: '📚',
  webinar: '💻',
  document: '📄'
}

export function TrainingResources({ onBack }) {
  const { framework, frameworkColors, addAuditEntry } = useApp()

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showRequired, setShowRequired] = useState(false)
  const [completedTrainings, setCompletedTrainings] = useState(() => {
    const saved = localStorage.getItem('whs_completed_trainings')
    return saved ? JSON.parse(saved) : []
  })

  // Get resources for current framework
  const resources = useMemo(() => {
    let filtered = TRAINING_RESOURCES[framework] || []
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(r => r.category === selectedCategory)
    }
    if (showRequired) {
      filtered = filtered.filter(r => r.required)
    }
    return filtered
  }, [framework, selectedCategory, showRequired])

  // Toggle training completion
  const toggleCompletion = (resourceId, title) => {
    const isCompleted = completedTrainings.includes(resourceId)
    const updated = isCompleted
      ? completedTrainings.filter(id => id !== resourceId)
      : [...completedTrainings, resourceId]

    setCompletedTrainings(updated)
    localStorage.setItem('whs_completed_trainings', JSON.stringify(updated))

    addAuditEntry({
      action: isCompleted ? 'training_uncompleted' : 'training_completed',
      lawId: resourceId,
      lawTitle: title,
      notes: `Training ${isCompleted ? 'marked incomplete' : 'completed'}: ${title}`
    })
  }

  // Calculate completion stats
  const stats = useMemo(() => {
    const allResources = TRAINING_RESOURCES[framework] || []
    const requiredResources = allResources.filter(r => r.required)
    const completedRequired = requiredResources.filter(r => completedTrainings.includes(r.id))

    return {
      total: allResources.length,
      completed: allResources.filter(r => completedTrainings.includes(r.id)).length,
      requiredTotal: requiredResources.length,
      requiredCompleted: completedRequired.length
    }
  }, [framework, completedTrainings])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-whs-dark-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Resources</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Safety training materials for {frameworkColors[framework]?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overall Progress</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.completed}/{stats.total}
              </p>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" className="text-gray-200 dark:text-whs-dark-700" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" className="text-whs-orange-500" strokeWidth="4"
                  strokeDasharray={`${(stats.completed / stats.total) * 176} 176`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900 dark:text-white">
                {Math.round((stats.completed / stats.total) * 100)}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Required Training</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.requiredCompleted}/{stats.requiredTotal}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              stats.requiredCompleted === stats.requiredTotal
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            }`}>
              {stats.requiredCompleted === stats.requiredTotal ? 'Complete' : 'Incomplete'}
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Categories</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {TRAINING_CATEGORIES.length}
              </p>
            </div>
            <span className="text-3xl">📚</span>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-sm"
            >
              <option value="all">All Categories</option>
              {TRAINING_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRequired}
                onChange={(e) => setShowRequired(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-whs-orange-500 focus:ring-whs-orange-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Required Only</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Training List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map(resource => {
          const category = TRAINING_CATEGORIES.find(c => c.id === resource.category)
          const isCompleted = completedTrainings.includes(resource.id)

          return (
            <Card
              key={resource.id}
              className={`transition-all ${isCompleted ? 'border-green-500/30 bg-green-500/5' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{category?.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {resource.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {resource.description}
                        </p>
                      </div>
                      {resource.required && (
                        <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-xs font-medium rounded">
                          Required
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        {TYPE_ICONS[resource.type]} {resource.type}
                      </span>
                      <span>⏱️ {resource.duration}</span>
                      <span className="text-whs-orange-500">{resource.legalRef}</span>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <button
                        onClick={() => toggleCompletion(resource.id, resource.title)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-whs-dark-600'
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Completed
                          </>
                        ) : (
                          'Mark Complete'
                        )}
                      </button>
                      <Button variant="ghost" size="sm">
                        Start Training →
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {resources.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No training resources found for the selected filters.
          </p>
        </Card>
      )}
    </div>
  )
}

export default TrainingResources

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

// External training resources - curated links to reputable safety training providers
const EXTERNAL_TRAINING_RESOURCES = [
  // International / General
  {
    id: 'ext-1',
    category: 'onboarding',
    title: 'OSHAcademy - Free Safety Courses',
    description: 'Nearly 200 free self-paced OSHA training courses for all industries',
    type: 'course',
    duration: 'Various',
    provider: 'OSHAcademy',
    url: 'https://www.oshacademy.com/',
    region: 'international'
  },
  {
    id: 'ext-2',
    category: 'safety-basics',
    title: 'Oregon OSHA - Free Online Training',
    description: 'Free workplace safety courses including accident investigation, hazard assessment, and more',
    type: 'course',
    duration: 'Various',
    provider: 'Oregon OSHA',
    url: 'https://osha.oregon.gov/edu/courses/pages/default.aspx',
    region: 'international'
  },
  {
    id: 'ext-3',
    category: 'safety-basics',
    title: 'Cal/OSHA Training Academy',
    description: 'Free access to comprehensive workplace safety training courses and materials',
    type: 'course',
    duration: 'Various',
    provider: 'Cal/OSHA',
    url: 'https://trainingacademy.dir.ca.gov/page/home-english',
    region: 'international'
  },
  {
    id: 'ext-4',
    category: 'onboarding',
    title: 'OSHA Training Resources',
    description: 'Official OSHA training page with outreach programs and educational materials',
    type: 'course',
    duration: 'Various',
    provider: 'OSHA.gov',
    url: 'https://www.osha.gov/training',
    region: 'international'
  },
  // Germany-specific
  {
    id: 'ext-de-1',
    category: 'onboarding',
    title: 'DGUV - Training and Qualification',
    description: 'German Social Accident Insurance training portal for occupational safety professionals',
    type: 'course',
    duration: 'Various',
    provider: 'DGUV',
    url: 'https://www.dguv.de/en/qualification/index.jsp',
    region: 'DE'
  },
  {
    id: 'ext-de-2',
    category: 'safety-basics',
    title: 'IAG Dresden - Professional Safety Training',
    description: 'Institute of Work and Health - leading German OSH training center',
    type: 'course',
    duration: 'Various',
    provider: 'DGUV IAG',
    url: 'https://www.dguv.de/iag/qualifizierung/index-2.jsp',
    region: 'DE'
  },
  {
    id: 'ext-de-3',
    category: 'safety-basics',
    title: 'BAuA - Occupational Safety Specialist Training',
    description: 'Federal Institute for Occupational Safety and Health training requirements',
    type: 'document',
    duration: 'Reference',
    provider: 'BAuA',
    url: 'https://www.baua.de/EN/Topics/Work-design/Working-organisation/OSH-Organisation/Training-and-appointment-sifa',
    region: 'DE'
  },
  {
    id: 'ext-de-4',
    category: 'emergency',
    title: 'WINGS Academy - Online Safety Instructions',
    description: 'Online occupational health and safety training courses in German',
    type: 'interactive',
    duration: 'Various',
    provider: 'WINGS Academy',
    url: 'https://www.wingsacademy.de/en/training/course-catalogue/health-and-safety',
    region: 'DE'
  },
  {
    id: 'ext-de-5',
    category: 'emergency',
    title: 'WINGS Academy - Fire Safety Training',
    description: 'Online courses for workplace fire safety training',
    type: 'interactive',
    duration: 'Various',
    provider: 'WINGS Academy',
    url: 'https://www.wingsacademy.de/en/training/course-catalogue/fire-safety',
    region: 'DE'
  },
  // Netherlands-specific
  {
    id: 'ext-nl-1',
    category: 'safety-basics',
    title: 'EU-OSHA Netherlands Portal',
    description: 'Netherlands national focal point for European Agency for Safety and Health at Work',
    type: 'document',
    duration: 'Reference',
    provider: 'EU-OSHA',
    url: 'https://osha.europa.eu/en/about-eu-osha/national-focal-points/netherlands',
    region: 'NL'
  },
  // European Networks
  {
    id: 'ext-eu-1',
    category: 'safety-basics',
    title: 'ENETOSH - European Safety Training Network',
    description: 'European Network Education and Training in Occupational Safety and Health',
    type: 'document',
    duration: 'Reference',
    provider: 'ENETOSH / EU-OSHA',
    url: 'https://healthy-workplaces.osha.europa.eu/en/campaign-partners/european-network-education-and-training-occupational-safety-and-health-enetosh',
    region: 'EU'
  },
  // Professional Certifications
  {
    id: 'ext-cert-1',
    category: 'onboarding',
    title: 'Astutis - IOSH Accredited Training',
    description: 'Internationally recognised health and safety qualifications for Europe',
    type: 'course',
    duration: 'Various',
    provider: 'Astutis',
    url: 'https://www.astutisinternational.com/europe/index.html',
    region: 'EU'
  },
  {
    id: 'ext-cert-2',
    category: 'safety-basics',
    title: 'CareerSafe - OSHA Authorized Training',
    description: 'OSHA 10-Hour and 30-Hour certification courses online',
    type: 'course',
    duration: '10-30 hours',
    provider: 'CareerSafe',
    url: 'https://www.careersafeonline.com/',
    region: 'international'
  },
  {
    id: 'ext-cert-3',
    category: 'safety-basics',
    title: 'Georgia Tech OSHA Education Center',
    description: 'Free introduction to OSHA for small businesses and safety training calendar',
    type: 'course',
    duration: 'Various',
    provider: 'Georgia Tech',
    url: 'https://oshainfo.gatech.edu/safety-and-health-training-events/safety-and-health-training-courses/',
    region: 'international'
  }
]

// Training resources by framework (for internal tracking of training topics)
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
      url: 'https://www.oshacademy.com/',
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
      url: 'https://osha.oregon.gov/edu/courses/pages/default.aspx',
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
      url: 'https://www.oshacademy.com/courses/list/course-catalog.html',
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
      url: 'https://www.careersafeonline.com/',
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
      url: 'https://www.wingsacademy.de/en/training/course-catalogue/fire-safety',
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
      url: 'https://www.dguv.de/en/qualification/index.jsp',
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
      url: 'https://www.dguv.de/iag/qualifizierung/index-2.jsp',
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
      url: 'https://www.dguv.de/en/qualification/index.jsp',
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
      url: 'https://www.wingsacademy.de/en/training/course-catalogue/health-and-safety',
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
      url: 'https://www.baua.de/EN/Topics/Work-design/Working-organisation/OSH-Organisation/Training-and-appointment-sifa',
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
      url: 'https://www.dguv.de/en/qualification/index.jsp',
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
      url: 'https://osha.europa.eu/en/about-eu-osha/national-focal-points/netherlands',
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
      url: 'https://www.oshacademy.com/',
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
      url: 'https://www.careersafeonline.com/',
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
      url: 'https://www.oshacademy.com/courses/list/course-catalog.html',
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
      url: 'https://healthy-workplaces.osha.europa.eu/en/campaign-partners/european-network-education-and-training-occupational-safety-and-health-enetosh',
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

export function TrainingResources({ onBack, embedded = false }) {
  const { framework, frameworkColors, addAuditEntry, language } = useApp()
  const lang = language || 'en'

  // Localized labels
  const labels = {
    en: { title: 'Training Resources', subtitle: 'Safety training materials for', overallProgress: 'Overall Progress', requiredTraining: 'Required Training', categories: 'Categories', filter: 'Filter', allCategories: 'All Categories', requiredOnly: 'Required Only', markComplete: 'Mark Complete', completed: 'Completed', startTraining: 'Start Training', incomplete: 'Incomplete', complete: 'Complete', noResults: 'No training resources found for the selected filters.', externalTitle: 'External Training Resources', externalSubtitle: 'Free and accredited workplace safety training from trusted providers', required: 'Required' },
    de: { title: 'Schulungsressourcen', subtitle: 'Schulungsmaterialien für Arbeitssicherheit für', overallProgress: 'Gesamtfortschritt', requiredTraining: 'Pflichtschulungen', categories: 'Kategorien', filter: 'Filter', allCategories: 'Alle Kategorien', requiredOnly: 'Nur Pflicht', markComplete: 'Als erledigt markieren', completed: 'Abgeschlossen', startTraining: 'Schulung starten', incomplete: 'Unvollständig', complete: 'Vollständig', noResults: 'Keine Schulungsressourcen für die ausgewählten Filter gefunden.', externalTitle: 'Externe Schulungsressourcen', externalSubtitle: 'Kostenlose und akkreditierte Arbeitsschutzschulungen von vertrauenswürdigen Anbietern', required: 'Pflicht' },
    nl: { title: 'Trainingsmaterialen', subtitle: 'Veiligheidstrainingen voor', overallProgress: 'Totale voortgang', requiredTraining: 'Verplichte training', categories: 'Categorieën', filter: 'Filter', allCategories: 'Alle categorieën', requiredOnly: 'Alleen verplicht', markComplete: 'Markeer als voltooid', completed: 'Voltooid', startTraining: 'Start training', incomplete: 'Onvolledig', complete: 'Volledig', noResults: 'Geen trainingsmaterialen gevonden voor de geselecteerde filters.', externalTitle: 'Externe trainingsmaterialen', externalSubtitle: 'Gratis en geaccrediteerde arboveiligheidstraining van betrouwbare aanbieders', required: 'Verplicht' }
  }
  const l = labels[lang] || labels.en

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
          {!embedded && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-whs-dark-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className={`${embedded ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>{l.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {l.subtitle} {frameworkColors[framework]?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{l.overallProgress}</p>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">{l.requiredTraining}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.requiredCompleted}/{stats.requiredTotal}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              stats.requiredCompleted === stats.requiredTotal
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            }`}>
              {stats.requiredCompleted === stats.requiredTotal ? l.complete : l.incomplete}
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{l.categories}</p>
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{l.filter}:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-sm"
            >
              <option value="all">{l.allCategories}</option>
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
              <span className="text-sm text-gray-700 dark:text-gray-300">{l.requiredOnly}</span>
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
                          {l.required}
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
                            {l.completed}
                          </>
                        ) : (
                          l.markComplete
                        )}
                      </button>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-whs-orange-500 hover:bg-whs-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {l.startTraining}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
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
            {l.noResults}
          </p>
        </Card>
      )}

      {/* External Training Resources Section */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {l.externalTitle}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {l.externalSubtitle}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXTERNAL_TRAINING_RESOURCES
            .filter(r => r.region === 'international' || r.region === 'EU' || r.region === framework)
            .map(resource => (
            <a
              key={resource.id}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <Card className="h-full hover:border-whs-orange-500 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-2xl">{TYPE_ICONS[resource.type] || '📚'}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      resource.region === 'DE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      resource.region === 'NL' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                      resource.region === 'EU' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {resource.region === 'international' ? 'Global' : resource.region}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-whs-orange-500 transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {resource.description}
                  </p>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    <span>{resource.provider}</span>
                    <span className="flex items-center gap-1">
                      {resource.duration}
                      <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TrainingResources

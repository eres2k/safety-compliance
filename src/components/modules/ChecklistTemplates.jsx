import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { Card, CardContent, Button } from '../ui'
import { exportChecklist } from '../../services/exportService'

// Pre-built checklist templates
const CHECKLIST_TEMPLATES = {
  'new-site': {
    id: 'new-site',
    title: 'New Site Setup',
    description: 'Safety requirements before commencing operations at a new location',
    icon: '🏗️',
    items: [
      { id: 1, requirement: 'Risk assessment completed and documented', category: 'documentation' },
      { id: 2, requirement: 'Emergency exits identified and marked', category: 'emergency' },
      { id: 3, requirement: 'First aid kit available and stocked', category: 'first-aid' },
      { id: 4, requirement: 'Fire extinguishers installed and inspected', category: 'fire' },
      { id: 5, requirement: 'Safety signage displayed appropriately', category: 'signage' },
      { id: 6, requirement: 'Emergency contact list posted', category: 'emergency' },
      { id: 7, requirement: 'Floor surfaces safe and clear of hazards', category: 'facility' },
      { id: 8, requirement: 'Adequate lighting in all work areas', category: 'facility' },
      { id: 9, requirement: 'PPE available for all workers', category: 'ppe' },
      { id: 10, requirement: 'Workers briefed on site-specific hazards', category: 'training' }
    ]
  },
  'daily-vehicle': {
    id: 'daily-vehicle',
    title: 'Daily Vehicle Inspection',
    description: 'Pre-trip vehicle safety check for delivery drivers',
    icon: '🚗',
    items: [
      { id: 1, requirement: 'Tires - check pressure and tread depth', category: 'vehicle' },
      { id: 2, requirement: 'Lights - headlights, brake lights, indicators', category: 'vehicle' },
      { id: 3, requirement: 'Mirrors - clean and properly adjusted', category: 'vehicle' },
      { id: 4, requirement: 'Windshield - clean, no cracks, wipers working', category: 'vehicle' },
      { id: 5, requirement: 'Brakes - test before departing', category: 'vehicle' },
      { id: 6, requirement: 'Horn - functioning properly', category: 'vehicle' },
      { id: 7, requirement: 'Seatbelt - working correctly', category: 'vehicle' },
      { id: 8, requirement: 'Fuel level - adequate for route', category: 'vehicle' },
      { id: 9, requirement: 'Load secured properly', category: 'cargo' },
      { id: 10, requirement: 'Emergency equipment present (triangle, vest)', category: 'emergency' },
      { id: 11, requirement: 'First aid kit in vehicle', category: 'first-aid' },
      { id: 12, requirement: 'Vehicle documents present', category: 'documentation' }
    ]
  },
  'annual-audit': {
    id: 'annual-audit',
    title: 'Annual Safety Audit',
    description: 'Comprehensive annual workplace safety review',
    icon: '📋',
    items: [
      { id: 1, requirement: 'All risk assessments reviewed and updated', category: 'documentation' },
      { id: 2, requirement: 'Safety policy reviewed and communicated', category: 'policy' },
      { id: 3, requirement: 'Training records complete and current', category: 'training' },
      { id: 4, requirement: 'Incident register reviewed', category: 'documentation' },
      { id: 5, requirement: 'Fire safety equipment inspected', category: 'fire' },
      { id: 6, requirement: 'Emergency procedures tested (drill)', category: 'emergency' },
      { id: 7, requirement: 'First aid supplies restocked', category: 'first-aid' },
      { id: 8, requirement: 'PPE inventory checked and replaced', category: 'ppe' },
      { id: 9, requirement: 'Workplace inspections documented', category: 'documentation' },
      { id: 10, requirement: 'Health surveillance records current', category: 'health' },
      { id: 11, requirement: 'Safety committee meetings held', category: 'management' },
      { id: 12, requirement: 'Contractor safety compliance verified', category: 'contractors' },
      { id: 13, requirement: 'Legal register updated', category: 'compliance' },
      { id: 14, requirement: 'Safety objectives reviewed', category: 'management' }
    ]
  },
  'incident-response': {
    id: 'incident-response',
    title: 'Incident Response',
    description: 'Steps to follow when a workplace incident occurs',
    icon: '🚨',
    items: [
      { id: 1, requirement: 'Scene secured and made safe', category: 'immediate' },
      { id: 2, requirement: 'First aid provided if needed', category: 'first-aid' },
      { id: 3, requirement: 'Emergency services called if required', category: 'emergency' },
      { id: 4, requirement: 'Supervisor/manager notified', category: 'notification' },
      { id: 5, requirement: 'Witnesses identified', category: 'investigation' },
      { id: 6, requirement: 'Photos/evidence collected', category: 'investigation' },
      { id: 7, requirement: 'Incident report form completed', category: 'documentation' },
      { id: 8, requirement: 'Root cause analysis initiated', category: 'investigation' },
      { id: 9, requirement: 'Corrective actions identified', category: 'remediation' },
      { id: 10, requirement: 'Regulatory notification (if required)', category: 'compliance' },
      { id: 11, requirement: 'Affected workers supported', category: 'welfare' },
      { id: 12, requirement: 'Follow-up actions scheduled', category: 'remediation' }
    ]
  },
  'manual-handling': {
    id: 'manual-handling',
    title: 'Manual Handling Assessment',
    description: 'Checklist for assessing manual handling tasks',
    icon: '📦',
    items: [
      { id: 1, requirement: 'Task can be automated or mechanized', category: 'elimination' },
      { id: 2, requirement: 'Load weight assessed', category: 'load' },
      { id: 3, requirement: 'Load size and shape considered', category: 'load' },
      { id: 4, requirement: 'Grip points adequate', category: 'load' },
      { id: 5, requirement: 'Lifting height appropriate', category: 'task' },
      { id: 6, requirement: 'Carrying distance minimized', category: 'task' },
      { id: 7, requirement: 'Twisting movements avoided', category: 'task' },
      { id: 8, requirement: 'Floor surface suitable', category: 'environment' },
      { id: 9, requirement: 'Space adequate for movement', category: 'environment' },
      { id: 10, requirement: 'Lighting sufficient', category: 'environment' },
      { id: 11, requirement: 'Workers trained in safe techniques', category: 'training' },
      { id: 12, requirement: 'Equipment available (trolleys, etc.)', category: 'equipment' }
    ]
  },
  'ppe-inspection': {
    id: 'ppe-inspection',
    title: 'PPE Inspection',
    description: 'Regular inspection of personal protective equipment',
    icon: '🦺',
    items: [
      { id: 1, requirement: 'Safety footwear - intact soles, no damage', category: 'footwear' },
      { id: 2, requirement: 'High-visibility vest - reflective strips intact', category: 'visibility' },
      { id: 3, requirement: 'Gloves - no tears or holes', category: 'hands' },
      { id: 4, requirement: 'Eye protection - no scratches or cracks', category: 'eyes' },
      { id: 5, requirement: 'Hearing protection - clean and functional', category: 'hearing' },
      { id: 6, requirement: 'Hard hat (if required) - no cracks', category: 'head' },
      { id: 7, requirement: 'PPE properly stored when not in use', category: 'storage' },
      { id: 8, requirement: 'PPE fits correctly', category: 'fit' },
      { id: 9, requirement: 'Replacement PPE available', category: 'inventory' },
      { id: 10, requirement: 'PPE training completed', category: 'training' }
    ]
  }
}

export function ChecklistTemplates({ onBack, embedded = false }) {
  const { framework, frameworkColors, addAuditEntry, t, language } = useApp()
  const lang = language || 'en'

  // Localized labels
  const labels = {
    en: { title: 'Compliance Checklists', subtitle: 'Pre-built safety checklists for common scenarios', print: 'Print', save: 'Save', complete: 'Complete', cancel: 'Cancel', startChecklist: 'Start Checklist', recentChecklists: 'Recent Checklists', inProgress: 'In Progress', completed: 'Completed', itemsCompleted: 'items completed', addNotes: 'Add notes...' },
    de: { title: 'Compliance-Checklisten', subtitle: 'Vorgefertigte Sicherheits-Checklisten', print: 'Drucken', save: 'Speichern', complete: 'Abschließen', cancel: 'Abbrechen', startChecklist: 'Checkliste starten', recentChecklists: 'Letzte Checklisten', inProgress: 'In Bearbeitung', completed: 'Abgeschlossen', itemsCompleted: 'Punkte erledigt', addNotes: 'Notizen hinzufügen...' },
    nl: { title: 'Compliance Checklists', subtitle: 'Kant-en-klare veiligheidschecklists', print: 'Afdrukken', save: 'Opslaan', complete: 'Voltooien', cancel: 'Annuleren', startChecklist: 'Checklist starten', recentChecklists: 'Recente Checklists', inProgress: 'In uitvoering', completed: 'Voltooid', itemsCompleted: 'items voltooid', addNotes: 'Notities toevoegen...' }
  }
  const l = labels[lang] || labels.en

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [activeChecklist, setActiveChecklist] = useState(null)
  const [checklistProgress, setChecklistProgress] = useState(() => {
    const saved = localStorage.getItem('whs_checklist_progress')
    return saved ? JSON.parse(saved) : {}
  })

  // Start a new checklist from template
  const startChecklist = (templateId) => {
    const template = CHECKLIST_TEMPLATES[templateId]
    const newChecklist = {
      id: `${templateId}-${Date.now()}`,
      templateId,
      title: template.title,
      startedAt: new Date().toISOString(),
      framework,
      items: template.items.map(item => ({
        ...item,
        completed: false,
        notes: ''
      }))
    }

    setActiveChecklist(newChecklist)
    setSelectedTemplate(null)

    addAuditEntry({
      action: 'checklist_started',
      lawId: templateId,
      lawTitle: template.title,
      notes: `Started checklist: ${template.title}`
    })
  }

  // Toggle item completion
  const toggleItem = (itemId) => {
    if (!activeChecklist) return

    setActiveChecklist(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    }))
  }

  // Add notes to item
  const updateItemNotes = (itemId, notes) => {
    if (!activeChecklist) return

    setActiveChecklist(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, notes } : item
      )
    }))
  }

  // Save checklist progress
  const saveChecklist = () => {
    if (!activeChecklist) return

    const updatedProgress = {
      ...checklistProgress,
      [activeChecklist.id]: {
        ...activeChecklist,
        savedAt: new Date().toISOString()
      }
    }

    setChecklistProgress(updatedProgress)
    localStorage.setItem('whs_checklist_progress', JSON.stringify(updatedProgress))

    addAuditEntry({
      action: 'checklist_saved',
      lawId: activeChecklist.templateId,
      lawTitle: activeChecklist.title,
      notes: `Checklist saved: ${activeChecklist.title}`
    })
  }

  // Complete checklist
  const completeChecklist = () => {
    if (!activeChecklist) return

    const completed = {
      ...activeChecklist,
      completedAt: new Date().toISOString()
    }

    const updatedProgress = {
      ...checklistProgress,
      [activeChecklist.id]: completed
    }

    setChecklistProgress(updatedProgress)
    localStorage.setItem('whs_checklist_progress', JSON.stringify(updatedProgress))

    addAuditEntry({
      action: 'checklist_completed',
      lawId: activeChecklist.templateId,
      lawTitle: activeChecklist.title,
      notes: `Checklist completed: ${activeChecklist.title}`
    })

    setActiveChecklist(null)
  }

  // Export current checklist
  const handleExport = (action) => {
    if (!activeChecklist) return

    exportChecklist({
      ...activeChecklist,
      description: CHECKLIST_TEMPLATES[activeChecklist.templateId]?.description
    }, { framework, action, title: activeChecklist.title })
  }

  // Calculate progress
  const progress = activeChecklist
    ? Math.round((activeChecklist.items.filter(i => i.completed).length / activeChecklist.items.length) * 100)
    : 0

  // Get recent checklists
  const recentChecklists = useMemo(() => {
    return Object.values(checklistProgress)
      .filter(c => c.framework === framework)
      .sort((a, b) => new Date(b.savedAt || b.startedAt) - new Date(a.savedAt || a.startedAt))
      .slice(0, 5)
  }, [checklistProgress, framework])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(!embedded || activeChecklist) && (
            <button
              onClick={activeChecklist ? () => setActiveChecklist(null) : onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-whs-dark-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className={`${embedded ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>
              {activeChecklist ? activeChecklist.title : l.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeChecklist
                ? `${activeChecklist.items.filter(i => i.completed).length}/${activeChecklist.items.length} ${l.itemsCompleted}`
                : l.subtitle}
            </p>
          </div>
        </div>
        {activeChecklist && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleExport('print')}>
              {l.print}
            </Button>
            <Button variant="secondary" size="sm" onClick={saveChecklist}>
              {l.save}
            </Button>
            <Button size="sm" onClick={completeChecklist} disabled={progress < 100}>
              {l.complete}
            </Button>
          </div>
        )}
      </div>

      {activeChecklist ? (
        <>
          {/* Progress Bar */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-gray-200 dark:bg-whs-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-whs-orange-500 to-whs-orange-400 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{progress}%</span>
            </div>
          </Card>

          {/* Checklist Items */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {activeChecklist.items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border transition-all ${
                      item.completed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-gray-50 dark:bg-whs-dark-700 border-gray-200 dark:border-whs-dark-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleItem(item.id)}
                        className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                          item.completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 dark:border-gray-600 hover:border-whs-orange-500'
                        }`}
                      >
                        {item.completed && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium ${item.completed ? 'text-green-700 dark:text-green-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                            {index + 1}. {item.requirement}
                          </p>
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-whs-dark-600 text-gray-600 dark:text-gray-400 text-xs rounded">
                            {item.category}
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder={l.addNotes}
                          value={item.notes}
                          onChange={(e) => updateItemNotes(item.id, e.target.value)}
                          className="mt-2 w-full px-2 py-1 text-sm bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded focus:outline-none focus:ring-1 focus:ring-whs-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(CHECKLIST_TEMPLATES).map(template => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-whs-orange-500/50 transition-colors"
                onClick={() => setSelectedTemplate(template.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{template.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{template.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{template.description}</p>
                      <p className="text-xs text-whs-orange-500 mt-2">{template.items.length} items</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Template Preview Modal */}
          {selectedTemplate && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="max-w-lg w-full max-h-[80vh] overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{CHECKLIST_TEMPLATES[selectedTemplate].icon}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {CHECKLIST_TEMPLATES[selectedTemplate].title}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {CHECKLIST_TEMPLATES[selectedTemplate].items.length} items
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto mb-4">
                    <ul className="space-y-2">
                      {CHECKLIST_TEMPLATES[selectedTemplate].items.map((item, i) => (
                        <li key={item.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0" />
                          {i + 1}. {item.requirement}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setSelectedTemplate(null)}>
                      {l.cancel}
                    </Button>
                    <Button className="flex-1" onClick={() => startChecklist(selectedTemplate)}>
                      {l.startChecklist}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Checklists */}
          {recentChecklists.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{l.recentChecklists}</h3>
                <div className="space-y-3">
                  {recentChecklists.map(checklist => (
                    <div
                      key={checklist.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-whs-dark-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-whs-dark-600"
                      onClick={() => setActiveChecklist(checklist)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{CHECKLIST_TEMPLATES[checklist.templateId]?.icon}</span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{checklist.title}</p>
                          <p className="text-xs text-gray-500">
                            {checklist.completedAt ? l.completed : l.inProgress} •{' '}
                            {new Date(checklist.savedAt || checklist.startedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {checklist.items.filter(i => i.completed).length}/{checklist.items.length}
                        </span>
                        {checklist.completedAt && (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-xs rounded">Done</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export default ChecklistTemplates

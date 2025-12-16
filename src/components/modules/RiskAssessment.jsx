import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { Card, CardContent, Button } from '../ui'

// Risk categories for WHS logistics
const HAZARD_CATEGORIES = [
  { id: 'manual-handling', label: 'Manual Handling', icon: '📦', description: 'Lifting, carrying, pushing, pulling' },
  { id: 'vehicle-safety', label: 'Vehicle Safety', icon: '🚗', description: 'Driving, loading, vehicle maintenance' },
  { id: 'slips-trips', label: 'Slips, Trips & Falls', icon: '⚠️', description: 'Floor conditions, obstacles, heights' },
  { id: 'ergonomics', label: 'Ergonomics', icon: '🪑', description: 'Workstation setup, repetitive movements' },
  { id: 'hazardous-substances', label: 'Hazardous Substances', icon: '☠️', description: 'Chemicals, fumes, dust' },
  { id: 'electrical', label: 'Electrical', icon: '⚡', description: 'Electrical equipment, wiring' },
  { id: 'fire-safety', label: 'Fire Safety', icon: '🔥', description: 'Fire risks, evacuation, equipment' },
  { id: 'psychosocial', label: 'Psychosocial', icon: '🧠', description: 'Stress, workload, harassment' },
  { id: 'machinery', label: 'Machinery', icon: '⚙️', description: 'Moving parts, guards, maintenance' },
  { id: 'weather', label: 'Weather/Environment', icon: '🌡️', description: 'Heat, cold, outdoor conditions' }
]

// Likelihood levels
const LIKELIHOOD = [
  { id: 1, label: 'Rare', color: 'bg-green-500' },
  { id: 2, label: 'Unlikely', color: 'bg-lime-500' },
  { id: 3, label: 'Possible', color: 'bg-yellow-500' },
  { id: 4, label: 'Likely', color: 'bg-orange-500' },
  { id: 5, label: 'Almost Certain', color: 'bg-red-500' }
]

// Consequence levels
const CONSEQUENCE = [
  { id: 1, label: 'Negligible', color: 'bg-green-500' },
  { id: 2, label: 'Minor', color: 'bg-lime-500' },
  { id: 3, label: 'Moderate', color: 'bg-yellow-500' },
  { id: 4, label: 'Major', color: 'bg-orange-500' },
  { id: 5, label: 'Catastrophic', color: 'bg-red-500' }
]

// Risk matrix calculation
function calculateRiskLevel(likelihood, consequence) {
  const score = likelihood * consequence
  if (score <= 4) return { level: 'Low', color: 'bg-green-500', textColor: 'text-green-500' }
  if (score <= 9) return { level: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-500' }
  if (score <= 15) return { level: 'High', color: 'bg-orange-500', textColor: 'text-orange-500' }
  return { level: 'Critical', color: 'bg-red-500', textColor: 'text-red-500' }
}

// Legal references by hazard category and framework
const LEGAL_REFERENCES = {
  AT: {
    'manual-handling': ['§ 62-64 ASchG - Lasten', 'VOLV - Verordnung über Lastenhandhabung'],
    'vehicle-safety': ['§ 35 ASchG - Arbeitsmittel', 'FSG - Führerscheingesetz'],
    'slips-trips': ['§ 8 ASchG - Arbeitsstätten', 'AStV - Arbeitsstättenverordnung'],
    'ergonomics': ['§ 60-61 ASchG - Bildschirmarbeit', 'BS-V - Bildschirmarbeitsverordnung'],
    'fire-safety': ['§ 25 ASchG - Brandschutz', 'TRVB - Technische Richtlinien'],
    'psychosocial': ['§ 2 ASchG - Gefahrenverhütung', 'ASchG Evaluierung'],
  },
  DE: {
    'manual-handling': ['§ 2 LasthandhabV', 'DGUV Information 208-033'],
    'vehicle-safety': ['§ 35 ArbSchG', 'DGUV Vorschrift 70', 'StVO'],
    'slips-trips': ['§ 3a ArbStättV', 'ASR A1.5/1,2'],
    'ergonomics': ['§ 3 BildscharbV', 'DGUV Information 215-410'],
    'fire-safety': ['§ 10 ArbSchG', 'ASR A2.2', 'DGUV Information 205-001'],
    'psychosocial': ['§ 5 ArbSchG', 'GDA-Leitlinie Psyche'],
  },
  NL: {
    'manual-handling': ['Arbobesluit Art. 5.2-5.4', 'AI-blad Tillen'],
    'vehicle-safety': ['Arbobesluit Art. 7.17a', 'Wegenverkeerswet'],
    'slips-trips': ['Arbobesluit Art. 3.2', 'AI-blad Vloeren'],
    'ergonomics': ['Arbobesluit Art. 5.4', 'AI-blad Beeldschermwerk'],
    'fire-safety': ['Arbobesluit Art. 3.7', 'Bouwbesluit'],
    'psychosocial': ['Arbowet Art. 3', 'Arbobesluit Art. 2.15'],
  }
}

export function RiskAssessment({ onBack }) {
  const { framework, frameworkColors, addAuditEntry } = useApp()

  const [assessments, setAssessments] = useState(() => {
    const saved = localStorage.getItem('whs_risk_assessments')
    return saved ? JSON.parse(saved) : []
  })

  const [selectedHazard, setSelectedHazard] = useState(null)
  const [newAssessment, setNewAssessment] = useState({
    hazardId: '',
    description: '',
    likelihood: 3,
    consequence: 3,
    controls: '',
    residualLikelihood: 2,
    residualConsequence: 2
  })

  // Save assessments to localStorage
  const saveAssessments = (newAssessments) => {
    setAssessments(newAssessments)
    localStorage.setItem('whs_risk_assessments', JSON.stringify(newAssessments))
  }

  // Add new assessment
  const handleAddAssessment = () => {
    if (!newAssessment.hazardId || !newAssessment.description) return

    const assessment = {
      id: Date.now(),
      framework,
      createdAt: new Date().toISOString(),
      ...newAssessment,
      inherentRisk: calculateRiskLevel(newAssessment.likelihood, newAssessment.consequence),
      residualRisk: calculateRiskLevel(newAssessment.residualLikelihood, newAssessment.residualConsequence)
    }

    saveAssessments([assessment, ...assessments])
    addAuditEntry({
      action: 'risk_assessment_added',
      lawId: newAssessment.hazardId,
      notes: `Risk assessment added for ${HAZARD_CATEGORIES.find(h => h.id === newAssessment.hazardId)?.label}`
    })

    // Reset form
    setNewAssessment({
      hazardId: '',
      description: '',
      likelihood: 3,
      consequence: 3,
      controls: '',
      residualLikelihood: 2,
      residualConsequence: 2
    })
  }

  // Delete assessment
  const handleDeleteAssessment = (id) => {
    saveAssessments(assessments.filter(a => a.id !== id))
  }

  // Get risk summary
  const riskSummary = useMemo(() => {
    const frameworkAssessments = assessments.filter(a => a.framework === framework)
    return {
      total: frameworkAssessments.length,
      critical: frameworkAssessments.filter(a => a.residualRisk.level === 'Critical').length,
      high: frameworkAssessments.filter(a => a.residualRisk.level === 'High').length,
      medium: frameworkAssessments.filter(a => a.residualRisk.level === 'Medium').length,
      low: frameworkAssessments.filter(a => a.residualRisk.level === 'Low').length
    }
  }, [assessments, framework])

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Risk Assessment Matrix</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Identify and evaluate workplace hazards for {frameworkColors[framework]?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Risk Summary */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{riskSummary.total}</div>
          <div className="text-sm text-gray-500">Total Risks</div>
        </Card>
        <Card className="p-4 text-center border-red-500/20 bg-red-500/5">
          <div className="text-3xl font-bold text-red-500">{riskSummary.critical}</div>
          <div className="text-sm text-gray-500">Critical</div>
        </Card>
        <Card className="p-4 text-center border-orange-500/20 bg-orange-500/5">
          <div className="text-3xl font-bold text-orange-500">{riskSummary.high}</div>
          <div className="text-sm text-gray-500">High</div>
        </Card>
        <Card className="p-4 text-center border-yellow-500/20 bg-yellow-500/5">
          <div className="text-3xl font-bold text-yellow-500">{riskSummary.medium}</div>
          <div className="text-sm text-gray-500">Medium</div>
        </Card>
        <Card className="p-4 text-center border-green-500/20 bg-green-500/5">
          <div className="text-3xl font-bold text-green-500">{riskSummary.low}</div>
          <div className="text-sm text-gray-500">Low</div>
        </Card>
      </div>

      {/* Risk Matrix Visual */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk Matrix</h3>
          <div className="overflow-x-auto">
            <div className="inline-block">
              <div className="flex">
                <div className="w-24" />
                {CONSEQUENCE.map(c => (
                  <div key={c.id} className="w-20 text-center text-xs font-medium text-gray-600 dark:text-gray-400 pb-2">
                    {c.label}
                  </div>
                ))}
              </div>
              {[...LIKELIHOOD].reverse().map(l => (
                <div key={l.id} className="flex">
                  <div className="w-24 text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    {l.label}
                  </div>
                  {CONSEQUENCE.map(c => {
                    const risk = calculateRiskLevel(l.id, c.id)
                    const count = assessments.filter(
                      a => a.framework === framework && a.residualLikelihood === l.id && a.residualConsequence === c.id
                    ).length
                    return (
                      <div
                        key={c.id}
                        className={`w-20 h-12 ${risk.color} ${risk.color === 'bg-green-500' ? 'bg-opacity-30' : risk.color === 'bg-yellow-500' ? 'bg-opacity-40' : risk.color === 'bg-orange-500' ? 'bg-opacity-50' : 'bg-opacity-60'} border border-white/20 flex items-center justify-center`}
                      >
                        {count > 0 && (
                          <span className="text-sm font-bold text-white bg-black/30 rounded-full w-6 h-6 flex items-center justify-center">
                            {count}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4 mt-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" /> Low (1-4)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded" /> Medium (5-9)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded" /> High (10-15)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded" /> Critical (16-25)</span>
          </div>
        </CardContent>
      </Card>

      {/* Add New Assessment */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Risk Assessment</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hazard Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hazard Category
              </label>
              <select
                value={newAssessment.hazardId}
                onChange={(e) => {
                  setNewAssessment({ ...newAssessment, hazardId: e.target.value })
                  setSelectedHazard(HAZARD_CATEGORIES.find(h => h.id === e.target.value))
                }}
                className="w-full px-3 py-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whs-orange-500"
              >
                <option value="">Select hazard category...</option>
                {HAZARD_CATEGORIES.map(h => (
                  <option key={h.id} value={h.id}>{h.icon} {h.label}</option>
                ))}
              </select>
              {selectedHazard && (
                <p className="text-xs text-gray-500 mt-1">{selectedHazard.description}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Specific Hazard Description
              </label>
              <input
                type="text"
                value={newAssessment.description}
                onChange={(e) => setNewAssessment({ ...newAssessment, description: e.target.value })}
                placeholder="e.g., Heavy package lifting without equipment"
                className="w-full px-3 py-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whs-orange-500"
              />
            </div>

            {/* Inherent Risk */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Inherent Risk (Before Controls)</h4>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Likelihood</label>
                  <select
                    value={newAssessment.likelihood}
                    onChange={(e) => setNewAssessment({ ...newAssessment, likelihood: parseInt(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded text-sm"
                  >
                    {LIKELIHOOD.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Consequence</label>
                  <select
                    value={newAssessment.consequence}
                    onChange={(e) => setNewAssessment({ ...newAssessment, consequence: parseInt(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded text-sm"
                  >
                    {CONSEQUENCE.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Risk Level</label>
                  <div className={`px-2 py-1.5 ${calculateRiskLevel(newAssessment.likelihood, newAssessment.consequence).color} text-white rounded text-sm text-center font-medium`}>
                    {calculateRiskLevel(newAssessment.likelihood, newAssessment.consequence).level}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Control Measures
              </label>
              <textarea
                value={newAssessment.controls}
                onChange={(e) => setNewAssessment({ ...newAssessment, controls: e.target.value })}
                placeholder="e.g., Provide lifting equipment, training on safe lifting techniques..."
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whs-orange-500"
              />
            </div>

            {/* Residual Risk */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Residual Risk (After Controls)</h4>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Likelihood</label>
                  <select
                    value={newAssessment.residualLikelihood}
                    onChange={(e) => setNewAssessment({ ...newAssessment, residualLikelihood: parseInt(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded text-sm"
                  >
                    {LIKELIHOOD.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Consequence</label>
                  <select
                    value={newAssessment.residualConsequence}
                    onChange={(e) => setNewAssessment({ ...newAssessment, residualConsequence: parseInt(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded text-sm"
                  >
                    {CONSEQUENCE.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Risk Level</label>
                  <div className={`px-2 py-1.5 ${calculateRiskLevel(newAssessment.residualLikelihood, newAssessment.residualConsequence).color} text-white rounded text-sm text-center font-medium`}>
                    {calculateRiskLevel(newAssessment.residualLikelihood, newAssessment.residualConsequence).level}
                  </div>
                </div>
              </div>
            </div>

            {/* Legal References */}
            {selectedHazard && LEGAL_REFERENCES[framework]?.[selectedHazard.id] && (
              <div className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                  Relevant Legal References ({frameworkColors[framework]?.lawName})
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  {LEGAL_REFERENCES[framework][selectedHazard.id].map((ref, i) => (
                    <li key={i}>• {ref}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleAddAssessment} disabled={!newAssessment.hazardId || !newAssessment.description}>
              Add Assessment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Assessments */}
      {assessments.filter(a => a.framework === framework).length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Current Assessments ({assessments.filter(a => a.framework === framework).length})
            </h3>
            <div className="space-y-3">
              {assessments.filter(a => a.framework === framework).map(assessment => {
                const hazard = HAZARD_CATEGORIES.find(h => h.id === assessment.hazardId)
                return (
                  <div
                    key={assessment.id}
                    className="p-4 bg-gray-50 dark:bg-whs-dark-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{hazard?.icon}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{hazard?.label}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${assessment.residualRisk.color} text-white`}>
                            {assessment.residualRisk.level}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{assessment.description}</p>
                        {assessment.controls && (
                          <p className="text-xs text-gray-500 mt-2">
                            <strong>Controls:</strong> {assessment.controls}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteAssessment(assessment.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default RiskAssessment

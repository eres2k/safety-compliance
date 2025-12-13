import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Button, Input, Card, CardContent } from '../ui'

// Tool icons as SVG components
const toolIcons = {
  deadline: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  personnel: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  penalty: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  glossary: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

const toolGradients = {
  deadline: 'from-whs-orange-500 to-whs-orange-600',
  personnel: 'from-whs-info-500 to-whs-info-600',
  penalty: 'from-whs-danger-500 to-whs-danger-600',
  glossary: 'from-purple-500 to-purple-600'
}

export function QuickReference({ onBack }) {
  const { t, laws, framework, currentFrameworkColor } = useApp()
  const [activeTool, setActiveTool] = useState('deadline')
  const [employees, setEmployees] = useState('')
  const [lastInspection, setLastInspection] = useState('')
  const [calcResult, setCalcResult] = useState(null)
  const [glossarySearch, setGlossarySearch] = useState('')

  const tools = [
    { id: 'deadline', label: t.tools.deadlineCalculator },
    { id: 'personnel', label: t.tools.personnelCalculator },
    { id: 'penalty', label: t.tools.penaltyLookup },
    { id: 'glossary', label: t.tools.glossary }
  ]

  const calculateDeadline = () => {
    if (!lastInspection) return
    const lastDate = new Date(lastInspection)
    const nextDate = new Date(lastDate)
    nextDate.setFullYear(nextDate.getFullYear() + 1)

    const daysUntil = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24))

    setCalcResult({
      nextInspection: nextDate.toLocaleDateString(),
      daysRemaining: daysUntil,
      status: daysUntil < 0 ? 'overdue' : daysUntil < 30 ? 'urgent' : 'ok'
    })
  }

  const calculatePersonnel = () => {
    const emp = parseInt(employees)
    if (isNaN(emp) || emp < 1) return

    const reqs = laws.personnelRequirements
    let results = {}

    if (framework === 'AT') {
      const svpReq = reqs.svp?.find(r => emp >= r.min && (r.max === null || emp <= r.max))
      results = {
        'SVP (Sicherheitsvertrauenspersonen)': svpReq?.count || svpReq?.formula || 0,
        'SFK (Sicherheitsfachkraft)': reqs.preventionTime?.other + ' h/employee/year',
        'AMed (Arbeitsmediziner)': reqs.preventionTime?.other + ' h/employee/year',
        'ASA Required': emp > reqs.asa?.threshold ? 'Yes' : 'No'
      }
    } else if (framework === 'DE') {
      results = {
        'SiBe (Sicherheitsbeauftragte)': emp >= 20 ? 'Required (see DGUV V1 Anlage 2)' : 'Not required',
        'FaSi (Fachkraft für Arbeitssicherheit)': `${reqs.fasi?.hours?.groupII || 1.5} h/employee/year (Group II)`,
        'Betriebsarzt': `${reqs.betriebsarzt?.hours?.groupII || 0.5} h/employee/year (Group II)`,
        'ASA Required': emp > 20 ? 'Yes' : 'No'
      }
    } else {
      results = {
        'Preventiemedewerker': emp <= 25 ? 'Employer can fulfill role' : 'Required',
        'BHV (Bedrijfshulpverlening)': `Min. ${Math.ceil(emp / 50)} person(s)`,
        'Arbodienst': reqs.arbodienst?.maatwerkregeling || 'Required',
        'RI&E Toetsing': emp <= 25 ? 'Exempt with recognized tool' : 'Required'
      }
    }

    setCalcResult(results)
  }

  const filteredGlossary = laws.glossary?.filter(item =>
    glossarySearch === '' ||
    item.abbr.toLowerCase().includes(glossarySearch.toLowerCase()) ||
    item.full.toLowerCase().includes(glossarySearch.toLowerCase()) ||
    item.description?.toLowerCase().includes(glossarySearch.toLowerCase())
  )

  const statusColors = {
    overdue: {
      bg: 'bg-whs-danger-100 dark:bg-whs-danger-500/20',
      text: 'text-whs-danger-600 dark:text-whs-danger-400',
      border: 'border-whs-danger-200 dark:border-whs-danger-500/30'
    },
    urgent: {
      bg: 'bg-whs-yellow-100 dark:bg-whs-yellow-500/20',
      text: 'text-whs-yellow-600 dark:text-whs-yellow-400',
      border: 'border-whs-yellow-200 dark:border-whs-yellow-500/30'
    },
    ok: {
      bg: 'bg-whs-success-100 dark:bg-whs-success-500/20',
      text: 'text-whs-success-600 dark:text-whs-success-400',
      border: 'border-whs-success-200 dark:border-whs-success-500/30'
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-whs-orange-500 dark:hover:text-whs-orange-400 transition-colors"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {t.common.back}
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-whs-yellow-500/10 dark:bg-whs-yellow-500/20 rounded-full border border-whs-yellow-500/20">
          <svg className="w-4 h-4 text-whs-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm font-medium text-whs-yellow-600 dark:text-whs-yellow-400">Quick Tools</span>
        </div>
      </div>

      {/* Title Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-whs-yellow-500 to-whs-yellow-600 flex items-center justify-center shadow-lg shadow-whs-yellow-500/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.modules.quickReference.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Calculators and reference tools for {currentFrameworkColor?.lawName || framework} compliance
            </p>
          </div>
        </div>
      </div>

      {/* Tool Tabs */}
      <div className="flex flex-wrap gap-3 mb-8">
        {tools.map((tool, index) => (
          <button
            key={tool.id}
            onClick={() => { setActiveTool(tool.id); setCalcResult(null) }}
            className={`
              group flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-300 animate-fade-in-up
              ${activeTool === tool.id
                ? `bg-gradient-to-r ${toolGradients[tool.id]} text-white shadow-lg`
                : 'bg-white dark:bg-whs-dark-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-whs-dark-700 hover:border-whs-orange-300 dark:hover:border-whs-orange-500/50 hover:shadow-md'}
            `}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <span className={activeTool === tool.id ? 'text-white' : 'text-gray-500 dark:text-gray-400'}>
              {toolIcons[tool.id]}
            </span>
            {tool.label}
          </button>
        ))}
      </div>

      {/* Tool Content */}
      <Card variant="glass" className="overflow-hidden">
        <CardContent className="p-6">
          {/* Deadline Calculator */}
          {activeTool === 'deadline' && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${toolGradients.deadline} flex items-center justify-center text-white`}>
                  {toolIcons.deadline}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t.tools.deadlineCalculator}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Calculate your next inspection deadline
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t.calculators.lastInspection}
                  </label>
                  <Input
                    type="date"
                    value={lastInspection}
                    onChange={(e) => setLastInspection(e.target.value)}
                    variant="glass"
                  />
                </div>
              </div>

              <Button onClick={calculateDeadline} variant="primary" className="mb-6">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {t.common.calculate}
                </span>
              </Button>

              {calcResult && (
                <div className={`
                  p-6 rounded-2xl border transition-all animate-fade-in-up
                  ${statusColors[calcResult.status].bg}
                  ${statusColors[calcResult.status].border}
                `}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t.calculators.nextInspection}
                    </p>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[calcResult.status].bg} ${statusColors[calcResult.status].text}`}>
                      {calcResult.status === 'overdue' ? 'Overdue' : calcResult.status === 'urgent' ? 'Urgent' : 'On Track'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {calcResult.nextInspection}
                  </p>
                  <p className={`text-lg font-semibold ${statusColors[calcResult.status].text}`}>
                    {calcResult.daysRemaining < 0
                      ? `${Math.abs(calcResult.daysRemaining)} ${t.calculators.daysOverdue}`
                      : `${calcResult.daysRemaining} ${t.calculators.daysRemaining}`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Personnel Calculator */}
          {activeTool === 'personnel' && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${toolGradients.personnel} flex items-center justify-center text-white`}>
                  {toolIcons.personnel}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t.tools.personnelCalculator}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Calculate required safety personnel based on company size
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <div className="space-y-2 max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t.calculators.numberOfEmployees}
                  </label>
                  <Input
                    type="number"
                    value={employees}
                    onChange={(e) => setEmployees(e.target.value)}
                    placeholder={t.calculators.enterEmployees}
                    min="1"
                    variant="glass"
                  />
                </div>
              </div>

              <Button onClick={calculatePersonnel} variant="primary" className="mb-6">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {t.common.calculate}
                </span>
              </Button>

              {calcResult && (
                <div className="space-y-3 animate-fade-in-up">
                  {Object.entries(calcResult).map(([key, value], index) => (
                    <div
                      key={key}
                      className="flex justify-between items-center p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-100 dark:border-whs-dark-700 animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-300">{key}</span>
                      <span className="text-whs-info-600 dark:text-whs-info-400 font-bold bg-whs-info-50 dark:bg-whs-info-500/20 px-3 py-1 rounded-lg">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Penalty Lookup */}
          {activeTool === 'penalty' && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${toolGradients.penalty} flex items-center justify-center text-white`}>
                  {toolIcons.penalty}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t.tools.penaltyLookup}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    View potential penalties for safety violations
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-whs-dark-700">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-whs-dark-800">
                      <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-whs-dark-700">
                        Violation
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-whs-dark-700">
                        Max Penalty
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-whs-dark-700">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {laws.penalties?.map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 dark:border-whs-dark-700 hover:bg-gray-50 dark:hover:bg-whs-dark-800/50 transition-colors animate-fade-in-up"
                        style={{ animationDelay: `${i * 0.03}s` }}
                      >
                        <td className="p-4 text-gray-700 dark:text-gray-300">{item.violation}</td>
                        <td className="p-4">
                          <span className="text-whs-danger-600 dark:text-whs-danger-400 font-bold bg-whs-danger-50 dark:bg-whs-danger-500/20 px-2 py-1 rounded-lg">
                            {item.penalty}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500 dark:text-gray-400 text-sm font-mono">
                          {item.reference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Glossary */}
          {activeTool === 'glossary' && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${toolGradients.glossary} flex items-center justify-center text-white`}>
                  {toolIcons.glossary}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t.tools.glossary}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Safety abbreviations and terminology
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <Input
                    type="text"
                    value={glossarySearch}
                    onChange={(e) => setGlossarySearch(e.target.value)}
                    placeholder="Search abbreviations..."
                    className="pl-10"
                    variant="glass"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredGlossary?.map((item, i) => (
                  <div
                    key={i}
                    className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-100 dark:border-whs-dark-700 hover:border-purple-200 dark:hover:border-purple-500/30 transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20 px-3 py-1 rounded-lg min-w-[80px] text-center">
                        {item.abbr}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">{item.full}</span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-[96px]">
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}

                {filteredGlossary?.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      No results found for "{glossarySearch}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default QuickReference

import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Button, Input, Card, CardContent } from '../ui'

export function QuickReference({ onBack }) {
  const { t, laws, framework } = useApp()
  const [activeTool, setActiveTool] = useState('deadline')
  const [employees, setEmployees] = useState('')
  const [lastInspection, setLastInspection] = useState('')
  const [calcResult, setCalcResult] = useState(null)

  const tools = [
    { id: 'deadline', label: t.tools.deadlineCalculator, icon: '📅' },
    { id: 'personnel', label: t.tools.personnelCalculator, icon: '👥' },
    { id: 'penalty', label: t.tools.penaltyLookup, icon: '⚖️' },
    { id: 'glossary', label: t.tools.glossary, icon: '📖' }
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

  return (
    <div className="fade-in">
      <button
        onClick={onBack}
        className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
      >
        ← {t.common.back}
      </button>

      <h2 className="text-2xl font-bold mb-6">{t.modules.quickReference.title}</h2>

      {/* Tool Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => { setActiveTool(tool.id); setCalcResult(null) }}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${activeTool === tool.id
                ? 'bg-blue-600 text-white'
                : 'bg-white border hover:bg-gray-50'}
            `}
          >
            {tool.icon} {tool.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          {/* Deadline Calculator */}
          {activeTool === 'deadline' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">{t.tools.deadlineCalculator}</h3>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <Input
                  type="date"
                  label={t.calculators.lastInspection}
                  value={lastInspection}
                  onChange={(e) => setLastInspection(e.target.value)}
                />
              </div>
              <Button onClick={calculateDeadline}>
                {t.common.calculate}
              </Button>

              {calcResult && (
                <div className={`
                  mt-4 p-4 rounded-lg
                  ${calcResult.status === 'overdue' ? 'bg-red-100' :
                    calcResult.status === 'urgent' ? 'bg-yellow-100' : 'bg-green-100'}
                `}>
                  <p className="font-medium">{t.calculators.nextInspection}: {calcResult.nextInspection}</p>
                  <p className={`
                    text-lg font-bold
                    ${calcResult.status === 'overdue' ? 'text-red-600' :
                      calcResult.status === 'urgent' ? 'text-yellow-600' : 'text-green-600'}
                  `}>
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
            <div>
              <h3 className="text-lg font-semibold mb-4">{t.tools.personnelCalculator}</h3>
              <div className="mb-4">
                <Input
                  type="number"
                  label={t.calculators.numberOfEmployees}
                  value={employees}
                  onChange={(e) => setEmployees(e.target.value)}
                  placeholder={t.calculators.enterEmployees}
                  min="1"
                />
              </div>
              <Button onClick={calculatePersonnel}>
                {t.common.calculate}
              </Button>

              {calcResult && (
                <div className="mt-4 space-y-3">
                  {Object.entries(calcResult).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{key}</span>
                      <span className="text-blue-600 font-bold">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Penalty Lookup */}
          {activeTool === 'penalty' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">{t.tools.penaltyLookup}</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left p-3">Violation</th>
                      <th className="text-left p-3">Max Penalty</th>
                      <th className="text-left p-3">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laws.penalties?.map((item, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-3">{item.violation}</td>
                        <td className="p-3 text-red-600 font-medium">{item.penalty}</td>
                        <td className="p-3 text-gray-600">{item.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Glossary */}
          {activeTool === 'glossary' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">{t.tools.glossary}</h3>
              <div className="space-y-2">
                {laws.glossary?.map((item, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-blue-600 min-w-[80px]">{item.abbr}</span>
                      <span className="font-medium">{item.full}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 ml-[92px]">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default QuickReference

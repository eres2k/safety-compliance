import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Button, Input, Card, CardContent } from '../ui'

// Tool icons as SVG components
const toolIcons = {
  praevention: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

// Präventionszeit data based on DGUV Vorschrift 2 Anlage 2
const BETREUUNGSGRUPPEN = {
  I: {
    name: { en: 'Group I - High Hazard', de: 'Gruppe I - Hohes Gefährdungspotenzial', nl: 'Groep I - Hoog risico' },
    description: { en: 'Construction, mining, chemicals', de: 'Bau, Bergbau, Chemie', nl: 'Bouw, mijnbouw, chemie' },
    fasi: 2.5,
    betriebsarzt: 1.5
  },
  II: {
    name: { en: 'Group II - Medium Hazard', de: 'Gruppe II - Mittleres Gefährdungspotenzial', nl: 'Groep II - Gemiddeld risico' },
    description: { en: 'Manufacturing, logistics, transport', de: 'Fertigung, Logistik, Transport', nl: 'Productie, logistiek, transport' },
    fasi: 1.5,
    betriebsarzt: 0.5
  },
  III: {
    name: { en: 'Group III - Low Hazard', de: 'Gruppe III - Geringes Gefährdungspotenzial', nl: 'Groep III - Laag risico' },
    description: { en: 'Office, retail, food service', de: 'Büro, Einzelhandel, Gastronomie', nl: 'Kantoor, detailhandel, horeca' },
    fasi: 0.5,
    betriebsarzt: 0.3
  },
  IV: {
    name: { en: 'Group IV - Very Low Hazard', de: 'Gruppe IV - Sehr geringes Gefährdungspotenzial', nl: 'Groep IV - Zeer laag risico' },
    description: { en: 'Pure office work', de: 'Reine Büroarbeit', nl: 'Zuiver kantoorwerk' },
    fasi: 0.2,
    betriebsarzt: 0.1
  }
}

const toolGradients = {
  praevention: 'from-emerald-500 to-emerald-600',
  personnel: 'from-whs-info-500 to-whs-info-600',
  penalty: 'from-whs-danger-500 to-whs-danger-600',
  glossary: 'from-purple-500 to-purple-600'
}

export function QuickReference({ onBack }) {
  const { t, laws, framework, currentFrameworkColor, language } = useApp()
  const [activeTool, setActiveTool] = useState('praevention')
  const [employees, setEmployees] = useState('')
  const [calcResult, setCalcResult] = useState(null)
  const [glossarySearch, setGlossarySearch] = useState('')

  // Präventionszeit calculator state
  const [praeventionEmployees, setPraeventionEmployees] = useState('')
  const [betreuungsgruppe, setBetreuungsgruppe] = useState('II') // Default to Group II (logistics)
  const [praeventionResult, setPraeventionResult] = useState(null)

  const lang = language || 'en'

  const tools = [
    { id: 'praevention', label: lang === 'de' ? 'Präventionszeit-Rechner' : lang === 'nl' ? 'Preventietijd Calculator' : 'Prevention Time Calculator' },
    { id: 'personnel', label: t.tools.personnelCalculator },
    { id: 'penalty', label: t.tools.penaltyLookup },
    { id: 'glossary', label: t.tools.glossary }
  ]

  const calculatePraeventionszeit = () => {
    const emp = parseInt(praeventionEmployees)
    if (isNaN(emp) || emp < 1) return

    const gruppe = BETREUUNGSGRUPPEN[betreuungsgruppe]
    const fasiHoursPerEmployee = gruppe.fasi
    const baHoursPerEmployee = gruppe.betriebsarzt

    const totalFasiHours = emp * fasiHoursPerEmployee
    const totalBaHours = emp * baHoursPerEmployee
    const totalHours = totalFasiHours + totalBaHours

    // Convert to days (8h workday)
    const fasiDays = (totalFasiHours / 8).toFixed(1)
    const baDays = (totalBaHours / 8).toFixed(1)
    const totalDays = (totalHours / 8).toFixed(1)

    // Monthly breakdown
    const fasiMonthly = (totalFasiHours / 12).toFixed(1)
    const baMonthly = (totalBaHours / 12).toFixed(1)

    setPraeventionResult({
      employees: emp,
      gruppe: betreuungsgruppe,
      gruppeName: gruppe.name[lang] || gruppe.name.en,
      fasiPerEmployee: fasiHoursPerEmployee,
      baPerEmployee: baHoursPerEmployee,
      totalFasiHours: totalFasiHours.toFixed(1),
      totalBaHours: totalBaHours.toFixed(1),
      totalHours: totalHours.toFixed(1),
      fasiDays,
      baDays,
      totalDays,
      fasiMonthly,
      baMonthly
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
          {/* Präventionszeit Calculator */}
          {activeTool === 'praevention' && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${toolGradients.praevention} flex items-center justify-center text-white`}>
                  {toolIcons.praevention}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {lang === 'de' ? 'Präventionszeit-Rechner' : lang === 'nl' ? 'Preventietijd Calculator' : 'Prevention Time Calculator'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {lang === 'de' ? 'Berechnen Sie die erforderlichen Stunden für Sicherheitsfachkraft und Betriebsarzt (DGUV Vorschrift 2)' :
                     lang === 'nl' ? 'Bereken de vereiste uren voor veiligheidsexpert en bedrijfsarts' :
                     'Calculate required hours for safety specialist and company doctor (DGUV Regulation 2)'}
                  </p>
                </div>
              </div>

              {/* Input Fields */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {lang === 'de' ? 'Anzahl der Beschäftigten' : lang === 'nl' ? 'Aantal werknemers' : 'Number of Employees'}
                  </label>
                  <Input
                    type="number"
                    value={praeventionEmployees}
                    onChange={(e) => setPraeventionEmployees(e.target.value)}
                    placeholder={lang === 'de' ? 'z.B. 150' : 'e.g. 150'}
                    min="1"
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {lang === 'de' ? 'Betreuungsgruppe' : lang === 'nl' ? 'Ondersteuningsgroep' : 'Support Group'}
                  </label>
                  <select
                    value={betreuungsgruppe}
                    onChange={(e) => setBetreuungsgruppe(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-whs-dark-700 bg-white/50 dark:bg-whs-dark-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  >
                    {Object.entries(BETREUUNGSGRUPPEN).map(([key, group]) => (
                      <option key={key} value={key}>
                        {group.name[lang] || group.name.en}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {BETREUUNGSGRUPPEN[betreuungsgruppe].description[lang] || BETREUUNGSGRUPPEN[betreuungsgruppe].description.en}
                  </p>
                </div>
              </div>

              {/* Info Box */}
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-start gap-3">
                  <span className="text-emerald-500 text-xl">ℹ️</span>
                  <div className="text-sm text-emerald-800 dark:text-emerald-300">
                    <p className="font-medium mb-1">
                      {lang === 'de' ? 'Delivery Station Logistik = Gruppe II' : 'Delivery Station Logistics = Group II'}
                    </p>
                    <p>
                      {lang === 'de' ?
                        'Transport- und Logistikbetriebe fallen typischerweise unter Gruppe II mit 1,5 Std./MA für FaSi und 0,5 Std./MA für Betriebsarzt pro Jahr.' :
                        'Transport and logistics operations typically fall under Group II with 1.5 h/employee for safety specialist and 0.5 h/employee for company doctor per year.'}
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={calculatePraeventionszeit} variant="success" className="mb-6 !bg-gradient-to-r !from-emerald-500 !to-emerald-600">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {lang === 'de' ? 'Präventionszeit berechnen' : 'Calculate Prevention Time'}
                </span>
              </Button>

              {/* Results */}
              {praeventionResult && (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Summary Header */}
                  <div className="p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl text-white">
                    <h4 className="font-semibold text-lg mb-1">
                      {lang === 'de' ? 'Ergebnis für' : 'Results for'} {praeventionResult.employees} {lang === 'de' ? 'Beschäftigte' : 'employees'}
                    </h4>
                    <p className="text-emerald-100 text-sm">{praeventionResult.gruppeName}</p>
                  </div>

                  {/* Results Grid */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* FaSi Card */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">👷</span>
                        <div>
                          <h5 className="font-semibold text-blue-900 dark:text-blue-200">
                            {lang === 'de' ? 'Fachkraft für Arbeitssicherheit (FaSi)' : 'Safety Specialist (FaSi)'}
                          </h5>
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            {praeventionResult.fasiPerEmployee} {lang === 'de' ? 'Std. pro Beschäftigten/Jahr' : 'h per employee/year'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-700 dark:text-blue-300">{lang === 'de' ? 'Gesamt pro Jahr:' : 'Total per year:'}</span>
                          <span className="font-bold text-blue-900 dark:text-blue-100 bg-blue-100 dark:bg-blue-800 px-3 py-1 rounded-lg">
                            {praeventionResult.totalFasiHours} {lang === 'de' ? 'Std.' : 'h'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-700 dark:text-blue-300">{lang === 'de' ? 'Pro Monat:' : 'Per month:'}</span>
                          <span className="text-blue-900 dark:text-blue-100">{praeventionResult.fasiMonthly} {lang === 'de' ? 'Std.' : 'h'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-700 dark:text-blue-300">{lang === 'de' ? 'Arbeitstage:' : 'Work days:'}</span>
                          <span className="text-blue-900 dark:text-blue-100">{praeventionResult.fasiDays} {lang === 'de' ? 'Tage' : 'days'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Betriebsarzt Card */}
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🩺</span>
                        <div>
                          <h5 className="font-semibold text-rose-900 dark:text-rose-200">
                            {lang === 'de' ? 'Betriebsarzt' : 'Company Doctor'}
                          </h5>
                          <p className="text-xs text-rose-600 dark:text-rose-400">
                            {praeventionResult.baPerEmployee} {lang === 'de' ? 'Std. pro Beschäftigten/Jahr' : 'h per employee/year'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-rose-700 dark:text-rose-300">{lang === 'de' ? 'Gesamt pro Jahr:' : 'Total per year:'}</span>
                          <span className="font-bold text-rose-900 dark:text-rose-100 bg-rose-100 dark:bg-rose-800 px-3 py-1 rounded-lg">
                            {praeventionResult.totalBaHours} {lang === 'de' ? 'Std.' : 'h'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-rose-700 dark:text-rose-300">{lang === 'de' ? 'Pro Monat:' : 'Per month:'}</span>
                          <span className="text-rose-900 dark:text-rose-100">{praeventionResult.baMonthly} {lang === 'de' ? 'Std.' : 'h'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-rose-700 dark:text-rose-300">{lang === 'de' ? 'Arbeitstage:' : 'Work days:'}</span>
                          <span className="text-rose-900 dark:text-rose-100">{praeventionResult.baDays} {lang === 'de' ? 'Tage' : 'days'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Summary */}
                  <div className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-gray-900 dark:text-white">
                          {lang === 'de' ? 'Gesamte Präventionszeit pro Jahr' : 'Total Prevention Time per Year'}
                        </h5>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          FaSi + {lang === 'de' ? 'Betriebsarzt' : 'Company Doctor'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {praeventionResult.totalHours} {lang === 'de' ? 'Std.' : 'h'}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          ({praeventionResult.totalDays} {lang === 'de' ? 'Arbeitstage' : 'work days'})
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Legal Reference */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>📜</span>
                    <span>
                      {lang === 'de' ?
                        'Gemäß DGUV Vorschrift 2 Anlage 2 - Regelbetreuung für Betriebe mit mehr als 10 Beschäftigten' :
                        'According to DGUV Regulation 2 Appendix 2 - Standard support for operations with more than 10 employees'}
                    </span>
                  </div>
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
                    Calculate required safety personnel based on delivery station size
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

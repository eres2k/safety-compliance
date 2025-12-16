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

// GERMANY: Präventionszeit data based on DGUV Vorschrift 2 Anlage 2
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

// NETHERLANDS: Risk categories for Preventiemedewerker estimation (based on RI&E guidelines)
const NL_RISK_CATEGORIES = {
  low: {
    name: { en: 'Low Risk', de: 'Niedriges Risiko', nl: 'Laag risico' },
    description: { en: 'Office work, administration', de: 'Büroarbeit, Verwaltung', nl: 'Kantoorwerk, administratie' },
    hoursPerMonthBase: 4,
    hoursPerEmployee: 0.02 // Additional hours per employee per month
  },
  medium: {
    name: { en: 'Medium Risk', de: 'Mittleres Risiko', nl: 'Gemiddeld risico' },
    description: { en: 'Retail, logistics, transport', de: 'Einzelhandel, Logistik, Transport', nl: 'Detailhandel, logistiek, transport' },
    hoursPerMonthBase: 6,
    hoursPerEmployee: 0.03
  },
  high: {
    name: { en: 'High Risk', de: 'Hohes Risiko', nl: 'Hoog risico' },
    description: { en: 'Construction, manufacturing, chemicals', de: 'Bau, Fertigung, Chemie', nl: 'Bouw, productie, chemie' },
    hoursPerMonthBase: 8,
    hoursPerEmployee: 0.05
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

  // Präventionszeit calculator state - GERMANY (DE)
  const [praeventionEmployees, setPraeventionEmployees] = useState('')
  const [betreuungsgruppe, setBetreuungsgruppe] = useState('II') // Default to Group II (logistics)
  const [praeventionResult, setPraeventionResult] = useState(null)

  // Präventionszeit calculator state - AUSTRIA (AT) - § 82a ASchG
  const [atOfficeEmployees, setAtOfficeEmployees] = useState('')
  const [atOtherEmployees, setAtOtherEmployees] = useState('')
  const [atNightWorkers, setAtNightWorkers] = useState('')
  const [atPartTimeEmployees, setAtPartTimeEmployees] = useState('')
  const [atPartTimeFte, setAtPartTimeFte] = useState('0.5') // Average FTE for part-time
  const [atResult, setAtResult] = useState(null)

  // Präventionszeit calculator state - NETHERLANDS (NL) - Arbowet
  const [nlEmployees, setNlEmployees] = useState('')
  const [nlRiskCategory, setNlRiskCategory] = useState('medium')
  const [nlLocations, setNlLocations] = useState('1')
  const [nlResult, setNlResult] = useState(null)

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

  // AUSTRIA: Calculate prevention time according to § 82a ASchG
  const calculateAtPraeventionszeit = () => {
    const officeEmp = parseInt(atOfficeEmployees) || 0
    const otherEmp = parseInt(atOtherEmployees) || 0
    const nightWorkers = parseInt(atNightWorkers) || 0
    const partTimeEmp = parseInt(atPartTimeEmployees) || 0
    const partTimeFte = parseFloat(atPartTimeFte) || 0.5

    if (officeEmp + otherEmp < 1) return

    // Calculate FTE equivalent for part-time workers
    const partTimeFteTotal = partTimeEmp * partTimeFte

    // Calculate base hours according to § 82a ASchG
    const officeHours = officeEmp * 1.2 // Büroarbeitsplätze: 1,2 h/MA/Jahr
    const otherHours = otherEmp * 1.5 // Sonstige Arbeitsplätze: 1,5 h/MA/Jahr
    const partTimeHours = partTimeFteTotal * 1.5 // Part-time counted as other workplace, pro-rata
    const nightWorkBonus = nightWorkers * 0.5 // Nachtarbeiter: +0,5 h/MA/Jahr (≥50 Nachtschichten)

    const totalBaseHours = officeHours + otherHours + partTimeHours
    const totalHours = totalBaseHours + nightWorkBonus

    // Round according to § 82a: < 0.5 round down, >= 0.5 round up
    const roundedTotal = Math.round(totalHours)

    // Distribution according to § 82a: min. 40% SFK, min. 35% AMed, 25% other specialists
    const sfkMinHours = roundedTotal * 0.40
    const amedMinHours = roundedTotal * 0.35
    const otherSpecialistsHours = roundedTotal * 0.25

    // Convert to days (8h workday)
    const totalDays = (roundedTotal / 8).toFixed(1)

    // Total employees for display
    const totalEmployees = officeEmp + otherEmp + partTimeEmp

    setAtResult({
      totalEmployees,
      officeEmployees: officeEmp,
      otherEmployees: otherEmp,
      nightWorkers,
      partTimeEmployees: partTimeEmp,
      partTimeFte: partTimeFte,
      partTimeFteTotal: partTimeFteTotal.toFixed(1),
      officeHours: officeHours.toFixed(1),
      otherHours: otherHours.toFixed(1),
      partTimeHours: partTimeHours.toFixed(1),
      nightWorkBonus: nightWorkBonus.toFixed(1),
      totalBaseHours: totalBaseHours.toFixed(1),
      totalHours: roundedTotal,
      totalDays,
      sfkMinHours: sfkMinHours.toFixed(1),
      amedMinHours: amedMinHours.toFixed(1),
      otherSpecialistsHours: otherSpecialistsHours.toFixed(1),
      sfkMonthly: (sfkMinHours / 12).toFixed(1),
      amedMonthly: (amedMinHours / 12).toFixed(1)
    })
  }

  // NETHERLANDS: Estimate prevention time (Arbowet - framework law, no fixed hours)
  const calculateNlPraeventionszeit = () => {
    const emp = parseInt(nlEmployees)
    const locations = parseInt(nlLocations) || 1
    if (isNaN(emp) || emp < 1) return

    const category = NL_RISK_CATEGORIES[nlRiskCategory]

    // Base hours per month + additional per employee
    const baseMonthlyHours = category.hoursPerMonthBase * locations
    const employeeBasedHours = emp * category.hoursPerEmployee
    const totalMonthlyHours = baseMonthlyHours + employeeBasedHours

    // Annual hours
    const totalYearlyHours = totalMonthlyHours * 12

    // BHV (Bedrijfshulpverlening) - Emergency response workers
    const bhvRequired = Math.max(1, Math.ceil(emp / 50))

    // Preventiemedewerker requirement
    const preventiemedewerkerSelf = emp <= 25

    // Convert to days (8h workday)
    const totalDays = (totalYearlyHours / 8).toFixed(1)

    setNlResult({
      employees: emp,
      locations,
      riskCategory: nlRiskCategory,
      riskCategoryName: category.name[lang] || category.name.en,
      baseMonthlyHours: baseMonthlyHours.toFixed(1),
      employeeBasedHours: employeeBasedHours.toFixed(1),
      totalMonthlyHours: totalMonthlyHours.toFixed(1),
      totalYearlyHours: totalYearlyHours.toFixed(1),
      totalDays,
      bhvRequired,
      preventiemedewerkerSelf,
      rieToetsingRequired: emp > 25
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
          {/* Präventionszeit Calculator - Framework dependent */}
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
                    {framework === 'DE' && (lang === 'de' ? 'Berechnen Sie die erforderlichen Stunden gemäß DGUV Vorschrift 2' : 'Calculate required hours according to DGUV Regulation 2')}
                    {framework === 'AT' && (lang === 'de' ? 'Berechnen Sie die Präventionszeit gemäß § 82a ASchG' : 'Calculate prevention time according to § 82a ASchG')}
                    {framework === 'NL' && (lang === 'nl' ? 'Schat de benodigde preventietijd volgens de Arbowet' : lang === 'de' ? 'Schätzen Sie die Präventionszeit gemäß Arbowet' : 'Estimate prevention time according to Arbowet')}
                  </p>
                </div>
              </div>

              {/* ========== GERMANY (DE) - DGUV Vorschrift 2 ========== */}
              {framework === 'DE' && (
                <>
                  {/* Input Fields */}
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {lang === 'de' ? 'Anzahl der Beschäftigten' : 'Number of Employees'}
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
                        {lang === 'de' ? 'Betreuungsgruppe' : 'Support Group'}
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
                      <div className="p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl text-white">
                        <h4 className="font-semibold text-lg mb-1">
                          {lang === 'de' ? 'Ergebnis für' : 'Results for'} {praeventionResult.employees} {lang === 'de' ? 'Beschäftigte' : 'employees'}
                        </h4>
                        <p className="text-emerald-100 text-sm">{praeventionResult.gruppeName}</p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
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
                </>
              )}

              {/* ========== AUSTRIA (AT) - § 82a ASchG ========== */}
              {framework === 'AT' && (
                <>
                  {/* Input Fields */}
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {lang === 'de' ? 'Büroarbeitsplätze' : 'Office Workplaces'}
                        <span className="ml-1 text-xs text-gray-500">(1,2 h/MA)</span>
                      </label>
                      <Input
                        type="number"
                        value={atOfficeEmployees}
                        onChange={(e) => setAtOfficeEmployees(e.target.value)}
                        placeholder={lang === 'de' ? 'z.B. 20' : 'e.g. 20'}
                        min="0"
                        variant="glass"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {lang === 'de' ? 'Sonstige Arbeitsplätze' : 'Other Workplaces'}
                        <span className="ml-1 text-xs text-gray-500">(1,5 h/MA)</span>
                      </label>
                      <Input
                        type="number"
                        value={atOtherEmployees}
                        onChange={(e) => setAtOtherEmployees(e.target.value)}
                        placeholder={lang === 'de' ? 'z.B. 130' : 'e.g. 130'}
                        min="0"
                        variant="glass"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {lang === 'de' ? 'Lager, Logistik, Produktion, etc.' : 'Warehouse, logistics, production, etc.'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {lang === 'de' ? 'Nachtarbeiter (≥50 Nächte/Jahr)' : 'Night Workers (≥50 nights/year)'}
                        <span className="ml-1 text-xs text-gray-500">(+0,5 h/MA)</span>
                      </label>
                      <Input
                        type="number"
                        value={atNightWorkers}
                        onChange={(e) => setAtNightWorkers(e.target.value)}
                        placeholder={lang === 'de' ? 'z.B. 40' : 'e.g. 40'}
                        min="0"
                        variant="glass"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {lang === 'de' ? 'Mind. 6 Std. Arbeitszeit zwischen 22-6 Uhr' : 'Min. 6 hours between 22:00-06:00'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {lang === 'de' ? 'Teilzeitkräfte' : 'Part-time Employees'}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={atPartTimeEmployees}
                          onChange={(e) => setAtPartTimeEmployees(e.target.value)}
                          placeholder={lang === 'de' ? 'Anzahl' : 'Count'}
                          min="0"
                          variant="glass"
                          className="flex-1"
                        />
                        <select
                          value={atPartTimeFte}
                          onChange={(e) => setAtPartTimeFte(e.target.value)}
                          className="w-28 px-2 py-2.5 rounded-xl border border-gray-200 dark:border-whs-dark-700 bg-white/50 dark:bg-whs-dark-800/50 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="0.25">25% FTE</option>
                          <option value="0.5">50% FTE</option>
                          <option value="0.75">75% FTE</option>
                        </select>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {lang === 'de' ? 'Anteilig einzurechnen gemäß § 82a' : 'Pro-rata calculation per § 82a'}
                      </p>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🇦🇹</span>
                      <div className="text-sm text-red-800 dark:text-red-300">
                        <p className="font-medium mb-1">
                          {lang === 'de' ? 'Aufteilung gemäß § 82a ASchG' : 'Distribution per § 82a ASchG'}
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>{lang === 'de' ? 'Min. 40% Sicherheitsfachkraft (SFK)' : 'Min. 40% Safety Specialist (SFK)'}</li>
                          <li>{lang === 'de' ? 'Min. 35% Arbeitsmediziner (AMed)' : 'Min. 35% Occupational Physician (AMed)'}</li>
                          <li>{lang === 'de' ? '25% Sonstige (Psychologen, Ergonomen, etc.)' : '25% Other (psychologists, ergonomists, etc.)'}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Button onClick={calculateAtPraeventionszeit} variant="success" className="mb-6 !bg-gradient-to-r !from-red-500 !to-red-600">
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      {lang === 'de' ? 'Präventionszeit berechnen' : 'Calculate Prevention Time'}
                    </span>
                  </Button>

                  {/* Results */}
                  {atResult && (
                    <div className="space-y-4 animate-fade-in-up">
                      <div className="p-4 bg-gradient-to-r from-red-500 to-red-600 rounded-xl text-white">
                        <h4 className="font-semibold text-lg mb-1">
                          {lang === 'de' ? 'Ergebnis für' : 'Results for'} {atResult.totalEmployees} {lang === 'de' ? 'Beschäftigte' : 'employees'}
                        </h4>
                        <p className="text-red-100 text-sm">§ 82a ASchG - {lang === 'de' ? 'Präventionszeit' : 'Prevention Time'}</p>
                      </div>

                      {/* Calculation Breakdown */}
                      <div className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                        <h5 className="font-semibold text-gray-900 dark:text-white mb-3">
                          {lang === 'de' ? 'Berechnungsgrundlage' : 'Calculation Breakdown'}
                        </h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{atResult.officeEmployees} {lang === 'de' ? 'Büroarbeitsplätze' : 'Office'} x 1,2 h:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{atResult.officeHours} h</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{atResult.otherEmployees} {lang === 'de' ? 'Sonstige Arbeitsplätze' : 'Other'} x 1,5 h:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{atResult.otherHours} h</span>
                          </div>
                          {parseFloat(atResult.partTimeHours) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">{atResult.partTimeEmployees} {lang === 'de' ? 'Teilzeit' : 'Part-time'} ({atResult.partTimeFteTotal} FTE) x 1,5 h:</span>
                              <span className="font-medium text-gray-900 dark:text-white">{atResult.partTimeHours} h</span>
                            </div>
                          )}
                          {parseFloat(atResult.nightWorkBonus) > 0 && (
                            <div className="flex justify-between text-amber-600 dark:text-amber-400">
                              <span>{atResult.nightWorkers} {lang === 'de' ? 'Nachtarbeiter' : 'Night workers'} x 0,5 h:</span>
                              <span className="font-medium">+{atResult.nightWorkBonus} h</span>
                            </div>
                          )}
                          <div className="border-t border-gray-200 dark:border-whs-dark-600 pt-2 flex justify-between font-bold">
                            <span className="text-gray-900 dark:text-white">{lang === 'de' ? 'Gesamt (gerundet):' : 'Total (rounded):'}</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{atResult.totalHours} h</span>
                          </div>
                        </div>
                      </div>

                      {/* Distribution Cards */}
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">👷</span>
                            <h5 className="font-semibold text-blue-900 dark:text-blue-200">SFK</h5>
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">{lang === 'de' ? 'Min. 40%' : 'Min. 40%'}</p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{atResult.sfkMinHours} h</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">{atResult.sfkMonthly} h/{lang === 'de' ? 'Monat' : 'month'}</p>
                        </div>
                        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">🩺</span>
                            <h5 className="font-semibold text-rose-900 dark:text-rose-200">AMed</h5>
                          </div>
                          <p className="text-xs text-rose-600 dark:text-rose-400 mb-2">{lang === 'de' ? 'Min. 35%' : 'Min. 35%'}</p>
                          <p className="text-2xl font-bold text-rose-900 dark:text-rose-100">{atResult.amedMinHours} h</p>
                          <p className="text-xs text-rose-600 dark:text-rose-400">{atResult.amedMonthly} h/{lang === 'de' ? 'Monat' : 'month'}</p>
                        </div>
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">🧠</span>
                            <h5 className="font-semibold text-purple-900 dark:text-purple-200">{lang === 'de' ? 'Sonstige' : 'Other'}</h5>
                          </div>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">25%</p>
                          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{atResult.otherSpecialistsHours} h</p>
                          <p className="text-xs text-purple-600 dark:text-purple-400">{lang === 'de' ? 'Psychologen, Ergonomen' : 'Psychologists, ergonomists'}</p>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-semibold text-gray-900 dark:text-white">
                              {lang === 'de' ? 'Gesamte Präventionszeit pro Jahr' : 'Total Prevention Time per Year'}
                            </h5>
                            <p className="text-sm text-gray-500 dark:text-gray-400">SFK + AMed + {lang === 'de' ? 'Sonstige' : 'Other'}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-red-600 dark:text-red-400">{atResult.totalHours} h</span>
                            <p className="text-sm text-gray-500 dark:text-gray-400">({atResult.totalDays} {lang === 'de' ? 'Arbeitstage' : 'work days'})</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span>📜</span>
                        <span>
                          {lang === 'de' ?
                            'Gemäß § 82a ASchG - Präventionszeit für Sicherheitsfachkräfte und Arbeitsmediziner' :
                            'According to § 82a ASchG - Prevention time for safety specialists and occupational physicians'}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ========== NETHERLANDS (NL) - Arbowet ========== */}
              {framework === 'NL' && (
                <>
                  {/* Info Box - Arbowet is framework law */}
                  <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🇳🇱</span>
                      <div className="text-sm text-orange-800 dark:text-orange-300">
                        <p className="font-medium mb-1">
                          {lang === 'nl' ? 'Let op: Arbowet is een kaderwet' : lang === 'de' ? 'Hinweis: Arbowet ist ein Rahmengesetz' : 'Note: Arbowet is a framework law'}
                        </p>
                        <p>
                          {lang === 'nl' ? 'De Arbowet geeft geen vaste uren. De benodigde tijd wordt bepaald door de RI&E. Dit is een schatting op basis van brancherichtlijnen.' :
                           lang === 'de' ? 'Die Arbowet gibt keine festen Stunden vor. Die benötigte Zeit wird durch die RI&E bestimmt. Dies ist eine Schätzung basierend auf Branchenrichtlinien.' :
                           'Arbowet does not specify fixed hours. Required time is determined by RI&E. This is an estimate based on industry guidelines.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Input Fields */}
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {lang === 'nl' ? 'Aantal werknemers' : lang === 'de' ? 'Anzahl der Beschäftigten' : 'Number of Employees'}
                      </label>
                      <Input
                        type="number"
                        value={nlEmployees}
                        onChange={(e) => setNlEmployees(e.target.value)}
                        placeholder={lang === 'de' ? 'z.B. 150' : 'e.g. 150'}
                        min="1"
                        variant="glass"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {lang === 'nl' ? 'Risicocategorie (RI&E)' : lang === 'de' ? 'Risikokategorie (RI&E)' : 'Risk Category (RI&E)'}
                      </label>
                      <select
                        value={nlRiskCategory}
                        onChange={(e) => setNlRiskCategory(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-whs-dark-700 bg-white/50 dark:bg-whs-dark-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      >
                        {Object.entries(NL_RISK_CATEGORIES).map(([key, cat]) => (
                          <option key={key} value={key}>
                            {cat.name[lang] || cat.name.en}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {NL_RISK_CATEGORIES[nlRiskCategory].description[lang] || NL_RISK_CATEGORIES[nlRiskCategory].description.en}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {lang === 'nl' ? 'Aantal locaties' : lang === 'de' ? 'Anzahl Standorte' : 'Number of Locations'}
                      </label>
                      <Input
                        type="number"
                        value={nlLocations}
                        onChange={(e) => setNlLocations(e.target.value)}
                        placeholder="1"
                        min="1"
                        variant="glass"
                      />
                    </div>
                  </div>

                  <Button onClick={calculateNlPraeventionszeit} variant="success" className="mb-6 !bg-gradient-to-r !from-orange-500 !to-orange-600">
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      {lang === 'nl' ? 'Bereken preventietijd' : lang === 'de' ? 'Präventionszeit schätzen' : 'Estimate Prevention Time'}
                    </span>
                  </Button>

                  {/* Results */}
                  {nlResult && (
                    <div className="space-y-4 animate-fade-in-up">
                      <div className="p-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white">
                        <h4 className="font-semibold text-lg mb-1">
                          {lang === 'nl' ? 'Schatting voor' : lang === 'de' ? 'Schätzung für' : 'Estimate for'} {nlResult.employees} {lang === 'nl' ? 'werknemers' : lang === 'de' ? 'Beschäftigte' : 'employees'}
                        </h4>
                        <p className="text-orange-100 text-sm">{nlResult.riskCategoryName} - {nlResult.locations} {lang === 'nl' ? 'locatie(s)' : lang === 'de' ? 'Standort(e)' : 'location(s)'}</p>
                      </div>

                      {/* Preventiemedewerker Info */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">👷</span>
                            <div>
                              <h5 className="font-semibold text-orange-900 dark:text-orange-200">Preventiemedewerker</h5>
                              <p className="text-xs text-orange-600 dark:text-orange-400">
                                {nlResult.preventiemedewerkerSelf ?
                                  (lang === 'nl' ? 'Werkgever mag zelf zijn' : lang === 'de' ? 'Arbeitgeber darf selbst sein' : 'Employer may fulfill role') :
                                  (lang === 'nl' ? 'Verplicht aanstellen' : lang === 'de' ? 'Pflicht zur Bestellung' : 'Required to appoint')}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-orange-700 dark:text-orange-300">{lang === 'nl' ? 'Per maand:' : lang === 'de' ? 'Pro Monat:' : 'Per month:'}</span>
                              <span className="font-bold text-orange-900 dark:text-orange-100 bg-orange-100 dark:bg-orange-800 px-3 py-1 rounded-lg">
                                {nlResult.totalMonthlyHours} h
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-orange-700 dark:text-orange-300">{lang === 'nl' ? 'Per jaar:' : lang === 'de' ? 'Pro Jahr:' : 'Per year:'}</span>
                              <span className="text-orange-900 dark:text-orange-100">{nlResult.totalYearlyHours} h</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">🚑</span>
                            <div>
                              <h5 className="font-semibold text-blue-900 dark:text-blue-200">BHV</h5>
                              <p className="text-xs text-blue-600 dark:text-blue-400">Bedrijfshulpverlening</p>
                            </div>
                          </div>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {nlResult.bhvRequired} {lang === 'nl' ? 'persoon/personen' : lang === 'de' ? 'Person(en)' : 'person(s)'}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            {lang === 'nl' ? 'Min. 1 per 50 werknemers' : lang === 'de' ? 'Min. 1 pro 50 Beschäftigte' : 'Min. 1 per 50 employees'}
                          </p>
                        </div>
                      </div>

                      {/* Additional Requirements */}
                      <div className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                        <h5 className="font-semibold text-gray-900 dark:text-white mb-3">
                          {lang === 'nl' ? 'Vereisten' : lang === 'de' ? 'Anforderungen' : 'Requirements'}
                        </h5>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${nlResult.rieToetsingRequired ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                              {nlResult.rieToetsingRequired ? '!' : '✓'}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              RI&E Toetsing: {nlResult.rieToetsingRequired ?
                                (lang === 'nl' ? 'Verplicht (>25 werknemers)' : lang === 'de' ? 'Erforderlich (>25 Beschäftigte)' : 'Required (>25 employees)') :
                                (lang === 'nl' ? 'Vrijgesteld met erkend instrument' : lang === 'de' ? 'Befreit mit anerkanntem Instrument' : 'Exempt with recognized tool')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-blue-100 text-blue-600">ℹ</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              Arbodienst: {lang === 'nl' ? 'Vangnetregeling of Maatwerkregeling' : lang === 'de' ? 'Auffangregeling oder Maatwerk' : 'Standard or Custom arrangement'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-semibold text-gray-900 dark:text-white">
                              {lang === 'nl' ? 'Geschatte preventietijd per jaar' : lang === 'de' ? 'Geschätzte Präventionszeit pro Jahr' : 'Estimated Prevention Time per Year'}
                            </h5>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Preventiemedewerker</p>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{nlResult.totalYearlyHours} h</span>
                            <p className="text-sm text-gray-500 dark:text-gray-400">({nlResult.totalDays} {lang === 'nl' ? 'werkdagen' : lang === 'de' ? 'Arbeitstage' : 'work days'})</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span>📜</span>
                        <span>
                          {lang === 'nl' ? 'Schatting op basis van Arbowet Art. 13 en brancherichtlijnen. Raadpleeg uw RI&E voor exacte vereisten.' :
                           lang === 'de' ? 'Schätzung basierend auf Arbowet Art. 13 und Branchenrichtlinien. Konsultieren Sie Ihre RI&E für genaue Anforderungen.' :
                           'Estimate based on Arbowet Art. 13 and industry guidelines. Consult your RI&E for exact requirements.'}
                        </span>
                      </div>
                    </div>
                  )}
                </>
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

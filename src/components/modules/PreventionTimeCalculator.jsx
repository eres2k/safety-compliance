import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Button, Input, Card, CardContent } from '../ui'

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

// NETHERLANDS: Risk categories for Preventiemedewerker estimation
const NL_RISK_CATEGORIES = {
  low: {
    name: { en: 'Low Risk', de: 'Niedriges Risiko', nl: 'Laag risico' },
    description: { en: 'Office work, administration', de: 'Büroarbeit, Verwaltung', nl: 'Kantoorwerk, administratie' },
    hoursPerMonthBase: 4,
    hoursPerEmployee: 0.02
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

export function PreventionTimeCalculator({ onBack }) {
  const { t, framework, currentFrameworkColor, language } = useApp()
  const lang = language || 'en'

  // GERMANY (DE) state
  const [deFullTimeEmployees, setDeFullTimeEmployees] = useState('')
  const [dePartTime20, setDePartTime20] = useState('')
  const [dePartTime30, setDePartTime30] = useState('')
  const [betreuungsgruppe, setBetreuungsgruppe] = useState('II')
  const [praeventionResult, setPraeventionResult] = useState(null)

  // AUSTRIA (AT) state
  const [atOfficeEmployees, setAtOfficeEmployees] = useState('')
  const [atOtherEmployees, setAtOtherEmployees] = useState('')
  const [atNightWorkers, setAtNightWorkers] = useState('')
  const [atPartTimeEmployees, setAtPartTimeEmployees] = useState('')
  const [atPartTimeFte, setAtPartTimeFte] = useState('0.5')
  const [atResult, setAtResult] = useState(null)

  // NETHERLANDS (NL) state
  const [nlEmployees, setNlEmployees] = useState('')
  const [nlRiskCategory, setNlRiskCategory] = useState('medium')
  const [nlLocations, setNlLocations] = useState('1')
  const [nlResult, setNlResult] = useState(null)

  // GERMANY: Calculate prevention time according to DGUV Vorschrift 2
  const calculatePraeventionszeit = () => {
    const fullTime = parseInt(deFullTimeEmployees) || 0
    const partTime20 = parseInt(dePartTime20) || 0
    const partTime30 = parseInt(dePartTime30) || 0

    const fteFromPartTime20 = partTime20 * 0.5
    const fteFromPartTime30 = partTime30 * 0.75
    const totalFte = fullTime + fteFromPartTime20 + fteFromPartTime30

    if (totalFte < 1) return

    const gruppe = BETREUUNGSGRUPPEN[betreuungsgruppe]
    const fasiHoursPerEmployee = gruppe.fasi
    const baHoursPerEmployee = gruppe.betriebsarzt

    const totalFasiHours = totalFte * fasiHoursPerEmployee
    const totalBaHours = totalFte * baHoursPerEmployee
    const grundbetreuungHours = totalFasiHours + totalBaHours

    const betriebsspezifischFasi = totalFte * 0.2
    const betriebsspezifischBa = totalFte * 0.05
    const totalHours = grundbetreuungHours + betriebsspezifischFasi + betriebsspezifischBa

    const fasiDays = ((totalFasiHours + betriebsspezifischFasi) / 8).toFixed(1)
    const baDays = ((totalBaHours + betriebsspezifischBa) / 8).toFixed(1)
    const totalDays = (totalHours / 8).toFixed(1)

    const fasiMonthly = ((totalFasiHours + betriebsspezifischFasi) / 12).toFixed(1)
    const baMonthly = ((totalBaHours + betriebsspezifischBa) / 12).toFixed(1)

    const totalHeadcount = fullTime + partTime20 + partTime30

    setPraeventionResult({
      employees: totalHeadcount,
      fullTimeEmployees: fullTime,
      partTime20Employees: partTime20,
      partTime30Employees: partTime30,
      totalFte: totalFte.toFixed(1),
      gruppe: betreuungsgruppe,
      gruppeName: gruppe.name[lang] || gruppe.name.en,
      fasiPerEmployee: fasiHoursPerEmployee,
      baPerEmployee: baHoursPerEmployee,
      grundbetreuungFasi: totalFasiHours.toFixed(1),
      grundbetreuungBa: totalBaHours.toFixed(1),
      betriebsspezifischFasi: betriebsspezifischFasi.toFixed(1),
      betriebsspezifischBa: betriebsspezifischBa.toFixed(1),
      totalFasiHours: (totalFasiHours + betriebsspezifischFasi).toFixed(1),
      totalBaHours: (totalBaHours + betriebsspezifischBa).toFixed(1),
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

    const partTimeFteTotal = partTimeEmp * partTimeFte
    const officeHours = officeEmp * 1.2
    const otherHours = otherEmp * 1.5
    const partTimeHours = partTimeFteTotal * 1.5
    const nightWorkBonus = nightWorkers * 0.5

    const totalBaseHours = officeHours + otherHours + partTimeHours
    const totalHours = totalBaseHours + nightWorkBonus
    const roundedTotal = Math.round(totalHours)

    const sfkMinHours = roundedTotal * 0.40
    const amedMinHours = roundedTotal * 0.35
    const otherSpecialistsHours = roundedTotal * 0.25
    const totalDays = (roundedTotal / 8).toFixed(1)
    const totalEmployees = officeEmp + otherEmp + partTimeEmp

    setAtResult({
      totalEmployees,
      officeEmployees: officeEmp,
      otherEmployees: otherEmp,
      nightWorkers,
      partTimeEmployees: partTimeEmp,
      partTimeFte,
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

  // NETHERLANDS: Estimate prevention time
  const calculateNlPraeventionszeit = () => {
    const emp = parseInt(nlEmployees)
    const locations = parseInt(nlLocations) || 1
    if (isNaN(emp) || emp < 1) return

    const category = NL_RISK_CATEGORIES[nlRiskCategory]
    const baseMonthlyHours = category.hoursPerMonthBase * locations
    const employeeBasedHours = emp * category.hoursPerEmployee
    const totalMonthlyHours = baseMonthlyHours + employeeBasedHours
    const totalYearlyHours = totalMonthlyHours * 12
    const bhvRequired = Math.max(1, Math.ceil(emp / 50))
    const preventiemedewerkerSelf = emp <= 25
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

        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full border border-emerald-500/20">
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {currentFrameworkColor?.name || framework}
          </span>
        </div>
      </div>

      {/* Title Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {lang === 'de' ? 'Präventionszeit-Rechner' : lang === 'nl' ? 'Preventietijd Calculator' : 'Prevention Time Calculator'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {framework === 'DE' && (lang === 'de' ? 'Berechnung gemäß DGUV Vorschrift 2' : 'Calculation per DGUV Regulation 2')}
              {framework === 'AT' && (lang === 'de' ? 'Berechnung gemäß § 82a ASchG' : 'Calculation per § 82a ASchG')}
              {framework === 'NL' && (lang === 'nl' ? 'Schatting volgens de Arbowet' : 'Estimation per Arbowet')}
            </p>
          </div>
        </div>
      </div>

      <Card variant="glass" className="overflow-hidden">
        <CardContent className="p-6">
          {/* GERMANY (DE) */}
          {framework === 'DE' && (
            <div className="animate-fade-in">
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {lang === 'de' ? 'Vollzeitkräfte (>30 Std./Woche)' : 'Full-time Employees (>30 h/week)'}
                    <span className="ml-1 text-xs text-gray-500">(Faktor 1,0)</span>
                  </label>
                  <Input
                    type="number"
                    value={deFullTimeEmployees}
                    onChange={(e) => setDeFullTimeEmployees(e.target.value)}
                    placeholder={lang === 'de' ? 'z.B. 100' : 'e.g. 100'}
                    min="0"
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
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {lang === 'de' ? 'Teilzeit ≤20 Std./Woche' : 'Part-time ≤20 h/week'}
                    <span className="ml-1 text-xs text-gray-500">(Faktor 0,5)</span>
                  </label>
                  <Input
                    type="number"
                    value={dePartTime20}
                    onChange={(e) => setDePartTime20(e.target.value)}
                    placeholder={lang === 'de' ? 'z.B. 30' : 'e.g. 30'}
                    min="0"
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {lang === 'de' ? 'Teilzeit 21-30 Std./Woche' : 'Part-time 21-30 h/week'}
                    <span className="ml-1 text-xs text-gray-500">(Faktor 0,75)</span>
                  </label>
                  <Input
                    type="number"
                    value={dePartTime30}
                    onChange={(e) => setDePartTime30(e.target.value)}
                    placeholder={lang === 'de' ? 'z.B. 20' : 'e.g. 20'}
                    min="0"
                    variant="glass"
                  />
                </div>
              </div>

              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🇩🇪</span>
                  <div className="text-sm text-emerald-800 dark:text-emerald-300">
                    <p className="font-medium mb-1">DGUV Vorschrift 2 - Teilzeitumrechnung</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>≤20 Std./Woche = Faktor 0,5</li>
                      <li>21-30 Std./Woche = Faktor 0,75</li>
                      <li>&gt;30 Std./Woche = Faktor 1,0</li>
                    </ul>
                    <p className="mt-2">Delivery Station Logistik = Gruppe II (1,5 Std./MA FaSi + 0,5 Std./MA BA)</p>
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

              {praeventionResult && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl text-white">
                    <h4 className="font-semibold text-lg mb-1">
                      {lang === 'de' ? 'Ergebnis für' : 'Results for'} {praeventionResult.employees} {lang === 'de' ? 'Beschäftigte' : 'employees'} ({praeventionResult.totalFte} FTE)
                    </h4>
                    <p className="text-emerald-100 text-sm">{praeventionResult.gruppeName}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">👷</span>
                        <h5 className="font-semibold text-blue-900 dark:text-blue-200">
                          Fachkraft für Arbeitssicherheit (FaSi)
                        </h5>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-700 dark:text-blue-300">Gesamt pro Jahr:</span>
                          <span className="font-bold text-blue-900 dark:text-blue-100 bg-blue-100 dark:bg-blue-800 px-3 py-1 rounded-lg">
                            {praeventionResult.totalFasiHours} Std.
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-blue-700 dark:text-blue-300">Pro Monat:</span>
                          <span className="text-blue-900 dark:text-blue-100">{praeventionResult.fasiMonthly} Std.</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🩺</span>
                        <h5 className="font-semibold text-rose-900 dark:text-rose-200">Betriebsarzt</h5>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-rose-700 dark:text-rose-300">Gesamt pro Jahr:</span>
                          <span className="font-bold text-rose-900 dark:text-rose-100 bg-rose-100 dark:bg-rose-800 px-3 py-1 rounded-lg">
                            {praeventionResult.totalBaHours} Std.
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-rose-700 dark:text-rose-300">Pro Monat:</span>
                          <span className="text-rose-900 dark:text-rose-100">{praeventionResult.baMonthly} Std.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-gray-900 dark:text-white">Gesamte Präventionszeit pro Jahr</h5>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Grundbetreuung + Betriebsspezifisch</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {praeventionResult.totalHours} Std.
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">({praeventionResult.totalDays} Arbeitstage)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUSTRIA (AT) */}
          {framework === 'AT' && (
            <div className="animate-fade-in">
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
                </div>
              </div>

              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🇦🇹</span>
                  <div className="text-sm text-red-800 dark:text-red-300">
                    <p className="font-medium mb-1">Aufteilung gemäß § 82a ASchG</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Min. 40% Sicherheitsfachkraft (SFK)</li>
                      <li>Min. 35% Arbeitsmediziner (AMed)</li>
                      <li>25% Sonstige (Psychologen, Ergonomen, etc.)</li>
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

              {atResult && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="p-4 bg-gradient-to-r from-red-500 to-red-600 rounded-xl text-white">
                    <h4 className="font-semibold text-lg mb-1">
                      Ergebnis für {atResult.totalEmployees} Beschäftigte
                    </h4>
                    <p className="text-red-100 text-sm">§ 82a ASchG</p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">SFK (min. 40%)</p>
                      <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{atResult.sfkMinHours} Std.</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">{atResult.sfkMonthly} Std./Monat</p>
                    </div>
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                      <p className="text-sm text-rose-700 dark:text-rose-300 mb-1">AMed (min. 35%)</p>
                      <p className="text-xl font-bold text-rose-900 dark:text-rose-100">{atResult.amedMinHours} Std.</p>
                      <p className="text-xs text-rose-600 dark:text-rose-400">{atResult.amedMonthly} Std./Monat</p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 text-center">
                      <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">Sonstige (25%)</p>
                      <p className="text-xl font-bold text-purple-900 dark:text-purple-100">{atResult.otherSpecialistsHours} Std.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-gray-900 dark:text-white">Gesamte Präventionszeit</h5>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-red-600 dark:text-red-400">{atResult.totalHours} Std.</span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">({atResult.totalDays} Arbeitstage)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NETHERLANDS (NL) */}
          {framework === 'NL' && (
            <div className="animate-fade-in">
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {lang === 'nl' ? 'Aantal werknemers' : 'Number of Employees'}
                  </label>
                  <Input
                    type="number"
                    value={nlEmployees}
                    onChange={(e) => setNlEmployees(e.target.value)}
                    placeholder="e.g. 150"
                    min="1"
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {lang === 'nl' ? 'Risicocategorie' : 'Risk Category'}
                  </label>
                  <select
                    value={nlRiskCategory}
                    onChange={(e) => setNlRiskCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-whs-dark-700 bg-white/50 dark:bg-whs-dark-800/50 text-gray-900 dark:text-white"
                  >
                    {Object.entries(NL_RISK_CATEGORIES).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.name[lang] || cat.name.en}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {lang === 'nl' ? 'Aantal locaties' : 'Number of Locations'}
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

              <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🇳🇱</span>
                  <div className="text-sm text-orange-800 dark:text-orange-300">
                    <p className="font-medium mb-1">Arbowet - Preventiemedewerker</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>≤25 werknemers: werkgever mag zelf optreden</li>
                      <li>&gt;25 werknemers: RI&E toetsing verplicht</li>
                      <li>BHV: minimaal 1 per 50 werknemers</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button onClick={calculateNlPraeventionszeit} variant="success" className="mb-6 !bg-gradient-to-r !from-orange-500 !to-orange-600">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {lang === 'nl' ? 'Bereken preventietijd' : 'Calculate Prevention Time'}
                </span>
              </Button>

              {nlResult && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="p-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white">
                    <h4 className="font-semibold text-lg mb-1">
                      Results for {nlResult.employees} employees ({nlResult.locations} location{nlResult.locations > 1 ? 's' : ''})
                    </h4>
                    <p className="text-orange-100 text-sm">{nlResult.riskCategoryName}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                      <h5 className="font-semibold text-orange-900 dark:text-orange-200 mb-2">Prevention Time</h5>
                      <p className="text-2xl font-bold text-orange-600">{nlResult.totalYearlyHours} hours/year</p>
                      <p className="text-sm text-orange-700 dark:text-orange-300">{nlResult.totalMonthlyHours} hours/month</p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <h5 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Requirements</h5>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        <li>BHV: min. {nlResult.bhvRequired} person(s)</li>
                        <li>Preventiemedewerker: {nlResult.preventiemedewerkerSelf ? 'Employer can fulfill' : 'Required'}</li>
                        <li>RI&E Toetsing: {nlResult.rieToetsingRequired ? 'Required' : 'Exempt'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PreventionTimeCalculator

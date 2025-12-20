import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Input, Card, CardContent } from '../ui'

// Expanded penalties data by country
const PENALTIES_DATA = {
  DE: [
    { violation: "Fehlende Gefährdungsbeurteilung", penalty: "Bis zu € 30.000", reference: "§ 5 ArbSchG", severity: "high" },
    { violation: "Keine Fachkraft für Arbeitssicherheit", penalty: "Bis zu € 25.000", reference: "§ 1 ASiG", severity: "high" },
    { violation: "Fehlende Dokumentation", penalty: "Bis zu € 5.000", reference: "§ 6 ArbSchG", severity: "medium" },
    { violation: "Kein Arbeitsschutzausschuss", penalty: "Bis zu € 10.000", reference: "§ 11 ASiG", severity: "medium" },
    { violation: "Fehlende jährliche Unterweisung", penalty: "Bis zu € 5.000", reference: "DGUV V1 § 4", severity: "medium" },
    { violation: "Keine Sicherheitsbeauftragten", penalty: "Bis zu € 10.000", reference: "DGUV V1 § 20", severity: "medium" },
    { violation: "Fehlende Erste-Hilfe-Ausstattung", penalty: "Bis zu € 5.000", reference: "DGUV V1 § 24", severity: "medium" },
    { violation: "Keine Betriebsanweisung für Gefahrstoffe", penalty: "Bis zu € 25.000", reference: "§ 14 GefStoffV", severity: "high" },
    { violation: "Fehlende PSA-Bereitstellung", penalty: "Bis zu € 5.000", reference: "§ 3 PSA-BV", severity: "medium" },
    { violation: "Überschreitung der Arbeitszeit", penalty: "Bis zu € 30.000", reference: "§ 22 ArbZG", severity: "high" },
    { violation: "Fehlende Pausenregelung", penalty: "Bis zu € 15.000", reference: "§ 4 ArbZG", severity: "medium" },
    { violation: "Verstoß gegen Jugendarbeitsschutz", penalty: "Bis zu € 15.000", reference: "§ 58 JArbSchG", severity: "high" },
    { violation: "Verstoß gegen Mutterschutz", penalty: "Bis zu € 15.000", reference: "§ 32 MuSchG", severity: "high" },
    { violation: "Fehlende Prüfung von Arbeitsmitteln", penalty: "Bis zu € 10.000", reference: "§ 14 BetrSichV", severity: "medium" },
    { violation: "Keine Flucht- und Rettungswege", penalty: "Bis zu € 25.000", reference: "§ 4 ArbStättV", severity: "high" },
    { violation: "Fehlende Brandschutzmaßnahmen", penalty: "Bis zu € 50.000", reference: "§ 4 ArbStättV", severity: "critical" },
    { violation: "Keine arbeitsmedizinische Vorsorge", penalty: "Bis zu € 10.000", reference: "ArbMedVV", severity: "medium" },
    { violation: "Verstoß gegen Lärmschutzvorschriften", penalty: "Bis zu € 10.000", reference: "LärmVibrationsArbSchV", severity: "medium" }
  ],
  AT: [
    { violation: "Fehlende Arbeitsplatzevaluierung", penalty: "Bis zu € 16.600", reference: "§ 130 ASchG", severity: "high" },
    { violation: "Keine Sicherheitsfachkraft (SFK)", penalty: "Bis zu € 8.320", reference: "§ 130 ASchG", severity: "high" },
    { violation: "Keine Sicherheitsvertrauensperson", penalty: "Bis zu € 8.320", reference: "§ 130 ASchG", severity: "medium" },
    { violation: "Fehlende Unterweisung", penalty: "Bis zu € 8.320", reference: "§ 130 ASchG", severity: "medium" },
    { violation: "Keine Erste-Hilfe-Einrichtungen", penalty: "Bis zu € 8.320", reference: "§ 130 ASchG", severity: "medium" },
    { violation: "Fehlende Sicherheitskennzeichnung", penalty: "Bis zu € 4.160", reference: "§ 130 ASchG", severity: "low" },
    { violation: "Überschreitung der Höchstarbeitszeit", penalty: "Bis zu € 3.636", reference: "§ 28 AZG", severity: "high" },
    { violation: "Verstoß gegen Nachtarbeitsregelungen", penalty: "Bis zu € 3.636", reference: "§ 28 AZG", severity: "medium" },
    { violation: "Fehlende Ruhepausen", penalty: "Bis zu € 1.818", reference: "§ 28 AZG", severity: "medium" },
    { violation: "Verstoß gegen Sonntagsruhe", penalty: "Bis zu € 2.180", reference: "§ 27 ARG", severity: "medium" },
    { violation: "Verstoß gegen Mutterschutz", penalty: "Bis zu € 3.600", reference: "§ 39 MSchG", severity: "high" },
    { violation: "Verstoß gegen Jugendschutz", penalty: "Bis zu € 3.600", reference: "§ 30 KJBG", severity: "high" },
    { violation: "Fehlende PSA", penalty: "Bis zu € 8.320", reference: "§ 130 ASchG", severity: "medium" },
    { violation: "Keine Gefahrstoff-Unterweisung", penalty: "Bis zu € 8.320", reference: "§ 130 ASchG", severity: "high" },
    { violation: "Fehlende Arbeitsmittelprüfung", penalty: "Bis zu € 8.320", reference: "AM-VO", severity: "medium" },
    { violation: "Kein Sicherheits-/Gesundheitsschutzdokument", penalty: "Bis zu € 8.320", reference: "DOK-VO", severity: "high" }
  ],
  NL: [
    { violation: "Ontbrekende RI&E", penalty: "Tot € 13.500", reference: "Art. 5 Arbowet", severity: "high" },
    { violation: "Geen preventiemedewerker", penalty: "Tot € 4.500", reference: "Art. 13 Arbowet", severity: "medium" },
    { violation: "Ontbrekende BHV-organisatie", penalty: "Tot € 4.500", reference: "Art. 15 Arbowet", severity: "medium" },
    { violation: "Geen arbodienst contract", penalty: "Tot € 4.500", reference: "Art. 14 Arbowet", severity: "medium" },
    { violation: "Geen voorlichting en onderricht", penalty: "Tot € 4.500", reference: "Art. 8 Arbowet", severity: "medium" },
    { violation: "Ontbrekende PAGO", penalty: "Tot € 4.500", reference: "Art. 18 Arbowet", severity: "medium" },
    { violation: "Geen veilige werkplek", penalty: "Tot € 13.500", reference: "Art. 3 Arbowet", severity: "high" },
    { violation: "Gevaarlijke stoffen - geen maatregelen", penalty: "Tot € 13.500", reference: "Arbobesluit H4", severity: "high" },
    { violation: "Fysieke belasting - geen maatregelen", penalty: "Tot € 9.000", reference: "Arbobesluit H5", severity: "medium" },
    { violation: "Overtreding arbeidstijden", penalty: "Tot € 10.000", reference: "Arbeidstijdenwet", severity: "high" },
    { violation: "Geen persoonlijke beschermingsmiddelen", penalty: "Tot € 4.500", reference: "Arbobesluit H8", severity: "medium" },
    { violation: "Ontbrekende machineveiligheid", penalty: "Tot € 13.500", reference: "Arbobesluit H7", severity: "high" },
    { violation: "Geen noodprocedures", penalty: "Tot € 4.500", reference: "Arbobesluit", severity: "medium" },
    { violation: "Geen meldplicht arbeidsongeval", penalty: "Tot € 4.500", reference: "Art. 9 Arbowet", severity: "medium" }
  ]
}

const severityColors = {
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
  low: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
}

const severityLabels = {
  critical: { en: 'Critical', de: 'Kritisch', nl: 'Kritiek' },
  high: { en: 'High', de: 'Hoch', nl: 'Hoog' },
  medium: { en: 'Medium', de: 'Mittel', nl: 'Gemiddeld' },
  low: { en: 'Low', de: 'Niedrig', nl: 'Laag' }
}

export function PenaltyLookup({ onBack, embedded = false }) {
  const { t, framework, currentFrameworkColor, language } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const lang = language || 'en'

  const penalties = PENALTIES_DATA[framework] || []

  const filteredPenalties = penalties.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.violation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reference.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter
    return matchesSearch && matchesSeverity
  })

  return (
    <div className="animate-fade-in">
      {/* Header */}
      {!embedded && (
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

          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 dark:bg-red-500/20 rounded-full border border-red-500/20">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              {currentFrameworkColor?.name || framework}
            </span>
          </div>
        </div>
      )}

      {/* Title Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {lang === 'de' ? 'Bußgeldkatalog' : lang === 'nl' ? 'Boetecatalogus' : 'Penalty Lookup'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {lang === 'de' ? 'Bußgelder für Arbeitsschutzverstöße' : lang === 'nl' ? 'Boetes voor overtredingen arbowetgeving' : 'Fines for safety violations'}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'de' ? 'Verstoß oder Rechtsgrundlage suchen...' : 'Search violation or reference...'}
            className="pl-10"
            variant="glass"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-whs-dark-700 bg-white/50 dark:bg-whs-dark-800/50 text-gray-900 dark:text-white"
        >
          <option value="all">{lang === 'de' ? 'Alle Schweregrade' : lang === 'nl' ? 'Alle niveaus' : 'All Severity'}</option>
          <option value="critical">{severityLabels.critical[lang]}</option>
          <option value="high">{severityLabels.high[lang]}</option>
          <option value="medium">{severityLabels.medium[lang]}</option>
          <option value="low">{severityLabels.low[lang]}</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {filteredPenalties.length} {lang === 'de' ? 'Ergebnisse' : lang === 'nl' ? 'resultaten' : 'results'}
      </p>

      <Card variant="glass" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-whs-dark-800">
                <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-whs-dark-700">
                  {lang === 'de' ? 'Verstoß' : lang === 'nl' ? 'Overtreding' : 'Violation'}
                </th>
                <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-whs-dark-700">
                  {lang === 'de' ? 'Max. Bußgeld' : lang === 'nl' ? 'Max. Boete' : 'Max Penalty'}
                </th>
                <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-whs-dark-700">
                  {lang === 'de' ? 'Schweregrad' : lang === 'nl' ? 'Ernst' : 'Severity'}
                </th>
                <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-whs-dark-700">
                  {lang === 'de' ? 'Rechtsgrundlage' : lang === 'nl' ? 'Wettelijke basis' : 'Reference'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPenalties.map((item, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 dark:border-whs-dark-700 hover:bg-gray-50 dark:hover:bg-whs-dark-800/50 transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <td className="p-4 text-gray-700 dark:text-gray-300">{item.violation}</td>
                  <td className="p-4">
                    <span className="text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/20 px-2 py-1 rounded-lg">
                      {item.penalty}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${severityColors[item.severity]}`}>
                      {severityLabels[item.severity][lang]}
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

        {filteredPenalties.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              {lang === 'de' ? 'Keine Ergebnisse gefunden' : lang === 'nl' ? 'Geen resultaten gevonden' : 'No results found'}
            </p>
          </div>
        )}
      </Card>

      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-medium mb-1">
              {lang === 'de' ? 'Haftungsausschluss' : lang === 'nl' ? 'Disclaimer' : 'Disclaimer'}
            </p>
            <p>
              {lang === 'de'
                ? 'Diese Angaben dienen nur zur Information. Für verbindliche Auskünfte wenden Sie sich an die zuständige Behörde oder Rechtsberatung.'
                : lang === 'nl'
                ? 'Deze informatie is uitsluitend ter informatie. Neem voor bindend advies contact op met de bevoegde autoriteit of juridisch adviseur.'
                : 'This information is for reference only. Contact the relevant authority or legal advisor for binding advice.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PenaltyLookup

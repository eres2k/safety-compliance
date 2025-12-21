import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Input, Card, CardContent } from '../ui'

// Expanded glossary data by country
const GLOSSARY_DATA = {
  DE: [
    { abbr: "ArbSchG", full: "Arbeitsschutzgesetz", description: "Gesetz über die Durchführung von Maßnahmen des Arbeitsschutzes", category: "law" },
    { abbr: "ASiG", full: "Arbeitssicherheitsgesetz", description: "Gesetz über Betriebsärzte, Sicherheitsingenieure und andere Fachkräfte", category: "law" },
    { abbr: "ArbZG", full: "Arbeitszeitgesetz", description: "Gesetz zur Regelung der Arbeitszeit", category: "law" },
    { abbr: "ArbStättV", full: "Arbeitsstättenverordnung", description: "Verordnung über Arbeitsstätten", category: "law" },
    { abbr: "BetrSichV", full: "Betriebssicherheitsverordnung", description: "Verordnung über Sicherheit und Gesundheitsschutz bei der Verwendung von Arbeitsmitteln", category: "law" },
    { abbr: "GefStoffV", full: "Gefahrstoffverordnung", description: "Verordnung zum Schutz vor Gefahrstoffen", category: "law" },
    { abbr: "MuSchG", full: "Mutterschutzgesetz", description: "Gesetz zum Schutz von Müttern bei der Arbeit", category: "law" },
    { abbr: "JArbSchG", full: "Jugendarbeitsschutzgesetz", description: "Gesetz zum Schutz der arbeitenden Jugend", category: "law" },
    { abbr: "DGUV", full: "Deutsche Gesetzliche Unfallversicherung", description: "Spitzenverband der Berufsgenossenschaften und Unfallkassen", category: "org" },
    { abbr: "BG", full: "Berufsgenossenschaft", description: "Träger der gesetzlichen Unfallversicherung für Unternehmen", category: "org" },
    { abbr: "FaSi", full: "Fachkraft für Arbeitssicherheit", description: "Auch: Sifa - Sicherheitsfachkraft nach ASiG", category: "role" },
    { abbr: "SiBe", full: "Sicherheitsbeauftragter", description: "Ehrenamtlicher Beschäftigter für Arbeitsschutz nach DGUV V1", category: "role" },
    { abbr: "BA", full: "Betriebsarzt", description: "Arbeitsmediziner nach ASiG", category: "role" },
    { abbr: "ASA", full: "Arbeitsschutzausschuss", description: "Betriebliches Gremium für Arbeitsschutzfragen (>20 MA)", category: "org" },
    { abbr: "GBU", full: "Gefährdungsbeurteilung", description: "Systematische Ermittlung und Bewertung von Gefährdungen nach § 5 ArbSchG", category: "process" },
    { abbr: "PSA", full: "Persönliche Schutzausrüstung", description: "Ausrüstung zum Schutz gegen Gefährdungen am Arbeitsplatz", category: "equipment" },
    { abbr: "ArbMedVV", full: "Verordnung zur arbeitsmedizinischen Vorsorge", description: "Regelt arbeitsmedizinische Vorsorgeuntersuchungen", category: "law" },
    { abbr: "LärmVibrationsArbSchV", full: "Lärm- und Vibrations-Arbeitsschutzverordnung", description: "Verordnung zum Schutz vor Lärm und Vibrationen", category: "law" },
    { abbr: "LasthandhabV", full: "Lastenhandhabungsverordnung", description: "Verordnung über Sicherheit und Gesundheitsschutz bei der manuellen Handhabung von Lasten", category: "law" },
    { abbr: "TRBS", full: "Technische Regeln für Betriebssicherheit", description: "Konkretisierung der BetrSichV", category: "standard" },
    { abbr: "TRGS", full: "Technische Regeln für Gefahrstoffe", description: "Konkretisierung der GefStoffV", category: "standard" },
    { abbr: "ASR", full: "Technische Regeln für Arbeitsstätten", description: "Konkretisierung der ArbStättV", category: "standard" },
    { abbr: "SDB", full: "Sicherheitsdatenblatt", description: "Dokument mit Informationen zu Gefahrstoffen", category: "document" },
    { abbr: "EH", full: "Ersthelfer", description: "Ausgebildete Person für Erste Hilfe im Betrieb", category: "role" },
    { abbr: "UVV", full: "Unfallverhütungsvorschriften", description: "DGUV Vorschriften zur Unfallverhütung", category: "law" }
  ],
  AT: [
    { abbr: "ASchG", full: "ArbeitnehmerInnenschutzgesetz", description: "Bundesgesetz über Sicherheit und Gesundheitsschutz bei der Arbeit", category: "law" },
    { abbr: "AZG", full: "Arbeitszeitgesetz", description: "Gesetz zur Regelung der Arbeitszeit", category: "law" },
    { abbr: "ARG", full: "Arbeitsruhegesetz", description: "Gesetz über die wöchentliche Ruhezeit und die Feiertagsruhe", category: "law" },
    { abbr: "MSchG", full: "Mutterschutzgesetz", description: "Gesetz zum Schutz erwerbstätiger Mütter", category: "law" },
    { abbr: "KJBG", full: "Kinder- und Jugendlichen-Beschäftigungsgesetz", description: "Gesetz zum Schutz der arbeitenden Jugend", category: "law" },
    { abbr: "AStV", full: "Arbeitsstättenverordnung", description: "Verordnung über Arbeitsstätten", category: "law" },
    { abbr: "AM-VO", full: "Arbeitsmittelverordnung", description: "Verordnung über die Sicherheit von Arbeitsmitteln", category: "law" },
    { abbr: "DOK-VO", full: "Dokumentationsverordnung", description: "Verordnung über Sicherheits- und Gesundheitsschutzdokumente", category: "law" },
    { abbr: "PSA-V", full: "PSA-Verordnung", description: "Verordnung über persönliche Schutzausrüstungen", category: "law" },
    { abbr: "GKV", full: "Grenzwerteverordnung", description: "Verordnung über Grenzwerte für Arbeitsstoffe", category: "law" },
    { abbr: "AUVA", full: "Allgemeine Unfallversicherungsanstalt", description: "Gesetzliche Unfallversicherung für Arbeitnehmer", category: "org" },
    { abbr: "AI", full: "Arbeitsinspektorat", description: "Behörde für Arbeitsschutz-Kontrollen", category: "org" },
    { abbr: "SFK", full: "Sicherheitsfachkraft", description: "Fachkundige Person für Arbeitssicherheit nach ASchG", category: "role" },
    { abbr: "AMed", full: "Arbeitsmediziner", description: "Arzt für arbeitsmedizinische Betreuung nach ASchG", category: "role" },
    { abbr: "SVP", full: "Sicherheitsvertrauensperson", description: "Arbeitnehmervertreter für Sicherheit und Gesundheit", category: "role" },
    { abbr: "ASA", full: "Arbeitsschutzausschuss", description: "Betriebliches Gremium für Arbeitsschutz (>100 MA)", category: "org" },
    { abbr: "AE", full: "Arbeitsplatzevaluierung", description: "Systematische Ermittlung und Beurteilung von Gefahren nach § 4 ASchG", category: "process" },
    { abbr: "SiGe-Plan", full: "Sicherheits- und Gesundheitsschutzplan", description: "Plan für Baustellen nach BauKG", category: "document" },
    { abbr: "BauKG", full: "Bauarbeitenkoordinationsgesetz", description: "Gesetz zur Koordination von Bauarbeiten", category: "law" },
    { abbr: "BauV", full: "Bauarbeiterschutzverordnung", description: "Verordnung zum Schutz der Arbeitnehmer auf Baustellen", category: "law" },
    { abbr: "EH", full: "Ersthelfer", description: "Ausgebildete Person für Erste Hilfe", category: "role" },
    { abbr: "PKZ", full: "Präventivdienstzentrum", description: "Einrichtung für arbeitsmedizinische und sicherheitstechnische Betreuung", category: "org" }
  ],
  NL: [
    { abbr: "Arbowet", full: "Arbeidsomstandighedenwet", description: "Kaderwet voor arbeidsomstandigheden", category: "law" },
    { abbr: "Arbobesluit", full: "Arbeidsomstandighedenbesluit", description: "Uitwerking van de Arbowet in concrete regels", category: "law" },
    { abbr: "Arboregeling", full: "Arbeidsomstandighedenregeling", description: "Nadere uitwerking van Arbowet en Arbobesluit", category: "law" },
    { abbr: "ATW", full: "Arbeidstijdenwet", description: "Wet inzake arbeidstijden en rusttijden", category: "law" },
    { abbr: "ATB", full: "Arbeidstijdenbesluit", description: "Uitwerking van de Arbeidstijdenwet", category: "law" },
    { abbr: "RI&E", full: "Risico-inventarisatie en -evaluatie", description: "Systematische inventarisatie van risico's op de werkplek", category: "process" },
    { abbr: "PvA", full: "Plan van Aanpak", description: "Actieplan naar aanleiding van de RI&E", category: "document" },
    { abbr: "BHV", full: "Bedrijfshulpverlening", description: "Organisatie voor noodsituaties in bedrijven", category: "role" },
    { abbr: "BHV'er", full: "Bedrijfshulpverlener", description: "Werknemer opgeleid voor noodhulp", category: "role" },
    { abbr: "PM", full: "Preventiemedewerker", description: "Medewerker belast met preventietaken", category: "role" },
    { abbr: "SZW", full: "Sociale Zaken en Werkgelegenheid", description: "Ministerie verantwoordelijk voor arbowetgeving", category: "org" },
    { abbr: "I-SZW", full: "Inspectie SZW", description: "Inspectiedienst voor arbeidsomstandigheden (nu NLA)", category: "org" },
    { abbr: "NLA", full: "Nederlandse Arbeidsinspectie", description: "Toezichthouder op arbeidsomstandigheden", category: "org" },
    { abbr: "PAGO", full: "Periodiek arbeidsgezondheidskundig onderzoek", description: "Periodiek gezondheidsonderzoek voor werknemers", category: "process" },
    { abbr: "PMO", full: "Preventief medisch onderzoek", description: "Vrijwillig gezondheidsonderzoek", category: "process" },
    { abbr: "PBM", full: "Persoonlijke beschermingsmiddelen", description: "Beschermende uitrusting voor werknemers", category: "equipment" },
    { abbr: "VCA", full: "Veiligheid, gezondheid en milieu Checklist Aannemers", description: "Certificering voor veilig werken", category: "standard" },
    { abbr: "VGM", full: "Veiligheid, Gezondheid en Milieu", description: "Integraal managementsysteem", category: "standard" },
    { abbr: "OR", full: "Ondernemingsraad", description: "Medezeggenschapsorgaan met instemmingsrecht bij arbobeleid", category: "org" },
    { abbr: "PvW", full: "Personeelsvertegenwoordiging", description: "Vertegenwoordiging bij kleine bedrijven (<50 werknemers)", category: "org" },
    { abbr: "Arbodienst", full: "Arbodienst", description: "Externe deskundige dienst voor arbo-ondersteuning", category: "org" },
    { abbr: "BA", full: "Bedrijfsarts", description: "Arts gespecialiseerd in arbeidsgeneeskunde", category: "role" },
    { abbr: "HVK", full: "Hogere Veiligheidskundige", description: "Deskundige op het gebied van veiligheid", category: "role" }
  ]
}

const categoryColors = {
  law: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  org: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
  role: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  process: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
  equipment: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
  standard: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200',
  document: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200'
}

const categoryLabels = {
  law: { en: 'Law', de: 'Gesetz', nl: 'Wet' },
  org: { en: 'Organization', de: 'Organisation', nl: 'Organisatie' },
  role: { en: 'Role', de: 'Rolle', nl: 'Rol' },
  process: { en: 'Process', de: 'Prozess', nl: 'Proces' },
  equipment: { en: 'Equipment', de: 'Ausrüstung', nl: 'Uitrusting' },
  standard: { en: 'Standard', de: 'Standard', nl: 'Standaard' },
  document: { en: 'Document', de: 'Dokument', nl: 'Document' }
}

export function Glossary({ onBack, onNavigateToLaw, embedded = false }) {
  const { t, framework, currentFrameworkColor, language } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const lang = language || 'en'

  // Smart linking - navigate to law when clicking a law abbreviation
  const handleLawClick = (abbr, category) => {
    if (!onNavigateToLaw || (category !== 'law' && category !== 'standard')) return
    onNavigateToLaw(null, framework, null)
  }

  const glossary = GLOSSARY_DATA[framework] || []

  const filteredGlossary = glossary.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.abbr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.full.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Get unique categories for filter
  const categories = [...new Set(glossary.map(item => item.category))]

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

          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 dark:bg-purple-500/20 rounded-full border border-purple-500/20">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
              {currentFrameworkColor?.name || framework}
            </span>
          </div>
        </div>
      )}

      {/* Title Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {lang === 'de' ? 'Abkürzungsverzeichnis' : lang === 'nl' ? 'Afkortingenlijst' : 'Glossary'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {lang === 'de' ? 'Fachbegriffe und Abkürzungen im Arbeitsschutz' : lang === 'nl' ? 'Vakbegrippen en afkortingen in arboveiligheid' : 'Safety terminology and abbreviations'}
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
            placeholder={lang === 'de' ? 'Abkürzung oder Begriff suchen...' : 'Search abbreviation or term...'}
            className="pl-10"
            variant="glass"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-whs-dark-700 bg-white/50 dark:bg-whs-dark-800/50 text-gray-900 dark:text-white"
        >
          <option value="all">{lang === 'de' ? 'Alle Kategorien' : lang === 'nl' ? 'Alle categorieën' : 'All Categories'}</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{categoryLabels[cat]?.[lang] || cat}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {filteredGlossary.length} {lang === 'de' ? 'Einträge' : lang === 'nl' ? 'items' : 'entries'}
      </p>

      {/* Glossary Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredGlossary.map((item, i) => (
          <Card
            key={i}
            variant="glass"
            className="p-4 hover:border-purple-200 dark:hover:border-purple-500/30 transition-colors animate-fade-in-up"
            style={{ animationDelay: `${i * 0.03}s` }}
          >
            <div className="flex items-start gap-4">
              {(item.category === 'law' || item.category === 'standard') && onNavigateToLaw ? (
                <button
                  onClick={() => handleLawClick(item.abbr, item.category)}
                  className="font-bold text-whs-orange-600 dark:text-whs-orange-400 bg-whs-orange-100 dark:bg-whs-orange-500/20 px-3 py-1 rounded-lg min-w-[70px] text-center shrink-0 hover:bg-whs-orange-200 dark:hover:bg-whs-orange-500/30 transition-colors cursor-pointer flex items-center gap-1"
                  title={lang === 'de' ? 'Im Gesetzesbrowser öffnen' : 'Open in law browser'}
                >
                  {item.abbr}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              ) : (
                <span className="font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20 px-3 py-1 rounded-lg min-w-[70px] text-center shrink-0">
                  {item.abbr}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-gray-900 dark:text-white">{item.full}</span>
                  {item.category && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[item.category]}`}>
                      {categoryLabels[item.category]?.[lang] || item.category}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredGlossary.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            {lang === 'de' ? `Keine Ergebnisse für "${searchQuery}"` : `No results for "${searchQuery}"`}
          </p>
        </div>
      )}
    </div>
  )
}

export default Glossary

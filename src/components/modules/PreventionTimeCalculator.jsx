import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { Button, Input, Card, CardContent } from '../ui'

// Localization strings for the calculator
const CALC_TRANSLATIONS = {
  de: {
    title: 'Präventionszeit-Rechner',
    subtitle: {
      DE: 'Berechnung gemäß DGUV Vorschrift 2',
      AT: 'Berechnung gemäß § 82a ASchG',
      NL: 'Schätzung gemäß Arbowet'
    },
    singleSite: 'Einzelstandort',
    multiSite: 'Multi-Standort (CSV Import)',
    fullTimeEmployees: 'Vollzeitkräfte (>30 Std./Woche)',
    partTime20: 'Teilzeit ≤20 Std./Woche',
    partTime30: 'Teilzeit 21-30 Std./Woche',
    supportGroup: 'Betreuungsgruppe',
    factor: 'Faktor',
    placeholder: 'z.B.',
    calculate: 'Präventionszeit berechnen',
    resultsFor: 'Ergebnis für',
    employees: 'Beschäftigte',
    totalPerYear: 'Gesamt pro Jahr',
    perMonth: 'Pro Monat',
    hours: 'Std.',
    workDays: 'Arbeitstage',
    totalPrevention: 'Gesamte Präventionszeit pro Jahr',
    basicCare: 'Grundbetreuung',
    companySpecific: 'Betriebsspezifisch',
    // DE info box
    dguv2Info: 'DGUV Vorschrift 2 - Teilzeitumrechnung',
    deliveryLogistics: 'Delivery Station Logistik = Gruppe II',
    // AT labels
    officeWorkplaces: 'Büroarbeitsplätze',
    otherWorkplaces: 'Sonstige Arbeitsplätze',
    nightWorkers: 'Nachtarbeiter (≥50 Nächte/Jahr)',
    partTimeWorkers: 'Teilzeitkräfte',
    count: 'Anzahl',
    atInfo: 'Aufteilung gemäß § 82a ASchG',
    sfkMin: 'Min. 40% Sicherheitsfachkraft (SFK)',
    amedMin: 'Min. 35% Arbeitsmediziner (AMed)',
    otherSpec: '25% Sonstige (Psychologen, Ergonomen, etc.)',
    totalPrevTime: 'Gesamte Präventionszeit',
    // NL labels
    numEmployees: 'Anzahl Mitarbeiter',
    riskCategory: 'Risikokategorie',
    numLocations: 'Anzahl Standorte',
    nlInfo: 'Arbowet - Preventiemedewerker',
    nlSelf: '≤25 Mitarbeiter: Arbeitgeber kann selbst tätig werden',
    nlRie: '>25 Mitarbeiter: RI&E Prüfung erforderlich',
    nlBhv: 'BHV: mindestens 1 pro 50 Mitarbeiter',
    preventionTime: 'Präventionszeit',
    hoursYear: 'Stunden/Jahr',
    hoursMonth: 'Stunden/Monat',
    requirements: 'Anforderungen',
    bhv: 'BHV',
    person: 'Person(en)',
    prevMed: 'Preventiemedewerker',
    employerCan: 'Arbeitgeber kann selbst erfüllen',
    required: 'Erforderlich',
    rieToets: 'RI&E Prüfung',
    exempt: 'Befreit',
    // CSV Import/Export
    importCsv: 'CSV importieren',
    exportTemplate: 'Vorlage exportieren',
    downloadTemplate: 'CSV-Vorlage herunterladen',
    siteName: 'Standortname',
    importFile: 'Datei importieren',
    clearImport: 'Import löschen',
    importedSites: 'Importierte Standorte',
    totalSummary: 'Gesamtübersicht alle Standorte',
    noSitesImported: 'Keine Standorte importiert',
    importHelp: 'Laden Sie eine CSV-Datei mit Ihren Standortdaten hoch oder verwenden Sie die Vorlage.',
    invalidFile: 'Ungültige Datei. Bitte verwenden Sie das CSV-Format.',
    parseError: 'Fehler beim Lesen der Datei. Bitte überprüfen Sie das Format.',
    site: 'Standort',
    sitesSummary: 'Standorte gesamt',
    perSiteDetails: 'Details pro Standort',
    showDetails: 'Details anzeigen',
    hideDetails: 'Details ausblenden',
    exportResults: 'Ergebnisse exportieren',
    // Workload visualization
    workloadTitle: 'SiFa-Arbeitslast (basierend auf 40h/Woche)',
    workloadFte: 'Vollzeitstellen benötigt',
    workloadPercent: 'der Arbeitszeit',
    workloadNote: 'Prozentsatz einer 40-Stunden-Woche, der für Sicherheitsaufgaben benötigt wird',
    fte: 'VZÄ',
    // Related laws
    relatedLaws: 'Relevante Gesetze',
    relatedLawsDesc: 'Rechtliche Grundlagen für die Präventionszeit',
    viewInLawBrowser: 'Im Gesetzebrowser anzeigen'
  },
  en: {
    title: 'Prevention Time Calculator',
    subtitle: {
      DE: 'Calculation per DGUV Regulation 2',
      AT: 'Calculation per § 82a ASchG',
      NL: 'Estimation per Arbowet'
    },
    singleSite: 'Single Site',
    multiSite: 'Multi-Site (CSV Import)',
    fullTimeEmployees: 'Full-time Employees (>30 h/week)',
    partTime20: 'Part-time ≤20 h/week',
    partTime30: 'Part-time 21-30 h/week',
    supportGroup: 'Support Group',
    factor: 'Factor',
    placeholder: 'e.g.',
    calculate: 'Calculate Prevention Time',
    resultsFor: 'Results for',
    employees: 'employees',
    totalPerYear: 'Total per year',
    perMonth: 'Per month',
    hours: 'hrs',
    workDays: 'work days',
    totalPrevention: 'Total Prevention Time per Year',
    basicCare: 'Basic Care',
    companySpecific: 'Company-specific',
    // DE info box
    dguv2Info: 'DGUV Regulation 2 - Part-time Conversion',
    deliveryLogistics: 'Delivery Station Logistics = Group II',
    // AT labels
    officeWorkplaces: 'Office Workplaces',
    otherWorkplaces: 'Other Workplaces',
    nightWorkers: 'Night Workers (≥50 nights/year)',
    partTimeWorkers: 'Part-time Employees',
    count: 'Count',
    atInfo: 'Distribution per § 82a ASchG',
    sfkMin: 'Min. 40% Safety Specialist (SFK)',
    amedMin: 'Min. 35% Occupational Physician (AMed)',
    otherSpec: '25% Others (Psychologists, Ergonomists, etc.)',
    totalPrevTime: 'Total Prevention Time',
    // NL labels
    numEmployees: 'Number of Employees',
    riskCategory: 'Risk Category',
    numLocations: 'Number of Locations',
    nlInfo: 'Arbowet - Prevention Officer',
    nlSelf: '≤25 employees: Employer may act themselves',
    nlRie: '>25 employees: RI&E assessment required',
    nlBhv: 'BHV: minimum 1 per 50 employees',
    preventionTime: 'Prevention Time',
    hoursYear: 'hours/year',
    hoursMonth: 'hours/month',
    requirements: 'Requirements',
    bhv: 'BHV',
    person: 'person(s)',
    prevMed: 'Prevention Officer',
    employerCan: 'Employer can fulfill',
    required: 'Required',
    rieToets: 'RI&E Assessment',
    exempt: 'Exempt',
    // CSV Import/Export
    importCsv: 'Import CSV',
    exportTemplate: 'Export Template',
    downloadTemplate: 'Download CSV Template',
    siteName: 'Site Name',
    importFile: 'Import File',
    clearImport: 'Clear Import',
    importedSites: 'Imported Sites',
    totalSummary: 'Total Summary All Sites',
    noSitesImported: 'No sites imported',
    importHelp: 'Upload a CSV file with your site data or use the template.',
    invalidFile: 'Invalid file. Please use CSV format.',
    parseError: 'Error reading file. Please check the format.',
    site: 'Site',
    sitesSummary: 'Total sites',
    perSiteDetails: 'Per-site Details',
    showDetails: 'Show Details',
    hideDetails: 'Hide Details',
    exportResults: 'Export Results',
    // Workload visualization
    workloadTitle: 'SiFa Workload (based on 40h/week)',
    workloadFte: 'Full-time equivalents needed',
    workloadPercent: 'of work time',
    workloadNote: 'Percentage of a 40-hour week required for safety duties',
    fte: 'FTE',
    // Related laws
    relatedLaws: 'Related Laws',
    relatedLawsDesc: 'Legal basis for prevention time requirements',
    viewInLawBrowser: 'View in Law Browser'
  },
  nl: {
    title: 'Preventietijd Calculator',
    subtitle: {
      DE: 'Berekening volgens DGUV Voorschrift 2',
      AT: 'Berekening volgens § 82a ASchG',
      NL: 'Schatting volgens de Arbowet'
    },
    singleSite: 'Enkele locatie',
    multiSite: 'Multi-locatie (CSV Import)',
    fullTimeEmployees: 'Fulltime medewerkers (>30 u/week)',
    partTime20: 'Parttime ≤20 u/week',
    partTime30: 'Parttime 21-30 u/week',
    supportGroup: 'Begeleidingsgroep',
    factor: 'Factor',
    placeholder: 'bijv.',
    calculate: 'Bereken preventietijd',
    resultsFor: 'Resultaten voor',
    employees: 'werknemers',
    totalPerYear: 'Totaal per jaar',
    perMonth: 'Per maand',
    hours: 'uur',
    workDays: 'werkdagen',
    totalPrevention: 'Totale preventietijd per jaar',
    basicCare: 'Basiszorg',
    companySpecific: 'Bedrijfsspecifiek',
    // DE info box
    dguv2Info: 'DGUV Voorschrift 2 - Parttime omrekening',
    deliveryLogistics: 'Bezorgstation Logistiek = Groep II',
    // AT labels
    officeWorkplaces: 'Kantoorwerkplekken',
    otherWorkplaces: 'Overige werkplekken',
    nightWorkers: 'Nachtwerkers (≥50 nachten/jaar)',
    partTimeWorkers: 'Parttime medewerkers',
    count: 'Aantal',
    atInfo: 'Verdeling volgens § 82a ASchG',
    sfkMin: 'Min. 40% Veiligheidsdeskundige (SFK)',
    amedMin: 'Min. 35% Bedrijfsarts (AMed)',
    otherSpec: '25% Overige (Psychologen, Ergonomen, etc.)',
    totalPrevTime: 'Totale preventietijd',
    // NL labels
    numEmployees: 'Aantal werknemers',
    riskCategory: 'Risicocategorie',
    numLocations: 'Aantal locaties',
    nlInfo: 'Arbowet - Preventiemedewerker',
    nlSelf: '≤25 werknemers: werkgever mag zelf optreden',
    nlRie: '>25 werknemers: RI&E toetsing verplicht',
    nlBhv: 'BHV: minimaal 1 per 50 werknemers',
    preventionTime: 'Preventietijd',
    hoursYear: 'uur/jaar',
    hoursMonth: 'uur/maand',
    requirements: 'Vereisten',
    bhv: 'BHV',
    person: 'persoon/personen',
    prevMed: 'Preventiemedewerker',
    employerCan: 'Werkgever kan zelf vervullen',
    required: 'Verplicht',
    rieToets: 'RI&E Toetsing',
    exempt: 'Vrijgesteld',
    // CSV Import/Export
    importCsv: 'CSV importeren',
    exportTemplate: 'Sjabloon exporteren',
    downloadTemplate: 'Download CSV-sjabloon',
    siteName: 'Locatienaam',
    importFile: 'Bestand importeren',
    clearImport: 'Import wissen',
    importedSites: 'Geïmporteerde locaties',
    totalSummary: 'Totaaloverzicht alle locaties',
    noSitesImported: 'Geen locaties geïmporteerd',
    importHelp: 'Upload een CSV-bestand met uw locatiegegevens of gebruik de sjabloon.',
    invalidFile: 'Ongeldig bestand. Gebruik alstublieft CSV-formaat.',
    parseError: 'Fout bij lezen bestand. Controleer het formaat.',
    site: 'Locatie',
    sitesSummary: 'Totaal locaties',
    perSiteDetails: 'Details per locatie',
    showDetails: 'Details tonen',
    hideDetails: 'Details verbergen',
    exportResults: 'Resultaten exporteren',
    // Workload visualization
    workloadTitle: 'SiFa Werklast (gebaseerd op 40u/week)',
    workloadFte: 'Fulltime-equivalenten nodig',
    workloadPercent: 'van de werktijd',
    workloadNote: 'Percentage van een 40-urige werkweek nodig voor veiligheidswerken',
    fte: 'FTE',
    // Related laws
    relatedLaws: 'Gerelateerde Wetgeving',
    relatedLawsDesc: 'Wettelijke basis voor preventietijd vereisten',
    viewInLawBrowser: 'Bekijk in Wetgeving Browser'
  }
}

// CSV Template headers and example data for each country
const CSV_TEMPLATES = {
  DE: {
    headers: ['Site', 'Betreuungsgruppe', 'Vollzeit_gt30h', 'Teilzeit_lte20h', 'Teilzeit_21_30h'],
    example: [
      ['Standort Berlin', 'II', '50', '10', '15'],
      ['Standort München', 'II', '80', '20', '10'],
      ['Standort Hamburg', 'III', '30', '5', '8']
    ],
    headerTranslations: {
      de: ['Standort', 'Betreuungsgruppe', 'Vollzeit >30 Std.', 'Teilzeit ≤20 Std.', 'Teilzeit 21-30 Std.'],
      en: ['Site', 'Support Group', 'Full-time >30h', 'Part-time ≤20h', 'Part-time 21-30h'],
      nl: ['Locatie', 'Begeleidingsgroep', 'Fulltime >30u', 'Parttime ≤20u', 'Parttime 21-30u']
    }
  },
  AT: {
    headers: ['Site', 'Bueroarbeitsplaetze', 'Sonstige_Arbeitsplaetze', 'Nachtarbeiter', 'Teilzeitkraefte', 'Teilzeit_FTE_Faktor'],
    example: [
      ['Standort Wien', '20', '80', '15', '10', '0.5'],
      ['Standort Graz', '15', '60', '10', '8', '0.5'],
      ['Standort Linz', '10', '40', '5', '5', '0.75']
    ],
    headerTranslations: {
      de: ['Standort', 'Büroarbeitsplätze', 'Sonstige Arbeitsplätze', 'Nachtarbeiter', 'Teilzeitkräfte', 'Teilzeit FTE-Faktor'],
      en: ['Site', 'Office Workplaces', 'Other Workplaces', 'Night Workers', 'Part-time Employees', 'Part-time FTE Factor'],
      nl: ['Locatie', 'Kantoorwerkplekken', 'Overige werkplekken', 'Nachtwerkers', 'Parttime medewerkers', 'Parttime FTE-factor']
    }
  },
  NL: {
    headers: ['Site', 'Aantal_werknemers', 'Risicocategorie', 'Aantal_locaties'],
    example: [
      ['Amsterdam Hub', '150', 'medium', '1'],
      ['Rotterdam Depot', '80', 'medium', '1'],
      ['Utrecht Station', '45', 'low', '1']
    ],
    headerTranslations: {
      de: ['Standort', 'Anzahl Mitarbeiter', 'Risikokategorie', 'Anzahl Standorte'],
      en: ['Site', 'Number of Employees', 'Risk Category', 'Number of Locations'],
      nl: ['Locatie', 'Aantal werknemers', 'Risicocategorie', 'Aantal locaties']
    }
  }
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

// Related laws for crosslinking
const RELATED_LAWS = {
  DE: [
    { id: 'dguv-vorschrift-2', abbreviation: 'DGUV V2', title: { de: 'DGUV Vorschrift 2', en: 'DGUV Regulation 2', nl: 'DGUV Voorschrift 2' }, description: { de: 'Betriebsärzte und Fachkräfte für Arbeitssicherheit', en: 'Occupational physicians and safety specialists', nl: 'Bedrijfsartsen en veiligheidsdeskundigen' }},
    { id: 'asig', abbreviation: 'ASiG', title: { de: 'Arbeitssicherheitsgesetz', en: 'Occupational Safety Act', nl: 'Arbeidsveiligheidswet' }, description: { de: 'Gesetz über Betriebsärzte und Fachkräfte', en: 'Act on occupational physicians and specialists', nl: 'Wet over bedrijfsartsen en specialisten' }},
    { id: 'arbschg', abbreviation: 'ArbSchG', title: { de: 'Arbeitsschutzgesetz', en: 'Occupational Safety and Health Act', nl: 'Arbowet Duitsland' }, description: { de: 'Grundlagen des Arbeitsschutzes', en: 'Fundamentals of occupational safety', nl: 'Basis arbeidsveiligheid' }}
  ],
  AT: [
    { id: 'aschg', abbreviation: 'ASchG', title: { de: 'ArbeitnehmerInnenschutzgesetz', en: 'Employee Protection Act', nl: 'Werknemersbeschermingswet' }, description: { de: '§ 82a regelt Präventionszeit', en: '§ 82a regulates prevention time', nl: '§ 82a regelt preventietijd' }},
    { id: 'sv-pv', abbreviation: 'SV-PV', title: { de: 'Sicherheitsvertrauenspersonen-Verordnung', en: 'Safety Representatives Ordinance', nl: 'Veiligheidsvertrouwenspersonen Verordening' }, description: { de: 'Vorgaben für Sicherheitspersonal', en: 'Requirements for safety personnel', nl: 'Vereisten veiligheidspersoneel' }}
  ],
  NL: [
    { id: 'arbowet', abbreviation: 'Arbowet', title: { de: 'Arbeitsomstandighedenwet', en: 'Working Conditions Act', nl: 'Arbeidsomstandighedenwet' }, description: { de: 'Niederländisches Arbeitsschutzgesetz', en: 'Dutch occupational safety law', nl: 'Nederlandse arbowetgeving' }},
    { id: 'arbobesluit', abbreviation: 'Arbobesluit', title: { de: 'Arbeitsomstandighedenbeschluss', en: 'Working Conditions Decree', nl: 'Arbeidsomstandighedenbesluit' }, description: { de: 'Detailvorschriften Präventionszeit', en: 'Detailed prevention time regulations', nl: 'Gedetailleerde preventietijdregels' }}
  ]
}

export function PreventionTimeCalculator({ onBack, onNavigateToLaw }) {
  const { t, framework, currentFrameworkColor, language } = useApp()
  const lang = language || 'en'
  const ct = CALC_TRANSLATIONS[lang] || CALC_TRANSLATIONS.en
  const fileInputRef = useRef(null)

  // Mode: single site vs multi-site
  const [mode, setMode] = useState('single') // 'single' or 'multi'
  const [importedSites, setImportedSites] = useState([])
  const [multiSiteResults, setMultiSiteResults] = useState(null)
  const [showSiteDetails, setShowSiteDetails] = useState(false)
  const [importError, setImportError] = useState(null)

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

  // CSV Template Export Function
  const exportCsvTemplate = () => {
    const template = CSV_TEMPLATES[framework]
    const headers = template.headers.join(',')
    const rows = template.example.map(row => row.join(','))
    const csvContent = [headers, ...rows].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `prevention_time_template_${framework.toLowerCase()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Parse CSV file
  const parseCsvFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target.result
          const lines = text.split(/\r?\n/).filter(line => line.trim())
          if (lines.length < 2) {
            reject(new Error('File must have at least a header and one data row'))
            return
          }

          const headers = lines[0].split(',').map(h => h.trim())
          const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim())
            const row = {}
            headers.forEach((header, i) => {
              row[header] = values[i] || ''
            })
            return row
          })

          resolve(data)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  // Handle CSV Import
  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setImportError(ct.invalidFile)
      return
    }

    try {
      const data = await parseCsvFile(file)
      setImportedSites(data)
      setImportError(null)

      // Auto-calculate after import
      setTimeout(() => calculateMultiSite(data), 100)
    } catch (err) {
      setImportError(ct.parseError)
      console.error('CSV parse error:', err)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Calculate for a single DE site (helper function)
  const calculateDeSite = (site) => {
    const fullTime = parseInt(site.Vollzeit_gt30h) || 0
    const partTime20 = parseInt(site.Teilzeit_lte20h) || 0
    const partTime30 = parseInt(site.Teilzeit_21_30h) || 0
    const gruppeKey = site.Betreuungsgruppe || 'II'

    const fteFromPartTime20 = partTime20 * 0.5
    const fteFromPartTime30 = partTime30 * 0.75
    const totalFte = fullTime + fteFromPartTime20 + fteFromPartTime30

    if (totalFte < 1) return null

    const gruppe = BETREUUNGSGRUPPEN[gruppeKey] || BETREUUNGSGRUPPEN['II']
    const fasiHoursPerEmployee = gruppe.fasi
    const baHoursPerEmployee = gruppe.betriebsarzt

    const totalFasiHours = totalFte * fasiHoursPerEmployee
    const totalBaHours = totalFte * baHoursPerEmployee
    const betriebsspezifischFasi = totalFte * 0.2
    const betriebsspezifischBa = totalFte * 0.05
    const totalHours = totalFasiHours + totalBaHours + betriebsspezifischFasi + betriebsspezifischBa

    return {
      siteName: site.Site || 'Unknown',
      employees: fullTime + partTime20 + partTime30,
      totalFte,
      gruppe: gruppeKey,
      totalFasiHours: totalFasiHours + betriebsspezifischFasi,
      totalBaHours: totalBaHours + betriebsspezifischBa,
      totalHours
    }
  }

  // Calculate for a single AT site (helper function)
  const calculateAtSite = (site) => {
    const officeEmp = parseInt(site.Bueroarbeitsplaetze) || 0
    const otherEmp = parseInt(site.Sonstige_Arbeitsplaetze) || 0
    const nightWorkers = parseInt(site.Nachtarbeiter) || 0
    const partTimeEmp = parseInt(site.Teilzeitkraefte) || 0
    const partTimeFte = parseFloat(site.Teilzeit_FTE_Faktor) || 0.5

    if (officeEmp + otherEmp < 1) return null

    const partTimeFteTotal = partTimeEmp * partTimeFte
    const officeHours = officeEmp * 1.2
    const otherHours = otherEmp * 1.5
    const partTimeHours = partTimeFteTotal * 1.5
    const nightWorkBonus = nightWorkers * 0.5
    const totalHours = Math.round(officeHours + otherHours + partTimeHours + nightWorkBonus)

    return {
      siteName: site.Site || 'Unknown',
      totalEmployees: officeEmp + otherEmp + partTimeEmp,
      totalHours,
      sfkHours: totalHours * 0.40,
      amedHours: totalHours * 0.35,
      otherHours: totalHours * 0.25
    }
  }

  // Calculate for a single NL site (helper function)
  const calculateNlSite = (site) => {
    const emp = parseInt(site.Aantal_werknemers) || 0
    const locations = parseInt(site.Aantal_locaties) || 1
    const riskCat = site.Risicocategorie?.toLowerCase() || 'medium'

    if (emp < 1) return null

    const category = NL_RISK_CATEGORIES[riskCat] || NL_RISK_CATEGORIES.medium
    const baseMonthlyHours = category.hoursPerMonthBase * locations
    const employeeBasedHours = emp * category.hoursPerEmployee
    const totalMonthlyHours = baseMonthlyHours + employeeBasedHours
    const totalYearlyHours = totalMonthlyHours * 12
    const bhvRequired = Math.max(1, Math.ceil(emp / 50))

    return {
      siteName: site.Site || 'Unknown',
      employees: emp,
      locations,
      riskCategory: riskCat,
      totalMonthlyHours,
      totalYearlyHours,
      bhvRequired
    }
  }

  // Calculate for all imported sites
  const calculateMultiSite = (sites = importedSites) => {
    if (!sites || sites.length === 0) return

    let results = []
    let totalSummary = {}

    if (framework === 'DE') {
      results = sites.map(calculateDeSite).filter(Boolean)
      totalSummary = {
        siteCount: results.length,
        totalEmployees: results.reduce((sum, r) => sum + r.employees, 0),
        totalFte: results.reduce((sum, r) => sum + r.totalFte, 0),
        totalFasiHours: results.reduce((sum, r) => sum + r.totalFasiHours, 0),
        totalBaHours: results.reduce((sum, r) => sum + r.totalBaHours, 0),
        totalHours: results.reduce((sum, r) => sum + r.totalHours, 0)
      }
    } else if (framework === 'AT') {
      results = sites.map(calculateAtSite).filter(Boolean)
      totalSummary = {
        siteCount: results.length,
        totalEmployees: results.reduce((sum, r) => sum + r.totalEmployees, 0),
        totalHours: results.reduce((sum, r) => sum + r.totalHours, 0),
        totalSfkHours: results.reduce((sum, r) => sum + r.sfkHours, 0),
        totalAmedHours: results.reduce((sum, r) => sum + r.amedHours, 0),
        totalOtherHours: results.reduce((sum, r) => sum + r.otherHours, 0)
      }
    } else if (framework === 'NL') {
      results = sites.map(calculateNlSite).filter(Boolean)
      totalSummary = {
        siteCount: results.length,
        totalEmployees: results.reduce((sum, r) => sum + r.employees, 0),
        totalLocations: results.reduce((sum, r) => sum + r.locations, 0),
        totalMonthlyHours: results.reduce((sum, r) => sum + r.totalMonthlyHours, 0),
        totalYearlyHours: results.reduce((sum, r) => sum + r.totalYearlyHours, 0),
        totalBhvRequired: results.reduce((sum, r) => sum + r.bhvRequired, 0)
      }
    }

    setMultiSiteResults({ sites: results, summary: totalSummary })
  }

  // Export results as CSV
  const exportResults = () => {
    if (!multiSiteResults) return

    let csvContent = ''
    const { sites, summary } = multiSiteResults

    if (framework === 'DE') {
      csvContent = `${ct.site},${ct.employees},FTE,${ct.supportGroup},FaSi ${ct.hours},BA ${ct.hours},${ct.totalPrevention} ${ct.hours}\n`
      sites.forEach(s => {
        csvContent += `${s.siteName},${s.employees},${s.totalFte.toFixed(1)},${s.gruppe},${s.totalFasiHours.toFixed(1)},${s.totalBaHours.toFixed(1)},${s.totalHours.toFixed(1)}\n`
      })
      csvContent += `\n${ct.totalSummary}\n`
      csvContent += `${ct.sitesSummary}: ${summary.siteCount}\n`
      csvContent += `${ct.employees}: ${summary.totalEmployees}\n`
      csvContent += `FTE: ${summary.totalFte.toFixed(1)}\n`
      csvContent += `FaSi ${ct.hours}: ${summary.totalFasiHours.toFixed(1)}\n`
      csvContent += `BA ${ct.hours}: ${summary.totalBaHours.toFixed(1)}\n`
      csvContent += `${ct.totalPrevention}: ${summary.totalHours.toFixed(1)} ${ct.hours}\n`
    } else if (framework === 'AT') {
      csvContent = `${ct.site},${ct.employees},SFK ${ct.hours},AMed ${ct.hours},${ct.otherSpec} ${ct.hours},${ct.totalPrevention} ${ct.hours}\n`
      sites.forEach(s => {
        csvContent += `${s.siteName},${s.totalEmployees},${s.sfkHours.toFixed(1)},${s.amedHours.toFixed(1)},${s.otherHours.toFixed(1)},${s.totalHours}\n`
      })
      csvContent += `\n${ct.totalSummary}\n`
      csvContent += `${ct.sitesSummary}: ${summary.siteCount}\n`
      csvContent += `${ct.employees}: ${summary.totalEmployees}\n`
      csvContent += `${ct.totalPrevention}: ${summary.totalHours} ${ct.hours}\n`
    } else if (framework === 'NL') {
      csvContent = `${ct.site},${ct.employees},${ct.numLocations},${ct.riskCategory},${ct.hoursMonth},${ct.hoursYear},BHV\n`
      sites.forEach(s => {
        csvContent += `${s.siteName},${s.employees},${s.locations},${s.riskCategory},${s.totalMonthlyHours.toFixed(1)},${s.totalYearlyHours.toFixed(1)},${s.bhvRequired}\n`
      })
      csvContent += `\n${ct.totalSummary}\n`
      csvContent += `${ct.sitesSummary}: ${summary.siteCount}\n`
      csvContent += `${ct.employees}: ${summary.totalEmployees}\n`
      csvContent += `${ct.preventionTime}: ${summary.totalYearlyHours.toFixed(1)} ${ct.hoursYear}\n`
      csvContent += `BHV: ${summary.totalBhvRequired}\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `prevention_time_results_${framework.toLowerCase()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Clear imported data
  const clearImport = () => {
    setImportedSites([])
    setMultiSiteResults(null)
    setImportError(null)
  }

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
              {ct.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {ct.subtitle[framework]}
            </p>
          </div>
        </div>

        {/* Mode Toggle: Single Site vs Multi-Site */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <div className="flex rounded-xl bg-gray-100 dark:bg-whs-dark-800 p-1">
            <button
              onClick={() => setMode('single')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'single'
                  ? 'bg-white dark:bg-whs-dark-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {ct.singleSite}
              </span>
            </button>
            <button
              onClick={() => setMode('multi')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'multi'
                  ? 'bg-white dark:bg-whs-dark-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {ct.multiSite}
              </span>
            </button>
          </div>

          {/* CSV Template Download Button */}
          {mode === 'multi' && (
            <button
              onClick={exportCsvTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors border border-emerald-200 dark:border-emerald-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {ct.downloadTemplate}
            </button>
          )}
        </div>
      </div>

      <Card variant="glass" className="overflow-hidden">
        <CardContent className="p-6">
          {/* Multi-Site Mode - CSV Import */}
          {mode === 'multi' && (
            <div className="animate-fade-in mb-6">
              {/* CSV Import Section */}
              <div className="mb-6 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-800/30 rounded-lg">
                      <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-emerald-900 dark:text-emerald-200">{ct.importCsv}</h4>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">{ct.importHelp}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg cursor-pointer hover:bg-emerald-700 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="text-sm font-medium">{ct.importFile}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleCsvImport}
                        className="hidden"
                      />
                    </label>

                    {importedSites.length > 0 && (
                      <button
                        onClick={clearImport}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {ct.clearImport}
                      </button>
                    )}
                  </div>
                </div>

                {importError && (
                  <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {importError}
                    </p>
                  </div>
                )}

                {/* Template Info */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CSV_TEMPLATES[framework].headerTranslations[lang]?.map((header, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 8 8">
                        <circle cx="4" cy="4" r="3" />
                      </svg>
                      {header}
                    </div>
                  )) || CSV_TEMPLATES[framework].headerTranslations.en.map((header, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 8 8">
                        <circle cx="4" cy="4" r="3" />
                      </svg>
                      {header}
                    </div>
                  ))}
                </div>
              </div>

              {/* Imported Sites Count */}
              {importedSites.length > 0 && (
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
                      {importedSites.length} {ct.importedSites}
                    </span>
                  </div>
                  <Button onClick={() => calculateMultiSite()} variant="success" className="!bg-gradient-to-r !from-emerald-500 !to-emerald-600">
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      {ct.calculate}
                    </span>
                  </Button>
                </div>
              )}

              {/* Multi-Site Results */}
              {multiSiteResults && (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Summary Header */}
                  <div className={`p-4 rounded-xl text-white ${
                    framework === 'DE' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                    framework === 'AT' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    'bg-gradient-to-r from-orange-500 to-orange-600'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-lg mb-1">{ct.totalSummary}</h4>
                        <p className="text-white/80 text-sm">
                          {multiSiteResults.summary.siteCount} {ct.sitesSummary} • {multiSiteResults.summary.totalEmployees} {ct.employees}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowSiteDetails(!showSiteDetails)}
                          className="px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
                        >
                          {showSiteDetails ? ct.hideDetails : ct.showDetails}
                        </button>
                        <button
                          onClick={exportResults}
                          className="px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          {ct.exportResults}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Cards based on framework */}
                  {framework === 'DE' && (
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">FaSi ({ct.totalPerYear})</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{multiSiteResults.summary.totalFasiHours?.toFixed(1)} {ct.hours}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{(multiSiteResults.summary.totalFasiHours / 12)?.toFixed(1)} {ct.hours}/{lang === 'de' ? 'Monat' : 'month'}</p>
                      </div>
                      <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                        <p className="text-sm text-rose-700 dark:text-rose-300 mb-1">BA ({ct.totalPerYear})</p>
                        <p className="text-2xl font-bold text-rose-900 dark:text-rose-100">{multiSiteResults.summary.totalBaHours?.toFixed(1)} {ct.hours}</p>
                        <p className="text-xs text-rose-600 dark:text-rose-400">{(multiSiteResults.summary.totalBaHours / 12)?.toFixed(1)} {ct.hours}/{lang === 'de' ? 'Monat' : 'month'}</p>
                      </div>
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">{ct.totalPrevention}</p>
                        <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{multiSiteResults.summary.totalHours?.toFixed(1)} {ct.hours}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{(multiSiteResults.summary.totalHours / 8)?.toFixed(1)} {ct.workDays}</p>
                      </div>
                    </div>
                  )}

                  {framework === 'AT' && (
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">SFK (min. 40%)</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{multiSiteResults.summary.totalSfkHours?.toFixed(1)} {ct.hours}</p>
                      </div>
                      <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                        <p className="text-sm text-rose-700 dark:text-rose-300 mb-1">AMed (min. 35%)</p>
                        <p className="text-2xl font-bold text-rose-900 dark:text-rose-100">{multiSiteResults.summary.totalAmedHours?.toFixed(1)} {ct.hours}</p>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 text-center">
                        <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">{ct.otherSpec.split(' ')[0]} (25%)</p>
                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{multiSiteResults.summary.totalOtherHours?.toFixed(1)} {ct.hours}</p>
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 text-center">
                        <p className="text-sm text-red-700 dark:text-red-300 mb-1">{ct.totalPrevention}</p>
                        <p className="text-2xl font-bold text-red-900 dark:text-red-100">{multiSiteResults.summary.totalHours} {ct.hours}</p>
                      </div>
                    </div>
                  )}

                  {framework === 'NL' && (
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 text-center">
                        <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">{ct.preventionTime}</p>
                        <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{multiSiteResults.summary.totalYearlyHours?.toFixed(1)} {ct.hoursYear}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">{multiSiteResults.summary.totalMonthlyHours?.toFixed(1)} {ct.hoursMonth}</p>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">BHV {ct.required}</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{multiSiteResults.summary.totalBhvRequired} {ct.person}</p>
                      </div>
                      <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800 text-center">
                        <p className="text-sm text-teal-700 dark:text-teal-300 mb-1">{ct.numLocations}</p>
                        <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">{multiSiteResults.summary.totalLocations}</p>
                      </div>
                    </div>
                  )}

                  {/* Workload Percentage Visualization */}
                  {(() => {
                    // Calculate FTE based on 40h/week * 52 weeks = 2080 hours/year
                    const ANNUAL_WORK_HOURS = 2080
                    const totalHours = framework === 'NL'
                      ? multiSiteResults.summary.totalYearlyHours
                      : multiSiteResults.summary.totalHours
                    const fteNeeded = totalHours / ANNUAL_WORK_HOURS
                    const percentageOfFte = Math.min((fteNeeded * 100), 100)
                    const displayPercent = fteNeeded * 100 // Can be over 100%

                    // Color based on workload level
                    const getBarColor = (pct) => {
                      if (pct <= 50) return 'from-emerald-400 to-emerald-500'
                      if (pct <= 100) return 'from-yellow-400 to-orange-500'
                      return 'from-red-400 to-red-600'
                    }

                    return (
                      <div className="mt-4 p-5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-whs-dark-800 dark:to-whs-dark-800/80 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h5 className="font-semibold text-gray-900 dark:text-white">{ct.workloadTitle}</h5>
                        </div>

                        <div className="flex items-center gap-6 flex-wrap">
                          {/* FTE Number */}
                          <div className="text-center">
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{fteNeeded.toFixed(2)}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{ct.fte} {ct.workloadFte}</p>
                          </div>

                          {/* Separator */}
                          <div className="hidden sm:block w-px h-12 bg-gray-300 dark:bg-gray-600"></div>

                          {/* Progress Bar */}
                          <div className="flex-1 min-w-[200px]">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{displayPercent.toFixed(1)}% {ct.workloadPercent}</span>
                              {displayPercent > 100 && (
                                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded">
                                  &gt;1 FTE
                                </span>
                              )}
                            </div>
                            <div className="h-4 bg-gray-200 dark:bg-whs-dark-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${getBarColor(displayPercent)} rounded-full transition-all duration-500`}
                                style={{ width: `${Math.min(percentageOfFte, 100)}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>0%</span>
                              <span>50%</span>
                              <span>100%</span>
                            </div>
                          </div>

                          {/* Visual FTE representation */}
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.ceil(fteNeeded) || 1 }, (_, i) => {
                              const fillPercent = Math.min(1, fteNeeded - i)
                              return (
                                <div key={i} className="relative w-10 h-14 bg-gray-200 dark:bg-whs-dark-700 rounded-lg overflow-hidden" title={`${ct.fte} ${i + 1}`}>
                                  <div
                                    className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${i < Math.floor(fteNeeded) ? 'from-emerald-500 to-emerald-400' : 'from-amber-500 to-amber-400'} transition-all duration-500`}
                                    style={{ height: `${fillPercent * 100}%` }}
                                  ></div>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {ct.workloadNote} (40h × 52 {lang === 'de' ? 'Wochen' : lang === 'nl' ? 'weken' : 'weeks'} = 2.080 h/{lang === 'de' ? 'Jahr' : lang === 'nl' ? 'jaar' : 'year'})
                        </p>
                      </div>
                    )
                  })()}

                  {/* Per-Site Details */}
                  {showSiteDetails && (
                    <div className="mt-4 overflow-x-auto">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-3">{ct.perSiteDetails}</h5>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-whs-dark-700">
                            <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">{ct.site}</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">{ct.employees}</th>
                            {framework === 'DE' && (
                              <>
                                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">FTE</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">{ct.supportGroup}</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">FaSi</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">BA</th>
                              </>
                            )}
                            {framework === 'AT' && (
                              <>
                                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">SFK</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">AMed</th>
                              </>
                            )}
                            {framework === 'NL' && (
                              <>
                                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">{ct.riskCategory}</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">BHV</th>
                              </>
                            )}
                            <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">{ct.totalPrevTime}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {multiSiteResults.sites.map((site, idx) => (
                            <tr key={idx} className="border-b border-gray-100 dark:border-whs-dark-800 hover:bg-gray-50 dark:hover:bg-whs-dark-800/50">
                              <td className="py-2 px-3 text-gray-900 dark:text-white font-medium">{site.siteName}</td>
                              <td className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">{framework === 'AT' ? site.totalEmployees : site.employees}</td>
                              {framework === 'DE' && (
                                <>
                                  <td className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">{site.totalFte?.toFixed(1)}</td>
                                  <td className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">{site.gruppe}</td>
                                  <td className="text-right py-2 px-3 text-blue-600 dark:text-blue-400">{site.totalFasiHours?.toFixed(1)}</td>
                                  <td className="text-right py-2 px-3 text-rose-600 dark:text-rose-400">{site.totalBaHours?.toFixed(1)}</td>
                                </>
                              )}
                              {framework === 'AT' && (
                                <>
                                  <td className="text-right py-2 px-3 text-blue-600 dark:text-blue-400">{site.sfkHours?.toFixed(1)}</td>
                                  <td className="text-right py-2 px-3 text-rose-600 dark:text-rose-400">{site.amedHours?.toFixed(1)}</td>
                                </>
                              )}
                              {framework === 'NL' && (
                                <>
                                  <td className="text-right py-2 px-3 text-gray-600 dark:text-gray-400 capitalize">{site.riskCategory}</td>
                                  <td className="text-right py-2 px-3 text-blue-600 dark:text-blue-400">{site.bhvRequired}</td>
                                </>
                              )}
                              <td className="text-right py-2 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                                {framework === 'NL' ? site.totalYearlyHours?.toFixed(1) : (framework === 'AT' ? site.totalHours : site.totalHours?.toFixed(1))} {ct.hours}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {importedSites.length === 0 && !multiSiteResults && (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">{ct.noSitesImported}</p>
                </div>
              )}
            </div>
          )}

          {/* Single Site Mode - GERMANY (DE) */}
          {mode === 'single' && framework === 'DE' && (
            <div className="animate-fade-in">
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ct.fullTimeEmployees}
                    <span className="ml-1 text-xs text-gray-500">({ct.factor} 1.0)</span>
                  </label>
                  <Input
                    type="number"
                    value={deFullTimeEmployees}
                    onChange={(e) => setDeFullTimeEmployees(e.target.value)}
                    placeholder={`${ct.placeholder} 100`}
                    min="0"
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ct.supportGroup}
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
                    {ct.partTime20}
                    <span className="ml-1 text-xs text-gray-500">({ct.factor} 0.5)</span>
                  </label>
                  <Input
                    type="number"
                    value={dePartTime20}
                    onChange={(e) => setDePartTime20(e.target.value)}
                    placeholder={`${ct.placeholder} 30`}
                    min="0"
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ct.partTime30}
                    <span className="ml-1 text-xs text-gray-500">({ct.factor} 0.75)</span>
                  </label>
                  <Input
                    type="number"
                    value={dePartTime30}
                    onChange={(e) => setDePartTime30(e.target.value)}
                    placeholder={`${ct.placeholder} 20`}
                    min="0"
                    variant="glass"
                  />
                </div>
              </div>

              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🇩🇪</span>
                  <div className="text-sm text-emerald-800 dark:text-emerald-300">
                    <p className="font-medium mb-1">{ct.dguv2Info}</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>≤20 {ct.hours}/{lang === 'de' ? 'Woche' : lang === 'nl' ? 'week' : 'week'} = {ct.factor} 0.5</li>
                      <li>21-30 {ct.hours}/{lang === 'de' ? 'Woche' : lang === 'nl' ? 'week' : 'week'} = {ct.factor} 0.75</li>
                      <li>&gt;30 {ct.hours}/{lang === 'de' ? 'Woche' : lang === 'nl' ? 'week' : 'week'} = {ct.factor} 1.0</li>
                    </ul>
                    <p className="mt-2">{ct.deliveryLogistics} (1.5 {ct.hours}/MA FaSi + 0.5 {ct.hours}/MA BA)</p>
                  </div>
                </div>
              </div>

              <Button onClick={calculatePraeventionszeit} variant="success" className="mb-6 !bg-gradient-to-r !from-emerald-500 !to-emerald-600">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {ct.calculate}
                </span>
              </Button>

              {praeventionResult && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl text-white">
                    <h4 className="font-semibold text-lg mb-1">
                      {ct.resultsFor} {praeventionResult.employees} {ct.employees} ({praeventionResult.totalFte} FTE)
                    </h4>
                    <p className="text-emerald-100 text-sm">{praeventionResult.gruppeName}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">👷</span>
                        <h5 className="font-semibold text-blue-900 dark:text-blue-200">
                          {lang === 'de' ? 'Fachkraft für Arbeitssicherheit (FaSi)' : lang === 'nl' ? 'Veiligheidsdeskundige (FaSi)' : 'Safety Specialist (FaSi)'}
                        </h5>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-700 dark:text-blue-300">{ct.totalPerYear}:</span>
                          <span className="font-bold text-blue-900 dark:text-blue-100 bg-blue-100 dark:bg-blue-800 px-3 py-1 rounded-lg">
                            {praeventionResult.totalFasiHours} {ct.hours}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-blue-700 dark:text-blue-300">{ct.perMonth}:</span>
                          <span className="text-blue-900 dark:text-blue-100">{praeventionResult.fasiMonthly} {ct.hours}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🩺</span>
                        <h5 className="font-semibold text-rose-900 dark:text-rose-200">
                          {lang === 'de' ? 'Betriebsarzt' : lang === 'nl' ? 'Bedrijfsarts' : 'Occupational Physician'}
                        </h5>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-rose-700 dark:text-rose-300">{ct.totalPerYear}:</span>
                          <span className="font-bold text-rose-900 dark:text-rose-100 bg-rose-100 dark:bg-rose-800 px-3 py-1 rounded-lg">
                            {praeventionResult.totalBaHours} {ct.hours}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-rose-700 dark:text-rose-300">{ct.perMonth}:</span>
                          <span className="text-rose-900 dark:text-rose-100">{praeventionResult.baMonthly} {ct.hours}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-gray-900 dark:text-white">{ct.totalPrevention}</h5>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{ct.basicCare} + {ct.companySpecific}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {praeventionResult.totalHours} {ct.hours}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">({praeventionResult.totalDays} {ct.workDays})</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUSTRIA (AT) - Single Site Mode */}
          {mode === 'single' && framework === 'AT' && (
            <div className="animate-fade-in">
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ct.officeWorkplaces}
                    <span className="ml-1 text-xs text-gray-500">(1.2 h/MA)</span>
                  </label>
                  <Input
                    type="number"
                    value={atOfficeEmployees}
                    onChange={(e) => setAtOfficeEmployees(e.target.value)}
                    placeholder={`${ct.placeholder} 20`}
                    min="0"
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ct.otherWorkplaces}
                    <span className="ml-1 text-xs text-gray-500">(1.5 h/MA)</span>
                  </label>
                  <Input
                    type="number"
                    value={atOtherEmployees}
                    onChange={(e) => setAtOtherEmployees(e.target.value)}
                    placeholder={`${ct.placeholder} 130`}
                    min="0"
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ct.nightWorkers}
                    <span className="ml-1 text-xs text-gray-500">(+0.5 h/MA)</span>
                  </label>
                  <Input
                    type="number"
                    value={atNightWorkers}
                    onChange={(e) => setAtNightWorkers(e.target.value)}
                    placeholder={`${ct.placeholder} 40`}
                    min="0"
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ct.partTimeWorkers}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={atPartTimeEmployees}
                      onChange={(e) => setAtPartTimeEmployees(e.target.value)}
                      placeholder={ct.count}
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
                    <p className="font-medium mb-1">{ct.atInfo}</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>{ct.sfkMin}</li>
                      <li>{ct.amedMin}</li>
                      <li>{ct.otherSpec}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button onClick={calculateAtPraeventionszeit} variant="success" className="mb-6 !bg-gradient-to-r !from-red-500 !to-red-600">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {ct.calculate}
                </span>
              </Button>

              {atResult && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="p-4 bg-gradient-to-r from-red-500 to-red-600 rounded-xl text-white">
                    <h4 className="font-semibold text-lg mb-1">
                      {ct.resultsFor} {atResult.totalEmployees} {ct.employees}
                    </h4>
                    <p className="text-red-100 text-sm">§ 82a ASchG</p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">SFK (min. 40%)</p>
                      <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{atResult.sfkMinHours} {ct.hours}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">{atResult.sfkMonthly} {ct.hours}/{lang === 'de' ? 'Monat' : 'month'}</p>
                    </div>
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                      <p className="text-sm text-rose-700 dark:text-rose-300 mb-1">AMed (min. 35%)</p>
                      <p className="text-xl font-bold text-rose-900 dark:text-rose-100">{atResult.amedMinHours} {ct.hours}</p>
                      <p className="text-xs text-rose-600 dark:text-rose-400">{atResult.amedMonthly} {ct.hours}/{lang === 'de' ? 'Monat' : 'month'}</p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 text-center">
                      <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">{ct.otherSpec.split(' ')[0]} (25%)</p>
                      <p className="text-xl font-bold text-purple-900 dark:text-purple-100">{atResult.otherSpecialistsHours} {ct.hours}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-whs-dark-800/50 rounded-xl border border-gray-200 dark:border-whs-dark-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-gray-900 dark:text-white">{ct.totalPrevTime}</h5>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-red-600 dark:text-red-400">{atResult.totalHours} {ct.hours}</span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">({atResult.totalDays} {ct.workDays})</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NETHERLANDS (NL) - Single Site Mode */}
          {mode === 'single' && framework === 'NL' && (
            <div className="animate-fade-in">
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ct.numEmployees}
                  </label>
                  <Input
                    type="number"
                    value={nlEmployees}
                    onChange={(e) => setNlEmployees(e.target.value)}
                    placeholder={`${ct.placeholder} 150`}
                    min="1"
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ct.riskCategory}
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
                    {ct.numLocations}
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
                    <p className="font-medium mb-1">{ct.nlInfo}</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>{ct.nlSelf}</li>
                      <li>{ct.nlRie}</li>
                      <li>{ct.nlBhv}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button onClick={calculateNlPraeventionszeit} variant="success" className="mb-6 !bg-gradient-to-r !from-orange-500 !to-orange-600">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {ct.calculate}
                </span>
              </Button>

              {nlResult && (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="p-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white">
                    <h4 className="font-semibold text-lg mb-1">
                      {ct.resultsFor} {nlResult.employees} {ct.employees} ({nlResult.locations} {nlResult.locations > 1 ? (lang === 'nl' ? 'locaties' : lang === 'de' ? 'Standorte' : 'locations') : (lang === 'nl' ? 'locatie' : lang === 'de' ? 'Standort' : 'location')})
                    </h4>
                    <p className="text-orange-100 text-sm">{nlResult.riskCategoryName}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                      <h5 className="font-semibold text-orange-900 dark:text-orange-200 mb-2">{ct.preventionTime}</h5>
                      <p className="text-2xl font-bold text-orange-600">{nlResult.totalYearlyHours} {ct.hoursYear}</p>
                      <p className="text-sm text-orange-700 dark:text-orange-300">{nlResult.totalMonthlyHours} {ct.hoursMonth}</p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <h5 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">{ct.requirements}</h5>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        <li>{ct.bhv}: min. {nlResult.bhvRequired} {ct.person}</li>
                        <li>{ct.prevMed}: {nlResult.preventiemedewerkerSelf ? ct.employerCan : ct.required}</li>
                        <li>{ct.rieToets}: {nlResult.rieToetsingRequired ? ct.required : ct.exempt}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Related Laws Section - Crosslinking */}
      {onNavigateToLaw && RELATED_LAWS[framework] && (
        <div className="mt-6 p-6 bg-white/50 dark:bg-whs-dark-800/50 rounded-2xl border border-gray-200 dark:border-whs-dark-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-whs-orange-100 dark:bg-whs-orange-900/30 rounded-lg">
              <svg className="w-5 h-5 text-whs-orange-600 dark:text-whs-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{ct.relatedLaws}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{ct.relatedLawsDesc}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {RELATED_LAWS[framework].map((law) => (
              <button
                key={law.id}
                onClick={() => onNavigateToLaw(law.abbreviation, framework, null)}
                className="flex items-start gap-3 p-4 bg-white dark:bg-whs-dark-700/50 rounded-xl border border-gray-200 dark:border-whs-dark-600 hover:border-whs-orange-300 dark:hover:border-whs-orange-600 hover:shadow-md transition-all text-left group"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-whs-orange-500 to-whs-orange-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                  {framework === 'DE' ? '🇩🇪' : framework === 'AT' ? '🇦🇹' : '🇳🇱'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">{law.abbreviation}</span>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-whs-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">{law.title[lang] || law.title.en}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{law.description[lang] || law.description.en}</p>
                </div>
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {ct.viewInLawBrowser}
          </p>
        </div>
      )}
    </div>
  )
}

export default PreventionTimeCalculator

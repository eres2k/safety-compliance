#!/usr/bin/env node
/**
 * Fix AT Database Titles
 * Adds proper section titles to the Austrian ASchG law database
 *
 * Usage: node scripts/fix-at-titles.js
 */

const fs = require('fs')
const path = require('path')

// Official ASchG section titles from RIS
const ASCHG_TITLES = {
  '1': 'Geltungsbereich',
  '2': 'Begriffsbestimmungen',
  '3': 'Allgemeine Pflichten der Arbeitgeber',
  '4': 'Ermittlung und Beurteilung der Gefahren',
  '5': 'Sicherheits- und Gesundheitsschutzdokumente',
  '6': 'Einsatz der Arbeitnehmer',
  '7': 'Grundsätze der Gefahrenverhütung',
  '8': 'Koordination',
  '9': 'Überlassung',
  '10': 'Bestellung von Sicherheitsvertrauenspersonen',
  '11': 'Aufgaben und Beteiligung der Sicherheitsvertrauenspersonen',
  '12': 'Information',
  '13': 'Anhörung und Beteiligung',
  '14': 'Unterweisung',
  '15': 'Pflichten der Arbeitnehmer',
  '16': 'Aufzeichnungs- und Meldepflichten',
  '17': 'Instandhaltung, Reinigung, Prüfung',
  '18': 'Verordnungsermächtigung',
  '19': 'Begriffsbestimmungen',
  '20': 'Allgemeine Anforderungen an Arbeitsstätten',
  '21': 'Anforderungen an Gebäude',
  '22': 'Arbeitsräume',
  '23': 'Sonstige Betriebsräume',
  '24': 'Sanitäre Vorkehrungen und Sozialeinrichtungen',
  '25': 'Brandschutz und Explosionsschutz',
  '26': 'Erste Hilfe',
  '27': 'Besondere Maßnahmen',
  '28': 'Nichtraucherschutz',
  '29': 'Arbeitsstätten im Freien',
  '30': 'Besondere Arbeitsstätten',
  '31': 'Baustellen',
  '32': 'Verordnungsermächtigung',
  '33': 'Allgemeine Bestimmungen',
  '34': 'Beschaffenheit',
  '35': 'Aufstellung und Verwendung',
  '36': 'Prüfung',
  '37': 'Schutzmaßnahmen',
  '38': 'Besondere Arbeitsmittel',
  '39': 'Verordnungsermächtigung',
  '40': 'Allgemeine Bestimmungen',
  '41': 'Ermittlung und Beurteilung',
  '42': 'Maßnahmen zur Gefahrenverhütung',
  '43': 'Information der Arbeitnehmer',
  '44': 'Persönliche Schutzausrüstung',
  '45': 'Grenzwerte',
  '46': 'Messungen',
  '47': 'Verzeichnisse und Aufzeichnungen',
  '48': 'Verordnungsermächtigung',
  '49': 'Allgemeine Bestimmungen',
  '50': 'Eignungsuntersuchungen und Folgeuntersuchungen',
  '51': 'Sonstige besondere Untersuchungen',
  '52': 'Durchführung der Untersuchungen',
  '52a': 'Untersuchungsstellen',
  '53': 'Inhalt der Untersuchungen',
  '54': 'Beurteilung und Bescheinigung',
  '55': 'Gesundheitsakte',
  '56': 'Verpflichtungen nach Beendigung der Tätigkeit',
  '57': 'Pflichten der Arbeitgeber',
  '58': 'Sonstige Maßnahmen',
  '59': 'Verordnungsermächtigung',
  '60': 'Allgemeine Bestimmungen',
  '61': 'Ergonomie',
  '62': 'Sitzen und Stehen',
  '63': 'Heben und Tragen',
  '64': 'Lärm',
  '65': 'Erschütterungen',
  '66': 'Sonstige Einwirkungen',
  '67': 'Besondere Arbeitsvorgänge',
  '68': 'Bildschirmarbeitsplätze',
  '69': 'Alleinarbeit',
  '70': 'Schutz bestimmter Gruppen von Arbeitnehmern',
  '71': 'Wechselnde Arbeitsstellen',
  '72': 'Verordnungsermächtigung',
  '73': 'Sicherheitstechnische und arbeitsmedizinische Betreuung',
  '74': 'Präventivdienste',
  '75': 'Bestellung von Sicherheitsfachkräften',
  '76': 'Fachkenntnisse der Sicherheitsfachkräfte',
  '77': 'Aufgaben der Sicherheitsfachkräfte',
  '78': 'Bestellung von Arbeitsmedizinern',
  '79': 'Fachkenntnisse der Arbeitsmediziner',
  '80': 'Aufgaben der Arbeitsmediziner',
  '81': 'Präventionszeit',
  '82': 'Beschäftigung von Sicherheitsfachkräften und Arbeitsmedizinern',
  '82a': 'Qualitätssicherung',
  '83': 'Sonstige Fachleute',
  '84': 'Arbeitsschutzausschüsse',
  '85': 'Tätigkeit im Arbeitsschutzausschuß',
  '86': 'Zentrale Arbeitsschutzausschüsse',
  '87': 'Unabhängigkeit',
  '88': 'Informations- und Geheimhaltungspflichten',
  '89': 'Präventionszentren',
  '90': 'Verordnungsermächtigung',
  '91': 'Arbeitsinspektorate',
  '92': 'Aufgaben der Arbeitsinspektion',
  '93': 'Befugnisse der Arbeitsinspektion',
  '94': 'Vorschreibung von Maßnahmen',
  '95': 'Bauarbeiten-Koordination',
  '96': 'Untersagung der Verwendung',
  '97': 'Auskunfts- und Unterstützungspflicht',
  '98': 'Amtshilfe und Zusammenarbeit',
  '99': 'Meldung von Arbeitsunfällen',
  '100': 'Verkehrsmittel',
  '101': 'Verordnungsermächtigung',
  '102': 'Übergangsbestimmungen für Arbeitsstätten',
  '103': 'Übergangsbestimmungen für Arbeitsmittel',
  '104': 'Übergangsbestimmungen für Arbeitsstoffe',
  '105': 'Übergangsbestimmungen betreffend Gesundheitsüberwachung',
  '106': 'Übergangsbestimmungen betreffend Präventivdienste',
  '107': 'Übergangsbestimmungen betreffend Sicherheitsvertrauenspersonen',
  '108': 'Übergangsbestimmung betreffend Bergbau',
  '109': 'Übergangsbestimmung betreffend Sprengarbeiten',
  '110': 'Außerkrafttreten',
  '111': 'Außerkrafttreten',
  '112': 'Weitergeltung von Verordnungen',
  '113': 'Verweisungen',
  '114': 'Vollziehung',
  '115': 'Bescheidmäßige Genehmigungen',
  '116': 'Bescheidmäßige Vorschreibungen',
  '117': 'Bewilligungen nach der Allgemeinen Arbeitnehmerschutzverordnung',
  '118': 'Mutterschutz',
  '119': 'Arbeitsstätten mit besonderer Gefährdung',
  '120': 'Absturzsicherungen und Schutzeinrichtungen',
  '121': 'Verkehrswege, Türen und Tore',
  '122': 'Prüfung von Aufzügen',
  '123': 'Beleuchtung',
  '124': 'Sonstige Übergangsbestimmungen',
  '125': 'Strafbestimmungen',
  '126': 'Besondere Strafbestimmungen für Überlassung',
  '127': 'Verwaltungsstrafverfahren',
  '127a': 'Zuständigkeit für Bergbau',
  '128': 'Inkrafttreten',
  '129': 'Außerkrafttreten',
  '130': 'Strafbestimmungen',
  '131': 'Inkrafttreten',
  '132': 'Vollziehung'
}

const DB_PATH = path.join(__dirname, '..', 'eu_safety_laws', 'at', 'at_database.json')
const BACKUP_PATH = path.join(__dirname, '..', 'eu_safety_laws', 'at', 'at_database.backup.json')

function main() {
  console.log('=== AT Database Title Fixer ===\n')

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error('ERROR: Database not found at', DB_PATH)
    process.exit(1)
  }

  // Read database
  console.log('Reading database...')
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))

  // Create backup
  console.log('Creating backup...')
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(data, null, 2))

  // Track changes
  let updatedCount = 0

  // Process documents
  for (const doc of data.documents || []) {
    if (doc.abbreviation !== 'ASchG') continue

    // Process chapters
    for (const chapter of doc.chapters || []) {
      for (const section of chapter.sections || []) {
        const num = section.number
        const officialTitle = ASCHG_TITLES[num]

        if (officialTitle) {
          const newTitle = `§ ${num}. ${officialTitle}`
          if (section.title !== newTitle) {
            console.log(`  ${section.title} -> ${newTitle}`)
            section.title = newTitle
            updatedCount++
          }
        }
      }
    }
  }

  // Update metadata
  data.metadata = data.metadata || {}
  data.metadata.titles_fixed_at = new Date().toISOString()

  // Save database
  console.log(`\nUpdated ${updatedCount} section titles`)
  console.log('Saving database...')
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))

  console.log('Done! Backup saved to:', BACKUP_PATH)
}

main()

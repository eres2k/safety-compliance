#!/usr/bin/env node
/**
 * Add Abschnitt/Section structure to laws that are missing it
 * This script adds chapter groupings based on official law structure
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Section mappings for German laws
// Format: { lawAbbreviation: { sectionNumber: { abschnitt: number, title: "..." } } }
const DE_SECTION_MAPPINGS = {
  'MuSchG': {
    // Abschnitt 1: Allgemeine Vorschriften
    abschnitte: [
      { number: '1', title: 'Allgemeine Vorschriften', sections: ['1', '2'] },
      { number: '2', title: 'Gesundheitsschutz', sections: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'] },
      { number: '3', title: 'Kündigungsschutz', sections: ['17'] },
      { number: '4', title: 'Leistungen', sections: ['18', '19', '20', '21', '22', '23', '24', '25'] },
      { number: '5', title: 'Durchführung des Gesetzes', sections: ['26', '27', '28', '29', '30', '31'] },
      { number: '6', title: 'Bußgeldvorschriften, Strafvorschriften', sections: ['32', '33', '34'] },
    ]
  },
  'ArbZG': {
    abschnitte: [
      { number: '1', title: 'Allgemeine Vorschriften', sections: ['1', '2'] },
      { number: '2', title: 'Werktägliche Arbeitszeit und arbeitsfreie Zeiten', sections: ['3', '4', '5', '6', '7', '8'] },
      { number: '3', title: 'Sonn- und Feiertagsruhe', sections: ['9', '10', '11', '12', '13'] },
      { number: '4', title: 'Ausnahmen in besonderen Fällen', sections: ['14', '15'] },
      { number: '5', title: 'Durchführung des Gesetzes', sections: ['16', '17', '18', '19', '20', '21'] },
      { number: '6', title: 'Sonderregelungen', sections: ['22', '23', '24', '25', '26', '27', '28', '29', '30', '31'] },
    ]
  },
  'JArbSchG': {
    abschnitte: [
      { number: '1', title: 'Allgemeine Vorschriften', sections: ['1', '2', '3', '4', '5'] },
      { number: '2', title: 'Beschäftigung von Kindern', sections: ['5', '6', '7'] },
      { number: '3', title: 'Beschäftigung Jugendlicher', sections: ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '21a', '21b', '22', '22a', '22b', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'] },
      { number: '4', title: 'Urlaub', sections: ['19'] },
      { number: '5', title: 'Durchführung des Gesetzes', sections: ['47', '48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75'] },
    ]
  },
  'ASiG': {
    abschnitte: [
      { number: '1', title: 'Allgemeine Vorschriften', sections: ['1'] },
      { number: '2', title: 'Betriebsärzte', sections: ['2', '3', '4'] },
      { number: '3', title: 'Fachkräfte für Arbeitssicherheit', sections: ['5', '6', '7'] },
      { number: '4', title: 'Gemeinsame Vorschriften', sections: ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'] },
    ]
  },
  'BetrSichV': {
    abschnitte: [
      { number: '1', title: 'Anwendungsbereich und Begriffsbestimmungen', sections: ['1', '2'] },
      { number: '2', title: 'Gefährdungsbeurteilung und Schutzmaßnahmen', sections: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'] },
      { number: '3', title: 'Zusätzliche Vorschriften für überwachungsbedürftige Anlagen', sections: ['14', '15', '16', '17', '18', '19', '20'] },
      { number: '4', title: 'Vollzugsregelungen und Ausschuss für Betriebssicherheit', sections: ['21'] },
      { number: '5', title: 'Ordnungswidrigkeiten und Straftaten, Schlussvorschriften', sections: ['22', '23', '24'] },
    ]
  },
}

// Section mappings for Austrian laws
const AT_SECTION_MAPPINGS = {
  'MSchG': {
    abschnitte: [
      { number: '1', title: 'Allgemeine Bestimmungen', sections: ['1', '2', '3'] },
      { number: '2', title: 'Beschäftigungsverbote', sections: ['3a', '4', '5', '5a', '6', '7', '8', '9'] },
      { number: '3', title: 'Entgeltfortzahlung', sections: ['10', '11', '12', '13', '14', '15'] },
      { number: '4', title: 'Kündigungs- und Entlassungsschutz', sections: ['16', '17', '18', '19', '20'] },
      { number: '5', title: 'Karenz', sections: ['21', '21a', '21b', '21c', '22', '23', '24'] },
      { number: '6', title: 'Sonstige Bestimmungen', sections: ['25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51'] },
    ]
  },
  'AZG': {
    abschnitte: [
      { number: '1', title: 'Allgemeine Bestimmungen', sections: ['1', '2', '3'] },
      { number: '2', title: 'Normalarbeitszeit', sections: ['3', '4', '5', '6', '7', '8', '9'] },
      { number: '3', title: 'Überstunden', sections: ['10', '11', '12', '13'] },
      { number: '4', title: 'Ruhezeiten', sections: ['14', '15', '16', '17', '18', '19', '20'] },
      { number: '5', title: 'Sonn- und Feiertagsarbeit', sections: ['21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31'] },
      { number: '6', title: 'Schlussbestimmungen', sections: ['32', '33', '34', '35'] },
    ]
  },
  'KJBG': {
    abschnitte: [
      { number: '1', title: 'Allgemeine Bestimmungen', sections: ['1', '2', '3'] },
      { number: '2', title: 'Beschäftigungsverbote und -beschränkungen', sections: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29'] },
      { number: '3', title: 'Strafbestimmungen', sections: ['30', '31', '32', '33', '34'] },
      { number: '4', title: 'Schlussbestimmungen', sections: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49'] },
    ]
  },
}

// Section mappings for Dutch laws
const NL_SECTION_MAPPINGS = {
  'Arbeidstijdenwet': {
    abschnitte: [
      { number: '1', title: 'Begripsbepalingen en toepassingsgebied', sections: ['1', '2', '3'] },
      { number: '2', title: 'Arbeids- en rusttijden', sections: ['4', '5', '6', '7'] },
      { number: '3', title: 'Consignatie en bereikbaarheidsdienst', sections: ['8', '9'] },
      { number: '4', title: 'Toezicht en handhaving', sections: ['10', '11'] },
      { number: '5', title: 'Slotbepalingen', sections: ['12'] },
    ]
  },
  'WOR': {
    abschnitte: [
      { number: '1', title: 'Begripsbepalingen', sections: ['1'] },
      { number: '2', title: 'De instelling van ondernemingsraden', sections: ['2', '3', '4', '5', '5a'] },
      { number: '3', title: 'De samenstelling van de ondernemingsraad', sections: ['6', '7', '8', '9', '10', '11', '12', '13', '14', '15'] },
      { number: '4', title: 'De werkwijze van de ondernemingsraad', sections: ['16', '17', '18', '19', '20', '21', '22', '22a', '23', '23a', '23b', '23c', '24'] },
      { number: '5', title: 'Bevoegdheden van de ondernemingsraad', sections: ['25', '26', '27', '28', '29', '30', '31', '31a', '31b', '31c', '31d', '31e', '31f', '32', '32a', '32b', '32c', '33', '34', '35', '35a', '35b', '35c', '35d'] },
      { number: '6', title: 'De bedrijfscommissies', sections: ['36', '36a', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '46a', '46b', '46c', '46d', '46e'] },
      { number: '7', title: 'Bepalingen van bijzondere aard', sections: ['47', '48', '49', '49a', '50', '51', '52', '53', '53a', '53b', '53c'] },
      { number: '8', title: 'Slotbepalingen', sections: ['54'] },
    ]
  },
  'Arbobesluit': {
    abschnitte: [
      { number: '1', title: 'Algemene bepalingen', sections: ['1', '2'] },
      { number: '2', title: 'Arbozorg en organisatie van de arbeid', sections: ['3', '4', '5'] },
      { number: '3', title: 'Inrichting arbeidsplaatsen', sections: ['6', '7'] },
      { number: '4', title: 'Gevaarlijke stoffen en biologische agentia', sections: ['8'] },
      { number: '5', title: 'Overgangs- en slotbepalingen', sections: ['9'] },
    ]
  },
}

function restructureDocument(doc, mappings) {
  const mapping = mappings[doc.abbreviation]
  if (!mapping) return null

  const existingSections = doc.chapters?.[0]?.sections || []
  if (existingSections.length === 0) return null

  const newChapters = []

  for (const abschnitt of mapping.abschnitte) {
    const chapterSections = existingSections.filter(s => {
      const sectionNum = s.number?.toString().replace(/^§\s*/, '').replace(/^Artikel\s*/i, '')
      return abschnitt.sections.includes(sectionNum)
    })

    if (chapterSections.length > 0) {
      const isGerman = ['DE', 'AT'].includes(doc.jurisdiction)
      const prefix = isGerman ? 'Abschnitt' : 'Hoofdstuk'
      const ordinals = ['', 'Erster', 'Zweiter', 'Dritter', 'Vierter', 'Fünfter', 'Sechster', 'Siebter', 'Achter', 'Neunter', 'Zehnter']

      newChapters.push({
        id: `${doc.jurisdiction.toLowerCase()}-${doc.abbreviation.toLowerCase()}-ch${abschnitt.number}`,
        number: abschnitt.number,
        title: isGerman
          ? `${ordinals[parseInt(abschnitt.number)] || abschnitt.number + '.'} ${prefix} - ${abschnitt.title}`
          : `${prefix} ${abschnitt.number} - ${abschnitt.title}`,
        title_en: `Section ${abschnitt.number} - ${abschnitt.title}`,
        sections: chapterSections,
      })
    }
  }

  // Add any sections not matched to a "Sonstige" chapter
  const mappedSections = mapping.abschnitte.flatMap(a => a.sections)
  const unmappedSections = existingSections.filter(s => {
    const sectionNum = s.number?.toString().replace(/^§\s*/, '').replace(/^Artikel\s*/i, '')
    return !mappedSections.includes(sectionNum)
  })

  if (unmappedSections.length > 0) {
    newChapters.push({
      id: `${doc.jurisdiction.toLowerCase()}-${doc.abbreviation.toLowerCase()}-ch-other`,
      number: '99',
      title: 'Sonstige Bestimmungen',
      title_en: 'Other Provisions',
      sections: unmappedSections,
    })
  }

  return newChapters.length > 1 ? newChapters : null
}

async function processDatabase(dbPath, mappings, countryCode) {
  console.log(`\nProcessing ${countryCode} database: ${dbPath}`)

  if (!fs.existsSync(dbPath)) {
    console.log(`  Database not found: ${dbPath}`)
    return 0
  }

  const database = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
  let updated = 0

  for (const doc of database.documents) {
    const newChapters = restructureDocument(doc, mappings)
    if (newChapters) {
      console.log(`  ✓ ${doc.abbreviation}: Restructured into ${newChapters.length} chapters`)
      doc.chapters = newChapters
      updated++
    }
  }

  if (updated > 0) {
    database.metadata.sections_restructured_at = new Date().toISOString()
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2))
    console.log(`  Saved ${updated} restructured documents`)
  } else {
    console.log(`  No documents needed restructuring`)
  }

  return updated
}

async function main() {
  console.log('='.repeat(60))
  console.log('Add Section Structure to Law Databases')
  console.log('='.repeat(60))

  const deDb = path.join(__dirname, '../eu_safety_laws/de/de_database.json')
  const atDb = path.join(__dirname, '../eu_safety_laws/at/at_database.json')
  const nlDb = path.join(__dirname, '../eu_safety_laws/nl/nl_database.json')

  let totalUpdated = 0
  totalUpdated += await processDatabase(deDb, DE_SECTION_MAPPINGS, 'DE')
  totalUpdated += await processDatabase(atDb, AT_SECTION_MAPPINGS, 'AT')
  totalUpdated += await processDatabase(nlDb, NL_SECTION_MAPPINGS, 'NL')

  console.log('\n' + '='.repeat(60))
  console.log(`Total documents restructured: ${totalUpdated}`)
  console.log('='.repeat(60))
}

main().catch(console.error)

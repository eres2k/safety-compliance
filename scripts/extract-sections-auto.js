#!/usr/bin/env node
/**
 * Automatically extract and apply section structure from law texts
 * Detects Abschnitt/Hauptstück/Hoofdstuk patterns in text content
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Detect section markers in text and assign sections to paragraphs
function extractSectionStructure(doc) {
  const existingSections = doc.chapters?.[0]?.sections || []
  if (existingSections.length === 0) return null
  if (doc.chapters?.length > 1) return null // Already has structure

  const sectionAssignments = new Map() // sectionNumber -> { abschnitt, title }
  let currentAbschnitt = null

  for (const section of existingSections) {
    const text = section.text || ''
    const title = section.title || ''
    const combined = title + ' ' + text.substring(0, 500)

    // Pattern für Abschnitt-Header (AT/DE)
    // Matches: "1. ABSCHNITT", "1 . Abschnitt", "Erster Abschnitt", etc.
    const abschnittMatch = combined.match(/(\d+)\s*\.\s*ABSCHNITT\s*[:\s]*([^\n§(]+)/i)
      || combined.match(/(Erster|Zweiter|Dritter|Vierter|Fünfter|Sechster|Siebter|Achter|Neunter|Zehnter|Elfter|Zwölfter)\s+Abschnitt\s*[:\s]*([^\n§(]+)/i)

    // Pattern für Hauptstück (AT)
    const hauptstueckMatch = combined.match(/([IVX]+)\s*\.\s*HAUPTSTÜCK\s*[:\s]*([^\n§\d]+)/i)

    // Pattern für Hoofdstuk/Afdeling (NL)
    const hoofdstukMatch = combined.match(/Hoofdstuk\s+(\d+)\s*[:\.\s]*([^\n]+)/i)
    const afdelingMatch = combined.match(/Afdeling\s+(\d+)\s*[:\.\s]*([^\n]+)/i)

    // Update current section context
    if (hauptstueckMatch) {
      const num = hauptstueckMatch[1]
      const title = hauptstueckMatch[2].trim().replace(/\s+/g, ' ')
      currentAbschnitt = { number: num, title: `${num}. Hauptstück - ${title}`, type: 'hauptstück' }
    }

    if (abschnittMatch) {
      let num = abschnittMatch[1]
      // Convert ordinal words to numbers
      const ordinals = { 'erster': '1', 'zweiter': '2', 'dritter': '3', 'vierter': '4', 'fünfter': '5',
                        'sechster': '6', 'siebter': '7', 'achter': '8', 'neunter': '9', 'zehnter': '10',
                        'elfter': '11', 'zwölfter': '12' }
      if (ordinals[num?.toLowerCase()]) num = ordinals[num.toLowerCase()]

      const title = abschnittMatch[2].trim().replace(/\s+/g, ' ').substring(0, 60)
      currentAbschnitt = { number: num, title: `${num}. Abschnitt - ${title}`, type: 'abschnitt' }
    }

    if (hoofdstukMatch && !currentAbschnitt) {
      const num = hoofdstukMatch[1]
      const title = hoofdstukMatch[2].trim().replace(/\s+/g, ' ')
      currentAbschnitt = { number: num, title: `Hoofdstuk ${num} - ${title}`, type: 'hoofdstuk' }
    }

    if (afdelingMatch && !currentAbschnitt) {
      const num = afdelingMatch[1]
      const title = afdelingMatch[2].trim().replace(/\s+/g, ' ')
      currentAbschnitt = { number: num, title: `Afdeling ${num} - ${title}`, type: 'afdeling' }
    }

    // Assign current section to this paragraph
    if (currentAbschnitt) {
      sectionAssignments.set(section.number, currentAbschnitt)
    }
  }

  // Group sections by their assigned Abschnitt
  if (sectionAssignments.size === 0) return null

  const groupedSections = new Map()
  for (const section of existingSections) {
    const assignment = sectionAssignments.get(section.number) || { number: '0', title: 'Allgemeine Bestimmungen', type: 'abschnitt' }
    const key = `${assignment.type}-${assignment.number}`

    if (!groupedSections.has(key)) {
      groupedSections.set(key, { info: assignment, sections: [] })
    }
    groupedSections.get(key).sections.push(section)
  }

  // Convert to chapters array
  const newChapters = []
  const sortedKeys = [...groupedSections.keys()].sort((a, b) => {
    const numA = parseInt(a.split('-')[1]) || 0
    const numB = parseInt(b.split('-')[1]) || 0
    return numA - numB
  })

  for (const key of sortedKeys) {
    const group = groupedSections.get(key)
    if (group.sections.length > 0) {
      newChapters.push({
        id: `${doc.jurisdiction?.toLowerCase() || 'xx'}-${doc.abbreviation?.toLowerCase() || 'unknown'}-ch${group.info.number}`,
        number: group.info.number,
        title: group.info.title,
        title_en: `Section ${group.info.number}`,
        sections: group.sections,
      })
    }
  }

  return newChapters.length > 1 ? newChapters : null
}

async function processDatabase(dbPath, countryCode) {
  console.log(`\nProcessing ${countryCode}: ${dbPath}`)

  if (!fs.existsSync(dbPath)) {
    console.log(`  Not found: ${dbPath}`)
    return 0
  }

  const database = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
  let updated = 0

  for (const doc of database.documents) {
    // Skip if already has structure
    if (doc.chapters?.length > 1) {
      continue
    }

    const newChapters = extractSectionStructure(doc)
    if (newChapters) {
      const totalSections = newChapters.reduce((sum, c) => sum + c.sections.length, 0)
      console.log(`  ✓ ${doc.abbreviation}: ${newChapters.length} chapters extracted (${totalSections} §§)`)
      newChapters.forEach(c => console.log(`      - ${c.title} (${c.sections.length} §§)`))
      doc.chapters = newChapters
      updated++
    }
  }

  if (updated > 0) {
    database.metadata.auto_sections_at = new Date().toISOString()
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2))
    console.log(`  Saved ${updated} documents`)
  } else {
    console.log(`  No new structures found`)
  }

  return updated
}

async function main() {
  console.log('='.repeat(60))
  console.log('Auto-Extract Section Structure')
  console.log('='.repeat(60))

  const deDb = path.join(__dirname, '../eu_safety_laws/de/de_database.json')
  const atDb = path.join(__dirname, '../eu_safety_laws/at/at_database.json')
  const nlDb = path.join(__dirname, '../eu_safety_laws/nl/nl_database.json')

  let total = 0
  total += await processDatabase(deDb, 'DE')
  total += await processDatabase(atDb, 'AT')
  total += await processDatabase(nlDb, 'NL')

  console.log('\n' + '='.repeat(60))
  console.log(`Total: ${total} documents restructured`)
  console.log('='.repeat(60))
}

main().catch(console.error)

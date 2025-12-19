#!/usr/bin/env node
/**
 * Fix PDF References Script
 *
 * Scans local PDF files and updates database entries to include
 * local_pdf_path references where they're missing.
 *
 * This ensures that PDFs that exist locally are properly referenced
 * in the database, enabling iframe display in the frontend.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

const DATABASES = {
  AT: path.join(__dirname, '../eu_safety_laws/at/at_database.json'),
  DE: path.join(__dirname, '../eu_safety_laws/de/de_database.json'),
  NL: path.join(__dirname, '../eu_safety_laws/nl/nl_database.json')
}

const PDF_BASE_PATH = path.join(__dirname, '../eu_safety_laws/pdfs')

/**
 * Extract abbreviation from PDF filename
 * Filename format: {country}_{abbrev}_{type}.pdf
 * e.g., at_ASchG_law.pdf -> ASchG
 */
function extractAbbrevFromFilename(filename, country) {
  const countryLower = country.toLowerCase()
  const prefix = `${countryLower}_`

  if (!filename.startsWith(prefix) || !filename.endsWith('.pdf')) {
    return null
  }

  // Remove country prefix and .pdf suffix
  let baseName = filename.slice(prefix.length, -4)

  // Remove doc type suffix (_law, _merkblatt, etc.)
  const docTypes = ['_law', '_merkblatt', '_supplement', '_guideline']
  for (const docType of docTypes) {
    if (baseName.endsWith(docType)) {
      baseName = baseName.slice(0, -docType.length)
      break
    }
  }

  return baseName
}

/**
 * Build the local_pdf_path value
 * Uses forward slashes for cross-platform compatibility
 */
function buildLocalPdfPath(country, filename) {
  const countryLower = country.toLowerCase()
  return `eu_safety_laws/pdfs/${countryLower}/${filename}`
}

/**
 * Normalize abbreviation for comparison
 */
function normalizeAbbrev(abbrev) {
  if (!abbrev) return ''
  return abbrev
    .replace(/[^\w\-\.]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Check if PDF file matches a database entry
 */
function matchPdfToEntry(pdfFilename, doc, country) {
  const pdfAbbrev = extractAbbrevFromFilename(pdfFilename, country)
  if (!pdfAbbrev) return false

  const docAbbrev = doc.abbreviation || ''

  // Normalize both for comparison
  const normalizedPdf = normalizeAbbrev(pdfAbbrev)
  const normalizedDoc = normalizeAbbrev(docAbbrev)

  // Direct match
  if (normalizedPdf.toLowerCase() === normalizedDoc.toLowerCase()) {
    return true
  }

  // Handle -PDF suffix variants (e.g., ASchG-PDF matches at_ASchG-PDF_law.pdf)
  if (docAbbrev.toUpperCase().endsWith('-PDF')) {
    const baseAbbrev = docAbbrev.slice(0, -4)
    const normalizedBase = normalizeAbbrev(baseAbbrev)
    // Match ASchG-PDF to at_ASchG-PDF_law.pdf
    if (normalizedPdf.toLowerCase() === `${normalizedBase}-pdf`.toLowerCase()) {
      return true
    }
  }

  // Handle AUVA M.plus naming variations
  // e.g., "AUVA M.plus 330" matches at_AUVA_M_plus_330_law.pdf
  // Normalize dots and spaces to underscores
  const normalizedPdfLower = normalizedPdf.toLowerCase().replace(/\./g, '_')
  const normalizedDocLower = normalizedDoc.toLowerCase().replace(/\./g, '_')

  if (normalizedPdfLower === normalizedDocLower) {
    return true
  }

  // Also check for M.plus vs M_plus variations
  if (docAbbrev.toLowerCase().includes('m.plus') || docAbbrev.toLowerCase().includes('m plus')) {
    // Extract just the key parts for matching
    const pdfMatch = normalizedPdf.match(/auva_m_plus_(\d+)/i)
    const docMatch = docAbbrev.match(/m\.?plus\s*(\d+)/i)

    if (pdfMatch && docMatch && pdfMatch[1] === docMatch[1]) {
      return true
    }
  }

  return false
}

/**
 * Process a database and fix PDF references
 */
function fixDatabaseReferences(country, dbPath, dryRun = true) {
  log(`\n${'═'.repeat(60)}`, 'blue')
  log(`  Processing ${country} database`, 'blue')
  log('═'.repeat(60), 'blue')

  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    log(`Database not found: ${dbPath}`, 'red')
    return null
  }

  // Load database
  let data
  try {
    data = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  } catch (e) {
    log(`Failed to parse database: ${e.message}`, 'red')
    return null
  }

  const documents = data.documents || data.items || []

  // Get PDF files for this country
  const pdfDir = path.join(PDF_BASE_PATH, country.toLowerCase())
  if (!fs.existsSync(pdfDir)) {
    log(`PDF directory not found: ${pdfDir}`, 'yellow')
    return { fixed: 0, alreadySet: 0, notMatched: [], matched: [], total: documents.length }
  }

  const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'))
  log(`Found ${pdfFiles.length} PDF files in ${country} directory`, 'cyan')

  const results = {
    fixed: 0,
    alreadySet: 0,
    notMatched: [],
    matched: []
  }

  // For each PDF file, find matching document
  for (const pdfFile of pdfFiles) {
    let matched = false

    for (const doc of documents) {
      if (matchPdfToEntry(pdfFile, doc, country)) {
        matched = true

        // Check if local_pdf_path is already set
        if (doc.source?.local_pdf_path) {
          results.alreadySet++
          log(`  [SKIP] ${doc.abbreviation} - already has local_pdf_path`, 'dim')
        } else {
          // Add local_pdf_path
          if (!doc.source) doc.source = {}
          const localPath = buildLocalPdfPath(country, pdfFile)
          doc.source.local_pdf_path = localPath

          results.fixed++
          results.matched.push({
            abbreviation: doc.abbreviation,
            filename: pdfFile,
            path: localPath
          })
          log(`  [FIX] ${doc.abbreviation} -> ${pdfFile}`, 'green')
        }
        break
      }
    }

    if (!matched) {
      results.notMatched.push(pdfFile)
      log(`  [ORPHAN] ${pdfFile} - no matching document found`, 'yellow')
    }
  }

  // Summary
  log(`\nSummary for ${country}:`, 'cyan')
  log(`  PDFs with references fixed: ${results.fixed}`, results.fixed > 0 ? 'green' : 'dim')
  log(`  PDFs already referenced: ${results.alreadySet}`, 'dim')
  log(`  Orphaned PDFs (no match): ${results.notMatched.length}`, results.notMatched.length > 0 ? 'yellow' : 'dim')

  // Save database if not dry run and there were changes
  if (!dryRun && results.fixed > 0) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
    log(`\n✓ Database saved: ${dbPath}`, 'green')
  } else if (dryRun && results.fixed > 0) {
    log(`\n[DRY RUN] Would fix ${results.fixed} references. Run with --fix to apply.`, 'yellow')
  }

  return results
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--fix')
  const verbose = args.includes('--verbose') || args.includes('-v')

  log('\n' + '█'.repeat(60), 'blue')
  log('  PDF Reference Fixer', 'blue')
  log('  Adds local_pdf_path to database entries with local PDFs', 'blue')
  log('█'.repeat(60), 'blue')

  if (dryRun) {
    log('\n[DRY RUN MODE] No changes will be made. Use --fix to apply changes.\n', 'yellow')
  }

  const allResults = {}
  let totalFixed = 0
  let totalOrphaned = 0

  for (const [country, dbPath] of Object.entries(DATABASES)) {
    const result = fixDatabaseReferences(country, dbPath, dryRun)
    allResults[country] = result
    if (result) {
      totalFixed += result.fixed
      totalOrphaned += result.notMatched?.length || 0
    }
  }

  // Final report
  log('\n' + '═'.repeat(60), 'cyan')
  log('  FINAL REPORT', 'cyan')
  log('═'.repeat(60), 'cyan')

  for (const [country, result] of Object.entries(allResults)) {
    if (!result) {
      log(`✗ ${country}: Failed to process`, 'red')
      continue
    }

    const status = result.fixed > 0 ? '✓' : '○'
    const color = result.fixed > 0 ? 'green' : 'dim'
    log(`${status} ${country}: ${result.fixed} fixed, ${result.alreadySet} already set, ${result.notMatched.length} orphaned`, color)
  }

  log(`\nTotal: ${totalFixed} references to fix, ${totalOrphaned} orphaned PDFs`)

  if (dryRun && totalFixed > 0) {
    log('\nTo apply these changes, run: node scripts/fix-pdf-references.js --fix', 'yellow')
  } else if (!dryRun && totalFixed > 0) {
    log('\n✓ All changes applied successfully', 'green')
  } else {
    log('\n✓ No changes needed - all PDFs are properly referenced', 'green')
  }
}

main()

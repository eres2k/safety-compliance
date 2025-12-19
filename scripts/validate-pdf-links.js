#!/usr/bin/env node
/**
 * PDF/HTML Link Validation Script
 *
 * Validates that all PDF and HTML links for Merkblätter, AUVA documents,
 * and other supplementary content point to existing local files.
 *
 * This script checks:
 * 1. local_pdf_path references point to actual files
 * 2. local_html_path references point to actual files
 * 3. PDF-only/supplementary documents have corresponding local files
 * 4. No view links point to external URLs (which don't work in iframes)
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
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
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
const HTML_BASE_PATH = path.join(__dirname, '../eu_safety_laws/html')

/**
 * Check if a path references an external URL
 */
function isExternalUrl(urlOrPath) {
  if (!urlOrPath) return false
  return urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')
}

/**
 * Convert Windows absolute path to relative project path
 */
function convertToRelativePath(absolutePath) {
  if (!absolutePath) return null

  // Extract the eu_safety_laws portion from Windows or Unix paths
  const match = absolutePath.match(/eu_safety_laws[\/\\](.+)$/)
  if (match) {
    return path.join(__dirname, '..', 'eu_safety_laws', match[1].replace(/\\/g, '/'))
  }
  return null
}

/**
 * Check if law is a supplementary source (AUVA Merkblätter, DGUV, etc.)
 */
function isSupplementarySource(law) {
  if (!law) return false

  const abbrev = (law.abbreviation || '').toLowerCase()
  const title = (law.title || '').toLowerCase()
  const type = (law.type || '').toLowerCase()
  const category = (law.category || '').toLowerCase()

  // Check metadata flag
  if (law.metadata?.is_supplementary) return true

  // AT: AUVA Merkblätter
  if (abbrev.includes('auva') || abbrev.includes('m.plus') || abbrev.includes('mplus')) {
    return true
  }

  // DE: Technical Rules and DGUV
  if (abbrev.includes('trbs') || abbrev.includes('trgs') ||
      abbrev.includes('asr') || abbrev.includes('dguv')) {
    return true
  }

  // NL: PGS and AI publications
  if (abbrev.includes('pgs') || abbrev.startsWith('ai-')) {
    return true
  }

  // Check title for supplementary indicators
  if (title.includes('merkblatt') || title.includes('technische regel') ||
      title.includes('technical rule') || title.includes('leitfaden')) {
    return true
  }

  // Check type/category
  const supplementaryTypes = ['merkblatt', 'guideline', 'handbook', 'information', 'supplement']
  if (supplementaryTypes.some(t => type.includes(t) || category.includes(t))) {
    return true
  }

  return false
}

/**
 * Check if law is a PDF variant (e.g., ASchG-PDF)
 */
function isPdfVariant(law) {
  if (!law) return false
  const abbrev = (law.abbreviation || '').toUpperCase()
  return abbrev.endsWith('-PDF')
}

/**
 * Determine if a document should have a local PDF
 */
function shouldHaveLocalPdf(law) {
  if (!law) return false

  // Explicit PDF-only flag
  if (law.metadata?.is_pdf_only) return true

  // PDF variants
  if (isPdfVariant(law)) return true

  // PDF source type
  if (law.source?.source_type === 'pdf') return true

  // Supplementary sources with PDF URL
  if (isSupplementarySource(law) && law.source?.pdf_url) return true

  return false
}

/**
 * Determine if a document should have a local HTML
 */
function shouldHaveLocalHtml(law) {
  if (!law) return false

  // Explicit HTML-only flag
  if (law.metadata?.is_html_only) return true

  // Has explicit local_html_path
  if (law.source?.local_html_path) return true

  return false
}

/**
 * Build expected local PDF path for a document
 */
function buildExpectedPdfPath(law, country) {
  const countryLower = country.toLowerCase()
  let abbrev = law.abbreviation || ''

  // Remove -PDF suffix for variants
  if (abbrev.toUpperCase().endsWith('-PDF')) {
    abbrev = abbrev.slice(0, -4)
  }

  // Clean abbreviation for filename
  const safeAbbrev = abbrev.replace(/[^\w\-\.]/g, '_').replace(/\s+/g, '_')

  // Determine doc type
  let docType = 'law'
  if (isSupplementarySource(law) && !isPdfVariant(law)) {
    docType = 'merkblatt'
  }

  return path.join(PDF_BASE_PATH, countryLower, `${countryLower}_${safeAbbrev}_${docType}.pdf`)
}

/**
 * Build expected local HTML path for a document
 */
function buildExpectedHtmlPath(law, country) {
  const countryLower = country.toLowerCase()
  let abbrev = law.abbreviation || ''
  const safeAbbrev = abbrev.replace(/[^\w\-\.]/g, '_').replace(/\s+/g, '_')

  return path.join(HTML_BASE_PATH, countryLower, `${countryLower}_${safeAbbrev}_merkblatt.html`)
}

/**
 * Validate a single document's PDF/HTML links
 */
function validateDocument(doc, country) {
  const result = {
    id: doc.id,
    abbreviation: doc.abbreviation || 'N/A',
    title: (doc.title || '').substring(0, 60),
    isSupplementary: isSupplementarySource(doc),
    isPdfVariant: isPdfVariant(doc),
    isPdfOnly: !!doc.metadata?.is_pdf_only,
    isHtmlOnly: !!doc.metadata?.is_html_only,
    errors: [],
    warnings: [],
    info: []
  }

  // Check 1: local_pdf_path reference points to existing file
  if (doc.source?.local_pdf_path) {
    const localPath = convertToRelativePath(doc.source.local_pdf_path)
    if (localPath) {
      if (!fs.existsSync(localPath)) {
        result.errors.push({
          type: 'MISSING_LOCAL_PDF',
          message: `local_pdf_path references missing file`,
          path: doc.source.local_pdf_path,
          expected: localPath
        })
      } else {
        result.info.push(`Local PDF exists: ${path.basename(localPath)}`)
      }
    } else {
      result.warnings.push({
        type: 'INVALID_PDF_PATH',
        message: `Cannot parse local_pdf_path`,
        path: doc.source.local_pdf_path
      })
    }
  }

  // Check 2: local_html_path reference points to existing file
  if (doc.source?.local_html_path) {
    const localPath = convertToRelativePath(doc.source.local_html_path)
    if (localPath) {
      if (!fs.existsSync(localPath)) {
        result.errors.push({
          type: 'MISSING_LOCAL_HTML',
          message: `local_html_path references missing file`,
          path: doc.source.local_html_path,
          expected: localPath
        })
      } else {
        result.info.push(`Local HTML exists: ${path.basename(localPath)}`)
      }
    } else {
      result.warnings.push({
        type: 'INVALID_HTML_PATH',
        message: `Cannot parse local_html_path`,
        path: doc.source.local_html_path
      })
    }
  }

  // Check 3: Documents that should have local PDFs but don't have local_pdf_path
  if (shouldHaveLocalPdf(doc) && !doc.source?.local_pdf_path) {
    const expectedPath = buildExpectedPdfPath(doc, country)
    if (fs.existsSync(expectedPath)) {
      result.warnings.push({
        type: 'MISSING_PDF_PATH_REF',
        message: `Document should have local_pdf_path but it's not set (file exists)`,
        path: expectedPath
      })
    } else {
      result.errors.push({
        type: 'MISSING_PDF_FILE',
        message: `Document should have local PDF but file doesn't exist`,
        expected: expectedPath,
        externalUrl: doc.source?.pdf_url || doc.source?.url || 'none'
      })
    }
  }

  // Check 4: Documents that should have local HTML but don't have local_html_path
  if (shouldHaveLocalHtml(doc) && !doc.source?.local_html_path) {
    const expectedPath = buildExpectedHtmlPath(doc, country)
    if (fs.existsSync(expectedPath)) {
      result.warnings.push({
        type: 'MISSING_HTML_PATH_REF',
        message: `Document should have local_html_path but it's not set (file exists)`,
        path: expectedPath
      })
    } else {
      result.errors.push({
        type: 'MISSING_HTML_FILE',
        message: `Document should have local HTML but file doesn't exist`,
        expected: expectedPath
      })
    }
  }

  // Check 5: Warn about external PDF URLs that will fail in iframe
  if (doc.source?.pdf_url && isExternalUrl(doc.source.pdf_url)) {
    if (!doc.source?.local_pdf_path) {
      result.warnings.push({
        type: 'EXTERNAL_PDF_ONLY',
        message: `Document only has external PDF URL (cannot display in iframe)`,
        url: doc.source.pdf_url
      })
    }
  }

  // Check 6: Supplementary sources without any local content
  if (isSupplementarySource(doc)) {
    const hasLocalPdf = doc.source?.local_pdf_path
    const hasLocalHtml = doc.source?.local_html_path
    const hasParsedContent = doc.chapters && doc.chapters.length > 0

    if (!hasLocalPdf && !hasLocalHtml && !hasParsedContent) {
      result.errors.push({
        type: 'SUPPLEMENTARY_NO_LOCAL_CONTENT',
        message: `Supplementary source has no local PDF, HTML, or parsed content`,
        source: doc.source?.url || 'unknown'
      })
    }
  }

  return result
}

/**
 * Validate all documents in a database
 */
function validateDatabase(country, dbPath) {
  log(`\n${'═'.repeat(70)}`, 'blue')
  log(`  Validating ${country} database: ${path.basename(dbPath)}`, 'blue')
  log('═'.repeat(70), 'blue')

  if (!fs.existsSync(dbPath)) {
    log(`Database file not found: ${dbPath}`, 'red')
    return null
  }

  let data
  try {
    data = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  } catch (e) {
    log(`Failed to parse JSON: ${e.message}`, 'red')
    return null
  }

  const documents = data.documents || data.items || []

  const results = {
    country,
    totalDocuments: documents.length,
    supplementaryCount: 0,
    pdfVariantCount: 0,
    pdfOnlyCount: 0,
    htmlOnlyCount: 0,
    documentsWithErrors: 0,
    documentsWithWarnings: 0,
    totalErrors: 0,
    totalWarnings: 0,
    brokenLinks: [],
    warnings: [],
    details: []
  }

  for (const doc of documents) {
    const validation = validateDocument(doc, country)
    results.details.push(validation)

    if (validation.isSupplementary) results.supplementaryCount++
    if (validation.isPdfVariant) results.pdfVariantCount++
    if (validation.isPdfOnly) results.pdfOnlyCount++
    if (validation.isHtmlOnly) results.htmlOnlyCount++

    if (validation.errors.length > 0) {
      results.documentsWithErrors++
      results.totalErrors += validation.errors.length
      results.brokenLinks.push({
        document: validation.abbreviation,
        title: validation.title,
        errors: validation.errors
      })
    }

    if (validation.warnings.length > 0) {
      results.documentsWithWarnings++
      results.totalWarnings += validation.warnings.length
      results.warnings.push({
        document: validation.abbreviation,
        title: validation.title,
        warnings: validation.warnings
      })
    }
  }

  // Print summary
  log(`\nDocument Statistics:`, 'cyan')
  log(`  Total documents: ${results.totalDocuments}`)
  log(`  Supplementary sources: ${results.supplementaryCount}`, 'dim')
  log(`  PDF variants: ${results.pdfVariantCount}`, 'dim')
  log(`  PDF-only documents: ${results.pdfOnlyCount}`, 'dim')
  log(`  HTML-only documents: ${results.htmlOnlyCount}`, 'dim')

  // Print broken links
  if (results.brokenLinks.length > 0) {
    log(`\n${'─'.repeat(50)}`, 'red')
    log(`BROKEN LINKS (${results.totalErrors} errors in ${results.documentsWithErrors} documents):`, 'red')
    log('─'.repeat(50), 'red')

    for (const broken of results.brokenLinks) {
      log(`\n  [${broken.document}] ${broken.title}`, 'red')
      for (const err of broken.errors) {
        log(`    ✗ ${err.type}: ${err.message}`, 'red')
        if (err.path) log(`      Path: ${err.path}`, 'dim')
        if (err.expected) log(`      Expected: ${err.expected}`, 'dim')
        if (err.externalUrl && err.externalUrl !== 'none') {
          log(`      External URL: ${err.externalUrl}`, 'yellow')
        }
      }
    }
  }

  // Print warnings
  if (results.warnings.length > 0) {
    log(`\n${'─'.repeat(50)}`, 'yellow')
    log(`WARNINGS (${results.totalWarnings} warnings in ${results.documentsWithWarnings} documents):`, 'yellow')
    log('─'.repeat(50), 'yellow')

    for (const warn of results.warnings) {
      log(`\n  [${warn.document}] ${warn.title}`, 'yellow')
      for (const w of warn.warnings) {
        log(`    ⚠ ${w.type}: ${w.message}`, 'yellow')
        if (w.path) log(`      Path: ${w.path}`, 'dim')
        if (w.url) log(`      URL: ${w.url}`, 'dim')
      }
    }
  }

  // Final status
  if (results.totalErrors === 0 && results.totalWarnings === 0) {
    log(`\n✓ All PDF/HTML links validated successfully`, 'green')
  } else if (results.totalErrors === 0) {
    log(`\n⚠ Validation passed with ${results.totalWarnings} warnings`, 'yellow')
  } else {
    log(`\n✗ Validation failed: ${results.totalErrors} errors, ${results.totalWarnings} warnings`, 'red')
  }

  return results
}

/**
 * Check for PDF files that exist but aren't referenced in any database
 */
function checkOrphanedPdfFiles(allResults) {
  log(`\n${'═'.repeat(70)}`, 'magenta')
  log(`  Checking for orphaned PDF files`, 'magenta')
  log('═'.repeat(70), 'magenta')

  const referencedPdfs = new Set()

  // Collect all referenced PDF paths
  for (const result of Object.values(allResults)) {
    if (!result) continue
    for (const detail of result.details) {
      if (detail.info) {
        for (const info of detail.info) {
          const match = info.match(/Local PDF exists: (.+)/)
          if (match) referencedPdfs.add(match[1])
        }
      }
    }
  }

  const orphanedFiles = []

  // Check each country's PDF directory
  for (const country of ['at', 'de', 'nl']) {
    const pdfDir = path.join(PDF_BASE_PATH, country)
    if (!fs.existsSync(pdfDir)) continue

    const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'))
    for (const file of files) {
      if (!referencedPdfs.has(file)) {
        orphanedFiles.push({
          country: country.toUpperCase(),
          file,
          path: path.join(pdfDir, file)
        })
      }
    }
  }

  if (orphanedFiles.length > 0) {
    log(`\nFound ${orphanedFiles.length} PDF files not referenced in databases:`, 'yellow')
    for (const orphan of orphanedFiles) {
      log(`  [${orphan.country}] ${orphan.file}`, 'yellow')
    }
  } else {
    log(`\n✓ All PDF files are properly referenced`, 'green')
  }

  return orphanedFiles
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)
  const verbose = args.includes('--verbose') || args.includes('-v')
  const jsonOutput = args.includes('--json')
  const fixMode = args.includes('--fix')

  log('\n' + '█'.repeat(70), 'blue')
  log('  EU Safety Laws - PDF/HTML Link Validator', 'blue')
  log('  Validates Merkblätter, AUVA, and supplementary content links', 'blue')
  log('█'.repeat(70), 'blue')

  const allResults = {}
  let hasErrors = false

  for (const [country, dbPath] of Object.entries(DATABASES)) {
    const result = validateDatabase(country, dbPath)
    allResults[country] = result
    if (result && result.totalErrors > 0) hasErrors = true
  }

  // Check for orphaned files
  const orphanedFiles = checkOrphanedPdfFiles(allResults)

  // Final summary
  log('\n' + '═'.repeat(70), 'cyan')
  log('  FINAL VALIDATION REPORT', 'cyan')
  log('═'.repeat(70), 'cyan')

  let totalErrors = 0
  let totalWarnings = 0

  for (const [country, result] of Object.entries(allResults)) {
    if (!result) {
      log(`✗ ${country}: Failed to load database`, 'red')
      continue
    }

    const status = result.totalErrors === 0 ? '✓' : '✗'
    const color = result.totalErrors === 0 ? 'green' : 'red'

    log(`${status} ${country}: ${result.totalDocuments} docs, ${result.totalErrors} errors, ${result.totalWarnings} warnings`, color)
    log(`     Supplementary: ${result.supplementaryCount}, PDF variants: ${result.pdfVariantCount}`, 'dim')

    totalErrors += result.totalErrors
    totalWarnings += result.totalWarnings
  }

  log(`\nTotal: ${totalErrors} errors, ${totalWarnings} warnings, ${orphanedFiles.length} orphaned files`)

  if (jsonOutput) {
    const outputPath = path.join(__dirname, '../validation-report.json')
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      results: allResults,
      orphanedFiles,
      summary: {
        totalErrors,
        totalWarnings,
        orphanedFileCount: orphanedFiles.length
      }
    }, null, 2))
    log(`\nJSON report saved to: ${outputPath}`, 'cyan')
  }

  if (hasErrors) {
    log('\n⚠️  Validation failed - some documents have broken links', 'red')
    log('Run the scraper to download missing PDFs, or update local_pdf_path references.', 'yellow')
    process.exit(1)
  } else {
    log('\n✓ All PDF/HTML links validated successfully', 'green')
    process.exit(0)
  }
}

// CLI interface
main()

export {
  validateDatabase,
  validateDocument,
  isSupplementarySource,
  shouldHaveLocalPdf,
  shouldHaveLocalHtml,
  checkOrphanedPdfFiles
}

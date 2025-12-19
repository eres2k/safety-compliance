#!/usr/bin/env node
/**
 * Database Validation Script
 * Validates law databases for correct structure and data quality
 */

const fs = require('fs')
const path = require('path')
const { validateLawStructure, isSupplementarySource } = require('./lib/cleaning-utils')

const DATABASES = {
  AT: '../eu_safety_laws/at/at_database.json',
  DE: '../eu_safety_laws/de/de_database.json',
  NL: '../eu_safety_laws/nl/nl_database.json'
}

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

function validateDatabase(country, dbPath) {
  log(`\n${'='.repeat(60)}`, 'blue')
  log(`Validating ${country} database: ${dbPath}`, 'blue')
  log('='.repeat(60), 'blue')

  const fullPath = path.join(__dirname, dbPath)

  if (!fs.existsSync(fullPath)) {
    log(`Database file not found: ${fullPath}`, 'red')
    return { valid: false, errors: ['File not found'] }
  }

  let data
  try {
    data = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
  } catch (e) {
    log(`Failed to parse JSON: ${e.message}`, 'red')
    return { valid: false, errors: ['Invalid JSON'] }
  }

  const items = data.items || data.documents || []
  log(`Found ${items.length} laws/documents`, 'cyan')

  const results = {
    valid: true,
    totalItems: items.length,
    validItems: 0,
    invalidItems: 0,
    warnings: 0,
    supplementary: 0,
    errors: [],
    itemDetails: []
  }

  for (const item of items) {
    const validation = validateLawStructure(item, country)

    const isSupp = isSupplementarySource(item)
    if (isSupp) results.supplementary++

    const itemResult = {
      id: item.id,
      abbreviation: item.abbreviation || item.abbr,
      title: item.title?.substring(0, 50),
      isSupplementary: isSupp,
      ...validation
    }

    results.itemDetails.push(itemResult)

    if (!validation.valid) {
      results.invalidItems++
      results.valid = false
      log(`\n[INVALID] ${item.abbreviation || item.id}`, 'red')
      validation.errors.forEach(e => log(`  - ${e}`, 'red'))
    } else {
      results.validItems++
    }

    if (validation.warnings.length > 0) {
      results.warnings += validation.warnings.length
      log(`\n[WARNING] ${item.abbreviation || item.id}`, 'yellow')
      validation.warnings.forEach(w => log(`  - ${w}`, 'yellow'))
    }
  }

  // Summary
  log(`\n${'─'.repeat(40)}`, 'dim')
  log('Summary:', 'cyan')
  log(`  Total items: ${results.totalItems}`)
  log(`  Valid: ${results.validItems}`, results.validItems === results.totalItems ? 'green' : 'yellow')
  log(`  Invalid: ${results.invalidItems}`, results.invalidItems > 0 ? 'red' : 'green')
  log(`  Warnings: ${results.warnings}`, results.warnings > 0 ? 'yellow' : 'green')
  log(`  Supplementary sources: ${results.supplementary}`, 'dim')

  return results
}

function main() {
  log('\n' + '█'.repeat(60), 'blue')
  log('  EU Safety Laws Database Validator', 'blue')
  log('█'.repeat(60), 'blue')

  const allResults = {}
  let hasErrors = false

  for (const [country, dbPath] of Object.entries(DATABASES)) {
    const result = validateDatabase(country, dbPath)
    allResults[country] = result
    if (!result.valid) hasErrors = true
  }

  // Final report
  log('\n' + '═'.repeat(60), 'cyan')
  log('FINAL VALIDATION REPORT', 'cyan')
  log('═'.repeat(60), 'cyan')

  for (const [country, result] of Object.entries(allResults)) {
    const status = result.valid ? '✓' : '✗'
    const color = result.valid ? 'green' : 'red'
    log(`${status} ${country}: ${result.validItems}/${result.totalItems} valid, ${result.warnings} warnings`, color)
  }

  if (hasErrors) {
    log('\n⚠️  Validation failed - some databases have invalid items', 'red')
    process.exit(1)
  } else {
    log('\n✓ All databases validated successfully', 'green')
    process.exit(0)
  }
}

// CLI interface
if (require.main === module) {
  main()
}

module.exports = { validateDatabase, validateLawStructure }

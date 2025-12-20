#!/usr/bin/env node

/**
 * Schema Migration Script v2.0.0
 *
 * This script migrates the eu_safety_laws databases to schema version 2.0.0:
 * - Adds schema_version field at top level
 * - Adds data_version to metadata
 * - Adds whs_summary.description for mobile-friendly text
 * - Adds keywords array to all documents
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EU_LAWS_DIR = path.join(__dirname, '..', 'eu_safety_laws');
const SCHEMA_VERSION = '2.0.0';
const DATA_VERSION = new Date().toISOString().split('T')[0].replace(/-/g, '.');

// Topic to keyword mapping for generating keywords
const TOPIC_KEYWORDS = {
  employee_rights: ['employee rights', 'worker protection', 'labor rights'],
  workplace_design: ['workplace design', 'workspace', 'work environment'],
  employer_obligations: ['employer duties', 'employer obligations', 'compliance'],
  risk_assessment: ['risk assessment', 'hazard evaluation', 'safety analysis'],
  health_surveillance: ['health monitoring', 'medical surveillance', 'occupational health'],
  documentation: ['documentation', 'records', 'safety documents'],
  ergonomics: ['ergonomics', 'workplace ergonomics', 'physical demands'],
  training: ['training', 'education', 'instruction'],
  hazardous_substances: ['hazardous materials', 'chemical safety', 'dangerous substances'],
  work_equipment: ['work equipment', 'machinery', 'tools'],
  prevention_services: ['prevention', 'safety services', 'occupational safety'],
  incident_reporting: ['incident reporting', 'accident reporting', 'near miss'],
  ppe: ['personal protective equipment', 'PPE', 'protective gear'],
  penalties: ['penalties', 'fines', 'sanctions']
};

// Document type descriptions
const DOC_TYPE_DESCRIPTIONS = {
  law: 'Primary legislation establishing legal requirements',
  regulation: 'Detailed implementing regulation',
  guideline: 'Official guidance and best practices'
};

function generateDescription(doc) {
  const abbreviation = doc.abbreviation || 'This document';
  const titleEn = doc.title_en || doc.title;
  const category = doc.category || 'workplace safety';
  const jurisdiction = doc.jurisdiction;

  const countryNames = {
    'AT': 'Austrian',
    'DE': 'German',
    'NL': 'Dutch'
  };

  const countryName = countryNames[jurisdiction] || jurisdiction;
  const docType = DOC_TYPE_DESCRIPTIONS[doc.type] || 'legal document';

  // Get top topics
  const topTopics = doc.whs_summary?.top_whs_topics?.slice(0, 3)
    .map(t => Array.isArray(t) ? t[0] : t)
    .map(t => t.replace(/_/g, ' '))
    .join(', ') || 'workplace safety';

  const totalSections = doc.whs_summary?.total_sections || 'multiple';

  return `${abbreviation} (${titleEn}) is ${countryName} ${docType} covering ${topTopics}. Contains ${totalSections} sections with comprehensive requirements for employers and employees.`;
}

function generateKeywords(doc) {
  const keywords = new Set();

  // Add abbreviation and title as keywords
  if (doc.abbreviation) keywords.add(doc.abbreviation);
  if (doc.title_en) {
    doc.title_en.split(' ')
      .filter(w => w.length > 3)
      .slice(0, 5)
      .forEach(w => keywords.add(w.toLowerCase()));
  }

  // Add category
  if (doc.category) keywords.add(doc.category.toLowerCase());

  // Add keywords based on top WHS topics
  if (doc.whs_summary?.top_whs_topics) {
    doc.whs_summary.top_whs_topics.slice(0, 5).forEach(topic => {
      const topicName = Array.isArray(topic) ? topic[0] : topic;
      const mappedKeywords = TOPIC_KEYWORDS[topicName] || [topicName.replace(/_/g, ' ')];
      mappedKeywords.forEach(k => keywords.add(k));
    });
  }

  // Add jurisdiction-specific keywords
  const jurisdictionKeywords = {
    'AT': ['Austria', 'Austrian law', 'ASchG'],
    'DE': ['Germany', 'German law', 'ArbSchG', 'DGUV'],
    'NL': ['Netherlands', 'Dutch law', 'Arbowet']
  };

  (jurisdictionKeywords[doc.jurisdiction] || []).forEach(k => keywords.add(k));

  return Array.from(keywords).slice(0, 15);
}

function migrateDatabase(country) {
  const dbPath = path.join(EU_LAWS_DIR, country, `${country}_database.json`);

  if (!fs.existsSync(dbPath)) {
    console.log(`  Skipping ${country}: database not found at ${dbPath}`);
    return false;
  }

  console.log(`  Processing ${country.toUpperCase()} database...`);

  try {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    // Check if already migrated
    if (data.schema_version === SCHEMA_VERSION) {
      console.log(`    Already at schema version ${SCHEMA_VERSION}, skipping`);
      return true;
    }

    // Add schema_version at top level
    const migratedData = {
      schema_version: SCHEMA_VERSION,
      metadata: {
        ...data.metadata,
        data_version: DATA_VERSION,
        migrated_at: new Date().toISOString()
      },
      documents: data.documents.map(doc => {
        // Add description to whs_summary if it exists
        const whsSummary = doc.whs_summary ? {
          ...doc.whs_summary,
          description: doc.whs_summary.description || generateDescription(doc)
        } : {
          description: generateDescription(doc)
        };

        return {
          ...doc,
          whs_summary: whsSummary,
          keywords: doc.keywords || generateKeywords(doc)
        };
      })
    };

    // Write back with pretty formatting
    fs.writeFileSync(dbPath, JSON.stringify(migratedData, null, 2));

    console.log(`    Migrated ${migratedData.documents.length} documents`);
    console.log(`    Added schema_version: ${SCHEMA_VERSION}`);
    console.log(`    Added data_version: ${DATA_VERSION}`);

    return true;
  } catch (error) {
    console.error(`    Error migrating ${country}: ${error.message}`);
    return false;
  }
}

function updateStatistics() {
  console.log('\n  Updating statistics.json...');

  const statsPath = path.join(EU_LAWS_DIR, 'statistics.json');
  const countries = ['at', 'de', 'nl'];

  const stats = {
    total_documents: 0,
    total_errors: 0,
    by_jurisdiction: {},
    by_type: {},
    by_category: {},
    total_chars: 0,
    total_words: 0,
    documents_with_content: 0
  };

  for (const country of countries) {
    const dbPath = path.join(EU_LAWS_DIR, country, `${country}_database.json`);
    if (!fs.existsSync(dbPath)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const docs = data.documents || [];

      stats.by_jurisdiction[country.toUpperCase()] = docs.length;
      stats.total_documents += docs.length;

      for (const doc of docs) {
        // Count by type
        const docType = doc.type || 'unknown';
        stats.by_type[docType] = (stats.by_type[docType] || 0) + 1;

        // Count by category
        const category = doc.category || 'General';
        stats.by_category[category] = (stats.by_category[category] || 0) + 1;

        // Count content stats
        let hasContent = false;
        if (doc.chapters) {
          for (const chapter of doc.chapters) {
            if (chapter.sections) {
              for (const section of chapter.sections) {
                if (section.text) {
                  stats.total_chars += section.text.length;
                  stats.total_words += section.text.split(/\s+/).length;
                  hasContent = true;
                }
              }
            }
          }
        }
        if (hasContent) stats.documents_with_content++;
      }
    } catch (e) {
      console.log(`    Warning: Could not process ${country}: ${e.message}`);
    }
  }

  const statisticsData = {
    generated_at: new Date().toISOString(),
    statistics: stats
  };

  fs.writeFileSync(statsPath, JSON.stringify(statisticsData, null, 2));
  console.log(`    Updated: ${stats.total_documents} documents across ${Object.keys(stats.by_jurisdiction).length} jurisdictions`);

  return true;
}

function main() {
  console.log('='.repeat(60));
  console.log('Schema Migration to v2.0.0');
  console.log('='.repeat(60));
  console.log(`\nTarget: ${EU_LAWS_DIR}`);
  console.log(`Schema Version: ${SCHEMA_VERSION}`);
  console.log(`Data Version: ${DATA_VERSION}\n`);

  const countries = ['at', 'de', 'nl'];
  const results = {};

  for (const country of countries) {
    results[country] = migrateDatabase(country);
  }

  // Update statistics after migration
  updateStatistics();

  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));

  for (const [country, success] of Object.entries(results)) {
    const status = success ? 'SUCCESS' : 'FAILED';
    console.log(`  ${country.toUpperCase()}: ${status}`);
  }

  const allSuccess = Object.values(results).every(r => r);
  process.exit(allSuccess ? 0 : 1);
}

main();

#!/usr/bin/env node

/**
 * Generate Law Changelog
 *
 * This script generates detailed change information for law updates by comparing
 * current database content with the previous version from git history.
 *
 * Output: eu_safety_laws/law_changes.json with paragraph-level changes
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EU_LAWS_DIR = path.join(__dirname, '..', 'eu_safety_laws');
const OUTPUT_FILE = path.join(EU_LAWS_DIR, 'law_changes.json');
const COUNTRIES = ['at', 'de', 'nl'];

/**
 * Find the last commit that modified a file (before the current state)
 */
function findLastModifyingCommit(filePath) {
  try {
    const relativePath = path.relative(process.cwd(), filePath);
    // Get the last 2 commits that modified this file
    const result = execSync(
      `git log --oneline -2 --follow -- "${relativePath}"`,
      { encoding: 'utf8' }
    );
    const lines = result.trim().split('\n');
    if (lines.length >= 2) {
      // Return the second commit (the one before the latest change)
      return lines[1].split(' ')[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the previous version of a file from git
 */
function getPreviousVersion(filePath, commitsBack = 1) {
  try {
    const relativePath = path.relative(process.cwd(), filePath);

    // First, try to find the actual previous modifying commit
    const previousCommit = findLastModifyingCommit(filePath);

    let gitRef;
    if (previousCommit) {
      gitRef = previousCommit;
      console.log(`  Using previous commit: ${previousCommit}`);
    } else {
      gitRef = `HEAD~${commitsBack}`;
    }

    const result = execSync(
      `git show ${gitRef}:"${relativePath}"`,
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );
    return JSON.parse(result);
  } catch (error) {
    return null;
  }
}

/**
 * Get current version of a file
 */
function getCurrentVersion(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Extract all sections from a law document
 */
function extractSections(doc) {
  const sections = [];
  if (!doc.chapters) return sections;

  for (const chapter of doc.chapters) {
    if (!chapter.sections) continue;
    for (const section of chapter.sections) {
      sections.push({
        id: section.id,
        number: section.number || '',
        title: section.title || '',
        text: section.text || '',
        chapterTitle: chapter.title || '',
        chapterNumber: chapter.number || ''
      });
    }
  }
  return sections;
}

/**
 * Compare two versions of a law document
 */
function compareLaw(oldDoc, newDoc) {
  if (!oldDoc || !newDoc) return null;

  const oldSections = extractSections(oldDoc);
  const newSections = extractSections(newDoc);

  const oldById = new Map(oldSections.map(s => [s.id, s]));
  const newById = new Map(newSections.map(s => [s.id, s]));

  const changes = {
    abbreviation: newDoc.abbreviation,
    title: newDoc.title_en || newDoc.title,
    country: newDoc.jurisdiction,
    added: [],
    removed: [],
    modified: []
  };

  // Find added sections
  for (const [id, section] of newById) {
    if (!oldById.has(id)) {
      changes.added.push({
        number: section.number,
        title: section.title,
        chapter: section.chapterTitle,
        preview: section.text?.substring(0, 200) + (section.text?.length > 200 ? '...' : '')
      });
    }
  }

  // Find removed sections
  for (const [id, section] of oldById) {
    if (!newById.has(id)) {
      changes.removed.push({
        number: section.number,
        title: section.title,
        chapter: section.chapterTitle
      });
    }
  }

  // Find modified sections (same id but different text)
  for (const [id, newSection] of newById) {
    const oldSection = oldById.get(id);
    if (oldSection && oldSection.text !== newSection.text) {
      // Calculate what changed
      const oldWords = (oldSection.text || '').split(/\s+/).length;
      const newWords = (newSection.text || '').split(/\s+/).length;
      const wordDiff = newWords - oldWords;

      changes.modified.push({
        number: newSection.number,
        title: newSection.title,
        chapter: newSection.chapterTitle,
        wordDiff: wordDiff,
        changeType: wordDiff > 0 ? 'expanded' : wordDiff < 0 ? 'reduced' : 'reworded'
      });
    }
  }

  // Only return if there are actual changes
  if (changes.added.length === 0 && changes.removed.length === 0 && changes.modified.length === 0) {
    return null;
  }

  return changes;
}

/**
 * Main function to generate changelog
 */
function generateChangelog() {
  console.log('Generating detailed law changelog...\n');

  const changelog = {
    generated_at: new Date().toISOString(),
    changes: []
  };

  for (const country of COUNTRIES) {
    const dbPath = path.join(EU_LAWS_DIR, country, `${country}_database.json`);

    if (!fs.existsSync(dbPath)) {
      console.log(`  Skipping ${country.toUpperCase()}: database not found`);
      continue;
    }

    console.log(`Processing ${country.toUpperCase()}...`);

    const currentDb = getCurrentVersion(dbPath);
    const previousDb = getPreviousVersion(dbPath, 1);

    if (!previousDb) {
      console.log(`  No previous version found in git history`);
      continue;
    }

    if (!currentDb || !currentDb.documents) {
      console.log(`  Invalid current database`);
      continue;
    }

    // Create maps for easy lookup
    const oldDocsById = new Map(
      (previousDb.documents || []).map(d => [d.abbreviation, d])
    );
    const newDocsById = new Map(
      (currentDb.documents || []).map(d => [d.abbreviation, d])
    );

    // Find new laws (not in old database)
    for (const [abbr, newDoc] of newDocsById) {
      if (!oldDocsById.has(abbr)) {
        const sections = extractSections(newDoc);
        changelog.changes.push({
          type: 'new_law',
          abbreviation: abbr,
          title: newDoc.title_en || newDoc.title,
          country: country.toUpperCase(),
          sectionCount: sections.length,
          timestamp: currentDb.metadata?.generated_at || new Date().toISOString()
        });
        console.log(`  NEW: ${abbr}`);
      }
    }

    // Compare existing laws
    for (const [abbr, newDoc] of newDocsById) {
      const oldDoc = oldDocsById.get(abbr);
      if (!oldDoc) continue;

      const changes = compareLaw(oldDoc, newDoc);
      if (changes) {
        changelog.changes.push({
          type: 'updated_law',
          ...changes,
          timestamp: currentDb.metadata?.generated_at || new Date().toISOString()
        });
        console.log(`  UPDATED: ${abbr} (${changes.added.length} added, ${changes.removed.length} removed, ${changes.modified.length} modified)`);
      }
    }

    // Find removed laws
    for (const [abbr, oldDoc] of oldDocsById) {
      if (!newDocsById.has(abbr)) {
        changelog.changes.push({
          type: 'removed_law',
          abbreviation: abbr,
          title: oldDoc.title_en || oldDoc.title,
          country: country.toUpperCase(),
          timestamp: currentDb.metadata?.generated_at || new Date().toISOString()
        });
        console.log(`  REMOVED: ${abbr}`);
      }
    }
  }

  // Sort changes by timestamp (most recent first)
  changelog.changes.sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(changelog, null, 2));
  console.log(`\nChangelog written to ${OUTPUT_FILE}`);
  console.log(`Total changes: ${changelog.changes.length}`);

  return changelog;
}

// Run
generateChangelog();

# Database Migration Plan

## Overview

This document outlines the migration strategy to consolidate and unify the law database structure across the web and Android platforms, eliminating data duplication and establishing a single source of truth.

## Current State Analysis

### Data Sources (3 Duplicates)

| Location | Format | Size | Purpose |
|----------|--------|------|---------|
| `eu_safety_laws/{country}_database.json` | Full scraped data with `documents` array | AT: 1.6MB, DE: 900KB, NL: 600KB | Web app source of truth |
| `src/data/laws/*.json` | Simplified with nested `sections` | ~20KB each | Web quick load |
| `android-app/.../assets/laws/*.json` | Simplified with `laws` array | ~5KB each | Android bundled data |

### Schema Differences

**eu_safety_laws Format:**
```json
{
  "metadata": { "country": "AT", "document_count": 11, ... },
  "documents": [
    {
      "id": "...",
      "abbreviation": "ASchG",
      "title": "...",
      "title_en": "...",
      "whs_summary": { "total_sections": 137, "top_whs_topics": [...] },
      "chapters": [{ "sections": [...] }]
    }
  ]
}
```

**Android App Expected Format:**
```json
{
  "laws": [
    {
      "id": "...",
      "abbreviation": "...",
      "title": "...",
      "whs_summary": "string description",
      "content": { "full_text": "...", "available": true, "format": "text" },
      "keywords": [...]
    }
  ]
}
```

## Migration Goals

1. **Single Source of Truth**: `eu_safety_laws/{country}_database.json` files are the canonical source
2. **Unified Schema**: Add `schema_version` field to enable format detection
3. **Automated Derivation**: Generate Android-compatible format via build script
4. **Deprecate Duplicates**: Remove or derive `src/data/laws/*.json` from main database
5. **Versioning**: Add comprehensive metadata for tracking data freshness

## Migration Phases

### Phase 1: Schema Normalization (Current)

1. Add `schema_version: "2.0.0"` to all database files
2. Ensure consistent field naming across countries:
   - All use `documents` array
   - All have `metadata` with required fields
   - All sections have `id`, `number`, `title`, `text`, `whs_topics`

### Phase 2: Build Script Creation

1. Create `scripts/generate-mobile-database.js` to:
   - Read full `eu_safety_laws` databases
   - Transform to Android-compatible `laws` array format
   - Generate optimized bundles for mobile
   - Output to `android-app/.../assets/laws/`

### Phase 3: Web App Integration

1. Update `src/services/euLawsDatabase.js` to work with unified schema
2. Consider lazy-loading strategy for mobile-size optimization
3. Remove dependency on `src/data/laws/*.json` simplified files

### Phase 4: Android App Update

1. Update `LawDatabaseLoader.kt` to handle new schema
2. Add offline caching with version checking
3. Implement incremental updates

## Unified Schema Specification (v2.0.0)

```json
{
  "schema_version": "2.0.0",
  "metadata": {
    "country": "AT|DE|NL",
    "generated_at": "ISO8601 timestamp",
    "document_count": 11,
    "data_version": "2025.12.20",
    "source": "eu_safety_laws",
    "validated_at": "ISO8601 timestamp"
  },
  "documents": [
    {
      "id": "unique-id",
      "version": "1.0.0",
      "type": "law|regulation|guideline",
      "jurisdiction": "AT|DE|NL",
      "abbreviation": "ASchG",
      "title": "Original language title",
      "title_en": "English translation",
      "category": "Core Safety|PPE|Training|...",
      "implements_eu_directive": "89/391/EWG (optional)",
      "source": {
        "url": "https://...",
        "title": "Source page title",
        "authority": "RIS|gesetze-im-internet|wetten.overheid",
        "robots_txt_compliant": true,
        "local_pdf_path": "eu_safety_laws/pdfs/..."
      },
      "scraping": {
        "scraped_at": "ISO8601 timestamp",
        "scraper_version": "8.0.0"
      },
      "whs_summary": {
        "total_sections": 137,
        "logistics_relevance_distribution": {
          "critical": 23,
          "high": 30,
          "medium": 43,
          "low": 41
        },
        "top_whs_topics": [["topic", count], ...],
        "critical_sections_count": 53,
        "description": "Human-readable summary for mobile apps"
      },
      "keywords": ["workplace safety", "employee protection", ...],
      "chapters": [
        {
          "id": "at-aschg-ch1",
          "number": "1",
          "title": "1. Abschnitt - Allgemeine Bestimmungen",
          "title_en": "Section 1 - General Provisions",
          "sections": [
            {
              "id": "section-id",
              "number": "1",
              "title": "§ 1. Geltungsbereich",
              "text": "Full section text...",
              "whs_topics": [
                { "topic": "employee_rights", "relevance": "high" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Implementation Checklist

### Phase 1: Schema Normalization (COMPLETED)
- [x] Analyze current database structures
- [x] Add `schema_version` field to all databases
- [x] Add `whs_summary.description` field for mobile-friendly text
- [x] Add `keywords` array to all documents
- [x] Validate all databases pass schema check
- [x] Update statistics.json with accurate counts

### Phase 2: Mobile Generator Script (COMPLETED)
- [x] Create `scripts/generate-mobile-database.js`
- [x] Implement transformation logic
- [x] Add to build pipeline (GitHub workflow updated)
- [x] Test generated output with Android app format

### Phase 3: Cleanup (Pending)
- [ ] Deprecate `src/data/laws/*.json` (mark as auto-generated)
- [ ] Update web app to use unified loading
- [ ] Document data update workflow

## File Locations

- **Source of Truth**: `/home/user/safety-compliance/eu_safety_laws/{at,de,nl}/`
- **Mobile Output**: `/home/user/safety-compliance/android-app/app/src/main/assets/laws/`
- **Web Simplified** (deprecated): `/home/user/safety-compliance/src/data/laws/`
- **Generator Script**: `/home/user/safety-compliance/scripts/generate-mobile-database.js`

## Risk Mitigation

1. **Backward Compatibility**: Keep existing Android format until full testing
2. **Validation**: Run schema validation after each database update
3. **Rollback**: Git versioning allows quick rollback if issues arise
4. **Testing**: Test both platforms before deploying changes

## Timeline

This plan focuses on **what** needs to be done, not when. Each phase should be completed before starting the next.

---

*Created: 2025-12-20*
*Status: Phase 1 & 2 - COMPLETED*
*Last Updated: 2025-12-20*

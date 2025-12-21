#!/usr/bin/env python3
"""
Fix document types for supplementary sources.
Updates AUVA, TRBS, TRGS, ASR, DGUV, PGS documents from type "law" to "merkblatt".
"""

import json
import re
from pathlib import Path

# Patterns to identify supplementary documents
SUPPLEMENTARY_PATTERNS = [
    # AT: AUVA documents
    r'^AUVA\b',
    r'^M\.plus\b',
    # DE: Technical rules and DGUV
    r'^TRBS\b',
    r'^TRGS\b',
    r'^ASR\b',
    r'^DGUV\b',
    # NL: PGS (Publicatiereeks Gevaarlijke Stoffen)
    r'^PGS\b',
]

def is_supplementary(abbreviation: str) -> bool:
    """Check if a document is a supplementary source based on abbreviation."""
    if not abbreviation:
        return False
    for pattern in SUPPLEMENTARY_PATTERNS:
        if re.match(pattern, abbreviation, re.IGNORECASE):
            return True
    return False

def update_database(db_path: Path) -> dict:
    """Update document types in a database file."""
    print(f"\nProcessing: {db_path}")

    with open(db_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    documents = data.get('documents', data.get('items', []))
    updated_count = 0

    for doc in documents:
        abbrev = doc.get('abbreviation', '')
        current_type = doc.get('type', '')

        if is_supplementary(abbrev) and current_type != 'merkblatt':
            print(f"  Updating: {abbrev} ({current_type} -> merkblatt)")
            doc['type'] = 'merkblatt'
            # Also update doc_type if present
            if 'doc_type' in doc:
                doc['doc_type'] = 'merkblatt'
            updated_count += 1

    if updated_count > 0:
        with open(db_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  Updated {updated_count} documents")
    else:
        print(f"  No updates needed")

    return {'path': str(db_path), 'updated': updated_count}

def main():
    base_path = Path(__file__).parent.parent / 'eu_safety_laws'

    databases = [
        base_path / 'at' / 'at_database.json',
        base_path / 'de' / 'de_database.json',
        base_path / 'nl' / 'nl_database.json',
    ]

    results = []
    for db_path in databases:
        if db_path.exists():
            result = update_database(db_path)
            results.append(result)
        else:
            print(f"Skipping (not found): {db_path}")

    print("\n=== Summary ===")
    total = sum(r['updated'] for r in results)
    print(f"Total documents updated: {total}")

if __name__ == '__main__':
    main()

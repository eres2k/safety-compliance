#!/usr/bin/env python3
"""
Fix PDF paths in database entries to match renamed files.
Updates pdf_path, local_pdf_path, and metadata.filename fields.
"""

import json
import os
import re
from pathlib import Path


def fix_pdf_paths(db_path: str, country: str) -> int:
    """Fix pdf_path references in database to match renamed files."""

    print(f"\nProcessing {db_path}...")

    with open(db_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Handle both formats: documents list or laws list
    docs = data.get('documents', data.get('laws', []))

    changes_made = 0

    for doc in docs:
        abbrev = doc.get('abbreviation', '')
        modified = False

        # Check if this is a merkblatt document
        if doc.get('type') == 'merkblatt' or doc.get('doc_type') == 'merkblatt':
            # Fix pdf_path
            if 'pdf_path' in doc and doc['pdf_path']:
                old_path = doc['pdf_path']
                if '_law.pdf' in old_path:
                    new_path = old_path.replace('_law.pdf', '_merkblatt.pdf')
                    doc['pdf_path'] = new_path
                    print(f"  Fixed pdf_path for {abbrev}")
                    modified = True

            # Fix source.local_pdf_path
            if 'source' in doc and doc['source'].get('local_pdf_path'):
                old_path = doc['source']['local_pdf_path']
                if '_law.pdf' in old_path:
                    new_path = old_path.replace('_law.pdf', '_merkblatt.pdf')
                    doc['source']['local_pdf_path'] = new_path
                    modified = True

            # Fix metadata.filename
            if 'metadata' in doc and doc['metadata'].get('filename'):
                old_name = doc['metadata']['filename']
                if '_law.pdf' in old_name:
                    new_name = old_name.replace('_law.pdf', '_merkblatt.pdf')
                    doc['metadata']['filename'] = new_name
                    modified = True

        if modified:
            changes_made += 1

    # Update the data with modified documents
    if 'documents' in data:
        data['documents'] = docs
    else:
        data['laws'] = docs

    # Write back
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"  Made {changes_made} path fixes in {db_path}")
    return changes_made


def main():
    base_dir = Path(__file__).parent.parent

    print("=" * 60)
    print("Fixing PDF Paths in Database")
    print("=" * 60)

    total_changes = 0

    # Fix DE database
    de_db_path = base_dir / 'de' / 'de_database.json'
    if de_db_path.exists():
        total_changes += fix_pdf_paths(str(de_db_path), 'de')

    # Fix NL database
    nl_db_path = base_dir / 'nl' / 'nl_database.json'
    if nl_db_path.exists():
        total_changes += fix_pdf_paths(str(nl_db_path), 'nl')

    print("\n" + "=" * 60)
    print(f"Summary: Fixed {total_changes} path references")
    print("=" * 60)


if __name__ == '__main__':
    main()

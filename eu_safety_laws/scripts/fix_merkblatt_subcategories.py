#!/usr/bin/env python3
"""
Fix merkblatt/complementary document tagging and add subcategories.

For DE: ASR, DGUV, TRGS, TRBS documents should be type="merkblatt" with subcategories
For NL: PGS, STL, TNO, Arbocatalogus, Volandis documents should be type="merkblatt" with subcategories
"""

import json
import os
import re
from pathlib import Path

# Define subcategory patterns for DE
DE_SUBCATEGORIES = {
    'ASR': {
        'pattern': r'^ASR\s*A?\d',
        'name': 'ASR (Arbeitsstättenregeln)',
        'description': 'Technical workplace rules'
    },
    'DGUV': {
        'pattern': r'^DGUV[-\s]?\d|^DGUV\s+(Information|Regel|Vorschrift)',
        'name': 'DGUV (Berufsgenossenschaft)',
        'description': 'German Social Accident Insurance publications'
    },
    'TRGS': {
        'pattern': r'^TRGS\s*\d',
        'name': 'TRGS (Technische Regeln Gefahrstoffe)',
        'description': 'Technical rules for hazardous substances'
    },
    'TRBS': {
        'pattern': r'^TRBS\s*\d',
        'name': 'TRBS (Technische Regeln Betriebssicherheit)',
        'description': 'Technical rules for operational safety'
    }
}

# Define subcategory patterns for NL
NL_SUBCATEGORIES = {
    'PGS': {
        'pattern': r'^PGS\s*\d|Publicatiereeks Gevaarlijke Stoffen',
        'name': 'PGS (Publicatiereeks Gevaarlijke Stoffen)',
        'description': 'Hazardous Substances Publication Series'
    },
    'Arbocatalogus': {
        'pattern': r'Arbocatalogus|STL\s+Arbocatalogus|^STL\s+',
        'name': 'Arbocatalogi',
        'description': 'Sector-specific occupational health catalogs'
    },
    'Volandis': {
        'pattern': r'^Volandis|A-blad',
        'name': 'Volandis A-bladen',
        'description': 'Construction industry safety sheets'
    },
    'TNO': {
        'pattern': r'^TNO\s+',
        'name': 'TNO Publications',
        'description': 'TNO research publications on occupational health'
    }
}


def get_de_subcategory(abbrev: str, title: str = '') -> dict:
    """Determine the DE subcategory based on abbreviation."""
    text = f"{abbrev} {title}".upper()

    for subcat_key, subcat_info in DE_SUBCATEGORIES.items():
        if re.search(subcat_info['pattern'], abbrev, re.IGNORECASE):
            return {
                'subcategory': subcat_key,
                'subcategory_name': subcat_info['name'],
                'subcategory_description': subcat_info['description']
            }
    return None


def get_nl_subcategory(abbrev: str, title: str = '') -> dict:
    """Determine the NL subcategory based on abbreviation."""
    text = f"{abbrev} {title}"

    for subcat_key, subcat_info in NL_SUBCATEGORIES.items():
        if re.search(subcat_info['pattern'], text, re.IGNORECASE):
            return {
                'subcategory': subcat_key,
                'subcategory_name': subcat_info['name'],
                'subcategory_description': subcat_info['description']
            }
    return None


def should_be_merkblatt_de(doc: dict) -> bool:
    """Check if a DE document should be marked as merkblatt."""
    abbrev = doc.get('abbreviation', '')

    patterns = [
        r'^ASR\s*A?\d',
        r'^DGUV[-\s]?\d',
        r'^DGUV\s+(Information|Regel|Vorschrift)',
        r'^TRGS\s*\d',
        r'^TRBS\s*\d',
    ]

    for pattern in patterns:
        if re.search(pattern, abbrev, re.IGNORECASE):
            return True
    return False


def should_be_merkblatt_nl(doc: dict) -> bool:
    """Check if a NL document should be marked as merkblatt."""
    abbrev = doc.get('abbreviation', '')
    title = doc.get('title', '')
    text = f"{abbrev} {title}"

    patterns = [
        r'^PGS\s*\d',
        r'^PGS\s+Overview',
        r'Publicatiereeks Gevaarlijke Stoffen',
        r'Arbocatalogus',
        r'^STL\s+',
        r'^Volandis',
        r'A-blad',
        r'^TNO\s+',
    ]

    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def fix_database(db_path: str, country: str) -> tuple:
    """Fix merkblatt tagging and add subcategories for a database file."""

    print(f"\nProcessing {db_path}...")

    with open(db_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Handle both formats: documents list or laws list
    docs = data.get('documents', data.get('laws', []))

    changes_made = 0
    updated_docs = []

    for doc in docs:
        abbrev = doc.get('abbreviation', '')
        title = doc.get('title', '')
        modified = False

        # Determine if this should be a merkblatt
        if country == 'DE':
            should_convert = should_be_merkblatt_de(doc)
            subcat_info = get_de_subcategory(abbrev, title) if should_convert else None
        else:  # NL
            should_convert = should_be_merkblatt_nl(doc)
            subcat_info = get_nl_subcategory(abbrev, title) if should_convert else None

        if should_convert:
            # Update type and doc_type
            if doc.get('type') != 'merkblatt':
                print(f"  Converting to merkblatt: {abbrev}")
                doc['type'] = 'merkblatt'
                doc['doc_type'] = 'merkblatt'
                modified = True

            # Update category
            if doc.get('category') != 'Supplementary':
                doc['category'] = 'Supplementary'
                modified = True

            # Add subcategory info
            if subcat_info:
                if doc.get('subcategory') != subcat_info['subcategory']:
                    doc['subcategory'] = subcat_info['subcategory']
                    doc['subcategory_name'] = subcat_info['subcategory_name']
                    modified = True

            # Ensure metadata has is_supplementary flag
            if 'metadata' not in doc:
                doc['metadata'] = {}
            if not doc['metadata'].get('is_supplementary'):
                doc['metadata']['is_supplementary'] = True
                modified = True

            if modified:
                changes_made += 1

        updated_docs.append(doc)

    # Update the data with modified documents
    if 'documents' in data:
        data['documents'] = updated_docs
    else:
        data['laws'] = updated_docs

    # Write back
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"  Made {changes_made} changes to {db_path}")
    return changes_made, len(docs)


def main():
    base_dir = Path(__file__).parent.parent

    print("=" * 60)
    print("Fixing Merkblatt/Complementary Document Tagging")
    print("=" * 60)

    total_changes = 0
    total_docs = 0

    # Fix DE database
    de_db_path = base_dir / 'de' / 'de_database.json'
    if de_db_path.exists():
        changes, count = fix_database(str(de_db_path), 'DE')
        total_changes += changes
        total_docs += count

    # Fix NL database
    nl_db_path = base_dir / 'nl' / 'nl_database.json'
    if nl_db_path.exists():
        changes, count = fix_database(str(nl_db_path), 'NL')
        total_changes += changes
        total_docs += count

    print("\n" + "=" * 60)
    print(f"Summary: Updated {total_changes} documents out of {total_docs} total")
    print("=" * 60)

    # Now rename PDF files if needed
    print("\nChecking PDF file naming...")

    for country in ['de', 'nl']:
        pdf_dir = base_dir / 'pdfs' / country
        if not pdf_dir.exists():
            continue

        for pdf_file in pdf_dir.glob('*.pdf'):
            filename = pdf_file.name
            # Check if file has _law suffix but should be _merkblatt
            if '_law.pdf' in filename:
                # Check if this should be a merkblatt based on name
                if country == 'de':
                    if any(pattern in filename.upper() for pattern in ['ASR', 'DGUV', 'TRGS', 'TRBS']):
                        new_name = filename.replace('_law.pdf', '_merkblatt.pdf')
                        new_path = pdf_dir / new_name
                        if not new_path.exists():
                            print(f"  Renaming: {filename} -> {new_name}")
                            pdf_file.rename(new_path)
                elif country == 'nl':
                    if any(pattern in filename.upper() for pattern in ['PGS', 'STL', 'TNO', 'ARBOCATALOGUS']):
                        new_name = filename.replace('_law.pdf', '_merkblatt.pdf')
                        new_path = pdf_dir / new_name
                        if not new_path.exists():
                            print(f"  Renaming: {filename} -> {new_name}")
                            pdf_file.rename(new_path)


if __name__ == '__main__':
    main()

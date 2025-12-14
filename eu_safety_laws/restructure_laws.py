#!/usr/bin/env python3
"""
Restructure law database JSON files to reflect official legal structures.

This script reorganizes the flat section structure into proper hierarchical
Abschnitte (for AT/DE) or Hoofdstukken (for NL) based on official sources.
"""

import json
import hashlib
from datetime import datetime
from pathlib import Path


def generate_id(text: str) -> str:
    """Generate a short hash ID from text."""
    return hashlib.md5(text.encode()).hexdigest()[:16]


def get_section_number(section: dict) -> float:
    """Extract numeric value from section number for sorting."""
    num_str = section.get("number", "0").rstrip(".")
    # Handle cases like "52a", "77a" etc.
    if num_str[-1].isalpha():
        base = float(num_str[:-1])
        letter_offset = (ord(num_str[-1].lower()) - ord('a') + 1) * 0.01
        return base + letter_offset
    try:
        return float(num_str)
    except ValueError:
        return 0


# Official structure for Austrian ASchG (ArbeitnehmerInnenschutzgesetz)
ASCHG_STRUCTURE = [
    {
        "number": "1",
        "title": "1. Abschnitt - Allgemeine Bestimmungen",
        "title_en": "Section 1 - General Provisions",
        "section_range": (1, 18),  # §§ 1-18
    },
    {
        "number": "2",
        "title": "2. Abschnitt - Arbeitsstätten und Baustellen",
        "title_en": "Section 2 - Workplaces and Construction Sites",
        "section_range": (19, 32),  # §§ 19-32
    },
    {
        "number": "3",
        "title": "3. Abschnitt - Arbeitsmittel",
        "title_en": "Section 3 - Work Equipment",
        "section_range": (33, 39),  # §§ 33-39
    },
    {
        "number": "4",
        "title": "4. Abschnitt - Arbeitsstoffe",
        "title_en": "Section 4 - Work Substances",
        "section_range": (40, 48),  # §§ 40-48
    },
    {
        "number": "5",
        "title": "5. Abschnitt - Gesundheitsüberwachung",
        "title_en": "Section 5 - Health Surveillance",
        "section_range": (49, 59),  # §§ 49-59
    },
    {
        "number": "6",
        "title": "6. Abschnitt - Arbeitsvorgänge und Arbeitsplätze",
        "title_en": "Section 6 - Work Processes and Workplaces",
        "section_range": (60, 72),  # §§ 60-72
    },
    {
        "number": "7",
        "title": "7. Abschnitt - Präventivdienste",
        "title_en": "Section 7 - Preventive Services",
        "section_range": (73, 90),  # §§ 73-90
    },
    {
        "number": "8",
        "title": "8. Abschnitt - Behörden und Verfahren",
        "title_en": "Section 8 - Authorities and Procedures",
        "section_range": (91, 101.5),  # §§ 91-101a
    },
    {
        "number": "9",
        "title": "9. Abschnitt - Übergangsrecht und Aufhebung",
        "title_en": "Section 9 - Transitional Law and Repeal",
        "section_range": (102, 127.5),  # §§ 102-127a
    },
    {
        "number": "10",
        "title": "10. Abschnitt - Schlussbestimmungen",
        "title_en": "Section 10 - Final Provisions",
        "section_range": (128, 132),  # §§ 128-132
    },
]

# Official structure for German ArbSchG (Arbeitsschutzgesetz)
ARBSCHG_STRUCTURE = [
    {
        "number": "1",
        "title": "Erster Abschnitt - Allgemeine Vorschriften",
        "title_en": "First Section - General Provisions",
        "section_range": (1, 2),  # §§ 1-2
    },
    {
        "number": "2",
        "title": "Zweiter Abschnitt - Pflichten des Arbeitgebers",
        "title_en": "Second Section - Employer Obligations",
        "section_range": (3, 14),  # §§ 3-14
    },
    {
        "number": "3",
        "title": "Dritter Abschnitt - Pflichten und Rechte der Beschäftigten",
        "title_en": "Third Section - Duties and Rights of Employees",
        "section_range": (15, 17),  # §§ 15-17
    },
    {
        "number": "4",
        "title": "Vierter Abschnitt - Verordnungsermächtigungen",
        "title_en": "Fourth Section - Authorization for Ordinances",
        "section_range": (18, 20),  # §§ 18-20
    },
    {
        "number": "5",
        "title": "Fünfter Abschnitt - Gemeinsame deutsche Arbeitsschutzstrategie",
        "title_en": "Fifth Section - Common German Occupational Safety Strategy",
        "section_range": (20.01, 20.99),  # §§ 20a-20b
    },
    {
        "number": "6",
        "title": "Sechster Abschnitt - Schlußvorschriften",
        "title_en": "Sixth Section - Final Provisions",
        "section_range": (21, 26),  # §§ 21-26
    },
]

# Official structure for Dutch Arbowet (Arbeidsomstandighedenwet)
ARBOWET_STRUCTURE = [
    {
        "number": "1",
        "title": "Hoofdstuk 1 - Definities en toepassingsgebied",
        "title_en": "Chapter 1 - Definitions and Scope",
        "section_range": (1, 2),  # Artikels 1-2
    },
    {
        "number": "2",
        "title": "Hoofdstuk 2 - Arbeidsomstandighedenbeleid",
        "title_en": "Chapter 2 - Working Conditions Policy",
        "section_range": (3, 11),  # Artikels 3-11
    },
    {
        "number": "3",
        "title": "Hoofdstuk 3 - Samenwerking, overleg, bijzondere rechten en deskundige bijstand",
        "title_en": "Chapter 3 - Cooperation, Consultation, Special Rights and Expert Assistance",
        "section_range": (12, 15.5),  # Artikels 12-15a
    },
    {
        "number": "4",
        "title": "Hoofdstuk 4 - Bijzondere verplichtingen",
        "title_en": "Chapter 4 - Special Obligations",
        "section_range": (16, 23),  # Artikels 16-23
    },
    {
        "number": "5",
        "title": "Hoofdstuk 5 - Toezicht en ambtelijke bevelen",
        "title_en": "Chapter 5 - Supervision and Official Orders",
        "section_range": (24, 29.99),  # Artikels 24-29b
    },
    {
        "number": "6",
        "title": "Hoofdstuk 6 - Vrijstellingen, ontheffingen en beroep",
        "title_en": "Chapter 6 - Exemptions, Dispensations and Appeals",
        "section_range": (30, 31),  # Artikels 30-31
    },
    {
        "number": "7",
        "title": "Hoofdstuk 7 - Sancties",
        "title_en": "Chapter 7 - Sanctions",
        "section_range": (32, 43),  # Artikels 32-43
    },
    {
        "number": "8",
        "title": "Hoofdstuk 8 - Overgangs- en slotbepalingen",
        "title_en": "Chapter 8 - Transitional and Final Provisions",
        "section_range": (44, 100),  # Artikels 44+
    },
]


def is_section_in_range(section_num: float, range_tuple: tuple) -> bool:
    """Check if a section number falls within a range."""
    start, end = range_tuple
    return start <= section_num <= end


def restructure_law(document: dict, structure: list, jurisdiction: str) -> dict:
    """Restructure a law document according to the official chapter structure."""
    # Get all sections from the flat structure
    all_sections = []
    for chapter in document.get("chapters", []):
        all_sections.extend(chapter.get("sections", []))

    # Remove duplicate sections (keep the one with more content)
    seen_numbers = {}
    for section in all_sections:
        num = section.get("number", "")
        text = section.get("text", "")
        if num not in seen_numbers or len(text) > len(seen_numbers[num].get("text", "")):
            seen_numbers[num] = section

    unique_sections = list(seen_numbers.values())

    # Sort sections by number
    unique_sections.sort(key=get_section_number)

    # Create new chapter structure
    new_chapters = []
    for chapter_def in structure:
        chapter_id = f"{jurisdiction.lower()}-{document['abbreviation'].lower()}-ch{chapter_def['number']}"

        # Filter sections that belong to this chapter
        chapter_sections = []
        for section in unique_sections:
            section_num = get_section_number(section)
            if is_section_in_range(section_num, chapter_def["section_range"]):
                chapter_sections.append(section)

        if chapter_sections:  # Only add chapter if it has sections
            new_chapters.append({
                "id": chapter_id,
                "number": chapter_def["number"],
                "title": chapter_def["title"],
                "title_en": chapter_def["title_en"],
                "sections": chapter_sections
            })

    # Update the document with new structure
    document["chapters"] = new_chapters
    return document


def process_database(db_path: Path, structure: list, jurisdiction: str) -> None:
    """Process a database file and restructure the main law."""
    print(f"\nProcessing {db_path}...")

    with open(db_path, 'r', encoding='utf-8') as f:
        db = json.load(f)

    # Map of abbreviations to structures
    law_structures = {
        "AT": {"ASchG": ASCHG_STRUCTURE},
        "DE": {"ArbSchG": ARBSCHG_STRUCTURE},
        "NL": {"Arbowet": ARBOWET_STRUCTURE},
    }

    structures = law_structures.get(jurisdiction, {})

    # Process each document
    modified = False
    for doc in db.get("documents", []):
        abbrev = doc.get("abbreviation", "")
        if abbrev in structures:
            print(f"  Restructuring {abbrev}...")
            doc = restructure_law(doc, structures[abbrev], jurisdiction)
            modified = True

            # Print summary
            total_sections = sum(len(ch.get("sections", [])) for ch in doc.get("chapters", []))
            print(f"    Created {len(doc['chapters'])} chapters with {total_sections} sections")

    if modified:
        # Update metadata
        db["metadata"]["restructured_at"] = datetime.now().isoformat()

        # Write back
        with open(db_path, 'w', encoding='utf-8') as f:
            json.dump(db, f, ensure_ascii=False, indent=2)
        print(f"  Saved {db_path}")


def main():
    """Main entry point."""
    base_path = Path(__file__).parent

    # Process each country's database
    process_database(base_path / "at" / "at_database.json", ASCHG_STRUCTURE, "AT")
    process_database(base_path / "de" / "de_database.json", ARBSCHG_STRUCTURE, "DE")
    process_database(base_path / "nl" / "nl_database.json", ARBOWET_STRUCTURE, "NL")

    print("\nDone! Law databases have been restructured according to official structures.")


if __name__ == "__main__":
    main()

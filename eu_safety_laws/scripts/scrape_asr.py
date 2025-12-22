#!/usr/bin/env python3
"""
ASR (Arbeitsstättenregeln) Scraper for German Workplace Safety Rules
Downloads PDFs from BAUA (Bundesanstalt für Arbeitsschutz und Arbeitsmedizin)
and updates the de_merkblaetter.json database.
"""

import os
import sys
import json
import hashlib
import requests
from datetime import datetime
from pathlib import Path

# Configuration
SCRAPER_VERSION = "8.0.0"
BASE_DIR = Path(__file__).parent.parent
PDF_DIR = BASE_DIR / "pdfs" / "de"
MERKBLAETTER_FILE = BASE_DIR / "de" / "de_merkblaetter.json"

# ASR Documents to download
# Format: (abbreviation, title_de, title_en, pdf_url)
# URLs use the ?__blob=publicationFile parameter required by BAUA
ASR_DOCUMENTS = [
    # General and Cross-Sectional Rules
    ("ASR-V3", "ASR V3 - Gefährdungsbeurteilung", "ASR V3 - Risk Assessment",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-V3.pdf?__blob=publicationFile"),
    ("ASR-V3a.2", "ASR V3a.2 - Barrierefreie Gestaltung von Arbeitsstätten", "ASR V3a.2 - Accessible Workplace Design",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-V3a-2.pdf?__blob=publicationFile"),

    # Room Layout and Design (A1.x)
    ("ASR-A1.2", "ASR A1.2 - Raumabmessungen und Bewegungsflächen", "ASR A1.2 - Room Dimensions & Maneuvering Space",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A1-2.pdf?__blob=publicationFile"),
    ("ASR-A1.3", "ASR A1.3 - Sicherheits- und Gesundheitsschutzkennzeichnung", "ASR A1.3 - Safety & Health Signage",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A1-3.pdf?__blob=publicationFile"),
    ("ASR-A1.5", "ASR A1.5/1,2 - Fußböden", "ASR A1.5 - Floors",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A1-5-1-2.pdf?__blob=publicationFile"),
    ("ASR-A1.6", "ASR A1.6 - Fenster, Oberlichter, lichtdurchlässige Wände", "ASR A1.6 - Windows, Skylights, Translucent Walls",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A1-6.pdf?__blob=publicationFile"),
    ("ASR-A1.7", "ASR A1.7 - Türen und Tore", "ASR A1.7 - Doors and Gates",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A1-7.pdf?__blob=publicationFile"),
    ("ASR-A1.8", "ASR A1.8 - Verkehrswege", "ASR A1.8 - Traffic Routes",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A1-8.pdf?__blob=publicationFile"),

    # Safety and Emergency (A2.x)
    ("ASR-A2.1", "ASR A2.1 - Schutz vor Absturz und herabfallenden Gegenständen", "ASR A2.1 - Protection against Falls / Falling Objects",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A2-1.pdf?__blob=publicationFile"),
    ("ASR-A2.2", "ASR A2.2 - Maßnahmen gegen Brände", "ASR A2.2 - Fire Protection Measures",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A2-2.pdf?__blob=publicationFile"),
    ("ASR-A2.3", "ASR A2.3 - Fluchtwege und Notausgänge", "ASR A2.3 - Escape Routes and Emergency Exits",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A2-3.pdf?__blob=publicationFile"),

    # Workplace Environment (A3.x)
    ("ASR-A3.4", "ASR A3.4 - Beleuchtung", "ASR A3.4 - Lighting and Visual Communication",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A3-4.pdf?__blob=publicationFile"),
    ("ASR-A3.5", "ASR A3.5 - Raumtemperatur", "ASR A3.5 - Room Temperature",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A3-5.pdf?__blob=publicationFile"),
    ("ASR-A3.6", "ASR A3.6 - Lüftung", "ASR A3.6 - Ventilation",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A3-6.pdf?__blob=publicationFile"),
    ("ASR-A3.7", "ASR A3.7 - Lärm", "ASR A3.7 - Noise",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A3-7.pdf?__blob=publicationFile"),

    # Sanitary and Social Rooms (A4.x)
    ("ASR-A4.1", "ASR A4.1 - Sanitärräume", "ASR A4.1 - Sanitary Rooms (Restrooms)",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A4-1.pdf?__blob=publicationFile"),
    ("ASR-A4.2", "ASR A4.2 - Pausen- und Bereitschaftsräume", "ASR A4.2 - Break and On-call Rooms",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A4-2.pdf?__blob=publicationFile"),
    ("ASR-A4.3", "ASR A4.3 - Erste-Hilfe-Räume, Mittel und Einrichtungen", "ASR A4.3 - First Aid Rooms and Equipment",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A4-3.pdf?__blob=publicationFile"),
    ("ASR-A4.4", "ASR A4.4 - Unterkünfte", "ASR A4.4 - Accommodation",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A4-4.pdf?__blob=publicationFile"),

    # Special Workplaces (A5.x and A6)
    ("ASR-A5.1", "ASR A5.1 - Nicht umschlossene Arbeitsstätten und Arbeitsplätze im Freien", "ASR A5.1 - Outdoor Workplaces",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A5-1.pdf?__blob=publicationFile"),
    ("ASR-A5.2", "ASR A5.2 - Anforderungen an Arbeitsplätze auf Baustellen im Grenzbereich zum Straßenverkehr", "ASR A5.2 - Construction Sites near Road Traffic",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A5-2.pdf?__blob=publicationFile"),
    ("ASR-A6", "ASR A6 - Bildschirmarbeit", "ASR A6 - Display Screen Work (VDU/Monitor work)",
     "https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/ASR/pdf/ASR-A6.pdf?__blob=publicationFile"),
]

# WHS topic mapping for ASR documents
ASR_WHS_TOPICS = {
    "ASR-V3": [{"id": "risk_assessment", "relevance": "high", "match_count": 5}],
    "ASR-V3a.2": [{"id": "workplace_design", "relevance": "high", "match_count": 3}, {"id": "accessibility", "relevance": "high", "match_count": 5}],
    "ASR-A1.2": [{"id": "workplace_design", "relevance": "high", "match_count": 3}],
    "ASR-A1.3": [{"id": "signage", "relevance": "high", "match_count": 5}, {"id": "emergency_procedures", "relevance": "medium", "match_count": 2}],
    "ASR-A1.5": [{"id": "workplace_design", "relevance": "high", "match_count": 3}, {"id": "slip_trip_fall", "relevance": "high", "match_count": 4}],
    "ASR-A1.6": [{"id": "workplace_design", "relevance": "medium", "match_count": 2}],
    "ASR-A1.7": [{"id": "workplace_design", "relevance": "medium", "match_count": 2}, {"id": "emergency_procedures", "relevance": "medium", "match_count": 2}],
    "ASR-A1.8": [{"id": "traffic_safety", "relevance": "high", "match_count": 5}, {"id": "workplace_design", "relevance": "medium", "match_count": 2}],
    "ASR-A2.1": [{"id": "fall_protection", "relevance": "high", "match_count": 5}, {"id": "ppe", "relevance": "medium", "match_count": 2}],
    "ASR-A2.2": [{"id": "fire_safety", "relevance": "high", "match_count": 5}, {"id": "emergency_procedures", "relevance": "high", "match_count": 3}],
    "ASR-A2.3": [{"id": "emergency_procedures", "relevance": "high", "match_count": 5}, {"id": "fire_safety", "relevance": "medium", "match_count": 2}],
    "ASR-A3.4": [{"id": "lighting", "relevance": "high", "match_count": 5}, {"id": "workplace_design", "relevance": "medium", "match_count": 2}],
    "ASR-A3.5": [{"id": "temperature", "relevance": "high", "match_count": 5}, {"id": "workplace_design", "relevance": "medium", "match_count": 2}],
    "ASR-A3.6": [{"id": "ventilation", "relevance": "high", "match_count": 5}, {"id": "air_quality", "relevance": "high", "match_count": 3}],
    "ASR-A3.7": [{"id": "noise", "relevance": "high", "match_count": 5}, {"id": "hearing_protection", "relevance": "medium", "match_count": 2}],
    "ASR-A4.1": [{"id": "sanitation", "relevance": "high", "match_count": 5}, {"id": "hygiene", "relevance": "high", "match_count": 3}],
    "ASR-A4.2": [{"id": "rest_areas", "relevance": "high", "match_count": 5}, {"id": "workplace_design", "relevance": "medium", "match_count": 2}],
    "ASR-A4.3": [{"id": "first_aid", "relevance": "high", "match_count": 5}, {"id": "emergency_procedures", "relevance": "high", "match_count": 3}],
    "ASR-A4.4": [{"id": "accommodation", "relevance": "high", "match_count": 5}],
    "ASR-A5.1": [{"id": "outdoor_work", "relevance": "high", "match_count": 5}, {"id": "weather_protection", "relevance": "high", "match_count": 3}],
    "ASR-A5.2": [{"id": "construction_safety", "relevance": "high", "match_count": 5}, {"id": "traffic_safety", "relevance": "high", "match_count": 4}],
    "ASR-A6": [{"id": "ergonomics", "relevance": "high", "match_count": 5}, {"id": "display_screen", "relevance": "high", "match_count": 5}],
}


def generate_document_id(abbreviation: str) -> str:
    """Generate a unique document ID from abbreviation."""
    hash_input = f"DE-ASR-{abbreviation}"
    return hashlib.md5(hash_input.encode()).hexdigest()[:16]


def generate_content_hash(content: bytes) -> str:
    """Generate content hash for PDF."""
    return hashlib.md5(content).hexdigest()


def download_pdf(url: str, output_path: Path, retries: int = 3) -> tuple[bool, int, str]:
    """Download PDF from URL to output path. Returns (success, file_size, content_hash)."""
    import time

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
    }

    for attempt in range(retries):
        try:
            if attempt > 0:
                wait_time = 2 ** attempt
                print(f"  Retry {attempt + 1}/{retries} after {wait_time}s...")
                time.sleep(wait_time)

            print(f"  Downloading from {url}...")
            response = requests.get(url, headers=headers, timeout=60, allow_redirects=True)
            response.raise_for_status()

            # Check if it's actually a PDF
            content_type = response.headers.get('Content-Type', '')
            if 'pdf' not in content_type.lower() and not response.content[:4] == b'%PDF':
                print(f"  Warning: Response may not be a PDF (Content-Type: {content_type})")

            # Save the PDF
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'wb') as f:
                f.write(response.content)

            file_size = len(response.content)
            print(f"  Saved: {output_path.name} ({file_size:,} bytes)")
            return True, file_size, generate_content_hash(response.content)

        except requests.RequestException as e:
            print(f"  Error downloading: {e}")
            if attempt == retries - 1:
                return False, 0, None

    return False, 0, None


def create_document_entry(abbr: str, title_de: str, title_en: str, pdf_url: str,
                         pdf_path: Path, file_size: int, content_hash: str) -> dict:
    """Create a document entry for the merkblaetter.json."""
    now = datetime.now().isoformat()

    return {
        "id": generate_document_id(abbr),
        "version": "1.0.0",
        "country": "DE",
        "jurisdiction": "DE",
        "doc_type": "merkblatt",
        "type": "merkblatt",
        "abbreviation": abbr,
        "title": title_de,
        "title_en": title_en,
        "category": "Supplementary",
        "structure_labels": {
            "grouping_1": "Abschnitt",
            "grouping_2": "Titel",
            "article": "§"
        },
        "grouping_1": "Abschnitt",
        "grouping_2": "Titel",
        "article_label": "§",
        "text_content": f"PDF document: {title_de}",
        "full_text": f"PDF document: {title_de}",
        "ai_summary": "",
        "source": {
            "url": pdf_url,
            "authority": "BAUA",
            "title": title_de,
            "robots_txt_compliant": True,
            "source_type": "pdf",
            "local_pdf_path": str(pdf_path.absolute()),
            "pdf_url": pdf_url
        },
        "pdf_path": str(pdf_path.absolute()),
        "pdf_available": True,
        "scraping": {
            "scraped_at": now,
            "scraper_version": SCRAPER_VERSION,
            "source_type": "pdf"
        },
        "chapters": [],
        "sections": [],
        "whs_topics": ASR_WHS_TOPICS.get(abbr, []),
        "whs_summary": {},
        "metadata": {
            "series": "ASR (Arbeitsstättenregeln)",
            "description": title_en,
            "filename": pdf_path.name,
            "size_bytes": file_size,
            "is_supplementary": True,
            "is_pdf_only": True,
            "is_html_only": False
        },
        "content_hash": content_hash,
        "subcategory": "ASR"
    }


def load_merkblaetter() -> dict:
    """Load existing merkblaetter.json or create new structure."""
    if MERKBLAETTER_FILE.exists():
        with open(MERKBLAETTER_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        return {
            "metadata": {
                "country": "DE",
                "type": "merkblaetter",
                "generated_at": datetime.now().isoformat(),
                "document_count": 0,
                "scraper_version": SCRAPER_VERSION
            },
            "documents": []
        }


def save_merkblaetter(data: dict):
    """Save merkblaetter.json."""
    data["metadata"]["generated_at"] = datetime.now().isoformat()
    data["metadata"]["document_count"] = len(data["documents"])

    MERKBLAETTER_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MERKBLAETTER_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nSaved {len(data['documents'])} documents to {MERKBLAETTER_FILE}")


def create_placeholder_entry(abbr: str, title_de: str, title_en: str, pdf_url: str) -> dict:
    """Create a placeholder document entry when PDF cannot be downloaded."""
    now = datetime.now().isoformat()
    filename = f"de_{abbr.replace('.', '-')}_merkblatt.pdf"
    pdf_path = PDF_DIR / filename

    return {
        "id": generate_document_id(abbr),
        "version": "1.0.0",
        "country": "DE",
        "jurisdiction": "DE",
        "doc_type": "merkblatt",
        "type": "merkblatt",
        "abbreviation": abbr,
        "title": title_de,
        "title_en": title_en,
        "category": "Supplementary",
        "structure_labels": {
            "grouping_1": "Abschnitt",
            "grouping_2": "Titel",
            "article": "§"
        },
        "grouping_1": "Abschnitt",
        "grouping_2": "Titel",
        "article_label": "§",
        "text_content": f"PDF document: {title_de}",
        "full_text": f"PDF document: {title_de}",
        "ai_summary": "",
        "source": {
            "url": pdf_url,
            "authority": "BAUA",
            "title": title_de,
            "robots_txt_compliant": True,
            "source_type": "pdf",
            "local_pdf_path": str(pdf_path.absolute()),
            "pdf_url": pdf_url
        },
        "pdf_path": str(pdf_path.absolute()),
        "pdf_available": False,  # Not downloaded yet
        "scraping": {
            "scraped_at": now,
            "scraper_version": SCRAPER_VERSION,
            "source_type": "pdf"
        },
        "chapters": [],
        "sections": [],
        "whs_topics": ASR_WHS_TOPICS.get(abbr, []),
        "whs_summary": {},
        "metadata": {
            "series": "ASR (Arbeitsstättenregeln)",
            "description": title_en,
            "filename": filename,
            "size_bytes": 0,
            "is_supplementary": True,
            "is_pdf_only": True,
            "is_html_only": False,
            "download_pending": True
        },
        "content_hash": None,
        "subcategory": "ASR"
    }


def main():
    """Main function to download ASR PDFs and update merkblaetter.json."""
    import argparse

    parser = argparse.ArgumentParser(description='Download ASR PDFs from BAUA')
    parser.add_argument('--create-placeholders', action='store_true',
                       help='Create database entries even when PDFs cannot be downloaded')
    parser.add_argument('--skip-download', action='store_true',
                       help='Only create placeholders, skip all downloads')
    args = parser.parse_args()

    print("=" * 60)
    print("ASR (Arbeitsstättenregeln) Scraper")
    print("Downloading German Workplace Safety Rules from BAUA")
    print("=" * 60)

    # Ensure PDF directory exists
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing merkblaetter
    merkblaetter = load_merkblaetter()
    existing_abbrs = {doc["abbreviation"] for doc in merkblaetter["documents"]}

    # Track statistics
    downloaded = 0
    skipped = 0
    failed = 0
    placeholders_created = 0
    new_documents = []

    print(f"\nProcessing {len(ASR_DOCUMENTS)} ASR documents...")
    if args.skip_download:
        print("Mode: Creating placeholders only (--skip-download)")
    elif args.create_placeholders:
        print("Mode: Download with placeholder fallback (--create-placeholders)")
    print("-" * 60)

    for abbr, title_de, title_en, pdf_url in ASR_DOCUMENTS:
        print(f"\n[{abbr}] {title_de}")

        # Check if already exists
        if abbr in existing_abbrs:
            print(f"  Skipping: Already in database")
            skipped += 1
            continue

        # Generate filename
        filename = f"de_{abbr.replace('.', '-')}_merkblatt.pdf"
        pdf_path = PDF_DIR / filename

        # Skip download mode - just create placeholders
        if args.skip_download:
            doc_entry = create_placeholder_entry(abbr, title_de, title_en, pdf_url)
            new_documents.append(doc_entry)
            placeholders_created += 1
            print(f"  Created placeholder entry")
            continue

        # Check if PDF already downloaded
        if pdf_path.exists():
            print(f"  PDF already exists: {filename}")
            file_size = pdf_path.stat().st_size
            with open(pdf_path, 'rb') as f:
                content_hash = generate_content_hash(f.read())
            doc_entry = create_document_entry(
                abbr, title_de, title_en, pdf_url,
                pdf_path, file_size, content_hash
            )
            new_documents.append(doc_entry)
            downloaded += 1
            continue

        # Download PDF
        success, file_size, content_hash = download_pdf(pdf_url, pdf_path)
        if success:
            doc_entry = create_document_entry(
                abbr, title_de, title_en, pdf_url,
                pdf_path, file_size, content_hash
            )
            new_documents.append(doc_entry)
            downloaded += 1
        elif args.create_placeholders:
            # Create placeholder entry on failure
            doc_entry = create_placeholder_entry(abbr, title_de, title_en, pdf_url)
            new_documents.append(doc_entry)
            placeholders_created += 1
            print(f"  Created placeholder entry (download failed)")
        else:
            failed += 1

    # Add new documents to merkblaetter
    if new_documents:
        merkblaetter["documents"].extend(new_documents)
        save_merkblaetter(merkblaetter)

    # Print summary
    print("\n" + "=" * 60)
    print("Summary:")
    print(f"  Downloaded: {downloaded}")
    print(f"  Placeholders created: {placeholders_created}")
    print(f"  Skipped (existing): {skipped}")
    print(f"  Failed: {failed}")
    print(f"  Total documents in database: {len(merkblaetter['documents'])}")
    print("=" * 60)

    if placeholders_created > 0:
        print("\nNote: Some entries were created as placeholders.")
        print("Run this script again later to download the actual PDFs.")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

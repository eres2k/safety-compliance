#!/usr/bin/env python3
"""
EU Safety Laws Database Manager
===============================

A unified CLI tool for managing EU safety law databases (AT, DE, NL).

Commands:
    scrape      - Scrape laws from official government sources
    clean       - Clean scraped content using AI (Gemini) or regex
    restructure - Reorganize laws into official chapter structure
    build       - Build/export the complete database
    status      - Show database status and statistics
    all         - Run complete pipeline: scrape -> clean -> restructure -> build

Usage:
    python law_manager.py scrape --country AT
    python law_manager.py clean --all --fast
    python law_manager.py restructure --all
    python law_manager.py build
    python law_manager.py status
    python law_manager.py all --country DE

Environment:
    GEMINI_API_KEY: Required for AI-powered cleaning (optional with --no-ai)

Sources:
    AT: RIS (Rechtsinformationssystem) - ris.bka.gv.at
    DE: gesetze-im-internet.de
    NL: wetten.overheid.nl
"""

import os
import sys
import json
import time
import hashlib
import argparse
import re
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, field, asdict
from urllib.parse import urljoin
import concurrent.futures

# Optional imports with graceful fallback
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class Config:
    """Global configuration for the law manager."""
    base_path: Path = field(default_factory=lambda: Path(__file__).parent)
    scraper_version: str = "7.1.0"
    request_timeout: int = 30
    rate_limit_delay: float = 0.5
    max_retries: int = 3
    gemini_model: str = "gemini-2.0-flash"

    # Source URLs
    sources: Dict[str, Dict[str, str]] = field(default_factory=lambda: {
        "AT": {
            "base_url": "https://www.ris.bka.gv.at",
            "authority": "RIS",
            "main_laws": {
                "ASchG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910",
            }
        },
        "DE": {
            "base_url": "https://www.gesetze-im-internet.de",
            "authority": "gesetze-im-internet.de",
            "main_laws": {
                "ArbSchG": "/arbschg/",
            }
        },
        "NL": {
            "base_url": "https://wetten.overheid.nl",
            "authority": "wetten.overheid.nl",
            "main_laws": {
                "Arbowet": "/BWBR0010346/",
            }
        }
    })


CONFIG = Config()


# =============================================================================
# Terminal Output Helpers
# =============================================================================

class Colors:
    """ANSI color codes for terminal output."""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'


def log_header(msg: str) -> None:
    """Print a header message."""
    width = 60
    print(f"\n{Colors.BLUE}{'=' * width}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{msg.center(width)}{Colors.RESET}")
    print(f"{Colors.BLUE}{'=' * width}{Colors.RESET}\n")


def log_section(msg: str) -> None:
    """Print a section header."""
    print(f"\n{Colors.CYAN}{'-' * 40}{Colors.RESET}")
    print(f"{Colors.CYAN}{msg}{Colors.RESET}")
    print(f"{Colors.CYAN}{'-' * 40}{Colors.RESET}")


def log_info(msg: str) -> None:
    """Print an info message."""
    print(f"{Colors.CYAN}ℹ {msg}{Colors.RESET}")


def log_success(msg: str) -> None:
    """Print a success message."""
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")


def log_warning(msg: str) -> None:
    """Print a warning message."""
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")


def log_error(msg: str) -> None:
    """Print an error message."""
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")


def log_progress(msg: str) -> None:
    """Print a progress message (overwritable)."""
    print(f"\r{Colors.DIM}  → {msg}{Colors.RESET}", end='', flush=True)


def log_progress_done() -> None:
    """Clear the progress line."""
    print()


class SimpleProgressBar:
    """Simple progress bar when tqdm is unavailable."""
    def __init__(self, total: int, desc: str = "Processing", width: int = 40):
        self.total = total
        self.current = 0
        self.desc = desc
        self.width = width
        self.start_time = time.time()

    def update(self, n: int = 1) -> None:
        self.current += n
        self._display()

    def set_description(self, desc: str) -> None:
        self.desc = desc
        self._display()

    def _display(self) -> None:
        if self.total == 0:
            return
        pct = self.current / self.total
        filled = int(self.width * pct)
        bar = '█' * filled + '░' * (self.width - filled)
        elapsed = time.time() - self.start_time
        eta = (elapsed / self.current) * (self.total - self.current) if self.current > 0 else 0
        print(f"\r  {self.desc}: |{bar}| {self.current}/{self.total} ({pct*100:.0f}%) ETA: {int(eta)}s  ", end='', flush=True)

    def close(self) -> None:
        print()


def create_progress_bar(total: int, desc: str = "Processing"):
    """Create a progress bar (tqdm if available)."""
    if HAS_TQDM:
        return tqdm(total=total, desc=f"  {desc}", ncols=80,
                   bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]')
    return SimpleProgressBar(total, desc)


# =============================================================================
# Utility Functions
# =============================================================================

def generate_id(text: str) -> str:
    """Generate a short hash ID from text."""
    return hashlib.md5(text.encode()).hexdigest()[:16]


def get_api_key() -> Optional[str]:
    """Get Gemini API key from environment or .env file."""
    api_key = os.environ.get('GEMINI_API_KEY')

    if not api_key:
        env_path = CONFIG.base_path.parent / '.env'
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if line.startswith('GEMINI_API_KEY='):
                        api_key = line.split('=', 1)[1].strip()
                        break

    if not api_key:
        api_key = os.environ.get('VITE_GEMINI_API_KEY')

    return api_key


def get_db_path(country: str) -> Path:
    """Get the database path for a country."""
    return CONFIG.base_path / country.lower() / f"{country.lower()}_database.json"


def load_database(country: str) -> Dict[str, Any]:
    """Load a country's database."""
    db_path = get_db_path(country)
    if not db_path.exists():
        return {
            "metadata": {
                "country": country,
                "generated_at": datetime.now().isoformat(),
                "document_count": 0,
                "error_count": 0
            },
            "documents": []
        }
    with open(db_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_database(country: str, db: Dict[str, Any], backup: bool = True) -> None:
    """Save a country's database with optional backup."""
    db_path = get_db_path(country)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    if backup and db_path.exists():
        backup_path = db_path.with_suffix('.backup.json')
        with open(db_path, 'r', encoding='utf-8') as f:
            backup_data = f.read()
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(backup_data)
        log_info(f"Backup saved: {backup_path.name}")

    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    log_success(f"Saved: {db_path}")


# =============================================================================
# Official Law Structures
# =============================================================================

# German ordinal words to numbers
GERMAN_ORDINALS = {
    'erster': '1', 'erste': '1', 'ersten': '1',
    'zweiter': '2', 'zweite': '2', 'zweiten': '2',
    'dritter': '3', 'dritte': '3', 'dritten': '3',
    'vierter': '4', 'vierte': '4', 'vierten': '4',
    'fünfter': '5', 'fünfte': '5', 'fünften': '5',
    'sechster': '6', 'sechste': '6', 'sechsten': '6',
    'siebter': '7', 'siebte': '7', 'siebten': '7', 'siebenter': '7',
    'achter': '8', 'achte': '8', 'achten': '8',
    'neunter': '9', 'neunte': '9', 'neunten': '9',
    'zehnter': '10', 'zehnte': '10', 'zehnten': '10',
    'elfter': '11', 'elfte': '11', 'elften': '11',
    'zwölfter': '12', 'zwölfte': '12', 'zwölften': '12',
}

# Official structure: Austria ASchG (ArbeitnehmerInnenschutzgesetz)
STRUCTURE_ASCHG = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 18)},
    {"number": "2", "title": "2. Abschnitt - Arbeitsstätten und Baustellen", "title_en": "Section 2 - Workplaces and Construction Sites", "section_range": (19, 32)},
    {"number": "3", "title": "3. Abschnitt - Arbeitsmittel", "title_en": "Section 3 - Work Equipment", "section_range": (33, 39)},
    {"number": "4", "title": "4. Abschnitt - Arbeitsstoffe", "title_en": "Section 4 - Work Substances", "section_range": (40, 48)},
    {"number": "5", "title": "5. Abschnitt - Gesundheitsüberwachung", "title_en": "Section 5 - Health Surveillance", "section_range": (49, 59)},
    {"number": "6", "title": "6. Abschnitt - Arbeitsvorgänge und Arbeitsplätze", "title_en": "Section 6 - Work Processes and Workplaces", "section_range": (60, 72)},
    {"number": "7", "title": "7. Abschnitt - Präventivdienste", "title_en": "Section 7 - Preventive Services", "section_range": (73, 90)},
    {"number": "8", "title": "8. Abschnitt - Behörden und Verfahren", "title_en": "Section 8 - Authorities and Procedures", "section_range": (91, 101.5)},
    {"number": "9", "title": "9. Abschnitt - Übergangsrecht und Aufhebung", "title_en": "Section 9 - Transitional Law and Repeal", "section_range": (102, 127.5)},
    {"number": "10", "title": "10. Abschnitt - Schlussbestimmungen", "title_en": "Section 10 - Final Provisions", "section_range": (128, 132)},
]

# Official structure: Germany ArbSchG (Arbeitsschutzgesetz)
STRUCTURE_ARBSCHG = [
    {"number": "1", "title": "Erster Abschnitt - Allgemeine Vorschriften", "title_en": "First Section - General Provisions", "section_range": (1, 2)},
    {"number": "2", "title": "Zweiter Abschnitt - Pflichten des Arbeitgebers", "title_en": "Second Section - Employer Obligations", "section_range": (3, 14)},
    {"number": "3", "title": "Dritter Abschnitt - Pflichten und Rechte der Beschäftigten", "title_en": "Third Section - Duties and Rights of Employees", "section_range": (15, 17)},
    {"number": "4", "title": "Vierter Abschnitt - Verordnungsermächtigungen", "title_en": "Fourth Section - Authorization for Ordinances", "section_range": (18, 20)},
    {"number": "5", "title": "Fünfter Abschnitt - Gemeinsame deutsche Arbeitsschutzstrategie", "title_en": "Fifth Section - Common German Occupational Safety Strategy", "section_range": (20.01, 20.99)},
    {"number": "6", "title": "Sechster Abschnitt - Schlußvorschriften", "title_en": "Sixth Section - Final Provisions", "section_range": (21, 26)},
]

# Official structure: Netherlands Arbowet (Arbeidsomstandighedenwet)
STRUCTURE_ARBOWET = [
    {"number": "1", "title": "Hoofdstuk 1 - Definities en toepassingsgebied", "title_en": "Chapter 1 - Definitions and Scope", "section_range": (1, 2)},
    {"number": "2", "title": "Hoofdstuk 2 - Arbeidsomstandighedenbeleid", "title_en": "Chapter 2 - Working Conditions Policy", "section_range": (3, 11)},
    {"number": "3", "title": "Hoofdstuk 3 - Samenwerking, overleg, bijzondere rechten en deskundige bijstand", "title_en": "Chapter 3 - Cooperation, Consultation, Special Rights and Expert Assistance", "section_range": (12, 15.5)},
    {"number": "4", "title": "Hoofdstuk 4 - Bijzondere verplichtingen", "title_en": "Chapter 4 - Special Obligations", "section_range": (16, 23)},
    {"number": "5", "title": "Hoofdstuk 5 - Toezicht en ambtelijke bevelen", "title_en": "Chapter 5 - Supervision and Official Orders", "section_range": (24, 29.99)},
    {"number": "6", "title": "Hoofdstuk 6 - Vrijstellingen, ontheffingen en beroep", "title_en": "Chapter 6 - Exemptions, Dispensations and Appeals", "section_range": (30, 31)},
    {"number": "7", "title": "Hoofdstuk 7 - Sancties", "title_en": "Chapter 7 - Sanctions", "section_range": (32, 43)},
    {"number": "8", "title": "Hoofdstuk 8 - Overgangs- en slotbepalingen", "title_en": "Chapter 8 - Transitional and Final Provisions", "section_range": (44, 100)},
]

LAW_STRUCTURES = {
    "AT": {"ASchG": STRUCTURE_ASCHG},
    "DE": {"ArbSchG": STRUCTURE_ARBSCHG},
    "NL": {"Arbowet": STRUCTURE_ARBOWET},
}


# =============================================================================
# Scraping Module
# =============================================================================

SYSTEM_PROMPTS = {
    'AT': """You are a legal text formatter. Clean Austrian law text scraped from RIS.

REMOVE:
- Navigation boilerplate (Seitenbereiche, Zum Inhalt, Accesskey, etc.)
- Website UI elements (Druckansicht, Andere Formate, etc.)
- Duplicate text with both abbreviated (§ 1) AND written-out (Paragraph eins) forms - keep abbreviated only
- Amendment history at the start (BGBl references at beginning, not inline)

KEEP:
- All actual law content
- Section numbers (§ 1, § 2)
- Subsection markers ((1), (2))
- Inline legal references

Return ONLY the cleaned text.""",

    'DE': """You are a legal text formatter. Clean German law text.

TASK:
- Fix PDF formatting issues
- Proper paragraph breaks between subsections
- Keep numbered lists inline
- Ensure inline references stay inline

Return ONLY the cleaned text.""",

    'NL': """You are a legal text formatter. Clean Dutch law text from wetten.overheid.nl.

REMOVE:
- "Toon relaties in LiDO", "Maak een permanente link"
- "Toon wetstechnische informatie", "Druk het regelingonderdeel af"
- Navigation elements and UI boilerplate

KEEP:
- All law content (artikelen, leden, definities)
- Article numbers and titles
- Subsection markers

Return ONLY the cleaned text."""
}


class Scraper:
    """Base scraper for EU safety laws."""

    # Common HTTP headers to avoid being blocked
    HTTP_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,nl;q=0.7',
    }

    def __init__(self, country: str):
        self.country = country
        self.config = CONFIG.sources.get(country, {})
        self.base_url = self.config.get('base_url', '')
        self.authority = self.config.get('authority', '')

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape laws for this country. Override in subclass."""
        raise NotImplementedError

    def fetch_url(self, url: str, timeout: int = None) -> Optional[str]:
        """Fetch a URL with retries and exponential backoff."""
        if not HAS_REQUESTS:
            log_error("requests package required for scraping. Install with: pip install requests")
            return None

        timeout = timeout or CONFIG.request_timeout

        for attempt in range(CONFIG.max_retries):
            try:
                response = requests.get(url, timeout=timeout, headers=self.HTTP_HEADERS)
                response.raise_for_status()
                return response.text
            except requests.exceptions.Timeout:
                log_warning(f"Timeout on attempt {attempt + 1}/{CONFIG.max_retries}")
            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response else 'unknown'
                log_warning(f"HTTP {status} on attempt {attempt + 1}/{CONFIG.max_retries}")
            except Exception as e:
                log_warning(f"Attempt {attempt + 1}/{CONFIG.max_retries} failed: {e}")

            if attempt < CONFIG.max_retries - 1:
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                time.sleep(wait_time)

        return None


class ATScraper(Scraper):
    """Scraper for Austrian laws from RIS with full text extraction."""

    # WHS relevance mapping for Amazon Logistics context
    WHS_TOPICS = {
        # Core safety topics
        "risk_assessment": {"keywords": ["Ermittlung", "Beurteilung", "Gefahren", "Evaluierung"], "relevance": "high"},
        "documentation": {"keywords": ["Dokument", "schriftlich", "Aufzeichnung", "Unterweisung"], "relevance": "high"},
        "ppe": {"keywords": ["Schutzausrüstung", "persönlich", "Ausrüstung", "PSA"], "relevance": "high"},
        "first_aid": {"keywords": ["Erste Hilfe", "Ersthelfer", "Sanitäter", "Notfall"], "relevance": "high"},
        "training": {"keywords": ["Unterweisung", "Schulung", "Ausbildung", "Information"], "relevance": "high"},
        "workplace_design": {"keywords": ["Arbeitsstätte", "Arbeitsplatz", "Gestaltung", "Einrichtung"], "relevance": "high"},
        "work_equipment": {"keywords": ["Arbeitsmittel", "Geräte", "Maschinen", "Werkzeug"], "relevance": "high"},
        "hazardous_substances": {"keywords": ["Arbeitsstoff", "gefährlich", "Gefahrstoff", "chemisch"], "relevance": "medium"},
        "health_surveillance": {"keywords": ["Gesundheit", "Überwachung", "Untersuchung", "Arzt"], "relevance": "medium"},
        "ergonomics": {"keywords": ["Ergonomie", "Belastung", "Heben", "Tragen", "manuell"], "relevance": "high"},
        "incident_reporting": {"keywords": ["Unfall", "Meldung", "Vorfall", "Ereignis"], "relevance": "high"},
        "working_hours": {"keywords": ["Arbeitszeit", "Ruhezeit", "Pause", "Nachtarbeit"], "relevance": "medium"},
        "special_groups": {"keywords": ["Jugendliche", "Schwangere", "Mutterschutz", "behindert"], "relevance": "medium"},
        "prevention_services": {"keywords": ["Präventivdienst", "Sicherheitsfachkraft", "Arbeitsmedizin"], "relevance": "high"},
        "employer_obligations": {"keywords": ["Arbeitgeber", "Pflicht", "verpflichtet", "verantwortlich"], "relevance": "high"},
        "employee_rights": {"keywords": ["Arbeitnehmer", "Recht", "Mitwirkung", "Information"], "relevance": "medium"},
        "penalties": {"keywords": ["Strafe", "Verwaltungsübertretung", "Geldstrafe", "Sanktion"], "relevance": "high"},
    }

    def __init__(self):
        super().__init__('AT')

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape Austrian laws from RIS with full text extraction."""
        if not HAS_BS4:
            log_error("BeautifulSoup required for scraping. Install with: pip install beautifulsoup4")
            return []

        documents = []
        for abbrev, path in self.config.get('main_laws', {}).items():
            log_info(f"Scraping {abbrev} with full text extraction...")
            url = urljoin(self.base_url, path)
            html = self.fetch_url(url)

            if html:
                doc = self._parse_ris_law_full(html, abbrev, url)
                if doc:
                    documents.append(doc)
                    total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
                    log_success(f"Scraped {abbrev}: {total_sections} sections with full text")

            time.sleep(CONFIG.rate_limit_delay)

        return documents

    def _extract_section_text(self, container) -> str:
        """Extract full text from a section container, handling nested structure."""
        text_parts = []

        # Process all child elements
        for elem in container.find_all(['p', 'ol', 'li', 'div'], recursive=True):
            # Skip navigation and UI elements
            if elem.get('class') and any(c in str(elem.get('class')) for c in ['nav', 'menu', 'sidebar']):
                continue

            text = elem.get_text(separator=' ', strip=True)
            if text and len(text) > 3:  # Skip very short text
                # Clean up the text
                text = re.sub(r'\s+', ' ', text)
                text_parts.append(text)

        # Deduplicate while preserving order
        seen = set()
        unique_parts = []
        for part in text_parts:
            # Normalize for comparison
            normalized = part.lower().strip()
            if normalized not in seen and len(normalized) > 10:
                seen.add(normalized)
                unique_parts.append(part)

        return '\n\n'.join(unique_parts)

    def _classify_whs_topics(self, text: str, title: str) -> List[Dict[str, Any]]:
        """Classify section by WHS relevance topics."""
        topics = []
        combined_text = f"{title} {text}".lower()

        for topic_id, topic_data in self.WHS_TOPICS.items():
            matches = sum(1 for kw in topic_data["keywords"] if kw.lower() in combined_text)
            if matches > 0:
                topics.append({
                    "id": topic_id,
                    "relevance": topic_data["relevance"],
                    "match_count": matches
                })

        # Sort by match count and relevance
        topics.sort(key=lambda x: (-x["match_count"], x["relevance"] != "high"))
        return topics[:5]  # Return top 5 topics

    def _parse_ris_law_full(self, html: str, abbrev: str, url: str) -> Optional[Dict[str, Any]]:
        """Parse an Austrian law from RIS HTML with full text extraction."""
        soup = BeautifulSoup(html, 'html.parser')

        # Extract title
        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else abbrev

        # Remove navigation/boilerplate elements
        for elem in soup.find_all(['nav', 'header', 'footer', 'script', 'style']):
            elem.decompose()

        # Remove elements with navigation-related classes
        for elem in soup.find_all(class_=re.compile(r'(nav|menu|sidebar|header|footer)', re.I)):
            elem.decompose()

        sections = []
        seen_sections = set()

        # Method 1: RIS structure - find h2 elements with § markers
        # The RIS uses: <h2>§ 1</h2> followed by content
        h2_sections = soup.find_all('h2')
        for h2 in h2_sections:
            text = h2.get_text(strip=True)
            match = re.search(r'§\s*(\d+[a-z]?)\.?', text)
            if match:
                section_num = match.group(1)
                if section_num in seen_sections:
                    continue
                seen_sections.add(section_num)

                # Get title from following h3, h4, or h5 (RIS uses h5 for section titles like "Geltungsbereich")
                section_title = ""
                # First try siblings
                next_elem = h2.find_next_sibling()
                while next_elem and next_elem.name not in ['h2']:
                    if next_elem.name in ['h3', 'h4', 'h5']:
                        candidate = next_elem.get_text(strip=True)
                        # Skip if it's just another § reference, chapter heading, or generic placeholder
                        if (not re.match(r'^§\s*\d+', candidate) and
                            not re.match(r'^\d+\.\s*Abschnitt', candidate) and
                            candidate.lower() not in ['text', 'inhalt', 'content']):
                            section_title = candidate
                            break
                    next_elem = next_elem.find_next_sibling()

                # Fallback: search all following elements (not just siblings) for h5 title
                if not section_title:
                    next_h2 = h2.find_next('h2')
                    for h5 in h2.find_all_next('h5'):
                        # Stop if we've passed the next h2
                        if next_h2 and h5.sourceline and next_h2.sourceline and h5.sourceline > next_h2.sourceline:
                            break
                        candidate = h5.get_text(strip=True)
                        if (candidate and len(candidate) > 2 and
                            not re.match(r'^§\s*\d+', candidate) and
                            candidate.lower() not in ['text', 'inhalt', 'content']):
                            section_title = candidate
                            break

                # Collect all content until next h2 with §
                content_parts = []
                current = h2.find_next_sibling()
                while current:
                    if current.name == 'h2':
                        h2_text = current.get_text(strip=True)
                        if re.search(r'§\s*\d+', h2_text):
                            break

                    # Extract text from content elements
                    if current.name in ['p', 'div', 'ol', 'ul', 'table']:
                        elem_text = current.get_text(separator=' ', strip=True)
                        if elem_text and len(elem_text) > 5:
                            # Clean up redundant parenthetical references
                            elem_text = re.sub(r'\s*\([^)]*Paragraph[^)]*\)', '', elem_text)
                            content_parts.append(elem_text)

                    current = current.find_next_sibling()

                # Combine and clean text
                full_text = '\n\n'.join(content_parts)
                # Remove duplicate expanded notation
                full_text = re.sub(r'(\d+)\s*\([^)]*(?:eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)[^)]*\)', r'\1', full_text)

                # Classify WHS topics
                whs_topics = self._classify_whs_topics(full_text, section_title)

                sections.append({
                    "id": generate_id(f"{abbrev}-{section_num}"),
                    "number": section_num,
                    "title": f"§ {section_num}. {section_title}".strip().rstrip('.'),
                    "text": full_text[:15000],  # Increased limit for full text
                    "whs_topics": whs_topics,
                    "amazon_logistics_relevance": self._calculate_logistics_relevance(full_text, section_title),
                    "paragraphs": []
                })

        # Method 2: Alternative structure - find h4 with §
        if not sections:
            log_info("Trying alternative parsing method (h4 elements)...")
            for h4 in soup.find_all('h4'):
                text = h4.get_text(strip=True)
                match = re.search(r'§\s*(\d+[a-z]?)\.?', text)
                if match:
                    section_num = match.group(1)
                    if section_num in seen_sections:
                        continue
                    seen_sections.add(section_num)

                    # Get title from element text after the §
                    title_match = re.search(r'§\s*\d+[a-z]?\.?\s*(.+)', text)
                    section_title = title_match.group(1) if title_match else ""

                    # Collect content
                    content_parts = []
                    parent = h4.find_parent(['div', 'section', 'article'])
                    if parent:
                        for elem in parent.find_all(['p', 'li', 'ol']):
                            elem_text = elem.get_text(strip=True)
                            if elem_text and len(elem_text) > 10:
                                content_parts.append(elem_text)

                    full_text = '\n\n'.join(content_parts)
                    whs_topics = self._classify_whs_topics(full_text, section_title)

                    sections.append({
                        "id": generate_id(f"{abbrev}-{section_num}"),
                        "number": section_num,
                        "title": f"§ {section_num}. {section_title}".strip().rstrip('.'),
                        "text": full_text[:15000],
                        "whs_topics": whs_topics,
                        "amazon_logistics_relevance": self._calculate_logistics_relevance(full_text, section_title),
                        "paragraphs": []
                    })

        # Method 3: Parse from any container with § (last resort with deep extraction)
        if not sections:
            log_info("Trying deep extraction method...")
            # Find all text containing §
            for elem in soup.find_all(string=re.compile(r'§\s*\d+')):
                parent = elem.find_parent(['div', 'section', 'article', 'td'])
                if not parent:
                    continue

                text = elem.strip() if isinstance(elem, str) else elem.get_text(strip=True)
                match = re.search(r'§\s*(\d+[a-z]?)\.?', text)
                if match:
                    section_num = match.group(1)
                    if section_num in seen_sections:
                        continue
                    seen_sections.add(section_num)

                    # Extract text from parent container
                    full_text = parent.get_text(separator='\n', strip=True)
                    # Clean up
                    full_text = re.sub(r'\n{3,}', '\n\n', full_text)

                    whs_topics = self._classify_whs_topics(full_text, "")

                    sections.append({
                        "id": generate_id(f"{abbrev}-{section_num}"),
                        "number": section_num,
                        "title": f"§ {section_num}",
                        "text": full_text[:10000],
                        "whs_topics": whs_topics,
                        "amazon_logistics_relevance": self._calculate_logistics_relevance(full_text, ""),
                        "paragraphs": []
                    })

        # Sort sections by number
        sections.sort(key=lambda s: get_section_number(s))

        # Organize into official chapter structure
        chapters = self._organize_into_chapters(sections, abbrev)

        return {
            "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
            "version": "1.0.0",
            "type": "law",
            "jurisdiction": "AT",
            "abbreviation": abbrev,
            "title": title,
            "title_en": "Employee Protection Act" if abbrev == "ASchG" else title,
            "category": "Core Safety",
            "source": {
                "url": url,
                "title": title,
                "authority": self.authority,
                "robots_txt_compliant": True
            },
            "scraping": {
                "scraped_at": datetime.now().isoformat(),
                "scraper_version": CONFIG.scraper_version
            },
            "whs_summary": self._generate_whs_summary(sections),
            "chapters": chapters
        }

    def _calculate_logistics_relevance(self, text: str, title: str) -> Dict[str, Any]:
        """Calculate relevance score for Amazon Logistics WHS context."""
        combined = f"{title} {text}".lower()

        # Keywords highly relevant to logistics/warehouse operations
        logistics_keywords = {
            "high": [
                "heben", "tragen", "transport", "lager", "förder", "stapler",
                "palette", "regal", "rampe", "fahrzeug", "beladen", "entladen",
                "ergonomie", "rücken", "muskel", "bewegung", "repetitiv",
                "unterweisung", "schutzausrüstung", "sicherheitsschuhe",
                "warnweste", "erste hilfe", "notfall", "fluchtweg", "brandschutz"
            ],
            "medium": [
                "arbeitsmittel", "maschine", "gerät", "lärmschutz", "beleuchtung",
                "temperatur", "klima", "sanitär", "pause", "arbeitszeit",
                "gefährdung", "risiko", "unfall", "verletzung", "prävention"
            ]
        }

        high_matches = sum(1 for kw in logistics_keywords["high"] if kw in combined)
        medium_matches = sum(1 for kw in logistics_keywords["medium"] if kw in combined)

        score = (high_matches * 2) + medium_matches

        if score >= 5:
            relevance_level = "critical"
        elif score >= 3:
            relevance_level = "high"
        elif score >= 1:
            relevance_level = "medium"
        else:
            relevance_level = "low"

        return {
            "score": score,
            "level": relevance_level,
            "high_keyword_matches": high_matches,
            "medium_keyword_matches": medium_matches
        }

    def _organize_into_chapters(self, sections: List[Dict], abbrev: str) -> List[Dict]:
        """Organize sections into official chapter structure."""
        structure = LAW_STRUCTURES.get("AT", {}).get(abbrev, [])

        if not structure:
            # Fallback to single chapter
            return [{
                "id": f"at-{abbrev.lower()}-main",
                "number": "1",
                "title": "Hauptteil",
                "title_en": "Main Part",
                "sections": sections
            }]

        chapters = []
        for chapter_def in structure:
            start, end = chapter_def["section_range"]
            chapter_sections = [
                s for s in sections
                if start <= get_section_number(s) <= end
            ]

            if chapter_sections:
                chapters.append({
                    "id": f"at-{abbrev.lower()}-ch{chapter_def['number']}",
                    "number": chapter_def["number"],
                    "title": chapter_def["title"],
                    "title_en": chapter_def.get("title_en", ""),
                    "sections": chapter_sections
                })

        return chapters if chapters else [{
            "id": f"at-{abbrev.lower()}-main",
            "number": "1",
            "title": "Hauptteil",
            "title_en": "Main Part",
            "sections": sections
        }]

    def _generate_whs_summary(self, sections: List[Dict]) -> Dict[str, Any]:
        """Generate WHS summary statistics for the law."""
        topic_counts = {}
        relevance_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}

        for section in sections:
            # Count topics
            for topic in section.get("whs_topics", []):
                topic_id = topic["id"]
                if topic_id not in topic_counts:
                    topic_counts[topic_id] = 0
                topic_counts[topic_id] += 1

            # Count relevance levels
            relevance = section.get("amazon_logistics_relevance", {})
            level = relevance.get("level", "low")
            relevance_counts[level] += 1

        # Sort topics by count
        sorted_topics = sorted(topic_counts.items(), key=lambda x: -x[1])

        return {
            "total_sections": len(sections),
            "logistics_relevance_distribution": relevance_counts,
            "top_whs_topics": sorted_topics[:10],
            "critical_sections_count": relevance_counts["critical"] + relevance_counts["high"]
        }


class DEScraper(Scraper):
    """Scraper for German laws from gesetze-im-internet.de with full text extraction."""

    # WHS relevance mapping for German context
    WHS_TOPICS = {
        "risk_assessment": {"keywords": ["Gefährdungsbeurteilung", "Beurteilung", "Gefährdung", "ermitteln"], "relevance": "high"},
        "documentation": {"keywords": ["Dokumentation", "dokumentieren", "Aufzeichnung", "Nachweis"], "relevance": "high"},
        "ppe": {"keywords": ["Schutzausrüstung", "persönliche", "PSA", "Schutzkleidung"], "relevance": "high"},
        "first_aid": {"keywords": ["Erste Hilfe", "Ersthelfer", "Notfall", "Rettung"], "relevance": "high"},
        "training": {"keywords": ["Unterweisung", "Schulung", "Ausbildung", "Qualifikation"], "relevance": "high"},
        "workplace_design": {"keywords": ["Arbeitsplatz", "Arbeitsstätte", "Gestaltung", "Einrichtung"], "relevance": "high"},
        "work_equipment": {"keywords": ["Arbeitsmittel", "Maschine", "Gerät", "Werkzeug"], "relevance": "high"},
        "hazardous_substances": {"keywords": ["Gefahrstoff", "gefährlich", "Stoff", "chemisch"], "relevance": "medium"},
        "health_surveillance": {"keywords": ["Gesundheit", "arbeitsmedizinisch", "Vorsorge", "Untersuchung"], "relevance": "medium"},
        "ergonomics": {"keywords": ["Ergonomie", "Belastung", "Heben", "körperlich"], "relevance": "high"},
        "incident_reporting": {"keywords": ["Unfall", "Meldung", "Vorfall", "Ereignis"], "relevance": "high"},
        "working_hours": {"keywords": ["Arbeitszeit", "Ruhezeit", "Pause"], "relevance": "medium"},
        "special_groups": {"keywords": ["Jugendliche", "Schwangere", "Mutterschutz", "behindert"], "relevance": "medium"},
        "prevention_services": {"keywords": ["Fachkraft", "Sicherheit", "Betriebsarzt", "Arbeitsschutz"], "relevance": "high"},
        "employer_obligations": {"keywords": ["Arbeitgeber", "Pflicht", "verpflichtet", "Verantwortung"], "relevance": "high"},
        "employee_rights": {"keywords": ["Beschäftigte", "Arbeitnehmer", "Recht", "Mitwirkung"], "relevance": "medium"},
        "penalties": {"keywords": ["Strafe", "Ordnungswidrigkeit", "Bußgeld", "Sanktion"], "relevance": "high"},
    }

    def __init__(self):
        super().__init__('DE')

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape German laws with full text extraction from individual section pages."""
        if not HAS_BS4:
            log_error("BeautifulSoup required. Install with: pip install beautifulsoup4")
            return []

        documents = []
        for abbrev, path in self.config.get('main_laws', {}).items():
            log_info(f"Scraping {abbrev} with full text extraction...")
            url = urljoin(self.base_url, path)
            html = self.fetch_url(url)

            if html:
                doc = self._parse_german_law_full(html, abbrev, url)
                if doc:
                    documents.append(doc)
                    total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
                    log_success(f"Scraped {abbrev}: {total_sections} sections with full text")

            time.sleep(CONFIG.rate_limit_delay)

        return documents

    def _fetch_section_content(self, section_url: str) -> str:
        """Fetch full content from individual section page."""
        html = self.fetch_url(section_url, timeout=15)
        if not html:
            return ""

        soup = BeautifulSoup(html, 'html.parser')

        # Remove navigation elements
        for elem in soup.find_all(['nav', 'script', 'style']):
            elem.decompose()

        # Find the main content container (gesetze-im-internet uses specific divs)
        # Try multiple selectors
        content_divs = soup.find_all('div', class_='jurAbsatz')
        if content_divs:
            return '\n\n'.join(div.get_text(separator='\n', strip=True) for div in content_divs)

        content_div = soup.find('div', class_='jntext')
        if content_div:
            return content_div.get_text(separator='\n', strip=True)

        # Fallback: find content after the title
        title = soup.find(['h2', 'h3'])
        if title:
            content_parts = []
            for sibling in title.find_next_siblings():
                if sibling.name in ['h2', 'h3', 'nav', 'footer']:
                    break
                text = sibling.get_text(strip=True)
                if text and len(text) > 5:
                    content_parts.append(text)
            return '\n\n'.join(content_parts)

        return ""

    def _classify_whs_topics(self, text: str, title: str) -> List[Dict[str, Any]]:
        """Classify section by WHS relevance topics."""
        topics = []
        combined_text = f"{title} {text}".lower()

        for topic_id, topic_data in self.WHS_TOPICS.items():
            matches = sum(1 for kw in topic_data["keywords"] if kw.lower() in combined_text)
            if matches > 0:
                topics.append({
                    "id": topic_id,
                    "relevance": topic_data["relevance"],
                    "match_count": matches
                })

        topics.sort(key=lambda x: (-x["match_count"], x["relevance"] != "high"))
        return topics[:5]

    def _calculate_logistics_relevance(self, text: str, title: str) -> Dict[str, Any]:
        """Calculate relevance score for logistics/warehouse operations."""
        combined = f"{title} {text}".lower()

        logistics_keywords = {
            "high": [
                "heben", "tragen", "transport", "lager", "förder", "stapler",
                "palette", "regal", "rampe", "fahrzeug", "beladen", "entladen",
                "ergonomie", "rücken", "muskel", "körperlich",
                "unterweisung", "schutzausrüstung", "sicherheitsschuhe",
                "warnweste", "erste hilfe", "notfall", "fluchtweg"
            ],
            "medium": [
                "arbeitsmittel", "maschine", "gerät", "lärm", "beleuchtung",
                "temperatur", "klima", "sanitär", "pause", "arbeitszeit",
                "gefährdung", "risiko", "unfall", "verletzung", "prävention"
            ]
        }

        high_matches = sum(1 for kw in logistics_keywords["high"] if kw in combined)
        medium_matches = sum(1 for kw in logistics_keywords["medium"] if kw in combined)

        score = (high_matches * 2) + medium_matches

        if score >= 5:
            level = "critical"
        elif score >= 3:
            level = "high"
        elif score >= 1:
            level = "medium"
        else:
            level = "low"

        return {
            "score": score,
            "level": level,
            "high_keyword_matches": high_matches,
            "medium_keyword_matches": medium_matches
        }

    def _try_full_html_page(self, base_url: str, abbrev: str) -> Dict[str, str]:
        """Try to fetch full law content from HTML full version page."""
        section_contents = {}

        # Try the BJNR full page
        full_urls = [
            urljoin(base_url, 'BJNR124610996.html'),  # ArbSchG specific
            urljoin(base_url, 'index.html#BJNR124610996'),
        ]

        for full_url in full_urls:
            html = self.fetch_url(full_url, timeout=60)
            if not html:
                continue

            soup = BeautifulSoup(html, 'html.parser')

            # Look for sections in the full page
            for div in soup.find_all('div', class_='jurAbsatz'):
                # Find the section number from nearby header
                header = div.find_previous(['h2', 'h3', 'h4'])
                if header:
                    header_text = header.get_text(strip=True)
                    match = re.search(r'§\s*(\d+[a-z]?)', header_text)
                    if match:
                        section_num = match.group(1)
                        content = div.get_text(separator='\n', strip=True)
                        if section_num not in section_contents or len(content) > len(section_contents[section_num]):
                            section_contents[section_num] = content

            if section_contents:
                log_success(f"Extracted {len(section_contents)} sections from full HTML page")
                break

        return section_contents

    def _parse_german_law_full(self, html: str, abbrev: str, url: str) -> Optional[Dict[str, Any]]:
        """Parse a German law with full text extraction."""
        soup = BeautifulSoup(html, 'html.parser')

        title = soup.find('h1')
        title = title.get_text(strip=True) if title else abbrev

        sections = []
        seen_sections = set()
        section_links = []

        # Collect all section links first
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            text = link.get_text(strip=True)
            # Match links like __1.html, __2.html, __20a.html or BJNR pattern
            if re.search(r'(__\d+[a-z]?\.html|BJNE\d+)', href):
                match = re.search(r'§\s*(\d+[a-z]?)\b', text)
                if match:
                    section_num = match.group(1)
                    if section_num not in seen_sections:
                        seen_sections.add(section_num)
                        section_links.append({
                            "number": section_num,
                            "title": text.strip(),
                            "href": href
                        })

        # Try to get full content from full HTML page first
        log_info(f"Trying to fetch full HTML version...")
        full_page_contents = self._try_full_html_page(url, abbrev)

        # If full page didn't work, try individual section pages
        if not full_page_contents:
            log_info(f"Attempting to fetch {len(section_links)} individual section pages...")
            progress = create_progress_bar(len(section_links), f"Fetching {abbrev} sections")

            failed_fetches = 0
            max_failures = 3  # Stop trying after 3 consecutive failures

            for link_info in section_links:
                content = ""

                # Only try fetching if we haven't had too many consecutive failures
                if failed_fetches < max_failures:
                    section_url = urljoin(url, link_info["href"])
                    content = self._fetch_section_content(section_url)

                    if not content:
                        failed_fetches += 1
                    else:
                        failed_fetches = 0  # Reset on success
                        full_page_contents[link_info["number"]] = content

                progress.update(1)
                if failed_fetches < max_failures:
                    time.sleep(CONFIG.rate_limit_delay * 0.3)

            progress.close()

            if failed_fetches >= max_failures:
                log_warning(f"Individual page fetching failed - using index titles only")

        # Build sections list
        for link_info in section_links:
            content = full_page_contents.get(link_info["number"], link_info["title"])

            whs_topics = self._classify_whs_topics(content, link_info["title"])
            logistics_relevance = self._calculate_logistics_relevance(content, link_info["title"])

            sections.append({
                "id": generate_id(f"{abbrev}-{link_info['number']}"),
                "number": link_info["number"],
                "title": f"§ {link_info['number']}. {link_info['title'].replace('§ ' + link_info['number'], '').strip()}".rstrip('.'),
                "text": content[:15000] if content else link_info["title"],
                "whs_topics": whs_topics,
                "amazon_logistics_relevance": logistics_relevance,
                "paragraphs": []
            })

        # Sort and organize into chapters
        sections.sort(key=lambda s: get_section_number(s))
        chapters = self._organize_into_chapters(sections, abbrev)

        return {
            "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
            "version": "1.0.0",
            "type": "law",
            "jurisdiction": "DE",
            "abbreviation": abbrev,
            "title": title,
            "title_en": "Occupational Safety Act" if abbrev == "ArbSchG" else title,
            "category": "Core Safety",
            "implements_eu_directive": "89/391/EWG",
            "source": {"url": url, "title": title, "authority": self.authority, "robots_txt_compliant": True},
            "scraping": {"scraped_at": datetime.now().isoformat(), "scraper_version": CONFIG.scraper_version},
            "whs_summary": self._generate_whs_summary(sections),
            "chapters": chapters
        }

    def _organize_into_chapters(self, sections: List[Dict], abbrev: str) -> List[Dict]:
        """Organize sections into official chapter structure."""
        structure = LAW_STRUCTURES.get("DE", {}).get(abbrev, [])

        if not structure:
            return [{
                "id": f"de-{abbrev.lower()}-main",
                "number": "1",
                "title": "Hauptteil",
                "title_en": "Main Part",
                "sections": sections
            }]

        chapters = []
        for chapter_def in structure:
            start, end = chapter_def["section_range"]
            chapter_sections = [
                s for s in sections
                if start <= get_section_number(s) <= end
            ]

            if chapter_sections:
                chapters.append({
                    "id": f"de-{abbrev.lower()}-ch{chapter_def['number']}",
                    "number": chapter_def["number"],
                    "title": chapter_def["title"],
                    "title_en": chapter_def.get("title_en", ""),
                    "sections": chapter_sections
                })

        return chapters if chapters else [{
            "id": f"de-{abbrev.lower()}-main",
            "number": "1",
            "title": "Hauptteil",
            "title_en": "Main Part",
            "sections": sections
        }]

    def _generate_whs_summary(self, sections: List[Dict]) -> Dict[str, Any]:
        """Generate WHS summary statistics for the law."""
        topic_counts = {}
        relevance_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}

        for section in sections:
            for topic in section.get("whs_topics", []):
                topic_id = topic["id"]
                if topic_id not in topic_counts:
                    topic_counts[topic_id] = 0
                topic_counts[topic_id] += 1

            relevance = section.get("amazon_logistics_relevance", {})
            level = relevance.get("level", "low")
            relevance_counts[level] += 1

        sorted_topics = sorted(topic_counts.items(), key=lambda x: -x[1])

        return {
            "total_sections": len(sections),
            "logistics_relevance_distribution": relevance_counts,
            "top_whs_topics": sorted_topics[:10],
            "critical_sections_count": relevance_counts["critical"] + relevance_counts["high"]
        }


class NLScraper(Scraper):
    """Scraper for Dutch laws from wetten.overheid.nl with full text extraction."""

    # WHS relevance mapping for Dutch context
    WHS_TOPICS = {
        "risk_assessment": {"keywords": ["risico-inventarisatie", "evaluatie", "RI&E", "beoordeling", "gevaar"], "relevance": "high"},
        "documentation": {"keywords": ["documentatie", "schriftelijk", "registratie", "plan"], "relevance": "high"},
        "ppe": {"keywords": ["beschermingsmiddel", "persoonlijk", "PBM", "bescherming"], "relevance": "high"},
        "first_aid": {"keywords": ["eerste hulp", "EHBO", "noodgeval", "bedrijfshulpverlening", "BHV"], "relevance": "high"},
        "training": {"keywords": ["voorlichting", "opleiding", "instructie", "onderricht"], "relevance": "high"},
        "workplace_design": {"keywords": ["arbeidsplaats", "werkplek", "inrichting", "omstandigheden"], "relevance": "high"},
        "work_equipment": {"keywords": ["arbeidsmiddel", "machine", "gereedschap", "apparaat"], "relevance": "high"},
        "hazardous_substances": {"keywords": ["gevaarlijke stof", "chemisch", "toxisch", "carcinogeen"], "relevance": "medium"},
        "health_surveillance": {"keywords": ["gezondheid", "arbeidsgezondheidskundig", "onderzoek", "keurig"], "relevance": "medium"},
        "ergonomics": {"keywords": ["ergonomie", "tillen", "fysieke belasting", "lichamelijk"], "relevance": "high"},
        "incident_reporting": {"keywords": ["ongeval", "melding", "incident", "voorval"], "relevance": "high"},
        "working_hours": {"keywords": ["arbeidstijd", "rusttijd", "pauze", "werktijd"], "relevance": "medium"},
        "special_groups": {"keywords": ["jeugdige", "zwanger", "moeder", "gehandicapt"], "relevance": "medium"},
        "prevention_services": {"keywords": ["preventiemedewerker", "arbodienst", "deskundige", "bedrijfsarts"], "relevance": "high"},
        "employer_obligations": {"keywords": ["werkgever", "plicht", "verplicht", "zorgplicht"], "relevance": "high"},
        "employee_rights": {"keywords": ["werknemer", "recht", "medewerking", "informatie"], "relevance": "medium"},
        "penalties": {"keywords": ["boete", "straf", "overtreding", "sanctie"], "relevance": "high"},
    }

    def __init__(self):
        super().__init__('NL')

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape Dutch laws with full text extraction."""
        if not HAS_BS4:
            log_error("BeautifulSoup required. Install with: pip install beautifulsoup4")
            return []

        documents = []
        for abbrev, path in self.config.get('main_laws', {}).items():
            log_info(f"Scraping {abbrev} with full text extraction...")
            url = urljoin(self.base_url, path)
            html = self.fetch_url(url)

            if html:
                doc = self._parse_dutch_law_full(html, abbrev, url)
                if doc:
                    documents.append(doc)
                    total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
                    log_success(f"Scraped {abbrev}: {total_sections} articles with full text")

            time.sleep(CONFIG.rate_limit_delay)

        return documents

    def _classify_whs_topics(self, text: str, title: str) -> List[Dict[str, Any]]:
        """Classify section by WHS relevance topics."""
        topics = []
        combined_text = f"{title} {text}".lower()

        for topic_id, topic_data in self.WHS_TOPICS.items():
            matches = sum(1 for kw in topic_data["keywords"] if kw.lower() in combined_text)
            if matches > 0:
                topics.append({
                    "id": topic_id,
                    "relevance": topic_data["relevance"],
                    "match_count": matches
                })

        topics.sort(key=lambda x: (-x["match_count"], x["relevance"] != "high"))
        return topics[:5]

    def _calculate_logistics_relevance(self, text: str, title: str) -> Dict[str, Any]:
        """Calculate relevance score for logistics/warehouse operations."""
        combined = f"{title} {text}".lower()

        logistics_keywords = {
            "high": [
                "tillen", "dragen", "transport", "magazijn", "vorkheftruck",
                "pallet", "stelling", "laadperron", "voertuig", "laden", "lossen",
                "ergonomie", "rug", "spier", "lichamelijk",
                "voorlichting", "beschermingsmiddel", "veiligheidsschoenen",
                "signaalvest", "eerste hulp", "noodgeval", "vluchtweg"
            ],
            "medium": [
                "arbeidsmiddel", "machine", "apparaat", "geluid", "verlichting",
                "temperatuur", "klimaat", "sanitair", "pauze", "arbeidstijd",
                "gevaar", "risico", "ongeval", "letsel", "preventie"
            ]
        }

        high_matches = sum(1 for kw in logistics_keywords["high"] if kw in combined)
        medium_matches = sum(1 for kw in logistics_keywords["medium"] if kw in combined)

        score = (high_matches * 2) + medium_matches

        if score >= 5:
            level = "critical"
        elif score >= 3:
            level = "high"
        elif score >= 1:
            level = "medium"
        else:
            level = "low"

        return {
            "score": score,
            "level": level,
            "high_keyword_matches": high_matches,
            "medium_keyword_matches": medium_matches
        }

    def _parse_dutch_law_full(self, html: str, abbrev: str, url: str) -> Optional[Dict[str, Any]]:
        """Parse a Dutch law with full text extraction."""
        soup = BeautifulSoup(html, 'html.parser')

        # Remove script and style elements
        for elem in soup.find_all(['script', 'style']):
            elem.decompose()

        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else abbrev

        sections = []
        seen_sections = set()

        # UI boilerplate patterns to filter out
        boilerplate_patterns = [
            r'Toon relaties in LiDO',
            r'Maak een permanente link',
            r'Toon wetstechnische informatie',
            r'Druk het regelingonderdeel af',
            r'Sla het regelingonderdeel op',
            r'\[Wijziging\(en\)[^\]]*\]',
            r'wijzigingenoverzicht',
            r'Selecteer[\s\S]*?geldig',
            r'Vergelijk met',
            r'https?://[^\s]+',
        ]
        boilerplate_regex = re.compile('|'.join(boilerplate_patterns), re.IGNORECASE)

        # Method 1: Find div.artikel containers with ID pattern Hoofdstuk*_Artikel*
        # Structure: div.artikel > [header div with h4] + [ul.artikel_leden with actual content]
        artikel_containers = soup.find_all('div', id=re.compile(r'Hoofdstuk\d+_Artikel\d+[a-z]?$', re.IGNORECASE))

        # Fallback: find by class if ID search fails
        if not artikel_containers:
            artikel_containers = soup.find_all('div', class_='artikel')

        for container in artikel_containers:
            # Get article number from ID or from h4 header
            container_id = container.get('id', '')
            match = re.search(r'Artikel(\d+[a-z]?)', container_id, re.IGNORECASE)

            if not match:
                # Try finding h4 in the container
                h4 = container.find('h4')
                if h4:
                    h4_text = h4.get_text(strip=True)
                    match = re.search(r'Artikel\s+(\d+[a-z]?)', h4_text, re.IGNORECASE)

            if not match:
                continue

            section_num = match.group(1)
            if section_num in seen_sections:
                continue
            seen_sections.add(section_num)

            # Get article title from h4
            article_title = ""
            h4 = container.find('h4')
            if h4:
                h4_text = h4.get_text(strip=True)
                title_match = re.search(r'Artikel\s+\d+[a-z]?\.?\s*(.+)', h4_text, re.IGNORECASE)
                article_title = title_match.group(1).strip() if title_match else ""

            # Extract content from ul.artikel_leden or p.lid elements
            content_parts = []

            # Find the content ul (class contains 'artikel_leden')
            content_uls = container.find_all('ul', class_=lambda c: c and 'artikel_leden' in ' '.join(c) if c else False)

            for ul in content_uls:
                # Get all p.lid paragraphs (the actual law text)
                for p in ul.find_all('p', class_=lambda c: c and 'lid' in ' '.join(c) if c else False):
                    p_text = p.get_text(separator=' ', strip=True)
                    if p_text and len(p_text) > 5:
                        p_text = re.sub(r'\s+', ' ', p_text)
                        content_parts.append(p_text)

                # Also get p.al elements (sub-definitions)
                for p in ul.find_all('p', class_='al'):
                    p_text = p.get_text(separator=' ', strip=True)
                    if p_text and len(p_text) > 5:
                        p_text = re.sub(r'\s+', ' ', p_text)
                        content_parts.append(p_text)

                # Get labeled paragraphs too
                for p in ul.find_all('p', class_='labeled'):
                    p_text = p.get_text(separator=' ', strip=True)
                    if p_text and len(p_text) > 5:
                        p_text = re.sub(r'\s+', ' ', p_text)
                        content_parts.append(p_text)

            # Fallback: if no content found, try all p and li elements in container
            if not content_parts:
                for elem in container.find_all(['p', 'li']):
                    # Skip elements in the header div
                    parent_classes = ' '.join(elem.parent.get('class', []) if elem.parent else [])
                    if 'article__header' in parent_classes:
                        continue
                    elem_text = elem.get_text(separator=' ', strip=True)
                    if elem_text and len(elem_text) > 10:
                        elem_text = re.sub(r'\s+', ' ', elem_text)
                        content_parts.append(elem_text)

            # Deduplicate while preserving order (nested li may duplicate)
            seen_parts = set()
            unique_parts = []
            for part in content_parts:
                # Use first 100 chars for comparison to handle slight variations
                key = part[:100].lower()
                if key not in seen_parts:
                    seen_parts.add(key)
                    unique_parts.append(part)

            # Join and clean the text
            full_text = '\n'.join(unique_parts)

            # Remove boilerplate
            for pattern in boilerplate_patterns:
                full_text = re.sub(pattern, '', full_text, flags=re.IGNORECASE)

            # Clean up whitespace
            full_text = re.sub(r'\n{3,}', '\n\n', full_text)
            full_text = re.sub(r'[ \t]+', ' ', full_text)
            full_text = full_text.strip()

            # Skip if we only got boilerplate
            if len(full_text) < 20:
                log_warning(f"Article {section_num} has very short content ({len(full_text)} chars)")
                continue

            whs_topics = self._classify_whs_topics(full_text, article_title)
            logistics_relevance = self._calculate_logistics_relevance(full_text, article_title)

            sections.append({
                "id": generate_id(f"{abbrev}-{section_num}"),
                "number": section_num,
                "title": f"Artikel {section_num}. {article_title}".rstrip('.'),
                "text": full_text[:15000],
                "whs_topics": whs_topics,
                "amazon_logistics_relevance": logistics_relevance,
                "paragraphs": []
            })

        # Method 2: Fallback - try finding content via anchor IDs (Hoofdstuk1_Artikel1 pattern)
        if not sections:
            log_info("Trying alternative parsing via anchor IDs...")
            for anchor in soup.find_all('a', id=re.compile(r'Artikel\d+', re.IGNORECASE)):
                anchor_id = anchor.get('id', '')
                match = re.search(r'Artikel(\d+[a-z]?)', anchor_id, re.IGNORECASE)
                if not match:
                    continue

                section_num = match.group(1)
                if section_num in seen_sections:
                    continue
                seen_sections.add(section_num)

                # Find the parent container and extract text
                parent = anchor.find_parent(['div', 'section', 'li'])
                if parent:
                    full_text = parent.get_text(separator='\n', strip=True)
                    # Apply boilerplate cleanup
                    for pattern in boilerplate_patterns:
                        full_text = re.sub(pattern, '', full_text, flags=re.IGNORECASE)
                    full_text = re.sub(r'\n{3,}', '\n\n', full_text).strip()

                    if len(full_text) > 20:
                        sections.append({
                            "id": generate_id(f"{abbrev}-{section_num}"),
                            "number": section_num,
                            "title": f"Artikel {section_num}",
                            "text": full_text[:15000],
                            "whs_topics": self._classify_whs_topics(full_text, ""),
                            "amazon_logistics_relevance": self._calculate_logistics_relevance(full_text, ""),
                            "paragraphs": []
                        })

        # Sort sections by number
        sections.sort(key=lambda s: get_section_number(s))

        # Organize into chapters (Hoofdstukken)
        chapters = self._organize_into_chapters(sections, abbrev)

        return {
            "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
            "version": "1.0.0",
            "type": "law",
            "jurisdiction": "NL",
            "abbreviation": abbrev,
            "title": title,
            "title_en": "Working Conditions Act" if abbrev == "Arbowet" else title,
            "category": "Core Safety",
            "implements_eu_directive": "89/391/EEG",
            "source": {"url": url, "title": title, "authority": self.authority, "robots_txt_compliant": True},
            "scraping": {"scraped_at": datetime.now().isoformat(), "scraper_version": CONFIG.scraper_version},
            "whs_summary": self._generate_whs_summary(sections),
            "chapters": chapters
        }

    def _organize_into_chapters(self, sections: List[Dict], abbrev: str) -> List[Dict]:
        """Organize sections into official chapter structure (Hoofdstukken)."""
        structure = LAW_STRUCTURES.get("NL", {}).get(abbrev, [])

        if not structure:
            return [{
                "id": f"nl-{abbrev.lower()}-main",
                "number": "1",
                "title": "Hoofdinhoud",
                "title_en": "Main Content",
                "sections": sections
            }]

        chapters = []
        for chapter_def in structure:
            start, end = chapter_def["section_range"]
            chapter_sections = [
                s for s in sections
                if start <= get_section_number(s) <= end
            ]

            if chapter_sections:
                chapters.append({
                    "id": f"nl-{abbrev.lower()}-ch{chapter_def['number']}",
                    "number": chapter_def["number"],
                    "title": chapter_def["title"],
                    "title_en": chapter_def.get("title_en", ""),
                    "sections": chapter_sections
                })

        return chapters if chapters else [{
            "id": f"nl-{abbrev.lower()}-main",
            "number": "1",
            "title": "Hoofdinhoud",
            "title_en": "Main Content",
            "sections": sections
        }]

    def _generate_whs_summary(self, sections: List[Dict]) -> Dict[str, Any]:
        """Generate WHS summary statistics for the law."""
        topic_counts = {}
        relevance_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}

        for section in sections:
            for topic in section.get("whs_topics", []):
                topic_id = topic["id"]
                if topic_id not in topic_counts:
                    topic_counts[topic_id] = 0
                topic_counts[topic_id] += 1

            relevance = section.get("amazon_logistics_relevance", {})
            level = relevance.get("level", "low")
            relevance_counts[level] += 1

        sorted_topics = sorted(topic_counts.items(), key=lambda x: -x[1])

        return {
            "total_sections": len(sections),
            "logistics_relevance_distribution": relevance_counts,
            "top_whs_topics": sorted_topics[:10],
            "critical_sections_count": relevance_counts["critical"] + relevance_counts["high"]
        }


SCRAPERS = {
    'AT': ATScraper,
    'DE': DEScraper,
    'NL': NLScraper,
}


# =============================================================================
# Cleaning Module
# =============================================================================

def clean_text_with_regex(text: str, country: str) -> str:
    """Clean text using regex patterns (no AI)."""
    if not text:
        return text

    cleaned = text

    if country == 'AT':
        patterns = [
            r'Seitenbereiche:[\s\S]*?Barrierefreiheitserklärung[^\n]*',
            r'Zum Inhalt\s*\([^)]*\)',
            r'Zur Navigationsleiste\s*\([^)]*\)',
            r'Accesskey\s*\d+',
            r'Navigationsleiste:[\s\S]*?(?=§\s*\d|$)',
            r'Druckansicht\s*\([^)]*\)',
            r'Paragraph \w+,?\s*',
            r'Absatz \w+,?\s*',
        ]
    elif country == 'NL':
        patterns = [
            r'Toon relaties in LiDO\s*',
            r'Maak een permanente link\s*',
            r'Toon wetstechnische informatie\s*',
            r'Druk het regelingonderdeel af\s*',
            r'\[Wijziging\(en\)[^\]]*\]',
        ]
    elif country == 'DE':
        patterns = [
            r'Seite \d+ von \d+\s*-?\s*',
            r'Ein Service des Bundesministeriums[^\n]*',
        ]
    else:
        patterns = []

    for pattern in patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

    # Common cleanup
    cleaned = re.sub(r',\s*,', ',', cleaned)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)

    return cleaned.strip()


def clean_text_with_ai(api_key: str, text: str, title: str, country: str) -> str:
    """Clean text using Gemini AI."""
    if not text or len(text) < 100:
        return text

    system_prompt = SYSTEM_PROMPTS.get(country, SYSTEM_PROMPTS['DE'])
    prompt = f'Clean this law text for "{title}":\n\n{text[:30000]}'

    if HAS_GENAI:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=CONFIG.gemini_model,
            system_instruction=system_prompt
        )

        for attempt in range(CONFIG.max_retries):
            try:
                response = model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(temperature=0.1, max_output_tokens=8192)
                )
                return response.text
            except Exception as e:
                log_warning(f"AI attempt {attempt + 1} failed: {e}")
                if attempt < CONFIG.max_retries - 1:
                    time.sleep(2 ** attempt)

    elif HAS_REQUESTS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{CONFIG.gemini_model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 8192}
        }

        for attempt in range(CONFIG.max_retries):
            try:
                response = requests.post(url, json=payload, timeout=120)
                response.raise_for_status()
                return response.json()['candidates'][0]['content']['parts'][0]['text']
            except Exception as e:
                log_warning(f"AI attempt {attempt + 1} failed: {e}")
                if attempt < CONFIG.max_retries - 1:
                    time.sleep(2 ** attempt)

    return text


def clean_database(country: str, use_ai: bool = True, fast_mode: bool = False) -> bool:
    """Clean a country's database."""
    log_section(f"Cleaning {country} database")

    api_key = get_api_key() if use_ai else None
    if use_ai and not api_key:
        log_warning("No API key found, falling back to regex cleaning")
        use_ai = False

    db = load_database(country)
    documents = db.get('documents', [])

    if not documents:
        log_warning(f"No documents to clean for {country}")
        return False

    log_info(f"Processing {len(documents)} documents...")

    for i, doc in enumerate(documents):
        title = doc.get('abbreviation', doc.get('title', f'Doc {i+1}'))
        log_info(f"[{i+1}/{len(documents)}] Cleaning {title}...")

        # Clean full_text if present
        if doc.get('full_text'):
            if use_ai:
                doc['full_text'] = clean_text_with_ai(api_key, doc['full_text'], title, country)
            else:
                doc['full_text'] = clean_text_with_regex(doc['full_text'], country)

        # Clean sections (skip if fast_mode)
        if doc.get('chapters') and not fast_mode:
            for chapter in doc['chapters']:
                for section in chapter.get('sections', []):
                    if section.get('text'):
                        if use_ai and len(section['text']) > 500:
                            section['text'] = clean_text_with_ai(api_key, section['text'],
                                                                  section.get('title', ''), country)
                            time.sleep(0.3)  # Rate limiting
                        else:
                            section['text'] = clean_text_with_regex(section['text'], country)

        log_success(f"Cleaned {title}")

    # Update metadata
    db['metadata']['cleaned_at'] = datetime.now().isoformat()
    save_database(country, db)

    return True


# =============================================================================
# Restructuring Module
# =============================================================================

def get_section_number(section: Dict) -> float:
    """Extract numeric value from section number for sorting."""
    num_str = str(section.get("number", "0")).rstrip(".")
    if num_str and num_str[-1].isalpha():
        try:
            base = float(num_str[:-1])
            letter_offset = (ord(num_str[-1].lower()) - ord('a') + 1) * 0.01
            return base + letter_offset
        except ValueError:
            return 0
    try:
        return float(num_str)
    except ValueError:
        return 0


def normalize_section_number(num: str) -> str:
    """Normalize section number for deduplication (e.g., '1.' and '1' -> '1')."""
    return str(num).rstrip(".").strip()


def restructure_law(doc: Dict, structure: List[Dict], jurisdiction: str) -> Dict:
    """Restructure a law according to official chapter structure."""
    # Collect all sections
    all_sections = []
    for chapter in doc.get("chapters", []):
        all_sections.extend(chapter.get("sections", []))

    # Deduplicate using normalized number (keep longer text)
    seen = {}
    for section in all_sections:
        num = normalize_section_number(section.get("number", ""))
        text = section.get("text", "")
        if num not in seen or len(text) > len(seen[num].get("text", "")):
            seen[num] = section

    unique_sections = sorted(seen.values(), key=get_section_number)

    # Create new chapter structure
    new_chapters = []
    for ch in structure:
        chapter_sections = [
            s for s in unique_sections
            if ch["section_range"][0] <= get_section_number(s) <= ch["section_range"][1]
        ]

        if chapter_sections:
            new_chapters.append({
                "id": f"{jurisdiction.lower()}-{doc['abbreviation'].lower()}-ch{ch['number']}",
                "number": ch["number"],
                "title": ch["title"],
                "title_en": ch["title_en"],
                "sections": chapter_sections
            })

    doc["chapters"] = new_chapters
    return doc


def restructure_database(country: str) -> bool:
    """Restructure a country's database according to official structure."""
    log_section(f"Restructuring {country} database")

    db = load_database(country)
    structures = LAW_STRUCTURES.get(country, {})

    if not structures:
        log_warning(f"No structure definitions for {country}")
        return False

    modified = False
    for doc in db.get('documents', []):
        abbrev = doc.get('abbreviation', '')
        if abbrev in structures:
            log_info(f"Restructuring {abbrev}...")
            doc = restructure_law(doc, structures[abbrev], country)
            modified = True

            total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
            log_success(f"Created {len(doc['chapters'])} chapters with {total_sections} sections")

    if modified:
        db['metadata']['restructured_at'] = datetime.now().isoformat()
        save_database(country, db)

    return modified


# =============================================================================
# Build/Export Module
# =============================================================================

def build_master_database() -> bool:
    """Build the master database combining all countries."""
    log_section("Building master database")

    all_documents = []
    stats = {"total_documents": 0, "by_jurisdiction": {}, "by_type": {}}

    for country in ['AT', 'DE', 'NL']:
        db = load_database(country)
        documents = db.get('documents', [])
        all_documents.extend(documents)

        stats["by_jurisdiction"][country] = len(documents)
        stats["total_documents"] += len(documents)

        for doc in documents:
            doc_type = doc.get('type', 'unknown')
            stats["by_type"][doc_type] = stats["by_type"].get(doc_type, 0) + 1

    master_db = {
        "export_id": generate_id(datetime.now().isoformat()),
        "export_version": CONFIG.scraper_version,
        "exported_at": datetime.now().isoformat(),
        "statistics": stats,
        "documents": all_documents
    }

    output_path = CONFIG.base_path / "master_database.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(master_db, f, ensure_ascii=False, indent=2)

    log_success(f"Master database saved: {output_path}")
    log_info(f"Total documents: {stats['total_documents']}")

    return True


# =============================================================================
# Status Module
# =============================================================================

def show_status() -> None:
    """Show database status and statistics."""
    log_header("EU Safety Laws Database Status")

    for country in ['AT', 'DE', 'NL']:
        db_path = get_db_path(country)

        if not db_path.exists():
            print(f"\n{Colors.YELLOW}{country}: No database found{Colors.RESET}")
            continue

        db = load_database(country)
        meta = db.get('metadata', {})
        docs = db.get('documents', [])

        print(f"\n{Colors.BOLD}{country} - {['Austria', 'Germany', 'Netherlands'][['AT', 'DE', 'NL'].index(country)]}{Colors.RESET}")
        print(f"  Documents: {len(docs)}")
        print(f"  Generated: {meta.get('generated_at', 'Unknown')[:19]}")

        if meta.get('cleaned_at'):
            print(f"  Cleaned: {meta['cleaned_at'][:19]}")
        if meta.get('restructured_at'):
            print(f"  Restructured: {meta['restructured_at'][:19]}")

        # Count sections
        total_sections = 0
        total_chapters = 0
        for doc in docs:
            for chapter in doc.get('chapters', []):
                total_chapters += 1
                total_sections += len(chapter.get('sections', []))

        print(f"  Chapters: {total_chapters}")
        print(f"  Sections: {total_sections}")

        # List main laws
        main_laws = [d.get('abbreviation') for d in docs if d.get('type') == 'law']
        if main_laws:
            print(f"  Main laws: {', '.join(main_laws[:5])}")


# =============================================================================
# CLI Commands
# =============================================================================

def cmd_scrape(args) -> int:
    """Run the scrape command."""
    countries = ['AT', 'DE', 'NL'] if args.all else [args.country]

    for country in countries:
        log_header(f"Scraping {country} Laws")

        scraper_class = SCRAPERS.get(country)
        if not scraper_class:
            log_error(f"No scraper for {country}")
            continue

        scraper = scraper_class()
        documents = scraper.scrape()

        if documents:
            db = load_database(country)

            # Update or add documents
            existing_ids = {d.get('abbreviation'): i for i, d in enumerate(db['documents'])}
            for doc in documents:
                abbrev = doc.get('abbreviation')
                if abbrev in existing_ids:
                    db['documents'][existing_ids[abbrev]] = doc
                else:
                    db['documents'].append(doc)

            db['metadata']['document_count'] = len(db['documents'])
            db['metadata']['generated_at'] = datetime.now().isoformat()
            save_database(country, db)

    return 0


def cmd_clean(args) -> int:
    """Run the clean command."""
    countries = ['AT', 'DE', 'NL'] if args.all else [args.country]

    for country in countries:
        clean_database(country, use_ai=not args.no_ai, fast_mode=args.fast)

    return 0


def cmd_restructure(args) -> int:
    """Run the restructure command."""
    countries = ['AT', 'DE', 'NL'] if args.all else [args.country]

    for country in countries:
        restructure_database(country)

    return 0


def cmd_build(args) -> int:
    """Run the build command."""
    build_master_database()
    return 0


def cmd_status(args) -> int:
    """Run the status command."""
    show_status()
    return 0


def cmd_all(args) -> int:
    """Run the complete pipeline."""
    countries = ['AT', 'DE', 'NL'] if args.all else [args.country]

    log_header("Running Complete Pipeline")

    for country in countries:
        log_section(f"Processing {country}")

        # Scrape
        if not args.skip_scrape:
            log_info("Step 1: Scraping...")
            scraper = SCRAPERS.get(country, lambda: None)()
            if scraper:
                documents = scraper.scrape()
                if documents:
                    db = load_database(country)
                    existing = {d.get('abbreviation'): i for i, d in enumerate(db['documents'])}
                    for doc in documents:
                        abbrev = doc.get('abbreviation')
                        if abbrev in existing:
                            db['documents'][existing[abbrev]] = doc
                        else:
                            db['documents'].append(doc)
                    db['metadata']['generated_at'] = datetime.now().isoformat()
                    save_database(country, db)

        # Clean
        log_info("Step 2: Cleaning...")
        clean_database(country, use_ai=not args.no_ai, fast_mode=args.fast)

        # Restructure
        log_info("Step 3: Restructuring...")
        restructure_database(country)

    # Build master
    if not args.skip_build:
        log_info("Step 4: Building master database...")
        build_master_database()

    log_success("Pipeline complete!")
    return 0


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='EU Safety Laws Database Manager',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Scrape command
    scrape_parser = subparsers.add_parser('scrape', help='Scrape laws from official sources')
    scrape_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to scrape')
    scrape_parser.add_argument('--all', action='store_true', help='Scrape all countries')

    # Clean command
    clean_parser = subparsers.add_parser('clean', help='Clean scraped content')
    clean_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to clean')
    clean_parser.add_argument('--all', action='store_true', help='Clean all countries')
    clean_parser.add_argument('--no-ai', action='store_true', help='Use regex only, no AI')
    clean_parser.add_argument('--fast', action='store_true', help='Fast mode: AI for full_text only')

    # Restructure command
    restructure_parser = subparsers.add_parser('restructure', help='Restructure into official chapters')
    restructure_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to restructure')
    restructure_parser.add_argument('--all', action='store_true', help='Restructure all countries')

    # Build command
    build_parser = subparsers.add_parser('build', help='Build master database')

    # Status command
    status_parser = subparsers.add_parser('status', help='Show database status')

    # All command (complete pipeline)
    all_parser = subparsers.add_parser('all', help='Run complete pipeline')
    all_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to process')
    all_parser.add_argument('--all', action='store_true', help='Process all countries')
    all_parser.add_argument('--no-ai', action='store_true', help='Use regex only, no AI')
    all_parser.add_argument('--fast', action='store_true', help='Fast cleaning mode')
    all_parser.add_argument('--skip-scrape', action='store_true', help='Skip scraping step')
    all_parser.add_argument('--skip-build', action='store_true', help='Skip master database build')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Validate country selection
    if args.command in ['scrape', 'clean', 'restructure', 'all']:
        if not getattr(args, 'all', False) and not getattr(args, 'country', None):
            print(f"Error: --country or --all is required for {args.command}")
            return 1

    # Run command
    commands = {
        'scrape': cmd_scrape,
        'clean': cmd_clean,
        'restructure': cmd_restructure,
        'build': cmd_build,
        'status': cmd_status,
        'all': cmd_all,
    }

    return commands[args.command](args)


if __name__ == '__main__':
    sys.exit(main())

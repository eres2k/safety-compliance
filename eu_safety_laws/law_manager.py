#!/usr/bin/env python3
"""
EU Safety Laws Database Manager
===============================

A unified CLI tool for managing EU safety law databases (AT, DE, NL).

Commands:
    scrape        - Scrape laws from official government sources
    check-updates - Check which laws have changed since last scrape
    clean         - Clean scraped content using AI (Gemini) or regex
    restructure   - Reorganize laws into official chapter structure
    build         - Build/export the complete database
    status        - Show database status and statistics
    all           - Run complete pipeline: scrape -> clean -> restructure -> build

Usage:
    # Basic scraping
    python law_manager.py scrape --country AT
    python law_manager.py scrape --country AT --laws 3    # Fetch 3 laws for AT
    python law_manager.py scrape --all --laws 5           # Fetch 5 laws per country

    # Interactive menu to select laws
    python law_manager.py scrape --country AT --menu      # Show menu to select laws
    python law_manager.py scrape --country DE --menu --check-updates  # Menu with update status

    # Check for and apply updates
    python law_manager.py check-updates --country AT      # Show which AT laws changed
    python law_manager.py check-updates --all             # Check all countries
    python law_manager.py scrape --country AT --check-updates  # Only scrape changed laws

    # Select specific laws
    python law_manager.py scrape --country AT --select ASchG,AZG  # Scrape specific laws

    # Other commands
    python law_manager.py clean --all --fast
    python law_manager.py restructure --all
    python law_manager.py build
    python law_manager.py status
    python law_manager.py all --country DE --laws 2       # Full pipeline with 2 laws

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
    scraper_version: str = "7.2.0"  # Updated for parallel processing
    request_timeout: int = 30
    rate_limit_delay: float = 0.1  # Reduced from 0.5s - Gemini supports 2K RPM
    max_retries: int = 3
    gemini_model: str = "gemini-2.0-flash"
    # Parallel processing settings (optimized for Gemini 2K RPM / 4M TPM limits)
    max_parallel_scrapes: int = 4  # Concurrent law scrapes
    max_parallel_ai_requests: int = 10  # Concurrent AI requests
    ai_rate_limit_delay: float = 0.05  # 50ms between AI batches (allows ~1200 RPM with margin)

    # Source URLs - laws are ordered by relevance (first = most important)
    sources: Dict[str, Dict[str, str]] = field(default_factory=lambda: {
        "AT": {
            "base_url": "https://www.ris.bka.gv.at",
            "authority": "RIS",
            "main_laws": {
                "ASchG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910",      # Worker Protection Act
                "AZG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008238",        # Working Time Act
                "ARG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008374",        # Rest Period Act
                "MSchG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008464",      # Maternity Protection Act
                "KJBG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008632",       # Child and Youth Employment Act
                "AStV": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001927",       # Workplace Regulation
                "AM-VO": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001933",      # Work Equipment Regulation
                "DOK-VO": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001602",     # Documentation Regulation
            }
        },
        "DE": {
            "base_url": "https://www.gesetze-im-internet.de",
            "authority": "gesetze-im-internet.de",
            "main_laws": {
                "ArbSchG": "/arbschg/",           # Occupational Safety Act
                "ASiG": "/asig/",                 # Workplace Safety Act
                "ArbZG": "/arbzg/",               # Working Time Act
                "MuSchG": "/muschg/",             # Maternity Protection Act
                "JArbSchG": "/jarbschg/",         # Youth Labor Protection Act
                "ArbStättV": "/arbst_ttv_2004/",  # Workplace Ordinance
                "BetrSichV": "/betrsichv_2015/",  # Industrial Safety Regulation
                "GefStoffV": "/gefstoffv_2010/",  # Hazardous Substances Ordinance
            }
        },
        "NL": {
            "base_url": "https://wetten.overheid.nl",
            "authority": "wetten.overheid.nl",
            "main_laws": {
                "Arbowet": "/BWBR0010346/geldend",           # Working Conditions Act
                "Arbobesluit": "/BWBR0008498/geldend",      # Working Conditions Decree
                "Arboregeling": "/BWBR0008587/geldend",    # Working Conditions Regulation
                "Arbeidstijdenwet": "/BWBR0007671/geldend", # Working Time Act
                "ATB": "/BWBR0007687/geldend",              # Working Time Decree
            }
        }
    })


CONFIG = Config()

# Custom sources configuration file
CUSTOM_SOURCES_FILE = CONFIG.base_path / "custom_sources.json"


def load_custom_sources() -> Dict[str, Any]:
    """Load custom sources configuration from file."""
    default = {
        "version": "1.0",
        "enabled_sources": {},  # country -> [enabled law abbreviations]
        "disabled_sources": {},  # country -> [disabled law abbreviations]
        "custom_sources": {},  # country -> {abbr: {url, name, description, enabled}}
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

    if CUSTOM_SOURCES_FILE.exists():
        try:
            with open(CUSTOM_SOURCES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Ensure all required keys exist
                for key in default:
                    if key not in data:
                        data[key] = default[key]
                return data
        except Exception:
            pass
    return default


def save_custom_sources(data: Dict[str, Any]) -> bool:
    """Save custom sources configuration to file."""
    try:
        data["updated_at"] = datetime.now().isoformat()
        with open(CUSTOM_SOURCES_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        log_error(f"Failed to save custom sources: {e}")
        return False


def get_enabled_sources(country: str) -> Dict[str, str]:
    """Get enabled sources for a country (built-in + custom, minus disabled)."""
    custom_data = load_custom_sources()

    # Start with built-in sources
    sources = dict(CONFIG.sources.get(country, {}).get("main_laws", {}))

    # Remove disabled sources
    disabled = custom_data.get("disabled_sources", {}).get(country, [])
    for abbr in disabled:
        sources.pop(abbr, None)

    # Add custom enabled sources
    custom = custom_data.get("custom_sources", {}).get(country, {})
    for abbr, info in custom.items():
        if info.get("enabled", True):
            sources[abbr] = info.get("url", "")

    return sources


def is_source_enabled(country: str, abbr: str) -> bool:
    """Check if a specific source is enabled."""
    custom_data = load_custom_sources()

    # Check if explicitly disabled
    disabled = custom_data.get("disabled_sources", {}).get(country, [])
    if abbr in disabled:
        return False

    # Check if it's a custom source
    custom = custom_data.get("custom_sources", {}).get(country, {})
    if abbr in custom:
        return custom[abbr].get("enabled", True)

    # Built-in sources are enabled by default
    return abbr in CONFIG.sources.get(country, {}).get("main_laws", {})


def toggle_source(country: str, abbr: str, enabled: bool) -> bool:
    """Enable or disable a source."""
    custom_data = load_custom_sources()

    # Check if it's a custom source
    if country in custom_data.get("custom_sources", {}) and abbr in custom_data["custom_sources"][country]:
        custom_data["custom_sources"][country][abbr]["enabled"] = enabled
    else:
        # Handle built-in sources
        if country not in custom_data["disabled_sources"]:
            custom_data["disabled_sources"][country] = []

        if enabled:
            # Remove from disabled list
            if abbr in custom_data["disabled_sources"][country]:
                custom_data["disabled_sources"][country].remove(abbr)
        else:
            # Add to disabled list
            if abbr not in custom_data["disabled_sources"][country]:
                custom_data["disabled_sources"][country].append(abbr)

    return save_custom_sources(custom_data)


def add_custom_source(country: str, abbr: str, url: str, name: str, description: str = "") -> bool:
    """Add a new custom source."""
    custom_data = load_custom_sources()

    if country not in custom_data["custom_sources"]:
        custom_data["custom_sources"][country] = {}

    custom_data["custom_sources"][country][abbr] = {
        "url": url,
        "name": name,
        "description": description,
        "enabled": True,
        "created_at": datetime.now().isoformat(),
        "source_type": "custom"
    }

    return save_custom_sources(custom_data)


def remove_custom_source(country: str, abbr: str) -> bool:
    """Remove a custom source."""
    custom_data = load_custom_sources()

    if country in custom_data.get("custom_sources", {}) and abbr in custom_data["custom_sources"][country]:
        del custom_data["custom_sources"][country][abbr]
        return save_custom_sources(custom_data)

    return False


def get_all_sources_with_status(country: str) -> List[Dict[str, Any]]:
    """Get all sources (built-in and custom) with their status."""
    custom_data = load_custom_sources()
    sources = []

    # Law names for display
    law_names = {
        "ASchG": "Worker Protection Act",
        "AZG": "Working Time Act",
        "ARG": "Rest Period Act",
        "MSchG": "Maternity Protection Act",
        "KJBG": "Child and Youth Employment Act",
        "AStV": "Workplace Regulation",
        "AM-VO": "Work Equipment Regulation",
        "DOK-VO": "Documentation Regulation",
        "ArbSchG": "Occupational Safety Act",
        "ASiG": "Workplace Safety Act",
        "MuSchG": "Maternity Protection Act",
        "JArbSchG": "Youth Labor Protection Act",
        "ArbStättV": "Workplace Ordinance",
        "BetrSichV": "Industrial Safety Regulation",
        "GefStoffV": "Hazardous Substances Ordinance",
        "Arbowet": "Working Conditions Act",
        "Arbobesluit": "Working Conditions Decree",
        "Arboregeling": "Working Conditions Regulation",
        "Arbeidstijdenwet": "Working Time Act",
        "ATB": "Working Time Decree",
    }

    # Built-in sources
    builtin = CONFIG.sources.get(country, {}).get("main_laws", {})
    disabled = custom_data.get("disabled_sources", {}).get(country, [])

    for abbr, url in builtin.items():
        sources.append({
            "abbr": abbr,
            "name": law_names.get(abbr, abbr),
            "url": url,
            "enabled": abbr not in disabled,
            "type": "built-in",
            "description": ""
        })

    # Custom sources
    custom = custom_data.get("custom_sources", {}).get(country, {})
    for abbr, info in custom.items():
        sources.append({
            "abbr": abbr,
            "name": info.get("name", abbr),
            "url": info.get("url", ""),
            "enabled": info.get("enabled", True),
            "type": "custom",
            "description": info.get("description", "")
        })

    return sources


def suggest_sources_with_ai(country: str, topic: str) -> Optional[List[Dict[str, Any]]]:
    """Use AI to suggest additional sources based on a topic."""
    if not HAS_GENAI:
        log_error("google-generativeai package required for AI suggestions")
        return None

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        log_error("GEMINI_API_KEY environment variable required")
        return None

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(CONFIG.gemini_model)

        country_names = {"AT": "Austria", "DE": "Germany", "NL": "Netherlands"}
        country_name = country_names.get(country, country)

        prompt = f"""You are an expert in European workplace safety and health regulations.

I need to find official government sources for workplace safety laws related to "{topic}" in {country_name}.

Current sources we already have for {country}:
{json.dumps(list(CONFIG.sources.get(country, {}).get('main_laws', {}).keys()), indent=2)}

Please suggest 1-3 additional official government sources that:
1. Are from official government websites (not third-party)
2. Relate to workplace safety, health, or the specific topic
3. Are actually accessible and scrapeable
4. Have not been listed above

Return your response as a JSON array with this format:
[
  {{
    "abbr": "short abbreviation",
    "name": "Full name of the law/regulation",
    "url": "full URL to the official source",
    "description": "Brief description of what it covers",
    "relevance": "high/medium/low"
  }}
]

If no additional relevant sources exist, return an empty array [].
Only return the JSON array, no other text."""

        response = model.generate_content(prompt)
        text = response.text.strip()

        # Extract JSON from response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        suggestions = json.loads(text)
        return suggestions if isinstance(suggestions, list) else []

    except Exception as e:
        log_error(f"AI suggestion failed: {e}")
        return None


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


def generate_content_hash(doc: Dict[str, Any]) -> str:
    """Generate a content hash for update detection.

    This hash is based on the actual law content (sections text),
    not metadata like scrape timestamps. Used to detect when
    law content has actually changed.
    """
    content_parts = []

    # Include chapter/section text in hash
    for chapter in doc.get('chapters', []):
        for section in chapter.get('sections', []):
            content_parts.append(section.get('text', ''))

    # Also include full_text if present
    if doc.get('full_text'):
        content_parts.append(doc['full_text'])

    # Create a stable hash of all content
    content = ''.join(content_parts)
    return hashlib.sha256(content.encode()).hexdigest()[:32]


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


def get_law_names(country: str) -> Dict[str, str]:
    """Get dictionary of law abbreviations and their full names for a country."""
    law_names = {
        "AT": {
            "ASchG": "ArbeitnehmerInnenschutzgesetz (Worker Protection Act)",
            "AZG": "Arbeitszeitgesetz (Working Time Act)",
            "ARG": "Arbeitsruhegesetz (Rest Period Act)",
            "MSchG": "Mutterschutzgesetz (Maternity Protection Act)",
            "KJBG": "Kinder- und Jugendlichenbeschäftigungsgesetz (Youth Employment)",
            "AStV": "Arbeitsstättenverordnung (Workplace Regulation)",
            "AM-VO": "Arbeitsmittelverordnung (Work Equipment Regulation)",
            "DOK-VO": "Dokumentationsverordnung (Documentation Regulation)",
        },
        "DE": {
            "ArbSchG": "Arbeitsschutzgesetz (Occupational Safety Act)",
            "ASiG": "Arbeitssicherheitsgesetz (Workplace Safety Act)",
            "ArbZG": "Arbeitszeitgesetz (Working Time Act)",
            "MuSchG": "Mutterschutzgesetz (Maternity Protection Act)",
            "JArbSchG": "Jugendarbeitsschutzgesetz (Youth Labor Protection)",
            "ArbStättV": "Arbeitsstättenverordnung (Workplace Ordinance)",
            "BetrSichV": "Betriebssicherheitsverordnung (Industrial Safety)",
            "GefStoffV": "Gefahrstoffverordnung (Hazardous Substances)",
        },
        "NL": {
            "Arbowet": "Arbeidsomstandighedenwet (Working Conditions Act)",
            "Arbobesluit": "Arbeidsomstandighedenbesluit (Working Conditions Decree)",
            "Arboregeling": "Arbeidsomstandighedenregeling (Working Conditions Reg.)",
            "Arbeidstijdenwet": "Arbeidstijdenwet (Working Time Act)",
            "ATB": "Arbeidstijdenbesluit (Working Time Decree)",
        }
    }
    return law_names.get(country, {})


def check_for_updates(country: str) -> Dict[str, Any]:
    """Check which laws have updates available.

    Compares content hashes of freshly scraped laws against stored ones.
    Returns dict with 'new', 'updated', and 'unchanged' law lists.
    """
    if not HAS_REQUESTS or not HAS_BS4:
        log_error("requests and beautifulsoup4 required for update checking")
        return {"new": [], "updated": [], "unchanged": [], "error": True}

    db = load_database(country)
    existing_docs = {d.get('abbreviation'): d for d in db.get('documents', [])}

    scraper_class = SCRAPERS.get(country)
    if not scraper_class:
        return {"new": [], "updated": [], "unchanged": [], "error": True}

    results = {"new": [], "updated": [], "unchanged": []}

    main_laws = list(CONFIG.sources.get(country, {}).get('main_laws', {}).items())
    log_info(f"Checking {len(main_laws)} {country} laws for updates...")

    pbar = create_progress_bar(len(main_laws), f"Checking {country}")

    for abbrev, path in main_laws:
        pbar.set_description(f"Checking {abbrev}")

        # Quick fetch to check for changes
        scraper = scraper_class(law_limit=1)
        url = urljoin(scraper.base_url, path)
        html = scraper.fetch_url(url)

        if html:
            # Parse the law to get content hash
            if country == "AT":
                doc = scraper._parse_ris_law_full(html, abbrev, url)
            elif country == "DE":
                doc = scraper._parse_german_law_full(html, abbrev, url)
            elif country == "NL":
                doc = scraper._parse_dutch_law_full(html, abbrev, url)
            else:
                doc = None

            if doc:
                new_hash = doc.get('content_hash', '')
                existing_doc = existing_docs.get(abbrev)

                if not existing_doc:
                    results['new'].append({
                        'abbreviation': abbrev,
                        'sections': doc.get('whs_summary', {}).get('total_sections', 0)
                    })
                elif existing_doc.get('content_hash') != new_hash:
                    results['updated'].append({
                        'abbreviation': abbrev,
                        'old_hash': existing_doc.get('content_hash', 'N/A')[:8],
                        'new_hash': new_hash[:8],
                        'last_scraped': existing_doc.get('scraping', {}).get('scraped_at', 'N/A')[:10]
                    })
                else:
                    results['unchanged'].append({
                        'abbreviation': abbrev,
                        'hash': new_hash[:8]
                    })

        time.sleep(CONFIG.rate_limit_delay)
        pbar.update(1)

    pbar.close()
    return results


def interactive_law_menu(country: str, check_updates: bool = False) -> List[str]:
    """Display an interactive menu for selecting laws to scrape.

    Args:
        country: Country code (AT, DE, NL)
        check_updates: If True, show update status alongside each law

    Returns:
        List of law abbreviations selected by user
    """
    main_laws = list(CONFIG.sources.get(country, {}).get('main_laws', {}).keys())
    law_names = get_law_names(country)
    db = load_database(country)
    existing_docs = {d.get('abbreviation'): d for d in db.get('documents', [])}

    update_info = {}
    if check_updates:
        log_info("Checking for updates (this may take a moment)...")
        update_results = check_for_updates(country)
        for item in update_results.get('new', []):
            update_info[item['abbreviation']] = ('NEW', Colors.GREEN)
        for item in update_results.get('updated', []):
            update_info[item['abbreviation']] = ('UPDATE', Colors.YELLOW)
        for item in update_results.get('unchanged', []):
            update_info[item['abbreviation']] = ('OK', Colors.DIM)

    print(f"\n{Colors.CYAN}{'=' * 60}{Colors.RESET}")
    print(f"{Colors.BOLD}Select {country} Laws to Scrape{Colors.RESET}")
    print(f"{Colors.CYAN}{'=' * 60}{Colors.RESET}\n")

    # Display laws with numbers
    for i, abbrev in enumerate(main_laws, 1):
        name = law_names.get(abbrev, abbrev)
        existing = existing_docs.get(abbrev)
        status_parts = []

        # Show if already in database
        if existing:
            scraped_at = existing.get('scraping', {}).get('scraped_at', '')[:10]
            sections = existing.get('whs_summary', {}).get('total_sections', 0)
            status_parts.append(f"{Colors.DIM}[{sections} sections, scraped {scraped_at}]{Colors.RESET}")
        else:
            status_parts.append(f"{Colors.DIM}[not scraped]{Colors.RESET}")

        # Show update status if available
        if abbrev in update_info:
            status_text, color = update_info[abbrev]
            status_parts.append(f"{color}[{status_text}]{Colors.RESET}")

        status = ' '.join(status_parts)
        print(f"  {Colors.BOLD}{i:2}{Colors.RESET}. {abbrev:12} - {name}")
        if status:
            print(f"      {status}")

    print(f"\n{Colors.CYAN}{'-' * 60}{Colors.RESET}")
    print(f"  {Colors.BOLD} a{Colors.RESET}. Select ALL laws")
    print(f"  {Colors.BOLD} u{Colors.RESET}. Select only laws with UPDATES (requires check)")
    print(f"  {Colors.BOLD} n{Colors.RESET}. Select only NEW laws (not yet scraped)")
    print(f"  {Colors.BOLD} q{Colors.RESET}. Quit (cancel)")
    print(f"{Colors.CYAN}{'-' * 60}{Colors.RESET}")
    print(f"\n{Colors.DIM}Enter numbers separated by commas (e.g., 1,3,5) or a/u/n/q:{Colors.RESET}")

    while True:
        try:
            user_input = input(f"{Colors.CYAN}> {Colors.RESET}").strip().lower()

            if user_input == 'q':
                return []

            if user_input == 'a':
                return main_laws

            if user_input == 'u':
                # Select only updated laws
                if not update_info:
                    log_warning("No update check performed. Running check now...")
                    update_results = check_for_updates(country)
                    updated = [item['abbreviation'] for item in update_results.get('updated', [])]
                    new = [item['abbreviation'] for item in update_results.get('new', [])]
                    return updated + new
                else:
                    return [abbrev for abbrev, (status, _) in update_info.items()
                            if status in ('UPDATE', 'NEW')]

            if user_input == 'n':
                # Select only new (not yet scraped) laws
                return [abbrev for abbrev in main_laws if abbrev not in existing_docs]

            # Parse comma-separated numbers
            selections = []
            for part in user_input.replace(' ', '').split(','):
                if '-' in part:
                    # Handle ranges like 1-3
                    start, end = map(int, part.split('-'))
                    selections.extend(range(start, end + 1))
                else:
                    selections.append(int(part))

            # Validate and convert to abbreviations
            selected_laws = []
            for num in selections:
                if 1 <= num <= len(main_laws):
                    selected_laws.append(main_laws[num - 1])
                else:
                    log_warning(f"Invalid selection: {num}")

            if selected_laws:
                return selected_laws

            log_warning("No valid selections. Try again.")

        except ValueError:
            log_warning("Invalid input. Enter numbers, 'a', 'u', 'n', or 'q'.")
        except KeyboardInterrupt:
            print()
            return []


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

    def __init__(self, country: str, law_limit: int = None):
        self.country = country
        self.config = CONFIG.sources.get(country, {})
        self.base_url = self.config.get('base_url', '')
        self.authority = self.config.get('authority', '')
        # Number of laws to fetch (None = all)
        self.law_limit = law_limit

        # Merge custom sources into config's main_laws
        self._merge_custom_sources()

    def _merge_custom_sources(self):
        """Merge custom sources into the config's main_laws and respect enabled/disabled state."""
        custom_data = load_custom_sources()
        custom_sources = custom_data.get("custom_sources", {}).get(self.country, {})
        disabled_sources = custom_data.get("disabled_sources", {}).get(self.country, [])

        # Create a copy of main_laws to avoid modifying CONFIG
        if 'main_laws' in self.config:
            self.config = dict(self.config)
            self.config['main_laws'] = dict(self.config['main_laws'])
        else:
            self.config['main_laws'] = {}

        # Remove disabled built-in sources
        for abbr in disabled_sources:
            self.config['main_laws'].pop(abbr, None)

        # Add enabled custom sources
        for abbr, info in custom_sources.items():
            if info.get("enabled", True):
                self.config['main_laws'][abbr] = info.get("url", "")

    def _get_full_url(self, path: str) -> str:
        """Get full URL, handling both relative paths and absolute URLs."""
        if path.startswith('http://') or path.startswith('https://'):
            return path
        return urljoin(self.base_url, path)

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

    def __init__(self, law_limit: int = None):
        super().__init__('AT', law_limit)

    def _scrape_single_law(self, abbrev: str, path: str) -> Optional[Dict[str, Any]]:
        """Scrape a single law - used for parallel processing."""
        log_info(f"Scraping {abbrev} with full text extraction...")
        url = self._get_full_url(path)
        html = self.fetch_url(url)

        if html:
            doc = self._parse_ris_law_full(html, abbrev, url)
            if doc:
                total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
                log_success(f"Scraped {abbrev}: {total_sections} sections with full text")
                return doc
        return None

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape Austrian laws from RIS with full text extraction and parallel processing."""
        if not HAS_BS4:
            log_error("BeautifulSoup required for scraping. Install with: pip install beautifulsoup4")
            return []

        documents = []
        main_laws = dict(self.config.get('main_laws', {}))

        # Support for selected_laws attribute (from menu or --select)
        if hasattr(self, 'selected_laws') and self.selected_laws:
            laws_to_fetch = [(abbrev, main_laws[abbrev]) for abbrev in self.selected_laws if abbrev in main_laws]
        elif self.law_limit:
            laws_to_fetch = list(main_laws.items())[:self.law_limit]
        else:
            laws_to_fetch = list(main_laws.items())

        log_info(f"Fetching {len(laws_to_fetch)} of {len(main_laws)} available AT laws (parallel: {CONFIG.max_parallel_scrapes} workers)")

        # Use parallel processing for faster scraping
        with concurrent.futures.ThreadPoolExecutor(max_workers=CONFIG.max_parallel_scrapes) as executor:
            # Submit all scraping tasks
            future_to_abbrev = {
                executor.submit(self._scrape_single_law, abbrev, path): abbrev
                for abbrev, path in laws_to_fetch
            }

            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_abbrev):
                abbrev = future_to_abbrev[future]
                try:
                    doc = future.result()
                    if doc:
                        documents.append(doc)
                except Exception as e:
                    log_error(f"Failed to scrape {abbrev}: {e}")

        log_success(f"Completed scraping {len(documents)} AT laws")
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

    def _extract_toc_titles(self, soup) -> Dict[str, str]:
        """Extract section titles from the RIS table of contents (Inhaltsverzeichnis).

        The RIS page has a table of contents that maps § numbers to their titles.
        Structure: <td>§ 40.</td><td>Gefährliche Arbeitsstoffe</td>
        """
        toc_titles = {}

        # Find the table of contents (class InhaltEintrag entries)
        for row in soup.find_all('tr'):
            cells = row.find_all('td')
            if len(cells) >= 2:
                first_cell = cells[0].get_text(strip=True)
                # Match § followed by number (e.g., "§ 40." or "§ 40a.")
                match = re.match(r'§\s*(\d+[a-z]?)\.?', first_cell)
                if match:
                    section_num = match.group(1)
                    # Get title from second cell
                    title_text = cells[1].get_text(strip=True)
                    if title_text and len(title_text) > 1:
                        toc_titles[section_num] = title_text

        return toc_titles

    def _parse_ris_law_full(self, html: str, abbrev: str, url: str) -> Optional[Dict[str, Any]]:
        """Parse an Austrian law from RIS HTML with full text extraction."""
        soup = BeautifulSoup(html, 'html.parser')

        # Extract title
        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else abbrev

        # FIRST: Extract titles from the table of contents (Inhaltsverzeichnis)
        toc_titles = self._extract_toc_titles(soup)
        if toc_titles:
            log_info(f"  Found {len(toc_titles)} section titles in table of contents")

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

                # Get title from table of contents (primary source)
                section_title = toc_titles.get(section_num, "")

                # Fallback: try to find title from following h3, h4, or h5 if not in TOC
                if not section_title:
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
                    "text": full_text[:50000],  # Increased limit for full text
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

                    # Collect content - use sibling iteration to avoid mixing sections
                    content_parts = []
                    # Iterate through siblings after the h4 until we hit another section header
                    for sibling in h4.find_next_siblings():
                        # Stop at next section header (h2, h3, h4 with §)
                        if sibling.name in ['h2', 'h3', 'h4']:
                            sib_text = sibling.get_text(strip=True)
                            if re.search(r'§\s*\d+', sib_text):
                                break
                        # Extract text from paragraphs and list items
                        if sibling.name in ['p', 'li', 'div']:
                            elem_text = sibling.get_text(strip=True)
                            if elem_text and len(elem_text) > 10:
                                content_parts.append(elem_text)
                        elif sibling.name in ['ol', 'ul']:
                            for li in sibling.find_all('li'):
                                li_text = li.get_text(strip=True)
                                if li_text and len(li_text) > 10:
                                    content_parts.append(li_text)

                    full_text = '\n\n'.join(content_parts)
                    whs_topics = self._classify_whs_topics(full_text, section_title)

                    sections.append({
                        "id": generate_id(f"{abbrev}-{section_num}"),
                        "number": section_num,
                        "title": f"§ {section_num}. {section_title}".strip().rstrip('.'),
                        "text": full_text[:50000],
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
                        "text": full_text[:50000],
                        "whs_topics": whs_topics,
                        "amazon_logistics_relevance": self._calculate_logistics_relevance(full_text, ""),
                        "paragraphs": []
                    })

        # Sort sections by number
        sections.sort(key=lambda s: get_section_number(s))

        # Organize into official chapter structure
        chapters = self._organize_into_chapters(sections, abbrev)

        doc = {
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
        # Add content hash for update detection
        doc["content_hash"] = generate_content_hash(doc)
        return doc

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

    def __init__(self, law_limit: int = None):
        super().__init__('DE', law_limit)

    def _scrape_single_law(self, abbrev: str, path: str) -> Optional[Dict[str, Any]]:
        """Scrape a single law - used for parallel processing."""
        log_info(f"Scraping {abbrev} with full text extraction...")
        url = self._get_full_url(path)
        html = self.fetch_url(url)

        if html:
            doc = self._parse_german_law_full(html, abbrev, url)
            if doc:
                total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
                log_success(f"Scraped {abbrev}: {total_sections} sections with full text")
                return doc
        return None

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape German laws with full text extraction and parallel processing."""
        if not HAS_BS4:
            log_error("BeautifulSoup required. Install with: pip install beautifulsoup4")
            return []

        documents = []
        main_laws = dict(self.config.get('main_laws', {}))

        # Support for selected_laws attribute (from menu or --select)
        if hasattr(self, 'selected_laws') and self.selected_laws:
            laws_to_fetch = [(abbrev, main_laws[abbrev]) for abbrev in self.selected_laws if abbrev in main_laws]
        elif self.law_limit:
            laws_to_fetch = list(main_laws.items())[:self.law_limit]
        else:
            laws_to_fetch = list(main_laws.items())

        log_info(f"Fetching {len(laws_to_fetch)} of {len(main_laws)} available DE laws (parallel: {CONFIG.max_parallel_scrapes} workers)")

        # Use parallel processing for faster scraping
        with concurrent.futures.ThreadPoolExecutor(max_workers=CONFIG.max_parallel_scrapes) as executor:
            future_to_abbrev = {
                executor.submit(self._scrape_single_law, abbrev, path): abbrev
                for abbrev, path in laws_to_fetch
            }

            for future in concurrent.futures.as_completed(future_to_abbrev):
                abbrev = future_to_abbrev[future]
                try:
                    doc = future.result()
                    if doc:
                        documents.append(doc)
                except Exception as e:
                    log_error(f"Failed to scrape {abbrev}: {e}")

        log_success(f"Completed scraping {len(documents)} DE laws")
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
            # Collect all paragraphs (Absätze) for each section
            for div in soup.find_all('div', class_='jurAbsatz'):
                # Find the section number from nearby header
                header = div.find_previous(['h2', 'h3', 'h4'])
                if header:
                    header_text = header.get_text(strip=True)
                    match = re.search(r'§\s*(\d+[a-z]?)', header_text)
                    if match:
                        section_num = match.group(1)
                        content = div.get_text(separator='\n', strip=True)
                        # Append to existing content instead of replacing
                        # This ensures all paragraphs (1), (2), etc. are captured
                        if section_num in section_contents:
                            section_contents[section_num] += '\n\n' + content
                        else:
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
                "text": content[:50000] if content else link_info["title"],
                "whs_topics": whs_topics,
                "amazon_logistics_relevance": logistics_relevance,
                "paragraphs": []
            })

        # Sort and organize into chapters
        sections.sort(key=lambda s: get_section_number(s))
        chapters = self._organize_into_chapters(sections, abbrev)

        doc = {
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
        # Add content hash for update detection
        doc["content_hash"] = generate_content_hash(doc)
        return doc

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

    def __init__(self, law_limit: int = None):
        super().__init__('NL', law_limit)

    def _scrape_single_law(self, abbrev: str, path: str) -> Optional[Dict[str, Any]]:
        """Scrape a single law - used for parallel processing."""
        log_info(f"Scraping {abbrev} with full text extraction...")
        url = self._get_full_url(path)
        html = self.fetch_url(url)

        if html:
            doc = self._parse_dutch_law_full(html, abbrev, url)
            if doc:
                total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
                log_success(f"Scraped {abbrev}: {total_sections} articles with full text")
                return doc
        return None

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape Dutch laws with full text extraction and parallel processing."""
        if not HAS_BS4:
            log_error("BeautifulSoup required. Install with: pip install beautifulsoup4")
            return []

        documents = []
        main_laws = dict(self.config.get('main_laws', {}))

        # Support for selected_laws attribute (from menu or --select)
        if hasattr(self, 'selected_laws') and self.selected_laws:
            laws_to_fetch = [(abbrev, main_laws[abbrev]) for abbrev in self.selected_laws if abbrev in main_laws]
        elif self.law_limit:
            laws_to_fetch = list(main_laws.items())[:self.law_limit]
        else:
            laws_to_fetch = list(main_laws.items())

        log_info(f"Fetching {len(laws_to_fetch)} of {len(main_laws)} available NL laws (parallel: {CONFIG.max_parallel_scrapes} workers)")

        # Use parallel processing for faster scraping
        with concurrent.futures.ThreadPoolExecutor(max_workers=CONFIG.max_parallel_scrapes) as executor:
            future_to_abbrev = {
                executor.submit(self._scrape_single_law, abbrev, path): abbrev
                for abbrev, path in laws_to_fetch
            }

            for future in concurrent.futures.as_completed(future_to_abbrev):
                abbrev = future_to_abbrev[future]
                try:
                    doc = future.result()
                    if doc:
                        documents.append(doc)
                except Exception as e:
                    log_error(f"Failed to scrape {abbrev}: {e}")

        log_success(f"Completed scraping {len(documents)} NL laws")
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

            # Extract content from ul with artikel_leden class or list--law class
            content_parts = []

            # Find all content ULs - look for class containing 'artikel_leden' or 'list--law'
            content_uls = []
            for ul in container.find_all('ul'):
                ul_classes = ul.get('class', [])
                if ul_classes:
                    class_str = ' '.join(ul_classes) if isinstance(ul_classes, list) else ul_classes
                    if 'artikel_leden' in class_str or 'list--law' in class_str:
                        content_uls.append(ul)

            # Extract content from these ULs
            for ul in content_uls:
                # Get ALL paragraphs within these content ULs
                for p in ul.find_all('p', recursive=True):
                    p_classes = p.get('class', [])
                    class_str = ' '.join(p_classes) if isinstance(p_classes, list) else (p_classes or '')

                    # Skip action-related paragraphs
                    if 'action' in class_str.lower():
                        continue

                    p_text = p.get_text(separator=' ', strip=True)
                    if p_text and len(p_text) > 5:
                        # Remove lid number prefixes like "1 " at start
                        p_text = re.sub(r'^\d+[a-z]?\s+', '', p_text)
                        p_text = re.sub(r'\s+', ' ', p_text)
                        content_parts.append(p_text)

            # If no content found via ULs, try direct paragraph extraction
            if not content_parts:
                # Find all paragraphs directly in the container (outside header)
                for p in container.find_all('p', recursive=True):
                    # Skip header elements
                    parent = p.find_parent(['div'])
                    if parent:
                        parent_classes = ' '.join(parent.get('class', []) if parent.get('class') else [])
                        if 'header' in parent_classes.lower():
                            continue

                    p_text = p.get_text(separator=' ', strip=True)
                    if p_text and len(p_text) > 10:
                        p_text = re.sub(r'\s+', ' ', p_text)
                        content_parts.append(p_text)

            # Also check li elements for content
            for li in container.find_all('li', recursive=True):
                # Skip action list items
                li_classes = li.get('class', [])
                class_str = ' '.join(li_classes) if isinstance(li_classes, list) else (li_classes or '')
                if 'action' in class_str.lower():
                    continue

                # Get direct text (not from nested elements already captured)
                li_text = li.get_text(separator=' ', strip=True)
                if li_text and len(li_text) > 10:
                    li_text = re.sub(r'\s+', ' ', li_text)
                    content_parts.append(li_text)

            # Deduplicate while preserving order (nested li may duplicate)
            # Use full text hash to avoid losing similar-starting but different paragraphs
            seen_parts = set()
            unique_parts = []
            for part in content_parts:
                # Use hash of full text to properly identify duplicates
                key = hash(part.strip().lower())
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

            # Check if this is a repealed article (Vervallen = repealed in Dutch)
            is_repealed = False
            repealed_text = ""
            # Look for header div with various class patterns (article__header, header--law, etc.)
            header_div = container.find('div', class_=lambda c: c and any('header' in cls.lower() for cls in c) if c else False)
            if not header_div:
                # Also try finding the h4 parent
                h4_parent = h4.parent if h4 else None
                if h4_parent and h4_parent.name == 'div':
                    header_div = h4_parent
            if header_div:
                header_text = header_div.get_text(strip=True)
                repealed_match = re.search(r'\[Vervallen\s+per\s+([^\]]+)\]', header_text)
                if repealed_match:
                    is_repealed = True
                    repealed_text = f"[Dit artikel is vervallen per {repealed_match.group(1)}]"
                    full_text = repealed_text

            # Handle articles with no content
            if len(full_text) < 20:
                if is_repealed:
                    # Repealed articles are expected to be empty
                    full_text = repealed_text if repealed_text else "[Artikel vervallen]"
                else:
                    log_warning(f"Article {section_num} has very short content ({len(full_text)} chars)")
                    continue

            whs_topics = self._classify_whs_topics(full_text, article_title) if not is_repealed else []
            logistics_relevance = self._calculate_logistics_relevance(full_text, article_title) if not is_repealed else {"score": 0, "level": "low"}

            sections.append({
                "id": generate_id(f"{abbrev}-{section_num}"),
                "number": section_num,
                "title": f"Artikel {section_num}. {article_title}".rstrip('.'),
                "text": full_text[:50000],
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
                            "text": full_text[:50000],
                            "whs_topics": self._classify_whs_topics(full_text, ""),
                            "amazon_logistics_relevance": self._calculate_logistics_relevance(full_text, ""),
                            "paragraphs": []
                        })

        # Sort sections by number
        sections.sort(key=lambda s: get_section_number(s))

        # Organize into chapters (Hoofdstukken)
        chapters = self._organize_into_chapters(sections, abbrev)

        doc = {
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
        # Add content hash for update detection
        doc["content_hash"] = generate_content_hash(doc)
        return doc

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
    law_limit = getattr(args, 'laws', None)
    use_menu = getattr(args, 'menu', False)
    check_updates_flag = getattr(args, 'check_updates', False)
    select_laws = getattr(args, 'select', None)

    for country in countries:
        log_header(f"Scraping {country} Laws")

        scraper_class = SCRAPERS.get(country)
        if not scraper_class:
            log_error(f"No scraper for {country}")
            continue

        # Determine which laws to scrape
        selected_laws = None

        if use_menu:
            # Interactive menu mode
            selected_laws = interactive_law_menu(country, check_updates=check_updates_flag)
            if not selected_laws:
                log_info(f"No laws selected for {country}, skipping...")
                continue
            log_info(f"Selected laws: {', '.join(selected_laws)}")

        elif check_updates_flag:
            # Check for updates and only scrape changed laws
            log_info("Checking for updates...")
            update_results = check_for_updates(country)

            # Get laws that need updating
            selected_laws = []
            for item in update_results.get('new', []):
                selected_laws.append(item['abbreviation'])
                log_info(f"  NEW: {item['abbreviation']}")
            for item in update_results.get('updated', []):
                selected_laws.append(item['abbreviation'])
                log_info(f"  UPDATE: {item['abbreviation']} (hash changed)")

            if not selected_laws:
                log_success(f"All {country} laws are up to date!")
                continue

            log_info(f"Found {len(selected_laws)} law(s) needing update")

        elif select_laws:
            # Manual selection via --select
            selected_laws = [s.strip() for s in select_laws.split(',')]
            # Include both built-in and custom sources
            all_sources = get_all_sources_with_status(country)
            valid_abbrs = [s['abbr'] for s in all_sources]
            # Validate selections
            invalid = [s for s in selected_laws if s not in valid_abbrs]
            if invalid:
                log_warning(f"Unknown laws ignored: {', '.join(invalid)}")
            selected_laws = [s for s in selected_laws if s in valid_abbrs]
            if not selected_laws:
                log_error(f"No valid laws selected for {country}")
                continue

        # Create scraper with selected laws or law limit
        if selected_laws:
            scraper = scraper_class(law_limit=None)
            scraper.selected_laws = selected_laws
        else:
            scraper = scraper_class(law_limit=law_limit)

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


def cmd_check_updates(args) -> int:
    """Run the check-updates command to see which laws have changed."""
    countries = ['AT', 'DE', 'NL'] if args.all else [args.country]

    for country in countries:
        log_header(f"Checking {country} for Updates")

        results = check_for_updates(country)

        if results.get('error'):
            log_error(f"Error checking {country}")
            continue

        # Display results
        print()
        if results['new']:
            print(f"{Colors.GREEN}NEW laws (not in database):{Colors.RESET}")
            for item in results['new']:
                print(f"  + {item['abbreviation']} ({item['sections']} sections)")

        if results['updated']:
            print(f"\n{Colors.YELLOW}UPDATED laws (content changed):{Colors.RESET}")
            for item in results['updated']:
                print(f"  ~ {item['abbreviation']} (hash: {item['old_hash']} -> {item['new_hash']}, last scraped: {item['last_scraped']})")

        if results['unchanged']:
            print(f"\n{Colors.DIM}UNCHANGED laws:{Colors.RESET}")
            for item in results['unchanged']:
                print(f"  = {item['abbreviation']} (hash: {item['hash']})")

        # Summary
        total = len(results['new']) + len(results['updated']) + len(results['unchanged'])
        needs_update = len(results['new']) + len(results['updated'])
        print(f"\n{Colors.CYAN}Summary: {needs_update}/{total} laws need updating{Colors.RESET}")

        if needs_update > 0:
            print(f"\n{Colors.DIM}Run 'python law_manager.py scrape --country {country} --check-updates' to update only changed laws{Colors.RESET}")

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
    law_limit = getattr(args, 'laws', None)

    log_header("Running Complete Pipeline")

    for country in countries:
        log_section(f"Processing {country}")

        # Scrape
        if not args.skip_scrape:
            log_info("Step 1: Scraping...")
            scraper_class = SCRAPERS.get(country)
            scraper = scraper_class(law_limit=law_limit) if scraper_class else None
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
# Interactive Menu System
# =============================================================================

def clear_screen():
    """Clear the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')


def print_menu_header():
    """Print the main menu header."""
    clear_screen()
    print(f"""
{Colors.BLUE}╔══════════════════════════════════════════════════════════════╗
║                                                                ║
║   {Colors.BOLD}🏛️  EU SAFETY LAWS DATABASE MANAGER  🏛️{Colors.RESET}{Colors.BLUE}                    ║
║                                                                ║
║   {Colors.DIM}Version {CONFIG.scraper_version}{Colors.RESET}{Colors.BLUE}                                               ║
║   {Colors.DIM}Countries: 🇦🇹 Austria  🇩🇪 Germany  🇳🇱 Netherlands{Colors.RESET}{Colors.BLUE}          ║
║                                                                ║
╚══════════════════════════════════════════════════════════════╝{Colors.RESET}
""")


def get_user_input(prompt: str, valid_options: List[str] = None, allow_empty: bool = False) -> str:
    """Get validated user input."""
    while True:
        try:
            user_input = input(f"{Colors.CYAN}{prompt}{Colors.RESET}").strip()
            if not user_input and not allow_empty:
                continue
            if valid_options and user_input.lower() not in [o.lower() for o in valid_options]:
                print(f"{Colors.YELLOW}Invalid option. Please choose from: {', '.join(valid_options)}{Colors.RESET}")
                continue
            return user_input
        except (KeyboardInterrupt, EOFError):
            print(f"\n{Colors.YELLOW}Cancelled.{Colors.RESET}")
            return ''


def select_from_menu(title: str, options: List[Tuple[str, str, str]], back_option: bool = True) -> str:
    """
    Display a menu and get user selection.
    options: List of (key, label, description)
    Returns the selected key or '' for back/cancel.
    """
    print(f"\n{Colors.BOLD}{Colors.WHITE}{title}{Colors.RESET}\n")

    for i, (key, label, desc) in enumerate(options, 1):
        print(f"  {Colors.CYAN}[{i}]{Colors.RESET} {Colors.BOLD}{label}{Colors.RESET}")
        if desc:
            print(f"      {Colors.DIM}{desc}{Colors.RESET}")

    if back_option:
        print(f"\n  {Colors.YELLOW}[0]{Colors.RESET} ← Back / Cancel")

    print()
    valid = [str(i) for i in range(0 if back_option else 1, len(options) + 1)]
    choice = get_user_input("Enter your choice: ", valid)

    if not choice or choice == '0':
        return ''

    return options[int(choice) - 1][0]


def select_country() -> str:
    """Show country selection menu."""
    # Get enabled source counts
    at_sources = get_all_sources_with_status("AT")
    de_sources = get_all_sources_with_status("DE")
    nl_sources = get_all_sources_with_status("NL")

    at_enabled = len([s for s in at_sources if s['enabled']])
    de_enabled = len([s for s in de_sources if s['enabled']])
    nl_enabled = len([s for s in nl_sources if s['enabled']])

    options = [
        ('AT', '🇦🇹 Austria (AT)', f'{at_enabled}/{len(at_sources)} sources enabled'),
        ('DE', '🇩🇪 Germany (DE)', f'{de_enabled}/{len(de_sources)} sources enabled'),
        ('NL', '🇳🇱 Netherlands (NL)', f'{nl_enabled}/{len(nl_sources)} sources enabled'),
        ('ALL', '🌍 All Countries', 'Process all three countries'),
    ]
    return select_from_menu("Select Country", options)


def select_laws_for_country(country: str) -> List[str]:
    """Show law selection menu for a specific country."""
    # Get all sources with status (includes custom sources and enabled/disabled state)
    all_sources = get_all_sources_with_status(country)
    enabled_sources = [s for s in all_sources if s['enabled']]

    # Count enabled sources for display
    enabled_count = len(enabled_sources)
    total_count = len(all_sources)

    options = [('ALL', '📚 All Enabled Sources', f'Scrape all {enabled_count} enabled sources')]
    options.append(('ENABLED', '✓ Only Enabled', f'Scrape {enabled_count} enabled sources'))

    for src in all_sources:
        status = "✓" if src['enabled'] else "✗"
        type_tag = "[custom]" if src['type'] == 'custom' else ""
        label = f"{status} {src['abbr']} {type_tag}".strip()
        options.append((src['abbr'], f"📄 {label}", src['name']))

    print(f"\n{Colors.BOLD}Available sources for {country}:{Colors.RESET}")
    print(f"{Colors.DIM}({enabled_count}/{total_count} enabled - manage in Sources menu){Colors.RESET}")
    selected = select_from_menu(f"Select Laws for {country}", options)

    if selected == 'ALL' or selected == 'ENABLED':
        return [s['abbr'] for s in enabled_sources]
    elif selected:
        return [selected]
    return []


def menu_scrape():
    """Interactive scrape menu."""
    print_menu_header()
    print(f"{Colors.BOLD}📥 SCRAPE LAWS{Colors.RESET}")
    print(f"{Colors.DIM}Download laws from official government sources{Colors.RESET}\n")

    country = select_country()
    if not country:
        return

    countries = ['AT', 'DE', 'NL'] if country == 'ALL' else [country]

    # For each country, select laws
    selected_laws = {}
    for c in countries:
        laws = select_laws_for_country(c)
        if laws:
            selected_laws[c] = laws
        elif country != 'ALL':
            return  # User cancelled

    if not selected_laws:
        return

    # Confirm
    print(f"\n{Colors.BOLD}Ready to scrape:{Colors.RESET}")
    for c, laws in selected_laws.items():
        print(f"  {c}: {', '.join(laws)}")

    confirm = get_user_input("\nProceed? [Y/n]: ", allow_empty=True)
    if confirm.lower() == 'n':
        return

    # Create args-like object and run
    class Args:
        def __init__(self):
            self.country = None
            self.all = False
            self.laws = 999
            self.menu = False
            self.check_updates = False
            self.select = None

    for c, laws in selected_laws.items():
        args = Args()
        args.country = c
        args.select = ','.join(laws)
        cmd_scrape(args)

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_clean():
    """Interactive clean menu."""
    print_menu_header()
    print(f"{Colors.BOLD}🧹 CLEAN DATA{Colors.RESET}")
    print(f"{Colors.DIM}Clean and format scraped law content{Colors.RESET}\n")

    country = select_country()
    if not country:
        return

    # Select cleaning mode
    options = [
        ('ai', '🤖 AI Cleaning (Recommended)', 'Use Gemini AI to clean and format text'),
        ('fast', '⚡ Fast AI Cleaning', 'AI for main content only, regex for the rest'),
        ('regex', '📝 Regex Only', 'No AI, use pattern matching only'),
    ]
    mode = select_from_menu("Select Cleaning Mode", options)
    if not mode:
        return

    class Args:
        def __init__(self):
            self.country = None
            self.all = False
            self.no_ai = False
            self.fast = False

    if country == 'ALL':
        for c in ['AT', 'DE', 'NL']:
            args = Args()
            args.country = c
            args.no_ai = (mode == 'regex')
            args.fast = (mode == 'fast')
            cmd_clean(args)
    else:
        args = Args()
        args.country = country
        args.no_ai = (mode == 'regex')
        args.fast = (mode == 'fast')
        cmd_clean(args)

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_restructure():
    """Interactive restructure menu."""
    print_menu_header()
    print(f"{Colors.BOLD}🔧 RESTRUCTURE DATA{Colors.RESET}")
    print(f"{Colors.DIM}Reorganize laws into official chapter structure{Colors.RESET}\n")

    country = select_country()
    if not country:
        return

    class Args:
        def __init__(self):
            self.country = None
            self.all = False

    if country == 'ALL':
        for c in ['AT', 'DE', 'NL']:
            args = Args()
            args.country = c
            cmd_restructure(args)
    else:
        args = Args()
        args.country = country
        cmd_restructure(args)

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_build():
    """Interactive build menu."""
    print_menu_header()
    print(f"{Colors.BOLD}🏗️ BUILD DATABASE{Colors.RESET}")
    print(f"{Colors.DIM}Compile all data into master database{Colors.RESET}\n")

    confirm = get_user_input("Build master database? [Y/n]: ", allow_empty=True)
    if confirm.lower() == 'n':
        return

    build_master_database()
    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_status():
    """Interactive status menu."""
    print_menu_header()
    print(f"{Colors.BOLD}📊 DATABASE STATUS{Colors.RESET}\n")

    class Args:
        pass

    cmd_status(Args())
    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_check_updates():
    """Interactive check updates menu."""
    print_menu_header()
    print(f"{Colors.BOLD}🔄 CHECK FOR UPDATES{Colors.RESET}")
    print(f"{Colors.DIM}Check if laws have changed since last scrape{Colors.RESET}\n")

    country = select_country()
    if not country:
        return

    class Args:
        def __init__(self):
            self.country = None
            self.all = False

    if country == 'ALL':
        for c in ['AT', 'DE', 'NL']:
            args = Args()
            args.country = c
            cmd_check_updates(args)
    else:
        args = Args()
        args.country = country
        cmd_check_updates(args)

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_full_pipeline():
    """Interactive full pipeline menu."""
    print_menu_header()
    print(f"{Colors.BOLD}🚀 FULL PIPELINE{Colors.RESET}")
    print(f"{Colors.DIM}Run complete: Scrape → Clean → Restructure → Build{Colors.RESET}\n")

    country = select_country()
    if not country:
        return

    # Options
    options = [
        ('full', '🤖 Full Pipeline with AI', 'Best quality, uses AI cleaning'),
        ('fast', '⚡ Fast Pipeline', 'Quicker, AI for main content only'),
        ('basic', '📝 Basic Pipeline', 'No AI, regex cleaning only'),
    ]
    mode = select_from_menu("Select Pipeline Mode", options)
    if not mode:
        return

    class Args:
        def __init__(self):
            self.country = None
            self.all = False
            self.no_ai = False
            self.fast = False
            self.skip_scrape = False
            self.skip_build = False
            self.laws = 999

    if country == 'ALL':
        for c in ['AT', 'DE', 'NL']:
            args = Args()
            args.country = c
            args.no_ai = (mode == 'basic')
            args.fast = (mode == 'fast')
            cmd_all(args)
    else:
        args = Args()
        args.country = country
        args.no_ai = (mode == 'basic')
        args.fast = (mode == 'fast')
        cmd_all(args)

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_wikipedia():
    """Interactive Wikipedia scraper menu."""
    print_menu_header()
    print(f"{Colors.BOLD}📖 WIKIPEDIA SCRAPER{Colors.RESET}")
    print(f"{Colors.DIM}Scrape related Wikipedia articles for laws{Colors.RESET}\n")

    country = select_country()
    if not country:
        return

    countries = ['AT', 'DE', 'NL'] if country == 'ALL' else [country]

    for c in countries:
        log_section(f"Scraping Wikipedia articles for {c}")
        scrape_wikipedia_for_country(c)

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_sources():
    """Interactive sources management menu."""
    while True:
        print_menu_header()
        print(f"{Colors.BOLD}📚 MANAGE SOURCES{Colors.RESET}")
        print(f"{Colors.DIM}Configure which sources to use for scraping{Colors.RESET}\n")

        options = [
            ('view', '👁️ View Sources', 'See all sources and their status'),
            ('toggle', '🔀 Toggle Sources', 'Enable or disable sources'),
            ('add', '➕ Add Custom Source', 'Add a new source manually'),
            ('ai', '🤖 AI Suggestions', 'Get AI-powered source suggestions'),
            ('remove', '🗑️ Remove Custom Source', 'Remove a custom source'),
        ]

        for i, (key, label, desc) in enumerate(options, 1):
            print(f"  {Colors.CYAN}[{i}]{Colors.RESET} {label}")
            print(f"      {Colors.DIM}{desc}{Colors.RESET}")

        print(f"\n  {Colors.YELLOW}[0]{Colors.RESET} ← Back")

        valid = [str(i) for i in range(0, len(options) + 1)]
        choice = get_user_input("\nEnter your choice: ", valid)

        if not choice or choice == '0':
            return

        action = options[int(choice) - 1][0]

        if action == 'view':
            menu_sources_view()
        elif action == 'toggle':
            menu_sources_toggle()
        elif action == 'add':
            menu_sources_add()
        elif action == 'ai':
            menu_sources_ai_suggest()
        elif action == 'remove':
            menu_sources_remove()


def menu_sources_view():
    """View all sources with their status."""
    print_menu_header()
    print(f"{Colors.BOLD}📚 VIEW SOURCES{Colors.RESET}\n")

    country = select_country()
    if not country:
        return

    countries = ['AT', 'DE', 'NL'] if country == 'ALL' else [country]

    for c in countries:
        country_flags = {"AT": "🇦🇹", "DE": "🇩🇪", "NL": "🇳🇱"}
        print(f"\n{Colors.BOLD}{country_flags.get(c, '')} {c} Sources:{Colors.RESET}")
        print(f"{Colors.DIM}{'-' * 50}{Colors.RESET}")

        sources = get_all_sources_with_status(c)
        for src in sources:
            status = f"{Colors.GREEN}✓{Colors.RESET}" if src['enabled'] else f"{Colors.RED}✗{Colors.RESET}"
            type_badge = f"{Colors.CYAN}[built-in]{Colors.RESET}" if src['type'] == 'built-in' else f"{Colors.MAGENTA}[custom]{Colors.RESET}"
            print(f"  {status} {Colors.BOLD}{src['abbr']}{Colors.RESET} - {src['name']} {type_badge}")
            if src['description']:
                print(f"      {Colors.DIM}{src['description']}{Colors.RESET}")

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_sources_toggle():
    """Toggle sources on/off."""
    print_menu_header()
    print(f"{Colors.BOLD}🔀 TOGGLE SOURCES{Colors.RESET}\n")

    country = select_country()
    if not country or country == 'ALL':
        if country == 'ALL':
            print(f"{Colors.YELLOW}Please select a specific country{Colors.RESET}")
            input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")
        return

    while True:
        print(f"\n{Colors.BOLD}Sources for {country}:{Colors.RESET}")
        sources = get_all_sources_with_status(country)

        for i, src in enumerate(sources, 1):
            status = f"{Colors.GREEN}ON {Colors.RESET}" if src['enabled'] else f"{Colors.RED}OFF{Colors.RESET}"
            type_badge = f"{Colors.DIM}[built-in]{Colors.RESET}" if src['type'] == 'built-in' else f"{Colors.MAGENTA}[custom]{Colors.RESET}"
            print(f"  [{i}] {status} {Colors.BOLD}{src['abbr']}{Colors.RESET} - {src['name']} {type_badge}")

        print(f"\n  {Colors.YELLOW}[0]{Colors.RESET} ← Done")

        valid = [str(i) for i in range(0, len(sources) + 1)]
        choice = get_user_input("\nEnter number to toggle: ", valid)

        if not choice or choice == '0':
            return

        idx = int(choice) - 1
        src = sources[idx]
        new_state = not src['enabled']

        if toggle_source(country, src['abbr'], new_state):
            state_text = "enabled" if new_state else "disabled"
            log_success(f"Source {src['abbr']} {state_text}")
        else:
            log_error(f"Failed to toggle {src['abbr']}")


def menu_sources_add():
    """Add a custom source."""
    print_menu_header()
    print(f"{Colors.BOLD}➕ ADD CUSTOM SOURCE{Colors.RESET}\n")

    # Select country
    options = [
        ('AT', '🇦🇹 Austria', ''),
        ('DE', '🇩🇪 Germany', ''),
        ('NL', '🇳🇱 Netherlands', ''),
    ]
    country = select_from_menu("Select Country", options)
    if not country:
        return

    print(f"\n{Colors.BOLD}Enter source details:{Colors.RESET}\n")

    abbr = get_user_input("Abbreviation (e.g., BioStoffV): ").strip()
    if not abbr:
        return

    name = get_user_input("Full name: ").strip()
    if not name:
        return

    url = get_user_input("URL: ").strip()
    if not url:
        return

    description = get_user_input("Description (optional): ", allow_empty=True).strip()

    print(f"\n{Colors.BOLD}Adding source:{Colors.RESET}")
    print(f"  Country: {country}")
    print(f"  Abbreviation: {abbr}")
    print(f"  Name: {name}")
    print(f"  URL: {url}")
    if description:
        print(f"  Description: {description}")

    confirm = get_user_input("\nConfirm? [Y/n]: ", allow_empty=True)
    if confirm.lower() == 'n':
        return

    if add_custom_source(country, abbr, url, name, description):
        log_success(f"Added custom source: {abbr}")
    else:
        log_error("Failed to add source")

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_sources_ai_suggest():
    """Get AI-powered source suggestions."""
    print_menu_header()
    print(f"{Colors.BOLD}🤖 AI SOURCE SUGGESTIONS{Colors.RESET}\n")

    if not os.environ.get("GEMINI_API_KEY"):
        log_error("GEMINI_API_KEY not set. Please set it to use AI suggestions.")
        input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")
        return

    # Select country
    options = [
        ('AT', '🇦🇹 Austria', ''),
        ('DE', '🇩🇪 Germany', ''),
        ('NL', '🇳🇱 Netherlands', ''),
    ]
    country = select_from_menu("Select Country", options)
    if not country:
        return

    topic = get_user_input("\nEnter a topic (e.g., 'hazardous materials', 'fire safety'): ").strip()
    if not topic:
        return

    log_info(f"Asking AI for source suggestions about '{topic}' in {country}...")
    print()

    suggestions = suggest_sources_with_ai(country, topic)

    if not suggestions:
        print(f"{Colors.YELLOW}No suggestions found or AI request failed.{Colors.RESET}")
        input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")
        return

    print(f"\n{Colors.BOLD}AI Suggestions:{Colors.RESET}\n")

    for i, sugg in enumerate(suggestions, 1):
        relevance_colors = {"high": Colors.GREEN, "medium": Colors.YELLOW, "low": Colors.DIM}
        rel_color = relevance_colors.get(sugg.get('relevance', 'medium'), Colors.DIM)

        print(f"  {Colors.CYAN}[{i}]{Colors.RESET} {Colors.BOLD}{sugg.get('abbr', 'N/A')}{Colors.RESET}")
        print(f"      Name: {sugg.get('name', 'N/A')}")
        print(f"      URL: {sugg.get('url', 'N/A')}")
        print(f"      Relevance: {rel_color}{sugg.get('relevance', 'N/A')}{Colors.RESET}")
        if sugg.get('description'):
            print(f"      {Colors.DIM}{sugg['description']}{Colors.RESET}")
        print()

    # Ask to add any
    add_choice = get_user_input("Enter number to add, or 'a' for all, or Enter to skip: ", allow_empty=True)

    if not add_choice:
        return

    to_add = []
    if add_choice.lower() == 'a':
        to_add = suggestions
    elif add_choice.isdigit():
        idx = int(add_choice) - 1
        if 0 <= idx < len(suggestions):
            to_add = [suggestions[idx]]

    for sugg in to_add:
        if add_custom_source(country, sugg.get('abbr', ''), sugg.get('url', ''), sugg.get('name', ''), sugg.get('description', '')):
            log_success(f"Added: {sugg.get('abbr')}")
        else:
            log_error(f"Failed to add: {sugg.get('abbr')}")

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_sources_remove():
    """Remove a custom source."""
    print_menu_header()
    print(f"{Colors.BOLD}🗑️ REMOVE CUSTOM SOURCE{Colors.RESET}\n")

    # Select country
    options = [
        ('AT', '🇦🇹 Austria', ''),
        ('DE', '🇩🇪 Germany', ''),
        ('NL', '🇳🇱 Netherlands', ''),
    ]
    country = select_from_menu("Select Country", options)
    if not country:
        return

    # Get custom sources only
    sources = [s for s in get_all_sources_with_status(country) if s['type'] == 'custom']

    if not sources:
        print(f"{Colors.YELLOW}No custom sources found for {country}.{Colors.RESET}")
        input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")
        return

    print(f"\n{Colors.BOLD}Custom sources for {country}:{Colors.RESET}\n")
    for i, src in enumerate(sources, 1):
        print(f"  [{i}] {Colors.BOLD}{src['abbr']}{Colors.RESET} - {src['name']}")

    print(f"\n  {Colors.YELLOW}[0]{Colors.RESET} ← Cancel")

    valid = [str(i) for i in range(0, len(sources) + 1)]
    choice = get_user_input("\nEnter number to remove: ", valid)

    if not choice or choice == '0':
        return

    idx = int(choice) - 1
    src = sources[idx]

    confirm = get_user_input(f"Remove {src['abbr']}? [y/N]: ", allow_empty=True)
    if confirm.lower() != 'y':
        return

    if remove_custom_source(country, src['abbr']):
        log_success(f"Removed: {src['abbr']}")
    else:
        log_error(f"Failed to remove: {src['abbr']}")

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def menu_settings():
    """Interactive settings menu."""
    print_menu_header()
    print(f"{Colors.BOLD}⚙️ SETTINGS{Colors.RESET}\n")

    print(f"  {Colors.CYAN}API Key:{Colors.RESET} {'✓ Set' if os.environ.get('GEMINI_API_KEY') else '✗ Not set'}")
    print(f"  {Colors.CYAN}Scraper Version:{Colors.RESET} {CONFIG.scraper_version}")
    print(f"  {Colors.CYAN}Request Timeout:{Colors.RESET} {CONFIG.request_timeout}s")
    print(f"  {Colors.CYAN}Rate Limit Delay:{Colors.RESET} {CONFIG.rate_limit_delay}s")
    print(f"  {Colors.CYAN}Max Retries:{Colors.RESET} {CONFIG.max_retries}")
    print(f"  {Colors.CYAN}AI Model:{Colors.RESET} {CONFIG.gemini_model}")

    input(f"\n{Colors.GREEN}Press Enter to continue...{Colors.RESET}")


def interactive_menu():
    """Main interactive menu loop."""
    while True:
        print_menu_header()

        options = [
            ('scrape', '📥 Scrape Laws', 'Download laws from government sources'),
            ('clean', '🧹 Clean Data', 'Clean and format scraped content'),
            ('restructure', '🔧 Restructure', 'Organize into chapter structure'),
            ('build', '🏗️ Build Database', 'Compile master database'),
            ('status', '📊 View Status', 'Show database statistics'),
            ('updates', '🔄 Check Updates', 'Check for law changes'),
            ('pipeline', '🚀 Full Pipeline', 'Run complete workflow'),
            ('wikipedia', '📖 Wikipedia', 'Scrape related Wikipedia articles'),
            ('sources', '📚 Manage Sources', 'Add/remove sources, toggle on/off'),
            ('settings', '⚙️ Settings', 'View configuration'),
        ]

        print(f"{Colors.BOLD}MAIN MENU{Colors.RESET}\n")

        for i, (key, label, desc) in enumerate(options, 1):
            print(f"  {Colors.CYAN}[{i}]{Colors.RESET} {label}")
            print(f"      {Colors.DIM}{desc}{Colors.RESET}")

        print(f"\n  {Colors.RED}[0]{Colors.RESET} Exit")

        print()
        valid = [str(i) for i in range(0, len(options) + 1)]
        choice = get_user_input("Enter your choice: ", valid)

        if not choice or choice == '0':
            print(f"\n{Colors.GREEN}Goodbye! 👋{Colors.RESET}\n")
            return 0

        menu_key = options[int(choice) - 1][0]

        menu_actions = {
            'scrape': menu_scrape,
            'clean': menu_clean,
            'restructure': menu_restructure,
            'build': menu_build,
            'status': menu_status,
            'updates': menu_check_updates,
            'pipeline': menu_full_pipeline,
            'wikipedia': menu_wikipedia,
            'sources': menu_sources,
            'settings': menu_settings,
        }

        if menu_key in menu_actions:
            menu_actions[menu_key]()


# =============================================================================
# Wikipedia Scraper
# =============================================================================

def get_wikipedia_search_terms(country: str, law_abbr: str) -> List[str]:
    """Get Wikipedia search terms for a law."""
    search_terms = {
        "AT": {
            "ASchG": ["ArbeitnehmerInnenschutzgesetz", "Arbeitsschutz Österreich"],
            "AZG": ["Arbeitszeitgesetz Österreich"],
            "ARG": ["Arbeitsruhegesetz"],
            "MSchG": ["Mutterschutzgesetz Österreich"],
            "KJBG": ["Kinder- und Jugendlichen-Beschäftigungsgesetz"],
        },
        "DE": {
            "ArbSchG": ["Arbeitsschutzgesetz", "Arbeitsschutz Deutschland"],
            "ASiG": ["Arbeitssicherheitsgesetz"],
            "ArbZG": ["Arbeitszeitgesetz"],
            "MuSchG": ["Mutterschutzgesetz"],
            "JArbSchG": ["Jugendarbeitsschutzgesetz"],
            "ArbStättV": ["Arbeitsstättenverordnung"],
            "BetrSichV": ["Betriebssicherheitsverordnung"],
            "GefStoffV": ["Gefahrstoffverordnung"],
        },
        "NL": {
            "Arbowet": ["Arbeidsomstandighedenwet", "Arbowet"],
            "Arbobesluit": ["Arbobesluit"],
            "Arbeidstijdenwet": ["Arbeidstijdenwet"],
        },
    }
    return search_terms.get(country, {}).get(law_abbr, [law_abbr])


def scrape_wikipedia_article(search_term: str, lang: str = "de") -> Optional[Dict[str, Any]]:
    """Scrape a Wikipedia article by search term."""
    if not HAS_REQUESTS or not HAS_BS4:
        log_error("requests and beautifulsoup4 required for Wikipedia scraping")
        return None

    # Wikipedia requires a proper User-Agent header
    # See: https://meta.wikimedia.org/wiki/User-Agent_policy
    headers = {
        'User-Agent': 'EU-Safety-Laws-Database/7.1.0 (https://github.com/safety-compliance; contact@example.com) Python/requests',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,nl;q=0.7',
    }

    try:
        # Search Wikipedia API first
        search_url = f"https://{lang}.wikipedia.org/w/api.php"
        search_params = {
            "action": "query",
            "list": "search",
            "srsearch": search_term,
            "format": "json",
            "srlimit": 1
        }

        response = requests.get(search_url, params=search_params, headers=headers, timeout=30)
        response.raise_for_status()
        search_data = response.json()

        if not search_data.get("query", {}).get("search"):
            log_warning(f"No Wikipedia article found for: {search_term}")
            return None

        page_title = search_data["query"]["search"][0]["title"]

        # Fetch the actual HTML page
        page_url = f"https://{lang}.wikipedia.org/wiki/{page_title.replace(' ', '_')}"
        html_headers = {
            'User-Agent': 'EU-Safety-Laws-Database/7.1.0 (https://github.com/safety-compliance; contact@example.com) Python/requests',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,nl;q=0.7',
        }
        html_response = requests.get(page_url, headers=html_headers, timeout=30)
        html_response.raise_for_status()

        soup = BeautifulSoup(html_response.text, 'html.parser')

        # Extract main content
        content_div = soup.find('div', {'id': 'mw-content-text'})
        if not content_div:
            return None

        # Remove unwanted elements
        for elem in content_div.find_all(['script', 'style', 'nav', 'footer']):
            elem.decompose()

        # Get the cleaned HTML
        article_html = str(content_div)

        # Get summary (first paragraph)
        first_para = content_div.find('p', class_=lambda x: x != 'mw-empty-elt')
        summary = first_para.get_text(strip=True) if first_para else ""

        return {
            "title": page_title,
            "url": page_url,
            "language": lang,
            "summary": summary[:500],
            "html_content": article_html,
            "scraped_at": datetime.now().isoformat()
        }

    except Exception as e:
        log_error(f"Error scraping Wikipedia for '{search_term}': {e}")
        return None


def scrape_wikipedia_for_country(country: str):
    """Scrape Wikipedia articles for all laws of a country."""
    laws = CONFIG.sources[country]["main_laws"]
    wiki_dir = CONFIG.base_path / country.lower() / "wikipedia"
    wiki_dir.mkdir(parents=True, exist_ok=True)

    # Determine Wikipedia language
    lang_map = {"AT": "de", "DE": "de", "NL": "nl"}
    lang = lang_map.get(country, "en")

    results = {}

    for law_abbr in laws.keys():
        search_terms = get_wikipedia_search_terms(country, law_abbr)
        log_info(f"Searching Wikipedia for {law_abbr}...")

        for term in search_terms:
            article = scrape_wikipedia_article(term, lang)
            if article:
                results[law_abbr] = article
                log_success(f"Found: {article['title']}")

                # Save HTML file
                html_file = wiki_dir / f"{law_abbr}_wiki.html"
                with open(html_file, 'w', encoding='utf-8') as f:
                    f.write(f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
    <meta charset="UTF-8">
    <title>{article['title']} - Wikipedia</title>
    <link rel="stylesheet" href="https://en.wikipedia.org/w/load.php?modules=site.styles&only=styles">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }}
        .wiki-source {{ background: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 20px; }}
        .wiki-source a {{ color: #0645ad; }}
    </style>
</head>
<body>
    <div class="wiki-source">
        <strong>Source:</strong> <a href="{article['url']}" target="_blank">{article['url']}</a>
        <br><small>Scraped: {article['scraped_at']}</small>
    </div>
    {article['html_content']}
</body>
</html>""")
                break

        time.sleep(CONFIG.rate_limit_delay)

    # Save index file
    index_file = wiki_dir / "wiki_index.json"
    index_data = {
        "country": country,
        "language": lang,
        "scraped_at": datetime.now().isoformat(),
        "articles": {k: {"title": v["title"], "url": v["url"], "summary": v["summary"]}
                     for k, v in results.items()}
    }

    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)

    log_success(f"Saved {len(results)} Wikipedia articles for {country}")
    return results


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    """Main entry point."""
    # If no arguments provided, show interactive menu
    if len(sys.argv) == 1:
        return interactive_menu()

    parser = argparse.ArgumentParser(
        description='EU Safety Laws Database Manager',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Add --menu flag for interactive mode
    parser.add_argument('--menu', '-m', action='store_true',
                        help='Launch interactive menu')

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Scrape command
    scrape_parser = subparsers.add_parser('scrape', help='Scrape laws from official sources')
    scrape_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to scrape')
    scrape_parser.add_argument('--all', action='store_true', help='Scrape all countries')
    scrape_parser.add_argument('--laws', type=int, default=1, metavar='N',
                               help='Number of laws to fetch per country (default: 1, max varies by country)')
    scrape_parser.add_argument('--menu', action='store_true',
                               help='Interactive menu to select which laws to scrape')
    scrape_parser.add_argument('--check-updates', action='store_true',
                               help='Only scrape laws that have changed since last scrape')
    scrape_parser.add_argument('--select', type=str, metavar='LAWS',
                               help='Comma-separated list of law abbreviations to scrape (e.g., ASchG,AZG)')

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
    subparsers.add_parser('build', help='Build master database')

    # Status command
    subparsers.add_parser('status', help='Show database status')

    # Check-updates command
    check_updates_parser = subparsers.add_parser('check-updates', help='Check which laws have changed')
    check_updates_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to check')
    check_updates_parser.add_argument('--all', action='store_true', help='Check all countries')

    # Wikipedia command
    wiki_parser = subparsers.add_parser('wikipedia', help='Scrape related Wikipedia articles')
    wiki_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to scrape Wikipedia for')
    wiki_parser.add_argument('--all', action='store_true', help='Scrape Wikipedia for all countries')

    # All command (complete pipeline)
    all_parser = subparsers.add_parser('all', help='Run complete pipeline')
    all_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to process')
    all_parser.add_argument('--all', action='store_true', help='Process all countries')
    all_parser.add_argument('--no-ai', action='store_true', help='Use regex only, no AI')
    all_parser.add_argument('--fast', action='store_true', help='Fast cleaning mode')
    all_parser.add_argument('--skip-scrape', action='store_true', help='Skip scraping step')
    all_parser.add_argument('--skip-build', action='store_true', help='Skip master database build')
    all_parser.add_argument('--laws', type=int, default=1, metavar='N',
                            help='Number of laws to fetch per country (default: 1, max varies by country)')

    args = parser.parse_args()

    # If --menu flag used, show interactive menu
    if getattr(args, 'menu', False) and not args.command:
        return interactive_menu()

    if not args.command:
        parser.print_help()
        return 1

    # Validate country selection
    if args.command in ['scrape', 'clean', 'restructure', 'all', 'check-updates', 'wikipedia']:
        if not getattr(args, 'all', False) and not getattr(args, 'country', None):
            print(f"Error: --country or --all is required for {args.command}")
            return 1

    # Run command
    def cmd_wikipedia(args):
        """Wikipedia scraping command."""
        countries = ['AT', 'DE', 'NL'] if args.all else [args.country]
        for country in countries:
            scrape_wikipedia_for_country(country)
        return 0

    commands = {
        'scrape': cmd_scrape,
        'clean': cmd_clean,
        'restructure': cmd_restructure,
        'build': cmd_build,
        'status': cmd_status,
        'check-updates': cmd_check_updates,
        'wikipedia': cmd_wikipedia,
        'all': cmd_all,
    }

    return commands[args.command](args)


if __name__ == '__main__':
    sys.exit(main())

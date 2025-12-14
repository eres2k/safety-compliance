#!/usr/bin/env python3
"""
EU Safety Laws Database Cleanup Script
Uses Gemini AI to clean and format law content from AT, DE, NL

Usage:
    python scripts/clean_databases.py --all
    python scripts/clean_databases.py --country AT
    python scripts/clean_databases.py --country DE
    python scripts/clean_databases.py --country NL
    python scripts/clean_databases.py --all --fast  # Only clean full_text, skip sections

Environment:
    GEMINI_API_KEY: Your Gemini API key (required)

    Or create a .env file with:
    GEMINI_API_KEY=your_key_here
"""

import os
import sys
import json
import time
import argparse
import re
from pathlib import Path
from datetime import datetime

try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# Try to import tqdm for progress bars
try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# Colors for terminal output
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log_info(msg):
    print(f"{Colors.CYAN}ℹ {msg}{Colors.RESET}")

def log_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")

def log_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")

def log_error(msg):
    print(f"{Colors.RED}ERROR: {msg}{Colors.RESET}")

def log_header(msg):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}{msg}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}\n")

def log_progress(msg):
    """Log progress message that overwrites the current line"""
    print(f"\r{Colors.CYAN}  → {msg}{Colors.RESET}", end='', flush=True)

def log_progress_done():
    """Clear the progress line"""
    print()


class SimpleProgressBar:
    """Simple text-based progress bar for when tqdm is not available"""
    def __init__(self, total, desc="Processing", width=40):
        self.total = total
        self.current = 0
        self.desc = desc
        self.width = width
        self.start_time = time.time()

    def update(self, n=1):
        self.current += n
        self._display()

    def set_description(self, desc):
        self.desc = desc
        self._display()

    def _display(self):
        if self.total == 0:
            return
        pct = self.current / self.total
        filled = int(self.width * pct)
        bar = '█' * filled + '░' * (self.width - filled)
        elapsed = time.time() - self.start_time
        if self.current > 0:
            eta = (elapsed / self.current) * (self.total - self.current)
            eta_str = f"ETA: {int(eta)}s"
        else:
            eta_str = "ETA: --"
        print(f"\r  {self.desc}: |{bar}| {self.current}/{self.total} ({pct*100:.0f}%) {eta_str}  ", end='', flush=True)

    def close(self):
        print()


def create_progress_bar(total, desc="Processing"):
    """Create a progress bar (tqdm if available, otherwise simple text)"""
    if HAS_TQDM:
        return tqdm(total=total, desc=f"  {desc}", ncols=80, bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]')
    else:
        return SimpleProgressBar(total, desc)


# System prompts for each country
SYSTEM_PROMPTS = {
    'AT': """You are a legal text formatter. Your task is to clean Austrian law text scraped from RIS (Rechtsinformationssystem).

REMOVE the following:
1. Navigation boilerplate (Seitenbereiche, Zum Inhalt, Accesskey, Navigationsleiste, etc.)
2. Website UI elements (Druckansicht, Andere Formate, etc.)
3. Duplicate text where both abbreviated (§ 1 Abs. 1) AND written-out (Paragraph eins, Absatz eins) forms appear - keep ONLY the abbreviated form
4. Double commas (,,) that result from removing duplicates
5. Amendment history at the start (BGBl references, CELEX numbers, etc.) - but keep inline BGBl references within the law text

KEEP:
1. All actual law content (sections, paragraphs, definitions)
2. Section numbers and titles (§ 1, § 2, etc.)
3. Subsection markers ((1), (2), etc.)
4. Inline legal references to other laws

FORMAT:
1. Each section (§) should start on a new line
2. Subsections ((1), (2)) should be clearly separated
3. Maintain proper paragraph breaks
4. Keep the text in German

Return ONLY the cleaned law text, no explanations or comments.""",

    'DE': """You are a legal text formatter. Clean this German law section text.

TASK:
1. Fix formatting issues from PDF extraction
2. Ensure proper paragraph breaks between subsections ((1), (2), etc.)
3. Keep numbered list items inline (1. text, 2. text)
4. Ensure inline references like "§ 2 Abs. 1" stay inline (not on separate lines)
5. Remove any PDF artifacts or broken formatting

KEEP:
1. All legal content exactly as written
2. Section structure and numbering
3. All legal references

Return ONLY the cleaned text, no explanations.""",

    'NL': """You are a legal text formatter. Your task is to clean Dutch law text scraped from wetten.overheid.nl.

REMOVE the following website UI elements:
1. "Toon relaties in LiDO"
2. "Maak een permanente link"
3. "Toon wetstechnische informatie"
4. "Druk het regelingonderdeel af"
5. "Sla het regelingonderdeel op"
6. "[Wijziging(en) zonder datum inwerkingtreding aanwezig. Zie het wijzigingenoverzicht.]"
7. Navigation elements (breadcrumbs, menu items)
8. Any other UI boilerplate not part of the actual law text

KEEP:
1. All actual law content (artikelen, leden, definities)
2. Article numbers and titles (Artikel 1, Artikel 2, etc.)
3. Subsection markers (1, 2, 3 or a, b, c)
4. Legal definitions and their explanations
5. References to other laws and articles

FORMAT:
1. Each article (Artikel) should start on a new line
2. Subsections should be clearly numbered
3. Maintain proper paragraph breaks
4. Keep the text in Dutch

Return ONLY the cleaned law text, no explanations."""
}


def get_api_key():
    """Get API key from environment or .env file"""
    api_key = os.environ.get('GEMINI_API_KEY')

    if not api_key:
        # Try to load from .env file
        env_path = Path(__file__).parent.parent / '.env'
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if line.startswith('GEMINI_API_KEY='):
                        api_key = line.split('=', 1)[1].strip()
                        break

    if not api_key:
        api_key = os.environ.get('VITE_GEMINI_API_KEY')

    return api_key


def call_gemini_api(api_key: str, prompt: str, system_prompt: str, max_retries: int = 3) -> str:
    """Call Gemini API with retry logic"""

    if HAS_GENAI:
        # Use official SDK
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=system_prompt
        )

        for attempt in range(max_retries):
            try:
                response = model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=8192
                    )
                )
                return response.text
            except Exception as e:
                log_warning(f"Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)
                    log_info(f"Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise

    elif HAS_REQUESTS:
        # Use REST API directly
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 8192
            }
        }

        for attempt in range(max_retries):
            try:
                response = requests.post(url, json=payload, timeout=120)
                response.raise_for_status()
                data = response.json()
                return data['candidates'][0]['content']['parts'][0]['text']
            except Exception as e:
                log_warning(f"Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)
                    log_info(f"Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise

    else:
        raise RuntimeError("Neither google-generativeai nor requests package is installed. "
                          "Install one with: pip install google-generativeai  OR  pip install requests")


def clean_text_with_ai(api_key: str, text: str, title: str, country: str) -> str:
    """Clean text using Gemini AI"""
    if not text or len(text) < 100:
        return text

    system_prompt = SYSTEM_PROMPTS.get(country, SYSTEM_PROMPTS['DE'])
    prompt = f'Clean this law text for "{title}":\n\n{text[:30000]}'

    return call_gemini_api(api_key, prompt, system_prompt)


def clean_text_with_regex(text: str, country: str) -> str:
    """Fallback: Clean text using regex patterns (no AI needed)"""
    if not text:
        return text

    cleaned = text

    if country == 'AT':
        # Austrian RIS boilerplate
        patterns = [
            r'Seitenbereiche:[\s\S]*?Barrierefreiheitserklärung[^\n]*',
            r'Zum Inhalt\s*\([^)]*\)',
            r'Zur Navigationsleiste\s*\([^)]*\)',
            r'Accesskey\s*\d+',
            r'Kontakt\s*\([^)]*\)',
            r'Impressum\s*\([^)]*\)',
            r'Datenschutzerklärung\s*\([^)]*\)',
            r'Barrierefreiheitserklärung\s*\([^)]*\)',
            r'Navigationsleiste:[\s\S]*?(?=§\s*\d|$)',
            r'Druckansicht\s*\([^)]*\)',
            r'Andere Formate:[^\n]*',
            # Remove written-out forms (keep abbreviated)
            r'Paragraph \w+,?\s*',
            r'Absatz \w+,?\s*',
            r'Ziffer \w+,?\s*',
            r'Litera \w+,?\s*',
            r'Bundesgesetzblatt Nr\. \d+ aus \d+,*\s*',
        ]
        for pattern in patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

    elif country == 'NL':
        # Dutch wetten.overheid.nl boilerplate
        patterns = [
            r'Toon relaties in LiDO\s*',
            r'Maak een permanente link\s*',
            r'Toon wetstechnische informatie\s*',
            r'\.{3,}\s*',
            r'Druk het regelingonderdeel af\s*',
            r'Sla het regelingonderdeel op\s*',
            r'\[Wijziging\(en\)[^\]]*\]',
        ]
        for pattern in patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

    elif country == 'DE':
        # German PDF artifacts
        patterns = [
            r'Seite \d+ von \d+\s*-?\s*',
            r'Ein Service des Bundesministeriums[^\n]*',
            r'www\.gesetze-im-internet\.de[^\n]*',
        ]
        for pattern in patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

    # Common cleanup for all
    cleaned = re.sub(r',\s*,', ',', cleaned)  # Double commas
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)  # Multiple newlines
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)  # Multiple spaces
    cleaned = cleaned.strip()

    return cleaned


def process_document(api_key: str, doc: dict, index: int, total: int, country: str, use_ai: bool = True, fast_mode: bool = False) -> dict:
    """Process a single document"""
    title = doc.get('abbreviation') or doc.get('title') or f"Document {index + 1}"
    print(f"\n{Colors.BOLD}[{index + 1}/{total}] {title}{Colors.RESET}")

    cleaned_doc = doc.copy()

    # Clean full_text if present
    if doc.get('full_text') and len(doc['full_text']) > 100:
        log_progress(f"Cleaning full_text ({len(doc['full_text']):,} chars)...")
        try:
            if use_ai:
                cleaned_doc['full_text'] = clean_text_with_ai(api_key, doc['full_text'], title, country)
            else:
                cleaned_doc['full_text'] = clean_text_with_regex(doc['full_text'], country)
            log_progress_done()
            log_success(f"Cleaned full_text ({len(cleaned_doc['full_text']):,} chars)")
        except Exception as e:
            log_progress_done()
            log_error(f"Failed to clean full_text: {e}")
            # Try regex fallback
            cleaned_doc['full_text'] = clean_text_with_regex(doc['full_text'], country)
            log_info("Used regex fallback")

    # Clean sections in chapters (skip if fast_mode)
    if doc.get('chapters') and not fast_mode:
        # Count total sections
        total_sections = sum(len(ch.get('sections', [])) for ch in doc['chapters'])

        if total_sections > 0 and use_ai:
            print(f"  Processing {total_sections} sections...")
            pbar = create_progress_bar(total_sections, desc=f"{title} sections")

        cleaned_chapters = []
        section_count = 0

        for chapter in doc['chapters']:
            cleaned_chapter = chapter.copy()
            if chapter.get('sections'):
                cleaned_sections = []
                for section in chapter['sections']:
                    section_count += 1
                    cleaned_section = section.copy()
                    section_title = section.get('title', section.get('number', f'Section {section_count}'))

                    if section.get('text'):
                        if use_ai and len(section['text']) > 200:
                            if HAS_TQDM:
                                pbar.set_description(f"  {section_title[:30]}")
                            try:
                                cleaned_section['text'] = clean_text_with_ai(
                                    api_key, section['text'],
                                    section_title,
                                    country
                                )
                                time.sleep(0.3)  # Rate limiting
                            except Exception as e:
                                cleaned_section['text'] = clean_text_with_regex(section['text'], country)
                        else:
                            cleaned_section['text'] = clean_text_with_regex(section['text'], country)

                    cleaned_sections.append(cleaned_section)

                    if total_sections > 0 and use_ai:
                        pbar.update(1)

                cleaned_chapter['sections'] = cleaned_sections
            cleaned_chapters.append(cleaned_chapter)

        if total_sections > 0 and use_ai:
            pbar.close()

        cleaned_doc['chapters'] = cleaned_chapters
    elif doc.get('chapters') and fast_mode:
        # Fast mode: only use regex on sections
        log_info("Fast mode: cleaning sections with regex only")
        cleaned_chapters = []
        for chapter in doc['chapters']:
            cleaned_chapter = chapter.copy()
            if chapter.get('sections'):
                cleaned_sections = []
                for section in chapter['sections']:
                    cleaned_section = section.copy()
                    if section.get('text'):
                        cleaned_section['text'] = clean_text_with_regex(section['text'], country)
                    cleaned_sections.append(cleaned_section)
                cleaned_chapter['sections'] = cleaned_sections
            cleaned_chapters.append(cleaned_chapter)
        cleaned_doc['chapters'] = cleaned_chapters

    log_success(f"Completed {title}")
    return cleaned_doc


def process_database(country: str, api_key: str, use_ai: bool = True, fast_mode: bool = False):
    """Process a country's database"""
    base_path = Path(__file__).parent.parent / 'eu_safety_laws' / country.lower()
    input_file = base_path / f'{country.lower()}_database.json'
    output_file = base_path / f'{country.lower()}_database_cleaned.json'
    backup_file = base_path / f'{country.lower()}_database_backup.json'

    country_names = {'AT': 'Austrian', 'DE': 'German', 'NL': 'Netherlands'}
    log_header(f"{country_names.get(country, country)} Law Database Cleanup")

    # Check input file
    if not input_file.exists():
        log_error(f"Input file not found: {input_file}")
        return False

    log_success(f"Input file: {input_file}")

    # Read database
    log_info("Reading database...")
    with open(input_file, 'r', encoding='utf-8') as f:
        database = json.load(f)

    documents = database.get('documents', [])
    log_success(f"Loaded {len(documents)} documents")

    # Create backup
    log_info("Creating backup...")
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=2, ensure_ascii=False)
    log_success(f"Backup created: {backup_file}")

    # Process documents
    print(f"\n{'-'*40}")
    print(f"{Colors.BLUE}Processing documents...{Colors.RESET}")
    print(f"{'-'*40}\n")

    cleaned_documents = []
    errors = []

    for i, doc in enumerate(documents):
        try:
            cleaned_doc = process_document(api_key, doc, i, len(documents), country, use_ai, fast_mode)
            cleaned_documents.append(cleaned_doc)
            time.sleep(0.5)  # Rate limiting between documents
        except Exception as e:
            log_error(f"Failed to process document {i + 1}: {e}")
            errors.append({'index': i, 'title': doc.get('title', ''), 'error': str(e)})
            cleaned_documents.append(doc)  # Keep original on error

    # Save cleaned database
    print(f"\n{'-'*40}")
    print(f"{Colors.BLUE}Saving results...{Colors.RESET}")
    print(f"{'-'*40}\n")

    cleaned_database = database.copy()
    cleaned_database['metadata'] = database.get('metadata', {}).copy()
    cleaned_database['metadata']['cleaned_at'] = datetime.now().isoformat()
    cleaned_database['metadata']['cleaning_errors'] = len(errors)
    cleaned_database['documents'] = cleaned_documents

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cleaned_database, f, indent=2, ensure_ascii=False)

    log_success(f"Cleaned database saved: {output_file}")

    # Summary
    print(f"\n{'='*60}")
    print(f"{Colors.BLUE}Summary{Colors.RESET}")
    print(f"{'='*60}")
    print(f"Total documents: {len(documents)}")
    print(f"Successfully cleaned: {len(documents) - len(errors)}")
    print(f"Errors: {len(errors)}")

    if errors:
        print("\nErrors:")
        for e in errors:
            print(f"  - {e['title']}: {e['error']}")

    print(f"\nOutput file: {output_file}")
    print(f"Backup file: {backup_file}")
    print(f"\nTo apply changes, run:")
    print(f"  mv {output_file} {input_file}")
    print(f"{'='*60}\n")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='Clean EU Safety Laws databases using Gemini AI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python clean_databases.py --all              # Clean all databases
    python clean_databases.py --country AT       # Clean Austrian database only
    python clean_databases.py --country DE       # Clean German database only
    python clean_databases.py --country NL       # Clean Netherlands database only
    python clean_databases.py --all --fast       # Only clean full_text (much faster)
    python clean_databases.py --all --no-ai      # Use regex only (no API needed)

Environment:
    Set GEMINI_API_KEY environment variable or create a .env file
        """
    )
    parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to clean')
    parser.add_argument('--all', action='store_true', help='Clean all databases')
    parser.add_argument('--fast', action='store_true', help='Fast mode: only clean full_text with AI, use regex for sections')
    parser.add_argument('--no-ai', action='store_true', help='Use regex only, no Gemini API')

    args = parser.parse_args()

    if not args.country and not args.all:
        parser.print_help()
        sys.exit(1)

    # Check for API key (unless using --no-ai)
    api_key = None
    if not args.no_ai:
        api_key = get_api_key()
        if not api_key:
            log_error("GEMINI_API_KEY not found!")
            print("\nPlease set the API key using one of these methods:")
            print("  1. Environment variable: export GEMINI_API_KEY=your_key")
            print("  2. Create a .env file with: GEMINI_API_KEY=your_key")
            print("  3. Use --no-ai flag to use regex-only cleaning")
            sys.exit(1)
        log_success("API key found")

        if not HAS_GENAI and not HAS_REQUESTS:
            log_error("Neither google-generativeai nor requests package is installed.")
            print("\nInstall one with:")
            print("  pip install google-generativeai")
            print("  OR")
            print("  pip install requests")
            sys.exit(1)
    else:
        log_info("Using regex-only mode (no AI)")

    if args.fast:
        log_info("Fast mode: AI for full_text only, regex for sections")

    # Process databases
    countries = ['AT', 'DE', 'NL'] if args.all else [args.country]

    for country in countries:
        process_database(country, api_key, use_ai=not args.no_ai, fast_mode=args.fast)


if __name__ == '__main__':
    main()

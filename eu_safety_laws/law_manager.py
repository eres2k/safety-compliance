#!/usr/bin/env python3
"""
EU Safety Laws Database Manager
===============================
by Erwin Esener @eeesener

A unified CLI tool for managing EU safety law databases (AT, DE, NL).

Commands:
    scrape        - Scrape laws from official government sources
    check-updates - Check which laws have changed since last scrape
    clean         - Clean scraped content using AI (Gemini) or regex
    restructure   - Reorganize laws into official chapter structure
    build         - Build/export the complete database
    status        - Show database status and statistics
    all           - Run complete pipeline: scrape -> clean -> restructure -> wikipedia -> build
    wikipedia     - Scrape related Wikipedia articles (with --ai-suggest for AI recommendations)

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

    # Wikipedia with AI suggestions
    python law_manager.py wikipedia --country AT --ai-suggest  # AI suggests relevant articles

    # Other commands
    python law_manager.py clean --all --fast
    python law_manager.py restructure --all
    python law_manager.py build
    python law_manager.py status
    python law_manager.py all --country DE --laws 2       # Full pipeline with 2 laws

Environment:
    GEMINI_API_KEY: Required for AI-powered cleaning and Wikipedia suggestions

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
from datetime import datetime, timedelta
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

# PDF parsing support - try multiple libraries
HAS_PDF = False
PDF_LIBRARY = None
try:
    import pdfplumber
    HAS_PDF = True
    PDF_LIBRARY = 'pdfplumber'
except ImportError:
    try:
        import PyPDF2
        HAS_PDF = True
        PDF_LIBRARY = 'pypdf2'
    except ImportError:
        try:
            import fitz  # PyMuPDF
            HAS_PDF = True
            PDF_LIBRARY = 'pymupdf'
        except ImportError:
            pass


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class Config:
    """Global configuration for the law manager."""
    base_path: Path = field(default_factory=lambda: Path(__file__).parent)
    scraper_version: str = "8.0.0"  # Multi-country scraping with PDF management
    request_timeout: int = 60
    rate_limit_delay: float = 0.1  # 100ms base delay between requests
    max_retries: int = 3
    gemini_model: str = "gemini-2.5-flash-lite"  # Higher rate limits for scraping
    # Parallel processing settings (optimized for Gemini 2.5 Flash Lite limits)
    # Rate Limits: 4K RPM, 4M TPM, Unlimited RPD
    max_parallel_scrapes: int = 8  # Concurrent law scrapes (non-AI)
    max_parallel_ai_requests: int = 50  # 4K RPM allows many parallel requests
    ai_rate_limit_delay: float = 0.02  # 20ms between AI batches (4K RPM = 66/sec)
    ai_max_tokens: int = 8192
    # Cost warning thresholds (in characters)
    large_file_warning_chars: int = 100000  # Warn when file > 100K chars
    massive_file_warning_chars: int = 500000  # Strong warning when file > 500K chars

    # PDF storage directory
    pdf_storage_dir: Path = field(default_factory=lambda: Path(__file__).parent / "pdfs")

    # Source URLs - laws are ordered by relevance (first = most important)
    sources: Dict[str, Dict[str, str]] = field(default_factory=lambda: {
        "AT": {
            "base_url": "https://www.ris.bka.gv.at",
            "authority": "RIS",
            "structure_labels": {
                "grouping_1": "Abschnitt",
                "grouping_2": "Unterabschnitt",
                "article": "§"
            },
            "main_laws": {
                "ASchG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910",      # Worker Protection Act
                "AZG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008238",        # Working Time Act
                "ARG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008374",        # Rest Period Act
                "MSchG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008464",      # Maternity Protection Act
                "KJBG": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008632",       # Child and Youth Employment Act
                "AStV": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001927",       # Workplace Regulation
                "AM-VO": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20000727",      # Work Equipment Regulation (Arbeitsmittelverordnung)
                "DOK-VO": "/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009021",     # Documentation Regulation (Sicherheits- und Gesundheitsschutzdokumente)
            }
        },
        "DE": {
            "base_url": "https://www.gesetze-im-internet.de",
            "authority": "gesetze-im-internet.de",
            "structure_labels": {
                "grouping_1": "Abschnitt",  # Or "Buch" for larger laws like BGB
                "grouping_2": "Titel",
                "article": "§"
            },
            "main_laws": {
                "ArbSchG": "/arbschg/",           # Occupational Safety Act
                "ASiG": "/asig/",                 # Workplace Safety Act
                "ArbZG": "/arbzg/",               # Working Time Act
                "MuSchG": "/muschg_2018/",        # Maternity Protection Act
                "JArbSchG": "/jarbschg/",         # Youth Labor Protection Act
                "ArbStättV": "/arbst_ttv_2004/",  # Workplace Ordinance
                "BetrSichV": "/betrsichv_2015/",  # Industrial Safety Regulation
                "GefStoffV": "/gefstoffv_2010/",  # Hazardous Substances Ordinance
            }
        },
        "NL": {
            "base_url": "https://wetten.overheid.nl",
            "authority": "wetten.overheid.nl",
            "structure_labels": {
                "grouping_1": "Hoofdstuk",
                "grouping_2": "Afdeling",
                "article": "Artikel"
            },
            "main_laws": {
                "Arbowet": "/BWBR0010346/geldend",           # Working Conditions Act
                "Arbobesluit": "/BWBR0008498/geldend",      # Working Conditions Decree
                "Arboregeling": "/BWBR0008587/geldend",    # Working Conditions Regulation
                "Arbeidstijdenwet": "/BWBR0007671/geldend", # Working Time Act
                "ATB": "/BWBR0007687/geldend",              # Working Time Decree
            }
        }
    })

    # Merkblätter / Supplementary sources (PDFs from safety organizations)
    # NOTE: These are supplementary sources only - main laws come from official government HTML sources
    merkblaetter_sources: Dict[str, Dict[str, Any]] = field(default_factory=lambda: {
        "AT": {
            "auva": {
                "name": "AUVA Merkblätter",
                "base_url": "https://auva.at",
                "authority": "AUVA",
                "description": "Allgemeine Unfallversicherungsanstalt - Austrian accident insurance",
                "series": {
                    "M": {
                        "name": "M-Reihe",
                        "description": "Merkblätter zur Arbeitssicherheit"
                    },
                    "M.plus": {
                        "name": "M.plus",
                        "description": "Erweiterte Merkblätter"
                    }
                },
                # AUVA downloads search page - source for all publications with download links
                "catalog_url": "https://auva.at/downloads/downloads-search/?publicationsWithDownloadOnly=true&category=publications&showTabs=publications%2Cadditional-documents",
                "publications": [
                    # === M.plus Series (Expanded Information Sheets, DIN-A4) ===
                    # M.plus 0xx - General/Legal
                    {
                        "abbrev": "AUVA M.plus 012",
                        "title": "M.plus 012 - Sommerliche Hitze - Präventionsmaßnahmen",
                        "title_en": "Summer Heat - Prevention Measures",
                        "url": "https://auva.at/media/n4kpeyhq/mplus_012_sommerliche_hitze_praeventionsmassnahmen_2023-07_.pdf",
                        "series": "M.plus",
                        "description": "Prevention measures for summer heat at the workplace"
                    },
                    {
                        "abbrev": "AUVA M.plus 019",
                        "title": "M.plus 019 - Gesetzliche Bestimmungen für Lärmbetriebe",
                        "title_en": "Legal Regulations for Noisy Workplaces",
                        "url": "https://auva.at/media/v5sbtwcv/mplus_019_gesetzliche_bestimmungen_fuer_laermbetriebe_bf.pdf",
                        "series": "M.plus",
                        "description": "Legal requirements for noise control in workplaces"
                    },
                    {
                        "abbrev": "AUVA M.plus 022",
                        "title": "M.plus 022 - Telearbeitsplätze",
                        "title_en": "Telework/Remote Workplaces",
                        "url": "https://auva.at/media/iswlvmmn/mplus-022_telearbeitsplaetze_bf_2504.pdf",
                        "series": "M.plus",
                        "description": "Safety guidelines for remote work and home offices"
                    },
                    # M.plus 040 - Workplace Evaluation Series
                    {
                        "abbrev": "AUVA M.plus 040",
                        "title": "M.plus 040 - Arbeitsplatzevaluierung",
                        "title_en": "Workplace Evaluation",
                        "url": "https://auva.at/media/zzcjdtxk/mplus_040_arbeitsplatzevaluierung_bf_06-2022.pdf",
                        "series": "M.plus",
                        "description": "Comprehensive guide for workplace hazard evaluation"
                    },
                    {
                        "abbrev": "AUVA M.plus 040.E1",
                        "title": "M.plus 040.E1 - Evaluierung von mechanischen Gefährdungen",
                        "title_en": "Evaluation of Mechanical Hazards",
                        "url": "https://auva.at/media/mcnkpcmc/mplus_040e1_evaluierung_von_mechanischen_gefaehrdungen_202.pdf",
                        "series": "M.plus",
                        "description": "Evaluation of mechanical hazards in the workplace"
                    },
                    {
                        "abbrev": "AUVA M.plus 040.E2",
                        "title": "M.plus 040.E2 - Evaluierung von Sturz- und Absturzgefahren",
                        "title_en": "Evaluation of Fall Hazards",
                        "url": "https://auva.at/media/jvuf53wp/mplus_040e2_evaluierung_sturz-und_absturzgefahren_personen.pdf",
                        "series": "M.plus",
                        "description": "Evaluation of fall and trip hazards"
                    },
                    {
                        "abbrev": "AUVA M.plus 040.E4",
                        "title": "M.plus 040.E4 - Evaluierung chemischer Arbeitsstoffe",
                        "title_en": "Evaluation of Chemical Substances",
                        "url": "https://auva.at/media/ry0gy2cs/mplus-040e4-chemische-arbeitsstoffe-bf.pdf",
                        "series": "M.plus",
                        "description": "Evaluation of chemical workplace hazards"
                    },
                    {
                        "abbrev": "AUVA M.plus 040.E8",
                        "title": "M.plus 040.E8 - Evaluierung von Lärmbelastungen",
                        "title_en": "Evaluation of Noise Exposure",
                        "url": "https://auva.at/media/vs0j2fpc/mplus_040e8_evaluierung_von_laermbelastung_bf.pdf",
                        "series": "M.plus",
                        "description": "Evaluation of noise exposure at work"
                    },
                    {
                        "abbrev": "AUVA M.plus 040.E17",
                        "title": "M.plus 040.E17 - Evaluierung von Büro- und Bildschirmarbeitsplätzen",
                        "title_en": "Evaluation of Office and Screen Workplaces",
                        "url": "https://auva.at/media/ghlabert/mplus_040e17_evaluierung_buero_bildschirmarbeitsplaetze_20.pdf",
                        "series": "M.plus",
                        "description": "Evaluation of office and computer workstations"
                    },
                    {
                        "abbrev": "AUVA M.plus 070",
                        "title": "M.plus 070 - Unterweisung",
                        "title_en": "Safety Training/Instruction",
                        "url": "https://auva.at/media/jyvn53st/mplus_070_unterweisung_0725_bf.pdf",
                        "series": "M.plus",
                        "description": "Guidelines for workplace safety training and instruction"
                    },
                    # M.plus 3xx - Hazardous Substances
                    {
                        "abbrev": "AUVA M.plus 302",
                        "title": "M.plus 302 - Gefährliche Arbeitsstoffe - Information und Unterweisung",
                        "title_en": "Hazardous Substances - Information and Training",
                        "url": "https://auva.at/media/cxskvf0b/mplus_302_gefaehrliche_arbeitsstoffe_information_und_unterw.pdf",
                        "series": "M.plus",
                        "description": "Information and training for handling hazardous substances"
                    },
                    {
                        "abbrev": "AUVA M.plus 327",
                        "title": "M.plus 327 - Einsteigen in enge Räume und Behälter",
                        "title_en": "Entering Confined Spaces and Containers",
                        "url": "https://auva.at/media/4jdoprhy/mplus_327_einsteigen_in_enge_raeume_und_behaelter_bf.pdf",
                        "series": "M.plus",
                        "description": "Safety guidelines for confined space entry"
                    },
                    {
                        "abbrev": "AUVA M.plus 330",
                        "title": "M.plus 330 - Lagerung von gefährlichen Arbeitsstoffen",
                        "title_en": "Storage of Hazardous Substances",
                        "url": "https://auva.at/media/ab1lkldo/mplus_330_lagerung-von-gefaehrlichen-arbeitsstoffen_bf_2511.pdf",
                        "series": "M.plus",
                        "description": "Guidelines for safe storage of hazardous substances"
                    },
                    {
                        "abbrev": "AUVA M.plus 340.2",
                        "title": "M.plus 340.2 - Krebserzeugende Arbeitsstoffe in Kunststoffspritzgießereien",
                        "title_en": "Carcinogenic Substances in Plastic Injection Molding",
                        "url": "https://auva.at/media/nodjy2jp/mplus_3402_krebserzeugende_arbeitsstoffe_kunststoffspritzg.pdf",
                        "series": "M.plus",
                        "description": "Safety for carcinogenic substances in plastic manufacturing"
                    },
                    {
                        "abbrev": "AUVA M.plus 340.7",
                        "title": "M.plus 340.7 - Gesundheitsgefährdende Stoffe in öffentlichen Apotheken",
                        "title_en": "Hazardous Substances in Public Pharmacies",
                        "url": "https://auva.at/media/siqp5rqv/mplus_3407_gesundheitsgefaehrdende_stoffe_in_oeffentlichen.pdf",
                        "series": "M.plus",
                        "description": "Safety for handling hazardous substances in pharmacies"
                    },
                    {
                        "abbrev": "AUVA M.plus 301",
                        "title": "M.plus 301 - Explosionsschutz",
                        "title_en": "Explosion Protection",
                        "url": "https://auva.at/media/zhxfgjcu/mplus_301_explosionsschutz_bf.pdf",
                        "series": "M.plus",
                        "description": "Explosion protection in the workplace"
                    },
                    {
                        "abbrev": "AUVA M.plus 361",
                        "title": "M.plus 361 - Musterbetriebsanweisung Ergänzung",
                        "title_en": "Sample Operating Instructions Supplement",
                        "url": "https://auva.at/media/a2km3njh/mplus_361_ergaenzung_4_musterbetriebsanweisung_2023_bf.pdf",
                        "series": "M.plus",
                        "description": "Sample operating instructions for hazardous substances"
                    },
                    {
                        "abbrev": "AUVA M.plus 369",
                        "title": "M.plus 369 - Kühlschmierstoffe",
                        "title_en": "Cooling Lubricants",
                        "url": "https://auva.at/media/fkmeiimb/mplus-369-kuehlschmierstoffe-bf.pdf",
                        "series": "M.plus",
                        "description": "Safe handling of cooling lubricants in machining"
                    },
                    # M.plus 5xx - Forestry
                    {
                        "abbrev": "AUVA M.plus 521",
                        "title": "M.plus 521 - Forstliche Arbeiten mit der Motorsäge",
                        "title_en": "Forestry Work with Chainsaws",
                        "url": "https://auva.at/media/p0ybmq2g/mplus_521_forstliche_arbeiten_mit_der_motorsaege_bf.pdf",
                        "series": "M.plus",
                        "description": "Safety guidelines for chainsaw work in forestry"
                    },
                    {
                        "abbrev": "AUVA M.plus 523",
                        "title": "M.plus 523 - Forstliche Seilbringung",
                        "title_en": "Forestry Cable Logging",
                        "url": "https://auva.at/media/lrgf0pdk/mplus_523_forstliche_seilbringung_bf.pdf",
                        "series": "M.plus",
                        "description": "Safety for cable logging operations in forestry"
                    },
                    # M.plus 7xx - Personal Protective Equipment
                    {
                        "abbrev": "AUVA M.plus 700",
                        "title": "M.plus 700 - Gehörschutz",
                        "title_en": "Hearing Protection",
                        "url": "https://auva.at/media/cjwjl21s/mplus-700-gehoerschutz-bf.pdf",
                        "series": "M.plus",
                        "description": "Selection and use of hearing protection"
                    },
                    # M.plus 8xx - Transport & Vehicles
                    {
                        "abbrev": "AUVA M.plus 800",
                        "title": "M.plus 800 - Sicher unterwegs",
                        "title_en": "Safe on the Road",
                        "url": "https://auva.at/media/nh1bq3eh/mplus_800_sicher_unterwegs_bf.pdf",
                        "series": "M.plus",
                        "description": "Traffic safety for work-related travel"
                    },
                    {
                        "abbrev": "AUVA M.plus 801",
                        "title": "M.plus 801 - Fahrradbotendienste",
                        "title_en": "Bicycle Courier Services",
                        "url": "https://auva.at/media/nrljnr11/mplus_801_fahrradbotendienste_2023-02_bf.pdf",
                        "series": "M.plus",
                        "description": "Safety for bicycle courier services"
                    },
                    # AUVA E-Series - Evaluation Documents
                    {
                        "abbrev": "AUVA E 14",
                        "title": "E 14 - Evaluierung psychischer Belastungen (ABS Gruppe)",
                        "title_en": "Evaluation of Psychological Stress (ABS Group Method)",
                        "url": "https://auva.at/media/1klpjgis/e_14_evaluierung_psychischer_belastungen_abs_bf.pdf",
                        "series": "E",
                        "description": "Psychological stress evaluation using ABS group method"
                    },
                    {
                        "abbrev": "AUVA E 24 EVALOG",
                        "title": "E 24 EVALOG - Evaluierung psychischer Belastung im Dialog",
                        "title_en": "EVALOG - Psychological Stress Evaluation through Dialogue",
                        "url": "https://auva.at/media/gybkl0hm/e_24_evalog_evaluierung_psychischer_belastung_im_dialog_bf.pdf",
                        "series": "E",
                        "description": "Comprehensive psychological stress evaluation guide"
                    },
                    {
                        "abbrev": "AUVA E 13",
                        "title": "E 13 - Evaluierung physischer Belastungen",
                        "title_en": "Evaluation of Physical Stress",
                        "url": "https://auva.at/media/qvnajezk/e_13_physische_belastungen.pdf",
                        "series": "E",
                        "description": "Physical ergonomic stress evaluation"
                    },
                    {
                        "abbrev": "AUVA M.plus 931",
                        "title": "M.plus 931 - XR-Technologien am Arbeitsplatz",
                        "title_en": "XR Technologies at the Workplace",
                        "url": "https://auva.at/media/jvcpfyhg/mplus_931_xr_technologien_bf.pdf",
                        "series": "M.plus",
                        "description": "Safety for extended reality technologies at work"
                    },
                    {
                        "abbrev": "AUVA M.plus 942",
                        "title": "M.plus 942 - Fahrerlose Transportsysteme und mobile Roboter",
                        "title_en": "Driverless Transport Systems and Mobile Robots",
                        "url": "https://auva.at/media/3scjz5tv/mplus_942_fahrerlose_transportsysteme_und_mobile_roboter_bf.pdf",
                        "series": "M.plus",
                        "description": "Safety for autonomous transport systems and mobile robots"
                    },
                    # === M-Reihe (Compact Information Sheets, DIN-A5) ===
                    # M 0xx - General/Legal
                    {
                        "abbrev": "AUVA M 030",
                        "title": "M 030 - ArbeitnehmerInnenschutzgesetz",
                        "title_en": "Worker Protection Act",
                        "url": "https://auva.at/media/kwjputxz/m_030_arbeitnehmerinnenschutzgesetz_bf_2505.pdf",
                        "series": "M",
                        "description": "Overview of the Austrian Worker Protection Act (ASchG)"
                    },
                    {
                        "abbrev": "AUVA M 041",
                        "title": "M 041 - Verordnung über Sicherheits- und Gesundheitsschutzdokumente",
                        "title_en": "Regulation on Safety and Health Documents",
                        "url": "https://auva.at/media/gf3drt5e/m_041_verordnung_ueber_sicherheits-_und_gesundheitsschutzdok.pdf",
                        "series": "M",
                        "description": "Requirements for safety and health documentation"
                    },
                    {
                        "abbrev": "AUVA M 080",
                        "title": "M 080 - Grundlagen der Lasersicherheit",
                        "title_en": "Fundamentals of Laser Safety",
                        "url": "https://auva.at/media/ahopxkb3/m_080_grundlagen_der_lasersicherheit_2023-07_bf.pdf",
                        "series": "M",
                        "description": "Basics of laser safety in the workplace"
                    },
                    # M 3xx - Hazardous Substances
                    {
                        "abbrev": "AUVA M 364",
                        "title": "M 364 - Umgang mit ätzenden Stoffen",
                        "title_en": "Handling Corrosive Substances",
                        "url": "https://auva.at/media/tytfmukw/m_364_umgang_mit_aetzenden_stoffen.pdf",
                        "series": "M",
                        "description": "Safe handling of corrosive acids and alkalis"
                    },
                    {
                        "abbrev": "AUVA M 391",
                        "title": "M 391 - Sicherer Umgang mit gefährlichen Arbeitsstoffen",
                        "title_en": "Safe Handling of Hazardous Substances",
                        "url": "https://auva.at/media/ds1jpe1o/m_391_sicherer_umgang_mit_gefaehrlichen_arbeitsstoffen.pdf",
                        "series": "M",
                        "description": "General guidelines for safe handling of hazardous substances"
                    },
                    # M 7xx - Personal Protective Equipment
                    {
                        "abbrev": "AUVA M 705",
                        "title": "M 705 - Schutzhandschuhe",
                        "title_en": "Protective Gloves",
                        "url": "https://auva.at/media/efdj33nn/m705-schutzhandschuhe-bf.pdf",
                        "series": "M",
                        "description": "Selection and use of protective gloves"
                    },
                    {
                        "abbrev": "AUVA M 719",
                        "title": "M 719 - Atemschutzfilter gegen Schwebstoffe, Gase und Dämpfe",
                        "title_en": "Respiratory Protection Filters",
                        "url": "https://auva.at/media/nwwlrfpq/m_719_atemschutzfilter_gegen_schwebstoffe_gase_daempfe_bf_20.pdf",
                        "series": "M",
                        "description": "Selection of respiratory protection filters"
                    },
                    # === General Resources ===
                    {
                        "abbrev": "AUVA Basiswissen 2025",
                        "title": "Basiswissen Arbeitnehmer:innenschutz 2025",
                        "title_en": "Basic Knowledge Worker Protection 2025",
                        "url": "https://auva.at/media/peujs3al/basiswissen-arbeitnehmerschutz-bf.pdf",
                        "series": "Basiswissen",
                        "description": "Comprehensive overview of Austrian worker protection laws 2025"
                    },
                    {
                        "abbrev": "AUVAsicher 2024-2025",
                        "title": "AUVAsicher Informationsbroschüre 2024-2025",
                        "title_en": "AUVAsicher Information Brochure 2024-2025",
                        "url": "https://auva.at/media/0cpp1f4l/auvasicher_informationsbroschuere_2024.pdf",
                        "series": "AUVAsicher",
                        "description": "Annual safety information and prevention resources"
                    }
                ]
            }
        },
        "DE": {
            "dguv": {
                "name": "DGUV Publikationen",
                "base_url": "https://publikationen.dguv.de",
                "authority": "DGUV",
                "description": "Deutsche Gesetzliche Unfallversicherung publications",
                "series": {
                    "vorschriften": {
                        "name": "DGUV Vorschriften",
                        "description": "Unfallverhütungsvorschriften (accident prevention regulations)"
                    },
                    "regeln": {
                        "name": "DGUV Regeln",
                        "description": "Regeln für Sicherheit und Gesundheit bei der Arbeit"
                    },
                    "information": {
                        "name": "DGUV Informationen",
                        "description": "Informationsschriften"
                    }
                },
                "catalog_url": "https://publikationen.dguv.de/regelwerk/",
                "publications": [
                    # === DGUV Vorschriften (Regulations) ===
                    # Note: Using alternative BG sources since publikationen.dguv.de blocks automated requests
                    {
                        "abbrev": "DGUV Vorschrift 1",
                        "title": "DGUV Vorschrift 1 - Grundsätze der Prävention",
                        "title_en": "Principles of Prevention",
                        "url": "https://www.bgw-online.de/resource/blob/14912/e141a3911799926481707fcc42781122/dguv-vorschrift1-grundsaetze-der-praevention-data.pdf",
                        "series": "vorschriften",
                        "description": "Basic prevention principles for all industries"
                    },
                    {
                        "abbrev": "DGUV Vorschrift 1 (UK-NRW)",
                        "title": "DGUV Vorschrift 1 - Grundsätze der Prävention (Unfallkasse NRW)",
                        "title_en": "Principles of Prevention (NRW Accident Insurance)",
                        "url": "https://www.unfallkasse-nrw.de/fileadmin/server/download/Regeln_und_Schriften/Unfallverhuetungsvorschriften/Vorschrift_01.pdf",
                        "series": "vorschriften",
                        "description": "Basic prevention principles - NRW version"
                    },
                    {
                        "abbrev": "DGUV Vorschrift 3",
                        "title": "DGUV Vorschrift 3 - Elektrische Anlagen und Betriebsmittel",
                        "title_en": "Electrical Installations and Equipment",
                        "url": "https://www.bgw-online.de/resource/blob/20602/a08d0fafd101155ffffad8739e108152/dguv-vorschrift3-unfallverhuetungsvorschrift-elektrische-anlagen-data.pdf",
                        "series": "vorschriften",
                        "description": "Safety requirements for electrical installations"
                    },
                    {
                        "abbrev": "DGUV Vorschrift 3 (VBG)",
                        "title": "DGUV Vorschrift 3 - Elektrische Anlagen und Betriebsmittel (VBG)",
                        "title_en": "Electrical Installations and Equipment (VBG)",
                        "url": "https://cdn.vbg.de/media/4d4d9675222842eb908cfe7c27afad8b/dld:attachment/DGUV_Vorschrift_3_Elektrische_Anlagen_und_Betriebsmittel.pdf",
                        "series": "vorschriften",
                        "description": "Electrical safety - VBG version"
                    },
                    {
                        "abbrev": "DGUV Vorschrift 3 (BGHM)",
                        "title": "DGUV Vorschrift 3 - Elektrische Anlagen und Betriebsmittel (BGHM)",
                        "title_en": "Electrical Installations and Equipment (BGHM)",
                        "url": "https://www.bghm.de/fileadmin/user_upload/Arbeitsschuetzer/Gesetze_Vorschriften/Vorschriften/DGUV-Vorschrift-3.pdf",
                        "series": "vorschriften",
                        "description": "Electrical safety for wood and metal industries"
                    },
                    # === DGUV Regeln (Rules) ===
                    {
                        "abbrev": "DGUV Regel 100-001",
                        "title": "DGUV Regel 100-001 - Grundsätze der Prävention",
                        "title_en": "Principles of Prevention - Implementation Rule",
                        "url": "https://www.bgw-online.de/resource/blob/13680/d302a42daa2cf8f05d66662c8e9e70e7/dguv-regel100-001-grundsaetze-der-praevention-data.pdf",
                        "series": "regeln",
                        "description": "Detailed implementation of DGUV Vorschrift 1"
                    },
                    # === DGUV Informationen (Information) ===
                    {
                        "abbrev": "DGUV Information 204-022",
                        "title": "DGUV Information 204-022 - Erste Hilfe im Betrieb",
                        "title_en": "First Aid at Work",
                        "url": "https://www.bgw-online.de/resource/blob/20492/528509ed5ef93ff67b6d414d55f78f84/dguv-information-204-022-erste-hilfe-im-betrieb-data.pdf",
                        "fallback_urls": [
                            "https://www.bgbau.de/fileadmin/Medien-Objekte/Medien/DGUV-Informationen/204_022/204_022.pdf"
                        ],
                        "series": "information",
                        "description": "First aid requirements and procedures"
                    },
                    {
                        "abbrev": "DGUV Information 208-033",
                        "title": "DGUV Information 208-033 - Belastungen für Rücken und Gelenke",
                        "title_en": "Strain on Back and Joints - Manual Handling",
                        "url": "https://www.bghm.de/fileadmin/user_upload/Arbeitsschuetzer/Gesetze_Vorschriften/Informationen/208-033.pdf",
                        "fallback_urls": [
                            "https://www.bgbau.de/fileadmin/Medien-Objekte/Medien/DGUV-Informationen/208_033/208-033_BGBAU.pdf"
                        ],
                        "series": "information",
                        "description": "Manual handling - back and joint protection"
                    },
                    {
                        "abbrev": "DGUV Information 208-053",
                        "title": "DGUV Information 208-053 - Mensch und Arbeitsplatz - Physische Belastung",
                        "title_en": "Human and Workplace - Physical Strain",
                        "url": "https://www.bgbau.de/fileadmin/Medien-Objekte/Medien/DGUV-Informationen/208_053/208-053_BGBAU_web.pdf",
                        "series": "information",
                        "description": "Physical strain assessment and ergonomics (June 2024)"
                    },
                    {
                        "abbrev": "DGUV Information 209-023",
                        "title": "DGUV Information 209-023 - Lärm am Arbeitsplatz",
                        "title_en": "Noise at the Workplace",
                        "url": "https://www.bghm.de/fileadmin/user_upload/Arbeitsschuetzer/Gesetze_Vorschriften/Informationen/209-023.pdf",
                        "series": "information",
                        "description": "Noise protection and hearing conservation"
                    },
                    {
                        "abbrev": "DGUV Information 212-024",
                        "title": "DGUV Information 212-024 - Gehörschutz",
                        "title_en": "Hearing Protection",
                        "url": "https://www.bgbau.de/fileadmin/Medien-Objekte/Medien/DGUV-Informationen/212_024/212_024.pdf",
                        "series": "information",
                        "description": "Selection and use of hearing protection"
                    },
                    {
                        "abbrev": "DGUV Information 214-083",
                        "title": "DGUV Information 214-083 - Der sicherheitsoptimierte Transporter",
                        "title_en": "The Safety-Optimized Van",
                        "url": "https://www.bgbau.de/fileadmin/Medien-Objekte/Medien/DGUV-Informationen/214_083/214-083_BGBAU.pdf",
                        "fallback_urls": [
                            "https://www.bg-verkehr.de/medien/medienkatalog/dguv-informationen/dguv-information-214-083/at_download/file"
                        ],
                        "series": "information",
                        "description": "Safety specifications for delivery vans"
                    },
                    # === DGUV Regeln (Rules) - Additional ===
                    {
                        "abbrev": "DGUV Regel 112-191",
                        "title": "DGUV Regel 112-191 - Benutzung von Fuß- und Knieschutz",
                        "title_en": "Use of Foot and Knee Protection",
                        "url": "https://www.uv-bund-bahn.de/fileadmin/Dokumente/Mediathek/112-991.pdf",
                        "series": "regeln",
                        "description": "Safety footwear selection and use"
                    },
                    {
                        "abbrev": "DGUV Regel 101-003",
                        "title": "DGUV Regel 101-003 - Ladungssicherung auf Fahrzeugen",
                        "title_en": "Load Securing on Vehicles",
                        "url": "https://www.bgbau-medien.de/handlungshilfen_gb/daten/dguv/101_003/ladungssicherung.pdf",
                        "series": "regeln",
                        "description": "Load securing for construction industry vehicles"
                    }
                ]
            }
        },
        "NL": {
            "arboportaal": {
                "name": "Arboportaal / Arbocatalogi",
                "base_url": "https://www.arboportaal.nl",
                "authority": "Arboportaal",
                "description": "Dutch work conditions portal and sector catalogues",
                "series": {
                    "arbocatalogi": {
                        "name": "Arbocatalogi",
                        "description": "Sector-specific working conditions catalogues"
                    },
                    "instrumenten": {
                        "name": "Instrumenten",
                        "description": "Tools and checklists for workplace safety"
                    }
                },
                "catalog_url": "https://www.arboportaal.nl/onderwerpen/arbocatalogi",
                "publications": [
                    # === Dutch Arbocatalogi (Sector Catalogues) ===
                    {
                        "abbrev": "Arbocatalogus Hoveniers",
                        "title": "Arbocatalogus Hoveniers en Groenvoorziening",
                        "title_en": "Occupational Health Catalogue - Gardeners and Landscaping",
                        "url": "https://www.landschapnoordholland.nl/files/2018-07/arbo%20catalogus%20hoveniers%20en%20groenvoorziening.pdf",
                        "series": "arbocatalogi",
                        "description": "Safety standards for gardening and landscaping sector"
                    },
                    {
                        "abbrev": "Arbocatalogus Kantoor",
                        "title": "Handreiking Kantooromgeving voor de Arbocatalogus",
                        "title_en": "Office Environment Guide for Arbocatalogi",
                        "url": "https://dearbocatalogus.nl/sites/default/files/stvda/handreikingen/handreiking_kantooromgeving.pdf",
                        "series": "arbocatalogi",
                        "description": "Safety standards for office environments"
                    },
                    {
                        "abbrev": "Arbocatalogus Linnen",
                        "title": "Arbocatalogus Linnenverhuur- en Wasserijbedrijven",
                        "title_en": "Occupational Health Catalogue - Linen Rental and Laundry",
                        "url": "https://www.raltex.nl/cms/files/2017-01/2012-arbocatalogus-linnen-en-wasserijbedrijven-lr.pdf",
                        "series": "arbocatalogi",
                        "description": "Safety standards for linen and laundry businesses"
                    },
                    {
                        "abbrev": "Arbocatalogus Retail Mode",
                        "title": "Arbocatalogus Retail Mode, Schoenen & Sport",
                        "title_en": "Occupational Health Catalogue - Fashion and Sports Retail",
                        "url": "https://www.werkindewinkel.nl/uploads/arbocatalogus-retail-mode-schoenen-sport-2020.cd5ead.pdf",
                        "series": "arbocatalogi",
                        "description": "Safety standards for fashion and sports retail"
                    },
                    {
                        "abbrev": "Arbocatalogus Bloemen",
                        "title": "Arbocatalogus Groothandel Bloemen en Planten",
                        "title_en": "Occupational Health Catalogue - Flower and Plant Wholesale",
                        "url": "https://www.vgb.nl/files/arbocatalogus.pdf",
                        "series": "arbocatalogi",
                        "description": "Safety standards for flower and plant wholesale"
                    },
                    {
                        "abbrev": "Arbocatalogus Uitzendbranche",
                        "title": "Arbocatalogus Arbobeleid Uitzendbranche",
                        "title_en": "Occupational Health Catalogue - Temporary Employment",
                        "url": "https://www.abu.nl/app/uploads/2019/09/Arbocatalogus-Algemeen-onderdeel-Arbobeleid-voor-vaste-medewerkers-in-de-uitzendbranche.pdf",
                        "series": "arbocatalogi",
                        "description": "Safety standards for temporary employment agencies"
                    },
                    # === Transport & Logistics (Key for Amazon delivery operations) ===
                    {
                        "abbrev": "Arbocatalogus Transport Warehouse",
                        "title": "Arbocatalogus Transport en Logistiek - Warehouse/Distributiecentrum",
                        "title_en": "Transport & Logistics - Warehouse/Distribution Center",
                        "url": "https://www.stl.nl/STL/media/STLMedia/Veilig%20en%20vitaal/Arbo/AC-2018-Warehouse-distributiecentrum-magazijn.pdf",
                        "series": "arbocatalogi",
                        "description": "Safety standards for warehouse and distribution operations (2018)"
                    }
                ]
            }
        }
    })


CONFIG = Config()

# =============================================================================
# Logistics Context Layer - Amazon Jargon Mapping
# =============================================================================
# Maps Amazon logistics terminology to legal/safety concepts for "native" context

LOGISTICS_JARGON_MAP = {
    # === Roles ===
    "stower": ["manual handling", "lifting", "ergonomics", "Lastenhandhabung", "tillen"],
    "picker": ["manual handling", "walking distances", "ergonomics", "repetitive motion"],
    "water spider": ["mobile workers", "manual handling", "forklift safety", "internal transport"],
    "problem solver": ["safety coordination", "incident reporting", "first aid"],
    "area manager": ["safety supervision", "instruction", "Unterweisung", "toezicht"],
    "dsp": ["road safety", "driving regulations", "working time", "Fahrpersonal", "rijden"],
    "da": ["delivery associate", "road safety", "manual handling", "driver safety"],
    "loader": ["manual handling", "loading safety", "vehicle safety", "Ladungssicherung"],
    "unloader": ["manual handling", "unloading", "conveyor safety", "ergonomics"],
    "sorter": ["conveyor safety", "repetitive motion", "PPE", "noise exposure"],

    # === Tasks / Operations ===
    "stowing": ["manual handling", "lifting weight limits", "Lastenhandhabung", "tillen"],
    "picking": ["walking", "manual handling", "repetitive tasks"],
    "inducting": ["conveyor operation", "machine safety", "Maschinensicherheit"],
    "diverting": ["conveyor operation", "sorting"],
    "loading vans": ["manual handling", "vehicle safety", "Ladungssicherung"],
    "sort": ["night work", "shift work", "working time", "Arbeitszeitgesetz", "Arbeidstijdenwet"],
    "night shift": ["night work", "Nachtarbeit", "nachtdienst", "health surveillance"],
    "day shift": ["working hours", "rest periods", "Ruhepausen"],
    "sunday work": ["rest day work", "Sonntagsarbeit", "zondagsarbeid"],

    # === Equipment ===
    "tote": ["manual handling", "lifting", "container handling"],
    "gaylord": ["bulk container", "manual handling", "pallet handling"],
    "pallet jack": ["forklift", "powered truck", "Flurförderzeug", "vorkheftruck"],
    "conveyor": ["conveyor belt", "Förderband", "transportband", "machine safety"],
    "scanner": ["ergonomics", "repetitive motion", "hand-arm vibration"],
    "van": ["commercial vehicle", "driving safety", "Fahrersicherheit"],
    "dolly": ["manual handling", "pushing/pulling", "Schieben und Ziehen"],

    # === Facilities ===
    "delivery station": ["workplace", "Arbeitsstätte", "arbeidsplaats", "warehouse"],
    "fc": ["fulfillment center", "warehouse", "Lager", "magazijn"],
    "dock": ["loading dock", "vehicle interface", "Laderampe"],
    "staging area": ["storage area", "pedestrian safety", "Verkehrswege"],
    "breakroom": ["rest area", "sanitary facilities", "Pausenraum", "pauzeruimte"],

    # === Safety Topics ===
    "safety shoes": ["Fußschutz", "Sicherheitsschuhe", "veiligheidsschoenen", "PPE footwear"],
    "high vis": ["high visibility", "Warnkleidung", "waarschuwingskleding", "PPE visibility"],
    "safety vest": ["high visibility vest", "Warnweste", "veiligheidsvest"],
    "ppe": ["personal protective equipment", "PSA", "persönliche Schutzausrüstung", "PBM"],
    "stretching": ["ergonomics", "warm-up exercises", "musculoskeletal prevention"],
}

# Cross-reference metrics for MEU Harmonizer
CROSS_BORDER_METRICS = {
    "max_lifting_weight": {
        "AT": {
            "value": "25kg (men) / 15kg (women)",
            "source": "ASchG + ÖNORM",
            "notes": "Reference values with risk assessment required above limits"
        },
        "DE": {
            "value": "25kg (reference, risk assessment)",
            "source": "Lastenhandhabungsverordnung",
            "notes": "No absolute limit, depends on risk assessment"
        },
        "NL": {
            "value": "23kg (NIOSH recommendation)",
            "source": "Arbobesluit + NIOSH",
            "notes": "Inspectorate uses NIOSH lifting equation"
        },
        "recommendation": "Adopt 23kg as internal limit to comply across all MEU stations"
    },
    "noise_limit": {
        "AT": {
            "value": "85 dB(A) action value, 87 dB(A) limit",
            "source": "VOLV §§ 4-6",
            "notes": "Hearing protection mandatory above 85 dB(A)"
        },
        "DE": {
            "value": "80/85 dB(A) action, 87 dB(A) limit",
            "source": "Lärm- und Vibrations-ArSchV",
            "notes": "Two-tier action values (80 = offer, 85 = mandatory)"
        },
        "NL": {
            "value": "80/85 dB(A) action, 87 dB(A) limit",
            "source": "Arbobesluit art. 6.7-6.11",
            "notes": "Similar to EU directive implementation"
        },
        "recommendation": "Use 80 dB(A) as trigger for hearing protection across all sites"
    },
    "rest_periods": {
        "AT": {
            "value": "30 min after 6h, 11h daily rest",
            "source": "AZG §§ 11, 12",
            "notes": "Breaks can be split into 15min parts"
        },
        "DE": {
            "value": "30 min after 6h (45 min after 9h), 11h daily rest",
            "source": "ArbZG §§ 4, 5",
            "notes": "Additional break required for 9+ hours"
        },
        "NL": {
            "value": "30 min after 5.5h, 11h daily rest",
            "source": "Arbeidstijdenwet art. 5:4",
            "notes": "Can be split into 2x15min"
        },
        "recommendation": "Apply NL standard (30min after 5.5h) for uniform MEU policy"
    },
    "first_aid_personnel": {
        "AT": {
            "value": "1 per 20-29 employees, 2 per 30-49",
            "source": "ASchG § 26",
            "notes": "Higher ratios for hazardous workplaces"
        },
        "DE": {
            "value": "1 per 20+ employees (5% minimum)",
            "source": "DGUV Vorschrift 1 § 26",
            "notes": "Minimum 5% of workforce"
        },
        "NL": {
            "value": "Sufficient based on RI&E",
            "source": "Arbobesluit art. 15",
            "notes": "Number determined by risk assessment"
        },
        "recommendation": "Apply 5% minimum or 1 per 20 employees across all sites"
    },
    "safety_officer_threshold": {
        "AT": {
            "value": "250+ employees require safety officer",
            "source": "ASchG § 73",
            "notes": "External SFK allowed for smaller sites"
        },
        "DE": {
            "value": "Required for all sizes (Fachkraft für Arbeitssicherheit)",
            "source": "ASiG § 5",
            "notes": "Hours depend on company size and hazard class"
        },
        "NL": {
            "value": "Required for all sizes (preventiemedewerker)",
            "source": "Arbowet art. 13",
            "notes": "Owner can be own prevention worker for <25 employees"
        },
        "recommendation": "Designate safety officer for all sites regardless of size"
    }
}

# Task-based requirement mapping
TASK_REQUIREMENTS_MAP = {
    # Task categories mapped to legal requirements
    "unloading": {
        "topics": ["manual handling", "PPE", "conveyor safety", "vehicle interface"],
        "laws": {
            "AT": ["ASchG §§ 62-64", "AM-VO", "AStV"],
            "DE": ["Lastenhandhabungsverordnung", "BetrSichV", "ArbStättV"],
            "NL": ["Arbobesluit Hfdst. 5", "NIOSH lifting equation"]
        },
        "shift_modifiers": {
            "night": ["Nachtarbeit provisions", "health surveillance"],
            "sunday": ["Sunday work approval", "extra compensation"]
        }
    },
    "sorting": {
        "topics": ["conveyor safety", "noise exposure", "repetitive motion", "PPE"],
        "laws": {
            "AT": ["ASchG", "VOLV", "AM-VO"],
            "DE": ["BetrSichV", "Lärm-VibrationsArbSchV", "ArbSchG"],
            "NL": ["Arbobesluit Hfdst. 6", "Machine-richtlijn"]
        }
    },
    "driving": {
        "topics": ["road safety", "working time", "rest periods", "vehicle safety"],
        "laws": {
            "AT": ["AZG", "ARG", "StVO", "KFG"],
            "DE": ["ArbZG", "FPersV", "StVO"],
            "NL": ["Arbeidstijdenwet", "Rijtijdenwet", "WvW"]
        },
        "equipment": ["van", "delivery vehicle"]
    },
    "office": {
        "topics": ["display screen work", "ergonomics", "indoor climate"],
        "laws": {
            "AT": ["BS-V (Bildschirmarbeitsverordnung)", "AStV"],
            "DE": ["ArbStättV Anhang 6", "Bildschirmarbeitsverordnung"],
            "NL": ["Arbobesluit art. 5.4-5.12"]
        }
    }
}


def translate_jargon_to_legal(search_term: str) -> List[str]:
    """
    Translate Amazon logistics jargon to legal/safety search terms.

    Example: "stower" -> ["manual handling", "lifting", "ergonomics", "Lastenhandhabung", "tillen"]
    """
    search_lower = search_term.lower().strip()

    # Direct match
    if search_lower in LOGISTICS_JARGON_MAP:
        return LOGISTICS_JARGON_MAP[search_lower]

    # Partial match
    expanded_terms = []
    for jargon, legal_terms in LOGISTICS_JARGON_MAP.items():
        if jargon in search_lower or search_lower in jargon:
            expanded_terms.extend(legal_terms)

    return list(set(expanded_terms)) if expanded_terms else [search_term]


def get_meu_harmonized_standard(metric_name: str) -> Optional[Dict[str, Any]]:
    """
    Get the strictest common denominator for a cross-border metric.

    Returns comparison across AT/DE/NL with AI recommendation.
    """
    if metric_name in CROSS_BORDER_METRICS:
        return CROSS_BORDER_METRICS[metric_name]

    # Fuzzy match
    metric_lower = metric_name.lower().replace("_", " ").replace("-", " ")
    for key, value in CROSS_BORDER_METRICS.items():
        key_readable = key.replace("_", " ")
        if metric_lower in key_readable or key_readable in metric_lower:
            return value

    return None


def get_task_requirements(task: str, shift: str = "day", equipment: List[str] = None) -> Dict[str, Any]:
    """
    Generate legal requirements based on task, shift, and equipment.

    Example: get_task_requirements("sorting", shift="night", equipment=["conveyor"])
    """
    task_lower = task.lower().strip()

    # Find matching task
    task_config = None
    for task_key, config in TASK_REQUIREMENTS_MAP.items():
        if task_key in task_lower or task_lower in task_key:
            task_config = config
            break

    if not task_config:
        return {"error": f"Unknown task: {task}. Available: {list(TASK_REQUIREMENTS_MAP.keys())}"}

    result = {
        "task": task,
        "shift": shift,
        "topics": task_config.get("topics", []),
        "laws_by_country": task_config.get("laws", {}),
        "equipment_required": equipment or []
    }

    # Add shift modifiers
    if shift.lower() in task_config.get("shift_modifiers", {}):
        result["shift_requirements"] = task_config["shift_modifiers"][shift.lower()]

    return result


# =============================================================================
# AI-Powered Dead Link Detection and Auto-Fix
# =============================================================================

def check_url_validity(url: str, timeout: int = 10) -> Dict[str, Any]:
    """Check if a URL is valid and accessible."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.head(url, timeout=timeout, headers=headers, allow_redirects=True)
        return {
            "url": url,
            "valid": response.status_code == 200,
            "status_code": response.status_code,
            "final_url": response.url if response.url != url else None,
            "content_type": response.headers.get('Content-Type', '')
        }
    except requests.RequestException as e:
        return {
            "url": url,
            "valid": False,
            "status_code": None,
            "error": str(e)
        }


def find_replacement_url_with_ai(broken_url: str, doc_title: str, authority: str) -> Optional[str]:
    """Use AI to suggest a replacement URL for a dead link."""
    if not HAS_GEMINI:
        return None

    prompt = f"""A PDF document link is broken. Help find the correct URL.

Document: {doc_title}
Authority: {authority}
Broken URL: {broken_url}

Based on the URL pattern and document title, suggest what the correct URL might be.
Consider:
1. The authority's website structure
2. Common URL patterns for PDFs (e.g., /media/, /downloads/, /publikationen/)
3. Document naming conventions

Return ONLY the suggested URL, nothing else. If you cannot determine a valid URL, return "UNKNOWN"."""

    try:
        model = genai.GenerativeModel(CONFIG.gemini_model)
        response = model.generate_content(prompt)
        suggested_url = response.text.strip()

        if suggested_url and suggested_url != "UNKNOWN" and suggested_url.startswith("http"):
            return suggested_url
    except Exception as e:
        log_warning(f"AI URL suggestion failed: {e}")

    return None


def validate_and_fix_merkblaetter_urls(country: str = None, auto_fix: bool = False) -> Dict[str, Any]:
    """
    Validate all Merkblätter URLs and optionally attempt to fix broken ones.

    The validation process follows this priority:
    1. Check primary URL
    2. If primary fails, try each fallback_url in sequence
    3. Only use AI suggestion as last resort (if auto_fix=True)

    Returns report of valid, broken, and fixed URLs.
    """
    results = {
        "checked": 0,
        "valid": [],
        "broken": [],
        "fixed": [],
        "fixed_with_fallback": [],
        "unfixable": []
    }

    sources = CONFIG.merkblaetter_sources
    countries = [country] if country else sources.keys()

    for c in countries:
        if c not in sources:
            continue

        for source_key, source_config in sources[c].items():
            publications = source_config.get("publications", [])

            for pub in publications:
                url = pub.get("url", "")
                fallback_urls = pub.get("fallback_urls", [])
                title = pub.get("title", "")
                abbrev = pub.get("abbrev", "")
                authority = source_config.get("authority", "")

                results["checked"] += 1

                # Step 1: Check primary URL validity
                check = check_url_validity(url)

                if check["valid"]:
                    results["valid"].append({
                        "country": c,
                        "abbrev": abbrev,
                        "title": title,
                        "url": url
                    })
                    continue

                # Primary URL is broken - try fallbacks
                broken_entry = {
                    "country": c,
                    "abbrev": abbrev,
                    "title": title,
                    "url": url,
                    "status": check.get("status_code"),
                    "error": check.get("error")
                }

                # Step 2: Try fallback URLs in sequence
                fallback_found = False
                for fallback_url in fallback_urls:
                    fallback_check = check_url_validity(fallback_url)
                    if fallback_check["valid"]:
                        broken_entry["working_fallback"] = fallback_url
                        results["fixed_with_fallback"].append(broken_entry)
                        log_success(f"Using fallback URL for {abbrev}: {fallback_url}")
                        fallback_found = True
                        break

                if fallback_found:
                    continue

                # Step 3: Try AI suggestion as last resort
                if auto_fix:
                    new_url = find_replacement_url_with_ai(url, title, authority)

                    if new_url:
                        # Verify the new URL works
                        new_check = check_url_validity(new_url)
                        if new_check["valid"]:
                            broken_entry["suggested_url"] = new_url
                            results["fixed"].append(broken_entry)
                            log_success(f"AI found replacement for {abbrev}: {new_url}")
                            continue

                results["broken"].append(broken_entry)
                results["unfixable"].append(broken_entry)

    return results


def get_working_url(pub: Dict[str, Any], verify: bool = True) -> Optional[str]:
    """
    Get a working URL for a publication, trying primary first then fallbacks.

    Args:
        pub: Publication dictionary with 'url' and optional 'fallback_urls'
        verify: If True, verify URL accessibility before returning

    Returns:
        Working URL or None if no URL works
    """
    primary_url = pub.get("url", "")
    fallback_urls = pub.get("fallback_urls", [])

    # Build list of URLs to try
    urls_to_try = [primary_url] + fallback_urls

    for url in urls_to_try:
        if not url:
            continue

        if not verify:
            return url

        check = check_url_validity(url)
        if check["valid"]:
            return url

    return None


def update_broken_links_report(output_file: str = None) -> Dict[str, Any]:
    """
    Generate a comprehensive report of all URLs, their status, and available fallbacks.
    Useful for manual review and maintenance.
    """
    report = {
        "generated_at": datetime.now().isoformat(),
        "summary": {},
        "details": {}
    }

    sources = CONFIG.merkblaetter_sources

    for country, country_sources in sources.items():
        report["details"][country] = []

        for source_key, source_config in country_sources.items():
            publications = source_config.get("publications", [])

            for pub in publications:
                url = pub.get("url", "")
                fallback_urls = pub.get("fallback_urls", [])
                abbrev = pub.get("abbrev", "")

                # Check all URLs
                primary_check = check_url_validity(url)
                fallback_checks = [
                    {"url": fb, **check_url_validity(fb)}
                    for fb in fallback_urls
                ]

                entry = {
                    "abbrev": abbrev,
                    "title": pub.get("title", ""),
                    "primary_url": {
                        "url": url,
                        "valid": primary_check["valid"],
                        "status": primary_check.get("status_code")
                    },
                    "fallback_urls": fallback_checks,
                    "has_working_url": primary_check["valid"] or any(
                        fb.get("valid", False) for fb in fallback_checks
                    )
                }
                report["details"][country].append(entry)

    # Generate summary
    for country, entries in report["details"].items():
        total = len(entries)
        working = sum(1 for e in entries if e["has_working_url"])
        broken = total - working
        with_fallbacks = sum(1 for e in entries if e["fallback_urls"])

        report["summary"][country] = {
            "total": total,
            "working": working,
            "broken": broken,
            "with_fallbacks": with_fallbacks,
            "coverage_percent": round(working / total * 100, 1) if total > 0 else 0
        }

    # Save to file if requested
    if output_file:
        output_path = Path(output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        log_success(f"Report saved to: {output_path}")

    return report


# Custom sources configuration file
CUSTOM_SOURCES_FILE = CONFIG.base_path / "custom_sources.json"

# Centralized config file path
CENTRAL_CONFIG_FILE = CONFIG.base_path / "config.json"


def load_central_config():
    """Load centralized config and update CONFIG with rate limits."""
    global CONFIG
    try:
        if CENTRAL_CONFIG_FILE.exists():
            with open(CENTRAL_CONFIG_FILE, 'r', encoding='utf-8') as f:
                central_config = json.load(f)

            # Update rate limits if present
            if 'rate_limits' in central_config:
                rl = central_config['rate_limits']
                if 'default_delay_ms' in rl:
                    CONFIG.rate_limit_delay = rl['default_delay_ms'] / 1000
                if 'ai_delay_ms' in rl:
                    CONFIG.ai_rate_limit_delay = rl['ai_delay_ms'] / 1000
                if 'max_parallel_scrapes' in rl:
                    CONFIG.max_parallel_scrapes = rl['max_parallel_scrapes']
                if 'max_parallel_ai_requests' in rl:
                    CONFIG.max_parallel_ai_requests = rl['max_parallel_ai_requests']
                if 'max_retries' in rl:
                    CONFIG.max_retries = rl['max_retries']

            return central_config
    except Exception as e:
        print(f"Warning: Could not load central config: {e}")
    return {}


def get_section_title_from_config(country: str, law_abbr: str, section_num: str) -> Optional[str]:
    """Get section title from centralized config mappings."""
    config = load_central_config()
    mappings = config.get('section_title_mappings', {})
    country_mappings = mappings.get(country, {})
    law_mappings = country_mappings.get(law_abbr, {})
    return law_mappings.get(section_num)


def extract_table_of_contents(text: str, country: str = 'DE') -> List[Dict[str, str]]:
    """Extract table of contents from law text.

    Returns list of {section, title} dicts.
    """
    toc = []
    if not text:
        return toc

    # Country-specific patterns
    if country == 'AT':
        patterns = [
            # Austrian: "§ 1 Geltungsbereich"
            r'§\s*(\d+[a-z]?)\s+([A-ZÄÖÜ][^\n§]+?)(?=\n|$)',
            # "1. Abschnitt - Title"
            r'(\d+)\.\s*Abschnitt\s*[-–]?\s*([^\n]+)',
        ]
    elif country == 'NL':
        patterns = [
            # Dutch: "Artikel 1. Begripsbepalingen"
            r'Artikel\s*(\d+[a-z]?)\.\s*([^\n]+)',
            # "Hoofdstuk 1 Title"
            r'Hoofdstuk\s*(\d+[a-z]?)\s+([^\n]+)',
        ]
    else:  # DE
        patterns = [
            # German: "§ 1 Zielsetzung und Anwendungsbereich"
            r'§\s*(\d+[a-z]?)\s+([A-ZÄÖÜ][^\n§]+?)(?=\n|$)',
            # "Abschnitt I Title"
            r'Abschnitt\s+([IVX]+|\d+)\s+([^\n]+)',
        ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.MULTILINE):
            section = match.group(1).strip()
            title = match.group(2).strip()
            # Clean title
            title = re.sub(r'[.,:;]$', '', title)
            title = re.sub(r'\s+', ' ', title)
            # Skip if too long (probably content, not title)
            if len(title) > 100 or re.search(r'\d{4}', title):
                continue
            toc.append({'section': section, 'title': title})

    # Remove duplicates
    seen = set()
    unique_toc = []
    for item in toc:
        key = f"{item['section']}:{item['title']}"
        if key not in seen:
            seen.add(key)
            unique_toc.append(item)

    return unique_toc


def is_supplementary_source(law: Dict) -> bool:
    """Check if law is from a supplementary source (AUVA, DGUV, etc.)."""
    config = load_central_config()
    patterns = config.get('supplementary_source_patterns', [
        'merkblatt', 'merkbuch', 'm.plus', 'guideline', 'handbook',
        'information', 'supplement', 'dguv vorschrift', 'dguv regel',
        'dguv information', 'trbs', 'trgs', 'asr', 'pgs'
    ])

    law_type = (law.get('type') or '').lower()
    law_category = (law.get('category') or '').lower()
    law_abbr = (law.get('abbreviation') or '').lower()

    for pattern in patterns:
        if pattern in law_type or pattern in law_category or pattern in law_abbr:
            return True
    return False


# Load config on module import
load_central_config()


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


def get_pdf_source_for_law(country: str, law_abbrev: str) -> Optional[Dict[str, Any]]:
    """
    Get PDF verification source for a law if available.
    PDF sources are preferred over HTML as they're more reliable.

    Returns: Dict with 'url' and 'name' if PDF source exists, None otherwise
    """
    custom_data = load_custom_sources()
    country_sources = custom_data.get("custom_sources", {}).get(country, {})

    # Look for a PDF verification source for this law
    for abbrev, info in country_sources.items():
        if info.get("verification_for") == law_abbrev and info.get("source_type") == "pdf":
            if info.get("enabled", True):
                return {
                    "url": info.get("url", ""),
                    "name": info.get("name", abbrev),
                    "abbrev": abbrev
                }
    return None


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

    try:
        text = call_gemini_api(prompt)
        if not text:
            return None

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


def find_correct_url_with_ai(country: str, law_abbr: str, failed_url: str, http_status: int, failed_urls: List[str] = None) -> Optional[Dict[str, Any]]:
    """
    Use AI to find the correct URL when HTTP errors occur.
    Returns a dict with 'url', 'name', and 'confidence' if found.

    Args:
        country: Country code (AT, DE, NL)
        law_abbr: Law abbreviation
        failed_url: The URL that failed
        http_status: HTTP status code (0 if not HTTP error)
        failed_urls: List of URLs that have already been tried and failed (for feedback loop)
    """
    country_names = {"AT": "Austria", "DE": "Germany", "NL": "Netherlands"}
    country_name = country_names.get(country, country)

    base_urls = {
        "AT": "https://www.ris.bka.gv.at",
        "DE": "https://www.gesetze-im-internet.de",
        "NL": "https://wetten.overheid.nl"
    }

    # Build failed URLs section if we have previous failures
    failed_urls_section = ""
    if failed_urls and len(failed_urls) > 1:
        failed_urls_section = f"""
IMPORTANT: The following URLs have ALREADY BEEN TRIED and FAILED. You MUST suggest a DIFFERENT URL:
{chr(10).join(f'  - {u}' for u in failed_urls)}

Please analyze why these URLs failed and suggest a completely different, working URL.
"""

    prompt = f"""You are an expert in European legal databases. A URL for a workplace safety law has returned HTTP {http_status if http_status else 'error'}.

Country: {country_name}
Law abbreviation: {law_abbr}
Failed URL: {failed_url}
Base URL for this country: {base_urls.get(country, 'unknown')}
{failed_urls_section}
Please find the CORRECT, currently working URL for this law from official government sources.

For {country_name}:
- AT (Austria):
  PRIMARY: Use RIS (ris.bka.gv.at) with format /GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=XXXXX
  - The Gesetzesnummer is a unique ID for each law (e.g., 10008910 for ASchG)
  - Alternative RIS format: /eli/bgbl/YYYY/N/geldend or search-based URLs
  ALTERNATIVE SOURCES (try in this order if RIS fails):
  1. jusline.at: https://www.jusline.at/gesetz/LAWNAME (e.g., /gesetz/aschg) - comprehensive law database with clean formatting
  2. arbeitsinspektorat.gv.at: Labor Inspectorate - work safety laws and regulations
  3. sozialministerium.at: Ministry of Social Affairs - employment and safety regulations
  4. auva.at: Austrian Workers Compensation Board (AUVA) - workplace safety standards and guidelines
  5. wko.at: Austrian Economic Chamber - business law texts and regulations
  6. arbeiterkammer.at: Chamber of Labor - employee protection laws and information
  7. oesterreich.gv.at: Official government portal with legal information
  8. help.gv.at: Government help portal with simplified legal texts
  Note: Alternative sources may have different formatting. Prefer RIS > jusline.at > others.
- DE (Germany):
  PRIMARY: Use gesetze-im-internet.de with format /lawname/ (lowercase)
  - Example: /arbschg/ for Arbeitsschutzgesetz
  - Some laws have year suffixes: /muschg_2018/
  ALTERNATIVE SOURCES (try in this order if primary fails):
  1. dejure.org: https://dejure.org/gesetze/LAWNAME (e.g., /gesetze/ArbSchG) - comprehensive with cross-references
  2. buzer.de: https://www.buzer.de/gesetz/XXXX.htm - clean formatting, historical versions
  3. bmas.de: Federal Ministry of Labour - official work safety regulations
  4. baua.de: Federal Institute for Occupational Safety - technical standards
  5. dguv.de: German Social Accident Insurance - DGUV regulations and rules
  6. gesetze-bayern.de: Bavarian law portal (also has federal laws)
  Note: Alternative sources may have different formatting. Prefer gesetze-im-internet.de > dejure.org > others.
- NL (Netherlands):
  PRIMARY: Use wetten.overheid.nl with format /BWBRXXXXXXX/geldend
  - BWBR numbers are unique identifiers (e.g., BWBR0010346 for Arbowet)
  ALTERNATIVE SOURCES (try in this order if primary fails):
  1. arboportaal.nl: Labor authority portal - work safety laws and guidelines
  2. rijksoverheid.nl: Government portal with legal documents
  3. inspectie.szw.nl: Labor Inspectorate - safety regulations
  4. nen.nl: Dutch standards institute - safety standards (may require subscription)
  5. fnv.nl: Trade union federation - employee rights summaries
  Note: Alternative sources may have different formatting. Prefer wetten.overheid.nl > arboportaal.nl > others.

IMPORTANT: Verify the URL format is correct for the country. Double-check the law identifier.

Return your response as a JSON object with this format:
{{
  "url": "the correct full URL",
  "name": "Full name of the law",
  "path": "just the path part (without base URL)",
  "confidence": "high/medium/low",
  "reason": "brief explanation why this URL is correct"
}}

If you cannot find a working URL, return:
{{
  "url": null,
  "confidence": "none",
  "reason": "explanation why URL could not be found"
}}

Only return the JSON object, no other text."""

    try:
        text = call_gemini_api(prompt)
        if not text:
            return None

        # Extract JSON from response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        result = json.loads(text)

        if result.get('url') and result.get('confidence') in ['high', 'medium']:
            log_info(f"AI found potential correct URL for {law_abbr}: {result.get('url')} (confidence: {result.get('confidence')})")
            return result
        else:
            log_warning(f"AI could not find correct URL for {law_abbr}: {result.get('reason', 'unknown reason')}")
            return result  # Return the result even if low confidence so we can see the reason

    except Exception as e:
        log_error(f"AI URL correction failed: {e}")
        return None


def update_source_url(country: str, law_abbr: str, new_url: str, new_name: str = None) -> bool:
    """Update the source URL in custom_sources.json when AI finds a correct URL."""
    try:
        custom_data = load_custom_sources()

        if country not in custom_data.get("custom_sources", {}):
            custom_data["custom_sources"][country] = {}

        # Extract just the path from the URL
        base_urls = {
            "AT": "https://www.ris.bka.gv.at",
            "DE": "https://www.gesetze-im-internet.de",
            "NL": "https://wetten.overheid.nl"
        }
        base = base_urls.get(country, "")
        path = new_url.replace(base, "") if base and new_url.startswith(base) else new_url

        custom_data["custom_sources"][country][law_abbr] = {
            "url": path,
            "name": new_name or law_abbr,
            "description": "URL auto-corrected by AI",
            "enabled": True,
            "ai_corrected": True,
            "corrected_at": datetime.now().isoformat(),
            "original_url_failed": True
        }

        if save_custom_sources(custom_data):
            log_success(f"Updated {country}/{law_abbr} URL in custom_sources.json")
            return True
        return False

    except Exception as e:
        log_error(f"Failed to update source URL: {e}")
        return False


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


def log_warning(msg: str, category: str = "general", collect: bool = True, **kwargs) -> None:
    """Print a warning message and optionally collect it for the error report."""
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")
    # Also collect for error report if collector is initialized
    if collect and 'PIPELINE_ERRORS' in globals():
        PIPELINE_ERRORS.add_warning(category, msg, **kwargs)


def log_error(msg: str, category: str = "general", collect: bool = True, **kwargs) -> None:
    """Print an error message and optionally collect it for the error report."""
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")
    # Also collect for error report if collector is initialized
    if collect and 'PIPELINE_ERRORS' in globals():
        PIPELINE_ERRORS.add_error(category, msg, **kwargs)


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


# =============================================================================
# Error Collection System for Pipeline
# =============================================================================

class PipelineErrorCollector:
    """Collects errors during pipeline execution for Claude Code to fix later."""

    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
        self.start_time = datetime.now()
        self.pipeline_name = None
        self.country = None

    def set_context(self, pipeline_name: str, country: str = None):
        """Set the current pipeline context."""
        self.pipeline_name = pipeline_name
        self.country = country

    def add_error(self, category: str, message: str, details: Dict[str, Any] = None,
                  file_path: str = None, line_number: int = None, suggestion: str = None):
        """Add an error to the collection."""
        self.errors.append({
            "timestamp": datetime.now().isoformat(),
            "category": category,
            "message": message,
            "details": details or {},
            "file_path": file_path,
            "line_number": line_number,
            "suggestion": suggestion,
            "pipeline": self.pipeline_name,
            "country": self.country
        })

    def add_warning(self, category: str, message: str, details: Dict[str, Any] = None):
        """Add a warning to the collection."""
        self.warnings.append({
            "timestamp": datetime.now().isoformat(),
            "category": category,
            "message": message,
            "details": details or {},
            "pipeline": self.pipeline_name,
            "country": self.country
        })

    def get_summary(self) -> Dict[str, Any]:
        """Get summary statistics of collected errors."""
        error_categories = {}
        for err in self.errors:
            cat = err.get("category", "unknown")
            error_categories[cat] = error_categories.get(cat, 0) + 1

        return {
            "total_errors": len(self.errors),
            "total_warnings": len(self.warnings),
            "error_categories": error_categories,
            "duration_seconds": (datetime.now() - self.start_time).total_seconds()
        }

    def save_to_file(self, output_path: Path = None) -> str:
        """Save errors to a JSON file for Claude Code to process."""
        if output_path is None:
            output_path = CONFIG.base_path / "pipeline_errors.json"

        report = {
            "generated_at": datetime.now().isoformat(),
            "pipeline": self.pipeline_name,
            "country": self.country,
            "duration_seconds": (datetime.now() - self.start_time).total_seconds(),
            "summary": self.get_summary(),
            "errors": self.errors,
            "warnings": self.warnings,
            "instructions_for_claude": {
                "description": "This file contains errors from the last pipeline run. Please review and fix the issues listed below.",
                "priority_order": [
                    "1. Critical errors (data loss, broken functionality)",
                    "2. PDF 404 errors (broken links) - update URLs in custom_sources.json",
                    "3. Network errors (timeouts, connection issues) - may be temporary",
                    "4. AI/parsing errors (failed AI calls, parsing issues)",
                    "5. Validation warnings (missing fields, data quality)"
                ],
                "error_categories": {
                    "pdf_404": "PDF URL returns 404. Find updated URL and update custom_sources.json",
                    "pdf_download": "PDF download failed. Check network or add fallback_urls",
                    "network_timeout": "Request timed out. Server may be slow - retry later",
                    "network_connection": "Connection failed. Check if server is accessible",
                    "source_disabled": "Source auto-disabled after repeated failures. Fix URL and reset health",
                    "ai_rate_limit": "Reduce parallel requests or add delays",
                    "html_parse": "HTML structure changed. Update scraper logic"
                },
                "automation_commands": {
                    "validate_and_fix": "python law_manager.py validate-urls --auto-fix",
                    "reset_health": "python law_manager.py sources --reset-health",
                    "check_health": "python law_manager.py sources --health-report",
                    "update_single_url": "Edit custom_sources.json directly"
                },
                "fallback_url_example": {
                    "description": "Add fallback_urls array to any source in custom_sources.json",
                    "example": {
                        "AUVA M 025": {
                            "url": "https://primary-url.pdf",
                            "fallback_urls": [
                                "https://backup-url-1.pdf",
                                "https://backup-url-2.pdf"
                            ]
                        }
                    }
                }
            }
        }

        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            return str(output_path)
        except Exception as e:
            log_error(f"Failed to save error report: {e}")
            return None

    def clear(self):
        """Clear all collected errors and warnings."""
        self.errors = []
        self.warnings = []
        self.start_time = datetime.now()


# Global error collector instance
PIPELINE_ERRORS = PipelineErrorCollector()


def collect_error(category: str, message: str, **kwargs):
    """Convenience function to collect a pipeline error."""
    PIPELINE_ERRORS.add_error(category, message, **kwargs)


def collect_warning(category: str, message: str, **kwargs):
    """Convenience function to collect a pipeline warning."""
    PIPELINE_ERRORS.add_warning(category, message, **kwargs)


# =============================================================================
# Source Health Tracking for Pipeline Automation
# =============================================================================

class SourceHealthTracker:
    """
    Tracks the health of external sources (URLs) to enable:
    - Automatic disabling of repeatedly failing sources
    - Fallback URL support
    - Proactive monitoring and alerting
    """

    HEALTH_FILE = "source_health.json"
    MAX_CONSECUTIVE_FAILURES = 3  # Auto-disable after this many failures

    def __init__(self, base_path: Path = None):
        self.base_path = base_path or CONFIG.base_path
        self.health_file = self.base_path / self.HEALTH_FILE
        self.health_data = self._load()

    def _load(self) -> Dict[str, Any]:
        """Load health data from file."""
        if self.health_file.exists():
            try:
                with open(self.health_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "sources": {},
            "last_updated": None,
            "auto_disabled": []
        }

    def save(self):
        """Save health data to file."""
        self.health_data["last_updated"] = datetime.now().isoformat()
        try:
            with open(self.health_file, 'w', encoding='utf-8') as f:
                json.dump(self.health_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            log_warning(f"Could not save source health data: {e}")

    def record_success(self, source_id: str, url: str):
        """Record a successful fetch for a source."""
        if source_id not in self.health_data["sources"]:
            self.health_data["sources"][source_id] = {
                "url": url,
                "consecutive_failures": 0,
                "total_successes": 0,
                "total_failures": 0,
                "last_success": None,
                "last_failure": None,
                "auto_disabled": False
            }

        source = self.health_data["sources"][source_id]
        source["consecutive_failures"] = 0
        source["total_successes"] += 1
        source["last_success"] = datetime.now().isoformat()
        source["url"] = url  # Update to working URL
        source["auto_disabled"] = False

        # Remove from auto-disabled list if present
        if source_id in self.health_data["auto_disabled"]:
            self.health_data["auto_disabled"].remove(source_id)

    def record_failure(self, source_id: str, url: str, error_type: str, http_status: int = None) -> bool:
        """
        Record a failed fetch for a source.
        Returns True if source should be auto-disabled.
        """
        if source_id not in self.health_data["sources"]:
            self.health_data["sources"][source_id] = {
                "url": url,
                "consecutive_failures": 0,
                "total_successes": 0,
                "total_failures": 0,
                "last_success": None,
                "last_failure": None,
                "last_error": None,
                "last_http_status": None,
                "auto_disabled": False
            }

        source = self.health_data["sources"][source_id]
        source["consecutive_failures"] += 1
        source["total_failures"] += 1
        source["last_failure"] = datetime.now().isoformat()
        source["last_error"] = error_type
        source["last_http_status"] = http_status

        # Check if should auto-disable
        if source["consecutive_failures"] >= self.MAX_CONSECUTIVE_FAILURES:
            source["auto_disabled"] = True
            if source_id not in self.health_data["auto_disabled"]:
                self.health_data["auto_disabled"].append(source_id)
            return True

        return False

    def is_disabled(self, source_id: str) -> bool:
        """Check if a source has been auto-disabled."""
        return source_id in self.health_data.get("auto_disabled", [])

    def get_health_report(self) -> Dict[str, Any]:
        """Generate a health report for all sources."""
        sources = self.health_data.get("sources", {})

        healthy = []
        degraded = []
        failing = []
        disabled = []

        for source_id, data in sources.items():
            if data.get("auto_disabled"):
                disabled.append(source_id)
            elif data.get("consecutive_failures", 0) == 0:
                healthy.append(source_id)
            elif data.get("consecutive_failures", 0) < self.MAX_CONSECUTIVE_FAILURES:
                degraded.append(source_id)
            else:
                failing.append(source_id)

        return {
            "summary": {
                "healthy": len(healthy),
                "degraded": len(degraded),
                "failing": len(failing),
                "auto_disabled": len(disabled)
            },
            "healthy_sources": healthy,
            "degraded_sources": degraded,
            "failing_sources": failing,
            "auto_disabled_sources": disabled,
            "details": sources
        }

    def get_actionable_suggestions(self, source_id: str) -> List[str]:
        """Get actionable suggestions for fixing a failing source."""
        if source_id not in self.health_data["sources"]:
            return []

        source = self.health_data["sources"][source_id]
        suggestions = []

        http_status = source.get("last_http_status")
        error_type = source.get("last_error", "")
        url = source.get("url", "")

        if http_status == 404:
            suggestions.append(f"URL returned 404 - the resource has moved or been deleted")

            # Domain-specific suggestions
            if "auva.at" in url:
                suggestions.append("AUVA reorganizes their media URLs periodically. Search auva.at for the document title")
                suggestions.append("Try: https://auva.at/sicherheit-gesundheit/publikationen/ and search for the publication")
            elif "baua.de" in url:
                suggestions.append("BAUA may have updated the PDF version. Check: https://www.baua.de/DE/Angebote/Regelwerk/")
            elif "nlarbeidsinspectie.nl" in url:
                suggestions.append("Check: https://www.nlarbeidsinspectie.nl/publicaties for updated links")

            suggestions.append("Run 'python law_manager.py validate-urls --auto-fix' to attempt AI-based URL correction")

        elif http_status == 403:
            suggestions.append("Access forbidden - the server may be blocking automated requests")
            suggestions.append("Try adding the source manually or using a different User-Agent")

        elif http_status == 500 or http_status == 502 or http_status == 503:
            suggestions.append("Server error - this may be temporary. Try again later")
            suggestions.append("Consider adding a fallback_url in custom_sources.json")

        elif "timeout" in error_type.lower():
            suggestions.append("Request timed out - server may be slow or overloaded")
            suggestions.append("Increase timeout or try again during off-peak hours")

        elif "connection" in error_type.lower():
            suggestions.append("Network connection error - check internet connectivity")
            suggestions.append("The server may be temporarily unavailable")

        if source.get("auto_disabled"):
            suggestions.append(f"Source auto-disabled after {self.MAX_CONSECUTIVE_FAILURES} consecutive failures")
            suggestions.append("Fix the URL in custom_sources.json, then reset with: python law_manager.py sources --reset-health")

        return suggestions


# Global source health tracker
SOURCE_HEALTH = SourceHealthTracker()


# Error categories for better classification
class ErrorCategory:
    """Standard error categories for pipeline errors."""
    PDF_404 = "pdf_404"
    PDF_DOWNLOAD = "pdf_download"
    PDF_PARSE = "pdf_parse"
    HTML_FETCH = "html_fetch"
    HTML_PARSE = "html_parse"
    NETWORK_TIMEOUT = "network_timeout"
    NETWORK_CONNECTION = "network_connection"
    AI_RATE_LIMIT = "ai_rate_limit"
    AI_PARSE = "ai_parse"
    VALIDATION = "validation"
    SOURCE_DISABLED = "source_disabled"
    GENERAL = "general"


def categorize_request_error(error: Exception, http_status: int = None) -> str:
    """Categorize a request error for better reporting."""
    error_str = str(error).lower()

    if http_status == 404:
        return ErrorCategory.PDF_404
    elif http_status in (403, 401):
        return ErrorCategory.NETWORK_CONNECTION
    elif http_status and http_status >= 500:
        return ErrorCategory.NETWORK_CONNECTION
    elif "timeout" in error_str:
        return ErrorCategory.NETWORK_TIMEOUT
    elif "connection" in error_str or "refused" in error_str:
        return ErrorCategory.NETWORK_CONNECTION
    else:
        return ErrorCategory.PDF_DOWNLOAD


def create_progress_bar(total: int, desc: str = "Processing"):
    """Create a progress bar (tqdm if available)."""
    if HAS_TQDM:
        return tqdm(total=total, desc=f"  {desc}", ncols=80,
                   bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]')
    return SimpleProgressBar(total, desc)


def robust_json_parse(text: str, default: Any = None) -> Any:
    """
    Parse JSON with robust error handling and repair strategies.
    Handles common AI response issues like unterminated strings, trailing commas, etc.
    """
    if not text or not text.strip():
        return default if default is not None else []

    text = text.strip()

    # Strategy 1: Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Try to extract JSON from markdown code blocks
    if "```" in text:
        # Try ```json first
        if "```json" in text:
            try:
                extracted = text.split("```json")[1].split("```")[0].strip()
                return json.loads(extracted)
            except (IndexError, json.JSONDecodeError):
                pass
        # Try generic ``` blocks
        try:
            parts = text.split("```")
            if len(parts) >= 2:
                extracted = parts[1].strip()
                # Remove json/JSON prefix if present
                if extracted.lower().startswith('json'):
                    extracted = extracted[4:].strip()
                return json.loads(extracted)
        except (IndexError, json.JSONDecodeError):
            pass

    # Strategy 3: Fix common JSON issues
    repaired = text

    # Remove trailing commas before ] or }
    repaired = re.sub(r',(\s*[}\]])', r'\1', repaired)

    # Try to fix unterminated strings by finding the last valid JSON structure
    # Look for the pattern of a valid JSON array
    if repaired.strip().startswith('['):
        # Find all complete objects in the array
        bracket_count = 0
        brace_count = 0
        in_string = False
        escape_next = False
        last_valid_pos = 0

        for i, char in enumerate(repaired):
            if escape_next:
                escape_next = False
                continue
            if char == '\\':
                escape_next = True
                continue
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            if in_string:
                continue
            if char == '[':
                bracket_count += 1
            elif char == ']':
                bracket_count -= 1
                if bracket_count == 0:
                    last_valid_pos = i + 1
                    break
            elif char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and bracket_count == 1:
                    last_valid_pos = i + 1

        # If we found a valid end, try to repair
        if last_valid_pos > 0:
            try:
                return json.loads(repaired[:last_valid_pos])
            except json.JSONDecodeError:
                pass

        # Try truncating at the last complete object
        last_brace = repaired.rfind('}')
        if last_brace > 0:
            # Find matching bracket
            truncated = repaired[:last_brace + 1]
            # Count brackets and braces
            open_brackets = truncated.count('[') - truncated.count(']')
            # Add closing brackets as needed
            truncated += ']' * open_brackets
            try:
                return json.loads(truncated)
            except json.JSONDecodeError:
                pass

    # Strategy 4: Extract individual objects and build array
    if '[' in text:
        objects = []
        # Find all {...} patterns
        brace_depth = 0
        obj_start = -1
        for i, char in enumerate(text):
            if char == '{':
                if brace_depth == 0:
                    obj_start = i
                brace_depth += 1
            elif char == '}':
                brace_depth -= 1
                if brace_depth == 0 and obj_start >= 0:
                    obj_text = text[obj_start:i+1]
                    try:
                        obj = json.loads(obj_text)
                        objects.append(obj)
                    except json.JSONDecodeError:
                        pass
                    obj_start = -1
        if objects:
            return objects

    # Strategy 5: Return empty array as safe fallback for expected array responses
    return default if default is not None else []


def parse_pdf_content(pdf_path_or_url: str, is_url: bool = True) -> Optional[Dict[str, Any]]:
    """
    Parse PDF content from a URL or local file path.
    Returns a dict with 'text', 'pages', and 'sections' if successful.
    """
    if not HAS_PDF:
        log_warning("No PDF library available. Install pdfplumber, PyPDF2, or PyMuPDF: pip install pdfplumber")
        return None

    if not HAS_REQUESTS and is_url:
        log_warning("requests package required for PDF URL fetching")
        return None

    try:
        # Download PDF if URL
        if is_url:
            import tempfile
            response = requests.get(pdf_path_or_url, timeout=60)
            if response.status_code != 200:
                log_error(f"Failed to download PDF: HTTP {response.status_code}")
                return None

            # Save to temp file
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                tmp.write(response.content)
                pdf_path = tmp.name
        else:
            pdf_path = pdf_path_or_url

        # Parse PDF based on available library
        full_text = ""
        pages = []
        sections = []

        if PDF_LIBRARY == 'pdfplumber':
            import pdfplumber
            with pdfplumber.open(pdf_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    page_text = page.extract_text() or ""
                    pages.append({"page": i + 1, "text": page_text})
                    full_text += page_text + "\n\n"

        elif PDF_LIBRARY == 'pypdf2':
            import PyPDF2
            with open(pdf_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for i, page in enumerate(reader.pages):
                    page_text = page.extract_text() or ""
                    pages.append({"page": i + 1, "text": page_text})
                    full_text += page_text + "\n\n"

        elif PDF_LIBRARY == 'pymupdf':
            import fitz
            doc = fitz.open(pdf_path)
            for i, page in enumerate(doc):
                page_text = page.get_text()
                pages.append({"page": i + 1, "text": page_text})
                full_text += page_text + "\n\n"
            doc.close()

        # Clean up temp file if we downloaded
        if is_url:
            import os
            os.unlink(pdf_path)

        # Extract sections from text (look for § patterns or numbered sections)
        section_pattern = re.compile(r'(?:^|\n)(§\s*\d+[a-z]?\.?.*?)(?=\n§\s*\d+|\Z)', re.MULTILINE | re.DOTALL)
        section_matches = section_pattern.findall(full_text)

        if not section_matches:
            # Try alternative pattern for numbered paragraphs like "(1)", "(2)"
            alt_pattern = re.compile(r'(?:^|\n)(\(\d+\).*?)(?=\n\(\d+\)|\Z)', re.MULTILINE | re.DOTALL)
            section_matches = alt_pattern.findall(full_text)

        for i, match in enumerate(section_matches):
            # Try to extract section number
            num_match = re.match(r'§\s*(\d+[a-z]?)', match)
            section_num = num_match.group(1) if num_match else str(i + 1)

            sections.append({
                "number": section_num,
                "text": match.strip()
            })

        return {
            "text": full_text.strip(),
            "pages": pages,
            "sections": sections,
            "page_count": len(pages),
            "section_count": len(sections)
        }

    except Exception as e:
        log_error(f"PDF parsing error: {e}")
        return None


def parse_pdf_to_law_document(pdf_url: str, abbrev: str, title: str, jurisdiction: str = "DE") -> Optional[Dict[str, Any]]:
    """
    Parse a PDF and create a law document structure suitable for the database.
    """
    log_info(f"Parsing PDF for {abbrev}...")

    pdf_content = parse_pdf_content(pdf_url, is_url=True)
    if not pdf_content:
        return None

    log_info(f"  Extracted {pdf_content['page_count']} pages, {pdf_content['section_count']} sections")

    # Build sections list
    sections = []
    for sec in pdf_content.get('sections', []):
        sec_num = sec.get('number', '')
        sec_text = sec.get('text', '')

        # Try to extract title from first line
        lines = sec_text.split('\n')
        sec_title = lines[0][:100] if lines else f"§ {sec_num}"

        sections.append({
            "id": generate_id(f"{abbrev}-{sec_num}-{datetime.now().isoformat()}"),
            "number": sec_num,
            "title": sec_title,
            "text": sec_text,
            "whs_topics": [],
            "paragraphs": []
        })

    # Create document structure
    doc = {
        "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
        "version": "1.0.0",
        "type": "law",
        "jurisdiction": jurisdiction,
        "abbreviation": abbrev,
        "title": title,
        "title_en": title,
        "category": "Core Safety",
        "source": {
            "url": pdf_url,
            "title": title,
            "authority": "PDF Source",
            "robots_txt_compliant": True,
            "source_type": "pdf"
        },
        "scraping": {
            "scraped_at": datetime.now().isoformat(),
            "scraper_version": CONFIG.scraper_version,
            "pdf_pages": pdf_content['page_count']
        },
        "full_text": pdf_content['text'][:100000],  # Limit full text size
        "chapters": [
            {
                "id": f"{jurisdiction.lower()}-{abbrev.lower()}-main",
                "number": "1",
                "title": "Hauptteil",
                "title_en": "Main Part",
                "sections": sections
            }
        ] if sections else []
    }

    doc["content_hash"] = generate_content_hash(doc)
    log_success(f"  Parsed {abbrev}: {len(sections)} sections from PDF")

    return doc


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


def remove_duplicate_phrases(text: str) -> str:
    """Remove duplicate phrases/sentences that appear consecutively (RIS accessibility duplication).

    The RIS website includes both abbreviated and expanded reference formats,
    causing the same sentence to appear twice with slightly different formats.
    Example: "...BGBl. Nr. 287; ...Bundesgesetzblatt Nr. 287;"

    This function detects such near-duplicates by normalizing references and comparing.
    """
    if not text:
        return text

    # Split into sentences/clauses (by semicolon or period)
    parts = re.split(r'([;.])\s*', text)

    # Reconstruct while filtering duplicates
    result = []
    seen_normalized = set()

    i = 0
    while i < len(parts):
        part = parts[i]
        if not part.strip():
            i += 1
            continue

        # Normalize for comparison: replace BGBl references and expand/abbreviate patterns
        normalized = re.sub(r'BGBl\.\s*(?:I|II)?\s*Nr\.\s*\d+(?:/\d+)?', 'BGBL_REF', part.lower())
        normalized = re.sub(r'Bundesgesetzblatt\s+(?:Teil\s+\w+,?\s*)?Nr\.\s+\d+(?:\s+aus\s+\d+)?', 'BGBL_REF', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        # Use first 80 chars as key to catch near-duplicates
        check_key = normalized[:80]

        if check_key not in seen_normalized or len(check_key) < 20:
            seen_normalized.add(check_key)
            result.append(part)
            # Add delimiter back if present
            if i + 1 < len(parts) and parts[i + 1] in [';', '.']:
                result.append(parts[i + 1])
                i += 1

        i += 1

    return ' '.join(result).strip()


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


# =============================================================================
# Enhanced PDF Management
# =============================================================================

def ensure_pdf_storage_dir(country: str = None) -> Path:
    """Ensure PDF storage directory exists and return path."""
    base_dir = CONFIG.pdf_storage_dir
    if country:
        target_dir = base_dir / country.lower()
    else:
        target_dir = base_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir


def get_fallback_urls(country: str, abbrev: str) -> List[str]:
    """Get fallback URLs for a source from custom_sources.json."""
    try:
        custom = load_custom_sources()
        source = custom.get('custom_sources', {}).get(country, {}).get(abbrev, {})
        return source.get('fallback_urls', [])
    except Exception:
        return []


def download_and_store_pdf(url: str, country: str, abbrev: str, doc_type: str = "law",
                           use_fallbacks: bool = True) -> Optional[Dict[str, str]]:
    """
    Download a PDF from URL and store it locally.

    Features:
    - Automatic fallback URL support
    - Source health tracking
    - Proper error categorization for pipeline errors
    - Actionable suggestions on failure

    Returns dict with:
        - local_path: Path to stored PDF file
        - filename: Just the filename
        - url: Original URL (or fallback URL that worked)
        - size_bytes: File size

    Returns None if download fails.
    """
    if not HAS_REQUESTS:
        log_warning("requests package required for PDF download")
        return None

    source_id = f"{country}:{abbrev}"

    # Check if source is auto-disabled
    if SOURCE_HEALTH.is_disabled(source_id):
        log_warning(f"Source {abbrev} is auto-disabled due to repeated failures")
        collect_error(
            ErrorCategory.SOURCE_DISABLED,
            f"Source {abbrev} is auto-disabled",
            details={"source_id": source_id, "url": url},
            suggestion="Fix URL in custom_sources.json and reset health with: python law_manager.py sources --reset-health"
        )
        return None

    # Build list of URLs to try (primary + fallbacks)
    urls_to_try = [url]
    if use_fallbacks:
        fallbacks = get_fallback_urls(country, abbrev)
        urls_to_try.extend(fallbacks)

    # Create filename from abbreviation and doc type
    safe_abbrev = re.sub(r'[^\w\-]', '_', abbrev)
    filename = f"{country.lower()}_{safe_abbrev}_{doc_type}.pdf"

    # Ensure directory exists
    storage_dir = ensure_pdf_storage_dir(country)
    local_path = storage_dir / filename

    last_error = None
    last_http_status = None

    for attempt_url in urls_to_try:
        try:
            # Download the PDF
            log_info(f"Downloading PDF for {abbrev} from {attempt_url[:60]}...")
            response = requests.get(attempt_url, timeout=CONFIG.request_timeout, headers=Scraper.HTTP_HEADERS)
            response.raise_for_status()

            # Verify it's actually a PDF
            content_type = response.headers.get('Content-Type', '')
            if 'application/pdf' not in content_type and not attempt_url.lower().endswith('.pdf'):
                log_warning(f"URL may not be a PDF (Content-Type: {content_type})")

            # Save to local file
            with open(local_path, 'wb') as f:
                f.write(response.content)

            size_bytes = len(response.content)
            log_success(f"Stored PDF: {filename} ({size_bytes / 1024:.1f} KB)")

            # Record success in health tracker
            SOURCE_HEALTH.record_success(source_id, attempt_url)
            SOURCE_HEALTH.save()

            # If fallback worked, suggest updating the primary URL
            if attempt_url != url:
                log_info(f"  ℹ️  Fallback URL worked. Consider updating primary URL in custom_sources.json")

            return {
                "local_path": str(local_path),
                "filename": filename,
                "url": attempt_url,
                "size_bytes": size_bytes,
                "used_fallback": attempt_url != url
            }

        except requests.exceptions.HTTPError as e:
            last_error = e
            last_http_status = e.response.status_code if e.response else None
            if attempt_url == urls_to_try[-1]:  # Last URL in list
                break
            log_warning(f"  Primary URL failed ({last_http_status}), trying fallback...")

        except requests.exceptions.RequestException as e:
            last_error = e
            last_http_status = None
            if attempt_url == urls_to_try[-1]:  # Last URL in list
                break
            log_warning(f"  Primary URL failed, trying fallback...")

    # All URLs failed - record error and track health
    error_category = categorize_request_error(last_error, last_http_status)

    # Record failure in health tracker
    should_disable = SOURCE_HEALTH.record_failure(
        source_id, url, str(last_error), last_http_status
    )
    SOURCE_HEALTH.save()

    # Get actionable suggestions
    suggestions = SOURCE_HEALTH.get_actionable_suggestions(source_id)

    # Log error with proper categorization
    error_msg = f"Failed to download PDF from {url}: {last_error}"
    log_error(error_msg)

    # Collect error for pipeline report
    collect_error(
        error_category,
        error_msg,
        details={
            "source_id": source_id,
            "country": country,
            "abbrev": abbrev,
            "http_status": last_http_status,
            "urls_tried": urls_to_try,
            "auto_disabled": should_disable
        },
        suggestion=suggestions[0] if suggestions else None
    )

    if should_disable:
        log_warning(f"  ⚠️  Source {abbrev} auto-disabled after repeated failures")

    return None


def get_local_pdf_path(country: str, abbrev: str, doc_type: str = "law") -> Optional[str]:
    """Get the local path for a stored PDF if it exists."""
    safe_abbrev = re.sub(r'[^\w\-]', '_', abbrev)
    filename = f"{country.lower()}_{safe_abbrev}_{doc_type}.pdf"
    storage_dir = ensure_pdf_storage_dir(country)
    local_path = storage_dir / filename

    if local_path.exists():
        return str(local_path)
    return None


# =============================================================================
# HTML Storage for Merkblätter
# =============================================================================

def ensure_html_storage_dir(country: str = None) -> Path:
    """Ensure HTML storage directory exists and return path."""
    base_dir = CONFIG.base_path / "html"
    if country:
        target_dir = base_dir / country.lower()
    else:
        target_dir = base_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir


def download_and_store_html(url: str, country: str, abbrev: str, doc_type: str = "merkblatt") -> Optional[Dict[str, str]]:
    """
    Download HTML from URL and store it locally for display.
    No parsing or cleaning - just store the raw HTML.

    Returns dict with:
        - local_path: Path to stored HTML file
        - filename: Just the filename
        - url: Original URL
        - size_bytes: File size

    Returns None if download fails.
    """
    if not HAS_REQUESTS:
        log_warning("requests package required for HTML download")
        return None

    try:
        # Create filename from abbreviation and doc type
        safe_abbrev = re.sub(r'[^\w\-]', '_', abbrev)
        filename = f"{country.lower()}_{safe_abbrev}_{doc_type}.html"

        # Ensure directory exists
        storage_dir = ensure_html_storage_dir(country)
        local_path = storage_dir / filename

        # Download the HTML
        log_info(f"Downloading HTML for {abbrev}...")
        response = requests.get(url, timeout=CONFIG.request_timeout, headers=Scraper.HTTP_HEADERS)
        response.raise_for_status()

        # Get the HTML content
        html_content = response.text

        # Save to local file
        with open(local_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        size_bytes = len(html_content.encode('utf-8'))
        log_success(f"Stored HTML: {filename} ({size_bytes / 1024:.1f} KB)")

        return {
            "local_path": str(local_path),
            "filename": filename,
            "url": url,
            "size_bytes": size_bytes
        }

    except requests.exceptions.RequestException as e:
        log_error(f"Failed to download HTML from {url}: {e}")
        return None
    except IOError as e:
        log_error(f"Failed to save HTML: {e}")
        return None


def get_local_html_path(country: str, abbrev: str, doc_type: str = "merkblatt") -> Optional[str]:
    """Get the local path for a stored HTML file if it exists."""
    safe_abbrev = re.sub(r'[^\w\-]', '_', abbrev)
    filename = f"{country.lower()}_{safe_abbrev}_{doc_type}.html"
    storage_dir = ensure_html_storage_dir(country)
    local_path = storage_dir / filename

    if local_path.exists():
        return str(local_path)
    return None


# =============================================================================
# Unified Document Schema
# =============================================================================

# Document type enumeration
class DocType:
    LAW = "law"
    ORDINANCE = "ordinance"
    MERKBLATT = "merkblatt"
    GUIDELINE = "guideline"
    REGULATION = "regulation"


def create_unified_document(
    country: str,
    abbrev: str,
    title: str,
    doc_type: str = DocType.LAW,
    source_url: str = "",
    source_authority: str = "",
    content_text: str = "",
    grouping_1: str = "",  # Abschnitt/Buch/Hoofdstuk
    grouping_2: str = "",  # Titel/Afdeling/Unterabschnitt
    article_id: str = "",  # § 12 / Art. 4
    pdf_path: str = "",
    ai_summary: str = "",
    chapters: List[Dict] = None,
    sections: List[Dict] = None,
    full_text: str = "",
    whs_topics: List[Dict] = None,
    metadata: Dict = None
) -> Dict[str, Any]:
    """
    Create a document using the unified schema that handles differences
    between AT/DE/NL legal structures.

    Schema fields:
        - id: Unique document identifier
        - country: Enum (AT, DE, NL)
        - doc_type: Enum (law, ordinance, merkblatt, guideline, regulation)
        - title: Full title (e.g., "ASchG", "BGB")
        - grouping_1: Generic field for "Abschnitt"/"Buch"/"Hoofdstuk"
        - grouping_2: Generic field for "Titel"/"Afdeling"
        - article_id: e.g., "§ 12", "Art. 4"
        - text_content: Main text content
        - ai_summary: AI-generated summary (for PDF-only sources)
        - pdf_path: Local path to stored PDF
        - source_url: Original source URL
    """
    # Get structure labels for country
    country_config = CONFIG.sources.get(country, {})
    structure_labels = country_config.get("structure_labels", {
        "grouping_1": "Section",
        "grouping_2": "Subsection",
        "article": "Article"
    })

    doc = {
        # Core identification
        "id": generate_id(f"{country}-{abbrev}-{datetime.now().isoformat()}"),
        "version": "1.0.0",

        # Country and type
        "country": country,
        "jurisdiction": country,  # Alias for backwards compatibility
        "doc_type": doc_type,
        "type": doc_type,  # Alias for backwards compatibility

        # Naming
        "abbreviation": abbrev,
        "title": title,
        "title_en": title,  # Can be updated later
        "category": "Core Safety" if doc_type in [DocType.LAW, DocType.ORDINANCE] else "Supplementary",

        # Structure labels (country-specific)
        "structure_labels": structure_labels,
        "grouping_1": grouping_1 or structure_labels.get("grouping_1", ""),
        "grouping_2": grouping_2 or structure_labels.get("grouping_2", ""),
        "article_label": structure_labels.get("article", "§"),

        # Content
        "text_content": content_text,
        "full_text": full_text or content_text,
        "ai_summary": ai_summary,

        # Source information
        "source": {
            "url": source_url,
            "authority": source_authority or country_config.get("authority", ""),
            "title": title,
            "robots_txt_compliant": True,
            "source_type": "pdf" if pdf_path else "html"
        },

        # PDF information
        "pdf_path": pdf_path,
        "pdf_available": bool(pdf_path),

        # Scraping metadata
        "scraping": {
            "scraped_at": datetime.now().isoformat(),
            "scraper_version": CONFIG.scraper_version,
            "source_type": "pdf" if pdf_path else "html"
        },

        # Structure
        "chapters": chapters or [],
        "sections": sections or [],

        # Analysis
        "whs_topics": whs_topics or [],
        "whs_summary": {},

        # Custom metadata
        "metadata": metadata or {}
    }

    # Generate content hash
    doc["content_hash"] = generate_content_hash(doc)

    return doc


def get_structure_label(country: str, level: str = "grouping_1") -> str:
    """
    Get the appropriate structure label for a country.

    Args:
        country: AT, DE, or NL
        level: "grouping_1" (top level), "grouping_2" (second level), or "article"

    Returns:
        Localized label string
    """
    labels = {
        "AT": {"grouping_1": "Abschnitt", "grouping_2": "Unterabschnitt", "article": "§"},
        "DE": {"grouping_1": "Abschnitt", "grouping_2": "Titel", "article": "§"},
        "NL": {"grouping_1": "Hoofdstuk", "grouping_2": "Afdeling", "article": "Artikel"}
    }
    return labels.get(country, {}).get(level, level)


# =============================================================================
# AI Context Awareness
# =============================================================================

# Country-specific AI context configurations
AI_COUNTRY_CONTEXT = {
    "AT": {
        "language": "German (Austrian)",
        "legal_system": "Austrian civil law",
        "terminology_notes": [
            "Use Austrian German terminology (e.g., 'Arbeitnehmer' not 'Beschäftigte')",
            "Reference Austrian federal law structure (Bundesgesetz)",
            "Use Austrian legal citations (BGBl., StF.)",
            "Recognize Austrian administrative structure (Bundesländer)"
        ],
        "key_authorities": ["RIS", "AUVA", "Arbeitsinspektorat"],
        "legal_framework": "ASchG (ArbeitnehmerInnenschutzgesetz) as primary WHS law"
    },
    "DE": {
        "language": "German (Standard)",
        "legal_system": "German civil law",
        "terminology_notes": [
            "Use German legal terminology (e.g., 'Beschäftigte', 'Gefährdungsbeurteilung')",
            "Reference German federal law structure (Bundesrecht)",
            "Use German legal citations (BGBl., BAnz.)",
            "Recognize DGUV and Berufsgenossenschaften role"
        ],
        "key_authorities": ["gesetze-im-internet.de", "DGUV", "BAuA"],
        "legal_framework": "ArbSchG (Arbeitsschutzgesetz) as primary WHS law"
    },
    "NL": {
        "language": "Dutch",
        "legal_system": "Dutch civil law",
        "terminology_notes": [
            "Use Dutch legal terminology (e.g., 'werkgever', 'werknemer', 'RI&E')",
            "Reference Dutch law structure (Wet, Besluit, Regeling)",
            "Use Dutch legal citations (Stb., Stcrt.)",
            "Recognize Inspectie SZW and sector arbocatalogi"
        ],
        "key_authorities": ["wetten.overheid.nl", "Arboportaal", "Inspectie SZW"],
        "legal_framework": "Arbowet (Arbeidsomstandighedenwet) as primary WHS law"
    }
}

# Document type context for AI
AI_DOC_TYPE_CONTEXT = {
    DocType.LAW: {
        "description": "Primary legislation with binding legal force",
        "citation_style": "Must cite specific sections/articles accurately",
        "interpretation": "Interpret according to legal principles and judicial precedent"
    },
    DocType.ORDINANCE: {
        "description": "Implementing regulation with binding legal force",
        "citation_style": "Reference parent law and specific provisions",
        "interpretation": "Read in conjunction with parent legislation"
    },
    DocType.MERKBLATT: {
        "description": "Guidance document / information sheet (non-binding)",
        "citation_style": "Reference as guidance, not binding law",
        "interpretation": "Best practice recommendations, not legal requirements"
    },
    DocType.GUIDELINE: {
        "description": "Technical guidance or standards",
        "citation_style": "Reference issuing authority and publication date",
        "interpretation": "Industry best practices, may become de facto requirements"
    }
}


def get_ai_context_prompt(country: str, doc_type: str = DocType.LAW) -> str:
    """
    Generate an AI context prompt that includes country and document type awareness.

    This prompt should be prepended to AI requests to ensure context-aware responses.
    """
    country_ctx = AI_COUNTRY_CONTEXT.get(country, AI_COUNTRY_CONTEXT["DE"])
    doc_ctx = AI_DOC_TYPE_CONTEXT.get(doc_type, AI_DOC_TYPE_CONTEXT[DocType.LAW])

    terminology = "\n".join(f"  - {note}" for note in country_ctx["terminology_notes"])

    prompt = f"""You are analyzing a **{country}** ({country_ctx['language']}) legal document.

LEGAL CONTEXT:
- Document Type: {doc_type.upper()} - {doc_ctx['description']}
- Legal System: {country_ctx['legal_system']}
- Primary Framework: {country_ctx['legal_framework']}
- Key Authorities: {', '.join(country_ctx['key_authorities'])}

TERMINOLOGY REQUIREMENTS:
{terminology}

CITATION STYLE:
{doc_ctx['citation_style']}

INTERPRETATION:
{doc_ctx['interpretation']}

Please ensure your analysis and responses use the appropriate legal terminology and context for {country}.
"""
    return prompt


def enhance_ai_prompt_with_context(base_prompt: str, country: str, doc_type: str = DocType.LAW) -> str:
    """
    Enhance an AI prompt with country and document type context.
    """
    context = get_ai_context_prompt(country, doc_type)
    return f"{context}\n\n---\n\n{base_prompt}"


# =============================================================================
# PDF Summarization for PDF-only sources
# =============================================================================

def summarize_pdf_with_ai(pdf_text: str, country: str, doc_type: str = DocType.MERKBLATT,
                          title: str = "", max_summary_length: int = 2000) -> Optional[str]:
    """
    Use AI to generate a searchable text summary for PDF-only sources (like Merkblätter).

    This makes PDF content searchable in the database even when full text extraction
    produces poor results (scanned documents, complex layouts, etc.).
    """
    if not pdf_text or len(pdf_text.strip()) < 100:
        log_warning("PDF text too short for summarization")
        return None

    # Truncate very long texts
    text_to_summarize = pdf_text[:15000] if len(pdf_text) > 15000 else pdf_text

    context = get_ai_context_prompt(country, doc_type)

    prompt = f"""{context}

TASK: Create a comprehensive searchable summary of this {doc_type} document.

DOCUMENT TITLE: {title or 'Unknown'}

The summary should:
1. Capture all main topics and requirements covered
2. Include key terminology and technical terms (for search)
3. List specific hazards, controls, or procedures mentioned
4. Identify target audience and application scope
5. Note any referenced laws or standards

Keep the summary under {max_summary_length} characters but ensure it covers all searchable content.

DOCUMENT TEXT:
{text_to_summarize}

SUMMARY:"""

    summary = call_gemini_api(prompt, temperature=0.2, max_tokens=2000)

    if summary:
        log_success(f"Generated AI summary ({len(summary)} chars)")
        return summary[:max_summary_length]

    return None


def call_gemini_api(prompt: str, temperature: float = 0.3, max_tokens: int = None) -> Optional[str]:
    """
    Call Gemini API directly via REST (v1 API) to support newer models like gemini-3-flash.
    Returns the generated text or None on error.

    Uses CONFIG.ai_max_tokens (8192) by default for larger Gemini 3 context windows.
    Uses CONFIG.request_timeout for API request timeout.
    """
    if max_tokens is None:
        max_tokens = CONFIG.ai_max_tokens

    if not HAS_REQUESTS:
        log_error("requests package required for Gemini API calls")
        return None

    api_key = get_api_key()
    if not api_key:
        log_error("GEMINI_API_KEY not set")
        return None

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{CONFIG.gemini_model}:generateContent?key={api_key}"

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }

        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=CONFIG.request_timeout
        )

        if response.status_code != 200:
            error_msg = response.json().get('error', {}).get('message', response.text)
            log_error(f"Gemini API error ({response.status_code}): {error_msg}")
            return None

        data = response.json()
        text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
        return text.strip() if text else None

    except Exception as e:
        log_error(f"Gemini API call failed: {e}")
        return None


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


def get_changelog_path() -> Path:
    """Get path to the update changelog file."""
    return CONFIG.base_path / "update_changelog.json"


def load_changelog() -> Dict[str, Any]:
    """Load the update changelog from file."""
    changelog_path = get_changelog_path()
    if changelog_path.exists():
        try:
            with open(changelog_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"updates": [], "last_check": None}


def save_changelog(changelog: Dict[str, Any]) -> None:
    """Save the update changelog to file."""
    changelog_path = get_changelog_path()
    with open(changelog_path, 'w', encoding='utf-8') as f:
        json.dump(changelog, f, indent=2, ensure_ascii=False)
    log_info(f"Changelog saved to {changelog_path}")


def record_update(country: str, update_results: Dict[str, Any], scraped_laws: List[str] = None) -> None:
    """Record an update event to the changelog.

    Args:
        country: Country code (AT, DE, NL)
        update_results: Results from check_for_updates
        scraped_laws: List of law abbreviations that were actually scraped/updated
    """
    changelog = load_changelog()

    # Create update entry
    update_entry = {
        "timestamp": datetime.now().isoformat(),
        "country": country,
        "new_laws": [item['abbreviation'] for item in update_results.get('new', [])],
        "updated_laws": [item['abbreviation'] for item in update_results.get('updated', [])],
        "unchanged_laws": [item['abbreviation'] for item in update_results.get('unchanged', [])],
        "scraped_laws": scraped_laws or [],
        "details": {
            "new": update_results.get('new', []),
            "updated": update_results.get('updated', [])
        }
    }

    # Add to changelog (keep last 50 entries)
    changelog["updates"].insert(0, update_entry)
    changelog["updates"] = changelog["updates"][:50]
    changelog["last_check"] = datetime.now().isoformat()

    save_changelog(changelog)


def get_recent_changes(days: int = 14) -> List[Dict[str, Any]]:
    """Get list of laws that changed within the specified number of days.

    Returns list of dicts with: abbreviation, country, change_type, timestamp
    """
    changelog = load_changelog()
    cutoff = datetime.now() - timedelta(days=days)

    recent_changes = []
    seen = set()  # Track unique law changes

    for update in changelog.get("updates", []):
        try:
            update_time = datetime.fromisoformat(update["timestamp"])
            if update_time < cutoff:
                continue

            country = update.get("country", "")

            # Add new laws
            for abbrev in update.get("new_laws", []):
                key = f"{country}:{abbrev}"
                if key not in seen:
                    recent_changes.append({
                        "abbreviation": abbrev,
                        "country": country,
                        "change_type": "new",
                        "timestamp": update["timestamp"]
                    })
                    seen.add(key)

            # Add updated laws
            for abbrev in update.get("updated_laws", []):
                key = f"{country}:{abbrev}"
                if key not in seen:
                    # Find details for this update
                    details = next(
                        (d for d in update.get("details", {}).get("updated", [])
                         if d.get("abbreviation") == abbrev),
                        {}
                    )
                    recent_changes.append({
                        "abbreviation": abbrev,
                        "country": country,
                        "change_type": "updated",
                        "timestamp": update["timestamp"],
                        "old_hash": details.get("old_hash"),
                        "new_hash": details.get("new_hash")
                    })
                    seen.add(key)
        except (ValueError, KeyError):
            continue

    return recent_changes


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
# Official Law Structures and Section Titles
# =============================================================================

# Official section titles for Austrian laws
# Used during scraping to ensure proper titles are applied
AT_SECTION_TITLES = {
    'ASCHG': {
        '1': 'Geltungsbereich', '2': 'Begriffsbestimmungen',
        '3': 'Allgemeine Pflichten der Arbeitgeber',
        '4': 'Ermittlung und Beurteilung der Gefahren; Festlegung von Maßnahmen',
        '4a': 'Präventivdienste für Baustellen',
        '5': 'Sicherheits- und Gesundheitsschutzdokumente',
        '5a': 'Ermittlung und Beurteilung der Gefahren bei Baustellen',
        '6': 'Einsatz der Arbeitnehmer', '7': 'Grundsätze der Gefahrenverhütung',
        '7a': 'Koordination bei Baustellen', '8': 'Koordination', '8a': 'Vorankündigung',
        '9': 'Überlassung', '10': 'Bestellung von Sicherheitsvertrauenspersonen',
        '10a': 'Sicherheitsvertrauenspersonen auf Baustellen',
        '11': 'Aufgaben, Information und Beiziehung der Sicherheitsvertrauenspersonen',
        '12': 'Information', '13': 'Anhörung und Beteiligung der Arbeitnehmer',
        '14': 'Unterweisung', '15': 'Pflichten der Arbeitnehmer',
        '16': 'Besondere Pflichten der Arbeitnehmer',
    },
    'KJBG': {
        '0': 'Präambel', '1': 'Geltungsbereich', '2': 'Begriffsbestimmungen', '3': 'Jugendliche',
        '4': 'Verbot der Kinderarbeit', '5': 'Kinder dürfen',
        '5a': 'Bewilligungspflichtige Beschäftigung', '6': 'Beschäftigungsverbote für Jugendliche',
        '7': 'Gefährliche Arbeiten', '8': 'Akkord- und Fließarbeit',
        '9': 'Ärztliche Untersuchungen', '10': 'Untersuchungsbefund',
        '11': 'Kosten der Untersuchungen', '12': 'Dauer der Arbeitszeit',
        '13': 'Verbot der Nachtarbeit', '14': 'Ausnahmen vom Verbot der Nachtarbeit',
        '15': 'Wochenendruhe und Wochenruhe', '16': 'Ausnahmen von der Wochenendruhe',
        '17': 'Ruhepausen', '17a': 'Ruhepausen bei Schichtarbeit', '18': 'Tägliche Ruhezeit',
        '19': 'Überstunden', '20': 'Ausnahmen bei vorübergehenden Arbeiten',
        '21': 'Verzeichnisse und Aushänge', '22': 'Verlängerter Urlaub',
        '23': 'Strafbestimmungen', '24': 'Zuständigkeit', '25': 'Nichtigkeitsbeschwerde',
        '26': 'Arbeitsinspektorate', '27': 'Befugnisse der Arbeitsinspektorate',
        '28': 'Verweisungen', '29': 'Durchführung', '30': 'Inkrafttreten',
    },
    'AZG': {
        '1': 'Geltungsbereich', '2': 'Ausnahmen vom Geltungsbereich',
        '3': 'Begriff der Arbeitszeit', '4': 'Normalarbeitszeit',
        '4a': 'Andere Verteilung der Normalarbeitszeit', '4b': 'Gleitende Arbeitszeit',
        '5': 'Verlängerte Normalarbeitszeit', '5a': 'Erhöhte Arbeitsbereitschaft',
        '6': 'Höchstgrenzen der Arbeitszeit', '7': 'Überstundenarbeit',
        '8': 'Überstundenentgelt', '9': 'Arbeitszeiteinteilung', '9a': 'Umkleidezeiten',
        '10': 'Durchrechnungszeitraum', '11': 'Ruhepausen', '12': 'Ruhezeiten',
        '12a': 'Wöchentliche Ruhezeit', '13': 'Rufbereitschaft',
        '14': 'Kollektivvertragliche Regelungen', '15': 'Begriffsbestimmungen',
        '16': 'Nachtarbeit', '17': 'Schichtarbeit', '17a': 'Wechselschicht',
        '18': 'Gesundheitsuntersuchungen', '19': 'Nacht-Schwerarbeit',
    },
    'MSCHG': {
        '1': 'Geltungsbereich', '2': 'Mitteilungspflicht',
        '3': 'Beschäftigungsverbot vor der Entbindung',
        '4': 'Individuelles Beschäftigungsverbot', '5': 'Beschäftigungsverbot nach der Entbindung',
        '6': 'Stillende Mütter', '7': 'Beschäftigungsverbote und -beschränkungen',
        '8': 'Verbot von Nachtarbeit', '9': 'Verbot von Sonntagsarbeit',
        '10': 'Verbot von Überstundenarbeit', '10a': 'Kündigungsschutz',
        '11': 'Kündigung während der Schwangerschaft', '12': 'Kündigung nach der Entbindung',
        '13': 'Entlassungsschutz', '14': 'Einvernehmen mit Belegschaftsorganen', '15': 'Karenz',
    },
    'ARG': {
        '1': 'Geltungsbereich', '2': 'Begriffsbestimmungen', '3': 'Wochenendruhe',
        '4': 'Wochenruhe', '5': 'Ersatzruhe', '6': 'Feiertagsruhe', '7': 'Feiertage',
        '7a': 'Ausnahmen an Feiertagen', '8': 'Ausnahmen von der Wochenend- und Feiertagsruhe',
        '9': 'Behördliche Ausnahmen', '10': 'Strafbestimmungen', '11': 'Durchführung',
        '12': 'Inkrafttreten',
    },
}

# Official section titles for Dutch laws
NL_SECTION_TITLES = {
    'ARBOWET': {
        '1': 'Definities', '2': 'Uitbreiding toepassingsgebied', '3': 'Arbobeleid',
        '4': 'Aanpassing arbeidsplaats werknemer met structurele functionele beperking',
        '5': "Inventarisatie en evaluatie van risico's",
        '6': 'Voorkoming en beperking van zware ongevallen',
        '7': 'Informatie aan het publiek', '8': 'Voorlichting en onderricht',
        '9': 'Melding en registratie van arbeidsongevallen en beroepsziekten',
        '10': 'Voorkomen van gevaar voor derden', '11': 'Algemene verplichtingen van de werknemers',
        '12': 'Samenwerking, overleg en bijzondere rechten van werknemers',
        '13': 'Bijstand deskundige werknemers', '14': 'Maatwerkregeling aanvullende deskundige bijstand',
        '14a': 'Vangnetregeling aanvullende deskundige bijstand',
        '15': 'Deskundige bijstand op het gebied van bedrijfshulpverlening',
    },
}


def get_official_section_title(abbrev: str, section_num: str, country: str = "AT") -> Optional[str]:
    """Get official section title from the title mappings."""
    title_map = AT_SECTION_TITLES if country == "AT" else NL_SECTION_TITLES
    law_titles = title_map.get(abbrev.upper(), {})
    return law_titles.get(str(section_num).lower()) or law_titles.get(str(section_num))


def apply_official_section_titles(sections: List[Dict], abbrev: str, country: str = "AT") -> List[Dict]:
    """Apply official section titles to scraped sections."""
    for section in sections:
        num = section.get('number', '')
        official_title = get_official_section_title(abbrev, num, country)
        if official_title:
            # Format the title appropriately
            if country == "NL":
                section['title'] = f"Artikel {num}. {official_title}"
            else:
                if num == '0' or num.lower() in ('präambel', 'langtitel'):
                    section['title'] = official_title
                else:
                    section['title'] = f"§ {num}. {official_title}"
    return sections


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

# Official structure: Austria KJBG (Kinder- und Jugendlichen-Beschäftigungsgesetz 1987)
STRUCTURE_KJBG = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 3)},
    {"number": "2", "title": "2. Abschnitt - Beschäftigungsverbote und -beschränkungen", "title_en": "Section 2 - Employment Prohibitions and Restrictions", "section_range": (4, 11)},
    {"number": "3", "title": "3. Abschnitt - Arbeitszeit", "title_en": "Section 3 - Working Time", "section_range": (12, 21)},
    {"number": "4", "title": "4. Abschnitt - Urlaub", "title_en": "Section 4 - Leave", "section_range": (22, 22)},
    {"number": "5", "title": "5. Abschnitt - Strafbestimmungen", "title_en": "Section 5 - Penal Provisions", "section_range": (23, 25)},
    {"number": "6", "title": "6. Abschnitt - Behörden", "title_en": "Section 6 - Authorities", "section_range": (26, 27)},
    {"number": "7", "title": "7. Abschnitt - Schluss- und Übergangsbestimmungen", "title_en": "Section 7 - Final and Transitional Provisions", "section_range": (28, 43)},
]

# Official structure: Austria AZG (Arbeitszeitgesetz)
STRUCTURE_AZG = [
    {"number": "1", "title": "1. Abschnitt - Geltungsbereich", "title_en": "Section 1 - Scope", "section_range": (1, 2)},
    {"number": "2", "title": "2. Abschnitt - Arbeitszeit", "title_en": "Section 2 - Working Time", "section_range": (3, 14)},
    {"number": "3", "title": "3. Abschnitt - Nacht- und Schichtarbeit", "title_en": "Section 3 - Night and Shift Work", "section_range": (15, 19.99)},
    {"number": "4", "title": "4. Abschnitt - Besondere Bestimmungen", "title_en": "Section 4 - Special Provisions", "section_range": (20, 28)},
    {"number": "5", "title": "5. Abschnitt - Verfahrens- und Strafbestimmungen", "title_en": "Section 5 - Procedural and Penal Provisions", "section_range": (29, 32)},
    {"number": "6", "title": "6. Abschnitt - Schlussbestimmungen", "title_en": "Section 6 - Final Provisions", "section_range": (33, 36)},
]

# Official structure: Austria MSchG (Mutterschutzgesetz 1979)
STRUCTURE_MSCHG = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 2)},
    {"number": "2", "title": "2. Abschnitt - Beschäftigungsverbote und -beschränkungen", "title_en": "Section 2 - Employment Prohibitions and Restrictions", "section_range": (3, 10)},
    {"number": "3", "title": "3. Abschnitt - Kündigungs- und Entlassungsschutz", "title_en": "Section 3 - Dismissal Protection", "section_range": (10.01, 15.99)},
    {"number": "4", "title": "4. Abschnitt - Entgelt und sonstige Leistungen", "title_en": "Section 4 - Pay and Other Benefits", "section_range": (16, 22)},
    {"number": "5", "title": "5. Abschnitt - Aufsicht und Durchführung", "title_en": "Section 5 - Supervision and Implementation", "section_range": (23, 29)},
    {"number": "6", "title": "6. Abschnitt - Strafbestimmungen", "title_en": "Section 6 - Penal Provisions", "section_range": (30, 32)},
    {"number": "7", "title": "7. Abschnitt - Schlussbestimmungen", "title_en": "Section 7 - Final Provisions", "section_range": (33, 35)},
]

# Official structure: Austria ARG (Arbeitsruhegesetz)
STRUCTURE_ARG = [
    {"number": "1", "title": "Hauptteil", "title_en": "Main Part", "section_range": (1, 12)},
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

# Official structure: Austria AStV (Arbeitsstättenverordnung) - 6 Abschnitte
STRUCTURE_ASTV = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 3)},
    {"number": "2", "title": "2. Abschnitt - Anforderungen an Arbeitsstätten", "title_en": "Section 2 - Requirements for Workplaces", "section_range": (4, 20)},
    {"number": "3", "title": "3. Abschnitt - Anforderungen an Arbeitsräume", "title_en": "Section 3 - Requirements for Work Rooms", "section_range": (21, 28)},
    {"number": "4", "title": "4. Abschnitt - Sanitäre Anlagen und Aufenthaltsräume", "title_en": "Section 4 - Sanitary Facilities and Break Rooms", "section_range": (29, 40)},
    {"number": "5", "title": "5. Abschnitt - Brandschutz und Erste Hilfe", "title_en": "Section 5 - Fire Protection and First Aid", "section_range": (41, 50)},
    {"number": "6", "title": "6. Abschnitt - Schlussbestimmungen", "title_en": "Section 6 - Final Provisions", "section_range": (51, 55)},
]

# Official structure: Austria AM-VO (Arbeitsmittelverordnung) - 6 Abschnitte
STRUCTURE_AMVO = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 5)},
    {"number": "2", "title": "2. Abschnitt - Anforderungen an Arbeitsmittel", "title_en": "Section 2 - Requirements for Work Equipment", "section_range": (6, 15)},
    {"number": "3", "title": "3. Abschnitt - Benutzung von Arbeitsmitteln", "title_en": "Section 3 - Use of Work Equipment", "section_range": (16, 25)},
    {"number": "4", "title": "4. Abschnitt - Prüfung und Wartung", "title_en": "Section 4 - Testing and Maintenance", "section_range": (26, 35)},
    {"number": "5", "title": "5. Abschnitt - Besondere Arbeitsmittel", "title_en": "Section 5 - Special Work Equipment", "section_range": (36, 50)},
    {"number": "6", "title": "6. Abschnitt - Schlussbestimmungen", "title_en": "Section 6 - Final Provisions", "section_range": (51, 60)},
]

# Official structure: Austria BauV (Bauarbeiterschutzverordnung) - 8 Abschnitte
STRUCTURE_BAUV = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 5)},
    {"number": "2", "title": "2. Abschnitt - Baustelleneinrichtung", "title_en": "Section 2 - Construction Site Equipment", "section_range": (6, 20)},
    {"number": "3", "title": "3. Abschnitt - Absturzsicherung", "title_en": "Section 3 - Fall Protection", "section_range": (21, 40)},
    {"number": "4", "title": "4. Abschnitt - Gerüste", "title_en": "Section 4 - Scaffolding", "section_range": (41, 80)},
    {"number": "5", "title": "5. Abschnitt - Erd- und Felsarbeiten", "title_en": "Section 5 - Earth and Rock Work", "section_range": (81, 100)},
    {"number": "6", "title": "6. Abschnitt - Abbrucharbeiten", "title_en": "Section 6 - Demolition Work", "section_range": (101, 120)},
    {"number": "7", "title": "7. Abschnitt - Besondere Bauarbeiten", "title_en": "Section 7 - Special Construction Work", "section_range": (121, 150)},
    {"number": "8", "title": "8. Abschnitt - Schlussbestimmungen", "title_en": "Section 8 - Final Provisions", "section_range": (151, 170)},
]

# Official structure: Austria BS-V (Bildschirmarbeitsverordnung) - 6 Abschnitte
STRUCTURE_BSV = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 2)},
    {"number": "2", "title": "2. Abschnitt - Anforderungen an Bildschirmarbeitsplätze", "title_en": "Section 2 - Requirements for Display Screen Workstations", "section_range": (3, 5)},
    {"number": "3", "title": "3. Abschnitt - Anforderungen an die Bildschirmarbeit", "title_en": "Section 3 - Requirements for Display Screen Work", "section_range": (6, 8)},
    {"number": "4", "title": "4. Abschnitt - Unterbrechungen und Untersuchungen", "title_en": "Section 4 - Breaks and Examinations", "section_range": (9, 11)},
    {"number": "5", "title": "5. Abschnitt - Information und Unterweisung", "title_en": "Section 5 - Information and Instruction", "section_range": (12, 14)},
    {"number": "6", "title": "6. Abschnitt - Schlussbestimmungen", "title_en": "Section 6 - Final Provisions", "section_range": (15, 18)},
]

# Official structure: Austria PSA-V (Verordnung Persönliche Schutzausrüstung) - 2 Abschnitte
STRUCTURE_PSAV = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 10)},
    {"number": "2", "title": "2. Abschnitt - Schlussbestimmungen", "title_en": "Section 2 - Final Provisions", "section_range": (11, 15)},
]

# Official structure: Austria ESV 2012 (Elektroschutzverordnung 2012) - 4 Abschnitte
STRUCTURE_ESV2012 = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 3)},
    {"number": "2", "title": "2. Abschnitt - Sicherheitsmaßnahmen", "title_en": "Section 2 - Safety Measures", "section_range": (4, 10)},
    {"number": "3", "title": "3. Abschnitt - Prüfungen und Qualifikationen", "title_en": "Section 3 - Tests and Qualifications", "section_range": (11, 18)},
    {"number": "4", "title": "4. Abschnitt - Schlussbestimmungen", "title_en": "Section 4 - Final Provisions", "section_range": (19, 22)},
]

# Official structure: Austria LärmV (Verordnung Lärm und Vibrationen) - 5 Abschnitte
STRUCTURE_LAERMV = [
    {"number": "1", "title": "1. Abschnitt - Allgemeine Bestimmungen", "title_en": "Section 1 - General Provisions", "section_range": (1, 2)},
    {"number": "2", "title": "2. Abschnitt - Lärm", "title_en": "Section 2 - Noise", "section_range": (3, 7)},
    {"number": "3", "title": "3. Abschnitt - Vibrationen", "title_en": "Section 3 - Vibrations", "section_range": (8, 12)},
    {"number": "4", "title": "4. Abschnitt - Gemeinsame Bestimmungen", "title_en": "Section 4 - Common Provisions", "section_range": (13, 16)},
    {"number": "5", "title": "5. Abschnitt - Schlussbestimmungen", "title_en": "Section 5 - Final Provisions", "section_range": (17, 20)},
]

# Official structure: Germany ASiG (Arbeitssicherheitsgesetz) - 5 Abschnitte
STRUCTURE_ASIG = [
    {"number": "1", "title": "Erster Abschnitt - Allgemeine Vorschriften", "title_en": "First Section - General Provisions", "section_range": (1, 1)},
    {"number": "2", "title": "Zweiter Abschnitt - Betriebsärzte", "title_en": "Second Section - Company Physicians", "section_range": (2, 4)},
    {"number": "3", "title": "Dritter Abschnitt - Fachkräfte für Arbeitssicherheit", "title_en": "Third Section - Occupational Safety Specialists", "section_range": (5, 7)},
    {"number": "4", "title": "Vierter Abschnitt - Gemeinsame Vorschriften", "title_en": "Fourth Section - Common Provisions", "section_range": (8, 19)},
    {"number": "5", "title": "Fünfter Abschnitt - Schlußvorschriften", "title_en": "Fifth Section - Final Provisions", "section_range": (20, 21)},
]

# Official structure: Germany ArbZG (Arbeitszeitgesetz) - 8 Abschnitte
STRUCTURE_ARBZG = [
    {"number": "1", "title": "Erster Abschnitt - Allgemeine Vorschriften", "title_en": "First Section - General Provisions", "section_range": (1, 2)},
    {"number": "2", "title": "Zweiter Abschnitt - Werktägliche Arbeitszeit und arbeitsfreie Zeiten", "title_en": "Second Section - Daily Working Time and Rest Periods", "section_range": (3, 8)},
    {"number": "3", "title": "Dritter Abschnitt - Sonn- und Feiertagsruhe", "title_en": "Third Section - Sunday and Holiday Rest", "section_range": (9, 13)},
    {"number": "4", "title": "Vierter Abschnitt - Ausnahmen in besonderen Fällen", "title_en": "Fourth Section - Exceptions in Special Cases", "section_range": (14, 15)},
    {"number": "5", "title": "Fünfter Abschnitt - Durchführung des Gesetzes", "title_en": "Fifth Section - Implementation", "section_range": (16, 17)},
    {"number": "6", "title": "Sechster Abschnitt - Sonderregelungen", "title_en": "Sixth Section - Special Regulations", "section_range": (18, 21.99)},
    {"number": "7", "title": "Siebter Abschnitt - Straf- und Bußgeldvorschriften", "title_en": "Seventh Section - Criminal and Penalty Provisions", "section_range": (22, 23)},
    {"number": "8", "title": "Achter Abschnitt - Schlußvorschriften", "title_en": "Eighth Section - Final Provisions", "section_range": (24, 26)},
]

# Official structure: Germany JArbSchG (Jugendarbeitsschutzgesetz) - 5 Abschnitte
STRUCTURE_JARBSCHG = [
    {"number": "1", "title": "Erster Abschnitt - Allgemeines", "title_en": "First Section - General", "section_range": (1, 4)},
    {"number": "2", "title": "Zweiter Abschnitt - Beschäftigung von Kindern", "title_en": "Second Section - Employment of Children", "section_range": (5, 7)},
    {"number": "3", "title": "Dritter Abschnitt - Beschäftigung Jugendlicher", "title_en": "Third Section - Employment of Young People", "section_range": (8, 46)},
    {"number": "4", "title": "Vierter Abschnitt - Durchführung des Gesetzes", "title_en": "Fourth Section - Implementation", "section_range": (47, 58)},
    {"number": "5", "title": "Fünfter Abschnitt - Straf- und Bußgeldvorschriften, Schlußvorschriften", "title_en": "Fifth Section - Criminal and Penalty Provisions, Final Provisions", "section_range": (59, 75)},
]

# Official structure: Germany ArbStättV (Arbeitsstättenverordnung) - 4 Abschnitte
STRUCTURE_ARBSTAETTV = [
    {"number": "1", "title": "Erster Abschnitt - Allgemeine Vorschriften", "title_en": "First Section - General Provisions", "section_range": (1, 2)},
    {"number": "2", "title": "Zweiter Abschnitt - Pflichten des Arbeitgebers", "title_en": "Second Section - Employer Obligations", "section_range": (3, 6)},
    {"number": "3", "title": "Dritter Abschnitt - Besondere Anforderungen", "title_en": "Third Section - Special Requirements", "section_range": (7, 8)},
    {"number": "4", "title": "Vierter Abschnitt - Schlußvorschriften", "title_en": "Fourth Section - Final Provisions", "section_range": (9, 11)},
]

# Official structure: Germany BetrSichV (Betriebssicherheitsverordnung) - 4 Abschnitte
STRUCTURE_BETRSICHV = [
    {"number": "1", "title": "Erster Abschnitt - Anwendungsbereich und Begriffsbestimmungen", "title_en": "First Section - Scope and Definitions", "section_range": (1, 2)},
    {"number": "2", "title": "Zweiter Abschnitt - Gefährdungsbeurteilung und Schutzmaßnahmen", "title_en": "Second Section - Risk Assessment and Protective Measures", "section_range": (3, 13)},
    {"number": "3", "title": "Dritter Abschnitt - Zusätzliche Vorschriften für überwachungsbedürftige Anlagen", "title_en": "Third Section - Additional Requirements for Installations Subject to Monitoring", "section_range": (14, 20)},
    {"number": "4", "title": "Vierter Abschnitt - Vollzugsregelungen und Schlußvorschriften", "title_en": "Fourth Section - Enforcement and Final Provisions", "section_range": (21, 24)},
]

# Official structure: Germany GefStoffV (Gefahrstoffverordnung) - 7 Abschnitte
STRUCTURE_GEFSTOFFV = [
    {"number": "1", "title": "Erster Abschnitt - Zielsetzung, Anwendungsbereich und Begriffsbestimmungen", "title_en": "First Section - Objectives, Scope and Definitions", "section_range": (1, 2)},
    {"number": "2", "title": "Zweiter Abschnitt - Gefahrstoffinformation", "title_en": "Second Section - Hazardous Substance Information", "section_range": (3, 5)},
    {"number": "3", "title": "Dritter Abschnitt - Gefährdungsbeurteilung und Grundpflichten", "title_en": "Third Section - Risk Assessment and Basic Obligations", "section_range": (6, 7)},
    {"number": "4", "title": "Vierter Abschnitt - Schutzmaßnahmen", "title_en": "Fourth Section - Protective Measures", "section_range": (8, 13)},
    {"number": "5", "title": "Fünfter Abschnitt - Verbote und Beschränkungen", "title_en": "Fifth Section - Prohibitions and Restrictions", "section_range": (14, 17)},
    {"number": "6", "title": "Sechster Abschnitt - Vollzugsregelungen und Ausschuss für Gefahrstoffe", "title_en": "Sixth Section - Enforcement and Committee for Hazardous Substances", "section_range": (18, 20)},
    {"number": "7", "title": "Siebter Abschnitt - Ordnungswidrigkeiten und Straftaten", "title_en": "Seventh Section - Administrative Offenses and Criminal Offenses", "section_range": (21, 25)},
]

# Official structure: Germany MuSchG (Mutterschutzgesetz) - 6 Abschnitte
STRUCTURE_MUSCHG = [
    {"number": "1", "title": "Erster Abschnitt - Allgemeine Vorschriften", "title_en": "First Section - General Provisions", "section_range": (1, 2)},
    {"number": "2", "title": "Zweiter Abschnitt - Gesundheitsschutz", "title_en": "Second Section - Health Protection", "section_range": (3, 16)},
    {"number": "3", "title": "Dritter Abschnitt - Kündigungsschutz", "title_en": "Third Section - Dismissal Protection", "section_range": (17, 17)},
    {"number": "4", "title": "Vierter Abschnitt - Leistungen", "title_en": "Fourth Section - Benefits", "section_range": (18, 25)},
    {"number": "5", "title": "Fünfter Abschnitt - Durchführung des Gesetzes", "title_en": "Fifth Section - Implementation", "section_range": (26, 31)},
    {"number": "6", "title": "Sechster Abschnitt - Bußgeldvorschriften, Strafvorschriften", "title_en": "Sixth Section - Penalty and Criminal Provisions", "section_range": (32, 34)},
]

# Official structure: Germany LärmVibrationsArbSchV - 4 Abschnitte
STRUCTURE_LAERMVIBRATIONSARBSCHV = [
    {"number": "1", "title": "Erster Abschnitt - Anwendungsbereich und Begriffsbestimmungen", "title_en": "First Section - Scope and Definitions", "section_range": (1, 2)},
    {"number": "2", "title": "Zweiter Abschnitt - Ermittlung und Bewertung der Gefährdung; Messungen", "title_en": "Second Section - Hazard Assessment and Measurements", "section_range": (3, 4)},
    {"number": "3", "title": "Dritter Abschnitt - Schutzmaßnahmen", "title_en": "Third Section - Protective Measures", "section_range": (5, 12)},
    {"number": "4", "title": "Vierter Abschnitt - Unterweisung und allgemeine Pflichten", "title_en": "Fourth Section - Instruction and General Duties", "section_range": (13, 18)},
]

# Official structure: Germany BioStoffV (Biostoffverordnung) - 4 Abschnitte
STRUCTURE_BIOSTOFFV = [
    {"number": "1", "title": "Erster Abschnitt - Anwendungsbereich und Begriffsbestimmungen", "title_en": "First Section - Scope and Definitions", "section_range": (1, 2)},
    {"number": "2", "title": "Zweiter Abschnitt - Gefährdungsbeurteilung und Schutzmaßnahmen", "title_en": "Second Section - Risk Assessment and Protective Measures", "section_range": (3, 14)},
    {"number": "3", "title": "Dritter Abschnitt - Zusätzliche Vorschriften", "title_en": "Third Section - Additional Provisions", "section_range": (15, 17)},
    {"number": "4", "title": "Vierter Abschnitt - Vollzugsregelungen und Schlußvorschriften", "title_en": "Fourth Section - Enforcement and Final Provisions", "section_range": (18, 21)},
]

# Official structure: Germany ArbMedVV - 3 Abschnitte
STRUCTURE_ARBMEDVV = [
    {"number": "1", "title": "Erster Abschnitt - Allgemeine Vorschriften", "title_en": "First Section - General Provisions", "section_range": (1, 2)},
    {"number": "2", "title": "Zweiter Abschnitt - Arbeitsmedizinische Vorsorge", "title_en": "Second Section - Occupational Medical Care", "section_range": (3, 7)},
    {"number": "3", "title": "Dritter Abschnitt - Schlußvorschriften", "title_en": "Third Section - Final Provisions", "section_range": (8, 11)},
]

# Official structure: Germany LastenhandhabV (Lastenhandhabungsverordnung) - flat structure, 6 sections
STRUCTURE_LASTENHANDHABV = [
    {"number": "1", "title": "Hauptteil", "title_en": "Main Part", "section_range": (1, 6)},
]

# Official structure: Germany DGUV Vorschrift 1 (Grundsätze der Prävention) - DGUV rule structure
STRUCTURE_DGUV_V1 = [
    {"number": "1", "title": "Erstes Kapitel - Allgemeine Vorschriften", "title_en": "First Chapter - General Provisions", "section_range": (1, 6)},
    {"number": "2", "title": "Zweites Kapitel - Pflichten des Unternehmers", "title_en": "Second Chapter - Employer Obligations", "section_range": (7, 14)},
    {"number": "3", "title": "Drittes Kapitel - Pflichten der Versicherten", "title_en": "Third Chapter - Insured Persons' Obligations", "section_range": (15, 18)},
    {"number": "4", "title": "Viertes Kapitel - Organisation des betrieblichen Arbeitsschutzes", "title_en": "Fourth Chapter - Organization of Occupational Safety", "section_range": (19, 26)},
    {"number": "5", "title": "Fünftes Kapitel - Ordnungswidrigkeiten", "title_en": "Fifth Chapter - Administrative Offenses", "section_range": (27, 29)},
]

# Official structure: Austria BauKG (Bauarbeitenkoordinationsgesetz) - 20 sections
STRUCTURE_BAUKG = [
    {"number": "1", "title": "Hauptteil", "title_en": "Main Part", "section_range": (1, 20)},
]

# Official structure: Austria DOK-VO (Dokumentationsverordnung) - 7 sections
STRUCTURE_DOKVO = [
    {"number": "1", "title": "Hauptteil", "title_en": "Main Part", "section_range": (1, 7)},
]

# Official structure: Netherlands WED (Wet op de economische delicten) - flat structure, ~96 articles
STRUCTURE_WED = [
    {"number": "1", "title": "Hoofdinhoud", "title_en": "Main Content", "section_range": (1, 100)},
]

# Official structure: Netherlands Arbobesluit - 9 Hoofdstukken
STRUCTURE_ARBOBESLUIT = [
    {"number": "1", "title": "Hoofdstuk 1 - Definities en toepassingsgebied", "title_en": "Chapter 1 - Definitions and Scope", "section_range": (1, 1.99)},
    {"number": "2", "title": "Hoofdstuk 2 - Arbozorg en organisatie van de arbeid", "title_en": "Chapter 2 - Working Conditions Care and Work Organization", "section_range": (2, 2.99)},
    {"number": "3", "title": "Hoofdstuk 3 - Inrichting arbeidsplaatsen", "title_en": "Chapter 3 - Workplace Design", "section_range": (3, 3.99)},
    {"number": "4", "title": "Hoofdstuk 4 - Gevaarlijke stoffen en biologische agentia", "title_en": "Chapter 4 - Hazardous Substances and Biological Agents", "section_range": (4, 4.99)},
    {"number": "5", "title": "Hoofdstuk 5 - Fysische factoren", "title_en": "Chapter 5 - Physical Factors", "section_range": (5, 5.99)},
    {"number": "6", "title": "Hoofdstuk 6 - Arbeidsmiddelen en specifieke werkzaamheden", "title_en": "Chapter 6 - Work Equipment and Specific Work", "section_range": (6, 7.99)},
    {"number": "7", "title": "Hoofdstuk 7 - Bijzondere sectoren en bijzondere categorieën werknemers", "title_en": "Chapter 7 - Special Sectors and Categories of Workers", "section_range": (8, 8.99)},
    {"number": "8", "title": "Hoofdstuk 8 - Aanvullende voorschriften", "title_en": "Chapter 8 - Additional Regulations", "section_range": (9, 9.99)},
    {"number": "9", "title": "Hoofdstuk 9 - Overgangs- en slotbepalingen", "title_en": "Chapter 9 - Transitional and Final Provisions", "section_range": (10, 15)},
]

# Official structure: Netherlands Arbeidstijdenwet - 8 Hoofdstukken
STRUCTURE_ARBEIDSTIJDENWET = [
    {"number": "1", "title": "Hoofdstuk 1 - Algemene bepalingen", "title_en": "Chapter 1 - General Provisions", "section_range": (1, 1.99)},
    {"number": "2", "title": "Hoofdstuk 2 - Toepasselijkheid", "title_en": "Chapter 2 - Applicability", "section_range": (2, 2.99)},
    {"number": "3", "title": "Hoofdstuk 3 - Arbeids- en rusttijden", "title_en": "Chapter 3 - Working and Rest Time", "section_range": (3, 5.99)},
    {"number": "4", "title": "Hoofdstuk 4 - Arbeidstijd en rusttijd in bijzondere omstandigheden", "title_en": "Chapter 4 - Working and Rest Time in Special Circumstances", "section_range": (6, 6.99)},
    {"number": "5", "title": "Hoofdstuk 5 - Toezicht en opsporing", "title_en": "Chapter 5 - Supervision and Detection", "section_range": (7, 8.99)},
    {"number": "6", "title": "Hoofdstuk 6 - Ontheffingen", "title_en": "Chapter 6 - Exemptions", "section_range": (9, 9.99)},
    {"number": "7", "title": "Hoofdstuk 7 - Sanctiebepalingen", "title_en": "Chapter 7 - Penalty Provisions", "section_range": (10, 11.99)},
    {"number": "8", "title": "Hoofdstuk 8 - Slotbepalingen", "title_en": "Chapter 8 - Final Provisions", "section_range": (12, 15)},
]

LAW_STRUCTURES = {
    "AT": {
        "ASchG": STRUCTURE_ASCHG,
        "KJBG": STRUCTURE_KJBG,
        "AZG": STRUCTURE_AZG,
        "MSchG": STRUCTURE_MSCHG,
        "ARG": STRUCTURE_ARG,
        "AStV": STRUCTURE_ASTV,
        "AM-VO": STRUCTURE_AMVO,
        "BauV": STRUCTURE_BAUV,
        "BS-V": STRUCTURE_BSV,
        "PSA-V": STRUCTURE_PSAV,
        "ESV 2012": STRUCTURE_ESV2012,
        "LärmV": STRUCTURE_LAERMV,
        "BauKG": STRUCTURE_BAUKG,
        "DOK-VO": STRUCTURE_DOKVO,
    },
    "DE": {
        "ArbSchG": STRUCTURE_ARBSCHG,
        "ASiG": STRUCTURE_ASIG,
        "ArbZG": STRUCTURE_ARBZG,
        "JArbSchG": STRUCTURE_JARBSCHG,
        "ArbStättV": STRUCTURE_ARBSTAETTV,
        "BetrSichV": STRUCTURE_BETRSICHV,
        "GefStoffV": STRUCTURE_GEFSTOFFV,
        "MuSchG": STRUCTURE_MUSCHG,
        "LärmVibrationsArbSchV": STRUCTURE_LAERMVIBRATIONSARBSCHV,
        "BioStoffV": STRUCTURE_BIOSTOFFV,
        "ArbMedVV": STRUCTURE_ARBMEDVV,
        "LastenhandhabV": STRUCTURE_LASTENHANDHABV,
        "DGUV Vorschrift 1": STRUCTURE_DGUV_V1,
    },
    "NL": {
        "Arbowet": STRUCTURE_ARBOWET,
        "Arbobesluit": STRUCTURE_ARBOBESLUIT,
        "Arbeidstijdenwet": STRUCTURE_ARBEIDSTIJDENWET,
        "WED": STRUCTURE_WED,
    },
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
        # Track current law being scraped for AI URL correction on sub-page failures
        self._current_law_abbr = None

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

    def _try_fetch_with_retries(self, url: str, timeout: int, max_retries: int = None) -> Tuple[Optional[str], Optional[str], Optional[int]]:
        """
        Internal method to fetch URL with retries.
        Returns: (content, error_type, http_status)
        """
        max_retries = max_retries or CONFIG.max_retries
        last_error_type = None
        last_http_status = None

        for attempt in range(max_retries):
            try:
                response = requests.get(url, timeout=timeout, headers=self.HTTP_HEADERS)
                response.raise_for_status()
                return response.text, None, None
            except requests.exceptions.Timeout:
                log_warning(f"Timeout on attempt {attempt + 1}/{max_retries}: {url}")
                last_error_type = "timeout"
            except requests.exceptions.ConnectionError as e:
                log_warning(f"Connection error on attempt {attempt + 1}/{max_retries}: {type(e).__name__}")
                last_error_type = "connection"
            except requests.exceptions.HTTPError as e:
                status = e.response.status_code if e.response else 0
                reason = e.response.reason if e.response else str(e)
                log_warning(f"HTTP {status} ({reason}) on attempt {attempt + 1}/{max_retries}: {url}")
                last_error_type = "http"
                last_http_status = status
            except requests.exceptions.RequestException as e:
                log_warning(f"Request failed on attempt {attempt + 1}/{max_retries}: {type(e).__name__}: {e}")
                last_error_type = "request"
            except Exception as e:
                log_warning(f"Unexpected error on attempt {attempt + 1}/{max_retries}: {type(e).__name__}: {e}")
                last_error_type = "unknown"

            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                time.sleep(wait_time)

        return None, last_error_type, last_http_status

    def fetch_url(self, url: str, timeout: int = None, law_abbr: str = None) -> Optional[str]:
        """
        Fetch a URL with retries, exponential backoff, and foolproof AI URL correction.

        Features:
        - Standard retry with exponential backoff
        - AI URL correction with immediate retry using full retry logic
        - Multiple AI correction attempts if first suggestion fails
        - Automatic database update on success
        """
        if not HAS_REQUESTS:
            log_error("requests package required for scraping. Install with: pip install requests")
            return None

        # Use instance variable as fallback if law_abbr not provided
        effective_law_abbr = law_abbr or self._current_law_abbr
        timeout = timeout or CONFIG.request_timeout

        # Step 1: Try the original URL with full retry logic
        content, last_error_type, last_http_status = self._try_fetch_with_retries(url, timeout)
        if content:
            return content

        log_error(f"Failed to fetch after {CONFIG.max_retries} attempts: {url}")

        # Step 2: AI URL CORRECTION - try multiple times with feedback loop
        if not effective_law_abbr:
            return None

        MAX_AI_CORRECTION_ATTEMPTS = 3
        failed_urls = [url]  # Track URLs that have failed to avoid loops

        for ai_attempt in range(MAX_AI_CORRECTION_ATTEMPTS):
            error_code = last_http_status or 0
            error_desc = f"{last_error_type}" + (f" (HTTP {last_http_status})" if last_http_status else "")

            log_info(f"🤖 AI URL correction attempt {ai_attempt + 1}/{MAX_AI_CORRECTION_ATTEMPTS} for {effective_law_abbr} after {error_desc} errors...")

            # Pass failed URLs to AI so it knows what didn't work
            ai_result = find_correct_url_with_ai(
                self.country,
                effective_law_abbr,
                url,
                error_code,
                failed_urls=failed_urls if ai_attempt > 0 else None
            )

            if not ai_result or not ai_result.get('url'):
                reason = ai_result.get('reason', 'unknown reason') if ai_result else 'AI returned no result'
                log_warning(f"❌ AI could not find alternative URL for {effective_law_abbr}: {reason}")
                break

            new_url = ai_result['url']
            confidence = ai_result.get('confidence', 'unknown')

            # Skip if we've already tried this URL
            if new_url in failed_urls:
                log_warning(f"⚠️ AI suggested previously failed URL: {new_url} - skipping")
                continue

            log_info(f"🔍 AI found alternative URL: {new_url} (confidence: {confidence})")

            # IMMEDIATELY retry the new URL with full retry logic
            content, new_error_type, new_http_status = self._try_fetch_with_retries(new_url, timeout)

            if content:
                # SUCCESS! URL works - update the database
                log_success(f"✅ AI-corrected URL works for {effective_law_abbr}!")
                update_source_url(self.country, effective_law_abbr, new_url, ai_result.get('name'))
                return content
            else:
                # This URL also failed - track it and try again
                failed_urls.append(new_url)
                last_error_type = new_error_type
                last_http_status = new_http_status
                new_error_desc = f"{new_error_type}" + (f" (HTTP {new_http_status})" if new_http_status else "")
                log_warning(f"❌ AI-suggested URL failed ({new_error_desc}), will try AI again with feedback...")

        log_error(f"❌ All AI correction attempts exhausted for {effective_law_abbr}")
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
        """Scrape a single law - used for parallel processing.

        Priority: HTML sources from official government sites (ris.bka.gv.at)
        PDF sources are downloaded and stored WITHOUT parsing - just for display.
        """
        # Set current law for AI URL correction on sub-page failures
        self._current_law_abbr = abbrev
        log_info(f"Scraping {abbrev} with full text extraction...")
        url = self._get_full_url(path)

        # Check if this is a direct PDF URL - download only, no parsing
        if url.lower().endswith('.pdf') or 'blob=publicationFile' in url:
            log_info(f"  PDF source for {abbrev} - downloading without parsing")
            custom = load_custom_sources()
            source_info = custom.get('custom_sources', {}).get('AT', {}).get(abbrev, {})
            title = source_info.get('name', abbrev)
            description = source_info.get('description', f'PDF document: {title}')

            # Download and store PDF only - no parsing
            pdf_info = download_and_store_pdf(url, "AT", abbrev, doc_type="law")
            if not pdf_info:
                log_warning(f"  Could not download PDF for {abbrev}")
                return None

            pdf_path = pdf_info.get("local_path", "")

            # Create document without parsed content
            doc = create_unified_document(
                country="AT",
                abbrev=abbrev,
                title=title,
                doc_type=DocType.LAW,
                source_url=url,
                source_authority="PDF Source",
                content_text=description,
                full_text="",  # No text extraction
                pdf_path=pdf_path,
                ai_summary="",
                metadata={
                    "description": description,
                    "pdf_filename": pdf_info.get("filename", ""),
                    "pdf_size_bytes": pdf_info.get("size_bytes", 0),
                    "is_pdf_only": True
                }
            )

            # Add local PDF path to source for UI access
            if pdf_path:
                doc["source"]["local_pdf_path"] = pdf_path
                doc["source"]["pdf_url"] = url
                doc["source"]["source_type"] = "pdf"

            log_success(f"  Stored PDF for {abbrev} (no parsing)")
            return doc

        # PRIMARY: Scrape from HTML source (official government website)
        html = self.fetch_url(url, law_abbr=abbrev)

        if html:
            # Detect source and use appropriate parser
            if 'jusline.at' in url:
                log_info(f"  Using Jusline parser for {abbrev}")
                doc = self._parse_jusline_law(html, abbrev, url)
            elif any(domain in url for domain in ['arbeitsinspektorat', 'sozialministerium', 'auva.at', 'wko.at', 'arbeiterkammer', 'oesterreich.gv.at', 'help.gv.at']):
                source_name = next((d for d in ['arbeitsinspektorat', 'sozialministerium', 'auva', 'wko', 'arbeiterkammer', 'oesterreich', 'help'] if d in url), 'Generic')
                log_info(f"  Using {source_name} parser for {abbrev}")
                doc = self._parse_generic_law(html, abbrev, url)
            else:
                # Default: RIS parser (ris.bka.gv.at)
                doc = self._parse_ris_law_full(html, abbrev, url)

            if doc:
                total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
                log_success(f"Scraped {abbrev}: {total_sections} sections with full text from HTML")

                # SUPPLEMENTARY: Try to download PDF for offline access (non-blocking)
                pdf_source = get_pdf_source_for_law("AT", abbrev)
                if pdf_source and HAS_PDF:
                    pdf_url = pdf_source.get("url", "")
                    if pdf_url:
                        if not pdf_url.startswith('http'):
                            pdf_url = self._get_full_url(pdf_url)
                        # Store PDF path in document for download link
                        pdf_info = download_and_store_pdf(pdf_url, "AT", abbrev, doc_type="law")
                        if pdf_info:
                            doc['pdf_path'] = pdf_info.get('local_path', '')
                            doc['source']['pdf_url'] = pdf_url
                            log_info(f"  Downloaded PDF for offline access: {pdf_info.get('filename', '')}")

                return doc

        # FALLBACK: If HTML parsing failed completely, download PDF without parsing
        pdf_source = get_pdf_source_for_law("AT", abbrev)
        if pdf_source:
            pdf_url = pdf_source.get("url", "")
            if pdf_url:
                if not pdf_url.startswith('http'):
                    pdf_url = self._get_full_url(pdf_url)
                log_warning(f"  HTML parsing failed for {abbrev}, downloading PDF fallback (no parsing)")

                # Download and store PDF only - no parsing
                pdf_info = download_and_store_pdf(pdf_url, "AT", abbrev, doc_type="law")
                if pdf_info:
                    pdf_path = pdf_info.get("local_path", "")
                    title = pdf_source.get('name', abbrev)
                    description = pdf_source.get('description', f'PDF document: {title}')

                    doc = create_unified_document(
                        country="AT",
                        abbrev=abbrev,
                        title=title,
                        doc_type=DocType.LAW,
                        source_url=pdf_url,
                        source_authority="PDF Source",
                        content_text=description,
                        full_text="",
                        pdf_path=pdf_path,
                        ai_summary="",
                        metadata={
                            "description": description,
                            "pdf_filename": pdf_info.get("filename", ""),
                            "pdf_size_bytes": pdf_info.get("size_bytes", 0),
                            "is_pdf_only": True,
                            "pdf_fallback": True
                        }
                    )

                    if pdf_path:
                        doc["source"]["local_pdf_path"] = pdf_path
                        doc["source"]["pdf_url"] = pdf_url
                        doc["source"]["source_type"] = "pdf"

                    log_success(f"  Stored PDF fallback for {abbrev} (no parsing)")
                    return doc

        return None

    def _parse_jusline_law(self, html: str, abbrev: str, url: str) -> Optional[Dict[str, Any]]:
        """Parse a law from Jusline.at - simpler HTML structure than RIS."""
        soup = BeautifulSoup(html, 'html.parser')

        # Remove script and style elements
        for elem in soup.find_all(['script', 'style', 'nav', 'header', 'footer']):
            elem.decompose()

        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else abbrev

        sections = []
        seen_sections = set()

        # Jusline uses article or div containers with § markers
        for elem in soup.find_all(['article', 'section', 'div']):
            text = elem.get_text(strip=True)
            match = re.search(r'§\s*(\d+[a-z]?)\.?', text)
            if match:
                section_num = match.group(1)
                if section_num in seen_sections:
                    continue
                seen_sections.add(section_num)

                # Extract text content
                full_text = elem.get_text(separator='\n', strip=True)
                # Clean expanded notation
                full_text = re.sub(r'Paragraph\s+(?:\d+[a-z]?|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*,?\s*', '', full_text)
                full_text = re.sub(r'\bAbsatz\s+(?:eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+[a-z]?)\s*,?\s*', '', full_text)
                full_text = re.sub(r'\n{3,}', '\n\n', full_text)
                full_text = remove_duplicate_phrases(full_text)

                if len(full_text) > 20:
                    sections.append({
                        "id": generate_id(f"{abbrev}-{section_num}"),
                        "number": section_num,
                        "title": f"§ {section_num}",
                        "text": full_text[:50000],
                        "whs_topics": self._classify_whs_topics(full_text, ""),
                        "amazon_logistics_relevance": self._calculate_logistics_relevance(full_text, ""),
                        "paragraphs": []
                    })

        sections.sort(key=lambda s: get_section_number(s))

        doc = {
            "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
            "version": "1.0.0",
            "type": "law",
            "jurisdiction": "AT",
            "abbreviation": abbrev,
            "title": title,
            "title_en": title,
            "category": "Core Safety",
            "source": {"url": url, "title": title, "authority": "Jusline.at", "robots_txt_compliant": True},
            "scraping": {"scraped_at": datetime.now().isoformat(), "scraper_version": CONFIG.scraper_version},
            "chapters": [{"id": f"at-{abbrev.lower()}-main", "number": "1", "title": "Hauptteil", "title_en": "Main Part", "sections": sections}]
        }
        doc["content_hash"] = generate_content_hash(doc)
        return doc

    def _parse_generic_law(self, html: str, abbrev: str, url: str) -> Optional[Dict[str, Any]]:
        """Parse a law from a generic source with simple HTML structure."""
        soup = BeautifulSoup(html, 'html.parser')

        # Remove non-content elements
        for elem in soup.find_all(['script', 'style', 'nav', 'header', 'footer']):
            elem.decompose()

        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else abbrev

        # Extract all text content and try to find section markers
        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile(r'content', re.I)) or soup.body
        if not main_content:
            return None

        full_text = main_content.get_text(separator='\n', strip=True)
        # Clean up
        full_text = re.sub(r'\n{3,}', '\n\n', full_text)
        full_text = remove_duplicate_phrases(full_text)

        doc = {
            "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
            "version": "1.0.0",
            "type": "law",
            "jurisdiction": "AT",
            "abbreviation": abbrev,
            "title": title,
            "title_en": title,
            "category": "Core Safety",
            "source": {"url": url, "title": title, "authority": "Generic", "robots_txt_compliant": True},
            "scraping": {"scraped_at": datetime.now().isoformat(), "scraper_version": CONFIG.scraper_version},
            "full_text": full_text[:100000],
            "chapters": []
        }
        doc["content_hash"] = generate_content_hash(doc)
        return doc

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
                            # Skip standalone navigation elements
                            if elem_text.strip().lower() in ['text', 'inhalt', 'abschnitt']:
                                current = current.find_next_sibling()
                                continue
                            # Remove "Text " prefix from start of content
                            elem_text = re.sub(r'^Text\s+', '', elem_text)
                            # Clean up redundant parenthetical references
                            elem_text = re.sub(r'\s*\([^)]*Paragraph[^)]*\)', '', elem_text)
                            content_parts.append(elem_text)

                    current = current.find_next_sibling()

                # Combine and clean text
                full_text = '\n\n'.join(content_parts)

                # Remove expanded notation patterns (RIS accessibility duplication)
                # Pattern: "Paragraph X," where X is a number OR German word number
                full_text = re.sub(r'Paragraph\s+(?:\d+[a-z]?|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*,?\s*', '', full_text)
                # Pattern: "Absatz eins/zwei/etc" or "Absatz 1/2/etc"
                full_text = re.sub(r'\bAbsatz\s+(?:eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+[a-z]?)\s*,?\s*', '', full_text)
                # Pattern: "Ziffer eins/zwei/etc" or "Ziffer 1/2/etc"
                full_text = re.sub(r'\bZiffer\s+(?:eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+)\s*,?\s*', '', full_text)
                # Pattern: "Litera a/b/c"
                full_text = re.sub(r'\bLitera\s+[a-z]\s*,?\s*', '', full_text)
                # Pattern: Expanded BGBl references
                full_text = re.sub(r'Bundesgesetzblatt\s+(?:Teil\s+(?:eins|zwei|drei|\w+),?\s*)?Nr\.\s+\d+\s+aus\s+\d+,?\s*', '', full_text)

                # Remove duplicate content (expanded version following abbreviated version)
                # Pattern: "BGBl. Nr. XXX;" followed by "Bundesgesetzblatt Nr. XXX;"
                full_text = re.sub(r'(BGBl\.\s*(?:I|II)?\s*Nr\.\s*\d+(?:/\d+)?\s*[,;]?)\s*[^;§]*?Bundesgesetzblatt\s+(?:Teil\s+\w+,?\s*)?Nr\.\s+\d+(?:\s+aus\s+\d+)?[,;]?', r'\1', full_text)
                # Also catch sentence-level duplicates where content repeats with expanded references
                # Pattern: sentence ending with "BGBl. Nr. XX" followed by same sentence with "Bundesgesetzblatt"
                full_text = re.sub(r'([^.;]+BGBl\.\s*(?:I|II)?\s*Nr\.\s*\d+(?:/\d+)?\s*[,;])\s*\1', r'\1', full_text, flags=re.IGNORECASE)

                # Add line breaks before paragraph numbers to create proper structure
                # (1) (2) (3) etc should be on their own lines
                full_text = re.sub(r'\s+\((\d+[a-z]?)\)\s+', r'\n\n(\1) ', full_text)

                # Final pass: remove duplicate phrases (handles BGBl vs Bundesgesetzblatt duplicates)
                full_text = remove_duplicate_phrases(full_text)

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
                                # Skip standalone navigation elements
                                if elem_text.strip().lower() in ['text', 'inhalt', 'abschnitt']:
                                    continue
                                # Remove "Text " prefix
                                elem_text = re.sub(r'^Text\s+', '', elem_text)
                                content_parts.append(elem_text)
                        elif sibling.name in ['ol', 'ul']:
                            for li in sibling.find_all('li'):
                                li_text = li.get_text(strip=True)
                                if li_text and len(li_text) > 10:
                                    content_parts.append(li_text)

                    full_text = '\n\n'.join(content_parts)

                    # Remove expanded notation patterns
                    full_text = re.sub(r'Paragraph\s+(?:\d+[a-z]?|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*,?\s*', '', full_text)
                    full_text = re.sub(r'\bAbsatz\s+(?:eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+[a-z]?)\s*,?\s*', '', full_text)
                    full_text = re.sub(r'\bZiffer\s+(?:eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+)\s*,?\s*', '', full_text)
                    full_text = re.sub(r'\bLitera\s+[a-z]\s*,?\s*', '', full_text)
                    full_text = re.sub(r'Bundesgesetzblatt\s+(?:Teil\s+(?:eins|zwei|drei|\w+),?\s*)?Nr\.\s+\d+\s+aus\s+\d+,?\s*', '', full_text)
                    # Add line breaks before paragraph numbers
                    full_text = re.sub(r'\s+\((\d+[a-z]?)\)\s+', r'\n\n(\1) ', full_text)
                    # Final pass: remove duplicate phrases
                    full_text = remove_duplicate_phrases(full_text)
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
        # Apply official section titles from the title mappings
        sections = apply_official_section_titles(sections, abbrev, "AT")

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
        """Scrape a single law - used for parallel processing.

        Priority: HTML sources from official government sites (gesetze-im-internet.de)
        PDF sources are downloaded and stored WITHOUT parsing - just for display.
        """
        # Set current law for AI URL correction on sub-page failures
        self._current_law_abbr = abbrev
        log_info(f"Scraping {abbrev} with full text extraction...")
        url = self._get_full_url(path)

        # Check if this is a direct PDF URL - download only, no parsing
        if url.lower().endswith('.pdf') or 'blob=publicationFile' in url:
            log_info(f"  PDF source for {abbrev} - downloading without parsing")
            custom = load_custom_sources()
            source_info = custom.get('custom_sources', {}).get('DE', {}).get(abbrev, {})
            title = source_info.get('name', abbrev)
            description = source_info.get('description', f'PDF document: {title}')

            # Download and store PDF only - no parsing
            pdf_info = download_and_store_pdf(url, "DE", abbrev, doc_type="law")
            if not pdf_info:
                log_warning(f"  Could not download PDF for {abbrev}")
                return None

            pdf_path = pdf_info.get("local_path", "")

            # Create document without parsed content
            doc = create_unified_document(
                country="DE",
                abbrev=abbrev,
                title=title,
                doc_type=DocType.LAW,
                source_url=url,
                source_authority="PDF Source",
                content_text=description,
                full_text="",  # No text extraction
                pdf_path=pdf_path,
                ai_summary="",
                metadata={
                    "description": description,
                    "pdf_filename": pdf_info.get("filename", ""),
                    "pdf_size_bytes": pdf_info.get("size_bytes", 0),
                    "is_pdf_only": True
                }
            )

            # Add local PDF path to source for UI access
            if pdf_path:
                doc["source"]["local_pdf_path"] = pdf_path
                doc["source"]["pdf_url"] = url
                doc["source"]["source_type"] = "pdf"

            log_success(f"  Stored PDF for {abbrev} (no parsing)")
            return doc

        # PRIMARY: Scrape from HTML source (official government website)
        html = self.fetch_url(url, law_abbr=abbrev)

        if html:
            # Detect source and use appropriate parser
            if 'dejure.org' in url:
                log_info(f"  Using Dejure parser for {abbrev}")
                doc = self._parse_dejure_law(html, abbrev, url)
            elif any(domain in url for domain in ['buzer.de', 'bmas.de', 'baua.de', 'dguv.de', 'gesetze-bayern.de']):
                source_name = next((d.split('.')[0] for d in ['buzer.de', 'bmas.de', 'baua.de', 'dguv.de', 'gesetze-bayern.de'] if d in url), 'Generic')
                log_info(f"  Using {source_name} parser for {abbrev}")
                doc = self._parse_generic_de_law(html, abbrev, url)
            else:
                # Default: gesetze-im-internet.de parser
                doc = self._parse_german_law_full(html, abbrev, url)

            if doc:
                total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
                log_success(f"Scraped {abbrev}: {total_sections} sections with full text from HTML")

                # SUPPLEMENTARY: Try to download PDF for offline access (non-blocking)
                pdf_source = get_pdf_source_for_law("DE", abbrev)
                if pdf_source and HAS_PDF:
                    pdf_url = pdf_source.get("url", "")
                    if pdf_url:
                        if not pdf_url.startswith('http'):
                            pdf_url = self._get_full_url(pdf_url)
                        pdf_info = download_and_store_pdf(pdf_url, "DE", abbrev, doc_type="law")
                        if pdf_info:
                            doc['pdf_path'] = pdf_info.get('local_path', '')
                            doc['source']['pdf_url'] = pdf_url
                            log_info(f"  Downloaded PDF for offline access: {pdf_info.get('filename', '')}")

                return doc

        # FALLBACK: If HTML parsing failed completely, download PDF without parsing
        pdf_source = get_pdf_source_for_law("DE", abbrev)
        if pdf_source:
            pdf_url = pdf_source.get("url", "")
            if pdf_url:
                if not pdf_url.startswith('http'):
                    pdf_url = self._get_full_url(pdf_url)
                log_warning(f"  HTML parsing failed for {abbrev}, downloading PDF fallback (no parsing)")

                # Download and store PDF only - no parsing
                pdf_info = download_and_store_pdf(pdf_url, "DE", abbrev, doc_type="law")
                if pdf_info:
                    pdf_path = pdf_info.get("local_path", "")
                    title = pdf_source.get('name', abbrev)
                    description = pdf_source.get('description', f'PDF document: {title}')

                    doc = create_unified_document(
                        country="DE",
                        abbrev=abbrev,
                        title=title,
                        doc_type=DocType.LAW,
                        source_url=pdf_url,
                        source_authority="PDF Source",
                        content_text=description,
                        full_text="",
                        pdf_path=pdf_path,
                        ai_summary="",
                        metadata={
                            "description": description,
                            "pdf_filename": pdf_info.get("filename", ""),
                            "pdf_size_bytes": pdf_info.get("size_bytes", 0),
                            "is_pdf_only": True,
                            "pdf_fallback": True
                        }
                    )

                    if pdf_path:
                        doc["source"]["local_pdf_path"] = pdf_path
                        doc["source"]["pdf_url"] = pdf_url
                        doc["source"]["source_type"] = "pdf"

                    log_success(f"  Stored PDF fallback for {abbrev} (no parsing)")
                    return doc

        return None

    def _parse_dejure_law(self, html: str, abbrev: str, url: str) -> Optional[Dict[str, Any]]:
        """Parse a law from dejure.org - alternative German law source."""
        soup = BeautifulSoup(html, 'html.parser')

        for elem in soup.find_all(['script', 'style', 'nav', 'header', 'footer']):
            elem.decompose()

        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else abbrev

        sections = []
        seen_sections = set()

        # Dejure uses div.norm containers
        for container in soup.find_all(['div', 'section', 'article']):
            text = container.get_text(strip=True)[:200]
            match = re.search(r'§\s*(\d+[a-z]?)\.?', text)
            if match:
                section_num = match.group(1)
                if section_num in seen_sections:
                    continue
                seen_sections.add(section_num)

                full_text = container.get_text(separator='\n', strip=True)
                full_text = re.sub(r'\n{3,}', '\n\n', full_text)

                if len(full_text) > 20:
                    sections.append({
                        "id": generate_id(f"{abbrev}-{section_num}"),
                        "number": section_num,
                        "title": f"§ {section_num}",
                        "text": full_text[:50000],
                        "whs_topics": self._classify_whs_topics(full_text, ""),
                        "amazon_logistics_relevance": self._calculate_logistics_relevance(full_text, ""),
                        "paragraphs": []
                    })

        sections.sort(key=lambda s: get_section_number(s))

        doc = {
            "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
            "version": "1.0.0",
            "type": "law",
            "jurisdiction": "DE",
            "abbreviation": abbrev,
            "title": title,
            "title_en": title,
            "category": "Core Safety",
            "source": {"url": url, "title": title, "authority": "dejure.org", "robots_txt_compliant": True},
            "scraping": {"scraped_at": datetime.now().isoformat(), "scraper_version": CONFIG.scraper_version},
            "chapters": [{"id": f"de-{abbrev.lower()}-main", "number": "1", "title": "Hauptteil", "title_en": "Main Part", "sections": sections}]
        }
        doc["content_hash"] = generate_content_hash(doc)
        return doc

    def _parse_generic_de_law(self, html: str, abbrev: str, url: str) -> Optional[Dict[str, Any]]:
        """Parse a law from a generic German source."""
        soup = BeautifulSoup(html, 'html.parser')

        for elem in soup.find_all(['script', 'style', 'nav', 'header', 'footer']):
            elem.decompose()

        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else abbrev

        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile(r'content', re.I)) or soup.body
        if not main_content:
            return None

        full_text = main_content.get_text(separator='\n', strip=True)
        full_text = re.sub(r'\n{3,}', '\n\n', full_text)

        doc = {
            "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
            "version": "1.0.0",
            "type": "law",
            "jurisdiction": "DE",
            "abbreviation": abbrev,
            "title": title,
            "title_en": title,
            "category": "Core Safety",
            "source": {"url": url, "title": title, "authority": "Generic", "robots_txt_compliant": True},
            "scraping": {"scraped_at": datetime.now().isoformat(), "scraper_version": CONFIG.scraper_version},
            "full_text": full_text[:100000],
            "chapters": []
        }
        doc["content_hash"] = generate_content_hash(doc)
        return doc

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

    def _try_full_html_page(self, base_url: str, abbrev: str, main_page_html: str = None) -> Dict[str, str]:
        """Try to fetch full law content from HTML full version page."""
        section_contents = {}

        # Dynamically extract the correct BJNR from the main page HTML
        bjnr_id = None
        if main_page_html:
            # Look for BJNR pattern in links on the main page
            bjnr_match = re.search(r'(BJNR\d+)\.html', main_page_html)
            if bjnr_match:
                bjnr_id = bjnr_match.group(1)

        if not bjnr_id:
            # If we can't find the BJNR, skip full page extraction
            # Individual section pages will be used instead
            return section_contents

        # Try the BJNR full page with dynamically extracted ID
        full_urls = [
            urljoin(base_url, f'{bjnr_id}.html'),
            urljoin(base_url, f'index.html#{bjnr_id}'),
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
        full_page_contents = self._try_full_html_page(url, abbrev, html)

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
        """Scrape a single law - used for parallel processing.

        Priority: HTML sources from official government sites (wetten.overheid.nl)
        PDF sources are downloaded and stored WITHOUT parsing - just for display.
        """
        # Set current law for AI URL correction on sub-page failures
        self._current_law_abbr = abbrev
        log_info(f"Scraping {abbrev} with full text extraction...")
        url = self._get_full_url(path)

        # Check if this is a direct PDF URL - download only, no parsing
        if url.lower().endswith('.pdf') or 'blob=publicationFile' in url or '/pdf' in url:
            log_info(f"  PDF source for {abbrev} - downloading without parsing")
            custom = load_custom_sources()
            source_info = custom.get('custom_sources', {}).get('NL', {}).get(abbrev, {})
            title = source_info.get('name', abbrev)
            description = source_info.get('description', f'PDF document: {title}')

            # Download and store PDF only - no parsing
            pdf_info = download_and_store_pdf(url, "NL", abbrev, doc_type="law")
            if not pdf_info:
                log_warning(f"  Could not download PDF for {abbrev}")
                return None

            pdf_path = pdf_info.get("local_path", "")

            # Create document without parsed content
            doc = create_unified_document(
                country="NL",
                abbrev=abbrev,
                title=title,
                doc_type=DocType.LAW,
                source_url=url,
                source_authority="PDF Source",
                content_text=description,
                full_text="",  # No text extraction
                pdf_path=pdf_path,
                ai_summary="",
                metadata={
                    "description": description,
                    "pdf_filename": pdf_info.get("filename", ""),
                    "pdf_size_bytes": pdf_info.get("size_bytes", 0),
                    "is_pdf_only": True
                }
            )

            # Add local PDF path to source for UI access
            if pdf_path:
                doc["source"]["local_pdf_path"] = pdf_path
                doc["source"]["pdf_url"] = url
                doc["source"]["source_type"] = "pdf"

            log_success(f"  Stored PDF for {abbrev} (no parsing)")
            return doc

        # PRIMARY: Scrape from HTML source (official government website)
        html = self.fetch_url(url, law_abbr=abbrev)

        if html:
            # Detect source and use appropriate parser
            alt_nl_sources = ['arboportaal.nl', 'rijksoverheid.nl', 'inspectie.szw.nl', 'nen.nl', 'fnv.nl']
            matched_source = next((s for s in alt_nl_sources if s in url), None)
            if matched_source:
                log_info(f"  Using {matched_source} parser for {abbrev}")
                doc = self._parse_generic_nl_law(html, abbrev, url, matched_source)
            else:
                # Default: wetten.overheid.nl parser
                doc = self._parse_dutch_law_full(html, abbrev, url)

            if doc:
                total_sections = sum(len(ch.get('sections', [])) for ch in doc.get('chapters', []))
                log_success(f"Scraped {abbrev}: {total_sections} articles with full text from HTML")

                # SUPPLEMENTARY: Try to download PDF for offline access (non-blocking)
                pdf_source = get_pdf_source_for_law("NL", abbrev)
                if pdf_source and HAS_PDF:
                    pdf_url = pdf_source.get("url", "")
                    if pdf_url:
                        if not pdf_url.startswith('http'):
                            pdf_url = self._get_full_url(pdf_url)
                        pdf_info = download_and_store_pdf(pdf_url, "NL", abbrev, doc_type="law")
                        if pdf_info:
                            doc['pdf_path'] = pdf_info.get('local_path', '')
                            doc['source']['pdf_url'] = pdf_url
                            log_info(f"  Downloaded PDF for offline access: {pdf_info.get('filename', '')}")

                return doc

        # FALLBACK: If HTML parsing failed completely, download PDF without parsing
        pdf_source = get_pdf_source_for_law("NL", abbrev)
        if pdf_source:
            pdf_url = pdf_source.get("url", "")
            if pdf_url:
                if not pdf_url.startswith('http'):
                    pdf_url = self._get_full_url(pdf_url)
                log_warning(f"  HTML parsing failed for {abbrev}, downloading PDF fallback (no parsing)")

                # Download and store PDF only - no parsing
                pdf_info = download_and_store_pdf(pdf_url, "NL", abbrev, doc_type="law")
                if pdf_info:
                    pdf_path = pdf_info.get("local_path", "")
                    title = pdf_source.get('name', abbrev)
                    description = pdf_source.get('description', f'PDF document: {title}')

                    doc = create_unified_document(
                        country="NL",
                        abbrev=abbrev,
                        title=title,
                        doc_type=DocType.LAW,
                        source_url=pdf_url,
                        source_authority="PDF Source",
                        content_text=description,
                        full_text="",
                        pdf_path=pdf_path,
                        ai_summary="",
                        metadata={
                            "description": description,
                            "pdf_filename": pdf_info.get("filename", ""),
                            "pdf_size_bytes": pdf_info.get("size_bytes", 0),
                            "is_pdf_only": True,
                            "pdf_fallback": True
                        }
                    )

                    if pdf_path:
                        doc["source"]["local_pdf_path"] = pdf_path
                        doc["source"]["pdf_url"] = pdf_url
                        doc["source"]["source_type"] = "pdf"

                    log_success(f"  Stored PDF fallback for {abbrev} (no parsing)")
                    return doc

        return None

    def _parse_generic_nl_law(self, html: str, abbrev: str, url: str, authority: str) -> Optional[Dict[str, Any]]:
        """Parse a law from a generic Dutch source."""
        soup = BeautifulSoup(html, 'html.parser')

        for elem in soup.find_all(['script', 'style', 'nav', 'header', 'footer']):
            elem.decompose()

        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else abbrev

        sections = []
        seen_sections = set()

        # Try to find article containers
        for container in soup.find_all(['article', 'section', 'div']):
            text = container.get_text(strip=True)[:200]
            match = re.search(r'Artikel\s*(\d+[a-z]?)\.?', text, re.IGNORECASE)
            if match:
                section_num = match.group(1)
                if section_num in seen_sections:
                    continue
                seen_sections.add(section_num)

                full_text = container.get_text(separator='\n', strip=True)
                full_text = re.sub(r'\n{3,}', '\n\n', full_text)

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

        sections.sort(key=lambda s: get_section_number(s))

        # If no sections found, store as full text
        if not sections:
            main_content = soup.find('main') or soup.find('article') or soup.body
            if main_content:
                full_text = main_content.get_text(separator='\n', strip=True)
                full_text = re.sub(r'\n{3,}', '\n\n', full_text)
            else:
                return None

            doc = {
                "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
                "version": "1.0.0",
                "type": "law",
                "jurisdiction": "NL",
                "abbreviation": abbrev,
                "title": title,
                "title_en": title,
                "category": "Core Safety",
                "source": {"url": url, "title": title, "authority": authority, "robots_txt_compliant": True},
                "scraping": {"scraped_at": datetime.now().isoformat(), "scraper_version": CONFIG.scraper_version},
                "full_text": full_text[:100000],
                "chapters": []
            }
        else:
            doc = {
                "id": generate_id(f"{abbrev}-{datetime.now().isoformat()}"),
                "version": "1.0.0",
                "type": "law",
                "jurisdiction": "NL",
                "abbreviation": abbrev,
                "title": title,
                "title_en": title,
                "category": "Core Safety",
                "source": {"url": url, "title": title, "authority": authority, "robots_txt_compliant": True},
                "scraping": {"scraped_at": datetime.now().isoformat(), "scraper_version": CONFIG.scraper_version},
                "chapters": [{"id": f"nl-{abbrev.lower()}-main", "number": "1", "title": "Hoofdinhoud", "title_en": "Main Content", "sections": sections}]
            }

        doc["content_hash"] = generate_content_hash(doc)
        return doc

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

            # NOTE: Removed li extraction - <li> contains <p>, so extracting from both causes duplication
            # The <p> extraction above already gets all the content

            # Deduplicate while preserving order - use normalized text comparison
            # to catch near-duplicates (different whitespace, etc.)
            seen_normalized = set()
            unique_parts = []
            for part in content_parts:
                # Normalize: lowercase, collapse whitespace, strip punctuation variations
                normalized = re.sub(r'\s+', ' ', part.strip().lower())
                normalized = re.sub(r'[;,.]$', '', normalized)  # Remove trailing punctuation

                # Check if we've seen similar content (first 100 chars for efficiency)
                check_key = normalized[:100]
                if check_key not in seen_normalized:
                    seen_normalized.add(check_key)
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

            # If no title extracted from h4, try to extract from first line of content
            # Dutch laws often have format: "Artikel N. Title:" or "Title:" at start
            if not article_title and full_text:
                first_line = full_text.split('\n')[0] if full_text else ''
                # Try pattern: "Artikel N. Title:"
                title_from_content = re.match(r'^Artikel\s+\d+[a-z]?\.\s*([^:]+):', first_line, re.IGNORECASE)
                if title_from_content:
                    article_title = title_from_content.group(1).strip()
                else:
                    # Try pattern: Just the first sentence if it looks like a title (short, ends with :)
                    title_from_content = re.match(r'^([A-Z][^.:]{5,60})[.:]', first_line)
                    if title_from_content:
                        potential_title = title_from_content.group(1).strip()
                        # Only use if it looks like a title (not too long, capitalized)
                        if len(potential_title) < 80 and not potential_title[0].isdigit():
                            article_title = potential_title

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
        # Apply official section titles from the title mappings
        sections = apply_official_section_titles(sections, abbrev, "NL")

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


# =============================================================================
# Merkblätter Scrapers (AUVA, DGUV, Arboportaal)
# =============================================================================

class MerkblattScraper(Scraper):
    """
    Base scraper for Merkblätter / supplementary safety publications.
    These are PDF-based guidance documents from safety organizations.
    """

    def __init__(self, country: str, law_limit: int = None):
        super().__init__(country, law_limit)
        self.merkblaetter_config = CONFIG.merkblaetter_sources.get(country, {})

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape Merkblätter for this country. Override in subclass."""
        raise NotImplementedError

    def _create_merkblatt_document(
        self,
        abbrev: str,
        title: str,
        source_url: str,
        series: str = "",
        description: str = "",
        authority: str = "",
        source_type: str = "auto"
    ) -> Optional[Dict[str, Any]]:
        """
        Create a Merkblatt document from PDF or HTML source.
        Downloads content only - no parsing or AI summarization.
        The content is stored locally for direct viewing.

        Args:
            source_type: 'pdf', 'html', or 'auto' (detect from URL)
        """
        # Auto-detect source type from URL
        if source_type == "auto":
            if source_url.lower().endswith('.pdf') or 'blob=publicationFile' in source_url:
                source_type = "pdf"
            else:
                source_type = "html"

        if source_type == "pdf":
            # Download and store PDF locally (no parsing/scraping)
            file_info = download_and_store_pdf(source_url, self.country, abbrev, doc_type="merkblatt")
            if not file_info:
                log_warning(f"Could not download PDF for {abbrev}")
                return None
            local_path = file_info.get("local_path", "")
            is_pdf_only = True
            is_html_only = False
        else:
            # Download and store HTML locally (no parsing/scraping)
            file_info = download_and_store_html(source_url, self.country, abbrev, doc_type="merkblatt")
            if not file_info:
                log_warning(f"Could not download HTML for {abbrev}")
                return None
            local_path = file_info.get("local_path", "")
            is_pdf_only = False
            is_html_only = True

        # Create unified document with minimal metadata (file is the content)
        doc = create_unified_document(
            country=self.country,
            abbrev=abbrev,
            title=title,
            doc_type=DocType.MERKBLATT,
            source_url=source_url,
            source_authority=authority or self.authority,
            content_text=description or f"{source_type.upper()} document: {title}",
            full_text="",  # No text extraction
            pdf_path=local_path if source_type == "pdf" else "",
            ai_summary="",  # No AI summary
            metadata={
                "series": series,
                "description": description,
                "filename": file_info.get("filename", ""),
                "size_bytes": file_info.get("size_bytes", 0),
                "is_supplementary": True,
                "is_pdf_only": is_pdf_only,
                "is_html_only": is_html_only
            }
        )

        # Add local path to source for UI access
        if local_path:
            if source_type == "pdf":
                doc["source"]["local_pdf_path"] = local_path
                doc["source"]["pdf_url"] = source_url
            else:
                doc["source"]["local_html_path"] = local_path
                doc["source"]["html_url"] = source_url
            doc["source"]["source_type"] = source_type

        # Basic WHS topic classification from title only
        doc["whs_topics"] = self._classify_whs_topics_from_title(title)

        log_success(f"Created merkblatt document: {abbrev} ({source_type.upper()} stored at {local_path})")
        return doc

    def _classify_whs_topics_from_title(self, title: str) -> List[Dict[str, Any]]:
        """Basic WHS topic classification from title only (no PDF content parsing)."""
        topics = []
        title_lower = title.lower()

        topic_keywords = {
            "hazardous_substances": ["gefahrstoff", "gefährlich", "chemisch", "lagerung", "stoffe"],
            "work_equipment": ["arbeitsmittel", "maschine", "gerät", "werkzeug", "ausrüstung"],
            "workplace_design": ["arbeitsstätte", "arbeitsplatz", "beleuchtung", "raumklima"],
            "ppe": ["schutzausrüstung", "psa", "schutz", "persönlich"],
            "ergonomics": ["ergonomie", "heben", "tragen", "belastung", "bildschirm"],
            "training": ["unterweisung", "schulung", "ausbildung"],
            "first_aid": ["erste hilfe", "notfall", "ersthelfer"],
            "fire_safety": ["brand", "feuer", "lösch", "flucht"],
        }

        for topic_id, keywords in topic_keywords.items():
            matches = sum(1 for kw in keywords if kw in title_lower)
            if matches > 0:
                topics.append({
                    "id": topic_id,
                    "relevance": "high" if matches >= 2 else "medium",
                    "match_count": matches
                })

        topics.sort(key=lambda x: -x["match_count"])
        return topics[:3]

    def _classify_whs_topics(self, text: str, title: str) -> List[Dict[str, Any]]:
        """Generic WHS topic classification for Merkblätter."""
        # Use the base WHS topics - subclasses can override
        topics = []
        combined_text = f"{title} {text}".lower()

        generic_whs_topics = {
            "risk_assessment": {"keywords": ["risiko", "gefahr", "beurteilung", "evaluierung"], "relevance": "high"},
            "ppe": {"keywords": ["schutzausrüstung", "schutz", "psa", "helm", "handschuh"], "relevance": "high"},
            "training": {"keywords": ["unterweisung", "schulung", "ausbildung", "training"], "relevance": "high"},
            "first_aid": {"keywords": ["erste hilfe", "notfall", "ersthelfer", "verletzung"], "relevance": "high"},
            "ergonomics": {"keywords": ["ergonomie", "heben", "tragen", "rücken", "belastung"], "relevance": "high"},
            "hazardous_substances": {"keywords": ["gefahrstoff", "chemisch", "gefährlich", "stoff"], "relevance": "medium"},
            "work_equipment": {"keywords": ["arbeitsmittel", "maschine", "gerät", "werkzeug"], "relevance": "high"},
        }

        for topic_id, topic_data in generic_whs_topics.items():
            matches = sum(1 for kw in topic_data["keywords"] if kw in combined_text)
            if matches > 0:
                topics.append({
                    "id": topic_id,
                    "relevance": topic_data["relevance"],
                    "match_count": matches
                })

        topics.sort(key=lambda x: (-x["match_count"], x["relevance"] != "high"))
        return topics[:5]


class AUVAScraper(MerkblattScraper):
    """
    Scraper for Austrian AUVA (Allgemeine Unfallversicherungsanstalt) Merkblätter.
    Downloads M-Reihe and M.plus PDFs from AUVA downloads catalog or static publication list.

    Source: https://auva.at/downloads/downloads-search/?publicationsWithDownloadOnly=true&category=publications
    """

    def __init__(self, law_limit: int = None):
        super().__init__('AT', law_limit)
        self.auva_config = self.merkblaetter_config.get("auva", {})

    def _scrape_catalog(self) -> List[Dict[str, Any]]:
        """Scrape AUVA publications from the downloads catalog page."""
        if not HAS_BS4:
            log_warning("BeautifulSoup required for catalog scraping. Using static list instead.")
            return []

        catalog_url = self.auva_config.get("catalog_url", "")
        if not catalog_url:
            return []

        log_info("Fetching AUVA downloads catalog...")

        # Fetch catalog page
        html = self.fetch_url(catalog_url)
        if not html:
            log_warning("Failed to fetch AUVA catalog, falling back to static list")
            return []

        # Parse catalog to find PDF links
        soup = BeautifulSoup(html, 'html.parser')
        publications = []

        # AUVA downloads page structure:
        # Look for download links and publication cards
        # The page uses JavaScript to load content, so we may need to look for data attributes or API endpoints

        # Try to find publication entries - AUVA uses various patterns
        # Look for links to PDFs
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')

            # Filter for PDF downloads from AUVA media
            if '/media/' in href and href.endswith('.pdf'):
                # Extract title from link text or parent element
                title = link.get_text(strip=True)
                if not title:
                    # Try to get title from parent or sibling elements
                    parent = link.find_parent(['div', 'li', 'article'])
                    if parent:
                        title_elem = parent.find(['h2', 'h3', 'h4', 'span', 'strong'])
                        if title_elem:
                            title = title_elem.get_text(strip=True)

                if not title:
                    # Extract from URL
                    title = href.split('/')[-1].replace('.pdf', '').replace('_', ' ').replace('-', ' ')

                # Determine series from title or URL
                series = "M.plus" if "mplus" in href.lower() or "m.plus" in title.lower() else "M"

                # Create abbreviation
                abbrev = self._extract_abbrev(title, href)

                # Make URL absolute
                if href.startswith('/'):
                    href = urljoin(self.auva_config.get("base_url", "https://auva.at"), href)

                publications.append({
                    "abbrev": abbrev,
                    "title": title,
                    "url": href,
                    "series": series,
                    "description": f"AUVA publication: {title[:100]}"
                })

        # Also look for structured publication data (JSON-LD or data attributes)
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    for item in data:
                        if item.get('@type') in ['Document', 'DigitalDocument', 'PublicationEvent']:
                            url = item.get('url', item.get('contentUrl', ''))
                            if url and url.endswith('.pdf'):
                                publications.append({
                                    "abbrev": self._extract_abbrev(item.get('name', ''), url),
                                    "title": item.get('name', ''),
                                    "url": url,
                                    "series": "M.plus",
                                    "description": item.get('description', '')
                                })
            except (json.JSONDecodeError, TypeError):
                pass

        log_info(f"Found {len(publications)} publications from AUVA catalog")
        return publications

    def _extract_abbrev(self, title: str, url: str) -> str:
        """Extract AUVA abbreviation from title or URL."""
        # Look for M.plus or M-Reihe patterns
        import re

        # Pattern for M.plus: "M.plus 330", "mplus_330", etc.
        mplus_match = re.search(r'[Mm]\.?plus[\s_]*(\d+)', title) or re.search(r'[Mm]\.?plus[\s_]*(\d+)', url)
        if mplus_match:
            return f"AUVA M.plus {mplus_match.group(1)}"

        # Pattern for M-Reihe: "M 030", "M030", etc.
        m_match = re.search(r'\bM[\s_]?(\d+)', title) or re.search(r'\bM[\s_]?(\d+)', url)
        if m_match:
            return f"AUVA M {m_match.group(1)}"

        # Fallback: use cleaned title
        clean_title = re.sub(r'[^\w\s]', '', title)[:30]
        return f"AUVA {clean_title}".strip()

    def scrape(self) -> List[Dict[str, Any]]:
        """Download AUVA Merkblätter PDFs from catalog or static publication list."""
        documents = []

        # Try to scrape from catalog first
        catalog_publications = self._scrape_catalog()

        # Get static publications as fallback/supplement
        static_publications = self.auva_config.get("publications", [])

        # Merge: catalog publications take precedence, then add static ones that aren't duplicates
        all_publications = []
        seen_urls = set()

        for pub in catalog_publications:
            url = pub.get("url", "")
            if url and url not in seen_urls:
                all_publications.append(pub)
                seen_urls.add(url)

        for pub in static_publications:
            url = pub.get("url", "")
            if url and url not in seen_urls:
                all_publications.append(pub)
                seen_urls.add(url)

        if not all_publications:
            log_warning("No AUVA publications found (neither from catalog nor static list)")
            return documents

        source_info = "catalog" if catalog_publications else "static list"
        log_info(f"Processing {len(all_publications)} AUVA Merkblätter from {source_info}...")

        # Apply limit
        if self.law_limit:
            all_publications = all_publications[:self.law_limit]

        # Process each publication
        for pub in all_publications:
            abbrev = pub.get("abbrev", "")
            title = pub.get("title", "")
            source_url = pub.get("url", "")
            series = pub.get("series", "M.plus")
            description = pub.get("description", "")
            source_type = pub.get("source_type", "auto")  # Allow specifying pdf or html

            if not source_url:
                log_warning(f"No URL for {abbrev}")
                continue

            log_info(f"Downloading {abbrev}: {title[:50]}...")
            doc = self._create_merkblatt_document(
                abbrev=abbrev,
                title=title,
                source_url=source_url,
                series=series,
                description=description,
                authority="AUVA",
                source_type=source_type
            )

            if doc:
                # Add English title if available
                if pub.get("title_en"):
                    doc["title_en"] = pub["title_en"]
                documents.append(doc)

            time.sleep(CONFIG.rate_limit_delay)

        log_success(f"Downloaded {len(documents)} AUVA Merkblätter")
        return documents


class DGUVScraper(MerkblattScraper):
    """
    Scraper for German DGUV (Deutsche Gesetzliche Unfallversicherung) publications.
    Downloads DGUV Vorschriften, Regeln, and Informationen PDFs.
    """

    def __init__(self, law_limit: int = None):
        super().__init__('DE', law_limit)
        self.dguv_config = self.merkblaetter_config.get("dguv", {})

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape DGUV publications from the DGUV Publikationen database."""
        if not HAS_BS4:
            log_error("BeautifulSoup required for scraping. Install with: pip install beautifulsoup4")
            return []

        documents = []
        catalog_url = self.dguv_config.get("catalog_url", "")

        if not catalog_url:
            log_warning("No DGUV catalog URL configured")
            return documents

        log_info("Fetching DGUV publications catalog...")

        # Fetch catalog page
        html = self.fetch_url(catalog_url)
        if not html:
            log_error("Failed to fetch DGUV catalog")
            return documents

        # Parse catalog to find PDF links
        soup = BeautifulSoup(html, 'html.parser')
        pdf_links = []

        # DGUV publications typically have patterns like "DGUV Vorschrift 1", "DGUV Regel 100-001"
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            text = link.get_text(strip=True)

            # Match DGUV publication patterns
            if re.search(r'DGUV\s+(Vorschrift|Regel|Information)\s+[\d\-]+', text, re.IGNORECASE):
                # Determine series
                if 'vorschrift' in text.lower():
                    series = "DGUV Vorschriften"
                elif 'regel' in text.lower():
                    series = "DGUV Regeln"
                else:
                    series = "DGUV Informationen"

                # Extract publication number
                num_match = re.search(r'([\d\-]+)', text)
                pub_num = num_match.group(1) if num_match else str(len(pdf_links)+1)
                abbrev = f"DGUV-{pub_num}"

                pdf_url = href if href.startswith('http') else urljoin(self.dguv_config.get("base_url", ""), href)

                # Skip duplicates
                if not any(p['abbrev'] == abbrev for p in pdf_links):
                    pdf_links.append({
                        "abbrev": abbrev,
                        "title": text,
                        "url": pdf_url,
                        "series": series
                    })

        # Apply limit
        if self.law_limit:
            pdf_links = pdf_links[:self.law_limit]

        log_info(f"Found {len(pdf_links)} DGUV publications to process")

        # Process each PDF
        for link_info in pdf_links:
            log_info(f"Processing {link_info['abbrev']}: {link_info['title'][:50]}...")

            # Check if URL is directly a PDF
            if '.pdf' in link_info['url'].lower():
                doc = self._create_merkblatt_document(
                    abbrev=link_info['abbrev'],
                    title=link_info['title'],
                    source_url=link_info['url'],
                    series=link_info['series'],
                    authority="DGUV",
                    source_type="pdf"
                )
                if doc:
                    documents.append(doc)
            else:
                # May need to follow link to get actual PDF URL
                log_info(f"  Fetching detail page for {link_info['abbrev']}...")
                detail_html = self.fetch_url(link_info['url'])
                if detail_html:
                    detail_soup = BeautifulSoup(detail_html, 'html.parser')
                    # Look for PDF download link
                    pdf_link = detail_soup.find('a', href=re.compile(r'\.pdf', re.IGNORECASE))
                    if pdf_link:
                        pdf_url = pdf_link.get('href', '')
                        if not pdf_url.startswith('http'):
                            pdf_url = urljoin(link_info['url'], pdf_url)
                        doc = self._create_merkblatt_document(
                            abbrev=link_info['abbrev'],
                            title=link_info['title'],
                            source_url=pdf_url,
                            series=link_info['series'],
                            authority="DGUV",
                            source_type="pdf"
                        )
                        if doc:
                            documents.append(doc)
                    else:
                        # No PDF found - use HTML fallback
                        # Store the HTML page content directly for modal display
                        log_info(f"  No PDF found for {link_info['abbrev']}, using HTML fallback...")
                        doc = self._create_merkblatt_document(
                            abbrev=link_info['abbrev'],
                            title=link_info['title'],
                            source_url=link_info['url'],
                            series=link_info['series'],
                            authority="DGUV",
                            source_type="html"
                        )
                        if doc:
                            documents.append(doc)

            time.sleep(CONFIG.rate_limit_delay)

        log_success(f"Scraped {len(documents)} DGUV publications")
        return documents


class ArboportaalScraper(MerkblattScraper):
    """
    Scraper for Dutch Arboportaal / Arbocatalogi documents.
    Scrapes sector-specific working conditions catalogues.
    """

    def __init__(self, law_limit: int = None):
        super().__init__('NL', law_limit)
        self.arboportaal_config = self.merkblaetter_config.get("arboportaal", {})

    def scrape(self) -> List[Dict[str, Any]]:
        """Scrape Arbocatalogi from the Arboportaal website."""
        if not HAS_BS4:
            log_error("BeautifulSoup required for scraping. Install with: pip install beautifulsoup4")
            return []

        documents = []
        catalog_url = self.arboportaal_config.get("catalog_url", "")

        if not catalog_url:
            log_warning("No Arboportaal catalog URL configured")
            return documents

        log_info("Fetching Arboportaal Arbocatalogi catalog...")

        # Fetch catalog page
        html = self.fetch_url(catalog_url)
        if not html:
            log_error("Failed to fetch Arboportaal catalog")
            return documents

        # Parse catalog to find arbocatalogi links
        soup = BeautifulSoup(html, 'html.parser')
        catalogi_links = []

        # Find links to sector catalogues
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            text = link.get_text(strip=True)

            if 'arbocatalo' in href.lower() or 'arbocatalo' in text.lower():
                # Extract sector name
                sector_match = re.search(r'/([^/]+)/?$', href)
                sector = sector_match.group(1) if sector_match else text[:30]
                abbrev = f"ARBO-{sector.upper().replace(' ', '-')[:20]}"

                full_url = href if href.startswith('http') else urljoin(self.arboportaal_config.get("base_url", ""), href)

                # Skip duplicates
                if not any(c['abbrev'] == abbrev for c in catalogi_links):
                    catalogi_links.append({
                        "abbrev": abbrev,
                        "title": text or f"Arbocatalogus {sector}",
                        "url": full_url,
                        "sector": sector
                    })

        # Apply limit
        if self.law_limit:
            catalogi_links = catalogi_links[:self.law_limit]

        log_info(f"Found {len(catalogi_links)} Arbocatalogi to process")

        # Process each catalogue (may be HTML-based, not PDF)
        for link_info in catalogi_links:
            log_info(f"Processing {link_info['abbrev']}: {link_info['title'][:50]}...")

            # Fetch the catalogue page
            catalogue_html = self.fetch_url(link_info['url'])
            if catalogue_html:
                catalogue_soup = BeautifulSoup(catalogue_html, 'html.parser')

                # Check for PDF download
                pdf_link = catalogue_soup.find('a', href=re.compile(r'\.pdf', re.IGNORECASE))
                if pdf_link:
                    pdf_url = pdf_link.get('href', '')
                    if not pdf_url.startswith('http'):
                        pdf_url = urljoin(link_info['url'], pdf_url)

                    doc = self._create_merkblatt_document(
                        abbrev=link_info['abbrev'],
                        title=link_info['title'],
                        source_url=pdf_url,
                        series="Arbocatalogi",
                        description=f"Sector: {link_info['sector']}",
                        authority="Arboportaal",
                        source_type="pdf"
                    )
                    if doc:
                        documents.append(doc)
                else:
                    # HTML-based catalogue - store HTML directly for modal display
                    log_info(f"  No PDF found for {link_info['abbrev']}, using HTML fallback...")
                    doc = self._create_merkblatt_document(
                        abbrev=link_info['abbrev'],
                        title=link_info['title'],
                        source_url=link_info['url'],
                        series="Arbocatalogi",
                        description=f"Sector: {link_info['sector']}",
                        authority="Arboportaal",
                        source_type="html"
                    )
                    if doc:
                        documents.append(doc)

            time.sleep(CONFIG.rate_limit_delay)

        log_success(f"Scraped {len(documents)} Arbocatalogi")
        return documents


# Main law scrapers
SCRAPERS = {
    'AT': ATScraper,
    'DE': DEScraper,
    'NL': NLScraper,
}

# Merkblätter scrapers
MERKBLATT_SCRAPERS = {
    'AT': AUVAScraper,
    'DE': DGUVScraper,
    'NL': ArboportaalScraper,
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
            # Remove standalone "Text" navigation element at start of sections
            r'^Text\s+',
            r'\nText\s+',
            # Remove expanded notation (RIS accessibility feature that duplicates abbreviated notation)
            r'Paragraph\s+(?:\d+[a-z]?|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*,?\s*',  # "Paragraph 3," or "Paragraph eins," -> ""
            r'\bAbsatz\s+(?:eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+[a-z]?)\s*,?\s*',  # "Absatz eins," -> ""
            r'\bZiffer\s+(?:eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+)\s*,?\s*',  # "Ziffer eins" -> ""
            r'\bLitera\s+[a-z]\s*,?\s*',  # "Litera a" -> ""
            r'Bundesgesetzblatt\s+(?:Teil\s+(?:eins|zwei|drei|\w+),?\s*)?Nr\.\s+\d+\s+aus\s+\d+,?\s*',  # Long BGBl references
            # Remove inline expanded refs like "gemäß Paragraph 7" (keep the § reference that usually precedes)
            r'gemäß\s+Paragraph\s+(?:\d+[a-z]?|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*,?\s*',
            r'nach\s+Paragraph\s+(?:\d+[a-z]?|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*,?\s*',
            r'des\s+Paragraph\s+(?:\d+[a-z]?|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*,?\s*',
            r'im\s+Sinne\s+des\s+Paragraph\s+(?:\d+[a-z]?|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s*,?\s*',
        ]
    elif country == 'NL':
        patterns = [
            r'Toon relaties in LiDO\s*',
            r'Maak een permanente link\s*',
            r'Toon wetstechnische informatie\s*',
            r'Druk het regelingonderdeel af\s*',
            r'Sla het regelingonderdeel op\s*',
            r'\[Wijziging\(en\)[^\]]*\]',
            r'wijzigingenoverzicht\s*',
            r'Selecteer[\s\S]*?geldig\s*',
            r'Vergelijk met\s*',
            # Remove leading "lid" numbers that may have been preserved
            r'^\d+[a-z]?\s+(?=[A-Z])',  # "1 In deze wet" -> "In deze wet"
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
    """Clean text using Gemini AI - optimized for high throughput."""
    if not text or len(text) < 100:
        return text

    if not HAS_REQUESTS:
        return text

    system_prompt = SYSTEM_PROMPTS.get(country, SYSTEM_PROMPTS['DE'])
    prompt = f'{system_prompt}\n\nClean this law text for "{title}":\n\n{text[:30000]}'

    # Use v1 API for gemini-3-flash support
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{CONFIG.gemini_model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": CONFIG.ai_max_tokens}
    }

    for attempt in range(CONFIG.max_retries):
        try:
            response = requests.post(url, json=payload, timeout=CONFIG.request_timeout * 2)  # Extended timeout for AI cleaning
            response.raise_for_status()
            return response.json()['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            log_warning(f"AI attempt {attempt + 1} failed: {e}")
            if attempt < CONFIG.max_retries - 1:
                time.sleep(1 + attempt)

    return text


def _clean_section_batch_with_ai(api_key: str, sections: List[Dict], country: str) -> List[str]:
    """Clean multiple sections in a single AI call - optimized for Gemini 3 Flash (1K RPM limit)."""
    if not sections:
        return []

    if not HAS_REQUESTS:
        return [s.get('text', '') for s in sections]

    system_prompt = SYSTEM_PROMPTS.get(country, SYSTEM_PROMPTS['DE'])

    # Build batch prompt
    batch_text = []
    for i, section in enumerate(sections):
        title = section.get('title', section.get('number', f'Section {i+1}'))
        text = section.get('text', '')[:5000]  # Limit per section
        batch_text.append(f"[SECTION_{i}] {title}:\n{text}")

    prompt = f"""{system_prompt}

Clean these {len(sections)} law text sections. Return each cleaned section prefixed with its original marker [SECTION_X]:

{chr(10).join(batch_text)}"""

    try:
        # Use v1 API for gemini-3-flash support
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{CONFIG.gemini_model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": CONFIG.ai_max_tokens}
        }
        response = requests.post(url, json=payload, timeout=CONFIG.request_timeout * 2)  # Extended for batch operations
        response.raise_for_status()
        result_text = response.json()['candidates'][0]['content']['parts'][0]['text']

        # Parse batch results
        results = []
        import re
        for i in range(len(sections)):
            pattern = rf'\[SECTION_{i}\][\s:]*(.+?)(?=\[SECTION_|\Z)'
            match = re.search(pattern, result_text, re.DOTALL)
            if match:
                results.append(match.group(1).strip())
            else:
                results.append(sections[i].get('text', ''))  # Fallback to original
        return results

    except Exception as e:
        log_warning(f"Batch AI cleaning failed: {e}")
        return [s.get('text', '') for s in sections]


def _clean_document_with_ai(doc: Dict, api_key: str, country: str, fast_mode: bool) -> Dict:
    """Clean a single document - used for parallel processing."""
    title = doc.get('abbreviation', doc.get('title', 'Unknown'))

    # Clean full_text if present
    if doc.get('full_text'):
        doc['full_text'] = clean_text_with_ai(api_key, doc['full_text'], title, country)

    # Clean sections in batches (skip if fast_mode)
    if doc.get('chapters') and not fast_mode:
        batch_size = 5  # Process 5 sections per AI call
        for chapter in doc['chapters']:
            sections = chapter.get('sections', [])
            sections_to_clean = [s for s in sections if s.get('text') and len(s['text']) > 500]

            # Process in batches
            for i in range(0, len(sections_to_clean), batch_size):
                batch = sections_to_clean[i:i + batch_size]
                cleaned_texts = _clean_section_batch_with_ai(api_key, batch, country)

                # Apply cleaned texts back
                for section, cleaned_text in zip(batch, cleaned_texts):
                    section['text'] = cleaned_text

                # Short delay between batches (optimized for 2K RPM)
                if i + batch_size < len(sections_to_clean):
                    time.sleep(CONFIG.ai_rate_limit_delay)

            # Clean short sections with regex (no AI needed)
            for section in sections:
                if section.get('text') and len(section['text']) <= 500:
                    section['text'] = clean_text_with_regex(section['text'], country)

    return doc


def clean_database(country: str, use_ai: bool = True, fast_mode: bool = False) -> bool:
    """Clean a country's database with parallel document processing."""
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

    # Filter out documents that should NOT be cleaned:
    # - Supplementary sources (AUVA Merkblätter, DGUV, etc.) - just display as PDF/HTML
    # - PDF-only documents
    # - HTML-only documents
    cleanable_docs = []
    skipped_docs = []
    for i, doc in enumerate(documents):
        is_pdf_only = doc.get('metadata', {}).get('is_pdf_only', False)
        is_html_only = doc.get('metadata', {}).get('is_html_only', False)
        is_supp = is_supplementary_source(doc)
        abbrev = doc.get('abbreviation', '')

        # Skip supplementary sources - they are not laws and have different structure
        # This includes: AUVA Merkblätter, DGUV publications, TRBS, TRGS, PGS, etc.
        # Also skip PDF-only and HTML-only documents
        # Also skip law variants ending in -PDF (e.g., ASchG-PDF, ARG-PDF)
        if is_supp or is_pdf_only or is_html_only or abbrev.endswith('-PDF'):
            skipped_docs.append((i, doc))
        else:
            cleanable_docs.append((i, doc))

    if skipped_docs:
        log_info(f"Skipping {len(skipped_docs)} documents (Merkblätter/PDFs - not cleaned)")
        for idx, doc in skipped_docs:
            title = doc.get('abbreviation', f'Doc {idx+1}')
            reason = 'supplementary' if is_supplementary_source(doc) else 'PDF/HTML-only'
            log_info(f"  - {title} ({reason})")

    if not cleanable_docs:
        log_info("No documents to clean (all are PDF-only)")
        return True

    log_info(f"Processing {len(cleanable_docs)} documents...")

    # Check for large files and warn about costs
    if use_ai:
        total_chars = 0
        large_files = []
        massive_files = []
        for orig_idx, doc in cleanable_docs:
            doc_chars = len(doc.get('full_text', ''))
            for ch in doc.get('chapters', []):
                doc_chars += len(ch.get('content', ''))
                for sec in ch.get('sections', []):
                    doc_chars += len(sec.get('content', ''))
            total_chars += doc_chars
            abbrev = doc.get('abbreviation', f'Doc {orig_idx+1}')
            if doc_chars >= CONFIG.massive_file_warning_chars:
                massive_files.append((abbrev, doc_chars))
            elif doc_chars >= CONFIG.large_file_warning_chars:
                large_files.append((abbrev, doc_chars))

        # Display cost warnings and ask about massive files
        skipped_massive = []
        if massive_files:
            log_warning(f"{'='*60}")
            log_warning(f"COST WARNING: {len(massive_files)} MASSIVE file(s) detected!")
            log_warning(f"{'='*60}")

            for name, chars in massive_files:
                tokens = chars // 4  # Rough estimate: 4 chars per token
                cost = (tokens / 1_000_000) * 0.075  # gemini-2.5-flash-lite pricing
                log_warning(f"  {name}: {chars:,} chars (~{tokens:,} tokens, ~${cost:.3f})")

                # Ask user whether to process or skip
                print(f"\n{Colors.YELLOW}Process '{name}'? [y/n/a] (yes/no/all): {Colors.RESET}", end='')
                try:
                    response = input().strip().lower()
                    if response == 'a':
                        log_info("Processing all remaining massive files...")
                        break  # Process all, don't ask again
                    elif response != 'y':
                        log_info(f"Skipping {name}")
                        skipped_massive.append(name)
                except (EOFError, KeyboardInterrupt):
                    log_info("\nSkipping all massive files (non-interactive mode)")
                    skipped_massive = [name for name, _ in massive_files]
                    break

        # Remove skipped files from cleanable_docs
        if skipped_massive:
            cleanable_docs = [(idx, doc) for idx, doc in cleanable_docs
                             if doc.get('abbreviation') not in skipped_massive]
            # Recalculate totals
            total_chars = 0
            for orig_idx, doc in cleanable_docs:
                doc_chars = len(doc.get('full_text', ''))
                for ch in doc.get('chapters', []):
                    doc_chars += len(ch.get('content', ''))
                    for sec in ch.get('sections', []):
                        doc_chars += len(sec.get('content', ''))
                total_chars += doc_chars
            log_info(f"Skipped {len(skipped_massive)} massive file(s)")

        if large_files:
            log_info(f"Large files ({len(large_files)}): " +
                     ", ".join(f"{n} ({c//1000}K)" for n, c in large_files))

        total_tokens = total_chars // 4
        total_cost = (total_tokens / 1_000_000) * 0.075
        log_info(f"Total: ~{total_chars:,} chars (~{total_tokens:,} tokens)")
        log_info(f"Estimated cost: ~${total_cost:.3f} (gemini-2.5-flash-lite)")

    if use_ai:
        # Use parallel processing for AI cleaning (optimized for Gemini 2K RPM)
        log_info(f"Using parallel AI cleaning ({CONFIG.max_parallel_ai_requests} workers, batch mode)")

        with concurrent.futures.ThreadPoolExecutor(max_workers=CONFIG.max_parallel_ai_requests) as executor:
            future_to_doc = {
                executor.submit(_clean_document_with_ai, doc, api_key, country, fast_mode): (orig_idx, doc)
                for orig_idx, doc in cleanable_docs
            }

            for future in concurrent.futures.as_completed(future_to_doc):
                orig_idx, doc = future_to_doc[future]
                title = doc.get('abbreviation', f'Doc {orig_idx+1}')
                try:
                    cleaned_doc = future.result()
                    documents[orig_idx] = cleaned_doc
                    log_success(f"Cleaned {title}")
                except Exception as e:
                    log_error(f"Failed to clean {title}: {e}")
    else:
        # Sequential regex cleaning (fast, no API needed)
        for orig_idx, doc in cleanable_docs:
            title = doc.get('abbreviation', doc.get('title', f'Doc {orig_idx+1}'))
            log_info(f"Cleaning {title}...")

            if doc.get('full_text'):
                doc['full_text'] = clean_text_with_regex(doc['full_text'], country)

            # Always apply regex cleaning to all sections (fast mode just skips AI)
            if doc.get('chapters'):
                for chapter in doc['chapters']:
                    for section in chapter.get('sections', []):
                        if section.get('text'):
                            section['text'] = clean_text_with_regex(section['text'], country)

            documents[orig_idx] = doc
            log_success(f"Cleaned {title}")

    # Update metadata
    db['metadata']['cleaned_at'] = datetime.now().isoformat()
    save_database(country, db)

    return True


# =============================================================================
# AI Database Validation Module
# =============================================================================

# Validation issue types
class ValidationIssue:
    """Represents a validation issue found in the database."""
    def __init__(self, issue_type: str, severity: str, law_abbr: str,
                 description: str, location: str = None, suggestion: str = None,
                 auto_fixable: bool = False, fix_data: Dict = None):
        self.issue_type = issue_type  # e.g., 'empty_text', 'duplicate_section', 'missing_chapter'
        self.severity = severity  # 'error', 'warning', 'info'
        self.law_abbr = law_abbr
        self.description = description
        self.location = location  # e.g., 'Chapter 3, § 15'
        self.suggestion = suggestion
        self.auto_fixable = auto_fixable
        self.fix_data = fix_data or {}

    def to_dict(self) -> Dict:
        return {
            'type': self.issue_type,
            'severity': self.severity,
            'law': self.law_abbr,
            'description': self.description,
            'location': self.location,
            'suggestion': self.suggestion,
            'auto_fixable': self.auto_fixable,
        }


def _validate_document_structure(doc: Dict, country: str) -> List[ValidationIssue]:
    """Validate a single document's structure and content (non-AI checks)."""
    issues = []
    abbr = doc.get('abbreviation', 'Unknown')

    # Check required fields
    required_fields = ['abbreviation', 'title', 'jurisdiction', 'chapters']
    for field in required_fields:
        if not doc.get(field):
            issues.append(ValidationIssue(
                issue_type='missing_field',
                severity='error',
                law_abbr=abbr,
                description=f"Missing required field: {field}",
                auto_fixable=False
            ))

    # Check chapters
    chapters = doc.get('chapters', [])
    if not chapters:
        issues.append(ValidationIssue(
            issue_type='no_chapters',
            severity='error',
            law_abbr=abbr,
            description="Document has no chapters",
            auto_fixable=False
        ))
        return issues

    # Track sections for duplicate detection
    seen_sections = {}
    total_sections = 0
    empty_sections = 0

    for ch_idx, chapter in enumerate(chapters):
        ch_title = chapter.get('title', f'Chapter {ch_idx + 1}')
        sections = chapter.get('sections', [])

        if not sections:
            issues.append(ValidationIssue(
                issue_type='empty_chapter',
                severity='warning',
                law_abbr=abbr,
                description=f"Chapter has no sections",
                location=ch_title,
                auto_fixable=True,
                fix_data={'action': 'remove_empty_chapter', 'chapter_idx': ch_idx}
            ))
            continue

        for sec_idx, section in enumerate(sections):
            total_sections += 1
            sec_num = section.get('number', '')
            sec_title = section.get('title', '')
            sec_text = section.get('text', '')

            # Check for empty text
            if not sec_text or len(sec_text.strip()) < 10:
                empty_sections += 1
                issues.append(ValidationIssue(
                    issue_type='empty_text',
                    severity='warning',
                    law_abbr=abbr,
                    description=f"Section has empty or very short text ({len(sec_text.strip())} chars)",
                    location=f"{ch_title} → § {sec_num}",
                    auto_fixable=False
                ))

            # Check for duplicates
            sec_key = f"{sec_num}:{sec_title}"
            if sec_key in seen_sections:
                prev_loc = seen_sections[sec_key]
                issues.append(ValidationIssue(
                    issue_type='duplicate_section',
                    severity='warning',
                    law_abbr=abbr,
                    description=f"Duplicate section found",
                    location=f"{ch_title} → § {sec_num} (also in {prev_loc})",
                    auto_fixable=True,
                    fix_data={'action': 'remove_duplicate', 'chapter_idx': ch_idx, 'section_idx': sec_idx}
                ))
            else:
                seen_sections[sec_key] = ch_title

            # Check for malformed section numbers
            if sec_num and not re.match(r'^[\d]+[a-z]?\.?$', str(sec_num).strip(), re.I):
                issues.append(ValidationIssue(
                    issue_type='malformed_number',
                    severity='info',
                    law_abbr=abbr,
                    description=f"Unusual section number format: '{sec_num}'",
                    location=f"{ch_title} → {sec_title}",
                    auto_fixable=False
                ))

    # Check for high empty section ratio
    if total_sections > 0 and empty_sections / total_sections > 0.3:
        issues.append(ValidationIssue(
            issue_type='high_empty_ratio',
            severity='error',
            law_abbr=abbr,
            description=f"{empty_sections}/{total_sections} sections ({int(empty_sections/total_sections*100)}%) have empty text",
            suggestion="Consider re-scraping this law",
            auto_fixable=False
        ))

    return issues


def _validate_chapter_structure(doc: Dict, country: str) -> List[ValidationIssue]:
    """Validate chapter structure against expected patterns."""
    issues = []
    abbr = doc.get('abbreviation', 'Unknown')
    chapters = doc.get('chapters', [])

    # Check if law should have official structure but only has 1 chapter
    if abbr in LAW_STRUCTURES.get(country, {}) and len(chapters) == 1:
        expected = LAW_STRUCTURES[country][abbr]
        issues.append(ValidationIssue(
            issue_type='missing_structure',
            severity='warning',
            law_abbr=abbr,
            description=f"Law has only 1 chapter but should have {len(expected)} according to official structure",
            suggestion="Run restructure command to apply official chapter structure",
            auto_fixable=False
        ))

    # Check for gaps in section numbering
    all_sections = []
    for chapter in chapters:
        for section in chapter.get('sections', []):
            try:
                num = float(re.sub(r'[^\d.]', '', str(section.get('number', '0'))))
                all_sections.append(num)
            except ValueError:
                pass

    if all_sections:
        all_sections.sort()
        for i in range(1, len(all_sections)):
            gap = all_sections[i] - all_sections[i-1]
            if gap > 5:  # Large gap in numbering
                issues.append(ValidationIssue(
                    issue_type='section_gap',
                    severity='info',
                    law_abbr=abbr,
                    description=f"Gap in section numbering: § {int(all_sections[i-1])} to § {int(all_sections[i])} (gap of {int(gap)})",
                    suggestion="Some sections may be missing",
                    auto_fixable=False
                ))

    return issues


def _ai_validate_document(doc: Dict, country: str, rate_limiter: Dict) -> List[ValidationIssue]:
    """Use AI to validate document content and identify issues against official TOC."""
    issues = []
    abbr = doc.get('abbreviation', 'Unknown')

    # Rate limiting - wait if needed
    current_time = time.time()
    last_call = rate_limiter.get('last_call', 0)
    min_interval = CONFIG.ai_rate_limit_delay * 2  # Double the normal delay for validation

    if current_time - last_call < min_interval:
        time.sleep(min_interval - (current_time - last_call))

    rate_limiter['last_call'] = time.time()

    # Build a summary of the document for AI analysis
    chapters = doc.get('chapters', [])
    chapter_summary = []
    sample_sections = []
    section_numbers_by_chapter = {}

    for ch in chapters:
        ch_title = ch.get('title', 'Unknown')
        sections = ch.get('sections', [])
        section_count = len(sections)
        chapter_summary.append(f"- {ch_title}: {section_count} sections")

        # Track section numbers per chapter
        sec_nums = [str(s.get('number', '?')) for s in sections]
        section_numbers_by_chapter[ch_title] = sec_nums

        # Get sample sections for content analysis
        for sec in sections[:2]:  # First 2 sections per chapter
            sec_text = sec.get('text', '')[:500]  # First 500 chars
            if sec_text:
                sample_sections.append({
                    'chapter': ch_title,
                    'number': sec.get('number', '?'),
                    'title': sec.get('title', ''),
                    'text_preview': sec_text
                })

    if not sample_sections:
        return issues

    # Get official structure if available for comparison
    official_structure = LAW_STRUCTURES.get(country, {}).get(abbr, [])
    official_toc = ""
    if official_structure:
        official_toc = f"""
OFFICIAL TABLE OF CONTENTS (from official sources):
{json.dumps([{
    'chapter': s['number'],
    'title': s['title'],
    'section_range': f"§§ {s['section_range'][0]}-{s['section_range'][1]}" if isinstance(s.get('section_range'), tuple) else 'N/A'
} for s in official_structure], ensure_ascii=False, indent=2)}

IMPORTANT: Compare the scraped structure against the official TOC above.
Check if:
- All chapters from the official TOC are present
- Sections are assigned to the correct chapters
- Section ranges match the official structure
"""

    # Prepare AI prompt
    country_names = {"AT": "Austrian", "DE": "German", "NL": "Dutch"}
    country_name = country_names.get(country, country)

    prompt = f"""You are validating a scraped {country_name} workplace safety law database entry.

LAW: {abbr} - {doc.get('title', 'Unknown')}
JURISDICTION: {doc.get('jurisdiction', 'Unknown')}

SCRAPED CHAPTER STRUCTURE:
{chr(10).join(chapter_summary)}

SECTIONS BY CHAPTER:
{json.dumps(section_numbers_by_chapter, ensure_ascii=False, indent=2)}
{official_toc}
SAMPLE SECTIONS (for content validation):
{json.dumps(sample_sections[:6], ensure_ascii=False, indent=2)}

Please analyze this law and identify any issues. Check for:
1. **Structure vs Official TOC**: Compare against the official table of contents (if provided)
   - Are any chapters missing or incorrectly named?
   - Are sections assigned to the wrong chapters?
   - Are section ranges correct?
2. Content quality - is the text actual law content or scraping artifacts/boilerplate?
3. Language consistency - is all text in the expected language ({country_name})?
4. Structural issues - do section numbers and titles look correct?
5. Completeness - based on the structure, does this appear to be a complete scrape?

Return a JSON array of issues found (empty array if no issues):
[
  {{
    "type": "toc_mismatch|missing_chapter|wrong_section_assignment|content_issue|language_issue|structure_issue|completeness_issue",
    "severity": "error|warning|info",
    "description": "What's wrong",
    "location": "Where (optional)",
    "suggestion": "How to fix (optional)"
  }}
]

Only return the JSON array, no other text. If everything looks good, return []."""

    try:
        response = call_gemini_api(prompt, temperature=0.5, max_tokens=2048)

        if not response:
            return issues

        # Use robust JSON parser to handle malformed AI responses
        ai_issues = robust_json_parse(response, default=[])

        if isinstance(ai_issues, list):
            for ai_issue in ai_issues:
                if isinstance(ai_issue, dict):
                    issues.append(ValidationIssue(
                        issue_type=ai_issue.get('type', 'ai_detected'),
                        severity=ai_issue.get('severity', 'warning'),
                        law_abbr=abbr,
                        description=ai_issue.get('description', 'AI-detected issue'),
                        location=ai_issue.get('location'),
                        suggestion=ai_issue.get('suggestion'),
                        auto_fixable=False
                    ))

    except Exception as e:
        log_warning(f"AI validation error for {abbr}: {e}")

    return issues


def _auto_fix_issues(db: Dict, issues: List[ValidationIssue], country: str) -> Tuple[int, List[str]]:
    """
    Automatically fix issues that are marked as auto_fixable.
    Returns (fixed_count, list of fix descriptions).
    """
    fixed_count = 0
    fix_descriptions = []

    # Group issues by document
    issues_by_doc = {}
    for issue in issues:
        if issue.auto_fixable:
            if issue.law_abbr not in issues_by_doc:
                issues_by_doc[issue.law_abbr] = []
            issues_by_doc[issue.law_abbr].append(issue)

    # Find documents and apply fixes
    for doc in db.get('documents', []):
        abbr = doc.get('abbreviation')
        if abbr not in issues_by_doc:
            continue

        doc_issues = issues_by_doc[abbr]

        # Sort by chapter/section index in reverse order to avoid index shifting
        removal_issues = [i for i in doc_issues if i.fix_data.get('action') in ['remove_empty_chapter', 'remove_duplicate']]
        removal_issues.sort(key=lambda x: (x.fix_data.get('chapter_idx', 0), x.fix_data.get('section_idx', 0)), reverse=True)

        for issue in removal_issues:
            action = issue.fix_data.get('action')

            if action == 'remove_empty_chapter':
                ch_idx = issue.fix_data.get('chapter_idx')
                if ch_idx is not None and ch_idx < len(doc.get('chapters', [])):
                    ch_title = doc['chapters'][ch_idx].get('title', f'Chapter {ch_idx}')
                    del doc['chapters'][ch_idx]
                    fixed_count += 1
                    fix_descriptions.append(f"{abbr}: Removed empty chapter '{ch_title}'")

            elif action == 'remove_duplicate':
                ch_idx = issue.fix_data.get('chapter_idx')
                sec_idx = issue.fix_data.get('section_idx')
                if ch_idx is not None and sec_idx is not None:
                    chapters = doc.get('chapters', [])
                    if ch_idx < len(chapters):
                        sections = chapters[ch_idx].get('sections', [])
                        if sec_idx < len(sections):
                            sec_num = sections[sec_idx].get('number', '?')
                            del sections[sec_idx]
                            fixed_count += 1
                            fix_descriptions.append(f"{abbr}: Removed duplicate § {sec_num}")

    return fixed_count, fix_descriptions


def validate_database(country: str, use_ai: bool = True, auto_fix: bool = True,
                      sample_size: int = None) -> Dict[str, Any]:
    """
    Validate a country's database for issues and optionally auto-fix.

    Args:
        country: Country code (AT, DE, NL)
        use_ai: Whether to use AI for content validation (respects rate limits)
        auto_fix: Whether to automatically fix fixable issues
        sample_size: For AI validation, only sample N documents (None = all)

    Returns:
        Dict with validation results
    """
    log_section(f"Validating {country} Database")

    db = load_database(country)
    documents = db.get('documents', [])

    if not documents:
        log_warning(f"No documents found in {country} database")
        return {'issues': [], 'fixed': 0, 'summary': {}}

    all_issues = []
    rate_limiter = {'last_call': 0}

    # Create progress bar
    pbar = create_progress_bar(len(documents), f"Validating {country}")

    for idx, doc in enumerate(documents):
        abbr = doc.get('abbreviation', 'Unknown')
        pbar.set_description(f"Validating {abbr}")

        # Basic structure validation (no AI)
        structure_issues = _validate_document_structure(doc, country)
        all_issues.extend(structure_issues)

        # Chapter structure validation (no AI)
        chapter_issues = _validate_chapter_structure(doc, country)
        all_issues.extend(chapter_issues)

        # AI validation (with rate limiting)
        if use_ai:
            # Apply sample_size limit
            if sample_size is None or idx < sample_size:
                # Skip AI validation for documents with critical errors
                critical_errors = [i for i in structure_issues if i.severity == 'error']
                if not critical_errors:
                    ai_issues = _ai_validate_document(doc, country, rate_limiter)
                    all_issues.extend(ai_issues)

        pbar.update(1)

    pbar.close()

    # Summarize issues
    summary = {
        'total_issues': len(all_issues),
        'by_severity': {'error': 0, 'warning': 0, 'info': 0},
        'by_type': {},
        'fixable': 0,
        'documents_with_issues': len(set(i.law_abbr for i in all_issues))
    }

    for issue in all_issues:
        summary['by_severity'][issue.severity] = summary['by_severity'].get(issue.severity, 0) + 1
        summary['by_type'][issue.issue_type] = summary['by_type'].get(issue.issue_type, 0) + 1
        if issue.auto_fixable:
            summary['fixable'] += 1

    # Auto-fix if requested
    fixed_count = 0
    fix_descriptions = []
    if auto_fix and summary['fixable'] > 0:
        log_info(f"Auto-fixing {summary['fixable']} issues...")
        fixed_count, fix_descriptions = _auto_fix_issues(db, all_issues, country)

        if fixed_count > 0:
            db['metadata']['validated_at'] = datetime.now().isoformat()
            db['metadata']['auto_fixes_applied'] = fixed_count
            save_database(country, db)

    # Log results
    print()
    log_header(f"Validation Results for {country}")

    if all_issues:
        # Group by severity
        errors = [i for i in all_issues if i.severity == 'error']
        warnings = [i for i in all_issues if i.severity == 'warning']
        infos = [i for i in all_issues if i.severity == 'info']

        if errors:
            print(f"\n{Colors.RED}ERRORS ({len(errors)}):{Colors.RESET}")
            for issue in errors[:10]:  # Show first 10
                print(f"  • [{issue.law_abbr}] {issue.description}")
                if issue.location:
                    print(f"    Location: {issue.location}")
                if issue.suggestion:
                    print(f"    Suggestion: {issue.suggestion}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more errors")

        if warnings:
            print(f"\n{Colors.YELLOW}WARNINGS ({len(warnings)}):{Colors.RESET}")
            for issue in warnings[:10]:
                print(f"  • [{issue.law_abbr}] {issue.description}")
                if issue.location:
                    print(f"    Location: {issue.location}")
            if len(warnings) > 10:
                print(f"  ... and {len(warnings) - 10} more warnings")

        if infos:
            print(f"\n{Colors.CYAN}INFO ({len(infos)}):{Colors.RESET}")
            for issue in infos[:5]:
                print(f"  • [{issue.law_abbr}] {issue.description}")
            if len(infos) > 5:
                print(f"  ... and {len(infos) - 5} more info items")
    else:
        log_success("No issues found! Database looks good.")

    # Show fixes applied
    if fix_descriptions:
        print(f"\n{Colors.GREEN}AUTO-FIXES APPLIED ({fixed_count}):{Colors.RESET}")
        for desc in fix_descriptions[:10]:
            print(f"  ✓ {desc}")
        if len(fix_descriptions) > 10:
            print(f"  ... and {len(fix_descriptions) - 10} more fixes")

    # Summary
    print(f"\n{Colors.CYAN}Summary:{Colors.RESET}")
    print(f"  Documents checked: {len(documents)}")
    print(f"  Documents with issues: {summary['documents_with_issues']}")
    print(f"  Total issues: {summary['total_issues']} (Errors: {summary['by_severity']['error']}, Warnings: {summary['by_severity']['warning']}, Info: {summary['by_severity']['info']})")
    if fixed_count > 0:
        print(f"  Auto-fixed: {fixed_count}")

    return {
        'issues': [i.to_dict() for i in all_issues],
        'fixed': fixed_count,
        'fix_descriptions': fix_descriptions,
        'summary': summary
    }


def ai_comprehensive_review(country: str) -> Dict[str, Any]:
    """
    Perform a comprehensive AI review of the entire database.
    This is a higher-level review that looks at the database as a whole.

    Note: This uses multiple AI calls with proper rate limiting.
    """
    log_section(f"Comprehensive AI Review: {country}")

    db = load_database(country)
    documents = db.get('documents', [])

    if not documents:
        log_warning(f"No documents in {country} database")
        return {'status': 'error', 'message': 'No documents'}

    # Build database overview
    overview = []
    for doc in documents:
        abbr = doc.get('abbreviation', 'Unknown')
        title = doc.get('title', 'Unknown')
        chapters = doc.get('chapters', [])
        total_sections = sum(len(ch.get('sections', [])) for ch in chapters)
        total_text_length = sum(
            len(sec.get('text', ''))
            for ch in chapters
            for sec in ch.get('sections', [])
        )
        overview.append({
            'abbr': abbr,
            'title': title,
            'chapters': len(chapters),
            'sections': total_sections,
            'text_chars': total_text_length
        })

    country_names = {"AT": "Austrian", "DE": "German", "NL": "Dutch"}
    country_name = country_names.get(country, country)

    prompt = f"""You are reviewing a scraped {country_name} workplace safety law database.

DATABASE OVERVIEW:
Country: {country}
Total Laws: {len(documents)}
Generated: {db.get('metadata', {}).get('generated_at', 'Unknown')}

LAWS IN DATABASE:
{json.dumps(overview, ensure_ascii=False, indent=2)}

Please provide a comprehensive review:

1. COMPLETENESS: Are all major {country_name} workplace safety laws included?
   - What important laws might be missing?
   - Are the section counts reasonable for each law?

2. DATA QUALITY: Based on the structure:
   - Do the text lengths seem appropriate?
   - Are there any laws that look potentially incomplete?

3. RECOMMENDATIONS:
   - What should be prioritized for review or re-scraping?
   - Any structural improvements needed?

Return your analysis as JSON:
{{
  "overall_quality": "good|fair|poor",
  "completeness_score": 1-10,
  "missing_laws": ["list of potentially missing important laws"],
  "suspicious_entries": [
    {{"abbr": "...", "issue": "description of concern"}}
  ],
  "recommendations": ["list of recommendations"],
  "summary": "2-3 sentence overall assessment"
}}

Only return the JSON, no other text."""

    log_info("Running AI comprehensive review...")
    time.sleep(CONFIG.ai_rate_limit_delay)  # Rate limiting

    try:
        response = call_gemini_api(prompt, temperature=0.5, max_tokens=4096)

        if not response:
            return {'status': 'error', 'message': 'AI returned no response'}

        # Parse response
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            response = response.split("```")[1].split("```")[0].strip()

        review = json.loads(response)

        # Display results
        print(f"\n{Colors.CYAN}═══ AI Comprehensive Review ═══{Colors.RESET}")
        print(f"\nOverall Quality: {Colors.BOLD}{review.get('overall_quality', 'unknown').upper()}{Colors.RESET}")
        print(f"Completeness Score: {review.get('completeness_score', '?')}/10")

        if review.get('missing_laws'):
            print(f"\n{Colors.YELLOW}Potentially Missing Laws:{Colors.RESET}")
            for law in review['missing_laws']:
                print(f"  • {law}")

        if review.get('suspicious_entries'):
            print(f"\n{Colors.YELLOW}Entries Needing Review:{Colors.RESET}")
            for entry in review['suspicious_entries']:
                print(f"  • {entry.get('abbr', '?')}: {entry.get('issue', 'Unknown issue')}")

        if review.get('recommendations'):
            print(f"\n{Colors.CYAN}Recommendations:{Colors.RESET}")
            for rec in review['recommendations']:
                print(f"  → {rec}")

        print(f"\n{Colors.DIM}Summary: {review.get('summary', 'No summary available')}{Colors.RESET}")

        return {
            'status': 'success',
            'review': review
        }

    except json.JSONDecodeError as e:
        log_error(f"Failed to parse AI review response: {e}")
        return {'status': 'error', 'message': f'JSON parse error: {e}'}
    except Exception as e:
        log_error(f"AI review failed: {e}")
        return {'status': 'error', 'message': str(e)}


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

        # Record the check results to changelog (even if nothing changed)
        record_update(country, results)

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

        # Validate (AI checks against official TOC, auto-fixes issues)
        if not args.no_ai:
            log_info("Step 4: AI Validation & Auto-fix...")
            validate_database(
                country,
                use_ai=True,
                auto_fix=True,
                sample_size=None  # Validate all documents
            )

        # Wikipedia
        if not getattr(args, 'skip_wiki', False):
            log_info("Step 5: Fetching Wikipedia articles...")
            if not args.no_ai:
                scrape_wikipedia_with_ai_suggestions(country)
            else:
                scrape_wikipedia_for_country(country)

    # Build master
    if not args.skip_build:
        log_info("Step 6: Building master database...")
        build_master_database()

    # Generate error report for Claude Code
    PIPELINE_ERRORS.set_context("full_pipeline", ",".join(countries))
    summary = PIPELINE_ERRORS.get_summary()

    if summary["total_errors"] > 0 or summary["total_warnings"] > 0:
        error_file = PIPELINE_ERRORS.save_to_file()
        if error_file:
            log_warning(f"Found {summary['total_errors']} errors and {summary['total_warnings']} warnings")
            log_info(f"Error report saved to: {error_file}")
            log_info("Claude Code can use this file to fix issues in future revisions")
    else:
        log_success("No errors or warnings collected during pipeline")

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

    # Ask about AI suggestions
    print(f"\n{Colors.BOLD}AI-Powered Suggestions{Colors.RESET}")
    print(f"{Colors.DIM}Use Gemini AI to suggest additional relevant Wikipedia articles{Colors.RESET}")
    print(f"{Colors.DIM}based on your scraped law content (requires GEMINI_API_KEY){Colors.RESET}\n")

    print("  [1] 📖 Standard - Predefined search terms only")
    print(f"  [2] ✨ {Colors.GREEN}AI-Enhanced{Colors.RESET} - Include AI-suggested articles")
    print()

    use_ai = False
    choice = input(f"{Colors.BOLD}Select mode [1]: {Colors.RESET}").strip()
    if choice == '2':
        if not get_api_key():
            log_warning("GEMINI_API_KEY not set. Using standard mode.")
        else:
            use_ai = True
            log_info("AI suggestions enabled")

    countries = ['AT', 'DE', 'NL'] if country == 'ALL' else [country]

    for c in countries:
        log_section(f"Scraping Wikipedia articles for {c}")
        if use_ai:
            scrape_wikipedia_with_ai_suggestions(c)
        else:
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

    if not get_api_key():
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

    print(f"  {Colors.CYAN}API Key:{Colors.RESET} {'✓ Set' if get_api_key() else '✗ Not set'}")
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
    """Get Wikipedia search terms for a law.

    Extended to include all laws from each country's database with
    specific search terms optimized for finding relevant Wikipedia articles.
    """
    search_terms = {
        "AT": {
            # Core safety laws
            "ASchG": ["ArbeitnehmerInnenschutzgesetz", "Arbeitsschutz Österreich"],
            "AZG": ["Arbeitszeitgesetz (Österreich)", "Arbeitszeitgesetz Österreich"],
            "ARG": ["Arbeitsruhegesetz", "Arbeitsruhe Österreich"],
            "MSchG": ["Mutterschutzgesetz (Österreich)", "Mutterschutz Österreich"],
            "KJBG": ["Kinder- und Jugendlichen-Beschäftigungsgesetz", "Jugendarbeitsschutz Österreich"],
            # Additional AT laws
            "AStV": ["Arbeitsstättenverordnung (Österreich)", "Arbeitsstätten Österreich"],
            "AM-VO": ["Arbeitsmittelverordnung", "Arbeitsmittel Österreich"],
            "DOK-VO": ["Dokumentationsverordnung Arbeitsschutz", "Gefahrstoffverzeichnis"],
            "PSA-V": ["Persönliche Schutzausrüstung", "PSA Verordnung Österreich"],
            "BauV": ["Bauarbeiterschutzverordnung", "Bauarbeiten Sicherheit Österreich"],
            "VOLV": ["Verordnung optische Strahlung", "Laserschutz"],
            "VEXAT": ["Verordnung explosionsfähige Atmosphären", "Explosionsschutz Österreich"],
            "GKV": ["Grenzwerteverordnung", "Arbeitsplatzgrenzwert Österreich"],
            "VGÜ": ["Verordnung Gesundheitsüberwachung", "Gesundheitsüberwachung Arbeitsplatz"],
            "KennV": ["Kennzeichnungsverordnung", "Sicherheitskennzeichnung"],
            "ESV": ["Elektroschutzverordnung", "Elektrosicherheit Österreich"],
            "BS-V": ["Bildschirmarbeitsverordnung", "Bildschirmarbeit Gesundheit"],
            "SFK": ["Sicherheitsfachkraft", "Sicherheitsfachkraft Österreich"],
            "ASV": ["Arbeitsstoffverordnung", "Gefahrstoffe Arbeitsplatz"],
        },
        "DE": {
            # Core safety laws
            "ArbSchG": ["Arbeitsschutzgesetz", "Arbeitsschutz Deutschland"],
            "ASiG": ["Arbeitssicherheitsgesetz", "Betriebsarzt Sicherheitsingenieur"],
            "ArbZG": ["Arbeitszeitgesetz", "Arbeitszeit Deutschland"],
            "MuSchG": ["Mutterschutzgesetz", "Mutterschutz Deutschland"],
            "JArbSchG": ["Jugendarbeitsschutzgesetz", "Jugendarbeitsschutz"],
            # Regulations (Verordnungen)
            "ArbStättV": ["Arbeitsstättenverordnung", "Arbeitsstätten Deutschland"],
            "BetrSichV": ["Betriebssicherheitsverordnung", "Betriebssicherheit"],
            "GefStoffV": ["Gefahrstoffverordnung", "Gefahrstoffe Deutschland"],
            "BildscharbV": ["Bildschirmarbeitsverordnung", "Bildschirmarbeit"],
            "LärmVibrationsArbSchV": ["Lärm- und Vibrations-Arbeitsschutzverordnung", "Lärmschutz Arbeitsplatz"],
            "LasthandhabV": ["Lastenhandhabungsverordnung", "Lastenhandhabung"],
            "PSA-BV": ["PSA-Benutzungsverordnung", "Persönliche Schutzausrüstung"],
            "ArbMedVV": ["Arbeitsmedizinische Vorsorge", "Arbeitsmedizinische Vorsorge"],
            "BioStoffV": ["Biostoffverordnung", "Biologische Arbeitsstoffe"],
            "OStrV": ["Arbeitsschutzverordnung künstliche optische Strahlung", "Laserschutz Arbeitsplatz"],
            # DGUV rules
            "DGUV": ["Deutsche Gesetzliche Unfallversicherung", "DGUV Vorschriften"],
            "DGUV-V1": ["DGUV Vorschrift 1", "Grundsätze der Prävention"],
            "DGUV-V3": ["DGUV Vorschrift 3", "Elektrische Anlagen und Betriebsmittel"],
        },
        "NL": {
            # Core Arbo laws
            "Arbowet": ["Arbeidsomstandighedenwet", "Arbowet"],
            "Arbobesluit": ["Arbeidsomstandighedenbesluit", "Arbobesluit"],
            "Arboregeling": ["Arbeidsomstandighedenregeling", "Arboregeling"],
            # Working time laws
            "Arbeidstijdenwet": ["Arbeidstijdenwet", "Werktijd Nederland"],
            "ATB": ["Arbeidstijdenbesluit", "Arbeidstijden regels"],
            # Chemical/substances
            "REACH": ["REACH-verordening", "REACH chemische stoffen"],
            # Additional NL safety topics
            "WMS": ["Wet milieubeheer stoffen", "Gevaarlijke stoffen Nederland"],
            "RI&E": ["Risico-inventarisatie en -evaluatie", "RI&E Nederland"],
            "BHV": ["Bedrijfshulpverlening", "BHV Nederland"],
            "PBM": ["Persoonlijke beschermingsmiddelen", "PBM arbeidsveiligheid"],
            "ARIE": ["Aanvullende risico-inventarisatie", "ARIE regeling"],
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
        'User-Agent': f'EU-Safety-Laws-Database/{CONFIG.scraper_version} (by Erwin Esener @eeesener; https://github.com/eres2k/safety-compliance) Python/requests',
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
            'User-Agent': f'EU-Safety-Laws-Database/{CONFIG.scraper_version} (by Erwin Esener @eeesener; https://github.com/eres2k/safety-compliance) Python/requests',
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


def ai_suggest_wikipedia_sources(country: str) -> List[Dict[str, Any]]:
    """Use AI to suggest relevant Wikipedia articles based on law content."""
    if not HAS_REQUESTS:
        log_error("requests package required for AI suggestions")
        return []

    api_key = get_api_key()
    if not api_key:
        log_error("GEMINI_API_KEY not set (check env var or .env file)")
        return []

    # Load existing database to analyze content
    db_path = CONFIG.base_path / country.lower() / f"{country.lower()}_database.json"
    if not db_path.exists():
        log_error(f"Database not found: {db_path}. Run 'scrape' first.")
        return []

    with open(db_path, 'r', encoding='utf-8') as f:
        db = json.load(f)

    # Extract key topics and terms from all laws
    law_summaries = []
    for law in db.get('items', []):
        law_abbr = law.get('abbreviation', law.get('title', 'Unknown'))
        title = law.get('title', '')

        # Get key sections/topics
        sections = []
        for chapter in law.get('chapters', []):
            for section in chapter.get('sections', [])[:5]:  # First 5 sections per chapter
                if section.get('title'):
                    sections.append(section['title'])

        law_summaries.append({
            'abbr': law_abbr,
            'title': title,
            'key_sections': sections[:15]  # Limit to 15 most important
        })

    # Language mapping
    lang_map = {"AT": "German", "DE": "German", "NL": "Dutch"}
    lang = lang_map.get(country, "English")
    wiki_lang = {"AT": "de", "DE": "de", "NL": "nl"}.get(country, "en")

    prompt = f"""You are an expert in workplace health and safety regulations in {country}.

Based on the following laws and their key sections, suggest relevant Wikipedia articles that would provide helpful background context for understanding these regulations.

LAWS IN DATABASE:
{json.dumps(law_summaries, indent=2, ensure_ascii=False)}

For each law, suggest 1-3 relevant Wikipedia articles that cover:
1. The law itself (if a Wikipedia article exists)
2. Key concepts mentioned in the law (e.g., "risk assessment", "personal protective equipment", "working hours")
3. Related institutions or regulatory bodies

Return a JSON array with this exact format:
[
  {{
    "law_abbr": "ASchG",
    "suggestions": [
      {{
        "search_term": "Arbeitsschutz",
        "reason": "General workplace safety overview",
        "priority": "high"
      }},
      {{
        "search_term": "Persönliche Schutzausrüstung",
        "reason": "PPE is a major topic in this law",
        "priority": "medium"
      }}
    ]
  }}
]

Requirements:
- Use {lang} Wikipedia search terms (they will be searched on {wiki_lang}.wikipedia.org)
- Each suggestion should have search_term, reason, and priority (high/medium/low)
- Focus on topics relevant to Amazon logistics/warehouse operations
- Maximum 3 suggestions per law
- Return ONLY valid JSON, no other text"""

    try:
        log_info(f"Asking AI to suggest Wikipedia sources for {country}...")

        # Use v1 API for gemini-3-flash support
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{CONFIG.gemini_model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": CONFIG.ai_max_tokens}
        }
        response = requests.post(url, json=payload, timeout=CONFIG.request_timeout * 2)  # Extended for AI operations
        response.raise_for_status()
        response_text = response.json()['candidates'][0]['content']['parts'][0]['text'].strip()
        # Remove markdown code blocks if present
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
        response_text = response_text.strip()

        suggestions = json.loads(response_text)

        # Flatten into list of search terms with metadata
        all_suggestions = []
        for law_entry in suggestions:
            law_abbr = law_entry.get('law_abbr', '')
            for suggestion in law_entry.get('suggestions', []):
                all_suggestions.append({
                    'law_abbr': law_abbr,
                    'search_term': suggestion.get('search_term', ''),
                    'reason': suggestion.get('reason', ''),
                    'priority': suggestion.get('priority', 'medium')
                })

        log_success(f"AI suggested {len(all_suggestions)} Wikipedia sources")
        return all_suggestions

    except Exception as e:
        log_error(f"AI suggestion failed: {e}")
        return []


def scrape_wikipedia_with_ai_suggestions(country: str):
    """Scrape Wikipedia articles including AI-suggested sources."""
    # First get AI suggestions
    ai_suggestions = ai_suggest_wikipedia_sources(country)

    # Get existing search terms
    laws = CONFIG.sources[country]["main_laws"]
    wiki_dir = CONFIG.base_path / country.lower() / "wikipedia"
    wiki_dir.mkdir(parents=True, exist_ok=True)

    # Language mapping
    lang_map = {"AT": "de", "DE": "de", "NL": "nl"}
    lang = lang_map.get(country, "en")

    results = {}

    # First scrape using predefined terms
    log_info("Scraping predefined Wikipedia articles...")
    for law_abbr in laws.keys():
        search_terms = get_wikipedia_search_terms(country, law_abbr)

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

    # Now scrape AI-suggested articles
    if ai_suggestions:
        log_info(f"Scraping {len(ai_suggestions)} AI-suggested Wikipedia articles...")

        ai_results = {}
        for suggestion in ai_suggestions:
            search_term = suggestion['search_term']
            law_abbr = suggestion['law_abbr']
            priority = suggestion['priority']

            # Skip if we already have this law covered
            key = f"{law_abbr}_{search_term.replace(' ', '_')}"
            if key in ai_results:
                continue

            log_info(f"  [{priority}] Searching: {search_term} (for {law_abbr})")
            article = scrape_wikipedia_article(search_term, lang)

            if article:
                ai_results[key] = {
                    **article,
                    'law_abbr': law_abbr,
                    'ai_suggested': True,
                    'suggestion_reason': suggestion['reason'],
                    'priority': priority
                }
                log_success(f"    Found: {article['title']}")

                # Save HTML file with unique name
                safe_term = search_term.replace(' ', '_').replace('/', '_')[:30]
                safe_abbr = law_abbr.replace('/', '_').replace('\\', '_').replace(':', '_')
                html_file = wiki_dir / f"{safe_abbr}_{safe_term}_wiki.html"
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
        .ai-badge {{ background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px; }}
    </style>
</head>
<body>
    <div class="wiki-source">
        <strong>Source:</strong> <a href="{article['url']}" target="_blank">{article['url']}</a>
        <span class="ai-badge">AI Suggested</span>
        <br><small>Scraped: {article['scraped_at']}</small>
        <br><small>Reason: {suggestion['reason']}</small>
        <br><small>Related to: {law_abbr}</small>
    </div>
    {article['html_content']}
</body>
</html>""")

            time.sleep(CONFIG.rate_limit_delay * 2)  # Slower rate for AI suggestions

        # Merge AI results
        results['_ai_suggestions'] = list(ai_results.values())

    # Save enhanced index file
    index_file = wiki_dir / "wiki_index.json"
    ai_articles = results.pop('_ai_suggestions', [])

    index_data = {
        "country": country,
        "language": lang,
        "scraped_at": datetime.now().isoformat(),
        "articles": {k: {"title": v["title"], "url": v["url"], "summary": v["summary"]}
                     for k, v in results.items()},
        "ai_suggested_articles": [
            {
                "law_abbr": a["law_abbr"],
                "title": a["title"],
                "url": a["url"],
                "summary": a["summary"],
                "reason": a.get("suggestion_reason", ""),
                "priority": a.get("priority", "medium")
            }
            for a in ai_articles
        ]
    }

    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)

    total_articles = len(results) + len(ai_articles)
    log_success(f"Saved {total_articles} Wikipedia articles for {country} ({len(ai_articles)} AI-suggested)")
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

    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate database with AI and auto-fix issues')
    validate_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to validate')
    validate_parser.add_argument('--all', action='store_true', help='Validate all countries')
    validate_parser.add_argument('--no-ai', action='store_true', help='Skip AI validation, use structure checks only')
    validate_parser.add_argument('--no-fix', action='store_true', help='Do not auto-fix issues')
    validate_parser.add_argument('--sample', type=int, metavar='N', help='Only AI-validate first N documents (faster)')
    validate_parser.add_argument('--review', action='store_true', help='Run comprehensive AI review of entire database')

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
    wiki_parser.add_argument('--ai-suggest', action='store_true',
                             help='Use AI to suggest additional relevant Wikipedia articles based on law content')

    # Merkblätter command (supplementary safety publications)
    merkblatt_parser = subparsers.add_parser('merkblaetter', help='Scrape Merkblätter/supplementary safety publications (AUVA, DGUV, Arboportaal)')
    merkblatt_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to scrape Merkblätter for (AT=AUVA, DE=DGUV, NL=Arboportaal)')
    merkblatt_parser.add_argument('--all', action='store_true', help='Scrape Merkblätter for all countries')
    merkblatt_parser.add_argument('--limit', type=int, default=5, metavar='N',
                                  help='Maximum number of Merkblätter to fetch per country (default: 5)')
    merkblatt_parser.add_argument('--skip-ai-summary', action='store_true',
                                  help='Skip AI summary generation for PDFs')

    # Validate URLs command
    validate_urls_parser = subparsers.add_parser('validate-urls', help='Validate Merkblätter URLs and check for broken links')
    validate_urls_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to validate URLs for')
    validate_urls_parser.add_argument('--all', action='store_true', help='Validate URLs for all countries')
    validate_urls_parser.add_argument('--auto-fix', action='store_true', help='Attempt to fix broken URLs using AI')
    validate_urls_parser.add_argument('--report', type=str, metavar='FILE', help='Save detailed report to JSON file')

    # Sources command (source health management)
    sources_parser = subparsers.add_parser('sources', help='Manage source health and fallback URLs')
    sources_parser.add_argument('--health-report', action='store_true', help='Show source health report')
    sources_parser.add_argument('--reset-health', action='store_true', help='Reset all source health tracking')
    sources_parser.add_argument('--reset-source', type=str, metavar='SOURCE_ID', help='Reset health for specific source (e.g., AT:AUVA_M_025)')
    sources_parser.add_argument('--list-disabled', action='store_true', help='List all auto-disabled sources')
    sources_parser.add_argument('--enable-source', type=str, metavar='SOURCE_ID', help='Re-enable a disabled source')

    # All command (complete pipeline)
    all_parser = subparsers.add_parser('all', help='Run complete pipeline')
    all_parser.add_argument('--country', choices=['AT', 'DE', 'NL'], help='Country to process')
    all_parser.add_argument('--all', action='store_true', help='Process all countries')
    all_parser.add_argument('--no-ai', action='store_true', help='Use regex only, no AI')
    all_parser.add_argument('--fast', action='store_true', help='Fast cleaning mode')
    all_parser.add_argument('--skip-scrape', action='store_true', help='Skip scraping step')
    all_parser.add_argument('--skip-build', action='store_true', help='Skip master database build')
    all_parser.add_argument('--skip-wiki', action='store_true', help='Skip Wikipedia fetching step')
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
    if args.command in ['scrape', 'clean', 'restructure', 'validate', 'all', 'check-updates', 'wikipedia', 'merkblaetter']:
        if not getattr(args, 'all', False) and not getattr(args, 'country', None):
            print(f"Error: --country or --all is required for {args.command}")
            return 1

    # Run command
    def cmd_merkblaetter(args):
        """Scrape Merkblätter / supplementary safety publications."""
        countries = ['AT', 'DE', 'NL'] if args.all else [args.country]
        limit = getattr(args, 'limit', 5)
        skip_ai = getattr(args, 'skip_ai_summary', False)

        for country in countries:
            log_header(f"Scraping Merkblätter for {country}")

            scraper_class = MERKBLATT_SCRAPERS.get(country)
            if not scraper_class:
                log_error(f"No Merkblätter scraper available for {country}")
                continue

            scraper = scraper_class(law_limit=limit)
            documents = scraper.scrape()

            if documents:
                # Save to database
                db_path = CONFIG.base_path / country.lower() / f"{country.lower()}_merkblaetter.json"
                db_path.parent.mkdir(parents=True, exist_ok=True)

                db_data = {
                    "metadata": {
                        "country": country,
                        "type": "merkblaetter",
                        "generated_at": datetime.now().isoformat(),
                        "document_count": len(documents),
                        "scraper_version": CONFIG.scraper_version
                    },
                    "documents": documents
                }

                with open(db_path, 'w', encoding='utf-8') as f:
                    json.dump(db_data, f, indent=2, ensure_ascii=False)

                log_success(f"Saved {len(documents)} Merkblätter to {db_path}")
            else:
                log_warning(f"No Merkblätter scraped for {country}")

        return 0

    def cmd_validate(args):
        """Validate database command."""
        countries = ['AT', 'DE', 'NL'] if args.all else [args.country]

        for country in countries:
            if getattr(args, 'review', False):
                # Comprehensive AI review
                ai_comprehensive_review(country)
            else:
                # Standard validation
                validate_database(
                    country,
                    use_ai=not getattr(args, 'no_ai', False),
                    auto_fix=not getattr(args, 'no_fix', False),
                    sample_size=getattr(args, 'sample', None)
                )
        return 0

    def cmd_wikipedia(args):
        """Wikipedia scraping command."""
        countries = ['AT', 'DE', 'NL'] if args.all else [args.country]
        use_ai = getattr(args, 'ai_suggest', False)

        for country in countries:
            if use_ai:
                log_info(f"Scraping Wikipedia for {country} with AI suggestions...")
                scrape_wikipedia_with_ai_suggestions(country)
            else:
                scrape_wikipedia_for_country(country)
        return 0

    def cmd_validate_urls(args):
        """Validate Merkblätter URLs and check for broken links."""
        country = args.country if not args.all else None
        auto_fix = getattr(args, 'auto_fix', False)
        report_file = getattr(args, 'report', None)

        log_header("Validating Merkblätter URLs")

        if report_file:
            # Generate comprehensive report
            log_info("Generating comprehensive URL report...")
            report = update_broken_links_report(report_file)

            # Print summary
            for c, summary in report["summary"].items():
                log_info(f"{c}: {summary['working']}/{summary['total']} working ({summary['coverage_percent']}%)")
                if summary['broken'] > 0:
                    log_warning(f"  {summary['broken']} broken URLs")
                if summary['with_fallbacks'] > 0:
                    log_info(f"  {summary['with_fallbacks']} have fallback URLs")
        else:
            # Standard validation
            results = validate_and_fix_merkblaetter_urls(country, auto_fix=auto_fix)

            log_info(f"Checked: {results['checked']} URLs")
            log_success(f"Valid: {len(results['valid'])}")

            if results['fixed_with_fallback']:
                log_info(f"Fixed with fallback: {len(results['fixed_with_fallback'])}")
                for entry in results['fixed_with_fallback']:
                    log_info(f"  {entry['abbrev']}: using {entry['working_fallback']}")

            if results['fixed']:
                log_success(f"Fixed with AI: {len(results['fixed'])}")
                for entry in results['fixed']:
                    log_info(f"  {entry['abbrev']}: {entry['suggested_url']}")

            if results['broken']:
                log_error(f"Broken: {len(results['broken'])}")
                for entry in results['broken']:
                    log_warning(f"  {entry['abbrev']}: {entry['url']} (status: {entry['status']})")

        return 0

    def cmd_sources(args):
        """Manage source health and fallback URLs."""
        log_header("Source Health Management")

        if getattr(args, 'health_report', False):
            # Show health report
            report = SOURCE_HEALTH.get_health_report()
            summary = report["summary"]

            log_info(f"Source Health Summary:")
            log_success(f"  Healthy: {summary['healthy']}")
            if summary['degraded'] > 0:
                log_warning(f"  Degraded: {summary['degraded']}")
            if summary['failing'] > 0:
                log_error(f"  Failing: {summary['failing']}")
            if summary['auto_disabled'] > 0:
                log_error(f"  Auto-disabled: {summary['auto_disabled']}")

            if report["auto_disabled_sources"]:
                print()
                log_warning("Auto-disabled sources:")
                for source_id in report["auto_disabled_sources"]:
                    details = report["details"].get(source_id, {})
                    http_status = details.get("last_http_status", "unknown")
                    log_error(f"  {source_id} (HTTP {http_status})")
                    suggestions = SOURCE_HEALTH.get_actionable_suggestions(source_id)
                    for suggestion in suggestions[:2]:  # Show first 2 suggestions
                        log_info(f"    → {suggestion}")

            if report["degraded_sources"]:
                print()
                log_warning("Degraded sources (failing but not yet disabled):")
                for source_id in report["degraded_sources"]:
                    details = report["details"].get(source_id, {})
                    failures = details.get("consecutive_failures", 0)
                    log_warning(f"  {source_id} ({failures} consecutive failures)")

        elif getattr(args, 'reset_health', False):
            # Reset all health tracking
            SOURCE_HEALTH.health_data = {
                "sources": {},
                "last_updated": None,
                "auto_disabled": []
            }
            SOURCE_HEALTH.save()
            log_success("All source health tracking has been reset")

        elif getattr(args, 'reset_source', None):
            # Reset specific source
            source_id = args.reset_source
            if source_id in SOURCE_HEALTH.health_data["sources"]:
                del SOURCE_HEALTH.health_data["sources"][source_id]
            if source_id in SOURCE_HEALTH.health_data["auto_disabled"]:
                SOURCE_HEALTH.health_data["auto_disabled"].remove(source_id)
            SOURCE_HEALTH.save()
            log_success(f"Health tracking reset for: {source_id}")

        elif getattr(args, 'list_disabled', False):
            # List disabled sources
            disabled = SOURCE_HEALTH.health_data.get("auto_disabled", [])
            if disabled:
                log_warning(f"Auto-disabled sources ({len(disabled)}):")
                for source_id in disabled:
                    details = SOURCE_HEALTH.health_data["sources"].get(source_id, {})
                    url = details.get("url", "unknown")
                    http_status = details.get("last_http_status", "unknown")
                    log_error(f"  {source_id}")
                    log_info(f"    URL: {url[:80]}...")
                    log_info(f"    Status: HTTP {http_status}")
                    suggestions = SOURCE_HEALTH.get_actionable_suggestions(source_id)
                    if suggestions:
                        log_info(f"    Fix: {suggestions[0]}")
            else:
                log_success("No auto-disabled sources")

        elif getattr(args, 'enable_source', None):
            # Re-enable a source
            source_id = args.enable_source
            if source_id in SOURCE_HEALTH.health_data.get("auto_disabled", []):
                SOURCE_HEALTH.health_data["auto_disabled"].remove(source_id)
                if source_id in SOURCE_HEALTH.health_data["sources"]:
                    SOURCE_HEALTH.health_data["sources"][source_id]["auto_disabled"] = False
                    SOURCE_HEALTH.health_data["sources"][source_id]["consecutive_failures"] = 0
                SOURCE_HEALTH.save()
                log_success(f"Re-enabled source: {source_id}")
            else:
                log_warning(f"Source {source_id} is not in the disabled list")

        else:
            # Show help
            log_info("Available options:")
            log_info("  --health-report    Show source health report")
            log_info("  --reset-health     Reset all source health tracking")
            log_info("  --reset-source ID  Reset health for specific source")
            log_info("  --list-disabled    List all auto-disabled sources")
            log_info("  --enable-source ID Re-enable a disabled source")

        return 0

    commands = {
        'scrape': cmd_scrape,
        'clean': cmd_clean,
        'restructure': cmd_restructure,
        'validate': cmd_validate,
        'build': cmd_build,
        'status': cmd_status,
        'check-updates': cmd_check_updates,
        'wikipedia': cmd_wikipedia,
        'merkblaetter': cmd_merkblaetter,
        'validate-urls': cmd_validate_urls,
        'sources': cmd_sources,
        'all': cmd_all,
    }

    return commands[args.command](args)


if __name__ == '__main__':
    sys.exit(main())

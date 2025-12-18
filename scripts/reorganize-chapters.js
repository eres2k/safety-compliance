#!/usr/bin/env node
/**
 * Reorganize Law Database Chapters Script
 * Applies proper chapter/Abschnitt structures to existing law databases
 *
 * Usage:
 *   node scripts/reorganize-chapters.js [at|de|nl|all]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message) { log(`✓ ${message}`, 'green') }
function logWarning(message) { log(`⚠ ${message}`, 'yellow') }
function logInfo(message) { log(`ℹ ${message}`, 'cyan') }
function logError(message) { console.error(`${colors.red}ERROR: ${message}${colors.reset}`) }

// Official law structures - must match law_manager.py
const LAW_STRUCTURES = {
  AT: {
    ASchG: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 18] },
      { number: '2', title: '2. Abschnitt - Arbeitsstätten und Baustellen', title_en: 'Section 2 - Workplaces and Construction Sites', section_range: [19, 32] },
      { number: '3', title: '3. Abschnitt - Arbeitsmittel', title_en: 'Section 3 - Work Equipment', section_range: [33, 39] },
      { number: '4', title: '4. Abschnitt - Arbeitsstoffe', title_en: 'Section 4 - Work Substances', section_range: [40, 48] },
      { number: '5', title: '5. Abschnitt - Gesundheitsüberwachung', title_en: 'Section 5 - Health Surveillance', section_range: [49, 59] },
      { number: '6', title: '6. Abschnitt - Arbeitsvorgänge und Arbeitsplätze', title_en: 'Section 6 - Work Processes and Workplaces', section_range: [60, 72] },
      { number: '7', title: '7. Abschnitt - Präventivdienste', title_en: 'Section 7 - Preventive Services', section_range: [73, 90] },
      { number: '8', title: '8. Abschnitt - Behörden und Verfahren', title_en: 'Section 8 - Authorities and Procedures', section_range: [91, 101.5] },
      { number: '9', title: '9. Abschnitt - Übergangsrecht und Aufhebung', title_en: 'Section 9 - Transitional Law and Repeal', section_range: [102, 127.5] },
      { number: '10', title: '10. Abschnitt - Schlussbestimmungen', title_en: 'Section 10 - Final Provisions', section_range: [128, 132] },
    ],
    KJBG: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 3] },
      { number: '2', title: '2. Abschnitt - Beschäftigungsverbote und -beschränkungen', title_en: 'Section 2 - Employment Prohibitions and Restrictions', section_range: [4, 11] },
      { number: '3', title: '3. Abschnitt - Arbeitszeit', title_en: 'Section 3 - Working Time', section_range: [12, 21] },
      { number: '4', title: '4. Abschnitt - Urlaub', title_en: 'Section 4 - Leave', section_range: [22, 22] },
      { number: '5', title: '5. Abschnitt - Strafbestimmungen', title_en: 'Section 5 - Penal Provisions', section_range: [23, 25] },
      { number: '6', title: '6. Abschnitt - Behörden', title_en: 'Section 6 - Authorities', section_range: [26, 27] },
      { number: '7', title: '7. Abschnitt - Schluss- und Übergangsbestimmungen', title_en: 'Section 7 - Final and Transitional Provisions', section_range: [28, 50] },
    ],
    AZG: [
      { number: '1', title: '1. Abschnitt - Geltungsbereich', title_en: 'Section 1 - Scope', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Arbeitszeit', title_en: 'Section 2 - Working Time', section_range: [3, 14] },
      { number: '3', title: '3. Abschnitt - Nacht- und Schichtarbeit', title_en: 'Section 3 - Night and Shift Work', section_range: [15, 19.99] },
      { number: '4', title: '4. Abschnitt - Besondere Bestimmungen', title_en: 'Section 4 - Special Provisions', section_range: [20, 28] },
      { number: '5', title: '5. Abschnitt - Verfahrens- und Strafbestimmungen', title_en: 'Section 5 - Procedural and Penal Provisions', section_range: [29, 32] },
      { number: '6', title: '6. Abschnitt - Schlussbestimmungen', title_en: 'Section 6 - Final Provisions', section_range: [33, 100] },
    ],
    MSchG: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Beschäftigungsverbote und -beschränkungen', title_en: 'Section 2 - Employment Prohibitions and Restrictions', section_range: [3, 10] },
      { number: '3', title: '3. Abschnitt - Kündigungs- und Entlassungsschutz', title_en: 'Section 3 - Dismissal Protection', section_range: [10.01, 15.99] },
      { number: '4', title: '4. Abschnitt - Entgelt und sonstige Leistungen', title_en: 'Section 4 - Pay and Other Benefits', section_range: [16, 22] },
      { number: '5', title: '5. Abschnitt - Aufsicht und Durchführung', title_en: 'Section 5 - Supervision and Implementation', section_range: [23, 29] },
      { number: '6', title: '6. Abschnitt - Strafbestimmungen', title_en: 'Section 6 - Penal Provisions', section_range: [30, 32] },
      { number: '7', title: '7. Abschnitt - Schlussbestimmungen', title_en: 'Section 7 - Final Provisions', section_range: [33, 100] },
    ],
    'AStV': [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 5] },
      { number: '2', title: '2. Abschnitt - Arbeitsstätten in Gebäuden', title_en: 'Section 2 - Workplaces in Buildings', section_range: [6, 25] },
      { number: '3', title: '3. Abschnitt - Arbeitsstätten im Freien', title_en: 'Section 3 - Outdoor Workplaces', section_range: [26, 32] },
      { number: '4', title: '4. Abschnitt - Brandschutz', title_en: 'Section 4 - Fire Protection', section_range: [33, 40] },
      { number: '5', title: '5. Abschnitt - Erste Hilfe', title_en: 'Section 5 - First Aid', section_range: [41, 45] },
      { number: '6', title: '6. Abschnitt - Schlussbestimmungen', title_en: 'Section 6 - Final Provisions', section_range: [46, 100] },
    ],
    'AM-VO': [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 5] },
      { number: '2', title: '2. Abschnitt - Beschaffenheit von Arbeitsmitteln', title_en: 'Section 2 - Condition of Work Equipment', section_range: [6, 15] },
      { number: '3', title: '3. Abschnitt - Benutzung von Arbeitsmitteln', title_en: 'Section 3 - Use of Work Equipment', section_range: [16, 30] },
      { number: '4', title: '4. Abschnitt - Besondere Arbeitsmittel', title_en: 'Section 4 - Special Work Equipment', section_range: [31, 60] },
      { number: '5', title: '5. Abschnitt - Prüfungen', title_en: 'Section 5 - Inspections', section_range: [61, 70] },
      { number: '6', title: '6. Abschnitt - Schlussbestimmungen', title_en: 'Section 6 - Final Provisions', section_range: [71, 100] },
    ],
    'BauV': [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 10] },
      { number: '2', title: '2. Abschnitt - Arbeitsplätze und Verkehrswege', title_en: 'Section 2 - Workplaces and Traffic Routes', section_range: [11, 30] },
      { number: '3', title: '3. Abschnitt - Gerüste', title_en: 'Section 3 - Scaffolding', section_range: [31, 70] },
      { number: '4', title: '4. Abschnitt - Absturzsicherungen', title_en: 'Section 4 - Fall Protection', section_range: [71, 90] },
      { number: '5', title: '5. Abschnitt - Erd- und Felsarbeiten', title_en: 'Section 5 - Earth and Rock Work', section_range: [91, 110] },
      { number: '6', title: '6. Abschnitt - Abbrucharbeiten', title_en: 'Section 6 - Demolition Work', section_range: [111, 125] },
      { number: '7', title: '7. Abschnitt - Schlussbestimmungen', title_en: 'Section 7 - Final Provisions', section_range: [126, 200] },
    ],
    'BS-V': [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 5] },
      { number: '2', title: '2. Abschnitt - Anforderungen an Bildschirmarbeitsplätze', title_en: 'Section 2 - Requirements for VDU Workstations', section_range: [6, 15] },
      { number: '3', title: '3. Abschnitt - Arbeitsabläufe', title_en: 'Section 3 - Work Processes', section_range: [16, 20] },
      { number: '4', title: '4. Abschnitt - Untersuchungen der Augen', title_en: 'Section 4 - Eye Examinations', section_range: [21, 25] },
      { number: '5', title: '5. Abschnitt - Schlussbestimmungen', title_en: 'Section 5 - Final Provisions', section_range: [26, 200] },
    ],
    'PSA-V': [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 3] },
      { number: '2', title: '2. Abschnitt - Bereitstellung und Benutzung', title_en: 'Section 2 - Provision and Use', section_range: [4, 7] },
      { number: '3', title: '3. Abschnitt - Schlussbestimmungen', title_en: 'Section 3 - Final Provisions', section_range: [8, 20] },
    ],
    'ESV 2012': [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 5] },
      { number: '2', title: '2. Abschnitt - Schutzmaßnahmen', title_en: 'Section 2 - Protective Measures', section_range: [6, 15] },
      { number: '3', title: '3. Abschnitt - Schlussbestimmungen', title_en: 'Section 3 - Final Provisions', section_range: [16, 30] },
    ],
    'LärmV': [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', section_range: [1, 5] },
      { number: '2', title: '2. Abschnitt - Lärm', title_en: 'Section 2 - Noise', section_range: [6, 50] },
      { number: '3', title: '3. Abschnitt - Vibrationen', title_en: 'Section 3 - Vibrations', section_range: [51, 100] },
      { number: '4', title: '4. Abschnitt - Schlussbestimmungen', title_en: 'Section 4 - Final Provisions', section_range: [101, 200] },
    ],
  },
  // DE structures based on official Inhaltsübersicht from gesetze-im-internet.de / buzer.de
  DE: {
    ArbSchG: [
      // Official: https://www.buzer.de/ArbSchG.htm
      { number: '1', title: '1. Abschnitt - Allgemeine Vorschriften', title_en: 'Section 1 - General Provisions', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Pflichten des Arbeitgebers', title_en: 'Section 2 - Employer Obligations', section_range: [3, 14] },
      { number: '3', title: '3. Abschnitt - Pflichten und Rechte der Beschäftigten', title_en: 'Section 3 - Obligations and Rights of Employees', section_range: [15, 17] },
      { number: '4', title: '4. Abschnitt - Verordnungsermächtigungen', title_en: 'Section 4 - Enabling Provisions', section_range: [18, 20] },
      { number: '5', title: '5. Abschnitt - Gemeinsame deutsche Arbeitsschutzstrategie', title_en: 'Section 5 - Joint German Occupational Safety Strategy', section_range: [20.01, 20.99] }, // §§ 20a-20b
      { number: '6', title: '6. Abschnitt - Schlussvorschriften', title_en: 'Section 6 - Final Provisions', section_range: [21, 26] },
    ],
    ASiG: [
      { number: '1', title: '1. Abschnitt - Allgemeine Vorschriften', title_en: 'Section 1 - General Provisions', section_range: [1, 1] },
      { number: '2', title: '2. Abschnitt - Betriebsärzte', title_en: 'Section 2 - Company Physicians', section_range: [2, 4] },
      { number: '3', title: '3. Abschnitt - Fachkräfte für Arbeitssicherheit', title_en: 'Section 3 - Safety Specialists', section_range: [5, 7] },
      { number: '4', title: '4. Abschnitt - Gemeinsame Vorschriften', title_en: 'Section 4 - Common Provisions', section_range: [8, 14] },
      { number: '5', title: '5. Abschnitt - Schlussvorschriften', title_en: 'Section 5 - Final Provisions', section_range: [15, 23] },
    ],
    ArbZG: [
      // Official: https://www.buzer.de/ArbZG.htm
      { number: '1', title: '1. Abschnitt - Allgemeine Vorschriften', title_en: 'Section 1 - General Provisions', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Werktägliche Arbeitszeit und arbeitsfreie Zeiten', title_en: 'Section 2 - Daily Working Time and Rest Periods', section_range: [3, 8] },
      { number: '3', title: '3. Abschnitt - Sonn- und Feiertagsruhe', title_en: 'Section 3 - Sunday and Holiday Rest', section_range: [9, 13] },
      { number: '4', title: '4. Abschnitt - Ausnahmen in besonderen Fällen', title_en: 'Section 4 - Exceptions in Special Cases', section_range: [14, 15] },
      { number: '5', title: '5. Abschnitt - Durchführung des Gesetzes', title_en: 'Section 5 - Implementation of the Act', section_range: [16, 17] },
      { number: '6', title: '6. Abschnitt - Sonderregelungen', title_en: 'Section 6 - Special Regulations', section_range: [18, 21.99] }, // §§ 18-21a
      { number: '7', title: '7. Abschnitt - Straf- und Bußgeldvorschriften', title_en: 'Section 7 - Penal and Fine Provisions', section_range: [22, 23] },
      { number: '8', title: '8. Abschnitt - Schlussvorschriften', title_en: 'Section 8 - Final Provisions', section_range: [24, 26] },
    ],
    JArbSchG: [
      // Official: https://www.buzer.de/JArbSchG.htm - has 5 Abschnitte, 3rd has 4 Titel inside
      { number: '1', title: '1. Abschnitt - Allgemeine Vorschriften', title_en: 'Section 1 - General Provisions', section_range: [1, 4] },
      { number: '2', title: '2. Abschnitt - Beschäftigung von Kindern', title_en: 'Section 2 - Employment of Children', section_range: [5, 7] },
      { number: '3', title: '3. Abschnitt - Beschäftigung Jugendlicher', title_en: 'Section 3 - Employment of Young Persons', section_range: [8, 46] }, // Contains 4 Titel: §§ 8-21b, 22-27, 28-31, 32-46
      { number: '4', title: '4. Abschnitt - Durchführung des Gesetzes', title_en: 'Section 4 - Implementation of the Act', section_range: [47, 60] },
      { number: '5', title: '5. Abschnitt - Schlussvorschriften', title_en: 'Section 5 - Final Provisions', section_range: [61, 72] },
    ],
    ArbStättV: [
      { number: '1', title: '1. Abschnitt - Ziel, Anwendungsbereich, Begriffsbestimmungen', title_en: 'Section 1 - Purpose, Scope, Definitions', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Übergreifende Anforderungen', title_en: 'Section 2 - General Requirements', section_range: [3, 4] },
      { number: '3', title: '3. Abschnitt - Besondere Anforderungen', title_en: 'Section 3 - Special Requirements', section_range: [5, 6] },
      { number: '4', title: '4. Abschnitt - Schlussvorschriften', title_en: 'Section 4 - Final Provisions', section_range: [7, 10] },
    ],
    BetrSichV: [
      { number: '1', title: '1. Abschnitt - Anwendungsbereich und Begriffsbestimmungen', title_en: 'Section 1 - Scope and Definitions', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Gefährdungsbeurteilung und Schutzmaßnahmen', title_en: 'Section 2 - Risk Assessment and Protective Measures', section_range: [3, 9] },
      { number: '3', title: '3. Abschnitt - Zusätzliche Vorschriften für überwachungsbedürftige Anlagen', title_en: 'Section 3 - Additional Provisions for Installations Subject to Monitoring', section_range: [10, 19] },
      { number: '4', title: '4. Abschnitt - Vollzugsregelungen und Schlussvorschriften', title_en: 'Section 4 - Implementation Rules and Final Provisions', section_range: [20, 24] },
    ],
    GefStoffV: [
      { number: '1', title: '1. Abschnitt - Zielsetzung, Anwendungsbereich und Begriffsbestimmungen', title_en: 'Section 1 - Purpose, Scope and Definitions', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Gefahrstoffinformation', title_en: 'Section 2 - Hazardous Substance Information', section_range: [3, 5] },
      { number: '3', title: '3. Abschnitt - Gefährdungsbeurteilung und Grundpflichten', title_en: 'Section 3 - Risk Assessment and Basic Obligations', section_range: [6, 7] },
      { number: '4', title: '4. Abschnitt - Schutzmaßnahmen', title_en: 'Section 4 - Protective Measures', section_range: [8, 15] },
      { number: '5', title: '5. Abschnitt - Verbote und Beschränkungen', title_en: 'Section 5 - Prohibitions and Restrictions', section_range: [16, 18] },
      { number: '6', title: '6. Abschnitt - Schlussvorschriften', title_en: 'Section 6 - Final Provisions', section_range: [19, 40] },
    ],
    MuSchG: [
      { number: '1', title: '1. Abschnitt - Allgemeine Vorschriften', title_en: 'Section 1 - General Provisions', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Gesundheitsschutz', title_en: 'Section 2 - Health Protection', section_range: [3, 16] },
      { number: '3', title: '3. Abschnitt - Kündigungsschutz', title_en: 'Section 3 - Dismissal Protection', section_range: [17, 17] },
      { number: '4', title: '4. Abschnitt - Leistungen', title_en: 'Section 4 - Benefits', section_range: [18, 25] },
      { number: '5', title: '5. Abschnitt - Durchführung des Gesetzes', title_en: 'Section 5 - Implementation of the Act', section_range: [26, 31] },
      { number: '6', title: '6. Abschnitt - Bußgeldvorschriften, Straftaten', title_en: 'Section 6 - Fines and Criminal Offences', section_range: [32, 34] },
    ],
    LärmVibrationsArbSchV: [
      { number: '1', title: '1. Abschnitt - Anwendungsbereich und Begriffsbestimmungen', title_en: 'Section 1 - Scope and Definitions', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Ermittlung und Bewertung', title_en: 'Section 2 - Determination and Assessment', section_range: [3, 5] },
      { number: '3', title: '3. Abschnitt - Schutzmaßnahmen', title_en: 'Section 3 - Protective Measures', section_range: [6, 11] },
      { number: '4', title: '4. Abschnitt - Schlussvorschriften', title_en: 'Section 4 - Final Provisions', section_range: [12, 20] },
    ],
    BioStoffV: [
      { number: '1', title: '1. Abschnitt - Anwendungsbereich und Begriffsbestimmungen', title_en: 'Section 1 - Scope and Definitions', section_range: [1, 3] },
      { number: '2', title: '2. Abschnitt - Gefährdungsbeurteilung, Grundpflichten und Schutzmaßnahmen', title_en: 'Section 2 - Risk Assessment, Basic Obligations and Protective Measures', section_range: [4, 10] },
      { number: '3', title: '3. Abschnitt - Besondere Schutzmaßnahmen', title_en: 'Section 3 - Special Protective Measures', section_range: [11, 16] },
      { number: '4', title: '4. Abschnitt - Schlussvorschriften', title_en: 'Section 4 - Final Provisions', section_range: [17, 25] },
    ],
    ArbMedVV: [
      { number: '1', title: '1. Abschnitt - Allgemeine Vorschriften', title_en: 'Section 1 - General Provisions', section_range: [1, 2] },
      { number: '2', title: '2. Abschnitt - Durchführung der arbeitsmedizinischen Vorsorge', title_en: 'Section 2 - Implementation of Occupational Health Care', section_range: [3, 7] },
      { number: '3', title: '3. Abschnitt - Schlussvorschriften', title_en: 'Section 3 - Final Provisions', section_range: [8, 15] },
    ],
    LastenhandhabV: [
      { number: '1', title: 'Verordnung - Lastenhandhabungsverordnung', title_en: 'Regulation - Manual Handling Regulation', section_range: [1, 30] },
    ],
  },
  NL: {
    Arbowet: [
      { number: '1', title: 'Hoofdstuk 1 - Definities en toepassingsgebied', title_en: 'Chapter 1 - Definitions and Scope', section_range: [1, 2] },
      { number: '2', title: 'Hoofdstuk 2 - Arbeidsomstandighedenbeleid', title_en: 'Chapter 2 - Working Conditions Policy', section_range: [3, 11] },
      { number: '3', title: 'Hoofdstuk 3 - Samenwerking, overleg, bijzondere rechten en deskundige bijstand', title_en: 'Chapter 3 - Cooperation, Consultation, Special Rights and Expert Assistance', section_range: [12, 15.5] },
      { number: '4', title: 'Hoofdstuk 4 - Bijzondere verplichtingen', title_en: 'Chapter 4 - Special Obligations', section_range: [16, 23] },
      { number: '5', title: 'Hoofdstuk 5 - Toezicht en ambtelijke bevelen', title_en: 'Chapter 5 - Supervision and Official Orders', section_range: [24, 29.99] },
      { number: '6', title: 'Hoofdstuk 6 - Vrijstellingen, ontheffingen en beroep', title_en: 'Chapter 6 - Exemptions, Dispensations and Appeals', section_range: [30, 31] },
      { number: '7', title: 'Hoofdstuk 7 - Sancties', title_en: 'Chapter 7 - Sanctions', section_range: [32, 43] },
      { number: '8', title: 'Hoofdstuk 8 - Overgangs- en slotbepalingen', title_en: 'Chapter 8 - Transitional and Final Provisions', section_range: [44, 100] },
    ],
    Arbeidstijdenwet: [
      { number: '1', title: 'Hoofdstuk 1 - Algemene bepalingen', title_en: 'Chapter 1 - General Provisions', section_range: [1, 1] },
      { number: '2', title: 'Hoofdstuk 2 - Definities', title_en: 'Chapter 2 - Definitions', section_range: [1, 1.99] },
      { number: '3', title: 'Hoofdstuk 3 - Toepassingsgebied en arbeidstijd', title_en: 'Chapter 3 - Scope and Working Time', section_range: [2, 5] },
      { number: '4', title: 'Hoofdstuk 4 - Rusttijd en pauze', title_en: 'Chapter 4 - Rest Time and Breaks', section_range: [5, 5.99] },
      { number: '5', title: 'Hoofdstuk 5 - Nachtarbeid', title_en: 'Chapter 5 - Night Work', section_range: [6, 6.99] },
      { number: '6', title: 'Hoofdstuk 6 - Zondagsarbeid', title_en: 'Chapter 6 - Sunday Work', section_range: [7, 7.99] },
      { number: '7', title: 'Hoofdstuk 7 - Nadere regels', title_en: 'Chapter 7 - Additional Rules', section_range: [8, 11] },
      { number: '8', title: 'Hoofdstuk 8 - Slotbepalingen', title_en: 'Chapter 8 - Final Provisions', section_range: [12, 20] },
    ],
    Arbobesluit: [
      { number: '1', title: 'Hoofdstuk 1 - Definities en toepassingsgebied', title_en: 'Chapter 1 - Definitions and Scope', section_range: [1, 1.99] },
      { number: '2', title: 'Hoofdstuk 2 - Arbozorg en organisatie van de arbeid', title_en: 'Chapter 2 - Occupational Safety and Work Organization', section_range: [2, 2.99] },
      { number: '3', title: 'Hoofdstuk 3 - Inrichting arbeidsplaatsen', title_en: 'Chapter 3 - Workplace Layout', section_range: [3, 3.99] },
      { number: '4', title: 'Hoofdstuk 4 - Gevaarlijke stoffen en biologische agentia', title_en: 'Chapter 4 - Hazardous Substances and Biological Agents', section_range: [4, 4.99] },
      { number: '5', title: 'Hoofdstuk 5 - Fysieke belasting', title_en: 'Chapter 5 - Physical Strain', section_range: [5, 5.99] },
      { number: '6', title: 'Hoofdstuk 6 - Fysische factoren', title_en: 'Chapter 6 - Physical Factors', section_range: [6, 6.99] },
      { number: '7', title: 'Hoofdstuk 7 - Arbeidsmiddelen en specifieke werkzaamheden', title_en: 'Chapter 7 - Work Equipment and Specific Activities', section_range: [7, 7.99] },
      { number: '8', title: 'Hoofdstuk 8 - Persoonlijke beschermingsmiddelen en veiligheids- en gezondheidssignalering', title_en: 'Chapter 8 - PPE and Safety/Health Signage', section_range: [8, 8.99] },
      { number: '9', title: 'Hoofdstuk 9 - Verplichtingen, strafbare feiten, bestuursrechtelijke bepalingen', title_en: 'Chapter 9 - Obligations, Criminal Offences, Administrative Provisions', section_range: [9, 100] },
    ],
  },
}

/**
 * Extract numeric value from section number for sorting/matching
 */
function getSectionNumber(section) {
  const num = section.number?.toString() || ''
  // Handle formats like "1", "1a", "10a", "Präambel"
  const match = num.match(/^(\d+)([a-z]?)$/i)
  if (match) {
    const base = parseFloat(match[1])
    const suffix = match[2]?.toLowerCase() || ''
    // Add small offset for letter suffixes
    const suffixOffset = suffix ? (suffix.charCodeAt(0) - 96) * 0.01 : 0
    return base + suffixOffset
  }
  // Handle special cases
  if (num === '0' || num.toLowerCase() === 'präambel') return 0
  return -1
}

/**
 * Reorganize sections into proper chapter structure
 */
function reorganizeIntoChapters(doc, structure, countryCode) {
  // Collect all sections from existing chapters
  const allSections = []
  if (doc.chapters && Array.isArray(doc.chapters)) {
    for (const chapter of doc.chapters) {
      if (chapter.sections && Array.isArray(chapter.sections)) {
        allSections.push(...chapter.sections)
      }
    }
  }

  if (allSections.length === 0) {
    logWarning(`  No sections found in ${doc.abbreviation}`)
    return doc.chapters || []
  }

  const abbrevLower = doc.abbreviation.toLowerCase()
  const newChapters = []

  for (const chapterDef of structure) {
    const [start, end] = chapterDef.section_range
    const chapterSections = allSections.filter(s => {
      const num = getSectionNumber(s)
      return num >= start && num <= end
    })

    if (chapterSections.length > 0) {
      newChapters.push({
        id: `${countryCode.toLowerCase()}-${abbrevLower}-ch${chapterDef.number}`,
        number: chapterDef.number,
        title: chapterDef.title,
        title_en: chapterDef.title_en || '',
        sections: chapterSections,
      })
    }
  }

  // Check for orphan sections (sections that don't fit any chapter)
  const assignedSections = new Set()
  for (const ch of newChapters) {
    for (const s of ch.sections) {
      assignedSections.add(s.number)
    }
  }
  const orphans = allSections.filter(s => !assignedSections.has(s.number))
  if (orphans.length > 0) {
    logWarning(`  ${orphans.length} orphan sections in ${doc.abbreviation}: ${orphans.map(s => s.number).join(', ')}`)
    // Add orphans to a final "Other" chapter
    if (orphans.length > 0) {
      newChapters.push({
        id: `${countryCode.toLowerCase()}-${abbrevLower}-other`,
        number: 'X',
        title: 'Sonstige Bestimmungen',
        title_en: 'Other Provisions',
        sections: orphans,
      })
    }
  }

  return newChapters.length > 0 ? newChapters : doc.chapters
}

/**
 * Process a single country's database
 */
function processCountry(countryCode) {
  const dbPath = path.join(__dirname, `../eu_safety_laws/${countryCode.toLowerCase()}/${countryCode.toLowerCase()}_database.json`)

  if (!fs.existsSync(dbPath)) {
    logError(`Database not found: ${dbPath}`)
    return false
  }

  logInfo(`Processing ${countryCode} database...`)

  // Read database
  let database
  try {
    const content = fs.readFileSync(dbPath, 'utf-8')
    database = JSON.parse(content)
  } catch (error) {
    logError(`Failed to read database: ${error.message}`)
    return false
  }

  // Create backup
  const backupPath = dbPath.replace('.json', '_chapters_backup.json')
  try {
    fs.writeFileSync(backupPath, JSON.stringify(database, null, 2))
    logSuccess(`Backup created: ${backupPath}`)
  } catch (error) {
    logWarning(`Failed to create backup: ${error.message}`)
  }

  const structures = LAW_STRUCTURES[countryCode] || {}
  let updatedCount = 0

  // Process each document
  for (const doc of database.documents || []) {
    const abbrev = doc.abbreviation
    const structure = structures[abbrev]

    if (structure) {
      const originalChapterCount = doc.chapters?.length || 0
      doc.chapters = reorganizeIntoChapters(doc, structure, countryCode)
      const newChapterCount = doc.chapters.length

      if (newChapterCount !== originalChapterCount || originalChapterCount === 1) {
        logSuccess(`  ${abbrev}: ${originalChapterCount} → ${newChapterCount} chapters`)
        updatedCount++
      }
    } else {
      log(`  ${abbrev}: No structure defined, keeping as-is`, 'yellow')
    }
  }

  // Save updated database
  try {
    database.metadata = {
      ...database.metadata,
      chapters_reorganized_at: new Date().toISOString(),
    }
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2))
    logSuccess(`Saved ${countryCode} database with ${updatedCount} laws reorganized`)
  } catch (error) {
    logError(`Failed to save database: ${error.message}`)
    return false
  }

  return true
}

// Main
const args = process.argv.slice(2)
const target = args[0]?.toLowerCase() || 'all'

console.log('\n' + '='.repeat(60))
log('Law Chapter Reorganization Script', 'blue')
console.log('='.repeat(60) + '\n')

if (target === 'all' || target === 'at') {
  processCountry('AT')
}
if (target === 'all' || target === 'nl') {
  processCountry('NL')
}
if (target === 'all' || target === 'de') {
  processCountry('DE')
}

console.log('\n' + '='.repeat(60))
log('Done!', 'green')
console.log('='.repeat(60) + '\n')

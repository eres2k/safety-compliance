#!/usr/bin/env node
/**
 * Reorganize chapter structures (Abschnitte/Hoofdstukken) for EU safety laws
 *
 * This script applies official chapter structures from legal sources to the law databases.
 * Sources:
 * - AT: ris.bka.gv.at (Austrian Legal Information System)
 * - DE: buzer.de (German Law Database)
 * - NL: wetten.overheid.nl (Dutch Government Legislation)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// =============================================================================
// AUSTRIA (AT) - Official chapter structures from ris.bka.gv.at
// =============================================================================

const AT_CHAPTER_STRUCTURES = {
  'ASchG': {
    // ArbeitnehmerInnenschutzgesetz - 10 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 18] },
      { number: '2', title: '2. Abschnitt - Arbeitsstätten und Baustellen', title_en: 'Section 2 - Workplaces and Construction Sites', sectionRange: [19, 32] },
      { number: '3', title: '3. Abschnitt - Arbeitsmittel', title_en: 'Section 3 - Work Equipment', sectionRange: [33, 39] },
      { number: '4', title: '4. Abschnitt - Arbeitsstoffe', title_en: 'Section 4 - Work Substances', sectionRange: [40, 48] },
      { number: '5', title: '5. Abschnitt - Gesundheitsüberwachung', title_en: 'Section 5 - Health Surveillance', sectionRange: [49, 59] },
      { number: '6', title: '6. Abschnitt - Arbeitsvorgänge und Arbeitsplätze', title_en: 'Section 6 - Work Processes and Workplaces', sectionRange: [60, 72] },
      { number: '7', title: '7. Abschnitt - Präventivdienste', title_en: 'Section 7 - Preventive Services', sectionRange: [73, 90] },
      { number: '8', title: '8. Abschnitt - Behörden und Verfahren', title_en: 'Section 8 - Authorities and Procedures', sectionRange: [91, 101] },
      { number: '9', title: '9. Abschnitt - Übergangsrecht und Aufhebung', title_en: 'Section 9 - Transitional Law and Repeal', sectionRange: [102, 127] },
      { number: '10', title: '10. Abschnitt - Schlussbestimmungen', title_en: 'Section 10 - Final Provisions', sectionRange: [128, 132] },
    ]
  },
  'KJBG': {
    // Kinder- und Jugendlichen-Beschäftigungsgesetz - 8 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 3] },
      { number: '2', title: '2. Abschnitt - Beschäftigungsverbote und -beschränkungen', title_en: 'Section 2 - Employment Prohibitions and Restrictions', sectionRange: [4, 6] },
      { number: '3', title: '3. Abschnitt - Arbeits- und Ruhezeit', title_en: 'Section 3 - Working and Rest Time', sectionRange: [7, 11] },
      { number: '4', title: '4. Abschnitt - Überstunden und Ausnahmen', title_en: 'Section 4 - Overtime and Exceptions', sectionRange: [12, 17] },
      { number: '5', title: '5. Abschnitt - Nachtarbeit', title_en: 'Section 5 - Night Work', sectionRange: [18, 21] },
      { number: '6', title: '6. Abschnitt - Urlaub', title_en: 'Section 6 - Leave', sectionRange: [22, 22] },
      { number: '7', title: '7. Abschnitt - Strafbestimmungen', title_en: 'Section 7 - Penal Provisions', sectionRange: [23, 30] },
      { number: '8', title: '8. Abschnitt - Schluss- und Übergangsbestimmungen', title_en: 'Section 8 - Final and Transitional Provisions', sectionRange: [31, 43] },
    ]
  },
  'AZG': {
    // Arbeitszeitgesetz - 7 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Geltungsbereich', title_en: 'Section 1 - Scope', sectionRange: [1, 2] },
      { number: '2', title: '2. Abschnitt - Normalarbeitszeit', title_en: 'Section 2 - Normal Working Time', sectionRange: [3, 9] },
      { number: '3', title: '3. Abschnitt - Überstundenarbeit', title_en: 'Section 3 - Overtime Work', sectionRange: [10, 11] },
      { number: '4', title: '4. Abschnitt - Ruhezeiten', title_en: 'Section 4 - Rest Periods', sectionRange: [12, 14] },
      { number: '5', title: '5. Abschnitt - Nacht- und Schichtarbeit', title_en: 'Section 5 - Night and Shift Work', sectionRange: [15, 19] },
      { number: '6', title: '6. Abschnitt - Sonderbestimmungen', title_en: 'Section 6 - Special Provisions', sectionRange: [20, 28] },
      { number: '7', title: '7. Abschnitt - Schlussbestimmungen', title_en: 'Section 7 - Final Provisions', sectionRange: [29, 36] },
    ]
  },
  'MSchG': {
    // Mutterschutzgesetz - 8 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 2] },
      { number: '2', title: '2. Abschnitt - Beschäftigungsverbote', title_en: 'Section 2 - Employment Prohibitions', sectionRange: [3, 5] },
      { number: '3', title: '3. Abschnitt - Beschäftigungsbeschränkungen', title_en: 'Section 3 - Employment Restrictions', sectionRange: [6, 10] },
      { number: '4', title: '4. Abschnitt - Kündigungs- und Entlassungsschutz', title_en: 'Section 4 - Dismissal Protection', sectionRange: [11, 15] },
      { number: '5', title: '5. Abschnitt - Karenz und Teilzeitbeschäftigung', title_en: 'Section 5 - Parental Leave and Part-time Employment', sectionRange: [16, 22] },
      { number: '6', title: '6. Abschnitt - Entgelt und Sozialversicherung', title_en: 'Section 6 - Pay and Social Security', sectionRange: [23, 27] },
      { number: '7', title: '7. Abschnitt - Strafbestimmungen', title_en: 'Section 7 - Penal Provisions', sectionRange: [28, 32] },
      { number: '8', title: '8. Abschnitt - Schlussbestimmungen', title_en: 'Section 8 - Final Provisions', sectionRange: [33, 35] },
    ]
  },
  'AStV': {
    // Arbeitsstättenverordnung - 6 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 3] },
      { number: '2', title: '2. Abschnitt - Anforderungen an Arbeitsstätten', title_en: 'Section 2 - Requirements for Workplaces', sectionRange: [4, 20] },
      { number: '3', title: '3. Abschnitt - Anforderungen an Arbeitsräume', title_en: 'Section 3 - Requirements for Work Rooms', sectionRange: [21, 28] },
      { number: '4', title: '4. Abschnitt - Sanitäre Anlagen und Aufenthaltsräume', title_en: 'Section 4 - Sanitary Facilities and Break Rooms', sectionRange: [29, 40] },
      { number: '5', title: '5. Abschnitt - Brandschutz und Erste Hilfe', title_en: 'Section 5 - Fire Protection and First Aid', sectionRange: [41, 50] },
      { number: '6', title: '6. Abschnitt - Schlussbestimmungen', title_en: 'Section 6 - Final Provisions', sectionRange: [51, 55] },
    ]
  },
  'AM-VO': {
    // Arbeitsmittelverordnung - 6 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 5] },
      { number: '2', title: '2. Abschnitt - Anforderungen an Arbeitsmittel', title_en: 'Section 2 - Requirements for Work Equipment', sectionRange: [6, 15] },
      { number: '3', title: '3. Abschnitt - Benutzung von Arbeitsmitteln', title_en: 'Section 3 - Use of Work Equipment', sectionRange: [16, 25] },
      { number: '4', title: '4. Abschnitt - Prüfung und Wartung', title_en: 'Section 4 - Testing and Maintenance', sectionRange: [26, 35] },
      { number: '5', title: '5. Abschnitt - Besondere Arbeitsmittel', title_en: 'Section 5 - Special Work Equipment', sectionRange: [36, 50] },
      { number: '6', title: '6. Abschnitt - Schlussbestimmungen', title_en: 'Section 6 - Final Provisions', sectionRange: [51, 60] },
    ]
  },
  'BauV': {
    // Bauarbeiterschutzverordnung - 8 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 5] },
      { number: '2', title: '2. Abschnitt - Baustelleneinrichtung', title_en: 'Section 2 - Construction Site Equipment', sectionRange: [6, 20] },
      { number: '3', title: '3. Abschnitt - Absturzsicherung', title_en: 'Section 3 - Fall Protection', sectionRange: [21, 40] },
      { number: '4', title: '4. Abschnitt - Gerüste', title_en: 'Section 4 - Scaffolding', sectionRange: [41, 80] },
      { number: '5', title: '5. Abschnitt - Erd- und Felsarbeiten', title_en: 'Section 5 - Earth and Rock Work', sectionRange: [81, 100] },
      { number: '6', title: '6. Abschnitt - Abbrucharbeiten', title_en: 'Section 6 - Demolition Work', sectionRange: [101, 120] },
      { number: '7', title: '7. Abschnitt - Besondere Bauarbeiten', title_en: 'Section 7 - Special Construction Work', sectionRange: [121, 150] },
      { number: '8', title: '8. Abschnitt - Schlussbestimmungen', title_en: 'Section 8 - Final Provisions', sectionRange: [151, 170] },
    ]
  },
  'BS-V': {
    // Bildschirmarbeitsverordnung - 6 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 2] },
      { number: '2', title: '2. Abschnitt - Anforderungen an Bildschirmarbeitsplätze', title_en: 'Section 2 - Requirements for Display Screen Workstations', sectionRange: [3, 5] },
      { number: '3', title: '3. Abschnitt - Anforderungen an die Bildschirmarbeit', title_en: 'Section 3 - Requirements for Display Screen Work', sectionRange: [6, 8] },
      { number: '4', title: '4. Abschnitt - Unterbrechungen und Untersuchungen', title_en: 'Section 4 - Breaks and Examinations', sectionRange: [9, 11] },
      { number: '5', title: '5. Abschnitt - Information und Unterweisung', title_en: 'Section 5 - Information and Instruction', sectionRange: [12, 14] },
      { number: '6', title: '6. Abschnitt - Schlussbestimmungen', title_en: 'Section 6 - Final Provisions', sectionRange: [15, 18] },
    ]
  },
  'PSA-V': {
    // Verordnung Persönliche Schutzausrüstung - 2 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 10] },
      { number: '2', title: '2. Abschnitt - Schlussbestimmungen', title_en: 'Section 2 - Final Provisions', sectionRange: [11, 15] },
    ]
  },
  'ESV 2012': {
    // Elektroschutzverordnung 2012 - 4 Abschnitte
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 3] },
      { number: '2', title: '2. Abschnitt - Sicherheitsmaßnahmen', title_en: 'Section 2 - Safety Measures', sectionRange: [4, 10] },
      { number: '3', title: '3. Abschnitt - Prüfungen und Qualifikationen', title_en: 'Section 3 - Tests and Qualifications', sectionRange: [11, 18] },
      { number: '4', title: '4. Abschnitt - Schlussbestimmungen', title_en: 'Section 4 - Final Provisions', sectionRange: [19, 22] },
    ]
  },
  'LärmV': {
    // Lärmverordnung - 5 Abschnitte (Verordnung über den Schutz der Arbeitnehmer/innen vor der Gefährdung durch Lärm und Vibrationen)
    source: 'ris.bka.gv.at',
    chapters: [
      { number: '1', title: '1. Abschnitt - Allgemeine Bestimmungen', title_en: 'Section 1 - General Provisions', sectionRange: [1, 2] },
      { number: '2', title: '2. Abschnitt - Lärm', title_en: 'Section 2 - Noise', sectionRange: [3, 7] },
      { number: '3', title: '3. Abschnitt - Vibrationen', title_en: 'Section 3 - Vibrations', sectionRange: [8, 12] },
      { number: '4', title: '4. Abschnitt - Gemeinsame Bestimmungen', title_en: 'Section 4 - Common Provisions', sectionRange: [13, 16] },
      { number: '5', title: '5. Abschnitt - Schlussbestimmungen', title_en: 'Section 5 - Final Provisions', sectionRange: [17, 20] },
    ]
  },
}

// =============================================================================
// GERMANY (DE) - Official chapter structures from buzer.de
// =============================================================================

const DE_CHAPTER_STRUCTURES = {
  'ArbSchG': {
    // Arbeitsschutzgesetz - 6 Abschnitte (includes §§20a-20b as 5th section)
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Allgemeine Vorschriften', title_en: 'First Section - General Provisions', sectionRange: [1, 2] },
      { number: '2', title: 'Zweiter Abschnitt - Pflichten des Arbeitgebers', title_en: 'Second Section - Employer Obligations', sectionRange: [3, 14] },
      { number: '3', title: 'Dritter Abschnitt - Pflichten und Rechte der Beschäftigten', title_en: 'Third Section - Duties and Rights of Employees', sectionRange: [15, 17] },
      { number: '4', title: 'Vierter Abschnitt - Verordnungsermächtigungen', title_en: 'Fourth Section - Authorization for Ordinances', sectionRange: [18, 20] },
      { number: '5', title: 'Fünfter Abschnitt - Gemeinsame deutsche Arbeitsschutzstrategie', title_en: 'Fifth Section - Common German Occupational Safety Strategy', sections: ['20a', '20b'] },
      { number: '6', title: 'Sechster Abschnitt - Schlußvorschriften', title_en: 'Sixth Section - Final Provisions', sectionRange: [21, 26] },
    ]
  },
  'ASiG': {
    // Arbeitssicherheitsgesetz - 5 Abschnitte
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Allgemeine Vorschriften', title_en: 'First Section - General Provisions', sectionRange: [1, 1] },
      { number: '2', title: 'Zweiter Abschnitt - Betriebsärzte', title_en: 'Second Section - Company Physicians', sectionRange: [2, 4] },
      { number: '3', title: 'Dritter Abschnitt - Fachkräfte für Arbeitssicherheit', title_en: 'Third Section - Occupational Safety Specialists', sectionRange: [5, 7] },
      { number: '4', title: 'Vierter Abschnitt - Gemeinsame Vorschriften', title_en: 'Fourth Section - Common Provisions', sectionRange: [8, 19] },
      { number: '5', title: 'Fünfter Abschnitt - Schlußvorschriften', title_en: 'Fifth Section - Final Provisions', sectionRange: [20, 21] },
    ]
  },
  'ArbZG': {
    // Arbeitszeitgesetz - 8 Abschnitte (corrected paragraph ranges)
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Allgemeine Vorschriften', title_en: 'First Section - General Provisions', sectionRange: [1, 2] },
      { number: '2', title: 'Zweiter Abschnitt - Werktägliche Arbeitszeit und arbeitsfreie Zeiten', title_en: 'Second Section - Daily Working Time and Rest Periods', sectionRange: [3, 8] },
      { number: '3', title: 'Dritter Abschnitt - Sonn- und Feiertagsruhe', title_en: 'Third Section - Sunday and Holiday Rest', sectionRange: [9, 13] },
      { number: '4', title: 'Vierter Abschnitt - Ausnahmen in besonderen Fällen', title_en: 'Fourth Section - Exceptions in Special Cases', sectionRange: [14, 15] },
      { number: '5', title: 'Fünfter Abschnitt - Durchführung des Gesetzes', title_en: 'Fifth Section - Implementation of the Act', sectionRange: [16, 17] },
      { number: '6', title: 'Sechster Abschnitt - Sonderregelungen', title_en: 'Sixth Section - Special Regulations', sections: ['18', '19', '20', '21', '21a'] },
      { number: '7', title: 'Siebter Abschnitt - Straf- und Bußgeldvorschriften', title_en: 'Seventh Section - Criminal and Penalty Provisions', sectionRange: [22, 23] },
      { number: '8', title: 'Achter Abschnitt - Schlußvorschriften', title_en: 'Eighth Section - Final Provisions', sectionRange: [24, 26] },
    ]
  },
  'JArbSchG': {
    // Jugendarbeitsschutzgesetz - 5 Abschnitte (3rd section contains 4 Titel internally)
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Allgemeines', title_en: 'First Section - General', sectionRange: [1, 4] },
      { number: '2', title: 'Zweiter Abschnitt - Beschäftigung von Kindern', title_en: 'Second Section - Employment of Children', sectionRange: [5, 7] },
      { number: '3', title: 'Dritter Abschnitt - Beschäftigung Jugendlicher', title_en: 'Third Section - Employment of Young People', sectionRange: [8, 46] },
      { number: '4', title: 'Vierter Abschnitt - Durchführung des Gesetzes', title_en: 'Fourth Section - Implementation', sectionRange: [47, 58] },
      { number: '5', title: 'Fünfter Abschnitt - Straf- und Bußgeldvorschriften, Schlußvorschriften', title_en: 'Fifth Section - Criminal and Penalty Provisions, Final Provisions', sectionRange: [59, 75] },
    ]
  },
  'ArbStättV': {
    // Arbeitsstättenverordnung - 4 Abschnitte
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Allgemeine Vorschriften', title_en: 'First Section - General Provisions', sectionRange: [1, 2] },
      { number: '2', title: 'Zweiter Abschnitt - Pflichten des Arbeitgebers', title_en: 'Second Section - Employer Obligations', sectionRange: [3, 6] },
      { number: '3', title: 'Dritter Abschnitt - Besondere Anforderungen', title_en: 'Third Section - Special Requirements', sectionRange: [7, 8] },
      { number: '4', title: 'Vierter Abschnitt - Schlußvorschriften', title_en: 'Fourth Section - Final Provisions', sectionRange: [9, 11] },
    ]
  },
  'BetrSichV': {
    // Betriebssicherheitsverordnung - 4 Abschnitte
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Anwendungsbereich und Begriffsbestimmungen', title_en: 'First Section - Scope and Definitions', sectionRange: [1, 2] },
      { number: '2', title: 'Zweiter Abschnitt - Gefährdungsbeurteilung und Schutzmaßnahmen', title_en: 'Second Section - Risk Assessment and Protective Measures', sectionRange: [3, 13] },
      { number: '3', title: 'Dritter Abschnitt - Zusätzliche Vorschriften für überwachungsbedürftige Anlagen', title_en: 'Third Section - Additional Requirements for Installations Subject to Monitoring', sectionRange: [14, 20] },
      { number: '4', title: 'Vierter Abschnitt - Vollzugsregelungen und Schlußvorschriften', title_en: 'Fourth Section - Enforcement and Final Provisions', sectionRange: [21, 24] },
    ]
  },
  'GefStoffV': {
    // Gefahrstoffverordnung - 7 Abschnitte
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Zielsetzung, Anwendungsbereich und Begriffsbestimmungen', title_en: 'First Section - Objectives, Scope and Definitions', sectionRange: [1, 2] },
      { number: '2', title: 'Zweiter Abschnitt - Gefahrstoffinformation', title_en: 'Second Section - Hazardous Substance Information', sectionRange: [3, 5] },
      { number: '3', title: 'Dritter Abschnitt - Gefährdungsbeurteilung und Grundpflichten', title_en: 'Third Section - Risk Assessment and Basic Obligations', sectionRange: [6, 7] },
      { number: '4', title: 'Vierter Abschnitt - Schutzmaßnahmen', title_en: 'Fourth Section - Protective Measures', sectionRange: [8, 13] },
      { number: '5', title: 'Fünfter Abschnitt - Verbote und Beschränkungen', title_en: 'Fifth Section - Prohibitions and Restrictions', sectionRange: [14, 17] },
      { number: '6', title: 'Sechster Abschnitt - Vollzugsregelungen und Ausschuss für Gefahrstoffe', title_en: 'Sixth Section - Enforcement and Committee for Hazardous Substances', sectionRange: [18, 20] },
      { number: '7', title: 'Siebter Abschnitt - Ordnungswidrigkeiten und Straftaten', title_en: 'Seventh Section - Administrative Offenses and Criminal Offenses', sectionRange: [21, 25] },
    ]
  },
  'MuSchG': {
    // Mutterschutzgesetz - 6 Abschnitte
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Allgemeine Vorschriften', title_en: 'First Section - General Provisions', sectionRange: [1, 2] },
      { number: '2', title: 'Zweiter Abschnitt - Gesundheitsschutz', title_en: 'Second Section - Health Protection', sectionRange: [3, 16] },
      { number: '3', title: 'Dritter Abschnitt - Kündigungsschutz', title_en: 'Third Section - Dismissal Protection', sectionRange: [17, 17] },
      { number: '4', title: 'Vierter Abschnitt - Leistungen', title_en: 'Fourth Section - Benefits', sectionRange: [18, 25] },
      { number: '5', title: 'Fünfter Abschnitt - Durchführung des Gesetzes', title_en: 'Fifth Section - Implementation', sectionRange: [26, 31] },
      { number: '6', title: 'Sechster Abschnitt - Bußgeldvorschriften, Strafvorschriften', title_en: 'Sixth Section - Penalty and Criminal Provisions', sectionRange: [32, 34] },
    ]
  },
  'LärmVibrationsArbSchV': {
    // Lärm- und Vibrations-Arbeitsschutzverordnung - 4 Abschnitte
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Anwendungsbereich und Begriffsbestimmungen', title_en: 'First Section - Scope and Definitions', sectionRange: [1, 2] },
      { number: '2', title: 'Zweiter Abschnitt - Ermittlung und Bewertung der Gefährdung; Messungen', title_en: 'Second Section - Hazard Assessment and Measurements', sectionRange: [3, 4] },
      { number: '3', title: 'Dritter Abschnitt - Schutzmaßnahmen', title_en: 'Third Section - Protective Measures', sectionRange: [5, 12] },
      { number: '4', title: 'Vierter Abschnitt - Unterweisung und allgemeine Pflichten', title_en: 'Fourth Section - Instruction and General Duties', sectionRange: [13, 18] },
    ]
  },
  'BioStoffV': {
    // Biostoffverordnung - 4 Abschnitte
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Anwendungsbereich und Begriffsbestimmungen', title_en: 'First Section - Scope and Definitions', sectionRange: [1, 2] },
      { number: '2', title: 'Zweiter Abschnitt - Gefährdungsbeurteilung und Schutzmaßnahmen', title_en: 'Second Section - Risk Assessment and Protective Measures', sectionRange: [3, 14] },
      { number: '3', title: 'Dritter Abschnitt - Zusätzliche Vorschriften', title_en: 'Third Section - Additional Provisions', sectionRange: [15, 17] },
      { number: '4', title: 'Vierter Abschnitt - Vollzugsregelungen und Schlußvorschriften', title_en: 'Fourth Section - Enforcement and Final Provisions', sectionRange: [18, 21] },
    ]
  },
  'ArbMedVV': {
    // Verordnung zur arbeitsmedizinischen Vorsorge - 3 Abschnitte
    source: 'buzer.de',
    chapters: [
      { number: '1', title: 'Erster Abschnitt - Allgemeine Vorschriften', title_en: 'First Section - General Provisions', sectionRange: [1, 2] },
      { number: '2', title: 'Zweiter Abschnitt - Arbeitsmedizinische Vorsorge', title_en: 'Second Section - Occupational Medical Care', sectionRange: [3, 7] },
      { number: '3', title: 'Dritter Abschnitt - Schlußvorschriften', title_en: 'Third Section - Final Provisions', sectionRange: [8, 11] },
    ]
  },
}

// =============================================================================
// NETHERLANDS (NL) - Official chapter structures from wetten.overheid.nl
// =============================================================================

const NL_CHAPTER_STRUCTURES = {
  'Arbowet': {
    // Arbeidsomstandighedenwet - 8 Hoofdstukken
    source: 'wetten.overheid.nl',
    chapters: [
      { number: '1', title: 'Hoofdstuk 1 - Definities en toepassingsgebied', title_en: 'Chapter 1 - Definitions and Scope', sectionRange: [1, 2] },
      { number: '2', title: 'Hoofdstuk 2 - Arbeidsomstandighedenbeleid', title_en: 'Chapter 2 - Working Conditions Policy', sectionRange: [3, 11] },
      { number: '3', title: 'Hoofdstuk 3 - Samenwerking, overleg, bijzondere rechten en deskundige bijstand', title_en: 'Chapter 3 - Cooperation, Consultation, Special Rights and Expert Assistance', sectionRange: [12, 15] },
      { number: '4', title: 'Hoofdstuk 4 - Bijzondere verplichtingen', title_en: 'Chapter 4 - Special Obligations', sectionRange: [16, 23] },
      { number: '5', title: 'Hoofdstuk 5 - Toezicht en ambtelijke bevelen', title_en: 'Chapter 5 - Supervision and Official Orders', sectionRange: [24, 29] },
      { number: '6', title: 'Hoofdstuk 6 - Vrijstellingen, ontheffingen en beroep', title_en: 'Chapter 6 - Exemptions, Dispensations and Appeals', sectionRange: [30, 31] },
      { number: '7', title: 'Hoofdstuk 7 - Sancties', title_en: 'Chapter 7 - Sanctions', sectionRange: [32, 43] },
      { number: '8', title: 'Hoofdstuk 8 - Overgangs- en slotbepalingen', title_en: 'Chapter 8 - Transitional and Final Provisions', sectionRange: [44, 100] },
    ]
  },
  'Arbobesluit': {
    // Arbeidsomstandighedenbesluit - 9 Hoofdstukken
    source: 'wetten.overheid.nl',
    chapters: [
      { number: '1', title: 'Hoofdstuk 1 - Definities en toepassingsgebied', title_en: 'Chapter 1 - Definitions and Scope', sectionRange: [1, 1] },
      { number: '2', title: 'Hoofdstuk 2 - Arbozorg en organisatie van de arbeid', title_en: 'Chapter 2 - Working Conditions Care and Work Organization', sectionRange: [2, 2] },
      { number: '3', title: 'Hoofdstuk 3 - Inrichting arbeidsplaatsen', title_en: 'Chapter 3 - Workplace Design', sectionRange: [3, 3] },
      { number: '4', title: 'Hoofdstuk 4 - Gevaarlijke stoffen en biologische agentia', title_en: 'Chapter 4 - Hazardous Substances and Biological Agents', sectionRange: [4, 4] },
      { number: '5', title: 'Hoofdstuk 5 - Fysische factoren', title_en: 'Chapter 5 - Physical Factors', sectionRange: [5, 5] },
      { number: '6', title: 'Hoofdstuk 6 - Arbeidsmiddelen en specifieke werkzaamheden', title_en: 'Chapter 6 - Work Equipment and Specific Work', sectionRange: [6, 7] },
      { number: '7', title: 'Hoofdstuk 7 - Bijzondere sectoren en bijzondere categorieën werknemers', title_en: 'Chapter 7 - Special Sectors and Categories of Workers', sectionRange: [8, 8] },
      { number: '8', title: 'Hoofdstuk 8 - Aanvullende voorschriften', title_en: 'Chapter 8 - Additional Regulations', sectionRange: [9, 9] },
      { number: '9', title: 'Hoofdstuk 9 - Overgangs- en slotbepalingen', title_en: 'Chapter 9 - Transitional and Final Provisions', sectionRange: [10, 15] },
    ]
  },
  'Arbeidstijdenwet': {
    // Arbeidstijdenwet - 8 Hoofdstukken
    source: 'wetten.overheid.nl',
    chapters: [
      { number: '1', title: 'Hoofdstuk 1 - Algemene bepalingen', title_en: 'Chapter 1 - General Provisions', sectionRange: [1, 1] },
      { number: '2', title: 'Hoofdstuk 2 - Toepasselijkheid', title_en: 'Chapter 2 - Applicability', sectionRange: [2, 2] },
      { number: '3', title: 'Hoofdstuk 3 - Arbeids- en rusttijden', title_en: 'Chapter 3 - Working and Rest Time', sectionRange: [3, 5] },
      { number: '4', title: 'Hoofdstuk 4 - Arbeidstijd en rusttijd in bijzondere omstandigheden', title_en: 'Chapter 4 - Working and Rest Time in Special Circumstances', sectionRange: [6, 6] },
      { number: '5', title: 'Hoofdstuk 5 - Toezicht en opsporing', title_en: 'Chapter 5 - Supervision and Detection', sectionRange: [7, 8] },
      { number: '6', title: 'Hoofdstuk 6 - Ontheffingen', title_en: 'Chapter 6 - Exemptions', sectionRange: [9, 9] },
      { number: '7', title: 'Hoofdstuk 7 - Sanctiebepalingen', title_en: 'Chapter 7 - Penalty Provisions', sectionRange: [10, 11] },
      { number: '8', title: 'Hoofdstuk 8 - Slotbepalingen', title_en: 'Chapter 8 - Final Provisions', sectionRange: [12, 15] },
    ]
  },
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract numeric section number from various formats
 */
function extractSectionNumber(sectionId) {
  if (!sectionId) return null
  const str = String(sectionId)
  // Handle formats like "§ 1", "Artikel 1", "Art. 1", just "1", "1a", "20a"
  const match = str.match(/(?:§|Artikel|Art\.?)\s*(\d+[a-z]?)|^(\d+[a-z]?)$/i)
  if (match) {
    return match[1] || match[2]
  }
  return null
}

/**
 * Check if a section number falls within a chapter's range or explicit list
 */
function sectionBelongsToChapter(sectionNum, chapter) {
  if (!sectionNum) return false

  // Check explicit sections list first
  if (chapter.sections) {
    return chapter.sections.includes(sectionNum)
  }

  // Check range
  if (chapter.sectionRange) {
    const [start, end] = chapter.sectionRange
    // Extract base number for comparison (e.g., "20a" -> 20)
    const baseNum = parseInt(sectionNum.replace(/[a-z]/gi, ''))
    const hasSuffix = /[a-z]/i.test(sectionNum)

    if (isNaN(baseNum)) return false

    // If section has a letter suffix (like 20a), include it if base is within range
    if (hasSuffix) {
      return baseNum >= start && baseNum <= end
    }

    return baseNum >= start && baseNum <= end
  }

  return false
}

/**
 * Reorganize a document's sections into proper chapter structure
 */
function reorganizeDocument(doc, structures) {
  const structure = structures[doc.abbreviation]
  if (!structure) {
    return null
  }

  // Get all existing sections from the document
  const existingSections = []
  if (doc.chapters) {
    for (const chapter of doc.chapters) {
      if (chapter.sections) {
        existingSections.push(...chapter.sections)
      }
    }
  }

  if (existingSections.length === 0) {
    console.log(`    ⚠ No sections found in ${doc.abbreviation}`)
    return null
  }

  console.log(`    Found ${existingSections.length} sections in ${doc.abbreviation}`)

  // Create new chapter structure
  const newChapters = []
  const assignedSections = new Set()

  for (const chapterDef of structure.chapters) {
    const chapterSections = existingSections.filter(section => {
      const sectionNum = extractSectionNumber(section.number) || extractSectionNumber(section.title)
      if (!sectionNum) return false

      if (assignedSections.has(section.id)) return false

      if (sectionBelongsToChapter(sectionNum, chapterDef)) {
        assignedSections.add(section.id)
        return true
      }
      return false
    })

    if (chapterSections.length > 0) {
      newChapters.push({
        id: `${doc.jurisdiction.toLowerCase()}-${doc.abbreviation.toLowerCase().replace(/\s+/g, '-')}-ch${chapterDef.number}`,
        number: chapterDef.number,
        title: chapterDef.title,
        title_en: chapterDef.title_en,
        sections: chapterSections,
      })
    }
  }

  // Add any unassigned sections to a final "Other" chapter
  const unassignedSections = existingSections.filter(s => !assignedSections.has(s.id))
  if (unassignedSections.length > 0) {
    console.log(`    ⚠ ${unassignedSections.length} unassigned sections in ${doc.abbreviation}`)
    // Don't create an "Other" chapter - just leave them unassigned for now
  }

  if (newChapters.length <= 1) {
    return null // No meaningful reorganization
  }

  return newChapters
}

/**
 * Process a single database file
 */
async function processDatabase(dbPath, structures, countryCode) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Processing ${countryCode} database: ${dbPath}`)
  console.log('='.repeat(60))

  if (!fs.existsSync(dbPath)) {
    console.log(`  ❌ Database not found: ${dbPath}`)
    return { updated: 0, total: 0 }
  }

  const database = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
  let updated = 0
  const total = database.documents.length

  console.log(`  Found ${total} documents`)

  for (const doc of database.documents) {
    if (structures[doc.abbreviation]) {
      console.log(`\n  Processing ${doc.abbreviation}...`)
      const newChapters = reorganizeDocument(doc, structures)

      if (newChapters) {
        const oldCount = doc.chapters?.length || 0
        doc.chapters = newChapters
        console.log(`    ✓ Reorganized from ${oldCount} to ${newChapters.length} chapters`)
        updated++
      } else {
        console.log(`    - No reorganization needed or possible`)
      }
    }
  }

  if (updated > 0) {
    database.metadata = database.metadata || {}
    database.metadata.restructured_at = new Date().toISOString()
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2))
    console.log(`\n  ✓ Saved ${updated} restructured documents`)
  } else {
    console.log(`\n  No documents were restructured`)
  }

  return { updated, total }
}

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  console.log('╔' + '═'.repeat(58) + '╗')
  console.log('║  Reorganize Chapter Structures (Abschnitte/Hoofdstukken)  ║')
  console.log('╚' + '═'.repeat(58) + '╝')
  console.log('')
  console.log('Sources:')
  console.log('  - AT: ris.bka.gv.at')
  console.log('  - DE: buzer.de')
  console.log('  - NL: wetten.overheid.nl')

  const atDb = path.join(__dirname, '../eu_safety_laws/at/at_database.json')
  const deDb = path.join(__dirname, '../eu_safety_laws/de/de_database.json')
  const nlDb = path.join(__dirname, '../eu_safety_laws/nl/nl_database.json')

  const results = []

  results.push(await processDatabase(atDb, AT_CHAPTER_STRUCTURES, 'AT'))
  results.push(await processDatabase(deDb, DE_CHAPTER_STRUCTURES, 'DE'))
  results.push(await processDatabase(nlDb, NL_CHAPTER_STRUCTURES, 'NL'))

  console.log('\n' + '═'.repeat(60))
  console.log('SUMMARY')
  console.log('═'.repeat(60))

  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0)
  const totalDocs = results.reduce((sum, r) => sum + r.total, 0)

  console.log(`Total documents processed: ${totalDocs}`)
  console.log(`Total documents restructured: ${totalUpdated}`)
  console.log('')
  console.log('Chapter structure reorganization complete!')
}

main().catch(console.error)

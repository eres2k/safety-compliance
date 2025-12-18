#!/usr/bin/env node
import fs from "fs";

// Lade alle Datenbanken
const de = JSON.parse(fs.readFileSync("eu_safety_laws/de/de_database.json"));
const at = JSON.parse(fs.readFileSync("eu_safety_laws/at/at_database.json"));
const nl = JSON.parse(fs.readFileSync("eu_safety_laws/nl/nl_database.json"));

console.log("=== ALLE GESETZE - ABSCHNITT-STATUS ===\n");

function analyzeDoc(doc, country) {
  const chapters = doc.chapters?.length || 0;
  const totalSections = doc.chapters?.reduce((sum, c) => sum + (c.sections?.length || 0), 0) || 0;
  const hasStructure = chapters > 1;

  // Prüfe ob im Text Abschnitt/Hoofdstuk vorkommt
  const allText = doc.chapters?.flatMap(c => c.sections?.map(s => s.text) || []).join(" ") || "";
  const hasAbschnittInText = /\bAbschnitt\b/i.test(allText);
  const hasHoofdstukInText = /\bHoofdstuk\b/i.test(allText);
  const hasAfdelingInText = /\bAfdeling\b/i.test(allText);
  const hasParagraafInText = /\b§\s*\d+\s*Paragraaf\b/i.test(allText) || /\bParagraaf\s+\d+\b/i.test(allText);

  const status = hasStructure ? "✓" : "✗";
  const hints = [];
  if (hasStructure === false && hasAbschnittInText) hints.push("Abschnitt");
  if (hasStructure === false && hasHoofdstukInText) hints.push("Hoofdstuk");
  if (hasStructure === false && hasAfdelingInText) hints.push("Afdeling");
  if (hasStructure === false && hasParagraafInText) hints.push("Paragraaf");

  console.log(`${status} ${country.padEnd(3)} ${doc.abbreviation.padEnd(25)}: ${String(chapters).padStart(2)} Kap, ${String(totalSections).padStart(3)} §§ ${hints.length ? "⚠ Hat: " + hints.join(", ") : ""}`);

  return { doc, country, hasStructure, hints, totalSections };
}

console.log("--- Deutschland (DE) ---");
const deResults = de.documents.map(d => analyzeDoc(d, "DE"));

console.log("\n--- Österreich (AT) ---");
const atResults = at.documents.map(d => analyzeDoc(d, "AT"));

console.log("\n--- Niederlande (NL) ---");
const nlResults = nl.documents.map(d => analyzeDoc(d, "NL"));

// Zusammenfassung
const allResults = [...deResults, ...atResults, ...nlResults];
const needsWork = allResults.filter(r => r.hasStructure === false && r.hints.length > 0);
const noStructure = allResults.filter(r => r.hasStructure === false && r.hints.length === 0);

console.log("\n=== ZUSAMMENFASSUNG ===");
console.log(`Gesetze mit Abschnitten: ${allResults.filter(r => r.hasStructure).length}`);
console.log(`Gesetze ohne Abschnitte (haben aber welche im Text): ${needsWork.length}`);
console.log(`Gesetze ohne erkennbare Abschnitte: ${noStructure.length}`);

if (needsWork.length > 0) {
  console.log("\n⚠ Diese Gesetze brauchen Abschnitt-Struktur:");
  needsWork.forEach(r => console.log(`  - ${r.country} ${r.doc.abbreviation}`));
}

#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const dataPath = path.resolve(process.cwd(), 'js/data.js');
const dataSource = fs.readFileSync(dataPath, 'utf8');

const EXPECTED_JAZZ = {
  'Administration': 10,
  'Alertness': 20,
  'Anthropology': 0,
  'Appraise': 10,
  'Archeology': 0,
  'Art (Type)': 0,
  'Athletics': 30,
  'Charm': 20,
  'Craft (Type)': 0,
  'Disguise': 10,
  'Dodge': 30,
  'Drive': 20,
  'Firearms': 20,
  'First Aid': 10,
  'Foreign Language (Type)': 0,
  'Harangue': 10,
  'Heavy Machinery': 10,
  'History': 10,
  'Insight': 10,
  'Law (Type)': 0,
  'Medicine': 0,
  'Melee Weapons': 30,
  'Military Training (Type)': 0,
  'Natural World': 10,
  'Navigate': 10,
  'Occult': 10,
  'Persuade': 20,
  'Pilot (Type)': 0,
  'Psychoanalyze': 10,
  'Regional Lore (Type)': 0,
  'Research': 10,
  'Ride': 10,
  'Science (Type)': 0,
  'Search': 20,
  'Social Etiquette': 10,
  'Stealth': 10,
  'Streetwise (Type)': 0,
  'Surgery': 0,
  'Survival (Type)': 10,
  'Swim': 20,
  'Track': 10,
  'Unarmed Combat': 20,
  'Unnatural': 0,
  'Use Gadgets': 0,
};

const EXPECTED_MODERN = {
  'Administration': 10,
  'Alertness': 20,
  'Anthropology': 0,
  'Appraise': 10,
  'Archeology': 0,
  'Art (Type)': 0,
  'Athletics': 30,
  'Charm': 20,
  'Craft (Type)': 0,
  'Disguise': 10,
  'Dodge': 30,
  'Drive': 20,
  'Firearms': 20,
  'First Aid': 10,
  'Foreign Language (Type)': 0,
  'Forensics': 0,
  'Harangue': 10,
  'Heavy Machinery': 10,
  'History': 10,
  'Insight': 10,
  'Law (Type)': 0,
  'Medicine': 0,
  'Melee Weapons': 30,
  'Military Training (Type)': 0,
  'Natural World': 10,
  'Navigate': 10,
  'Occult': 10,
  'Persuade': 20,
  'Pharmacy': 0,
  'Pilot (Type)': 0,
  'Psychoanalyze': 10,
  'Regional Lore (Type)': 0,
  'Research': 10,
  'Ride': 10,
  'Science (Type)': 0,
  'Search': 20,
  'Stealth': 10,
  'Surgery': 0,
  'Survival (Type)': 10,
  'Swim': 20,
  'Technology Use': 0,
  'Track': 10,
  'Unarmed Combat': 20,
  'Unnatural': 0,
};

function extractObject(name) {
  const blockPattern = new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`);
  const blockMatch = dataSource.match(blockPattern);

  if (!blockMatch) {
    throw new Error(`Could not find ${name} in js/data.js`);
  }

  const rows = blockMatch[1].split('\n');
  const table = {};

  for (const row of rows) {
    const entry = row.match(/'([^']+)'\s*:\s*(\d+)/);
    if (!entry) {
      continue;
    }
    table[entry[1]] = Number(entry[2]);
  }

  return table;
}

function compareTables(label, expected, actual) {
  const onlyExpected = Object.keys(expected).filter((k) => !(k in actual)).sort();
  const onlyActual = Object.keys(actual).filter((k) => !(k in expected)).sort();
  const valueMismatches = Object.keys(expected)
    .filter((k) => k in actual && expected[k] !== actual[k])
    .sort()
    .map((k) => ({ skill: k, expected: expected[k], actual: actual[k] }));

  const ok = onlyExpected.length === 0 && onlyActual.length === 0 && valueMismatches.length === 0;

  if (ok) {
    console.log(`${label}: OK (${Object.keys(expected).length} skills)`);
    return true;
  }

  console.error(`${label}: FAILED`);

  if (onlyExpected.length > 0) {
    console.error(`  Missing in code (${onlyExpected.length}): ${onlyExpected.join(', ')}`);
  }

  if (onlyActual.length > 0) {
    console.error(`  Unexpected in code (${onlyActual.length}): ${onlyActual.join(', ')}`);
  }

  if (valueMismatches.length > 0) {
    console.error('  Base rating mismatches:');
    for (const mismatch of valueMismatches) {
      console.error(`    ${mismatch.skill}: expected ${mismatch.expected}, got ${mismatch.actual}`);
    }
  }

  return false;
}

const jazzActual = extractObject('JAZZ_SKILLS');
const modernActual = extractObject('MODERN_SKILLS');

const jazzOk = compareTables('Jazz skills', EXPECTED_JAZZ, jazzActual);
const modernOk = compareTables('Modern skills', EXPECTED_MODERN, modernActual);

if (!jazzOk || !modernOk) {
  process.exit(1);
}

console.log('Skill parity validation passed against cheat-sheet baseline.');

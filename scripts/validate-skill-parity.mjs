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

const EXPECTED_COLD_WAR = {
  'Administration':             10,
  'Alertness':                  20,
  'Anthropology':                0,
  'Appraise':                   10,
  'Archeology':                  0,
  'Art (Type)':                  0,
  'Athletics':                  30,
  'Charm':                      20,
  'Craft (Type)':                0,
  'Disguise':                   10,
  'Dodge':                      30,
  'Drive':                      20,
  'Espionage Training (Type)':   0,
  'Firearms':                   20,
  'First Aid':                  10,
  'Foreign Language (Type)':     0,
  'Harangue':                   10,
  'Heavy Machinery':            10,
  'History':                    10,
  'Insight':                    10,
  'Law (Type)':                  0,
  'Martial Arts':                0,
  'Medicine':                    0,
  'Melee Weapons':              30,
  'Military Training (Type)':    0,
  'Natural World':              10,
  'Navigate':                   10,
  'Occult':                     10,
  'Organizational Lore (Type)':  0,
  'Persuade':                   20,
  'Pilot (Type)':                0,
  'Psychoanalyze':              10,
  'Regional Lore (Type)':        0,
  'Research':                   10,
  'Ride':                       10,
  'Science (Type)':              0,
  'Search':                     20,
  'Stealth':                    10,
  'Surgery':                     0,
  'Survival (Type)':            10,
  'Swim':                       20,
  'Track':                      10,
  'Unarmed Combat':             20,
  'Unnatural':                   0,
  'Use Gadgets':                 0,
};

const EXPECTED_VICTORIAN = {
  'Administration':            10,
  'Alertness':                 20,
  'Anthropology':               0,
  'Appraise':                  10,
  'Archeology':                 0,
  'Art (Type)':                 0,
  'Athletics':                 30,
  'Charm':                     20,
  'Craft (Type)':               0,
  'Disguise':                  10,
  'Dodge':                     30,
  'Drive':                     20,
  'Empire Lore (Type)':         0,
  'Firearms':                  20,
  'First Aid':                 10,
  'Foreign Language (Type)':    0,
  'Harangue':                  10,
  'Heavy Machinery':           10,
  'History':                   10,
  'Insight':                   10,
  'Law (Type)':                 0,
  'Mechanical Knack':           0,
  'Medicine':                   0,
  'Melee Weapons':             30,
  'Military Training (Type)':   0,
  'Navigate':                  10,
  'Occult':                    10,
  'Persuade':                  20,
  'Pilot (Type)':               0,
  'Reassure':                  10,
  'Regional Lore (Type)':       0,
  'Research':                  10,
  'Ride':                      10,
  'Scavenge':                  10,
  'Science (Type)':             0,
  'Search':                    20,
  'Social Etiquette':          10,
  'Stealth':                   10,
  'Streetwise (Type)':          0,
  'Surgery':                    0,
  'Survival (Type)':           10,
  'Swim':                      20,
  'Theology':                  10,
  'Unarmed Combat':            20,
  'Unnatural':                  0,
  'Spirit Affinity':            0,
};

const EXPECTED_WWI = {
  'Alertness':                   20,
  'Anthropology':                 0,
  'Appraise':                    10,
  'Archeology':                   0,
  'Art (Type)':                   0,
  'Artillery':                    0,
  'Athletics':                   30,
  'Craft (Type)':                 0,
  'Demolitions':                  0,
  'Disguise':                    10,
  'Dodge':                       30,
  'Drive (Type)':                20,
  'Firearms':                    20,
  'First Aid':                   10,
  'Foreign Language (Type)':      0,
  'Harangue':                    10,
  'Heavy Machinery':             10,
  'Heavy Weapons':                0,
  'History':                     10,
  'Insight':                     10,
  'Law (Type)':                   0,
  'Medicine':                     0,
  'Melee Weapons':               30,
  'Military Science':             0,
  'Natural World':               10,
  'Navigate':                    10,
  'Occult':                      10,
  'Organizational Lore (Type)':   0,
  'Persuade':                    20,
  'Pilot (Type)':                 0,
  'Psychoanalyze':               10,
  'Regional Lore (Type)':         0,
  'Research':                    10,
  'Ride':                        10,
  'Scavenge':                    10,
  'Science (Type)':               0,
  'Search':                      20,
  'Social Etiquette':            10,
  'Stealth':                     10,
  'Surgery':                      0,
  'Survival (Type)':             10,
  'Swim':                        20,
  'Unarmed Combat':              40,
  'Unnatural':                    0,
  'Use Gadgets':                  0,
};

const EXPECTED_WWII = {
  'Administration':              10,
  'Alertness':                   20,
  'Anthropology':                 0,
  'Appraise':                    10,
  'Archeology':                   0,
  'Art (Type)':                   0,
  'Artillery':                    0,
  'Athletics':                   30,
  'Craft (Type)':                 0,
  'Demolitions':                  0,
  'Disguise':                    10,
  'Dodge':                       30,
  'Drive (Type)':                20,
  'Espionage Training (Type)':    0,
  'Firearms':                    20,
  'First Aid':                   10,
  'Foreign Language (Type)':      0,
  'Harangue':                    10,
  'Heavy Machinery':             10,
  'Heavy Weapons':                0,
  'History':                     10,
  'Insight':                     10,
  'Law (Type)':                   0,
  'Medicine':                     0,
  'Melee Weapons':               30,
  'Military Science':             0,
  'Natural World':               10,
  'Navigate':                    10,
  'Occult':                      10,
  'Organizational Lore (Type)':   0,
  'Persuade':                    20,
  'Pilot (Type)':                 0,
  'Psychoanalyze':               10,
  'Regional Lore (Type)':         0,
  'Research':                    10,
  'Ride':                        10,
  'Scavenge':                    10,
  'Science (Type)':               0,
  'Search':                      20,
  'Stealth':                     10,
  'Surgery':                      0,
  'Survival (Type)':             10,
  'Swim':                        20,
  'Unarmed Combat':              40,
  'Unnatural':                    0,
  'Use Gadgets':                  0,
};

const EXPECTED_FUTURE = {
  'Administration':              10,
  'Alertness':                   20,
  'Appraise':                    10,
  'Art (Type)':                   0,
  'Artificial Intelligence':      0,
  'Athletics':                   30,
  'Charm':                       20,
  'Cosmology':                   10,
  'Craft (Type)':                 0,
  'Disguise':                    10,
  'Dodge':                       30,
  'Drive':                       20,
  'Firearms / Beam Weapons':     20,
  'First Aid':                   10,
  'Foreign Language (Type)':      0,
  'Forensics':                    0,
  'Hacking':                      0,
  'Harangue':                    10,
  'Heavy Machinery':             10,
  'History':                     10,
  'Insight':                     10,
  'Law (Type)':                   0,
  'Medicine':                     0,
  'Melee Weapons':               30,
  'Military Training (Type)':     0,
  'Navigate':                    10,
  'Occult':                      10,
  'Persuade':                    20,
  'Pharmacy':                     0,
  'Pilot (Type)':                  0,
  'Planet/Station Lore (Type)':   0,
  'Psychoanalyze':               10,
  'Research':                    10,
  'Science (Type)':               0,
  'Search':                      20,
  'Stealth':                     10,
  'Surgery':                      0,
  'Survival (Type)':             10,
  'Swim':                        20,
  'Technology Use':               0,
  'Track':                       10,
  'Unarmed Combat':              20,
  'Unnatural':                    0,
  'Xenoarcheology':               0,
  'Zero-G Maneuvering':           0,
};


const EXPECTED_MEDIEVAL = {
  'Alchemy':                         0,
  'Alertness':                       20,
  'Animal Handling':                 10,
  'Appraise':                        10,
  'Art (Type)':                       0,
  'Athletics':                       30,
  'Beguile':                         20,
  'Carouse':                          0,
  'Chirurgery':                       0,
  'Ciphers':                          0,
  'Craft (Type)':                    10,
  'Disguise':                        10,
  'Dodge':                           30,
  'Drive':                           20,
  'First Aid':                       10,
  'Folklore':                        10,
  'Forage/Hunt':                     10,
  'Foreign Court/Kingdom (Type)':     0,
  'Foreign Language (Type)':          0,
  'Harangue/Taunt':                  10,
  'Herb Lore':                       20,
  'History':                         10,
  'Homeland':                         0,
  'Insight':                         10,
  'Literacy':                         0,
  'Melee Weapons':                   30,
  'Navigate':                        10,
  'Occult (Type)':                   10,
  'Persuade':                        20,
  'Procuratio':                       0,
  'Quadrivium':                       0,
  'Ranged Weapons':                  20,
  'Reassure':                        10,
  'Religion (Type)':                 10,
  'Repair/Devise':                    0,
  'Ride':                            10,
  'Sailing (Type)':                   0,
  'Scavenge':                        10,
  'Search':                          20,
  'Siege Weapons':                    0,
  'Stealth':                         10,
  'Swim':                            20,
  'Trivium':                          0,
  'Unarmed Combat':                  40,
  'Unnatural':                        0,
};


const EXPECTED_CLASSICAL = {
  'Alertness':                       20,
  'Animal Handling':                 10,
  'Appraise':                        10,
  'Art (Type)':                       0,
  'Astronomy':                        0,
  'Athletics':                       30,
  'Augury':                           0,
  'Beguile':                         20,
  'Carouse':                          0,
  'Craft (Type)':                    10,
  'Disguise':                        10,
  'Dodge':                           30,
  'Drive':                           20,
  'First Aid':                       10,
  'Folklore':                        10,
  'Forage/Hunt':                     10,
  'Foreign Court/Kingdom (Type)':     0,
  'Foreign Language (Type)':          0,
  'Harangue/Taunt':                  10,
  'Herb Lore':                       20,
  'History':                         10,
  'Homeland':                         0,
  'Insight':                         10,
  'Literacy':                         0,
  'Mathematics':                      0,
  'Melee Weapons':                   30,
  'Mysticism (Type)':                10,
  'Navigate':                        10,
  'Persuade':                        20,
  'Physician':                        0,
  'Poisons':                          0,
  'Procuratio':                       0,
  'Ranged Weapons':                  20,
  'Reassure':                        10,
  'Religion (Type)':                 10,
  'Repair/Devise':                    0,
  'Rhetoric':                         0,
  'Sailing (Type)':                   0,
  'Scavenge':                        10,
  'Search':                          20,
  'Siege Weapons':                    0,
  'Stealth':                         10,
  'Swim':                            20,
  'Unarmed Combat':                  40,
  'Unnatural':                        0,
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
const coldWarActual = extractObject('COLD_WAR_SKILLS');
const victorianActual = extractObject('VICTORIAN_SKILLS');
const wwiActual = extractObject('WWI_SKILLS');
const wwiiActual = extractObject('WWII_SKILLS');
const futureActual = extractObject('FUTURE_SKILLS');
const medievalActual = extractObject('MEDIEVAL_SKILLS');
const classicalActual = extractObject('CLASSICAL_SKILLS');

const jazzOk = compareTables('Jazz skills', EXPECTED_JAZZ, jazzActual);
const modernOk = compareTables('Modern skills', EXPECTED_MODERN, modernActual);
const coldWarOk = compareTables('Cold War skills', EXPECTED_COLD_WAR, coldWarActual);
const victorianOk = compareTables('Victorian skills', EXPECTED_VICTORIAN, victorianActual);
const wwiOk = compareTables('WWI skills', EXPECTED_WWI, wwiActual);
const wwiiOk = compareTables('WWII skills', EXPECTED_WWII, wwiiActual);
const futureOk = compareTables('Future skills', EXPECTED_FUTURE, futureActual);
const medievalOk = compareTables('Medieval skills', EXPECTED_MEDIEVAL, medievalActual);
const classicalOk = compareTables('Classical skills', EXPECTED_CLASSICAL, classicalActual);

if (!jazzOk || !modernOk || !coldWarOk || !victorianOk || !wwiOk || !wwiiOk || !futureOk || !medievalOk || !classicalOk) {
  process.exit(1);
}

console.log('Skill parity validation passed against cheat-sheet baseline.');

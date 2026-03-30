#!/usr/bin/env node
/**
 * validate-import-export.mjs
 *
 * Validates that a v2 character JSON export file:
 *   1. Contains the correct version marker (2) and required top-level fields.
 *   2. Contains a complete identity block (name, profession, etc.).
 *   3. Contains final attribute values for all 6 attributes.
 *   4. Contains final skill percentages, with spot-checks for known values.
 *   5. Contains bonds as outcome-only objects (name, type, currentScore — no bonusSpent).
 *   6. Contains final HP/WP/SAN values plus Breaking Point, Max SAN, and Recovery SAN.
 *   7. Does NOT contain process fields (rolledSets, skillPoints, adversityPoints, etc.).
 *
 * Mirrors the fields produced by exportToJson() and consumed by importFromJsonV2()
 * in js/app.js.
 */

import fs from 'node:fs';
import path from 'node:path';

const fixturePath = path.resolve(process.cwd(), 'scripts/fixtures/sample-character.json');

// ── Load fixture ─────────────────────────────────────────────
let character;
try {
  character = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
} catch (err) {
  console.error(`Failed to read or parse fixture: ${fixturePath}`);
  console.error(err.message);
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────
let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failures++;
  }
}

function assertField(obj, key, expectedType, label) {
  const val = obj[key];
  const present = val !== undefined && val !== null;
  assert(present, `${label}.${key} should be present`);
  if (present && expectedType) {
    assert(
      typeof val === expectedType || (expectedType === 'array' && Array.isArray(val)),
      `${label}.${key} should be of type ${expectedType}, got ${Array.isArray(val) ? 'array' : typeof val}`
    );
  }
}

function assertAbsent(obj, key, label) {
  assert(!(key in obj), `${label}.${key} should NOT be present in v2 export (process field)`);
}

// ── Validations ───────────────────────────────────────────────

console.log('Validating import/export fixture…');

// 1. Version and era
assertField(character, 'version', 'number', 'root');
assert(character.version === 2, `root.version should be 2, got ${character.version}`);
assertField(character, 'age', 'string', 'root');
assert(
  character.age === 'jazz' || character.age === 'modern',
  `root.age must be 'jazz' or 'modern', got '${character.age}'`
);

// 2. Character meta (identity / display fields kept in v2)
assert('upbringing' in character, 'root.upbringing key should be present');
assert('archetype' in character, 'root.archetype key should be present');
assertField(character, 'identity', 'object', 'root');

// 3. identity block
const id = character.identity || {};
assertField(id, 'name', 'string', 'identity');
assert((id.name || '').trim().length > 0, 'identity.name must not be empty');
assertField(id, 'profession', 'string', 'identity');
assertField(id, 'birthplace', 'string', 'identity');
assertField(id, 'gender', 'string', 'identity');
assertField(id, 'characterAge', 'number', 'identity');
assertField(id, 'backstory', 'string', 'identity');
assertField(id, 'motivations', 'string', 'identity');
assertField(id, 'gear', 'string', 'identity');

// 4. Final attribute values — all 6 must be present as numbers
const ATTRIBUTES = ['STR', 'CON', 'DEX', 'INT', 'POW', 'CHA'];
assertField(character, 'attributes', 'object', 'root');
const attrs = character.attributes || {};
for (const attr of ATTRIBUTES) {
  assert(attr in attrs, `attributes.${attr} should be present`);
  assert(typeof attrs[attr] === 'number', `attributes.${attr} should be a number`);
  assert(attrs[attr] >= 1 && attrs[attr] <= 20, `attributes.${attr} should be 1–20`);
}
// Spot-check known values for the sample character
assert(attrs.STR === 15, `attributes.STR should be 15, got ${attrs.STR}`);
assert(attrs.INT === 17, `attributes.INT should be 17, got ${attrs.INT}`);
assert(attrs.POW === 12, `attributes.POW should be 12, got ${attrs.POW}`);

// 5. Final skill percentages
assertField(character, 'skills', 'object', 'root');
const skills = character.skills || {};
assert(Object.keys(skills).length > 0, 'skills should contain at least one entry');
for (const [name, val] of Object.entries(skills)) {
  assert(typeof val === 'number', `skills.${name} should be a number`);
  assert(val >= 0 && val <= 99, `skills.${name} should be 0–99, got ${val}`);
}
// Spot-check archetype-boosted and bonus-pick values for the Journalist sample
assert(skills['Alertness']       === 70, `skills.Alertness should be 70 (archetype 50 + 1 pick), got ${skills['Alertness']}`);
assert(skills['Insight']         === 80, `skills.Insight should be 80 (archetype 60 + 1 pick), got ${skills['Insight']}`);
assert(skills['Persuade']        === 60, `skills.Persuade should be 60 (base 20 + 2 picks), got ${skills['Persuade']}`);
assert(skills['Research']        === 60, `skills.Research should be 60 (archetype), got ${skills['Research']}`);
assert(skills['Unnatural']       === 0,  `skills.Unnatural should be 0, got ${skills['Unnatural']}`);

// 6. skillTypes (specialisation strings for "(Type)" skills)
assertField(character, 'skillTypes', 'object', 'root');

// 7. Custom skills shape in v2: { name, value }
assertField(character, 'customSkills', 'array', 'root');
for (let i = 0; i < (character.customSkills || []).length; i++) {
  const cs = character.customSkills[i];
  assertField(cs, 'name', 'string', `customSkills[${i}]`);
  assertField(cs, 'value', 'number', `customSkills[${i}]`);
}

// 8. Bonds: outcome-only shape — name, type, currentScore; no bonusSpent
assertField(character, 'bonds', 'array', 'root');
for (let i = 0; i < (character.bonds || []).length; i++) {
  const b = character.bonds[i];
  assertField(b, 'name', 'string', `bonds[${i}]`);
  assertField(b, 'type', 'string', `bonds[${i}]`);
  assert(
    b.type === 'individual' || b.type === 'community',
    `bonds[${i}].type must be 'individual' or 'community', got '${b.type}'`
  );
  assertField(b, 'currentScore', 'number', `bonds[${i}]`);
  assertAbsent(b, 'bonusSpent', `bonds[${i}]`);
}

// 9. Resources: a single final number
assertField(character, 'resources', 'number', 'root');
assert(character.resources === 4, `resources should be 4 for this Journalist, got ${character.resources}`);

// 10. Play-state and tracking fields
assertField(character, 'resourceChecked', 'array', 'root');
assertField(character, 'skillChecked', 'object', 'root');
assertField(character, 'violenceChecked', 'array', 'root');
assertField(character, 'helplessnessChecked', 'array', 'root');
assert((character.violenceChecked || []).length === 3, 'violenceChecked should have 3 entries');
assert((character.helplessnessChecked || []).length === 3, 'helplessnessChecked should have 3 entries');
assert('currentHP' in character, 'root.currentHP key should be present');
assert(typeof character.currentHP === 'number', 'root.currentHP should be a number');
assert('currentWP' in character, 'root.currentWP key should be present');
assert(typeof character.currentWP === 'number', 'root.currentWP should be a number');
assert('currentSAN' in character, 'root.currentSAN key should be present');
assert(typeof character.currentSAN === 'number', 'root.currentSAN should be a number');
assertField(character, 'maxHP',  'number', 'root');
assertField(character, 'maxWP',  'number', 'root');
assertField(character, 'maxSAN', 'number', 'root');
assertField(character, 'breakingPoint', 'number', 'root');
assertField(character, 'recoverySAN',   'number', 'root');
// Spot-check derived values for the sample character (STR 15, CON 12, POW 12, normal)
assert(character.maxHP  === 14, `maxHP should be 14, got ${character.maxHP}`);
assert(character.maxWP  === 12, `maxWP should be 12, got ${character.maxWP}`);
assert(character.maxSAN === 99, `maxSAN should be 99 (no Unnatural), got ${character.maxSAN}`);
assert(character.breakingPoint === 48, `breakingPoint should be 48 (SAN 60 − POW 12), got ${character.breakingPoint}`);
assert(character.recoverySAN   === 60, `recoverySAN should be 60 (POW 12 × 5), got ${character.recoverySAN}`);
// recoverySAN and currentSAN must never exceed maxSAN
assert(
  character.recoverySAN <= character.maxSAN,
  `recoverySAN (${character.recoverySAN}) must not exceed maxSAN (${character.maxSAN})`
);
assert(
  character.currentSAN <= character.maxSAN,
  `currentSAN (${character.currentSAN}) must not exceed maxSAN (${character.maxSAN})`
);
assertField(character, 'disorders', 'array', 'root');
assertField(character, 'showAllSkills', 'boolean', 'root');
assertField(character, 'bodyArmour', 'number', 'root');
assert(character.bodyArmour >= 0, `bodyArmour must be >= 0, got ${character.bodyArmour}`);

// 11. Disorders shape
for (let i = 0; i < (character.disorders || []).length; i++) {
  const d = character.disorders[i];
  assertField(d, 'id', 'number', `disorders[${i}]`);
  assertField(d, 'text', 'string', `disorders[${i}]`);
}

// 12. Process fields must NOT be present in v2 exports
assertAbsent(character, 'bpAdjust',           'root');
assertAbsent(character, 'rolledSets',         'root');
assertAbsent(character, 'attrAssign',          'root');
assertAbsent(character, 'harshStatChoice',     'root');
assertAbsent(character, 'skillPoints',         'root');
assertAbsent(character, 'adversityPoints',     'root');
assertAbsent(character, 'resourcesBonusSpent', 'root');
assertAbsent(character, 'selectedOptional',    'root');
assertAbsent(character, 'skillEditAdjust',     'root');
assertAbsent(character, 'resourcesEditAdjust', 'root');

// ── Results ───────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\nImport/export validation FAILED with ${failures} error(s).`);
  process.exit(1);
}

console.log('Import/export validation passed. All fields are present and correctly typed.');

#!/usr/bin/env node
/**
 * validate-import-export.mjs
 *
 * Validates that a character JSON export file:
 *   1. Contains all required top-level fields with correct types.
 *   2. Contains a complete identity block (name, profession, etc.).
 *   3. Contains valid attribute assignments for all 6 attributes.
 *   4. Contains skill/bond/disorder arrays of the expected shape.
 *   5. Contains play-state fields (currentHP, currentWP, currentSAN, etc.).
 *
 * Mirrors the fields read by importFromJson() in js/app.js.
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

// ── Validations ───────────────────────────────────────────────

console.log('Validating import/export fixture…');

// 1. Top-level required fields
assertField(character, 'version', 'number', 'root');
assertField(character, 'age', 'string', 'root');
assert(
  character.age === 'jazz' || character.age === 'modern',
  `root.age must be 'jazz' or 'modern', got '${character.age}'`
);
assertField(character, 'rolledSets', 'array', 'root');
assertField(character, 'attrAssign', 'object', 'root');
assertField(character, 'upbringing', null, 'root'); // may be null, just check presence
assert('upbringing' in character, 'root.upbringing key should be present');
assert('harshStatChoice' in character, 'root.harshStatChoice key should be present');
assertField(character, 'adversityPoints', 'object', 'root');
assert('archetype' in character, 'root.archetype key should be present');
assertField(character, 'selectedOptional', 'array', 'root');
assertField(character, 'skillPoints', 'object', 'root');
assertField(character, 'skillTypes', 'object', 'root');
assertField(character, 'customSkills', 'array', 'root');
assertField(character, 'bonds', 'array', 'root');
assertField(character, 'resources', 'number', 'root');
assertField(character, 'resourcesBonusSpent', 'number', 'root');
assertField(character, 'resourceChecked', 'array', 'root');
assertField(character, 'skillChecked', 'object', 'root');
assertField(character, 'violenceChecked', 'array', 'root');
assertField(character, 'helplessnessChecked', 'array', 'root');
assert('currentHP' in character, 'root.currentHP key should be present');
assert('currentWP' in character, 'root.currentWP key should be present');
assert('currentSAN' in character, 'root.currentSAN key should be present');
assertField(character, 'bpAdjust', 'number', 'root');
assertField(character, 'disorders', 'array', 'root');
assertField(character, 'showAllSkills', 'boolean', 'root');
assertField(character, 'skillEditAdjust', 'object', 'root');
assertField(character, 'resourcesEditAdjust', 'number', 'root');
assertField(character, 'identity', 'object', 'root');

// 2. identity block
const id = character.identity || {};
assertField(id, 'name', 'string', 'identity');
assert((id.name || '').trim().length > 0, 'identity.name must not be empty');
assertField(id, 'profession', 'string', 'identity');
assertField(id, 'nationality', 'string', 'identity');
assertField(id, 'gender', 'string', 'identity');
assertField(id, 'characterAge', 'number', 'identity');
assertField(id, 'backstory', 'string', 'identity');
assertField(id, 'motivations', 'string', 'identity');
assertField(id, 'gear', 'string', 'identity');

// 3. Attribute assignments — all 6 must be present
const ATTRIBUTES = ['STR', 'CON', 'DEX', 'INT', 'POW', 'CHA'];
const attrAssign = character.attrAssign || {};
for (const attr of ATTRIBUTES) {
  assert(attr in attrAssign, `attrAssign.${attr} key should be present`);
}

// 4. rolledSets shape — each entry needs id, values, total
for (let i = 0; i < (character.rolledSets || []).length; i++) {
  const rs = character.rolledSets[i];
  assertField(rs, 'id', 'number', `rolledSets[${i}]`);
  assertField(rs, 'values', 'array', `rolledSets[${i}]`);
  assertField(rs, 'total', 'number', `rolledSets[${i}]`);
  assert(rs.values.length === 4, `rolledSets[${i}].values should have 4 dice`);
}

// 5. bonds shape
for (let i = 0; i < (character.bonds || []).length; i++) {
  const b = character.bonds[i];
  assertField(b, 'name', 'string', `bonds[${i}]`);
  assertField(b, 'type', 'string', `bonds[${i}]`);
  assert(
    b.type === 'individual' || b.type === 'community',
    `bonds[${i}].type must be 'individual' or 'community', got '${b.type}'`
  );
  assertField(b, 'bonusSpent', 'number', `bonds[${i}]`);
  assertField(b, 'currentScore', 'number', `bonds[${i}]`);
}

// 6. disorders shape
for (let i = 0; i < (character.disorders || []).length; i++) {
  const d = character.disorders[i];
  assertField(d, 'id', 'number', `disorders[${i}]`);
  assertField(d, 'text', 'string', `disorders[${i}]`);
}

// 7. violenceChecked / helplessnessChecked length
assert(
  (character.violenceChecked || []).length === 3,
  'violenceChecked should have exactly 3 entries'
);
assert(
  (character.helplessnessChecked || []).length === 3,
  'helplessnessChecked should have exactly 3 entries'
);

// 8. customSkills shape (if any)
for (let i = 0; i < (character.customSkills || []).length; i++) {
  const cs = character.customSkills[i];
  assertField(cs, 'id', 'number', `customSkills[${i}]`);
  assertField(cs, 'baseValue', 'number', `customSkills[${i}]`);
  assertField(cs, 'customName', 'string', `customSkills[${i}]`);
  assertField(cs, 'points', 'number', `customSkills[${i}]`);
}

// ── Results ───────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\nImport/export validation FAILED with ${failures} error(s).`);
  process.exit(1);
}

console.log(`Import/export validation passed. All fields are present and correctly typed.`);

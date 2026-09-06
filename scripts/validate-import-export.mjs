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
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const fixturePath = path.join(ROOT, 'scripts/fixtures/sample-character.json');
const stoneFixturePath = path.join(ROOT, 'scripts/fixtures/sample-stone-character.json');
const VALID_ERAS = ['jazz', 'modern', 'coldwar', 'victorian', 'ww1', 'ww2', 'future', 'medieval', 'classical', 'revolutions', 'sails', 'elizabethan', 'alazrad', 'apocthulhu', 'stone'];

// ── Load fixture ─────────────────────────────────────────────
function loadFixture(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to read or parse fixture: ${filePath}`);
    console.error(err.message);
    process.exit(1);
  }
}
const character = loadFixture(fixturePath);
const stoneCharacter = loadFixture(stoneFixturePath);
const dataSource = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
const appSource = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const combinedSource = dataSource + '\n;\n' + appSource;

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

function makeSandbox(alerts) {
  const el = () => ({
    appendChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
    style: {},
    dataset: {},
    value: '',
    checked: false,
    focus: () => {},
    blur: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    contains: () => false,
    getAttribute: () => null,
    setAttribute: () => {},
    removeAttribute: () => {},
    getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
    offsetWidth: 0,
    offsetHeight: 0,
  });

  const ctx = {
    console,
    alert: (msg) => alerts.push(msg),
    confirm: () => false,
    prompt: () => null,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => el(),
      body: el(),
      documentElement: el(),
      head: el(),
    },
    location: { href: '', hash: '', reload: () => {}, assign: () => {} },
    history: { pushState: () => {}, replaceState: () => {} },
    navigator: { userAgent: '' },
    innerWidth: 1280,
    innerHeight: 800,
    HTMLElement: class {},
    Element: class {},
    Event: class { constructor() {} preventDefault() {} stopPropagation() {} },
    CustomEvent: class { constructor() {} },
    DragEvent: class { constructor() {} preventDefault() {} },
    MouseEvent: class { constructor() {} preventDefault() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    URL: { createObjectURL: () => '', revokeObjectURL: () => '' },
    Blob: class { constructor() {} },
    FileReader: class { constructor() {} readAsText() {} addEventListener() {} },
    scrollTo: () => {},
    __alerts: alerts,
  };
  ctx.window = ctx;
  return ctx;
}

function assertImportable(data, label, expected) {
  const alerts = [];
  const sandbox = makeSandbox(alerts);
  vm.createContext(sandbox);

  try {
    vm.runInContext(combinedSource, sandbox);
    vm.runInContext('render = () => {};', sandbox);
  } catch (err) {
    assert(false, `${label} fixture should load the app in the VM sandbox: ${err.message}`);
    return;
  }

  sandbox.__importData = JSON.parse(JSON.stringify(data));

  let result;
  try {
    result = vm.runInContext(`
      (() => {
        importFromJson(__importData);
        return {
          alerts: __alerts.slice(),
          age: state.age,
          currentStep: state.currentStep,
          lifestyle: state.lifestyle,
          clanName: state.clanName,
          clanProsperity: state.clanProsperity,
          castOut: state.castOut
        };
      })()
    `, sandbox);
  } catch (err) {
    assert(false, `${label} fixture should import without throwing: ${err.message}`);
    return;
  }

  assert(result.alerts.length === 0, `${label} fixture should import without validation alerts`);
  assert(result.age === expected.age, `${label} fixture should set state.age to '${expected.age}', got '${result.age}'`);
  assert(result.currentStep === 6, `${label} fixture should advance to the completed sheet, got step ${result.currentStep}`);
  if ('lifestyle' in expected) {
    assert(result.lifestyle === expected.lifestyle, `${label} fixture should preserve lifestyle '${expected.lifestyle}', got '${result.lifestyle}'`);
  }
  if ('clanName' in expected) {
    assert(result.clanName === expected.clanName, `${label} fixture should preserve clanName '${expected.clanName}', got '${result.clanName}'`);
  }
  if ('clanProsperity' in expected) {
    assert(result.clanProsperity === expected.clanProsperity, `${label} fixture should preserve clanProsperity ${expected.clanProsperity}, got ${result.clanProsperity}`);
  }
  if ('castOut' in expected) {
    assert(result.castOut === expected.castOut, `${label} fixture should preserve castOut ${expected.castOut}, got ${result.castOut}`);
  }
}

// ── Validations ───────────────────────────────────────────────

console.log('Validating import/export fixture…');

// 1. Version and era
assertField(character, 'version', 'number', 'root');
assert(character.version === 2, `root.version should be 2, got ${character.version}`);
assertField(character, 'age', 'string', 'root');
assert(
  VALID_ERAS.includes(character.age),
  `root.age must be a known era, got '${character.age}'`
);

// 2. Character meta (identity / display fields kept in v2)
assert('upbringing' in character, 'root.upbringing key should be present');
assert('archetype' in character, 'root.archetype key should be present');
assertField(character, 'identity', 'object', 'root');

// 3. identity block
const id = character.identity || {};
assertField(id, 'name', 'string', 'identity');
assertField(id, 'profession', 'string', 'identity');
assertField(id, 'birthplace', 'string', 'identity');
assertField(id, 'gender', 'string', 'identity');
assertField(id, 'characterAge', 'number', 'identity');
assertField(id, 'backstory', 'string', 'identity');
assertField(id, 'motivations', 'array', 'identity');
for (let i = 0; i < (id.motivations || []).length; i++) {
  const m = id.motivations[i];
  assertField(m, 'text',    'string',  `identity.motivations[${i}]`);
  assertField(m, 'crossed', 'boolean', `identity.motivations[${i}]`);
}
assert((id.motivations || []).length === 5, `identity.motivations should have 5 entries, got ${(id.motivations || []).length}`);
// At least 2 motivations should have non-empty text for a complete character
{
  const filledMotivations = (id.motivations || []).filter(m => m.text && m.text.trim() !== '').length;
  assert(filledMotivations >= 2, `At least 2 motivations should be filled in, got ${filledMotivations}`);
}
// At least one motivation should be crossed off (represents a resolved or lost goal)
{
  const crossedMotivations = (id.motivations || []).filter(m => m.crossed === true).length;
  assert(crossedMotivations >= 1, `At least 1 motivation should be crossed, got ${crossedMotivations}`);
}
assertField(id, 'gear', 'string', 'identity');
assertField(id, 'terribleTomes', 'string', 'identity');
assertField(id, 'permanentInjuries', 'string', 'identity');
assertField(id, 'notes', 'string', 'identity');
assertField(id, 'weapons', 'array', 'identity');
assert((id.weapons || []).length >= 1, `identity.weapons should have at least 1 entry, got ${(id.weapons || []).length}`);
{
  const weaponFields = ['weapon', 'skill', 'baseRange', 'damage', 'ap', 'lethality', 'killRadius', 'ammo'];
  const lastWeapon = (id.weapons || [])[(id.weapons || []).length - 1] || {};
  const lastIsBlank = weaponFields.every(f => !lastWeapon[f]) && !lastWeapon.condition;
  assert(lastIsBlank, `identity.weapons last row should be blank (trailing blank row invariant)`);
}

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
// Spot-check the 4 optional skills chosen during character creation
assert(skills['History']                === 50, `skills.History should be 50 (optional archetype pick), got ${skills['History']}`);
assert(skills['Occult']                 === 50, `skills.Occult should be 50 (optional archetype pick), got ${skills['Occult']}`);
assert(skills['Foreign Language (Type)'] === 40, `skills['Foreign Language (Type)'] should be 40 (optional archetype pick), got ${skills['Foreign Language (Type)']}`);
assert(skills['Use Gadgets']            === 40, `skills['Use Gadgets'] should be 40 (optional archetype pick), got ${skills['Use Gadgets']}`);

// 6. skillTypes (specialisation strings for "(Type)" skills)
assertField(character, 'skillTypes', 'object', 'root');
// Each skillTypes entry must correspond to a skill that exists and has a non-zero value
for (const [typedSkill, typeVal] of Object.entries(character.skillTypes || {})) {
  assert(typedSkill in (character.skills || {}), `skillTypes contains '${typedSkill}' which is not present in skills`);
  assert(typeof typeVal === 'string' && typeVal.trim() !== '', `skillTypes.${typedSkill} should be a non-empty string`);
  assert((character.skills || {})[typedSkill] > 0, `skillTypes.${typedSkill} is defined but skill value is 0 — type should only be set for skills actually used`);
}
// Spot-check known skill types for the sample character
assert(character.skillTypes['Art (Type)'] === 'Writing',  `skillTypes['Art (Type)'] should be 'Writing', got '${character.skillTypes['Art (Type)']}'`);
assert(character.skillTypes['Foreign Language (Type)'] === 'French', `skillTypes['Foreign Language (Type)'] should be 'French', got '${character.skillTypes['Foreign Language (Type)']}'`);
// 7. Custom skills shape in v2: { name, value }
assertField(character, 'customSkills', 'array', 'root');
assert((character.customSkills || []).length >= 1, `customSkills should have at least 1 entry for this sample character`);
for (let i = 0; i < (character.customSkills || []).length; i++) {
  const cs = character.customSkills[i];
  assertField(cs, 'name', 'string', `customSkills[${i}]`);
  assertField(cs, 'value', 'number', `customSkills[${i}]`);
  assert(cs.value >= 0 && cs.value <= 99, `customSkills[${i}].value should be 0–99, got ${cs.value}`);
}

// 8. Bonds: outcome-only shape — name, type, currentScore; no bonusSpent
assertField(character, 'bonds', 'array', 'root');
// Journalist archetype provides exactly 4 bonds
assert((character.bonds || []).length === 4, `bonds should have 4 entries for the Journalist archetype, got ${(character.bonds || []).length}`);
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
assertField(character, 'exhausted', 'boolean', 'root');
assertField(character, 'temporaryInsanity', 'boolean', 'root');
assertField(character, 'bodyArmour', 'number', 'root');
assert(character.bodyArmour >= 0, `bodyArmour must be >= 0, got ${character.bodyArmour}`);
assert(character.bodyArmour === 1, `bodyArmour should be 1 for this sample character, got ${character.bodyArmour}`);

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

// 13. Import smoke tests for representative v2 fixtures
assertImportable(character, 'Jazz Age sample', { age: 'jazz' });
assertImportable(stoneCharacter, 'Stone Age sample', {
  age: 'stone',
  lifestyle: 'hunter_gatherer',
  clanName: 'Red Mammoth Clan',
  clanProsperity: 7,
  castOut: false,
});

// ── Results ───────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\nImport/export validation FAILED with ${failures} error(s).`);
  process.exit(1);
}

console.log('Import/export validation passed. Fixtures are structurally valid and import cleanly.');

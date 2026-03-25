#!/usr/bin/env node
/**
 * validate-character-creation.mjs
 *
 * Verifies that values entered during the character-creation wizard are
 * calculated and presented correctly on the character sheet.
 *
 * Tests cover:
 *   1. Attribute values — including upbringing bonuses
 *   2. Derived stats   — HP, WP, SAN, Breaking Point, MaxSAN, RecoverySAN,
 *                         damage bonus
 *   3. Skill values    — base + archetype bonus + bonus picks (cap at 80 %)
 *   4. Adversity picks — applied to eligible skills
 *   5. Resources       — archetype base + bonus picks (cap at 20)
 *   6. Bond values     — individual (= CHA) and community (= Resources÷2
 *                         + optional bonus picks)
 *   7. Bonus-point pool accounting
 *
 * The app's pure calculation functions (calculateDerived, getFinalSkillValue,
 * getEffectiveResources, getBondEffectiveValue, etc.) are called directly by
 * loading js/data.js and js/app.js into a minimal Node.js VM sandbox that
 * stubs just enough browser globals for the scripts to parse without errors.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm   from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ── Minimal browser sandbox ──────────────────────────────────────────────────

function makeSandbox() {
  const el = () => ({
    appendChild:          () => {},
    addEventListener:     () => {},
    removeEventListener:  () => {},
    classList:            { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
    style:                {},
    dataset:              {},
    get textContent()     { return ''; },
    set textContent(_)    {},
    get innerHTML()       { return ''; },
    set innerHTML(_)      {},
    value:                '',
    checked:              false,
    focus:                () => {},
    blur:                 () => {},
    querySelector:        () => null,
    querySelectorAll:     () => [],
    closest:              () => null,
    contains:             () => false,
    getAttribute:         () => null,
    setAttribute:         () => {},
    removeAttribute:      () => {},
    getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
    offsetWidth:          0,
    offsetHeight:         0,
  });

  const ctx = {
    console,
    alert:                () => {},
    confirm:              () => false,
    prompt:               () => null,
    setTimeout:           () => 0,
    clearTimeout:         () => {},
    setInterval:          () => 0,
    clearInterval:        () => {},
    requestAnimationFrame: () => {},
    localStorage: {
      getItem:    () => null,
      setItem:    () => {},
      removeItem: () => {},
    },
    document: {
      addEventListener:    () => {},
      removeEventListener: () => {},
      getElementById:      () => null,
      querySelector:       () => null,
      querySelectorAll:    () => [],
      createElement:       () => el(),
      body:                el(),
      documentElement:     el(),
      head:                el(),
    },
    location:         { href: '', hash: '', reload: () => {}, assign: () => {} },
    history:          { pushState: () => {}, replaceState: () => {} },
    navigator:        { userAgent: '' },
    innerWidth:       1280,
    innerHeight:      800,
    HTMLElement:      class {},
    Element:          class {},
    Event:            class { constructor() {} preventDefault() {} stopPropagation() {} },
    CustomEvent:      class { constructor() {} },
    DragEvent:        class { constructor() {} preventDefault() {} },
    MouseEvent:       class { constructor() {} preventDefault() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    URL:              { createObjectURL: () => '', revokeObjectURL: () => '' },
    Blob:             class { constructor() {} },
    FileReader:       class { constructor() {} readAsText() {} addEventListener() {} },
    // results array — set before VM code runs, read afterwards
    _results: [],
  };
  ctx.window = ctx;
  return ctx;
}

// ── Load scripts ─────────────────────────────────────────────────────────────

const dataSource = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf-8');
const appSource  = fs.readFileSync(path.join(ROOT, 'js/app.js'),  'utf-8');

const sandbox = makeSandbox();
vm.createContext(sandbox);

// Combine both sources into one script execution so that every const/let
// defined in data.js and app.js is in scope for the test assertions below.
const combinedSource = dataSource + '\n;\n' + appSource;

try {
  vm.runInContext(combinedSource, sandbox);
} catch (err) {
  console.error('Fatal: could not load js/data.js + js/app.js into sandbox.');
  console.error(err.message);
  process.exit(1);
}

// ── Test code — runs inside the same VM context ───────────────────────────────

const testCode = `
(function runTests() {

  // ── helpers ────────────────────────────────────────────────────────────────

  function pass(msg) { _results.push({ ok: true,  msg }); }
  function fail(msg) { _results.push({ ok: false, msg }); console.error('  FAIL: ' + msg); }

  function eq(actual, expected, message) {
    if (actual === expected) {
      pass(message);
    } else {
      fail(message + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
  }

  // Resets state to a clean, archetype-less baseline.
  function resetState() {
    state.age               = null;
    state.attrMode          = 'rolling';
    state.pointsAttr        = { STR: 12, CON: 12, DEX: 12, INT: 12, POW: 12, CHA: 12 };
    state.rolledSets        = [];
    state.attrAssign        = { STR: null, CON: null, DEX: null, INT: null, POW: null, CHA: null };
    state.upbringing        = null;
    state.harshStatChoice   = null;
    state.adversityPoints   = {};
    state.archetype         = null;
    state.selectedOptional  = [];
    state.skillPoints       = {};
    state.skillTypes        = {};
    state.customSkills      = [];
    state.bonds             = [];
    state.resources         = 0;
    state.resourcesBonusSpent = 0;
    state.currentHP         = null;
    state.currentWP         = null;
    state.currentSAN        = null;
    state.bpAdjust          = 0;
    state.disorders         = [];
    state.editMode          = false;
    state.resourcesEditAdjust = 0;
    state.skillEditAdjust   = {};
    state.identity          = {
      name: '', profession: '', nationality: '', characterAge: 25,
      backstory: '', motivations: '', gear: '',
    };
  }

  // Populates rolledSets so that getAttrValue(key) returns exactly \`total\`
  // (before upbringing bonus).  Each attribute gets its own roll set.
  function setAttributes(attrs) {
    state.rolledSets = [];
    let id = 1;
    for (const [key, total] of Object.entries(attrs)) {
      state.rolledSets.push({ id, values: [total, 0, 0, 0], total });
      state.attrAssign[key] = id;
      id++;
    }
  }

  // ── Suite 1: Derived Statistics ─────────────────────────────────────────────

  console.log('\\n── Suite 1: Derived Statistics ─────────────────────────────────────────────');

  // 1.1  HP = ceil((STR + CON) / 2)
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().HP, 10, 'HP = ceil((10+10)/2) = 10');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 11, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().HP, 11, 'HP = ceil((11+10)/2) = ceil(10.5) = 11');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    // Sample character: STR 15, CON 12 → HP 14
    setAttributes({ STR: 15, CON: 12, DEX: 14, INT: 17, POW: 12, CHA: 8 });
    eq(calculateDerived().HP, 14, 'HP = ceil((15+12)/2) = ceil(13.5) = 14 [sample character]');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 3, CON: 3, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().HP, 3, 'HP = ceil((3+3)/2) = 3 [minimum STR & CON]');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 18, CON: 18, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().HP, 18, 'HP = ceil((18+18)/2) = 18 [maximum STR & CON]');
  }

  // 1.2  WP = POW
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 12, CHA: 10 });
    eq(calculateDerived().WP, 12, 'WP = POW = 12 [sample character]');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 3, CHA: 10 });
    eq(calculateDerived().WP, 3, 'WP = POW = 3 [minimum]');
  }

  // 1.3  SAN = POW × 5 (normal upbringing)
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().SAN, 50, 'SAN = POW(10) × 5 = 50 [normal upbringing]');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 15, CON: 12, DEX: 14, INT: 17, POW: 12, CHA: 8 });
    eq(calculateDerived().SAN, 60, 'SAN = POW(12) × 5 = 60 [sample character, normal]');
  }

  // 1.4  SAN = POW × 4 (harsh upbringing)
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'STR';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().SAN, 40, 'SAN = POW(10) × 4 = 40 [harsh upbringing]');
  }

  // 1.5  SAN = POW × 4 (very harsh upbringing)
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'very_harsh';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().SAN, 40, 'SAN = POW(10) × 4 = 40 [very harsh upbringing]');
  }

  // 1.6  Breaking Point = SAN − POW
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().BP, 40, 'BP = SAN(50) − POW(10) = 40 [normal]');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 15, CON: 12, DEX: 14, INT: 17, POW: 12, CHA: 8 });
    eq(calculateDerived().BP, 48, 'BP = SAN(60) − POW(12) = 48 [sample character]');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'STR';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().BP, 30, 'BP = SAN(40) − POW(10) = 30 [harsh upbringing]');
  }

  // 1.7  RecoverySAN = POW × 5 (capped at MaxSAN)
  {
    // No Unnatural → MaxSAN=99 → RecoverySAN = POW×5 unconstrained
    resetState(); state.age = 'jazz'; state.upbringing = 'very_harsh';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().RecoverySAN, 50, 'RecoverySAN = min(POW(10)×5, MaxSAN(99)) = 50 [very harsh, no Unnatural]');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'STR';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().RecoverySAN, 50, 'RecoverySAN = min(POW(10)×5, MaxSAN(99)) = 50 [harsh, no Unnatural]');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 15, CON: 12, DEX: 14, INT: 17, POW: 12, CHA: 8 });
    eq(calculateDerived().RecoverySAN, 60, 'RecoverySAN = min(POW(12)×5, MaxSAN(99)) = 60 [sample character]');
  }

  // 1.8  MaxSAN = 99 − Unnatural skill (uses getDisplayedSkillValue, including play-mode edits)
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal'; state.archetype = 'journalist';
    state.selectedOptional = []; state.skillPoints = {};
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().MaxSAN, 99, 'MaxSAN = 99 − Unnatural(0) = 99');
  }
  {
    // Unnatural raised during play via skillEditAdjust — MaxSAN must update
    resetState(); state.age = 'jazz'; state.upbringing = 'normal'; state.archetype = 'journalist';
    state.selectedOptional = []; state.skillPoints = {};
    state.skillEditAdjust = { 'Unnatural': 10 }; // 10 % gained during play
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().MaxSAN, 89, 'MaxSAN = 99 − Unnatural(10) = 89 [play-mode edit]');
  }

  // 1.9  SAN clamped to MaxSAN when Unnatural is high
  {
    // POW=10, normal → baseSAN=50; Unnatural=10 → MaxSAN=89; min(50,89)=50 (no clamp needed)
    resetState(); state.age = 'jazz'; state.upbringing = 'normal'; state.archetype = 'journalist';
    state.selectedOptional = []; state.skillPoints = {};
    state.skillEditAdjust = { 'Unnatural': 10 };
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().SAN, 50, 'SAN not clamped: baseSAN(50) ≤ MaxSAN(89)');
  }
  {
    // POW=10, normal → baseSAN=50; Unnatural=55 → MaxSAN=44; min(50,44)=44 (clamped)
    resetState(); state.age = 'jazz'; state.upbringing = 'normal'; state.archetype = 'journalist';
    state.selectedOptional = []; state.skillPoints = {};
    state.skillEditAdjust = { 'Unnatural': 55 };
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().SAN,    44, 'SAN clamped to MaxSAN(44) when baseSAN(50) > MaxSAN(44)');
    eq(calculateDerived().MaxSAN, 44, 'MaxSAN = 99 − Unnatural(55) = 44');
    eq(calculateDerived().BP,     34, 'BP = SAN(44) − POW(10) = 34 [clamped SAN]');
  }
  {
    // Harsh upbringing + high Unnatural: baseSAN=POW×4, still clamped to MaxSAN
    // POW=10, harsh → baseSAN=40; Unnatural=65 → MaxSAN=34; min(40,34)=34 (clamped)
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'STR';
    state.archetype = 'journalist'; state.selectedOptional = []; state.skillPoints = {};
    state.skillEditAdjust = { 'Unnatural': 65 };
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().SAN,    34, 'SAN clamped to MaxSAN(34) [harsh upbringing, high Unnatural]');
    eq(calculateDerived().MaxSAN, 34, 'MaxSAN = 99 − Unnatural(65) = 34');
    eq(calculateDerived().BP,     24, 'BP = SAN(34) − POW(10) = 24 [clamped SAN, harsh]');
  }

  // 1.10  RecoverySAN clamped to MaxSAN when Unnatural is high
  {
    // POW=10 → POW×5=50; Unnatural=55 → MaxSAN=44; min(50,44)=44 (clamped)
    resetState(); state.age = 'jazz'; state.upbringing = 'normal'; state.archetype = 'journalist';
    state.selectedOptional = []; state.skillPoints = {};
    state.skillEditAdjust = { 'Unnatural': 55 };
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().RecoverySAN, 44,
      'RecoverySAN clamped to MaxSAN(44) when POW×5(50) > MaxSAN(44)');
  }
  {
    // Upbringing doesn't affect RecoverySAN clamping (RecoverySAN is always POW×5 before cap)
    // POW=10, very harsh → SAN=40; Unnatural=55 → MaxSAN=44; RecoverySAN=min(50,44)=44
    resetState(); state.age = 'jazz'; state.upbringing = 'very_harsh';
    state.archetype = 'journalist'; state.selectedOptional = []; state.skillPoints = {};
    state.skillEditAdjust = { 'Unnatural': 55 };
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(calculateDerived().RecoverySAN, 44,
      'RecoverySAN clamped to MaxSAN(44) [very harsh + high Unnatural]');
  }

  // 1.11  getEffectiveSAN() clamps current SAN to MaxSAN at runtime
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal'; state.archetype = 'journalist';
    state.selectedOptional = []; state.skillPoints = {};
    state.skillEditAdjust = { 'Unnatural': 55 }; // MaxSAN=44
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    // currentSAN null → returns d.SAN which is already clamped to MaxSAN(44)
    state.currentSAN = null;
    eq(getEffectiveSAN(), 44, 'getEffectiveSAN() = clamped SAN(44) when currentSAN is null');
    // currentSAN above MaxSAN → clamped to MaxSAN
    state.currentSAN = 80;
    eq(getEffectiveSAN(), 44, 'getEffectiveSAN() clamps currentSAN(80) to MaxSAN(44)');
    // currentSAN within range → returned as-is
    state.currentSAN = 30;
    eq(getEffectiveSAN(), 30, 'getEffectiveSAN() = currentSAN(30) when within MaxSAN(44)');
  }

  // 1.12  Damage bonus based on STR
  {
    const dmgCases = [
      [3, -2], [4, -2],
      [5, -1], [8, -1],
      [9,  0], [12,  0],
      [13, 1], [16,  1],
      [17, 2], [18,  2],
    ];
    for (const [str, expectedDmg] of dmgCases) {
      resetState(); state.age = 'jazz'; state.upbringing = 'normal';
      setAttributes({ STR: str, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
      eq(calculateDerived().DMG, expectedDmg, 'Damage bonus for STR ' + str + ' = ' + expectedDmg);
    }
  }

  // ── Suite 2: Upbringing Bonuses ─────────────────────────────────────────────

  console.log('\\n── Suite 2: Upbringing Bonuses ─────────────────────────────────────────────');

  // 2.1  Normal — no attribute bonuses
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(getAttrValue('STR'), 10, 'Normal upbringing: STR = rolled value (no bonus)');
    eq(getAttrValue('CON'), 10, 'Normal upbringing: CON = rolled value (no bonus)');
  }

  // 2.2  Harsh + STR chosen → +1 STR only
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'STR';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(getAttrValue('STR'), 11, 'Harsh (STR chosen): STR = rolled(10) + 1 = 11');
    eq(getAttrValue('CON'), 10, 'Harsh (STR chosen): CON = rolled(10), no bonus');
    eq(getAttrValue('DEX'), 10, 'Harsh (STR chosen): DEX = rolled(10), no bonus');
  }

  // 2.3  Harsh + CON chosen → +1 CON only
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'CON';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(getAttrValue('STR'), 10, 'Harsh (CON chosen): STR = rolled(10), no bonus');
    eq(getAttrValue('CON'), 11, 'Harsh (CON chosen): CON = rolled(10) + 1 = 11');
  }

  // 2.4  Very harsh → +1 STR and +1 CON; other stats unchanged
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'very_harsh';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    eq(getAttrValue('STR'), 11, 'Very harsh: STR = rolled(10) + 1 = 11');
    eq(getAttrValue('CON'), 11, 'Very harsh: CON = rolled(10) + 1 = 11');
    eq(getAttrValue('DEX'), 10, 'Very harsh: DEX = rolled(10), no bonus');
    eq(getAttrValue('INT'), 10, 'Very harsh: INT = rolled(10), no bonus');
    eq(getAttrValue('POW'), 10, 'Very harsh: POW = rolled(10), no bonus');
    eq(getAttrValue('CHA'), 10, 'Very harsh: CHA = rolled(10), no bonus');
  }

  // 2.5  HP uses the upbringing-boosted attribute values
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'very_harsh';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    // effective STR=11, CON=11 → HP = ceil((11+11)/2) = 11
    eq(calculateDerived().HP, 11, 'HP with very harsh upbringing: ceil((11+11)/2) = 11');
  }
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'STR';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    // effective STR=11, CON=10 → HP = ceil((11+10)/2) = ceil(10.5) = 11
    eq(calculateDerived().HP, 11, 'HP with harsh (STR+1): ceil((11+10)/2) = ceil(10.5) = 11');
  }

  // ── Suite 3: Skill Values — Archetype Bonus ─────────────────────────────────

  console.log('\\n── Suite 3: Skill Values — Archetype Bonus ─────────────────────────────────');

  // Set up: Jazz Journalist archetype (fixed skills only, no optional picks)
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist'; state.selectedOptional = []; state.skillPoints = {};

    // 3.1  Fixed archetype skills lift skill to archetype value
    // Alertness:        base=20, arch=50  → bonus=30 → final=50
    eq(getFinalSkillValue('Alertness'),       50, 'Alertness: base(20)+archBonus(30)=50 [journalist]');
    // Art (Type):       base=0,  arch=50  → bonus=50 → final=50
    eq(getFinalSkillValue('Art (Type)'),      50, 'Art (Type): base(0)+archBonus(50)=50 [journalist]');
    // Insight:          base=10, arch=60  → bonus=50 → final=60
    eq(getFinalSkillValue('Insight'),         60, 'Insight: base(10)+archBonus(50)=60 [journalist]');
    // Research:         base=10, arch=60  → bonus=50 → final=60
    eq(getFinalSkillValue('Research'),        60, 'Research: base(10)+archBonus(50)=60 [journalist]');
    // Search:           base=20, arch=60  → bonus=40 → final=60
    eq(getFinalSkillValue('Search'),          60, 'Search: base(20)+archBonus(40)=60 [journalist]');
    // Social Etiquette: base=10, arch=30  → bonus=20 → final=30
    eq(getFinalSkillValue('Social Etiquette'),30, 'Social Etiquette: base(10)+archBonus(20)=30 [journalist]');

    // 3.2  Non-archetype skills remain at base value
    eq(getFinalSkillValue('Athletics'), 30, 'Athletics: base(30), no archetype bonus');
    eq(getFinalSkillValue('Firearms'),  20, 'Firearms: base(20), no archetype bonus');
    eq(getFinalSkillValue('Persuade'),  20, 'Persuade: base(20), no archetype bonus');
  }

  // 3.3  Optional skills: bonus only when the skill is in selectedOptional
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist'; state.skillPoints = {};

    state.selectedOptional = [];
    eq(getFinalSkillValue('Occult'),  10, 'Occult: optional not selected → stays at base(10)');
    eq(getFinalSkillValue('History'), 10, 'History: optional not selected → stays at base(10)');

    state.selectedOptional = ['Occult', 'History'];
    // Occult:  base=10, optional=50 → bonus=40 → final=50
    eq(getFinalSkillValue('Occult'),  50, 'Occult: base(10)+optionalBonus(40)=50 [selected]');
    // History: base=10, optional=50 → bonus=40 → final=50
    eq(getFinalSkillValue('History'), 50, 'History: base(10)+optionalBonus(40)=50 [selected]');
  }

  // 3.4  Archetype does NOT reduce a skill that is already above its target value
  //      (e.g. if a base skill is somehow equal to the archetype value, archBonus = 0)
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist'; state.skillPoints = {};
    state.selectedOptional = [];
    // Athletics has base 30; journalist has NO entry for Athletics
    // → archBonus must be 0, skill stays at 30
    eq(getFinalSkillValue('Athletics'), 30, 'Athletics not in archetype → no bonus applied');
  }

  // ── Suite 4: Skill Values — Bonus Picks ─────────────────────────────────────

  console.log('\\n── Suite 4: Skill Values — Bonus Picks ─────────────────────────────────────');

  // Bonus picks: each pick adds +20 %, final value capped at 80 %
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist'; state.selectedOptional = [];

    // 4.1  Picks on a non-archetype skill (Persuade: base=20)
    state.skillPoints = { 'Persuade': 1 };
    eq(getFinalSkillValue('Persuade'), 40, 'Persuade: base(20)+1 pick(+20)=40');
    state.skillPoints = { 'Persuade': 2 };
    eq(getFinalSkillValue('Persuade'), 60, 'Persuade: base(20)+2 picks(+40)=60 [sample character]');
    state.skillPoints = { 'Persuade': 3 };
    eq(getFinalSkillValue('Persuade'), 80, 'Persuade: base(20)+3 picks(+60)=80 [cap]');

    // 4.2  Cap at 80 — additional picks do not push past 80
    state.skillPoints = { 'Persuade': 4 };
    eq(getFinalSkillValue('Persuade'), 80, 'Persuade: base(20)+4 picks capped at 80, not 100');
    state.skillPoints = { 'Persuade': 10 };
    eq(getFinalSkillValue('Persuade'), 80, 'Persuade: 10 picks still capped at 80');
  }

  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist'; state.selectedOptional = [];

    // 4.3  Picks stacked on top of archetype bonus — Alertness (arch=50)
    state.skillPoints = { 'Alertness': 1 };
    eq(getFinalSkillValue('Alertness'), 70, 'Alertness: arch(50)+1 pick(+20)=70 [sample character]');

    // 4.4  Cap applies when picks + archetype would exceed 80 — Insight (arch=60)
    state.skillPoints = { 'Insight': 1 };
    eq(getFinalSkillValue('Insight'), 80, 'Insight: arch(60)+1 pick(+20)=80 [capped, sample]');

    state.skillPoints = { 'Research': 2 }; // arch=60, +40 → 100 → capped
    eq(getFinalSkillValue('Research'), 80, 'Research: arch(60)+2 picks=100 → capped at 80');
  }

  // 4.5  Unnatural skill is immune to bonus picks
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist'; state.selectedOptional = [];
    state.skillPoints = { 'Unnatural': 5 };
    eq(getFinalSkillValue('Unnatural'), 0, 'Unnatural: picks ignored, stays at base(0)');
  }

  // ── Suite 5: Adversity Picks ────────────────────────────────────────────────

  console.log('\\n── Suite 5: Adversity Picks ─────────────────────────────────────────────────');

  // 5.1  Harsh upbringing provides exactly 1 adversity pick
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'STR';
    eq(getAdversityTotal(), 1, 'Harsh upbringing provides 1 adversity pick');
  }

  // 5.2  Very harsh upbringing provides exactly 2 adversity picks
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'very_harsh';
    eq(getAdversityTotal(), 2, 'Very harsh upbringing provides 2 adversity picks');
  }

  // 5.3  Normal upbringing provides 0 adversity picks
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    eq(getAdversityTotal(), 0, 'Normal upbringing provides 0 adversity picks');
  }

  // 5.4  Adversity pick adds +20 % to an eligible skill (First Aid)
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'STR';
    state.archetype = 'journalist'; state.selectedOptional = []; state.skillPoints = {};
    state.adversityPoints = { 'First Aid': 1 };
    // First Aid: base=10, no archetype bonus, 1 adversity pick: 10+20=30
    eq(getFinalSkillValue('First Aid'), 30, 'First Aid: base(10)+1 adversity pick(+20)=30');
    eq(getAdversitySpent(), 1,     'After 1 adversity pick: spent = 1');
    eq(getAdversityRemaining(), 0, 'After 1 adversity pick: remaining = 0');
  }

  // 5.5  Two adversity picks across two eligible skills (very harsh)
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'very_harsh';
    state.archetype = 'journalist'; state.selectedOptional = []; state.skillPoints = {};
    state.adversityPoints = { 'First Aid': 1, 'Survival (Type)': 1 };
    eq(getAdversitySpent(), 2,     'After 2 adversity picks: spent = 2');
    eq(getAdversityRemaining(), 0, 'After 2 adversity picks: remaining = 0');
    eq(getFinalSkillValue('First Aid'),         30, 'First Aid: base(10)+1 adversity pick=30');
    eq(getFinalSkillValue('Survival (Type)'),   30, 'Survival (Type): base(10)+1 adversity pick=30');
  }

  // ── Suite 6: Resources Calculation ──────────────────────────────────────────

  console.log('\\n── Suite 6: Resources Calculation ──────────────────────────────────────────');

  // Journalist archetype has resources base = 4.
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist'; state.resourcesBonusSpent = 0;

    // 6.1  No bonus picks — resources = archetype base
    eq(getEffectiveResources(), 4, 'Resources: journalist base = 4, no picks [sample character]');

    // 6.2  First pick adds +5
    state.resourcesBonusSpent = 1;
    eq(getEffectiveResources(), 9, 'Resources: base(4) + 1st pick(+5) = 9');

    // 6.3  Second pick adds +2 (total: base + 5 + 2)
    state.resourcesBonusSpent = 2;
    eq(getEffectiveResources(), 11, 'Resources: base(4)+1st(+5)+2nd(+2) = 11');

    // 6.4  Third pick adds another +2
    state.resourcesBonusSpent = 3;
    eq(getEffectiveResources(), 13, 'Resources: base(4)+1st(+5)+2nd(+2)+3rd(+2) = 13');

    // 6.5  Resources capped at 20
    state.resourcesBonusSpent = 10;
    // uncapped would be: 4 + 5 + 9×2 = 27
    eq(getEffectiveResources(), 20, 'Resources: capped at 20 (would be 27 without cap)');
  }

  // 6.6  A different archetype (private_eye: base=4) behaves identically
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'private_eye'; state.resourcesBonusSpent = 0;
    eq(getEffectiveResources(), 4, 'Private Eye: base resources = 4');

    state.resourcesBonusSpent = 1;
    eq(getEffectiveResources(), 9, 'Private Eye: base(4)+1 pick(+5)=9');
  }

  // ── Suite 7: Bond Values ─────────────────────────────────────────────────────

  console.log('\\n── Suite 7: Bond Values ─────────────────────────────────────────────────────');

  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist'; state.resourcesBonusSpent = 0;
    // Sample character: CHA=8, Resources=4
    setAttributes({ STR: 15, CON: 12, DEX: 14, INT: 17, POW: 12, CHA: 8 });

    const indBond  = { name: 'Margaret', type: 'individual', bonusSpent: 0, currentScore: null };
    const comBond  = { name: 'The Gazette', type: 'community', bonusSpent: 0, currentScore: null };

    // 7.1  Individual bond = CHA
    eq(getBondEffectiveValue(indBond), 8, 'Individual bond = CHA = 8 [sample character]');

    // 7.2  Community bond (no picks) = floor(Resources / 2) = floor(4/2) = 2
    eq(getBondEffectiveValue(comBond), 2, 'Community bond = floor(Resources(4)/2) = 2 [sample]');

    // 7.3  Community bond + 1 pick → base + 5
    comBond.bonusSpent = 1;
    eq(getBondEffectiveValue(comBond), 7, 'Community bond: floor(4/2)(=2)+1st pick(+5)=7');

    // 7.4  Community bond + 2 picks → base + 5 + 2
    comBond.bonusSpent = 2;
    eq(getBondEffectiveValue(comBond), 9, 'Community bond: floor(4/2)(=2)+1st(+5)+2nd(+2)=9');

    // 7.5  Individual bond reflects CHA at different values
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 16 });
    eq(getBondEffectiveValue(indBond), 16, 'Individual bond = CHA = 16');
  }

  // 7.6  Community bond base changes when Resources rating changes
  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist';
    setAttributes({ STR: 10, CON: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
    state.resourcesBonusSpent = 1; // Resources = 4 + 5 = 9

    const comBond = { name: 'Test Org', type: 'community', bonusSpent: 0, currentScore: null };
    // floor(9/2) = 4
    eq(getBondEffectiveValue(comBond), 4,
      'Community bond: floor(Resources(9)/2) = 4 after 1 resource pick');
  }

  // ── Suite 7b: Community Bond Status Labels ───────────────────────────────────

  console.log('\\n── Suite 7b: Community Bond Status Labels ───────────────────────────────────');

  {
    function statusLabel(score) { return getCommunityBondStatus(score).label; }

    eq(statusLabel(1),  'Disgraced member',             'Score 1  → Disgraced member');
    eq(statusLabel(2),  'Shunned member',               'Score 2  → Shunned member');
    eq(statusLabel(4),  'Shunned member',               'Score 4  → Shunned member');
    eq(statusLabel(5),  'Standard member',              'Score 5  → Standard member');
    eq(statusLabel(8),  'Standard member',              'Score 8  → Standard member');
    eq(statusLabel(9),  'Well-regarded member',         'Score 9  → Well-regarded member');
    eq(statusLabel(12), 'Well-regarded member',         'Score 12 → Well-regarded member');
    eq(statusLabel(13), 'Important member',             'Score 13 → Important member');
    eq(statusLabel(16), 'Important member',             'Score 16 → Important member');
    eq(statusLabel(17), 'Influential member',           'Score 17 → Influential member');
    eq(statusLabel(18), 'Influential member',           'Score 18 → Influential member');
    eq(statusLabel(19), 'Extremely influential member', 'Score 19 → Extremely influential member');
    eq(statusLabel(20), 'Top-tier member',              'Score 20 → Top-tier member');
  }

  // ── Suite 8: Bonus-Point Pool Accounting ────────────────────────────────────

  console.log('\\n── Suite 8: Bonus-Point Pool Accounting ────────────────────────────────────');

  {
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.archetype = 'journalist'; state.selectedOptional = [];

    // 8.1  Every protagonist starts with 10 bonus picks
    state.skillPoints = {}; state.resourcesBonusSpent = 0; state.bonds = [];
    eq(getBonusPointsTotal(),     10, 'Total bonus picks = 10');
    eq(getBonusPointsRemaining(), 10, 'All 10 remaining when none spent');

    // 8.2  Spending skill picks reduces the pool
    state.skillPoints = { 'Alertness': 1, 'Persuade': 2 };
    eq(getBonusPointsSpent(),      3, 'After 3 skill picks: spent = 3');
    eq(getBonusPointsRemaining(),  7, 'After 3 skill picks: remaining = 7');

    // 8.3  Resource picks also draw from the pool
    state.resourcesBonusSpent = 1;
    eq(getBonusPointsSpent(),      4, 'After 3 skill + 1 resource pick: spent = 4');
    eq(getBonusPointsRemaining(),  6, 'After 4 total picks: remaining = 6');

    // 8.4  Community-bond picks also draw from the pool
    state.bonds = [
      { name: 'Org', type: 'community', bonusSpent: 2, currentScore: null },
    ];
    eq(getBonusPointsSpent(),      6, 'After 3 skill + 1 resource + 2 bond picks: spent = 6');
    eq(getBonusPointsRemaining(),  4, 'After 6 total picks: remaining = 4');
  }

  // ── Suite 9: Points-Based Attribute Allocation ───────────────────────────────

  console.log('\\n── Suite 9: Points-Based Attribute Allocation ──────────────────────────────');

  {
    // 9.1  Default pointsAttr totals to 72 (12 × 6)
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.attrMode = 'points';
    state.pointsAttr = { STR: 12, CON: 12, DEX: 12, INT: 12, POW: 12, CHA: 12 };
    eq(getPointsTotal(),     72, 'Default points allocation totals 72');
    eq(getPointsRemaining(),  0, 'Default allocation: 0 points remaining');
  }

  {
    // 9.2  getAttrValue returns pointsAttr values in points mode
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.attrMode = 'points';
    state.pointsAttr = { STR: 15, CON: 12, DEX: 14, INT: 17, POW: 8, CHA: 6 };
    eq(getAttrValue('STR'), 15, 'Points mode: getAttrValue(STR) = 15');
    eq(getAttrValue('INT'), 17, 'Points mode: getAttrValue(INT) = 17');
    eq(getAttrValue('CHA'),  6, 'Points mode: getAttrValue(CHA) = 6');
  }

  {
    // 9.3  allAttributesAssigned returns true only when total == 72
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.attrMode = 'points';
    state.pointsAttr = { STR: 12, CON: 12, DEX: 12, INT: 12, POW: 12, CHA: 12 };
    eq(allAttributesAssigned(), true, 'Points mode: assigned when total == 72');

    state.pointsAttr.STR = 11;
    eq(allAttributesAssigned(), false, 'Points mode: not assigned when total != 72 (71)');

    state.pointsAttr.STR = 12;
    eq(allAttributesAssigned(), true, 'Points mode: assigned when total == 72 again (12×6=72)');
  }

  {
    // 9.4  calculateDerived works correctly in points mode
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.attrMode = 'points';
    state.pointsAttr = { STR: 15, CON: 12, DEX: 14, INT: 17, POW: 12, CHA: 2 };
    // Total = 72? 15+12+14+17+12+2 = 72. Yes.
    const d1 = calculateDerived();
    eq(d1.HP,  14, 'Points mode: HP = ceil((15+12)/2) = 14');
    eq(d1.WP,  12, 'Points mode: WP = POW = 12');
    eq(d1.SAN, 60, 'Points mode: SAN = POW(12) × 5 = 60 [normal upbringing]');
  }

  {
    // 9.5  Upbringing bonus applies correctly in points mode
    resetState(); state.age = 'jazz'; state.upbringing = 'harsh'; state.harshStatChoice = 'STR';
    state.attrMode = 'points';
    state.pointsAttr = { STR: 12, CON: 12, DEX: 12, INT: 12, POW: 12, CHA: 12 };
    eq(getAttrValue('STR'), 13, 'Points mode + harsh (STR): STR = 12 + 1 bonus = 13');
    eq(getAttrValue('CON'), 12, 'Points mode + harsh (STR): CON unchanged = 12');
  }

  {
    // 9.6  getPointsRemaining reflects the unspent budget correctly
    resetState(); state.age = 'jazz'; state.upbringing = 'normal';
    state.attrMode = 'points';
    state.pointsAttr = { STR: 18, CON: 18, DEX: 12, INT: 12, POW: 6, CHA: 3 };
    // 18+18+12+12+6+3 = 69 — 3 short of 72
    eq(getPointsTotal(),     69, 'Points total = 69 when 3 short');
    eq(getPointsRemaining(),  3, 'Points remaining = 3 when 3 short');
  }

})();
`;

try {
  vm.runInContext(testCode, sandbox);
} catch (err) {
  console.error('Fatal: uncaught error during test execution.');
  console.error(err.message);
  process.exit(1);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const totalPassed = sandbox._results.filter(r => r.ok).length;
const totalFailed = sandbox._results.filter(r => !r.ok).length;

console.log(
  '\nCharacter creation validation: ' + totalPassed + ' passed, ' + totalFailed + ' failed.'
);

if (totalFailed > 0) {
  process.exit(1);
}

console.log('All character creation checks passed.');

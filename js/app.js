/* ============================================================
   CTHULHU ETERNAL — APPLICATION LOGIC
   ============================================================ */

// ── State ──────────────────────────────────────────────────

const state = {
  currentStep: 1,
  playMode: false,    // true = character sheet only view
  age: null,          // 'jazz' | 'modern' | 'coldwar' | 'victorian' | 'ww1' | 'ww2' | 'future' | 'medieval' | 'classical' | 'revolutions' | 'sails' | 'elizabethan' | 'alazrad'

  attrMode: 'rolling',  // 'rolling' | 'points'
  pointsAttr: {         // points-based allocation values (used when attrMode === 'points')
    STR: 12, CON: 12, DEX: 12,
    INT: 12, POW: 12, CHA: 12,
  },

  rolledSets: [],     // [{id:N, values:[d1,d2,d3,d4], total:N}]
  attrAssign: {       // attribute -> rolledSet.id (or null)
    STR: null, CON: null, DEX: null,
    INT: null, POW: null, CHA: null,
  },

  upbringing: null,        // 'normal' | 'harsh' | 'very_harsh'
  harshStatChoice: null,   // 'STR' | 'CON' — only for 'harsh' upbringing
  adversityPoints: {},     // skillName -> bonus picks spent (adversity pool)

  archetype: null,               // archetype id
  selectedOptional: [],          // chosen optional skill names

  skillPoints: {},               // skillName -> bonus pts added (from bonus pool)
  skillTypes: {},                // skillName -> user-entered type string (for "(Type)" skills)
  customSkills: [],              // array of {id, baseValue, customName, points}
  advancedMode: false,           // kept for backwards-compat with saved state; no longer used in UI
  showAllSkills: false,          // show all skills including 0% on character sheet
  bonds: [],                     // array of {name, type ('individual'|'community'), bonusSpent, currentScore, setToOne}
  resources: 0,                  // final resources rating
  resourcesBonusSpent: 0,        // bonus pts spent on +resource
  resourcesSetToZero: false,     // toggle: sacrifice resources (set to 0) for +1 bonus pick

  resourceChecked: [],           // array of booleans for resource checkboxes
  skillChecked: {},              // skillName -> boolean (checked state on sheet)
  violenceChecked: [false, false, false],     // 3 checkboxes for Violence SAN incidents
  helplessnessChecked: [false, false, false], // 3 checkboxes for Helplessness SAN incidents
  exhausted: false,              // true = all skills shown at -20% in light blue
  temporaryInsanity: false,      // true = protagonist is temporarily insane

  // ── Upbringing Effects step (4.5) ──────────────────────────
  // Harsh upbringing bond effects
  harshD4Rolls: null,       // [d4_1, d4_2] — two separate d4 rolls
  harshBondChoice1: null,   // bond index for first d4 deduction
  harshBondChoice2: null,   // bond index for second d4 deduction
  // Very Harsh upbringing effects
  vhPowTestRoll: null,      // d100 roll result for POW × 4 test
  vhPowDisorderId: null,    // id of disorder auto-added on POW test failure
  vhAdaptedTo: null,        // 'violence' | 'helplessness' | null
  vhAdaptRoll: null,        // 1d6 roll result for adaptation effect
  // Attribute reductions from Very Harsh adaptation
  upbringingChaReduction: 0, // CHA reduced by this amount (adapted to violence)
  upbringingPowReduction: 0, // POW reduced by this amount (adapted to helplessness)

  currentHP:  null, // current HP (null = use derived max)
  currentWP:  null, // current WP (null = use derived max)
  currentSAN: null, // current SAN (null = use derived value)

  bpAdjust: 0,            // manual offset applied to the calculated Breaking Point during play
  bodyArmour: 0,          // body armour value (default 0, adjustable in edit mode)
  disorders: [],          // array of {id, text} — mental disorders/conditions acquired during play

  notification: null,     // string message for the floating notification, or null when hidden
  lastRemovedBond: null,  // { bond, idx } for undo after removeSheetBond, or null

  editMode: false,        // true = character sheet edit mode (pen icon toggled)
  resourcesEditAdjust: 0, // integer offset to Resources rating applied in edit mode
  skillEditAdjust: {},    // skillName -> integer offset applied to skill values in edit mode
  attrEditAdjust: {       // integer offset per attribute applied in edit mode
    STR: 0, CON: 0, DEX: 0, INT: 0, POW: 0, CHA: 0,
  },

  identity: {
    name: '',
    profession: '',
    birthplace: '',
    characterAge: 25,
    backstory: '',
    motivations: [{text:'',crossed:false},{text:'',crossed:false},{text:'',crossed:false},{text:'',crossed:false},{text:'',crossed:false}],
    gear: '',
    terribleTomes: '',
    permanentInjuries: '',
    notes: '',
    weapons: [{}],
  },
};

// Drag state (module-level, not persisted)
let _dragRollId  = null;  // roll id being dragged
let _dragFromAttr = null; // attr key if dragging from a slot

// Counter for custom skill unique IDs
let _customSkillIdCounter = 0;

// Counter for disorder unique IDs
let _disorderIdCounter = 0;

// ── Utility ────────────────────────────────────────────────

function rollD6() { return Math.floor(Math.random() * 6) + 1; }
function rollD4()  { return Math.floor(Math.random() * 4) + 1; }
function rollD100() { return Math.floor(Math.random() * 100) + 1; }

function rollDice4d6() {
  return [rollD6(), rollD6(), rollD6(), rollD6()];
}

function keepHighest3(dice) {
  const sorted = [...dice].sort((a, b) => b - a);
  return sorted[0] + sorted[1] + sorted[2];
}

function rollAllAttributes() {
  state.rolledSets = Array.from({ length: 6 }, (_, i) => {
    const values = rollDice4d6();
    return { id: i, values, total: keepHighest3(values) };
  });
  // Clear assignments
  ATTRIBUTES.forEach(a => { state.attrAssign[a] = null; });
}

// Returns true if the die at `index` in `values` is the one dropped (lowest)
function isDieDropped(values, index) {
  const minVal = Math.min(...values);
  const firstMinIdx = values.indexOf(minVal);
  return index === firstMinIdx;
}

// Truncate text at word boundary to avoid mid-word cuts
function truncateWords(text, maxLength) {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.6 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

// Returns the display name for a skill, replacing "(Type)" with a user-specified type if set
function getSkillDisplayName(skillName) {
  if (!skillName.includes('(Type)')) return skillName;
  const customType = (state.skillTypes[skillName] || '').trim();
  return customType ? skillName.replaceAll('(Type)', '(' + customType + ')') : skillName;
}

// Returns the description for a skill from the current age-specific description map, or empty string if none.
function getSkillDescription(skillName) {
  const descriptions = state.age === 'jazz' ? JAZZ_SKILL_DESCRIPTIONS
    : state.age === 'coldwar' ? COLD_WAR_SKILL_DESCRIPTIONS
    : state.age === 'victorian' ? VICTORIAN_SKILL_DESCRIPTIONS
    : state.age === 'ww1' ? WWI_SKILL_DESCRIPTIONS
    : state.age === 'ww2' ? WWII_SKILL_DESCRIPTIONS
    : state.age === 'future' ? FUTURE_SKILL_DESCRIPTIONS
    : state.age === 'medieval' ? MEDIEVAL_SKILL_DESCRIPTIONS
    : state.age === 'classical' ? CLASSICAL_SKILL_DESCRIPTIONS
    : state.age === 'revolutions' ? REVOLUTIONS_SKILL_DESCRIPTIONS
    : state.age === 'sails' ? AGE_OF_SAILS_SKILL_DESCRIPTIONS
    : state.age === 'elizabethan' ? ELIZABETHAN_SKILL_DESCRIPTIONS
    : state.age === 'alazrad' ? AL_AZRAD_SKILL_DESCRIPTIONS
    : MODERN_SKILL_DESCRIPTIONS;
  return descriptions[skillName] || '';
}

// Returns a data-tooltip attribute string for a skill name element, or '' if no description.
function skillTooltipAttr(skillName) {
  const desc = getSkillDescription(skillName);
  return desc ? ` data-tooltip="${escapeHtml(desc)}"` : '';
}

// Returns a fresh bond object with default values.
function createEmptyBond() {
  return { name: '', type: null, bonusSpent: 0, currentScore: null, setToOne: false, upbringingReduction: 0 };
}

// Ensure state.bonds array has the correct length
function ensureBondsCount() {
  const count = getEffectiveBondsCount();
  while (state.bonds.length < count) state.bonds.push(createEmptyBond());
  while (state.bonds.length > count) state.bonds.pop();
}

function getUpbringingBonus(attrKey) {
  if (!state.upbringing || state.upbringing === 'normal') return 0;
  if (state.upbringing === 'harsh') {
    return state.harshStatChoice === attrKey ? 1 : 0;
  }
  if (state.upbringing === 'very_harsh') {
    return (attrKey === 'STR' || attrKey === 'CON') ? 1 : 0;
  }
  return 0;
}

// ── Points-based allocation helpers ─────────────────────────

const POINTS_TOTAL = 72;
const POINTS_ATTR_MIN = 3;
const POINTS_ATTR_MAX = 18;

function getAttrValue(attrKey) {
  let base;
  if (state.attrMode === 'points') {
    base = (state.pointsAttr[attrKey] || POINTS_ATTR_MIN) + getUpbringingBonus(attrKey);
  } else {
    const id = state.attrAssign[attrKey];
    if (id === null || id === undefined) return null;
    const rs = state.rolledSets.find(r => r.id === id);
    if (!rs) return null;
    base = rs.total + getUpbringingBonus(attrKey);
  }
  if (attrKey === 'CHA') base -= (state.upbringingChaReduction || 0);
  if (attrKey === 'POW') base -= (state.upbringingPowReduction || 0);
  return base;
}

// Returns the attribute value before any upbringing-effects-step reductions are applied.
// Used by canProceed and the upbringing effects render to check original CHA/POW thresholds.
function getOrigAttrValue(attrKey) {
  const current = getAttrValue(attrKey);
  if (current === null) return null;
  if (attrKey === 'CHA') return current + (state.upbringingChaReduction || 0);
  if (attrKey === 'POW') return current + (state.upbringingPowReduction || 0);
  return current;
}

function getAttrValues() {
  const out = {};
  ATTRIBUTES.forEach(a => { out[a] = getAttrValue(a); });
  return out;
}

// Returns the attribute value including any edit-mode adjustment (clamped to 3–18).
function getDisplayedAttrValue(attrKey) {
  const base = getAttrValue(attrKey);
  if (base === null) return null;
  const adj = (state.attrEditAdjust && state.attrEditAdjust[attrKey]) || 0;
  return Math.min(POINTS_ATTR_MAX, Math.max(POINTS_ATTR_MIN, base + adj));
}

function getDisplayedAttrValues() {
  const out = {};
  ATTRIBUTES.forEach(a => { out[a] = getDisplayedAttrValue(a); });
  return out;
}

function allAttributesAssigned() {
  if (state.attrMode === 'points') {
    return getPointsTotal() === POINTS_TOTAL;
  }
  return ATTRIBUTES.every(a => state.attrAssign[a] !== null && state.attrAssign[a] !== undefined);
}

function assignedRollIds() {
  return new Set(Object.values(state.attrAssign).filter(v => v !== null && v !== undefined));
}

function getPointsTotal() {
  return ATTRIBUTES.reduce((sum, a) => sum + (state.pointsAttr[a] || POINTS_ATTR_MIN), 0);
}

function getPointsRemaining() {
  return POINTS_TOTAL - getPointsTotal();
}

function switchAttrMode(mode) {
  state.attrMode = mode;
  if (mode === 'rolling') {
    // Clear rolls so user gets a fresh start
    state.rolledSets = [];
    ATTRIBUTES.forEach(a => { state.attrAssign[a] = null; });
  } else {
    // Reset points to default balanced allocation (12 each = 72 total)
    ATTRIBUTES.forEach(a => { state.pointsAttr[a] = 12; });
  }
  render();
}

function adjustPointsAttr(attrKey, delta) {
  const current = state.pointsAttr[attrKey] || POINTS_ATTR_MIN;
  const next = current + delta;
  if (next < POINTS_ATTR_MIN || next > POINTS_ATTR_MAX) return;
  const remaining = getPointsRemaining();
  if (delta > 0 && remaining < delta) return; // not enough points left
  state.pointsAttr[attrKey] = next;
  render();
}

function calculateDerived() {
  const v = getDisplayedAttrValues();
  if (!v.STR || !v.CON || !v.POW) return null;
  // SAN and BP use the base (un-edited) POW so that editing POW in attribute
  // edit mode does not alter SAN or the breaking point.
  const basePOW = getAttrValue('POW') || v.POW;
  const baseSAN = (state.upbringing === 'harsh' || state.upbringing === 'very_harsh')
    ? basePOW * 4
    : basePOW * 5;
  let DMG;
  if      (v.STR <= 4)  DMG = -2;
  else if (v.STR <= 8)  DMG = -1;
  else if (v.STR <= 12) DMG =  0;
  else if (v.STR <= 16) DMG = +1;
  else                  DMG = +2;
  // Use getDisplayedSkillValue so that Unnatural gains tracked via skillEditAdjust
  // (during play) are reflected in MaxSAN immediately.
  const unnaturalValue = getDisplayedSkillValue('Unnatural');
  const MaxSAN = 99 - unnaturalValue;
  // SAN and RecoverySAN can never exceed MaxSAN.
  const SAN = Math.min(baseSAN, MaxSAN);
  const BP = SAN - basePOW;
  return {
    HP:          Math.ceil((v.STR + v.CON) / 2),
    WP:          v.POW,
    SAN:         SAN,
    BP:          BP,
    DMG:         DMG,
    MaxSAN:      MaxSAN,
    RecoverySAN: Math.min(v.POW * 5, MaxSAN),
  };
}

// ── Societal Class (Age of Revolutions and future eras) ──────

// Returns true for eras that use the Societal Class mechanic.
function hasSocietalClass() {
  return state.age === 'revolutions' || state.age === 'sails' || state.age === 'elizabethan';
}

// Calculates Societal Class for eras that use it.
// Returns { score, label } or null if not applicable.
// Rules (Age of Revolutions cheat sheet):
//   A. Highest displayed value among social-standing skills
//   B. Highest community bond score × 5
//   C. Take the larger of A and B; average with Resources × 5
//   D. Map score to label
function calculateSocietalClass() {
  if (!hasSocietalClass()) return null;

  const skills = getCurrentSkills();

  // Step A: highest of social-standing skills
  // Use the base final value (archetype + picks + edit), not the exhausted display value.
  // 'Medicine' is specified by the Age of Revolutions rules even though it's not a default
  // era skill; it would apply for characters who add it as a custom skill.
  // Age of Sails uses different societal class skills: Apothecary, Law (Type), Militaria (Type),
  // Religion (Type), Social Etiquette.
  // Elizabethan Age uses: Apothecary, Literacy, Religion (Type), Social Etiquette.
  const socialSkillNames = state.age === 'sails'
    ? ['Apothecary', 'Law (Type)', 'Militaria (Type)', 'Religion (Type)', 'Social Etiquette']
    : state.age === 'elizabethan'
    ? ['Apothecary', 'Literacy', 'Religion (Type)', 'Social Etiquette']
    : ['Bootlick', 'Medicine', 'Militaria (Type)', 'Religion (Type)', 'Social Etiquette'];
  let stepA = 0;
  socialSkillNames.forEach(sName => {
    if (sName in skills) {
      const val = Math.min(99, Math.max(0, getFinalSkillValue(sName) + (state.skillEditAdjust[sName] || 0)));
      stepA = Math.max(stepA, val);
    }
    // Also check custom skills whose name contains the base name (without the type)
    const baseName = sName.replace(' (Type)', '');
    (state.customSkills || []).forEach(cs => {
      if ((cs.customName || '').toLowerCase().includes(baseName.toLowerCase())) {
        const editAdj = state.skillEditAdjust[`custom_${cs.id}`] || 0;
        const val = Math.min(99, Math.max(0, getFinalCustomSkillValue(cs) + editAdj));
        stepA = Math.max(stepA, val);
      }
    });
  });

  // Step B: highest community bond score × 5
  let stepB = 0;
  (state.bonds || []).filter(b => b && b.type === 'community').forEach(b => {
    const score = getBondPlayScore(b);
    if (score !== null) stepB = Math.max(stepB, score * 5);
  });

  // Step C: larger of A or B, averaged with Resources × 5
  const larger = Math.max(stepA, stepB);
  const resScore = getDisplayedResources() * 5;
  const statusScore = Math.round((larger + resScore) / 2);

  // Step D: map to label
  let label;
  if (statusScore >= 90)      label = 'High Nobility / Privileged';
  else if (statusScore >= 80) label = 'Nobility / Privilege';
  else if (statusScore >= 70) label = 'Upper Class';
  else if (statusScore >= 50) label = 'Middle Class';
  else if (statusScore >= 30) label = 'Lower Class';
  else                        label = 'The Poor';

  return { score: statusScore, label };
}

// ── Effective HP / WP / SAN (current tracking) ─────────────

function getEffectiveHP() {
  const d = calculateDerived();
  if (!d) return null;
  if (state.currentHP === null) return d.HP;
  return Math.max(0, Math.min(state.currentHP, d.HP));
}

function getEffectiveWP() {
  const d = calculateDerived();
  if (!d) return null;
  if (state.currentWP === null) return d.WP;
  return Math.max(0, Math.min(state.currentWP, d.WP));
}

function getHPStatusClass(hp) {
  if (hp <= 0) return ' val-critical';
  if (hp <= 2) return ' val-low';
  return '';
}

function getHPBadgeContent(hp) {
  if (hp <= 0) return '<span class="stat-status-badge stat-status-critical" data-tooltip="The protagonist is dead, may they rest in peace.">Dead</span>';
  if (hp <= 2) return '<span class="stat-status-badge stat-status-low" data-tooltip="At 2 HP, your Protagonist falls unconscious.">Unconscious</span>';
  return '';
}

function getWPStatusClass(wp) {
  if (wp <= 0) return ' val-critical';
  if (wp <= 2) return ' val-low';
  return '';
}

function getWPBadgeContent(wp) {
  if (wp <= 0) return '<span class="stat-status-badge stat-status-critical" data-tooltip="A Protagonist at 0 WP loses all control. This can look different for every Protagonist and every situation. The Protagonist might collapse in wracking sobs, or lash out wildly, or simply pass out. The Game Moderator controls your Protagonist until WP returns to 1 or higher and describes the reaction. A Protagonist with 0 WP cannot succeed at any tests, including SAN tests. Sooner or later the Protagonist falls asleep, regardless of any disorders or stimulants, long enough to regain WP.">Lose Control</span>';
  if (wp <= 2) return '<span class="stat-status-badge stat-status-low" data-tooltip="A Protagonist whose WP hits 1 or 2 has an emotional breakdown. The Protagonist suffers a −20% penalty to all actions until their WP rises above 2.">Temp. Emotional Collapse</span>';
  return '';
}

function getEffectiveSAN() {
  const d = calculateDerived();
  if (!d) return null;
  if (state.currentSAN === null) return d.SAN;
  return Math.max(0, Math.min(state.currentSAN, d.MaxSAN));
}

const DISTINGUISHING_FEATURES = {
  STR: ['Feeble',        'Weak',    null, 'Muscular',      'Huge'],
  CON: ['Bedridden',     'Sickly',  null, 'Perfect Health','Indefatigable'],
  DEX: ['Barely Mobile', 'Clumsy',  null, 'Nimble',        'Acrobatic'],
  INT: ['Imbecilic',     'Slow',    null, 'Perceptive',    'Brilliant'],
  POW: ['Spineless',     'Nervous', null, 'Strong-Willed', 'Indomitable'],
  CHA: ['Unbearable',    'Awkward', null, 'Charming',      'Magnetic'],
};

function getDistinguishingFeature(attrKey, value) {
  if (!value) return null;
  const features = DISTINGUISHING_FEATURES[attrKey];
  if (!features) return null;
  if (value <= 4)  return features[0];
  if (value <= 8)  return features[1];
  if (value <= 12) return features[2]; // null = Average
  if (value <= 16) return features[3];
  return features[4];
}

function getCurrentSkills() {
  if (state.age === 'jazz')         return JAZZ_SKILLS;
  if (state.age === 'coldwar')      return COLD_WAR_SKILLS;
  if (state.age === 'victorian')    return VICTORIAN_SKILLS;
  if (state.age === 'ww1')          return WWI_SKILLS;
  if (state.age === 'ww2')          return WWII_SKILLS;
  if (state.age === 'future')       return FUTURE_SKILLS;
  if (state.age === 'medieval')     return MEDIEVAL_SKILLS;
  if (state.age === 'classical')    return CLASSICAL_SKILLS;
  if (state.age === 'revolutions')  return REVOLUTIONS_SKILLS;
  if (state.age === 'sails')        return AGE_OF_SAILS_SKILLS;
  if (state.age === 'elizabethan')  return ELIZABETHAN_SKILLS;
  if (state.age === 'alazrad')      return AL_AZRAD_SKILLS;
  return MODERN_SKILLS;
}

function getArchetype() {
  if (!state.archetype) return null;
  return ARCHETYPES.find(a => a.id === state.archetype) || null;
}

function getArchetypeSkillBonus(skillName) {
  const arch = getArchetype();
  if (!arch) return 0;
  const base = getCurrentSkills()[skillName] || 0;
  // Check fixed archetypal skills
  const arcSkill = arch.archetypeSkills.find(s => s.name === skillName);
  if (arcSkill) return Math.max(0, arcSkill.value - base);
  // Check chosen optional skills
  const optSkill = arch.optionalSkills.find(s => s.name === skillName && state.selectedOptional.includes(s.name));
  if (optSkill) return Math.max(0, optSkill.value - base);
  return 0;
}

function getFinalSkillValue(skillName) {
  const base = (getCurrentSkills()[skillName] || 0);
  if (skillName === 'Unnatural') return base; // cannot be increased with picks
  const archBonus = getArchetypeSkillBonus(skillName);
  const bpPicks  = state.skillPoints[skillName] || 0;
  const advPicks = state.adversityPoints[skillName] || 0;
  return Math.min(80, base + archBonus + (bpPicks + advPicks) * 20);
}

// Returns the displayed skill value including any edit-mode adjustment and exhaustion penalty.
function getDisplayedSkillValue(skillName) {
  const base = getFinalSkillValue(skillName);
  const editAdj = state.skillEditAdjust[skillName] || 0;
  const exhaustPenalty = state.exhausted ? -20 : 0;
  return Math.min(99, Math.max(0, base + editAdj + exhaustPenalty));
}

function initSkills() {
  const skills = getCurrentSkills();
  const fresh = {};
  Object.keys(skills).forEach(s => { fresh[s] = 0; });
  state.skillPoints = fresh;
  state.skillTypes = {};
  state.customSkills = [];
  state.resourcesBonusSpent = 0;
  state.resourcesSetToZero = false;
  state.adversityPoints = {};
  getAdversitySkills().forEach(s => { state.adversityPoints[s] = 0; });
  // Reset community bond bonus picks and setToOne toggles
  state.bonds.forEach(b => { if (b && typeof b === 'object') { b.bonusSpent = 0; b.setToOne = false; } });
}

function getBonusPointsTotal() {
  // Fixed at 10 per SKILL.md: "Every Protagonist starts with 10 Bonus Picks"
  // +1 pick for sacrificing Resources (setting to 0)
  // +1 pick per Community Bond sacrificed (set to score of 1)
  let total = 10;
  if (state.resourcesSetToZero) total += 1;
  total += (state.bonds || []).filter(b => b && b.type === 'community' && b.setToOne).length;
  return total;
}

function getBonusPointsSpent() {
  const skillPicks = Object.values(state.skillPoints).reduce((s, v) => s + v, 0);
  const bondPicks  = state.bonds.reduce((s, b) => s + (b && b.bonusSpent ? b.bonusSpent : 0), 0);
  const customPicks = (state.customSkills || []).reduce((s, cs) => s + (cs.points || 0), 0);
  return skillPicks + state.resourcesBonusSpent + bondPicks + customPicks;
}

function getBonusPointsRemaining() {
  return getBonusPointsTotal() - getBonusPointsSpent();
}

function getEffectiveBondsCount() {
  const arch = getArchetype();
  if (!arch) return 0;
  return arch.bonds;
}

function getEffectiveResources() {
  const arch = getArchetype();
  if (!arch) return 0;
  // If resources are sacrificed for a bonus pick, resources = 0
  if (state.resourcesSetToZero) return 0;
  const base = arch.resources;
  // Per SKILL.md: first Bonus Pick on Resources adds +5; each subsequent pick adds +2
  let bonus = 0;
  if (state.resourcesBonusSpent > 0) {
    bonus = 5 + (state.resourcesBonusSpent - 1) * 2;
  }
  return base + bonus;
}

// Returns the displayed Resources rating, including any edit-mode adjustment.
function getDisplayedResources() {
  const base = getEffectiveResources();
  return Math.max(0, base + (state.resourcesEditAdjust || 0));
}

// Returns the Resources capacity for a given rating per SKILL.md table.
function getResourcesCapacity(rating) {
  if (rating <= 0)  return { atHand: 0, stowed: 0, inStorage: 0, checkboxes: 0 };
  if (rating <= 6)  return { atHand: rating, stowed: 0, inStorage: 0, checkboxes: 1 };
  if (rating <= 12) return { atHand: 6, stowed: rating - 6, inStorage: 0, checkboxes: 2 };
  return { atHand: 6, stowed: 6, inStorage: Math.min(8, rating - 12), checkboxes: 3 };
}

// Returns the effective numeric value of a bond object.
// Individual bonds are tied to CHA; Community bonds are Resources÷2 plus bonus from picks.
// Returns the bond value before any upbringing reductions are applied.
function getBondPreReductionValue(bond) {
  if (!bond || !bond.type) return null;
  let value;
  if (bond.type === 'individual') {
    value = getAttrValue('CHA');
  } else {
    // Community bond sacrificed for a bonus pick: score is fixed at 1
    if (bond.setToOne) {
      value = 1;
    } else {
      // Community bond: base is Resources÷2, bonus per SKILL.md
      const base = Math.floor(getEffectiveResources() / 2);
      const n = bond.bonusSpent || 0;
      const bonus = n > 0 ? 5 + (n - 1) * 2 : 0;
      value = base + bonus;
    }
  }
  return Math.min(20, Math.max(0, value));
}

function getBondEffectiveValue(bond) {
  const base = getBondPreReductionValue(bond);
  if (base === null) return null;
  return Math.min(20, Math.max(0, base - (bond.upbringingReduction || 0)));
}

// Returns the current in-play bond score (respects damage tracked via currentScore).
function getBondPlayScore(bond) {
  if (!bond) return null;
  if (bond.currentScore !== null && bond.currentScore !== undefined) return bond.currentScore;
  return getBondEffectiveValue(bond);
}

// Returns the status label and tooltip for a community bond based on its score.
function getCommunityBondStatus(score) {
  if (score <= 0)  return { label: 'Broken',                       tooltip: 'This bond has been broken, the relationship is damaged beyond repair.' };
  if (score <= 1)  return { label: 'Disgraced member',             tooltip: 'On the verge of being banished from the society.' };
  if (score <= 4)  return { label: 'Shunned member',               tooltip: 'Someone who is actively looked down on by most.' };
  if (score <= 8)  return { label: 'Standard member',              tooltip: 'One of the pack, whose opinion is unlikely to matter.' };
  if (score <= 12) return { label: 'Well-regarded member',         tooltip: 'Favourably viewed by many other members.' };
  if (score <= 16) return { label: 'Important member',             tooltip: 'Respected by most other members.' };
  if (score <= 18) return { label: 'Influential member',           tooltip: 'Involved in most decision-making; liked by most.' };
  if (score <= 19) return { label: 'Extremely influential member', tooltip: 'Of the community, looked up to by virtually everyone.' };
  return                  { label: 'Top-tier member',              tooltip: 'Top of leadership in the community; the head honcho.' };
}

// Returns the HTML for a community bond status badge, or '' for non-community bonds.
function renderBondStatusBadge(bond, playScore) {
  if (playScore === null) return '';
  if (playScore === 0) {
    return `<span class="bond-status-badge bond-broken" data-tooltip="This bond has been broken, the relationship is damaged beyond repair.">Broken</span>`;
  }
  if (bond.type !== 'community') return '';
  const s = getCommunityBondStatus(playScore);
  return `<span class="bond-status-badge" data-tooltip="${escapeHtml(s.tooltip)}">${escapeHtml(s.label)}</span>`;
}

// Adjusts the in-play bond score by delta (clamped to 0).
function adjustBondPlayScore(idx, delta) {
  const bond = state.bonds[idx];
  if (!bond) return;
  const current = getBondPlayScore(bond);
  if (current === null) return;
  const maxScore = bond.type === 'individual' ? (getAttrValue('CHA') ?? 20) : 20;
  if (delta > 0 && bond.type === 'individual' && current >= maxScore) {
    showNotification("You can't raise a personal bond more than CHA.");
    return;
  }
  bond.currentScore = Math.min(maxScore, Math.max(0, current + delta));
  render();
}

function showNotification(message) {
  state.notification = message;
  render();
}

function closeNotification() {
  state.notification = null;
  state.lastRemovedBond = null;
  render();
}

function renderNotification() {
  const undoBtn = state.lastRemovedBond
    ? `<button class="floating-notification-undo" onclick="undoRemoveBond()" aria-label="Undo remove bond">UNDO</button>`
    : '';
  return `<div class="floating-notification" role="alert">
    <span>${escapeHtml(state.notification)}</span>
    ${undoBtn}
    <button class="floating-notification-close" onclick="closeNotification()" aria-label="Close notification">✕</button>
  </div>`;
}

// Adjusts the Breaking Point by a manual offset.
function adjustBP(delta) {
  state.bpAdjust = (state.bpAdjust || 0) + delta;
  render();
}

// Adjusts the Body Armour value in edit mode (clamped to 0–20).
function adjustBodyArmour(delta) {
  state.bodyArmour = Math.min(20, Math.max(0, (state.bodyArmour || 0) + delta));
  render();
}

// Toggles Edit Mode on/off.
function toggleEditMode() {
  state.editMode = !state.editMode;
  render();
}

// Adjusts the Resources rating in edit mode.
function adjustResourcesInEditMode(delta) {
  const base = getEffectiveResources();
  const current = base + (state.resourcesEditAdjust || 0);
  const newVal = Math.max(0, current + delta);
  state.resourcesEditAdjust = newVal - base;
  render();
}

// Adjusts a skill value in edit mode.
function adjustSkillInEditMode(skillName, delta) {
  const current = state.skillEditAdjust[skillName] || 0;
  const base = getFinalSkillValue(skillName);
  const newAdj = current + delta;
  // Clamp so total skill value stays between 0 and 99
  if (base + newAdj < 0) return;
  if (base + newAdj > 99) return;
  state.skillEditAdjust[skillName] = newAdj;
  render();
}

// Adjusts a custom skill value in edit mode (no bonus-pick restriction).
function adjustCustomSkillInEditMode(id, delta) {
  const cs = state.customSkills.find(s => s.id === id);
  if (!cs) return;
  const key = `custom_${id}`;
  const base = getFinalCustomSkillValue(cs);
  const current = state.skillEditAdjust[key] || 0;
  const newAdj = current + delta;
  if (base + newAdj < 0) return;
  if (base + newAdj > 99) return;
  state.skillEditAdjust[key] = newAdj;
  render();
}

// Adjusts an attribute value in edit mode (clamped to 3–18).
function adjustAttrInEditMode(attrKey, delta) {
  const base = getAttrValue(attrKey);
  if (base === null) return;
  const current = (state.attrEditAdjust[attrKey] || 0);
  const newVal = base + current + delta;
  if (newVal < 3 || newVal > 18) return;
  state.attrEditAdjust[attrKey] = current + delta;
  render();
}

// ── Motivations ─────────────────────────────────────────────

function makeDefaultMotivations() {
  return [{text:'',crossed:false},{text:'',crossed:false},{text:'',crossed:false},{text:'',crossed:false},{text:'',crossed:false}];
}

function makeEmptyWeaponRow() {
  return { weapon: '', skill: '', baseRange: '', damage: '', ap: '', condition: '', lethality: '', killRadius: '', ammo: '' };
}

function getWeaponSkills() {
  switch (state.age) {
    case 'coldwar':
      return ['Athletics', 'Firearms', 'Martial Arts', 'Melee Weapons', 'Military Training (Type)', 'Unarmed Combat'];
    case 'ww1':
    case 'ww2':
      return ['Artillery', 'Athletics', 'Firearms', 'Heavy Weapons', 'Melee Weapons', 'Military Science', 'Unarmed Combat'];
    case 'future':
      return ['Athletics', 'Firearms / Beam Weapons', 'Melee Weapons', 'Military Training (Type)', 'Unarmed Combat'];
    case 'medieval':
    case 'classical':
      return ['Athletics', 'Melee Weapons', 'Ranged Weapons', 'Siege Weapons', 'Unarmed Combat'];
    case 'revolutions':
    case 'sails':
    case 'elizabethan':
      return ['Athletics', 'Firearms', 'Melee Weapons', 'Ordnance', 'Ranged Weapons', 'Unarmed Combat'];
    case 'alazrad':
      return ['Athletics', 'Melee Weapons', 'Ranged Weapons', 'Siege Weapons', 'Unarmed Combat'];
    default: // jazz, modern, victorian and any other era
      return ['Athletics', 'Firearms', 'Melee Weapons', 'Military Training (Type)', 'Unarmed Combat'];
  }
}

function isMeleeOrUnarmedWeaponSkill(skillName) {
  return skillName === 'Melee Weapons' || skillName === 'Unarmed Combat';
}

function ensureTrailingBlankWeaponRow() {
  if (!Array.isArray(state.identity.weapons)) state.identity.weapons = [{}];
  const rows = state.identity.weapons;
  const last = rows[rows.length - 1] || {};
  const empty = makeEmptyWeaponRow();
  const isBlank = Object.keys(empty).every(k => !last[k]);
  if (!isBlank) { rows.push({}); return true; }
  return false;
}

function renderWeaponRow(row, i) {
  const weaponSkills = getWeaponSkills();
  const dmg = calculateDerived();
  const dmgBonus = dmg ? dmg.DMG : 0;
  const dmgBonusStr = dmgBonus > 0 ? `+${dmgBonus}` : `${dmgBonus}`;
  const skillVal = row.skill ? getDisplayedSkillValue(row.skill) : null;
  const skillPct = (row.skill && skillVal !== null) ? `${skillVal}%` : '';
  const showDb = isMeleeOrUnarmedWeaponSkill(row.skill || '');
  const dbDisplay = showDb ? dmgBonusStr : '';
  return `<tr>
    <td><input class="wpn-input" type="text" value="${escapeHtml(row.weapon || '')}" oninput="updateWeaponField(${i},'weapon',this.value)" aria-label="Weapon name row ${i+1}" /></td>
    <td class="wpn-skill-cell">
      <select class="wpn-skill-select" onchange="updateWeaponField(${i},'skill',this.value)" aria-label="Skill row ${i+1}">
        <option value="">—</option>
        ${weaponSkills.map(s => `<option value="${escapeHtml(s)}"${row.skill === s ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}
      </select>
      <span class="wpn-skill-pct">${skillPct}</span>
    </td>
    <td><input class="wpn-input" type="text" value="${escapeHtml(row.baseRange || '')}" oninput="updateWeaponField(${i},'baseRange',this.value)" aria-label="Base range row ${i+1}" /></td>
    <td><input class="wpn-input" type="text" value="${escapeHtml(row.damage || '')}" oninput="updateWeaponField(${i},'damage',this.value)" aria-label="Damage row ${i+1}" /></td>
    <td class="wpn-db-cell">${escapeHtml(dbDisplay)}</td>
    <td><input class="wpn-input" type="text" value="${escapeHtml(row.ap || '')}" oninput="updateWeaponField(${i},'ap',this.value)" aria-label="AP row ${i+1}" /></td>
    <td class="wpn-cond-cell"><input type="checkbox" class="wpn-cond-cb" ${(row.condition||'')==='pristine' ? 'checked' : ''} onchange="updateWeaponCondition(${i},'pristine')" aria-label="Pristine row ${i+1}" /></td>
    <td class="wpn-cond-cell"><input type="checkbox" class="wpn-cond-cb" ${(row.condition||'')==='worn' ? 'checked' : ''} onchange="updateWeaponCondition(${i},'worn')" aria-label="Worn row ${i+1}" /></td>
    <td class="wpn-cond-cell"><input type="checkbox" class="wpn-cond-cb" ${(row.condition||'')==='junk' ? 'checked' : ''} onchange="updateWeaponCondition(${i},'junk')" aria-label="Junk row ${i+1}" /></td>
    <td><input class="wpn-input" type="text" value="${escapeHtml(row.lethality || '')}" oninput="updateWeaponField(${i},'lethality',this.value)" aria-label="Lethality row ${i+1}" /></td>
    <td><input class="wpn-input" type="text" value="${escapeHtml(row.killRadius || '')}" oninput="updateWeaponField(${i},'killRadius',this.value)" aria-label="Kill radius row ${i+1}" /></td>
    <td><input class="wpn-input" type="text" value="${escapeHtml(row.ammo || '')}" oninput="updateWeaponField(${i},'ammo',this.value)" aria-label="Ammo row ${i+1}" /></td>
  </tr>`;
}

function updateWeaponField(rowIdx, field, value) {
  if (!Array.isArray(state.identity.weapons)) state.identity.weapons = [{}];
  if (!state.identity.weapons[rowIdx]) return;
  state.identity.weapons[rowIdx][field] = value;
  const rowAdded = ensureTrailingBlankWeaponRow();
  if (field === 'skill') {
    // Re-render to update the % display and (db) cell.
    render();
  } else if (rowAdded) {
    // A new blank row was appended to state. Insert only that row into the DOM
    // so the focused input is never destroyed.
    const tbody = document.querySelector('.sheet-weapons-table tbody');
    if (tbody) {
      const newIdx = state.identity.weapons.length - 1;
      tbody.insertAdjacentHTML('beforeend', renderWeaponRow({}, newIdx));
    }
  }
}

function updateWeaponCondition(rowIdx, value) {
  if (!Array.isArray(state.identity.weapons)) state.identity.weapons = [{}];
  if (!state.identity.weapons[rowIdx]) return;
  const current = state.identity.weapons[rowIdx].condition || '';
  // radio-group behaviour: toggle off if already selected
  state.identity.weapons[rowIdx].condition = current === value ? '' : value;
  ensureTrailingBlankWeaponRow();
  render();
}

function updateMotivation(index, value) {
  if (!Array.isArray(state.identity.motivations)) return;
  if (state.identity.motivations[index]) {
    state.identity.motivations[index].text = value;
  }
}

function toggleMotivationCrossed(index) {
  if (!Array.isArray(state.identity.motivations)) return;
  if (state.identity.motivations[index]) {
    state.identity.motivations[index].crossed = !state.identity.motivations[index].crossed;
    render();
  }
}

function startEditMotivation(index) {
  const elemId = 'motivation-text-' + index;
  const span = document.getElementById(elemId);
  if (!span || span.tagName === 'INPUT') return;

  const motivations = state.identity.motivations;
  const current = (Array.isArray(motivations) && motivations[index]) ? motivations[index].text : '';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'motivation-edit-input';
  input.placeholder = 'Describe a motivation…';

  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    finishEditMotivation(index, input);
  };

  const cancel = () => {
    if (finished) return;
    finished = true;
    input.replaceWith(createMotivationSpan(index, current));
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });

  span.replaceWith(input);
  input.focus();
  input.select();
}

function finishEditMotivation(index, input) {
  const newVal = input.value;
  if (Array.isArray(state.identity.motivations) && state.identity.motivations[index]) {
    state.identity.motivations[index].text = newVal;
  }
  input.replaceWith(createMotivationSpan(index, newVal));
}

function createMotivationSpan(index, text) {
  const span = document.createElement('span');
  span.className = 'motivation-text';
  span.id = 'motivation-text-' + index;
  span.title = 'Double-click to edit';
  if (text) {
    span.textContent = text;
  } else {
    const em = document.createElement('span');
    em.className = 'motivation-empty';
    em.textContent = '—';
    span.appendChild(em);
  }
  span.addEventListener('dblclick', () => startEditMotivation(index));
  return span;
}

// ── Disorders ───────────────────────────────────────────────

function addDisorder() {
  state.disorders.push({ id: ++_disorderIdCounter, text: '' });
  render();
}

function removeDisorder(id) {
  state.disorders = state.disorders.filter(d => d.id !== id);
  render();
}

function updateDisorderText(id, value) {
  const d = state.disorders.find(d => d.id === id);
  if (d) d.text = value;
}

// ── Upbringing Effects (Step 4.5) ──────────────────────────

// Resets all upbringing-effects-step state (called when navigating back to step 4).
function resetUpbringingEffectsState() {
  state.harshD4Rolls    = null;
  state.harshBondChoice1 = null;
  state.harshBondChoice2 = null;
  if (state.vhPowDisorderId !== null) {
    state.disorders = state.disorders.filter(d => d.id !== state.vhPowDisorderId);
  }
  state.vhPowTestRoll   = null;
  state.vhPowDisorderId = null;
  state.vhAdaptedTo     = null;
  state.vhAdaptRoll     = null;
  state.upbringingChaReduction = 0;
  state.upbringingPowReduction = 0;
  state.bonds.forEach(b => { if (b) b.upbringingReduction = 0; });
  state.violenceChecked     = [false, false, false];
  state.helplessnessChecked = [false, false, false];
}

// Rolls two d4s for Harsh upbringing bond deductions.
function rollHarshD4s() {
  state.harshD4Rolls    = [rollD4(), rollD4()];
  state.harshBondChoice1 = null;
  state.harshBondChoice2 = null;
  state.bonds.forEach(b => { if (b) b.upbringingReduction = 0; });
  render();
}

// Selects which bond to apply a Harsh d4 deduction to (rollIndex = 0 or 1).
function selectHarshBondChoice(rollIndex, bondIndex) {
  if (!state.harshD4Rolls) return;
  const isDeselect = isNaN(bondIndex) || bondIndex === '' || bondIndex === null;
  // Prevent selecting the same bond for both dice when multiple bonds exist.
  const otherChoice = rollIndex === 0 ? state.harshBondChoice2 : state.harshBondChoice1;
  if (!isDeselect && otherChoice != null && otherChoice === bondIndex && state.bonds.length > 1) return;
  const roll = state.harshD4Rolls[rollIndex];
  const prevChoice = rollIndex === 0 ? state.harshBondChoice1 : state.harshBondChoice2;
  if (prevChoice !== null && prevChoice !== undefined && state.bonds[prevChoice]) {
    state.bonds[prevChoice].upbringingReduction = Math.max(0, (state.bonds[prevChoice].upbringingReduction || 0) - roll);
  }
  if (!isDeselect && state.bonds[bondIndex]) {
    state.bonds[bondIndex].upbringingReduction = (state.bonds[bondIndex].upbringingReduction || 0) + roll;
  }
  const newChoice = isDeselect ? null : bondIndex;
  if (rollIndex === 0) state.harshBondChoice1 = newChoice;
  else                 state.harshBondChoice2 = newChoice;
  render();
}

// Rolls d100 for the Very Harsh POW × 4 test.
function rollVhPowTest() {
  const origPow = getOrigAttrValue('POW') || 0;
  state.vhPowTestRoll = rollD100();
  if (state.vhPowTestRoll > origPow * 4) {
    const newDisorder = { id: ++_disorderIdCounter, text: '' };
    state.disorders.push(newDisorder);
    state.vhPowDisorderId = newDisorder.id;
  } else {
    state.vhPowDisorderId = null;
  }
  render();
}

// Selects the adaptation type for Very Harsh Part 2.
function selectVhAdaptation(adaptationType) {
  if (state.vhAdaptedTo === adaptationType) return;
  if (state.vhAdaptRoll !== null) {
    state.upbringingChaReduction = 0;
    state.upbringingPowReduction = 0;
    state.bonds.forEach(b => { if (b) b.upbringingReduction = 0; });
    state.violenceChecked     = [false, false, false];
    state.helplessnessChecked = [false, false, false];
    state.vhAdaptRoll = null;
  }
  state.vhAdaptedTo = adaptationType;
  render();
}

// Rolls 1d6 for the Very Harsh adaptation effect and applies the result.
function rollVhAdaptDice() {
  const roll = rollD6();
  state.vhAdaptRoll = roll;
  if (state.vhAdaptedTo === 'violence') {
    state.upbringingChaReduction = roll;
    state.bonds.forEach(b => { if (b) b.upbringingReduction = (b.upbringingReduction || 0) + roll; });
    state.violenceChecked = [true, true, true];
  } else if (state.vhAdaptedTo === 'helplessness') {
    state.upbringingPowReduction = roll;
    state.helplessnessChecked = [true, true, true];
  }
  render();
}

// ── Adversity Picks ─────────────────────────────────────────

function getAdversitySkills() {
  if (state.age === 'victorian') {
    return ['First Aid', 'Scavenge', 'Streetwise (Type)', 'Survival (Type)'];
  }
  if (state.age === 'ww1' || state.age === 'ww2') {
    return ['First Aid', 'Regional Lore (Type)', 'Scavenge', 'Survival (Type)'];
  }
  if (state.age === 'future') {
    return ['First Aid', 'Military Training (Type)', 'Planet/Station Lore (Type)', 'Survival (Type)'];
  }
  if (state.age === 'medieval' || state.age === 'classical' || state.age === 'elizabethan') {
    return ['Carouse', 'First Aid', 'Foreign Court/Kingdom (Type)', 'Scavenge'];
  }
  if (state.age === 'revolutions' || state.age === 'sails') {
    return ['Carouse', 'First Aid', 'Scavenge', 'Survival (Type)'];
  }
  if (state.age === 'alazrad') {
    return ['Carouse', 'First Aid', 'Forage/Hunt', 'Regional Lore (Type)'];
  }
  return ['First Aid', 'Military Training (Type)', 'Regional Lore (Type)', 'Survival (Type)'];
}

function getAdversityTotal() {
  if (state.upbringing === 'harsh')      return 1;
  if (state.upbringing === 'very_harsh') return 2;
  return 0;
}

function getAdversitySpent() {
  return Object.values(state.adversityPoints).reduce((s, v) => s + v, 0);
}

function getAdversityRemaining() {
  return getAdversityTotal() - getAdversitySpent();
}

// ── Validation ─────────────────────────────────────────────

function canProceed(step) {
  switch (step) {
    case 1: return !!state.age;
    case 2: {
      if (!allAttributesAssigned()) return false;
      if (!state.upbringing) return false;
      if (state.upbringing === 'harsh' && !state.harshStatChoice) return false;
      return true;
    }
    case 3: {
      if (!state.archetype) return false;
      const arch = getArchetype();
      return arch && state.selectedOptional.length === arch.optionalCount;
    }
    case 4: {
      const bpOk  = getBonusPointsRemaining() === 0;
      const advOk = getAdversityRemaining() === 0;
      const bondsOk = state.bonds.length > 0 && state.bonds.every(b => b.type !== null && b.name.trim() !== '');
      return bpOk && advOk && bondsOk;
    }
    case 4.5: {
      if (state.upbringing === 'harsh') {
        // Use original CHA/POW (before any reductions) to decide if the effect applies
        const origCha = getOrigAttrValue('CHA') || 0;
        const origPow = getOrigAttrValue('POW') || 0;
        if (origCha < 7 || origPow < 7) {
          return (
            state.harshD4Rolls !== null &&
            state.harshBondChoice1 !== null &&
            state.harshBondChoice2 !== null
          );
        }
        return true;
      }
      if (state.upbringing === 'very_harsh') {
        if (state.vhPowTestRoll === null) return false;
        // Part 2: check original CHA/POW
        const origCha = getOrigAttrValue('CHA') || 0;
        const origPow = getOrigAttrValue('POW') || 0;
        if (origCha < 10 || origPow < 10) {
          return state.vhAdaptedTo !== null && state.vhAdaptRoll !== null;
        }
        return true;
      }
      return true;
    }
    case 5: return true; // motivations & backstory are optional
    case 6: return true;
    default: return false;
  }
}

// ── Routing ────────────────────────────────────────────────

function goToStep(n) {
  state.currentStep = n;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  if (canProceed(state.currentStep)) {
    // Side effects on transition
    if (state.currentStep === 3) {
      // Entering step 4 — init skills & bonds
      initSkills();
      ensureBondsCount();
      state.resources = getEffectiveResources();
    }
    // Route through upbringing effects step for Harsh / Very Harsh
    if (state.currentStep === 4 && (state.upbringing === 'harsh' || state.upbringing === 'very_harsh')) {
      resetUpbringingEffectsState();
      goToStep(4.5);
      return;
    }
    if (state.currentStep === 4.5) {
      goToStep(5);
      return;
    }
    goToStep(state.currentStep + 1);
  }
}

function prevStep() {
  // Leaving step 4.5 going backwards — reset all upbringing effects
  if (state.currentStep === 4.5) {
    resetUpbringingEffectsState();
    goToStep(4);
    return;
  }
  // Going back from step 5 — route through 4.5 for Harsh / Very Harsh
  if (state.currentStep === 5 && (state.upbringing === 'harsh' || state.upbringing === 'very_harsh')) {
    goToStep(4.5);
    return;
  }
  if (state.currentStep > 1) {
    // Going back to step 1 — clear era selection so the user starts fresh
    if (state.currentStep === 2) {
      state.age = null;
      state.archetype = null;
      state.selectedOptional = [];
    }
    goToStep(state.currentStep - 1);
  }
}

// ── Icon helpers ────────────────────────────────────────────

function checkIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline></svg>`;
}

function resourcePips(count, filled) {
  let html = '<div class="arch-resources">';
  for (let i = 1; i <= 4; i++) {
    html += `<div class="dot ${i <= filled ? 'filled' : ''}"></div>`;
  }
  html += '</div>';
  return html;
}

// ── RENDER: Stepper ─────────────────────────────────────────

function renderStepper() {
  return `
  <div class="stepper no-print" role="navigation" aria-label="Steps">
    ${STEPS.map(s => {
      const done   = s.id < state.currentStep;
      const active = s.id === state.currentStep;
      const cls    = done ? 'done' : active ? 'active' : '';
      const circleContent = done
        ? `<svg style="width:14px;height:14px;stroke:#7effa0;fill:none;stroke-width:3;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        : s.id;
      return `
        <div class="step-item ${cls}" aria-current="${active ? 'step' : 'false'}">
          <div class="step-circle">${circleContent}</div>
          <div class="step-label">Step ${s.id}<br/>${s.label}</div>
        </div>`;
    }).join('')}
  </div>`;
}

// ── RENDER: Step 1 — Age Selection ──────────────────────────

// Module-level variable tracking which era accordion is currently open (no re-render needed)
let _expandedEra = null;

function _eraAccordionItem(id, title, dates, desc, details) {
  const isSelected = state.age === id;
  const isOpen = _expandedEra === id;
  return `
    <div class="era-accordion-item${isSelected ? ' era-selected' : ''}${isOpen ? ' era-open' : ''}" data-era="${id}">
      <div class="era-accordion-header"
           role="button" tabindex="0" aria-expanded="${isOpen}"
           onclick="toggleEraAccordion('${id}')"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleEraAccordion('${id}')}">
        <div class="era-timeline-dot"></div>
        <div class="era-header-content">
          <span class="era-header-title">${title}</span>
        </div>
        ${isSelected ? '<span class="era-selected-badge">Selected</span>' : ''}
        <div class="era-chevron">▼</div>
      </div>
      <div class="era-accordion-body${isOpen ? ' era-expanded' : ''}" data-era="${id}">
        <div class="era-accordion-inner">
          <p class="card-desc">${desc}</p>
          <ul class="card-detail-list mt-3">
            <li>Setting: ${dates}</li>
            ${details.map(d => `<li>${d}</li>`).join('')}
          </ul>
          <div style="margin-top:1rem;">
            <button class="btn${isSelected ? ' btn-outline' : ' btn-primary'}"
                    onclick="selectAge('${id}')">
              ${isSelected ? '✓ Era Selected' : 'Select This Era'}
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderStep1() {
  return `
  <div class="step-content">
    <h2 class="step-title">Choose Your Era</h2>
    <p class="step-subtitle">The age in which your story unfolds shapes every skill, contact, and shadow that will haunt you.</p>

    <div class="era-timeline">
      ${_eraAccordionItem('jazz', 'Jazz Age - The Roaring Twenties', '1920–1939',
        'Prohibition and Jazz, the aftermath of the Great War, and the first whispers of worse things to come.',
        ['Technology: Motor cars, telegraphs, early radio', 'Tone: Gothic mystery, colonial horror'])}
      ${_eraAccordionItem('modern', 'Modern Era', 'Present Day',
        'The twenty-first century offers every comfort of civilization—and new vectors for the ancient evil that has always watched from the dark.',
        ['Technology: Computers, the internet, forensics', 'Tone: Conspiracy, urban dread, digital horror'])}
      ${_eraAccordionItem('victorian', 'The Victorian Era', '1837–1901',
        'Gas-lit streets, steam-powered industry, and the vast reach of Empire conceal ancient horrors lurking beneath the veneer of progress.',
        ['Technology: Steam engines, telegraphs, early photography', 'Tone: Gothic mystery, imperial horror, spiritualism'])}
      ${_eraAccordionItem('coldwar', 'The Cold War Era', '1950s–1980s',
        'Espionage, nuclear dread, and ideological shadows define the mid-twentieth century.',
        ['Technology: Early computers, surveillance, Cold War arms', 'Tone: Espionage, paranoia, ideological horror'])}
      ${_eraAccordionItem('ww1', 'World War I', '1914–1918',
        'Mud, gas, and steel define the Great War — but the trenches hide horrors that no general ever planned for.',
        ['Technology: Artillery, early aircraft, poison gas', 'Tone: Military horror, survival, cosmic dread'])}
      ${_eraAccordionItem('ww2', 'World War II', '1939–1945',
        'Blitzkrieg, resistance, and global conflict — beneath the carnage of the deadliest war in history lurk horrors older than any ideology.',
        ['Technology: Tanks, radar, bombers, early jet aircraft', 'Tone: Military horror, espionage, cosmic dread'])}
      ${_eraAccordionItem('future', 'The Future', 'Far Future',
        'Humanity has spread across the stars — but the cosmos is vast and indifferent, and the ancient horrors did not stay behind.',
        ['Technology: AI, beam weapons, starships, zero-g', 'Tone: Cosmic horror, isolation, alien dread'])}
      ${_eraAccordionItem('medieval', 'Medieval Era', '500–1500 CE',
        'A world of feudal lords, crusades, and superstition — beneath the mud and piety lurk horrors as old as the darkness between the stars.',
        ['Technology: Swords, bows, siege weapons, chirurgery', 'Tone: Folk horror, religious dread, cosmic mystery'])}
      ${_eraAccordionItem('classical', 'Classical Era', '500 BCE–500 CE',
        'The age of Greece and Rome, of philosophers and legions — behind the marble columns and laurel wreaths, elder things stir in the deep places of the world.',
        ['Technology: Bronze and iron weapons, siege engines, trireme warships', 'Tone: Mythic horror, civic dread, cosmic mystery'])}
      ${_eraAccordionItem('sails', 'Age of Sails', '1500–1750',
        'An era of exploration, empire, and trade winds — as tall ships cross unknown oceans and colonial powers carve up the world, something ancient lurks beneath the waves.',
        ['Technology: Cannon, muskets, sailing vessels, apothecary', 'Tone: Maritime horror, colonial dread, oceanic mystery'])}
      ${_eraAccordionItem('revolutions', 'Age of Revolutions', '1750–1850',
        'An era of upheaval, empire, and enlightenment — as revolutions topple thrones and science illuminates the world, something ancient stirs in the shadows of colonial ambition.',
        ['Technology: Muskets, cannon, early industry, sail', 'Tone: Colonial horror, revolutionary dread, Enlightenment unease'])}
      ${_eraAccordionItem('elizabethan', 'Elizabethan Age', '1558–1603',
        'An age of exploration, espionage, and Renaissance wonder — as England stretches its reach across the seas and playwrights pen strange new dramas, something older than any court lurks behind the velvet curtain.',
        ['Technology: Matchlocks, cannon, sailing ships, alchemy', 'Tone: Courtly intrigue, occult dread, Renaissance horror'])}
      ${_eraAccordionItem('alazrad', 'Age of Al-Azrad', '700–1200 CE',
        'The Islamic Golden Age — a time of flourishing scholarship, trade, and culture across a vast caliphate. Beneath the gleaming domes of Baghdad and the dusty caravans of the Silk Road, the author of the Kitab Al-Azif walked a world where cosmic horror was only a prayer away.',
        ['Technology: Swords, bows, siege weapons, chirurgery, alchemy', 'Tone: Scholarly dread, desert horror, ancient cosmic mystery'])}
    </div>

    ${state.age ? `<div class="notice mt-4">
      <strong>${state.age === 'jazz' ? 'Jazz Age' : state.age === 'coldwar' ? 'Cold War' : state.age === 'victorian' ? 'Victorian Age' : state.age === 'ww1' ? 'World War I' : state.age === 'ww2' ? 'World War II' : state.age === 'future' ? 'The Future' : state.age === 'medieval' ? 'Medieval Era' : state.age === 'classical' ? 'Classical Era' : state.age === 'sails' ? 'Age of Sails' : state.age === 'revolutions' ? 'Age of Revolutions' : state.age === 'elizabethan' ? 'Elizabethan Age' : state.age === 'alazrad' ? 'Age of Al-Azrad' : 'Modern Age'}</strong> selected.
      You may proceed to the next step.
    </div>` : ''}

    <div class="import-divider">
      <span>or</span>
    </div>
    <div style="text-align:center;">
      <button class="btn btn-outline" onclick="triggerImport()">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import Character from JSON
      </button>
    </div>
  </div>`;
}

function toggleEraAccordion(era) {
  const isCurrentlyOpen = _expandedEra === era;
  _expandedEra = isCurrentlyOpen ? null : era;

  // Update all accordion items in the DOM without a full re-render
  document.querySelectorAll('.era-accordion-item').forEach(item => {
    const itemEra = item.dataset.era;
    const open = itemEra === _expandedEra;
    item.classList.toggle('era-open', open);
    const header = item.querySelector('.era-accordion-header');
    if (header) header.setAttribute('aria-expanded', open);
    const body = item.querySelector('.era-accordion-body');
    if (body) body.classList.toggle('era-expanded', open);
  });
}

function selectAge(val) {
  state.age = val;
  // If archetype is incompatible with new age, reset it
  if (state.archetype) {
    const arch = getArchetype();
    if (arch && !arch.ages.includes(val)) {
      state.archetype = null;
      state.selectedOptional = [];
    }
  }
  nextStep();
}

// ── RENDER: Step 2 — Attributes ─────────────────────────────

function renderStep2() {
  const isPointsMode = state.attrMode === 'points';

  // ── Shared: derived stats ─────────────────────────────────
  const allAssigned = allAttributesAssigned();
  const derived     = allAssigned ? calculateDerived() : null;
  const sanFormula  = (state.upbringing === 'harsh' || state.upbringing === 'very_harsh') ? 'POW × 4' : 'POW × 5';

  const derivedHtml = derived ? `
    <div class="derived-stats">
      <div class="derived-stat" data-tooltip="⌈(STR + CON) ÷ 2⌉">
        <div class="ds-label">Hit Points</div>
        <div class="ds-value">${derived.HP}</div>
      </div>
      <div class="derived-stat" data-tooltip="Equal to POW">
        <div class="ds-label">Willpower</div>
        <div class="ds-value">${derived.WP}</div>
      </div>
      <div class="derived-stat" data-tooltip="STR 1–4: −2 | 5–8: −1 | 9–12: 0 | 13–16: +1 | 17+: +2">
        <div class="ds-label">Dmg Bonus</div>
        <div class="ds-value">${derived.DMG > 0 ? '+' + derived.DMG : derived.DMG}</div>
      </div>
      <div class="derived-stat" data-tooltip="Armour points that reduce incoming damage">
        <div class="ds-label">Body Armour</div>
        <div class="ds-value">${state.bodyArmour || 0}</div>
      </div>
      <div class="derived-stat" data-tooltip="${sanFormula} (Normal = ×5, Harsh/Very Harsh = ×4)">
        <div class="ds-label">Sanity</div>
        <div class="ds-value">${derived.SAN}</div>
      </div>
      <div class="derived-stat" data-tooltip="Always POW × 5">
        <div class="ds-label">Recovery SAN</div>
        <div class="ds-value">${derived.RecoverySAN}</div>
      </div>
      <div class="derived-stat" data-tooltip="SAN − POW (Breaking Point)">
        <div class="ds-label">Break. Point</div>
        <div class="ds-value">${derived.BP}</div>
      </div>
      <div class="derived-stat" data-tooltip="99 − Unnatural skill">
        <div class="ds-label">Max SAN</div>
        <div class="ds-value">${derived.MaxSAN}</div>
      </div>
      <div class="derived-stat" data-tooltip="Always 50">
        <div class="ds-label">Luck</div>
        <div class="ds-value">50</div>
      </div>
    </div>` : '';

  // ── Mode toggle ───────────────────────────────────────────
  const modeToggleHtml = `
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1.25rem;">
      <button class="btn ${!isPointsMode ? 'btn-gold' : 'btn-outline'}"
              onclick="switchAttrMode('rolling')"
              style="font-size:0.78rem;padding:6px 16px;"
              title="Roll 4d6 (drop lowest) and assign results to attributes">
        <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;vertical-align:-2px;" viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/>
          <circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/>
        </svg>
        Rolling
      </button>
      <button class="btn ${isPointsMode ? 'btn-gold' : 'btn-outline'}"
              onclick="switchAttrMode('points')"
              style="font-size:0.78rem;padding:6px 16px;"
              title="Distribute 72 points freely across attributes (min 3, max 18 per stat)">
        ✦ Points Based
      </button>
    </div>`;

  // ── Points-based UI ───────────────────────────────────────
  if (isPointsMode) {
    const remaining = getPointsRemaining();
    const pointsGrid = ATTRIBUTES.map(attr => {
      const val = state.pointsAttr[attr] || POINTS_ATTR_MIN;
      const canIncrease = remaining > 0 && val < POINTS_ATTR_MAX;
      const canDecrease = val > POINTS_ATTR_MIN;
      const feature = getDistinguishingFeature(attr, val);
      return `
        <div class="attr-slot assigned" style="cursor:default;">
          <div class="attr-fullname">${ATTRIBUTE_FULL[attr]}</div>
          <div class="attr-name">${attr}</div>
          <div class="attr-value">${val}</div>
          ${feature ? `<div style="font-size:0.62rem;color:var(--accent-gold);margin-top:2px;font-style:italic;">${feature}</div>` : ''}
          <div style="display:flex;gap:0.25rem;margin-top:0.4rem;justify-content:center;">
            <button class="btn btn-outline" style="padding:1px 8px;font-size:0.8rem;min-width:26px;"
                    onclick="adjustPointsAttr('${attr}',-1)" ${canDecrease ? '' : 'disabled'} aria-label="Decrease ${attr}">−</button>
            <button class="btn btn-outline" style="padding:1px 8px;font-size:0.8rem;min-width:26px;"
                    onclick="adjustPointsAttr('${attr}',1)" ${canIncrease ? '' : 'disabled'} aria-label="Increase ${attr}">+</button>
          </div>
        </div>`;
    }).join('');

    const remainingColor = remaining === 0 ? 'var(--accent-gold)' : remaining < 0 ? 'var(--danger-light)' : 'var(--text-secondary)';

    return `
    <div class="step-content">
      <h2 class="step-title">Assign Your Attributes</h2>
      <p class="step-subtitle">Choose how to allocate your six core attributes.</p>

      ${modeToggleHtml}

      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:1rem;line-height:1.6;">
        Distribute <strong>72 points</strong> across your six attributes.
        Each stat must be at least <strong>3</strong> and no higher than <strong>18</strong>.
      </p>

      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap;">
        <span style="font-size:0.85rem;font-family:var(--font-head);letter-spacing:0.05em;color:var(--text-secondary);">Points remaining:</span>
        <span style="font-size:1.1rem;font-weight:bold;color:${remainingColor};">${remaining}</span>
        <span style="font-size:0.75rem;color:var(--text-secondary);">/ ${POINTS_TOTAL}</span>
      </div>

      <div class="section-header"><h3>Attribute Points</h3></div>
      <div class="attr-grid" id="attr-grid">${pointsGrid}</div>

      ${remaining === 0 ? `<div class="notice" style="margin-top:-0.5rem;margin-bottom:1rem;">
        <strong>All 72 points spent!</strong> Derived statistics calculated below.
      </div>` : ''}

      ${derivedHtml}

      ${remaining !== 0 ? `<p class="validation-msg">Spend all 72 points to continue (${remaining > 0 ? remaining + ' remaining' : Math.abs(remaining) + ' over budget'}).</p>` : ''}

      ${allAssigned ? renderUpbringing() : ''}

      ${allAssigned && !canProceed(2) ? `<p class="validation-msg">Select your upbringing${state.upbringing === 'harsh' && !state.harshStatChoice ? ' and choose STR or CON bonus' : ''} to continue.</p>` : ''}
    </div>`;
  }

  // ── Rolling UI ────────────────────────────────────────────
  const poolRollIds = assignedRollIds();
  const unassigned  = state.rolledSets.filter(r => !poolRollIds.has(r.id));
  const hasRolled   = state.rolledSets.length > 0;

  // Build roll pool chips
  const poolHtml = hasRolled ? unassigned.map(rs => {
    const diceLabels = rs.values.map((v, i) =>
      `<span class="${isDieDropped(rs.values, i) ? 'dropped' : ''}">${v}</span>`
    );
    return `<div class="roll-chip" draggable="true" data-roll-id="${rs.id}"
              title="Drag to assign to an attribute"
              onclick="handleChipClick(${rs.id})">
      <div class="chip-total">${rs.total}</div>
      <div class="chip-dice">${diceLabels.join(' ')}</div>
    </div>`;
  }).join('') : `<span style="font-size:0.82rem;color:var(--text-secondary);font-style:italic;">Click "Roll All" to generate your attribute values.</span>`;

  // Build attribute slots
  const attrSlots = ATTRIBUTES.map(attr => {
    const assignedId = state.attrAssign[attr];
    const rs = assignedId !== null && assignedId !== undefined
      ? state.rolledSets.find(r => r.id === assignedId)
      : null;

    if (rs) {
      const diceLabels = rs.values.map((v, i) =>
        `<span class="${isDieDropped(rs.values, i) ? 'dropped' : ''}">${v}</span>`
      );
      return `
        <div class="attr-slot assigned" data-attr="${attr}"
             ondragover="handleDragOver(event)" ondrop="handleDrop(event,'${attr}')"
             ondragenter="handleDragEnter(event)" ondragleave="handleDragLeave(event)">
          <div class="attr-fullname">${ATTRIBUTE_FULL[attr]}</div>
          <div class="attr-name">${attr}</div>
          <div class="attr-value">${rs.total}</div>
          <div class="chip-dice" style="font-size:0.58rem;color:var(--text-secondary);margin-top:2px;">${diceLabels.join(' ')}</div>
          <div class="attr-unassign" onclick="unassignAttr('${attr}',event)">✕ unassign</div>
        </div>`;
    } else {
      return `
        <div class="attr-slot" data-attr="${attr}"
             ondragover="handleDragOver(event)" ondrop="handleDrop(event,'${attr}')"
             ondragenter="handleDragEnter(event)" ondragleave="handleDragLeave(event)">
          <div class="attr-fullname">${ATTRIBUTE_FULL[attr]}</div>
          <div class="attr-name">${attr}</div>
          <div class="attr-placeholder">Drop here</div>
        </div>`;
    }
  }).join('');

  // Dropdown fallback
  const availableForDropdown = (attr) => {
    const usedIds = assignedRollIds();
    const curId   = state.attrAssign[attr];
    return state.rolledSets.filter(r => r.id === curId || !usedIds.has(r.id));
  };

  const dropdownRows = hasRolled ? ATTRIBUTES.map(attr => {
    const options = availableForDropdown(attr);
    const curId   = state.attrAssign[attr];
    return `<div class="attr-select-row">
      <span class="attr-name-col">${attr}</span>
      <select onchange="handleAttrDropdown('${attr}', this.value)">
        <option value="">—</option>
        ${options.map(r => `<option value="${r.id}" ${r.id === curId ? 'selected' : ''}>${r.total} (${r.values.join(',')})</option>`).join('')}
      </select>
      <span style="font-size:0.75rem;color:var(--text-secondary);">${ATTRIBUTE_FULL[attr]}</span>
    </div>`;
  }).join('') : '';

  return `
  <div class="step-content">
    <h2 class="step-title">Assign Your Attributes</h2>
    <p class="step-subtitle">Choose how to allocate your six core attributes.</p>

    ${modeToggleHtml}

    <p class="step-subtitle" style="margin-top:-0.5rem;">Roll 4d6 six times, keeping the highest three dice each time. Assign each result to an attribute by dragging or using the dropdowns below.</p>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">
      <span style="font-size:0.8rem;color:var(--text-secondary);">
        ${hasRolled ? `${6 - Object.values(state.attrAssign).filter(v=>v!==null&&v!==undefined).length} value(s) remaining to assign` : 'No rolls yet'}
      </span>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        ${hasRolled ? `<button class="btn btn-outline" onclick="rerollAll()" style="font-size:0.72rem;padding:6px 14px;">↺ Re-Roll All</button>` : ''}
        <button class="btn btn-green" onclick="doRollAll()" id="rollBtn">
          <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24">
            <rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/>
          </svg>
          ${hasRolled ? 'Roll Again' : 'Roll All'}
        </button>
      </div>
    </div>

    <div class="section-header"><h3>Rolled Values — drag a chip to an attribute slot</h3></div>
    <div class="roll-pool" id="roll-pool">${poolHtml}</div>

    <div class="section-header"><h3>Attribute Slots</h3></div>
    <div class="attr-grid" id="attr-grid">${attrSlots}</div>

    ${allAssigned ? `<div class="notice" style="margin-top:-0.5rem;margin-bottom:1rem;">
      <strong>All attributes assigned!</strong> Derived statistics calculated below.
    </div>` : ''}

    ${derivedHtml}

    ${hasRolled ? `
    <details style="margin-top:1.5rem;">
      <summary style="font-size:0.78rem;color:var(--text-secondary);cursor:pointer;font-family:var(--font-head);letter-spacing:0.05em;text-transform:uppercase;">
        ▸ Dropdown Assignment (accessibility fallback)
      </summary>
      <div style="margin-top:0.75rem;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:1rem;">
        ${dropdownRows}
      </div>
    </details>` : ''}

    ${!allAttributesAssigned() && hasRolled ? `<p class="validation-msg">Assign all 6 attribute values to continue.</p>` : ''}

    ${allAssigned ? renderUpbringing() : ''}

    ${allAssigned && !canProceed(2) ? `<p class="validation-msg">Select your upbringing${state.upbringing === 'harsh' && !state.harshStatChoice ? ' and choose STR or CON bonus' : ''} to continue.</p>` : ''}
  </div>`;
}

function doRollAll() {
  const btn = document.getElementById('rollBtn');
  if (btn) { btn.classList.add('shaking'); setTimeout(() => btn.classList.remove('shaking'), 600); }
  rollAllAttributes();
  render();
}

function rerollAll() {
  if (confirm('Re-roll all dice? This will clear your current assignments.')) {
    doRollAll();
  }
}

function renderUpbringing() {
  const upbOpts = [
    {
      id: 'normal',
      label: 'Normal(-ish)',
      sanNote: 'SAN = POW × 5',
      bonus: 'No stat bonus',
      adversity: '0 adversity picks',
      desc: 'A relatively ordinary background. No special bonuses or adversities.',
    },
    {
      id: 'harsh',
      label: 'Harsh',
      sanNote: 'SAN = POW × 4',
      bonus: '+1 to STR or CON',
      adversity: '1 adversity pick (+20% to one adversity skill)',
      desc: 'A difficult upbringing has toughened you physically and mentally.',
    },
    {
      id: 'very_harsh',
      label: 'Very Harsh',
      sanNote: 'SAN = POW × 4',
      bonus: '+1 to both STR and CON',
      adversity: '2 adversity picks (+20% each, adversity skills only)',
      desc: 'Forged by hardship, you are exceptionally resilient — but carry deep scars.',
    },
  ];

  let statChoiceHtml = '';
  if (state.upbringing === 'harsh') {
    statChoiceHtml = `
    <div class="notice mt-3" style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
      <span style="font-size:0.82rem;color:var(--text-primary);">Apply +1 bonus to:</span>
      <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;">
        <input type="radio" name="harshStat" value="STR" ${state.harshStatChoice==='STR'?'checked':''}
               onchange="selectHarshStat('STR')"> STR (${getAttrValue('STR') || '—'})
      </label>
      <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;">
        <input type="radio" name="harshStat" value="CON" ${state.harshStatChoice==='CON'?'checked':''}
               onchange="selectHarshStat('CON')"> CON (${getAttrValue('CON') || '—'})
      </label>
    </div>`;
  }

  return `
    <div class="section-header" style="margin-top:2rem;"><h3>Upbringing &amp; Adversity</h3></div>
    <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:1rem;line-height:1.6;">
      Your upbringing shapes your starting resilience and initial sanity score.
      Adversity skill picks can only improve: <strong>${getAdversitySkills().join(', ')}</strong>.
    </p>
    <div class="upbringing-grid">
      ${upbOpts.map(o => `
        <div class="sel-card ${state.upbringing === o.id ? 'selected' : ''}"
             onclick="selectUpbringing('${o.id}')" role="button" tabindex="0"
             onkeydown="if(event.key==='Enter'||event.key===' ')selectUpbringing('${o.id}')">
          <div class="card-check">${checkIcon()}</div>
          <div class="card-tag">${o.label}</div>
          <div class="card-desc" style="font-size:0.78rem;margin-top:0.4rem;">${o.desc}</div>
          <ul class="card-detail-list mt-2" style="font-size:0.74rem;">
            <li>${o.bonus}</li>
            <li>${o.sanNote}</li>
            <li>${o.adversity}</li>
          </ul>
        </div>`).join('')}
    </div>
    ${statChoiceHtml}`;
}

function selectUpbringing(val) {
  state.upbringing = val;
  if (val !== 'harsh') state.harshStatChoice = null;
  render();
}

function selectHarshStat(attr) {
  state.harshStatChoice = attr;
  render();
}

function handleAttrDropdown(attr, val) {
  if (val === '') {
    unassignAttr(attr, null);
    return;
  }
  const rollId = parseInt(val, 10);
  const usedIds = assignedRollIds();
  // Un-assign from whoever had this roll id
  ATTRIBUTES.forEach(a => {
    if (state.attrAssign[a] === rollId) state.attrAssign[a] = null;
  });
  state.attrAssign[attr] = rollId;
  render();
}

function handleChipClick(rollId) {
  // If any slot is empty, assign to first empty slot
  const firstEmpty = ATTRIBUTES.find(a => state.attrAssign[a] === null || state.attrAssign[a] === undefined);
  if (firstEmpty) {
    state.attrAssign[firstEmpty] = rollId;
    render();
  }
}

function unassignAttr(attr, event) {
  if (event) event.stopPropagation();
  state.attrAssign[attr] = null;
  render();
}

// ── Drag & Drop handlers ─────────────────────────────────────

function attachDragListeners() {
  // Chips in pool
  document.querySelectorAll('.roll-chip[draggable]').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      _dragRollId   = parseInt(chip.dataset.rollId, 10);
      _dragFromAttr = null;
      e.dataTransfer.effectAllowed = 'move';
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
  });

  // Assigned chips inside slots — allow dragging FROM slot
  document.querySelectorAll('.attr-slot.assigned').forEach(slot => {
    slot.setAttribute('draggable', 'true');
    slot.addEventListener('dragstart', e => {
      const attr   = slot.dataset.attr;
      _dragRollId   = state.attrAssign[attr];
      _dragFromAttr = attr;
      e.dataTransfer.effectAllowed = 'move';
      slot.style.opacity = '0.5';
    });
    slot.addEventListener('dragend', () => { slot.style.opacity = ''; });
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e, targetAttr) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  if (_dragRollId === null || _dragRollId === undefined) return;

  // If the target slot already has a value, swap or send to pool
  const existingId = state.attrAssign[targetAttr];

  // Clear source slot (if dragged from a slot)
  if (_dragFromAttr) {
    state.attrAssign[_dragFromAttr] = existingId !== null && existingId !== undefined ? existingId : null;
  }

  state.attrAssign[targetAttr] = _dragRollId;
  _dragRollId   = null;
  _dragFromAttr = null;
  render();
}

// ── RENDER: Step 3 — Archetype ──────────────────────────────

function renderStep3() {
  const filtered = ARCHETYPES.filter(a => a.ages.includes(state.age));
  const selected  = getArchetype();

  const archetypeCards = filtered.map(arch => `
    <div class="archetype-card ${state.archetype === arch.id ? 'selected' : ''}"
         onclick="selectArchetype('${arch.id}')" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter'||event.key===' ')selectArchetype('${arch.id}')">
      <div class="arch-name">${arch.name}</div>
      <div class="arch-desc">${truncateWords(arch.description, 80)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;">
        <span style="font-size:0.68rem;color:var(--text-secondary);">Bonds: ${arch.bonds}</span>
        <span style="font-size:0.68rem;color:var(--text-secondary);">Resources: ${arch.resources}</span>
      </div>
    </div>`).join('');

  let detailHtml = '';
  if (selected) {
    const optDone = state.selectedOptional.length === selected.optionalCount;
    detailHtml = `
    <div class="archetype-detail" id="archetype-detail">
      <h3>${selected.name}</h3>
      ${selected.recommendedStats ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.5rem;font-family:var(--font-head);text-transform:uppercase;letter-spacing:0.06em;">Recommended Stats: ${selected.recommendedStats.join(', ')}</div>` : ''}
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:1rem;line-height:1.6;">${selected.description}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;" class="sm:grid-cols-1">
        <div>
          <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-secondary);font-family:var(--font-head);margin-bottom:6px;">Archetypal Skills</div>
          <div>${selected.archetypeSkills.map(s => `<span class="skill-pill"${skillTooltipAttr(s.name)}>${s.name} <strong>${s.value}%</strong></span>`).join('')}</div>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-secondary);font-family:var(--font-head);">Choose ${selected.optionalCount} Optional Skill${selected.optionalCount > 1 ? 's' : ''}</span>
            <span style="font-size:0.7rem;color:${optDone ? '#4ade80' : 'var(--accent-gold)'};">(${state.selectedOptional.length}/${selected.optionalCount} chosen)</span>
          </div>
          <div id="optional-skills-container">
            ${selected.optionalSkills.map(s => {
              const checked = state.selectedOptional.includes(s.name);
              return `<label class="optional-checkbox-label ${checked ? 'checked' : ''}" onclick="toggleOptional('${s.name}',${selected.optionalCount})">
                <input type="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation(); event.preventDefault();" style="pointer-events:none;"/>
                <span${skillTooltipAttr(s.name)}>${s.name}</span> <strong>${s.value}%</strong>
              </label>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:2rem;flex-wrap:wrap;font-size:0.8rem;color:var(--text-secondary);">
        <span>Bonds: <strong style="color:var(--text-primary);">${selected.bonds}</strong></span>
        <span>Starting Resources: <strong style="color:var(--text-primary);">${selected.resources}</strong></span>
      </div>

      ${!optDone ? `<p class="validation-msg">Select exactly ${selected.optionalCount} optional skill${selected.optionalCount > 1 ? 's' : ''} to continue.</p>` : ''}
    </div>`;
  }

  return `
  <div class="step-content">
    <h2 class="step-title">Choose Your Archetype</h2>
    <p class="step-subtitle">Your archetype defines your occupation and grants bonus skills. Choose wisely—the cosmos cares nothing for your credentials.</p>

    <div class="archetype-grid">${archetypeCards}</div>

    ${selected ? detailHtml : `<div class="notice mt-4">Select an archetype above to see its full details and choose optional skills.</div>`}
    ${!state.archetype ? `<p class="validation-msg">Select an archetype to continue.</p>` : ''}
  </div>`;
}

function selectArchetype(id) {
  if (state.archetype !== id) {
    state.archetype  = id;
    state.selectedOptional = [];
  }
  render();
  setTimeout(() => {
    const detail = document.getElementById('archetype-detail');
    if (detail && detail.scrollIntoView) detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function toggleOptional(skillName, maxCount) {
  if (state.selectedOptional.includes(skillName)) {
    state.selectedOptional = state.selectedOptional.filter(s => s !== skillName);
  } else {
    if (state.selectedOptional.length < maxCount) {
      state.selectedOptional.push(skillName);
    }
  }
  render();
  // Re-scroll to detail panel without full page jump
  setTimeout(() => {
    const detail = document.getElementById('archetype-detail');
    if (detail && detail.scrollIntoView) detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

// ── RENDER: Step 4 — Point Distribution ─────────────────────

function renderStep4() {
  const arch      = getArchetype();
  const bpTotal   = getBonusPointsTotal();
  const bpSpent   = getBonusPointsSpent();
  const bpLeft    = bpTotal - bpSpent;
  const skills    = getCurrentSkills();
  const bondCount = getEffectiveBondsCount();
  const advTotal  = getAdversityTotal();
  const advLeft   = getAdversityRemaining();

  // Ensure bonds array is right length
  ensureBondsCount();

  const effectiveResources = getEffectiveResources();

  // Sort skills: archetype bonus skills first, then alphabetical
  const allSkillNames = Object.keys(skills).sort((a, b) => {
    const aBonus = getArchetypeSkillBonus(a) > 0;
    const bBonus = getArchetypeSkillBonus(b) > 0;
    if (aBonus && !bBonus) return -1;
    if (!aBonus && bBonus) return 1;
    return a.localeCompare(b);
  });

  const skillRows = allSkillNames.map(skillName => {
    const base      = skills[skillName] || 0;
    const archBon   = getArchetypeSkillBonus(skillName);
    const bpPicks   = state.skillPoints[skillName] || 0;
    const final     = getFinalSkillValue(skillName);
    const isBonus   = archBon > 0;
    const isUnnat   = skillName === 'Unnatural';
    const advPicks  = state.adversityPoints[skillName] || 0;
    // canAdd: have picks left AND adding one more pick won't exceed 80%
    const canAdd = !isUnnat && bpLeft > 0 && (base + archBon + (bpPicks + advPicks + 1) * 20) <= 80;
    const canSub = !isUnnat && bpPicks > 0;

    const bonusDisplay = bpPicks > 0 ? `+${bpPicks * 20}%` : (isUnnat ? 'locked' : '—');
    const isTyped = skillName.includes('(Type)');

    return `<tr>
      <td class="skill-name ${isBonus ? 'bonus-skill' : ''}" style="width:45%">
        <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">
          <span class="skill-tip"${skillTooltipAttr(skillName)}>${skillName}${isBonus ? ` <span style="font-size:0.65rem;color:var(--accent-greenl);">+${archBon}%</span>` : ''}</span>
          ${isUnnat ? `<span style="font-size:0.62rem;color:var(--text-secondary);font-style:italic;">(cannot boost)</span>` : ''}
        </div>
        ${isTyped ? `<div style="margin-top:4px;"><input type="text" class="skill-type-input" placeholder="Enter type…"
          value="${escapeHtml(state.skillTypes[skillName] || '')}"
          oninput="updateSkillType('${skillName}',this.value)"
          aria-label="Specify type for ${escapeHtml(skillName)}" /></div>` : ''}
      </td>
      <td class="skill-base">${base}%</td>
      <td style="text-align:center;white-space:nowrap;">
        <button class="skill-adj-btn" onclick="adjustSkill('${skillName}',-1)" ${canSub ? '' : 'disabled'}>−</button>
        <span class="skill-bonus-added" style="display:inline-block;min-width:40px;text-align:center;">${bonusDisplay}</span>
        <button class="skill-adj-btn plus" onclick="adjustSkill('${skillName}',1)" ${canAdd ? '' : 'disabled'}>+</button>
      </td>
      <td class="skill-final">${final}%</td>
    </tr>`;
  }).join('');

  // Custom skill rows
  const customSkillRows = (state.customSkills || []).map(cs => {
    const final   = getFinalCustomSkillValue(cs);
    const points  = cs.points || 0;
    const canAdd  = bpLeft > 0 && (cs.baseValue + (points + 1) * 20) <= 80;
    const canSub  = points > 0;
    const bonusDisplay = points > 0 ? `+${points * 20}%` : '—';

    return `<tr class="custom-skill-row">
      <td class="skill-name" style="width:45%">
        <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">
          <span class="custom-skill-badge">custom</span>
          <input type="text" class="skill-type-input" placeholder="Skill name…"
            value="${escapeHtml(cs.customName || '')}"
            oninput="updateCustomSkillName(${cs.id},this.value)"
            aria-label="Custom skill name" style="flex:1;min-width:7rem;" />
          <button class="remove-custom-skill-btn" onclick="removeCustomSkill(${cs.id})" title="Remove this skill" aria-label="Remove custom skill">×</button>
        </div>
      </td>
      <td class="skill-base">0%</td>
      <td style="text-align:center;white-space:nowrap;">
        <button class="skill-adj-btn" onclick="adjustCustomSkill(${cs.id},-1)" ${canSub ? '' : 'disabled'}>−</button>
        <span class="skill-bonus-added" style="display:inline-block;min-width:40px;text-align:center;">${bonusDisplay}</span>
        <button class="skill-adj-btn plus" onclick="adjustCustomSkill(${cs.id},1)" ${canAdd ? '' : 'disabled'}>+</button>
      </td>
      <td class="skill-final">${final}%</td>
    </tr>`;
  }).join('');


  const adversityHtml = advTotal > 0 ? `
    <div class="section-header" style="margin-top:2rem;">
      <h3>Adversity Skill Picks — ${advLeft} / ${advTotal} remaining</h3>
    </div>
    <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.75rem;line-height:1.6;">
      From your <strong>${state.upbringing === 'very_harsh' ? 'Very Harsh' : 'Harsh'}</strong> upbringing you receive
      ${advTotal} adversity pick${advTotal > 1 ? 's' : ''} (+20% each). These may only be applied to the four adversity skills below.
    </p>
    <div style="overflow-x:auto;">
      <table class="skills-table">
        <thead>
          <tr>
            <th style="width:45%;">Adversity Skill</th>
            <th style="text-align:center;">Base</th>
            <th style="text-align:center;">Adv. Bonus</th>
            <th style="text-align:center;">Final</th>
          </tr>
        </thead>
        <tbody>
          ${getAdversitySkills().map(skillName => {
            const base     = skills[skillName] || 0;
            const archBon  = getArchetypeSkillBonus(skillName);
            const advPicks = state.adversityPoints[skillName] || 0;
            const bpPicks  = state.skillPoints[skillName] || 0;
            const final    = getFinalSkillValue(skillName);
            const canAdd = advLeft > 0 && (base + archBon + (bpPicks + advPicks + 1) * 20) <= 80;
            const canSub = advPicks > 0;
            const isTyped = skillName.includes('(Type)');
            return `<tr>
              <td class="skill-name" style="width:45%">
                <span class="skill-tip"${skillTooltipAttr(skillName)}>${skillName}</span>
                ${isTyped ? `<div style="margin-top:4px;"><input type="text" class="skill-type-input" placeholder="Enter type…"
                  value="${escapeHtml(state.skillTypes[skillName] || '')}"
                  oninput="updateSkillType('${skillName}',this.value)"
                  aria-label="Specify type for ${escapeHtml(skillName)}" /></div>` : ''}
              </td>
              <td class="skill-base">${base}%</td>
              <td style="text-align:center;white-space:nowrap;">
                <button class="skill-adj-btn" onclick="adjustAdversity('${skillName}',-1)" ${canSub ? '' : 'disabled'}>−</button>
                <span class="skill-bonus-added" style="display:inline-block;min-width:40px;text-align:center;">${advPicks > 0 ? '+' + (advPicks * 20) + '%' : '—'}</span>
                <button class="skill-adj-btn plus" onclick="adjustAdversity('${skillName}',1)" ${canAdd ? '' : 'disabled'}>+</button>
              </td>
              <td class="skill-final">${final}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '';

  const cha = getAttrValue('CHA');
  const bondsHtml = `
    <div class="section-header" style="margin-top:2rem;">
      <h3>Bonds (${bondCount})</h3>
    </div>
    <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.75rem;line-height:1.6;">
      Choose a type for each bond. <strong>Personal</strong> bonds represent specific people and start at your CHA score (${cha !== null ? cha : '—'}).
      <strong>Community</strong> bonds represent organizations, churches, or neighborhoods and start at Resources ÷ 2 (${Math.floor(effectiveResources / 2)}). Community bonds can be improved with Bonus Picks.
    </p>
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      ${state.bonds.map((b, i) => {
        const val = getBondEffectiveValue(b);
        const isIndividual = b.type === 'individual';
        const isCommunity  = b.type === 'community';
        const isSetToOne   = isCommunity && !!b.setToOne;
        const nextPickGain = (b.bonusSpent || 0) === 0 ? 5 : 2;
        const canAdd = isCommunity && !isSetToOne && getBonusPointsRemaining() > 0 && (val === null || val < 20);
        const canSub = isCommunity && !isSetToOne && b.bonusSpent > 0;
        // Cannot sacrifice a community bond when Resources is already 0 (bond base = 0,
        // so setting to 1 would be an increase, not a sacrifice).
        const canSacrifice = isCommunity && !state.resourcesSetToZero;
        return `<div class="bond-row">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <span style="font-size:0.72rem;color:var(--text-secondary);font-family:var(--font-head);text-transform:uppercase;letter-spacing:0.06em;min-width:3.5rem;">Bond ${i + 1}</span>
            <button class="bond-type-btn${isIndividual ? ' active-personal' : ''}" onclick="updateBondType(${i},'individual')">Personal</button>
            <button class="bond-type-btn${isCommunity ? ' active-community' : ''}" onclick="updateBondType(${i},'community')">Community</button>
            ${b.type ? `
              <input class="bond-input" type="text" placeholder="${isIndividual ? 'Name a person…' : 'Name an organization, church, or neighborhood…'}"
                     value="${escapeHtml(b.name)}"
                     oninput="updateBond(${i},this.value)" style="flex:1;min-width:10rem;" />
              <span style="font-size:1rem;font-family:var(--font-head);color:${isSetToOne ? 'var(--ct-danger,#7a1c1c)' : 'var(--accent-gold)'};min-width:2rem;text-align:right;">${val !== null ? val : '—'}</span>
              ${isCommunity ? `
                ${isSetToOne ? '' : `
                  <button class="skill-adj-btn" onclick="adjustBond(${i},-1)" ${canSub ? '' : 'disabled'}>−</button>
                  <span style="font-size:0.72rem;color:var(--text-secondary);">+${nextPickGain}</span>
                  <button class="skill-adj-btn plus" onclick="adjustBond(${i},1)" ${canAdd ? '' : 'disabled'}>+</button>
                `}
                ${canSacrifice ? `
                  <button class="toggle-sacrifice-btn${isSetToOne ? ' active' : ''}"
                          onclick="toggleBondSetToOne(${i})"
                          data-tooltip="${isSetToOne ? 'Undo: restore bond score to its normal value.' : 'If you are willing for your Protagonist to set a Community Bond to a value of 1 (ready to break at the slightest provocation, with possibly disastrous social outcome), that sacrifice earns one EXTRA Bonus Skill Point Pick.'}"
                          aria-label="${isSetToOne ? 'Undo bond sacrifice' : 'Sacrifice bond for bonus pick'}">
                    ${isSetToOne ? '↩ Undo' : '⚡ Sacrifice (+1 Pick)'}
                  </button>
                ` : ''}
              ` : ''}
            ` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // Resources: display current value and what the next pick adds
  const nextPickGain = state.resourcesBonusSpent === 0 ? 5 : 2;
  const resourcesHtml = `
    <div class="section-header" style="margin-top:2rem;"><h3>Resources</h3></div>
    <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
      <span style="font-size:1.5rem;font-family:var(--font-head);color:${state.resourcesSetToZero ? 'var(--ct-danger,#7a1c1c)' : 'var(--accent-gold)'};min-width:2.5rem;text-align:center;">${effectiveResources}</span>
      <span style="font-size:0.82rem;color:var(--text-secondary);">
        base: ${arch ? arch.resources : 0}
        ${!state.resourcesSetToZero && state.resourcesBonusSpent > 0 ? ` + ${state.resourcesBonusSpent === 1 ? 5 : 5 + (state.resourcesBonusSpent - 1) * 2} from picks` : ''}
        ${state.resourcesSetToZero ? ' <em>(sacrificed for +1 Bonus Pick)</em>' : ''}
      </span>
      ${state.resourcesSetToZero ? '' : `
        <button class="skill-adj-btn" onclick="adjustResources(-1)"
                ${state.resourcesBonusSpent > 0 ? '' : 'disabled'}>−</button>
        <span style="font-size:0.78rem;color:var(--text-secondary);">1 pick → +${nextPickGain}</span>
        <button class="skill-adj-btn plus" onclick="adjustResources(1)"
                ${bpLeft >= 1 ? '' : 'disabled'}>+</button>
      `}
      <button class="toggle-sacrifice-btn${state.resourcesSetToZero ? ' active' : ''}"
              onclick="toggleResourcesZero()"
              data-tooltip="${state.resourcesSetToZero ? 'Undo: restore Resources to its base value.' : 'If you are willing for your Protagonist to have a Resources rating of 0 (absolutely without any worldly goods), that sacrifice earns one EXTRA Bonus Skill Point Pick.'}"
              aria-label="${state.resourcesSetToZero ? 'Undo resource sacrifice' : 'Sacrifice resources for bonus pick'}">
        ${state.resourcesSetToZero ? '↩ Undo' : '⚡ Sacrifice (+1 Pick)'}
      </button>
    </div>`;

  const bpClass = bpLeft === 0 ? 'good' : bpLeft < 0 ? 'warn' : '';
  const allBondsReady = state.bonds.length > 0 && state.bonds.every(b => b.type !== null && b.name.trim() !== '');

  return `
  <div class="step-content">
    <h2 class="step-title">Distribute Your Points</h2>
    <p class="step-subtitle">You have <strong style="color:var(--accent-gold);">${bpTotal} Bonus Picks</strong> to spend. Each pick adds <strong>+20%</strong> to a skill (max final value 80%), or can be sacrificed to increase Resources or a Bond.</p>

    <div class="points-bar">
      <div class="points-counter">
        <span class="pts-val ${bpClass}">${bpLeft}</span>
        <span class="pts-label">Bonus Picks Remaining</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text-secondary);">
        Spent: ${bpSpent} / ${bpTotal}
      </div>
      ${advTotal > 0 ? `<div class="points-counter">
        <span class="pts-val ${advLeft === 0 ? 'good' : ''}">${advLeft}</span>
        <span class="pts-label">Adversity Picks Remaining</span>
      </div>` : ''}
    </div>

    ${bpLeft === 0 && advLeft === 0 ? `<div class="notice mb-4"><strong>All picks spent.</strong> Scroll down to set up your bonds, then proceed.</div>` : ''}

    <div class="section-header"><h3>Skills — each Bonus Pick adds +20% (max final 80%)</h3></div>
    <div style="overflow-x:auto;">
      <table class="skills-table">
        <thead>
          <tr>
            <th style="width:45%;">Skill</th>
            <th style="text-align:center;">Base</th>
            <th style="text-align:center;">Bonus</th>
            <th style="text-align:center;">Final</th>
          </tr>
        </thead>
        <tbody>${skillRows}${customSkillRows}</tbody>
      </table>
    </div>
    <div style="text-align:right;margin-top:0.5rem;">
      <button class="add-custom-skill-btn skill-tip" data-tooltip="Talk to your Keeper before adding custom skills." onclick="addCustomSkill()">+ Add Custom Skill</button>
    </div>

    ${adversityHtml}
    ${bondsHtml}
    ${resourcesHtml}

    ${!canProceed(4) ? `<p class="validation-msg">
      ${bpLeft !== 0 ? `Spend all ${bpLeft > 0 ? bpLeft + ' remaining' : 'over-budget'} bonus picks. ` : ''}
      ${advLeft !== 0 ? `Spend all ${advLeft} remaining adversity pick${advLeft > 1 ? 's' : ''}. ` : ''}
      ${!allBondsReady ? 'Choose a type and name for all bonds. ' : ''}
    </p>` : ''}
  </div>`;
}

function adjustSkill(skillName, delta) {
  if (skillName === 'Unnatural') return; // cannot be increased
  const base     = getCurrentSkills()[skillName] || 0;
  const archBon  = getArchetypeSkillBonus(skillName);
  const current  = state.skillPoints[skillName] || 0;
  const newPicks = current + delta;
  if (newPicks < 0) return;
  if (delta > 0) {
    if (getBonusPointsRemaining() < 1) return;
    // Check 80% cap (adversity picks already factored in getFinalSkillValue)
    const advPicks = state.adversityPoints[skillName] || 0;
    if (base + archBon + (newPicks + advPicks) * 20 > 80) return;
  }
  state.skillPoints[skillName] = newPicks;
  render();
}

function adjustResources(delta) {
  const arch = getArchetype();
  if (!arch) return;
  if (delta > 0) {
    if (getBonusPointsRemaining() < 1) return;
    state.resourcesBonusSpent++;
  } else {
    if (state.resourcesBonusSpent <= 0) return;
    state.resourcesBonusSpent--;
  }
  render();
}

function adjustAdversity(skillName, delta) {
  if (!getAdversitySkills().includes(skillName)) return;
  const base     = getCurrentSkills()[skillName] || 0;
  const archBon  = getArchetypeSkillBonus(skillName);
  const current  = state.adversityPoints[skillName] || 0;
  const newPicks = current + delta;
  if (newPicks < 0) return;
  if (delta > 0) {
    if (getAdversityRemaining() < 1) return;
    const bpPicks = state.skillPoints[skillName] || 0;
    if (base + archBon + (bpPicks + newPicks) * 20 > 80) return;
  }
  state.adversityPoints[skillName] = newPicks;
  render();
}

// ── Custom Skills ───────────────────────────────────

function getCustomSkillDisplayName(cs) {
  return (cs.customName || '').trim() || '(unnamed)';
}

function getFinalCustomSkillValue(cs) {
  return Math.min(80, cs.baseValue + (cs.points || 0) * 20);
}

function addCustomSkill() {
  state.customSkills.push({
    id: ++_customSkillIdCounter,
    baseValue: 0,
    customName: '',
    points: 0,
  });
  render();
}

function removeCustomSkill(id) {
  state.customSkills = state.customSkills.filter(cs => cs.id !== id);
  render();
}

function adjustCustomSkill(id, delta) {
  const cs = state.customSkills.find(s => s.id === id);
  if (!cs) return;
  const newPicks = (cs.points || 0) + delta;
  if (newPicks < 0) return;
  if (delta > 0) {
    if (getBonusPointsRemaining() < 1) return;
    if (cs.baseValue + newPicks * 20 > 80) return;
  }
  cs.points = newPicks;
  render();
}

function updateCustomSkillName(id, value) {
  const cs = state.customSkills.find(s => s.id === id);
  if (!cs) return;
  cs.customName = value;
  // Don't re-render to preserve focus
}

function updateBond(index, value) {
  state.bonds[index].name = value;
  // Don't re-render (would lose focus), just update canProceed state silently
  // Update the next button disabled state
  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) nextBtn.disabled = !canProceed(4);
}

function updateSkillType(skillName, value) {
  state.skillTypes[skillName] = value;
  // Don't re-render (would lose focus); the display name is only used on the character sheet
}

function updateBondType(index, type) {
  const bond = state.bonds[index];
  if (!bond || typeof bond !== 'object') return;
  // If switching away from community, refund bonus picks and clear setToOne
  if (bond.type === 'community' && type !== 'community') {
    bond.bonusSpent = 0;
    bond.setToOne = false;
  }
  bond.type = type;
  render();
}

function adjustBond(index, delta) {
  const bond = state.bonds[index];
  if (!bond || bond.type !== 'community') return;
  if (delta > 0) {
    if (getBonusPointsRemaining() < 1) return;
    if (getBondPreReductionValue(bond) >= 20) return;
    bond.bonusSpent = (bond.bonusSpent || 0) + 1;
  } else {
    if ((bond.bonusSpent || 0) <= 0) return;
    bond.bonusSpent--;
  }
  render();
}

// Toggles Resources to 0, granting +1 bonus pick when enabled.
// Refunds any bonus picks previously spent on Resources, and clears any
// community bond sacrifices (since their base becomes 0, setting them to 1
// would increase rather than decrease the score).
function toggleResourcesZero() {
  if (state.resourcesSetToZero) {
    state.resourcesSetToZero = false;
  } else {
    state.resourcesSetToZero = true;
    state.resourcesBonusSpent = 0; // refund any picks spent on resources
    // Clear bond sacrifices: with Resources=0 the bond base is 0, so setting
    // a bond to 1 would be an increase, not a sacrifice.
    state.bonds.forEach(b => {
      if (b && typeof b === 'object' && b.type === 'community' && b.setToOne) {
        b.setToOne = false;
      }
    });
  }
  render();
}

// Toggles a community bond score to 1, granting +1 bonus pick when enabled.
// Refunds any bonus picks previously spent on that bond.
// Not allowed when Resources has been sacrificed to 0 (bond base would be 0,
// so setting to 1 would be an increase, not a sacrifice).
function toggleBondSetToOne(index) {
  const bond = state.bonds[index];
  if (!bond || typeof bond !== 'object' || bond.type !== 'community') return;
  if (bond.setToOne) {
    bond.setToOne = false;
  } else {
    if (state.resourcesSetToZero) return; // cannot sacrifice a bond that starts at 0
    bond.setToOne = true;
    bond.bonusSpent = 0; // refund any picks spent on this bond
  }
  render();
}

// ── RENDER: Step 4.5 — Upbringing Effects ───────────────────

function renderUpbringingEffects() {
  const upbringing = state.upbringing;

  // Original attribute values (before any reductions applied in this step)
  const origCha = getOrigAttrValue('CHA') || 0;
  const origPow = getOrigAttrValue('POW') || 0;

  let html = `
  <div class="step-content">
    <h2 class="step-title">Upbringing Effects</h2>
    <p class="step-subtitle">Your ${upbringing === 'harsh' ? 'harsh' : 'very harsh'} upbringing has left its mark — resolve any lasting consequences before continuing.</p>`;

  // ── Harsh ──────────────────────────────────────────────────
  if (upbringing === 'harsh') {
    const effectApplies = origCha < 7 || origPow < 7;

    if (!effectApplies) {
      html += `
    <div class="sheet-section" style="margin-top:1.5rem;">
      <p style="color:var(--text-secondary);line-height:1.7;">
        Your CHA (${origCha}) and POW (${origPow}) are both 7 or above — your harsh upbringing left no lasting bond damage. You may continue.
      </p>
    </div>`;
    } else {
      html += `
    <div class="sheet-section" style="margin-top:1.5rem;">
      <p style="color:var(--text-secondary);line-height:1.7;">
        Your ${origCha < 7 ? `CHA (${origCha})` : ''}${origCha < 7 && origPow < 7 ? ' and ' : ''}${origPow < 7 ? `POW (${origPow})` : ''} ${(origCha < 7 && origPow < 7) ? 'are' : 'is'} below 7.
        Your harsh upbringing has strained some of your bonds. Roll two d4 dice, then choose which bond each roll deducts from.
      </p>`;

      if (!state.harshD4Rolls) {
        html += `
      <button class="btn btn-gold" style="margin-top:0.75rem;" onclick="rollHarshD4s()">Roll 2d4</button>`;
      } else {
        html += `
      <div style="margin-top:1rem;display:flex;flex-direction:column;gap:1rem;">`;

        state.harshD4Rolls.forEach((roll, i) => {
          const choice = i === 0 ? state.harshBondChoice1 : state.harshBondChoice2;
          const otherChoice = i === 0 ? state.harshBondChoice2 : state.harshBondChoice1;
          // If only one bond exists, the second die cannot be applied to any bond.
          if (i === 1 && state.bonds.length === 1) {
            html += `
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
          <span style="font-size:1rem;min-width:80px;">Die ${i + 1}: <strong>${roll}</strong></span>
          <span style="color:var(--text-secondary);font-size:0.9rem;">(Not used — only one bond available)</span>
        </div>`;
            return;
          }
          html += `
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
          <span style="font-size:1rem;min-width:80px;">Die ${i + 1}: <strong>${roll}</strong></span>
          <select class="form-select" style="max-width:260px;"
                  onchange="selectHarshBondChoice(${i}, parseInt(this.value))">
            <option value="" ${choice === null || choice === undefined ? 'selected' : ''}>— Select a bond —</option>
            ${state.bonds.map((b, idx) => `
            <option value="${idx}" ${choice === idx ? 'selected' : ''} ${otherChoice === idx ? 'disabled' : ''}>${escapeHtml(b.name || 'Unnamed bond')} (current: ${getBondPreReductionValue(b) !== null ? getBondPreReductionValue(b) : '—'})</option>`).join('')}
          </select>
        </div>`;
        });

        html += `
      </div>`;

        // Show reductions once all usable dice are assigned: both choices made, or only
        // one bond exists so the second die is unused (harshBondChoice2 stays null).
        if (state.harshBondChoice1 !== null && (state.bonds.length === 1 || state.harshBondChoice2 !== null)) {
          html += `
      <div style="margin-top:1rem;padding:0.75rem 1rem;background:var(--ct-surface);border-radius:8px;border:1px solid var(--border);">
        <strong>Applied reductions:</strong>
        <ul style="margin:0.5rem 0 0 1.25rem;line-height:1.8;">
          ${state.bonds.map((b, idx) => {
            const red = b.upbringingReduction || 0;
            return red > 0 ? `<li>${escapeHtml(b.name || 'Unnamed bond')}: reduced by ${red} (new value: ${getBondEffectiveValue(b)})</li>` : '';
          }).join('')}
        </ul>
      </div>`;
        }
      }

      html += `
    </div>`;
    }
  }

  // ── Very Harsh ─────────────────────────────────────────────
  if (upbringing === 'very_harsh') {
    const powTarget = origPow * 4;

    // Part 1: POW × 4 Test
    html += `
    <div class="sheet-section" style="margin-top:1.5rem;">
      <div class="sheet-section-title">Part 1 — POW × 4 Test</div>
      <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:0.75rem;">
        Roll d100 and compare to your POW × 4 target (<strong>${powTarget}%</strong>). Rolling equal to or under is a success.
      </p>`;

    if (state.vhPowTestRoll === null) {
      html += `
      <button class="btn btn-gold" onclick="rollVhPowTest()">Roll d100</button>`;
    } else {
      const passed = state.vhPowTestRoll <= powTarget;
      html += `
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:0.5rem;">
        <span style="font-size:1.1rem;">You rolled: <strong>${state.vhPowTestRoll}</strong></span>
        <span class="bond-status-badge" style="background:${passed ? 'rgba(126,255,160,0.15);color:#7effa0;border:1px solid #7effa0' : 'rgba(255,80,80,0.15);color:#ff8080;border:1px solid #ff8080'};">
          ${passed ? '✓ Success' : '✗ Failure'}
        </span>
      </div>
      ${passed
        ? `<p style="color:var(--text-secondary);">Your mind holds firm against the darkness of your past.</p>`
        : `<p style="color:var(--text-secondary);">The weight of your past breaks through — a mental disorder has been added to your character sheet. You can name it on the final page.</p>`
      }`;
    }

    html += `
    </div>`;

    // Part 2: Adaptation (only if CHA < 10 or POW < 10)
    const part2Applies = origCha < 10 || origPow < 10;

    if (part2Applies) {
      html += `
    <div class="sheet-section" style="margin-top:1.5rem;">
      <div class="sheet-section-title">Part 2 — Adaptation</div>
      <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:0.75rem;">
        Your ${origCha < 10 ? `CHA (${origCha})` : ''}${origCha < 10 && origPow < 10 ? ' and ' : ''}${origPow < 10 ? `POW (${origPow})` : ''} ${(origCha < 10 && origPow < 10) ? 'are' : 'is'} below 10.
        Your very harsh upbringing has left you adapted to extreme conditions. Choose your adaptation:
      </p>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
        <div class="sel-card ${state.vhAdaptedTo === 'violence' ? 'selected' : ''}"
             style="flex:1;min-width:200px;${state.vhAdaptRoll === null ? 'cursor:pointer;' : 'opacity:0.7;cursor:default;'}"
             ${state.vhAdaptRoll === null ? "onclick=\"selectVhAdaptation('violence')\"" : ''} role="button"
             ${state.vhAdaptRoll !== null ? 'aria-disabled="true"' : ''}>
          <div style="font-weight:600;margin-bottom:0.4rem;">⚔ Adapted to Violence</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">Reduce CHA by 1d6, and reduce every bond by the same amount.</div>
        </div>
        <div class="sel-card ${state.vhAdaptedTo === 'helplessness' ? 'selected' : ''}"
             style="flex:1;min-width:200px;${state.vhAdaptRoll === null ? 'cursor:pointer;' : 'opacity:0.7;cursor:default;'}"
             ${state.vhAdaptRoll === null ? "onclick=\"selectVhAdaptation('helplessness')\"" : ''} role="button"
             ${state.vhAdaptRoll !== null ? 'aria-disabled="true"' : ''}>
          <div style="font-weight:600;margin-bottom:0.4rem;">🔗 Adapted to Helplessness</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">Reduce POW by 1d6 (affects SAN, Recovery SAN, and Breaking Point).</div>
        </div>
      </div>`;

      if (state.vhAdaptedTo && state.vhAdaptRoll === null) {
        html += `
      <button class="btn btn-gold" onclick="rollVhAdaptDice()">Roll 1d6</button>`;
      }

      if (state.vhAdaptRoll !== null) {
        const roll = state.vhAdaptRoll;
        html += `
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:0.75rem;">
        <span style="font-size:1.1rem;">You rolled: <strong>${roll}</strong></span>
      </div>`;
        if (state.vhAdaptedTo === 'violence') {
          html += `
      <div style="padding:0.75rem 1rem;background:var(--ct-surface);border-radius:8px;border:1px solid var(--border);line-height:1.8;">
        <strong>Effects applied:</strong>
        <ul style="margin:0.5rem 0 0 1.25rem;">
          <li>CHA reduced by ${roll} (new value: ${getAttrValue('CHA')})</li>
          ${state.bonds.map(b => `<li>${escapeHtml(b.name || 'Unnamed bond')}: reduced by ${roll} (new value: ${getBondEffectiveValue(b)})</li>`).join('')}
        </ul>
        <p style="margin-top:0.5rem;font-size:0.82rem;color:var(--text-secondary);">All violence incidents are pre-checked — you are already adapted to violence.</p>
      </div>`;
        } else {
          html += `
      <div style="padding:0.75rem 1rem;background:var(--ct-surface);border-radius:8px;border:1px solid var(--border);line-height:1.8;">
        <strong>Effects applied:</strong>
        <ul style="margin:0.5rem 0 0 1.25rem;">
          <li>POW reduced by ${roll} (new value: ${getAttrValue('POW')}) — SAN, Recovery SAN, and Breaking Point will be recalculated.</li>
        </ul>
        <p style="margin-top:0.5rem;font-size:0.82rem;color:var(--text-secondary);">All helplessness incidents are pre-checked — you are already adapted to helplessness.</p>
      </div>`;
        }
      }

      html += `
    </div>`;
    } else {
      html += `
    <div class="sheet-section" style="margin-top:1.5rem;">
      <div class="sheet-section-title">Part 2 — Adaptation</div>
      <p style="color:var(--text-secondary);">
        Your CHA (${origCha}) and POW (${origPow}) are both 10 or above — no adaptation effect applies.
      </p>
    </div>`;
    }
  }

  html += `
  </div>`;
  return html;
}

// ── RENDER: Step 5 — Motivations & Backstory ─────────────────

function renderStep5() {
  // If the character started with a disorder from a very harsh upbringing + failed POW test,
  // they only have 4 motivation slots (one is already consumed by the starting disorder).
  const startedWithDisorder = state.vhPowDisorderId !== null;
  const motivationCount = startedWithDisorder ? 4 : 5;
  const motivations = Array.isArray(state.identity.motivations)
    ? state.identity.motivations
    : makeDefaultMotivations();

  const motivationFields = Array.from({ length: motivationCount }, (_, i) => {
    const m = motivations[i] || { text: '', crossed: false };
    return `<div class="motivation-builder-row">
      <span class="motivation-number">${i + 1}.</span>
      <input class="motivation-input" type="text"
             placeholder="Describe a motivation…"
             value="${escapeHtml(m.text)}"
             oninput="updateMotivation(${i},this.value)"
             aria-label="Motivation ${i + 1}" />
    </div>`;
  }).join('');

  const disorderNote = startedWithDisorder
    ? `<p class="motivation-disorder-note">⚠ Your character started with a disorder due to a very harsh upbringing and a failed POW roll. Only 4 motivation slots are available.</p>`
    : '';

  return `
  <div class="step-content">
    <h2 class="step-title">Motivations &amp; Backstory</h2>
    <p class="step-subtitle">Define what drives your investigator and the history that shaped them. Both fields are optional.</p>

    <div class="form-group">
      <label class="form-label">Motivations</label>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.5rem;line-height:1.6;">
        Describe up to ${motivationCount} things your investigator finds meaningful — people, beliefs, causes, or ideals they would risk their sanity to protect.
        Examples: <em>protecting my younger sister</em>, <em>uncovering the truth no matter the cost</em>, <em>preserving ancient knowledge</em>, <em>loyalty to my colleagues</em>, <em>faith in a higher power</em>.
      </p>
      ${disorderNote}
      <div class="motivation-fields">${motivationFields}</div>
    </div>

    <div class="form-group" style="margin-top:1.5rem;">
      <label class="form-label">Backstory</label>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.5rem;line-height:1.6;">
        What drove you to investigate the unknown? What do you stand to lose?
      </p>
      <textarea class="form-textarea" id="char-backstory" rows="5"
                placeholder="What drove you to investigate the unknown? What do you stand to lose?"
                oninput="updateIdentity('backstory',this.value)">${escapeHtml(state.identity.backstory)}</textarea>
    </div>

    <div class="form-group" style="margin-top:1.5rem;">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="char-notes" rows="5"
                placeholder="Session notes, clues, reminders…"
                oninput="updateIdentity('notes',this.value)">${escapeHtml(state.identity.notes)}</textarea>
    </div>
  </div>`;
}

// ── RENDER: Step 6 — Identity & Export ──────────────────────

function buildCharSheetHtml() {
  const arch    = getArchetype();
  const derived = calculateDerived();
  const skills  = getCurrentSkills();

  const skillsForSheet = [
    ...Object.keys(skills)
      .sort((a, b) => a.localeCompare(b))
      .map(s => {
        const base    = skills[s];
        const archBon = getArchetypeSkillBonus(s);
        const final   = getFinalSkillValue(s);
        return { name: s, displayName: getSkillDisplayName(s), base, archBon, final, boosted: archBon > 0 };
      })
      .filter(s => state.showAllSkills || state.editMode || s.final > 0 || s.name === 'Unnatural'),
    ...(state.customSkills || [])
      .filter(cs => state.editMode || (cs.customName || '').trim() !== '')
      .map(cs => ({
        name: `custom_${cs.id}`,
        displayName: getCustomSkillDisplayName(cs),
        base: cs.baseValue,
        archBon: 0,
        final: getFinalCustomSkillValue(cs),
        boosted: false,
      }))
      .filter(s => state.showAllSkills || state.editMode || s.final > 0),
  ].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return `
  <div class="character-sheet" id="character-sheet">
    <div class="sheet-header">
      <div>
        <div class="sheet-name">${escapeHtml(state.identity.name)}</div>
        <div class="sheet-meta" style="margin-top:3px;">
          <span>Profession / Occupation <strong id="sheet-profession">${state.identity.profession ? escapeHtml(state.identity.profession) : '—'}</strong></span>
          <span>Gender <strong id="sheet-gender">${state.identity.gender ? escapeHtml(state.identity.gender) : '—'}</strong></span>
          <span>Birthplace <strong id="sheet-birthplace">${state.identity.birthplace ? escapeHtml(state.identity.birthplace) : '—'}</strong></span>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:1rem;">
        <div class="sheet-meta">
          <span>Archetype <strong>${arch ? arch.name : '—'}</strong></span>
          <span>Age <strong id="sheet-age">${state.identity.characterAge}</strong></span>
          <span><strong>${state.age === 'jazz' ? 'Jazz Age' : state.age === 'coldwar' ? 'Cold War' : state.age === 'victorian' ? 'Victorian Age' : state.age === 'ww1' ? 'World War I' : state.age === 'ww2' ? 'World War II' : state.age === 'future' ? 'The Future' : state.age === 'medieval' ? 'Medieval Era' : state.age === 'classical' ? 'Classical Era' : state.age === 'sails' ? 'Age of Sails' : state.age === 'revolutions' ? 'Age of Revolutions' : state.age === 'elizabethan' ? 'Elizabethan Age' : state.age === 'alazrad' ? 'Age of Al-Azrad' : 'Modern Age'}</strong></span>
          ${state.upbringing ? `<span>Upbringing: <strong>${state.upbringing === 'very_harsh' ? 'Very Harsh' : state.upbringing === 'harsh' ? 'Harsh' : 'Normal'}</strong></span>` : ''}
        </div>
        <div style="display:flex;align-items:flex-start;gap:0.5rem;">
          <button class="sheet-edit-mode-btn no-print${state.editMode ? ' active' : ''}" onclick="toggleEditMode()" aria-label="${state.editMode ? 'Exit edit mode' : 'Enter edit mode'}" title="${state.editMode ? 'Exit edit mode' : 'Enter edit mode'}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <div class="sheet-settings" id="sheet-settings">
            <button class="sheet-settings-btn" onclick="toggleSheetSettings(event)" aria-label="Sheet settings" aria-expanded="false" aria-haspopup="true" title="Sheet settings">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <div class="sheet-settings-dropdown" id="sheet-settings-dropdown">
              <label class="sheet-settings-item">
                <input type="checkbox" ${state.showAllSkills ? 'checked' : ''} onchange="toggleShowAllSkills()">
                <span>Show All Skills</span>
              </label>
              <button class="sheet-settings-item sheet-settings-action" onclick="triggerImport()">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Import Character</span>
              </button>
              <button class="sheet-settings-item sheet-settings-action" onclick="exportToJson()">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Export to JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Attributes</div>
      <div class="attrs-row">
        ${ATTRIBUTES.map(a => {
          const v = getDisplayedAttrValue(a);
          const feature = getDistinguishingFeature(a, v);
          return `<div class="attr-box">
            <div class="ab-name">${a}</div>
            ${state.editMode ? `
            <div class="attr-edit-controls no-print">
              <button class="stat-btn stat-btn-compact" onclick="adjustAttrInEditMode('${a}',-1)" title="Decrease ${a}" aria-label="Decrease ${a}">−</button>
              <span class="ab-val">${v}</span>
              <button class="stat-btn stat-btn-compact" onclick="adjustAttrInEditMode('${a}',1)" title="Increase ${a}" aria-label="Increase ${a}">+</button>
            </div>
            ` : `<div class="ab-val">${v}</div>`}
            <div class="ab-x5${state.exhausted ? ' ab-x5-exhausted' : ''}">${state.exhausted ? Math.max(0, v * 5 - 20) : v * 5}%</div>
            ${feature ? `<div class="ab-feature">${feature}</div>` : ''}
          </div>`;
        }).join('')}
        <div class="exhausted-col">
          <div class="exhausted-inner-row">
            <div class="exhausted-checks">
              <label class="exhausted-label${state.exhausted ? ' exhausted-active' : ''}" data-tooltip="A Protagonist who works too long or faces extreme danger and injury without resting becomes exhausted. An exhausted Protagonist suffers a −20% penalty to all skills, stat tests, and SAN tests, and loses 1D6 WP. The exhausted Protagonist loses another 1D6 WP after going another night without sleep, after working hard for a few hours, or after running or fighting for a few minutes. A full night's sleep cures exhaustion.">
                <input type="checkbox" class="san-checkbox" ${state.exhausted ? 'checked' : ''} onchange="toggleExhausted()">
                <span>Exhausted</span>
              </label>
              <label class="exhausted-label temp-insanity-label${state.temporaryInsanity ? ' temp-insanity-active' : ''}" data-tooltip="For a short time, you cannot control your Protagonist's actions. Your Protagonist's primitive brain switches to pure panic, with one of three possible responses: Flee, Struggle, or Submit. Work with the Game Moderator to determine which stance your Protagonist takes. Each is more likely in some circumstances than others. If the circumstances are calm, it may be possible to talk your Protagonist down from temporary insanity. Such attempts are tests of the Psychoanalyze skill. In the absence of anything like that, your Protagonist loses control until the insanity runs its course.">
                <input type="checkbox" class="san-checkbox" ${state.temporaryInsanity ? 'checked' : ''} onchange="toggleTemporaryInsanity()">
                <span>Temp. Insanity</span>
              </label>
            </div>
            ${(() => {
              if (!hasSocietalClass()) return '';
              const sc = calculateSocietalClass();
              if (!sc) return '';
              return `<div class="societal-class-block" data-tooltip="Societal Class is determined by social skills, community bonds, and resources. Score: ${sc.score}">
                <div class="sc-label">Societal Class</div>
                <div class="sc-value">${escapeHtml(sc.label)}</div>
                <div class="sc-score">(${sc.score})</div>
              </div>`;
            })()}
          </div>
          <div class="stat-status-badges">
            <span id="hp-status-badge">${derived ? getHPBadgeContent(getEffectiveHP()) : ''}</span>
            <span id="wp-status-badge">${derived ? getWPBadgeContent(getEffectiveWP()) : ''}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Derived Statistics</div>
      <div class="derived-stats-columns">
        <div class="derived-stats-col">
          <div class="derived-row">
            <div class="derived-box" data-tooltip="⌈(STR + CON) ÷ 2⌉">
              <span class="db-name">HP</span>
              ${derived ? `<div class="db-val-group">
                <button class="stat-btn" onclick="adjustHP(-1)" title="Decrease HP" aria-label="Decrease HP">−</button>
                <span class="db-current-val${getHPStatusClass(getEffectiveHP())}" id="hp-current-val" ondblclick="startEditStat('HP')" title="Double-click to edit">${getEffectiveHP()}</span>
                <span class="db-separator">/</span>
                <span class="db-max-val">${derived.HP}</span>
                <button class="stat-btn" onclick="adjustHP(1)" title="Increase HP" aria-label="Increase HP">+</button>
              </div>` : `<span class="db-val">—</span>`}
            </div>
            <div class="derived-box" data-tooltip="Equal to POW">
              <span class="db-name">WP</span>
              ${derived ? `<div class="db-val-group">
                <button class="stat-btn" onclick="adjustWP(-1)" title="Decrease WP" aria-label="Decrease WP">−</button>
                <span class="db-current-val${getWPStatusClass(getEffectiveWP())}" id="wp-current-val" ondblclick="startEditStat('WP')" title="Double-click to edit">${getEffectiveWP()}</span>
                <span class="db-separator">/</span>
                <span class="db-max-val">${derived.WP}</span>
                <button class="stat-btn" onclick="adjustWP(1)" title="Increase WP" aria-label="Increase WP">+</button>
              </div>` : `<span class="db-val">—</span>`}
            </div>
            <div class="derived-box" data-tooltip="STR 1–4: −2 | 5–8: −1 | 9–12: 0 | 13–16: +1 | 17+: +2">
              <span class="db-name">Dmg Bonus</span><span class="db-val">${derived ? (derived.DMG > 0 ? '+' + derived.DMG : derived.DMG) : '—'}</span>
            </div>
            <div class="derived-box" data-tooltip="Armour points that reduce incoming damage">
              <span class="db-name">Body Armour</span>
              <div class="db-val-group">
                ${state.editMode ? `<button class="stat-btn no-print" onclick="adjustBodyArmour(-1)" title="Decrease Body Armour" aria-label="Decrease Body Armour">−</button>` : ''}
                <span class="db-val">${state.bodyArmour || 0}</span>
                ${state.editMode ? `<button class="stat-btn no-print" onclick="adjustBodyArmour(1)" title="Increase Body Armour" aria-label="Increase Body Armour">+</button>` : ''}
              </div>
            </div>
            <div class="derived-box" data-tooltip="Always 50">
              <span class="db-name">Luck</span>
              <span class="db-val">50</span>
            </div>
          </div>
          <div class="perm-injuries-block">
            <div class="san-incidents-title">Permanent Injuries</div>
            <div class="sheet-backstory sheet-backstory-compact" id="sheet-permanent-injuries" title="Double-click to edit" ondblclick="startEditText('permanentInjuries','sheet-permanent-injuries')">${state.identity.permanentInjuries.trim() ? escapeHtml(state.identity.permanentInjuries) : ''}</div>
          </div>
        </div>
        <div class="derived-stats-col">
          <div class="derived-row">
            <div class="derived-box" data-tooltip="${(state.upbringing === 'harsh' || state.upbringing === 'very_harsh') ? 'POW × 4 (Harsh/Very Harsh upbringing)' : 'POW × 5 (Normal upbringing)'}">
              <span class="db-name">SAN</span>
              ${derived ? `<div class="db-val-group">
                <button class="stat-btn" onclick="adjustSAN(-1)" title="Decrease SAN" aria-label="Decrease SAN">−</button>
                <span class="db-current-val" id="san-current-val" ondblclick="startEditStat('SAN')" title="Double-click to edit">${getEffectiveSAN()}${state.exhausted ? `<span class="exhausted-san-penalty">(${Math.max(0, getEffectiveSAN() - 20)})</span>` : ''}</span>
                <button class="stat-btn" onclick="adjustSAN(1)" title="Increase SAN" aria-label="Increase SAN">+</button>
              </div>` : `<span class="db-val">—</span>`}
            </div>
            <div class="derived-box" data-tooltip="Breaking Point = SAN − POW (adjust for permanent SAN changes)">
              <span class="db-name">BP</span>
              ${derived ? `<div class="db-val-group">
                ${state.editMode ? `<button class="stat-btn no-print" onclick="adjustBP(-1)" title="Decrease BP" aria-label="Decrease BP">−</button>` : ''}
                <span class="db-val" id="bp-val">${derived.BP + (state.bpAdjust || 0)}</span>
                ${state.editMode ? `<button class="stat-btn no-print" onclick="adjustBP(1)" title="Increase BP" aria-label="Increase BP">+</button>` : ''}
              </div>` : `<span class="db-val">—</span>`}
            </div>
            <div class="derived-box" data-tooltip="99 − Unnatural skill">
              <span class="db-name">Max SAN</span><span class="db-val">${derived ? derived.MaxSAN : '—'}</span>
            </div>
            <div class="derived-box" data-tooltip="Always POW × 5">
              <span class="db-name">Recovery SAN</span><span class="db-val">${derived ? derived.RecoverySAN : '—'}</span>
            </div>
          </div>
          <div class="san-incidents-block">
            <div class="san-incidents-title">Incidents of SAN loss</div>
            <div class="san-incident-row">
              <span class="san-incident-label">Violence</span>
              <span class="san-incident-boxes">
                <input type="checkbox" class="san-checkbox" ${state.violenceChecked[0] ? 'checked' : ''} onchange="toggleViolenceCheck(0)">
                <input type="checkbox" class="san-checkbox" ${state.violenceChecked[1] ? 'checked' : ''} onchange="toggleViolenceCheck(1)">
                <input type="checkbox" class="san-checkbox" ${state.violenceChecked[2] ? 'checked' : ''} onchange="toggleViolenceCheck(2)">
              </span>
              ${state.violenceChecked.every(b => b) ? `<span class="adapted-badge">Adapted</span>` : ''}
            </div>
            <div class="san-incident-row">
              <span class="san-incident-label">Helplessness</span>
              <span class="san-incident-boxes">
                <input type="checkbox" class="san-checkbox" ${state.helplessnessChecked[0] ? 'checked' : ''} onchange="toggleHelplessnessCheck(0)">
                <input type="checkbox" class="san-checkbox" ${state.helplessnessChecked[1] ? 'checked' : ''} onchange="toggleHelplessnessCheck(1)">
                <input type="checkbox" class="san-checkbox" ${state.helplessnessChecked[2] ? 'checked' : ''} onchange="toggleHelplessnessCheck(2)">
              </span>
              ${state.helplessnessChecked.every(b => b) ? `<span class="adapted-badge">Adapted</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>

      <div class="sheet-section">
      <div class="sheet-section-title">Resources</div>
      ${(() => {
        const resRating = getDisplayedResources();
        const cap = getResourcesCapacity(resRating);
        const checkboxHtml = Array(cap.checkboxes).fill(0).map((_, i) =>
          `<input type="checkbox" class="resource-checkbox" data-idx="${i}" ${state.resourceChecked[i] ? 'checked' : ''} onchange="toggleResourceCheck(${i})">`
        ).join('');
        return `
        <div class="resource-row">
          <div class="resource-block">
            <span class="resource-label">Rating</span>
            ${state.editMode ? `<div class="db-val-group no-print" style="display:inline-flex;align-items:center;gap:4px;">
              <button class="stat-btn stat-btn-compact no-print" onclick="adjustResourcesInEditMode(-1)" title="Decrease Resources rating" aria-label="Decrease Resources rating">−</button>
              <span class="resource-rating-val">${resRating}</span>
              <button class="stat-btn stat-btn-compact no-print" onclick="adjustResourcesInEditMode(1)" title="Increase Resources rating" aria-label="Increase Resources rating">+</button>
            </div>` : `<span class="resource-rating-val">${resRating}</span>`}
          </div>
          <div class="resource-block">
            <span class="resource-label">At Hand / Stowed / In Storage</span>
            <span class="resource-capacity-val">${cap.atHand} / ${cap.stowed} / ${cap.inStorage}</span>
          </div>
          ${cap.checkboxes > 0 ? `<div class="resource-checkboxes">${checkboxHtml}</div>` : ''}
        </div>`;
      })()}
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Skills</div>
      <div class="skills-grid-sheet${state.exhausted ? ' skills-exhausted' : ''}">
        ${skillsForSheet.map(s => {
          const isCustom = s.name.startsWith('custom_');
          const editAdj = state.skillEditAdjust[s.name] || 0;
          const exhaustPenalty = state.exhausted ? -20 : 0;
          const displayVal = isCustom
            ? Math.min(99, Math.max(0, s.final + editAdj + exhaustPenalty))
            : getDisplayedSkillValue(s.name);
          const isUnnatural = s.name === 'Unnatural';
          if (state.editMode) {
            const isTyped = s.name.includes('(Type)');
            if (isCustom) {
              const csId = parseInt(s.name.replace('custom_', ''), 10);
              const cs = state.customSkills.find(c => c.id === csId);
              if (!cs) return '';
              return `
              <div class="skill-row-sheet">
                <input type="text" class="skill-type-input skill-custom-name-input" placeholder="Skill name…"
                  value="${escapeHtml(cs.customName || '')}"
                  oninput="updateCustomSkillName(${cs.id},this.value)"
                  aria-label="Custom skill name" />
                <span class="sr-val">${displayVal}%</span>
                <div class="skill-edit-controls no-print">
                  <button class="stat-btn stat-btn-compact" onclick="adjustCustomSkillInEditMode(${cs.id},-1)" title="Decrease" aria-label="Decrease ${escapeHtml(s.displayName)}">−</button>
                  <button class="stat-btn stat-btn-compact" onclick="adjustCustomSkillInEditMode(${cs.id},1)" title="Increase" aria-label="Increase ${escapeHtml(s.displayName)}">+</button>
                  <button class="remove-custom-skill-btn no-print" onclick="removeCustomSkill(${cs.id})" title="Remove skill" aria-label="Remove ${escapeHtml(s.displayName)}">×</button>
                </div>
              </div>`;
            }
            return `
            <div class="skill-row-sheet${isTyped ? ' skill-row-sheet-typed' : ''}">
              ${isTyped ? `<div class="sr-name-wrap">
                <span class="sr-name skill-tip ${s.boosted || editAdj > 0 ? 'boosted' : ''}"${skillTooltipAttr(s.name)}>${s.displayName}</span>
                <div class="skill-type-input-wrap"><input type="text" class="skill-type-input" placeholder="Enter type…"
                  value="${escapeHtml(state.skillTypes[s.name] || '')}"
                  oninput="updateSkillType('${escapeHtml(s.name)}',this.value)"
                  aria-label="Specify type for ${escapeHtml(s.displayName)}" /></div>
              </div>` : `<span class="sr-name skill-tip ${s.boosted || editAdj > 0 ? 'boosted' : ''}"${skillTooltipAttr(s.name)}>${s.displayName}</span>`}
              <span class="sr-val">${displayVal}%</span>
              <div class="skill-edit-controls no-print">
                <button class="stat-btn stat-btn-compact" onclick="adjustSkillInEditMode('${escapeHtml(s.name)}',-1)" title="Decrease ${s.displayName}" aria-label="Decrease ${s.displayName}">−</button>
                <button class="stat-btn stat-btn-compact" onclick="adjustSkillInEditMode('${escapeHtml(s.name)}',1)" title="Increase ${s.displayName}" aria-label="Increase ${s.displayName}">+</button>
              </div>
            </div>`;
          }
          return `
          <div class="skill-row-sheet">
            <span class="sr-name skill-tip ${s.boosted || editAdj > 0 ? 'boosted' : ''}"${skillTooltipAttr(s.name)}>${s.displayName}</span>
            <span class="sr-val">${displayVal}%</span>
            <input type="checkbox" class="skill-sheet-cb" data-skill="${escapeHtml(s.name)}" ${state.skillChecked[s.name] ? 'checked' : ''} onchange="toggleSkillCheck(this.dataset.skill)" ${isUnnatural ? 'style="visibility:hidden" aria-hidden="true" disabled' : ''}>
          </div>`;
        }).join('')}
      </div>
      ${state.editMode ? `<div class="no-print" style="margin-top:0.6rem;"><button class="add-custom-skill-btn" onclick="addCustomSkill()" title="Add a new custom skill starting at 0%">＋ Add Skill</button></div>` : ''}
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Bonds</div>
      <div class="bonds-sheet-list">
        ${state.bonds.map((b, origIdx) => {
          const isIncomplete = !b.name || !b.name.trim() || !b.type;
          if (isIncomplete && !state.editMode) return '';
          if (isIncomplete && state.editMode) {
            const isIndividual = b.type === 'individual';
            const isCommunity = b.type === 'community';
            return `<div class="bond-row no-print" style="margin-bottom:0.4rem;">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                <button class="bond-type-btn${isIndividual ? ' active-personal' : ''}" onclick="updateSheetBondType(${origIdx},'individual')">Personal</button>
                <button class="bond-type-btn${isCommunity ? ' active-community' : ''}" onclick="updateSheetBondType(${origIdx},'community')">Community</button>
                ${b.type
                  ? `<input class="bond-input" type="text" placeholder="${isIndividual ? 'Name a person\u2026' : 'Name an organization\u2026'}" value="${escapeHtml(b.name)}" oninput="updateSheetBondName(${origIdx},this.value)" onblur="render()" style="flex:1;min-width:10rem;" aria-label="Bond name" />`
                  : `<input class="bond-input" type="text" placeholder="Select a type first\u2026" disabled style="flex:1;min-width:10rem;opacity:0.4;" aria-hidden="true" />`}
                <span style="font-size:1rem;font-family:var(--font-head);color:var(--accent-gold);min-width:2rem;text-align:right;">1</span>
                <button class="remove-custom-skill-btn no-print" onclick="removeSheetBond(${origIdx})" data-tooltip="Bonds shouldn&#39;t be removed. If a bond is broken, lower its score to 0 instead." aria-label="Remove bond">×</button>
              </div>
            </div>`;
          }
          const playScore = getBondPlayScore(b);
          const typeLabel = b.type === 'community' ? 'Community' : 'Personal';
          return `<div class="bond-sheet-row${playScore === 0 ? ' bond-broken' : ''}">
            <span class="bond-type-badge bond-type-${b.type}">${typeLabel}</span>
            <span class="bond-sheet-name" id="bond-sheet-name-${origIdx}" title="Double-click to edit" ondblclick="startEditBondName(${origIdx})">${b.name ? escapeHtml(b.name) : '<span class="bond-name-empty">—</span>'}</span>
            <span class="bond-score-group">
              ${renderBondStatusBadge(b, playScore)}
              ${state.editMode ? `<button class="stat-btn stat-btn-compact no-print" onclick="adjustBondPlayScore(${origIdx},-1)" title="Damage bond" aria-label="Decrease bond score">−</button>` : ''}
              <span class="bond-sheet-val" id="bond-score-${origIdx}">${playScore !== null ? playScore : '—'}</span>
              ${state.editMode ? `<button class="stat-btn stat-btn-compact no-print" onclick="adjustBondPlayScore(${origIdx},1)" title="Restore bond" aria-label="Increase bond score">+</button>` : ''}
              ${state.editMode ? `<button class="remove-custom-skill-btn no-print" onclick="removeSheetBond(${origIdx})" data-tooltip="Bonds shouldn&#39;t be removed. If a bond is broken, lower its score to 0 instead." aria-label="Remove bond">×</button>` : ''}
            </span>
          </div>`;
        }).join('')}
      </div>
      ${state.editMode ? `<div class="no-print" style="margin-top:0.5rem;"><button class="add-custom-skill-btn" onclick="addSheetBond()">＋ Add Bond</button></div>` : ''}
    </div>

    <div class="sheet-2col-row">
      <div class="sheet-section">
        <div class="sheet-section-title">Motivations</div>
        <div class="motivation-list" id="sheet-motivations">
          ${(() => {
            const motivations = Array.isArray(state.identity.motivations)
              ? state.identity.motivations
              : makeDefaultMotivations();
            return motivations.map((m, i) => `
              <div class="motivation-row${m.crossed ? ' motivation-crossed' : ''}" id="motivation-row-${i}">
                <button class="motivation-cross-btn no-print" onclick="toggleMotivationCrossed(${i})"
                        title="${m.crossed ? 'Restore motivation' : 'Cross out motivation'}"
                        aria-label="${m.crossed ? 'Restore motivation' : 'Cross out motivation'}">${m.crossed ? '↩' : '✕'}</button>
                <span class="motivation-text" id="motivation-text-${i}" title="Double-click to edit" ondblclick="startEditMotivation(${i})">${m.text ? escapeHtml(m.text) : '<span class="motivation-empty">—</span>'}</span>
              </div>`).join('');
          })()}
        </div>
      </div>
      <div class="sheet-section">
        <div class="sheet-section-title">Disorders / Conditions</div>
        <div class="disorders-list" id="disorders-list">
          ${state.disorders.length === 0
            ? `<span style="font-size:0.78rem;color:var(--text-secondary);font-style:italic;">No active disorders.</span>`
            : state.disorders.map(d => `
              <div class="disorder-row" id="disorder-row-${d.id}">
                <input type="text" class="disorder-input" value="${escapeHtml(d.text)}"
                       placeholder="Describe the disorder or condition…"
                       oninput="updateDisorderText(${d.id},this.value)"
                       aria-label="Disorder description" />
                <button class="remove-custom-skill-btn" onclick="removeDisorder(${d.id})" title="Remove disorder" aria-label="Remove disorder">×</button>
              </div>`).join('')
          }
        </div>
        <button class="add-custom-skill-btn" onclick="addDisorder()" style="margin-top:0.5rem;" data-tooltip="Adding a disorder requires you to remove/strike out one of your Motivations">+ Add Disorder</button>
      </div>
    </div>

    <div class="sheet-2col-row">
      <div class="sheet-section">
        <div class="sheet-section-title">Terrible Tomes &amp; Arcane Rituals</div>
        <div class="sheet-backstory" id="sheet-terrible-tomes" title="Double-click to edit" ondblclick="startEditText('terribleTomes','sheet-terrible-tomes')">${state.identity.terribleTomes.trim() ? escapeHtml(state.identity.terribleTomes) : ''}</div>
      </div>
      <div class="sheet-section">
        <div class="sheet-section-title">Gear</div>
        <div class="sheet-backstory" id="sheet-gear" title="Double-click to edit" ondblclick="startEditText('gear','sheet-gear')">${state.identity.gear.trim() ? escapeHtml(state.identity.gear) : ''}</div>
      </div>
    </div>

    <div class="sheet-section sheet-weapons-section">
      <div class="sheet-weapons-header">
        <span class="sheet-section-title">Weapons</span>
        <span class="sheet-weapons-legend">(db) = damage bonus &nbsp; (ap) = armor piercing</span>
      </div>
      <table class="sheet-weapons-table">
        <thead>
          <tr>
            <th style="width:15%">WEAPON</th>
            <th style="width:16%">SKILL %</th>
            <th>BASE<br>RANGE</th>
            <th>DAMAGE</th>
            <th>(db)</th>
            <th>(ap)</th>
            <th>Pristine</th>
            <th>Worn</th>
            <th>Junk</th>
            <th>LETHALITY%</th>
            <th>KILL<br>RADIUS</th>
            <th>AMMO</th>
          </tr>
        </thead>
        <tbody>
          ${(Array.isArray(state.identity.weapons) ? state.identity.weapons : [{}]).map((row, i) => renderWeaponRow(row, i)).join('')}
        </tbody>
      </table>
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Backstory</div>
      <div class="sheet-backstory" id="sheet-backstory" title="Double-click to edit" ondblclick="startEditText('backstory','sheet-backstory')">${state.identity.backstory.trim() ? escapeHtml(state.identity.backstory) : ''}</div>
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Notes</div>
      <div class="sheet-backstory" id="sheet-notes" title="Double-click to edit" ondblclick="startEditText('notes','sheet-notes')">${state.identity.notes.trim() ? escapeHtml(state.identity.notes) : ''}</div>
    </div>
  </div>`;
}

function renderStep6() {
  const charSheetHtml = buildCharSheetHtml();

  return `
  <div class="step-content">
    <h2 class="step-title">Forge Your Identity</h2>
    <p class="step-subtitle">Give your investigator a name and history. The cosmos is indifferent to your existence, but your allies are not.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;" class="sm:grid-cols-1 no-print">
      <div>
        <div class="form-group">
          <label class="form-label">Character Name</label>
          <input class="form-input" type="text" id="char-name"
                 placeholder="Full name of your investigator"
                 value="${escapeHtml(state.identity.name)}"
                 oninput="updateIdentity('name',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Profession / Occupation</label>
          <input class="form-input" type="text" id="char-profession"
                 placeholder="How do you earn your living?"
                 value="${escapeHtml(state.identity.profession)}"
                 oninput="updateIdentity('profession',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Gender</label>
          <input class="form-input" type="text" id="char-gender"
                 placeholder="How do you identify?"
                 value="${escapeHtml(state.identity.gender)}"
                 oninput="updateIdentity('gender',this.value)" />
        </div>
      </div>
      <div>
        <div class="form-group">
          <label class="form-label">Birthplace</label>
          <input class="form-input" type="text" id="char-birthplace"
                 placeholder="Where are you from?"
                 value="${escapeHtml(state.identity.birthplace)}"
                 oninput="updateIdentity('birthplace',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Age</label>
          <input class="form-input" type="number" id="char-age"
                 min="18" max="80" placeholder="18–80"
                 value="${state.identity.characterAge}"
                 oninput="updateIdentity('characterAge',parseInt(this.value)||25)" />
        </div>
      </div>
    </div>

    <div class="ornament-divider no-print">✦</div>

    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;" class="no-print">
      <button class="btn btn-gold" onclick="printCharacter()">
        <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24">
          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Print
      </button>
      <button class="btn btn-danger" onclick="confirmReset()">
        ↺ Start Over
      </button>
      <button class="btn btn-gold" onclick="enterPlayMode()">
        ▶ Play Mode
      </button>
      <button class="btn btn-gold" onclick="exportToOriginalSheet()">
        ⊞ View as Character Sheet
      </button>
    </div>
    ${charSheetHtml}
  </div>`;
}

function updateIdentity(field, value) {
  state.identity[field] = value;

  if (field === 'name') {
    const nameEl = document.querySelector('.sheet-name');
    if (nameEl) nameEl.textContent = value;
  } else {
    if (field === 'profession') {
      const profEl = document.getElementById('sheet-profession');
      if (profEl) profEl.textContent = value.trim() ? value : '—';
    } else if (field === 'gender') {
      const genderEl = document.getElementById('sheet-gender');
      if (genderEl) genderEl.textContent = value.trim() ? value : '—';
    } else if (field === 'birthplace') {
      const natEl = document.getElementById('sheet-birthplace');
      if (natEl) natEl.textContent = value.trim() ? value : '—';
    } else if (field === 'backstory') {
      const backstoryEl = document.getElementById('sheet-backstory');
      if (backstoryEl) backstoryEl.textContent = value.trim() ? value : '';
    } else if (field === 'notes') {
      const notesEl = document.getElementById('sheet-notes');
      if (notesEl) notesEl.textContent = value.trim() ? value : '';
    } else if (field === 'characterAge') {
      const ageEl = document.getElementById('sheet-age');
      if (ageEl) ageEl.textContent = value;
    }
  }
}

function toggleResourceCheck(idx) {
  state.resourceChecked[idx] = !(state.resourceChecked[idx] || false);
}

function toggleSkillCheck(skillName) {
  state.skillChecked[skillName] = !(state.skillChecked[skillName] || false);
}

function toggleViolenceCheck(idx) {
  state.violenceChecked[idx] = !state.violenceChecked[idx];
  // Re-render to show/hide the Adapted badge
  render();
}

function toggleHelplessnessCheck(idx) {
  state.helplessnessChecked[idx] = !state.helplessnessChecked[idx];
  // Re-render to show/hide the Adapted badge
  render();
}

function toggleExhausted() {
  state.exhausted = !state.exhausted;
  render();
}

function toggleTemporaryInsanity() {
  state.temporaryInsanity = !state.temporaryInsanity;
  render();
}

// ── HP / WP / SAN Adjustment ────────────────────────────────

function adjustHP(delta) {
  const d = calculateDerived();
  if (!d) return;
  state.currentHP = Math.max(0, Math.min(getEffectiveHP() + delta, d.HP));
  const el = document.getElementById('hp-current-val');
  if (el) {
    el.textContent = state.currentHP;
    el.className = 'db-current-val' + getHPStatusClass(state.currentHP);
  }
  const badgeEl = document.getElementById('hp-status-badge');
  if (badgeEl) badgeEl.innerHTML = getHPBadgeContent(state.currentHP);
}

function adjustWP(delta) {
  const d = calculateDerived();
  if (!d) return;
  state.currentWP = Math.max(0, Math.min(getEffectiveWP() + delta, d.WP));
  const el = document.getElementById('wp-current-val');
  if (el) {
    el.textContent = state.currentWP;
    el.className = 'db-current-val' + getWPStatusClass(state.currentWP);
  }
  const badgeEl = document.getElementById('wp-status-badge');
  if (badgeEl) badgeEl.innerHTML = getWPBadgeContent(state.currentWP);
}

function adjustSAN(delta) {
  const d = calculateDerived();
  if (!d) return;
  state.currentSAN = Math.max(0, Math.min(getEffectiveSAN() + delta, d.MaxSAN));
  const el = document.getElementById('san-current-val');
  if (el) el.textContent = state.currentSAN;
}

// ── Inline stat editing (double-click) ──────────────────────

function makeStatSpan(elemId, statKey, value) {
  const span = document.createElement('span');
  span.className = 'db-current-val';
  span.id = elemId;
  span.textContent = value;
  span.title = 'Double-click to edit';
  span.addEventListener('dblclick', () => startEditStat(statKey));
  return span;
}

function startEditStat(statKey) {
  const idMap = { HP: 'hp-current-val', WP: 'wp-current-val', SAN: 'san-current-val' };
  const elemId = idMap[statKey];
  const span = document.getElementById(elemId);
  if (!span || span.tagName === 'INPUT') return;

  const current = parseInt(span.textContent, 10);
  const input = document.createElement('input');
  input.type = 'number';
  input.value = current;
  input.min = '0';
  input.className = 'db-edit-input';

  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    finishEditStat(statKey, elemId, input);
  };

  const cancel = () => {
    if (finished) return;
    finished = true;
    const restored = makeStatSpan(elemId, statKey, current);
    input.replaceWith(restored);
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });

  span.replaceWith(input);
  input.focus();
  input.select();
}

function finishEditStat(statKey, elemId, input) {
  const d = calculateDerived();
  let newVal;
  if (d) {
    const parsed = parseInt(input.value, 10);
    const safeVal = isNaN(parsed) ? 0 : parsed;
    if (statKey === 'HP') {
      newVal = Math.max(0, Math.min(safeVal, d.HP));
      state.currentHP = newVal;
    } else if (statKey === 'WP') {
      newVal = Math.max(0, Math.min(safeVal, d.WP));
      state.currentWP = newVal;
    } else if (statKey === 'SAN') {
      newVal = Math.max(0, Math.min(safeVal, d.MaxSAN));
      state.currentSAN = newVal;
    }
  } else {
    newVal = parseInt(input.value, 10) || 0;
  }

  const span = makeStatSpan(elemId, statKey, newVal);
  input.replaceWith(span);
}

// ── Inline text editing (double-click) ──────────────────────

function startEditText(fieldKey, elemId) {
  const div = document.getElementById(elemId);
  if (!div || div.querySelector('textarea')) return;

  const current = state.identity[fieldKey];
  const textarea = document.createElement('textarea');
  textarea.className = 'db-edit-textarea';
  textarea.value = current;

  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    finishEditText(fieldKey, elemId, textarea);
  };

  const cancel = () => {
    if (finished) return;
    finished = true;
    div.textContent = current;
  };

  textarea.addEventListener('blur', finish);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });

  div.textContent = '';
  div.appendChild(textarea);
  textarea.focus();
  textarea.select();
}

function finishEditText(fieldKey, elemId, textarea) {
  const newVal = textarea.value;
  state.identity[fieldKey] = newVal;
  const div = document.getElementById(elemId);
  if (div) {
    div.textContent = newVal;
  }
}

// ── Inline bond name editing (double-click) ──────────────────

function createBondNameSpan(origIdx, name) {
  const span = document.createElement('span');
  span.className = 'bond-sheet-name';
  span.id = 'bond-sheet-name-' + origIdx;
  span.title = 'Double-click to edit';
  if (name) {
    span.textContent = name;
  } else {
    const emptySpan = document.createElement('span');
    emptySpan.className = 'bond-name-empty';
    emptySpan.textContent = '—';
    span.appendChild(emptySpan);
  }
  span.addEventListener('dblclick', () => startEditBondName(origIdx));
  return span;
}

function startEditBondName(origIdx) {
  const elemId = 'bond-sheet-name-' + origIdx;
  const span = document.getElementById(elemId);
  if (!span || span.tagName === 'INPUT') return;

  const current = state.bonds[origIdx] ? state.bonds[origIdx].name : '';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'db-edit-bond-input';

  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    finishEditBondName(origIdx, input);
  };

  const cancel = () => {
    if (finished) return;
    finished = true;
    input.replaceWith(createBondNameSpan(origIdx, current));
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });

  span.replaceWith(input);
  input.focus();
  input.select();
}

function finishEditBondName(origIdx, input) {
  const newName = input.value;
  if (state.bonds[origIdx]) {
    state.bonds[origIdx].name = newName;
  }
  const span = createBondNameSpan(origIdx, newName);
  input.replaceWith(span);
}

// ── Sheet-mode bond management (edit mode on the character sheet) ─────────────

function addSheetBond() {
  state.bonds.push({ name: '', type: null, bonusSpent: 0, currentScore: 1, setToOne: false, upbringingReduction: 0 });
  render();
}

function removeSheetBond(idx) {
  const removed = state.bonds[idx];
  state.lastRemovedBond = { bond: { ...removed }, idx };
  state.bonds.splice(idx, 1);
  showNotification('Bond removed.');
}

function undoRemoveBond() {
  if (!state.lastRemovedBond) return;
  const { bond, idx } = state.lastRemovedBond;
  const insertAt = Math.min(idx, state.bonds.length);
  state.bonds.splice(insertAt, 0, bond);
  state.lastRemovedBond = null;
  state.notification = null;
  render();
}

function updateSheetBondName(idx, value) {
  if (state.bonds[idx]) state.bonds[idx].name = value;
}

function updateSheetBondType(idx, type) {
  if (state.bonds[idx]) state.bonds[idx].type = type;
  render();
}

function toggleShowAllSkills() {
  state.showAllSkills = !state.showAllSkills;
  render();
}

// ── Import / Export ─────────────────────────────────────────

function exportToJson() {
  // Final attribute values (including any edit-mode adjustments)
  const attributes = {};
  ATTRIBUTES.forEach(a => { attributes[a] = getDisplayedAttrValue(a); });

  // Final skill percentages for every skill in the current era (always base values, exhausted penalty is display-only)
  const skills = {};
  const baseSkills = getCurrentSkills();
  Object.keys(baseSkills).forEach(s => {
    const base = getFinalSkillValue(s);
    const editAdj = state.skillEditAdjust[s] || 0;
    skills[s] = Math.min(99, Math.max(0, base + editAdj));
  });

  // Custom skills: just name and final displayed value
  const customSkills = (state.customSkills || [])
    .filter(cs => (cs.customName || '').trim())
    .map(cs => {
      const editAdj = state.skillEditAdjust[`custom_${cs.id}`] || 0;
      return {
        name: getCustomSkillDisplayName(cs),
        value: Math.min(99, Math.max(0, getFinalCustomSkillValue(cs) + editAdj)),
      };
    });

  // Bonds: just name, type, and current in-play score (no bonusSpent)
  const bonds = (state.bonds || [])
    .filter(b => b && b.name && b.name.trim())
    .map(b => ({ name: b.name, type: b.type, currentScore: getBondPlayScore(b) }));

  const derived = calculateDerived();
  // derived is always non-null here: export is only reachable from the completed
  // character sheet (step 6) where all attributes are assigned.
  // The fallbacks below are purely defensive and should never be used.

  const exportData = {
    version: 2,
    age: state.age,
    upbringing: state.upbringing,
    archetype: state.archetype,
    identity: { ...state.identity },
    attributes,
    skills,
    skillTypes: { ...state.skillTypes },
    customSkills,
    bonds,
    resources: getDisplayedResources(),
    resourceChecked: [...(state.resourceChecked || [])],
    skillChecked: { ...state.skillChecked },
    violenceChecked: [...(state.violenceChecked || [false, false, false])],
    helplessnessChecked: [...(state.helplessnessChecked || [false, false, false])],
    maxHP:  derived ? derived.HP       : 0,
    maxWP:  derived ? derived.WP       : 0,
    maxSAN: derived ? derived.MaxSAN   : 0,
    currentHP:  derived ? Math.max(0, Math.min(state.currentHP  !== null ? state.currentHP  : derived.HP,       derived.HP))       : 0,
    currentWP:  derived ? Math.max(0, Math.min(state.currentWP  !== null ? state.currentWP  : derived.WP,       derived.WP))       : 0,
    currentSAN: derived ? Math.max(0, Math.min(state.currentSAN !== null ? state.currentSAN : derived.SAN,      derived.MaxSAN))   : 0,
    breakingPoint: derived ? derived.BP + (state.bpAdjust || 0) : 0,
    recoverySAN:   derived ? derived.RecoverySAN : 0,
    disorders: JSON.parse(JSON.stringify(state.disorders || [])),
    showAllSkills: state.showAllSkills || false,
    bodyArmour: state.bodyArmour || 0,
    exhausted: state.exhausted || false,
    temporaryInsanity: state.temporaryInsanity || false,
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (state.identity.name || 'character').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Close settings dropdown after export
  const dropdown = document.getElementById('sheet-settings-dropdown');
  if (dropdown) dropdown.classList.remove('open');
}

function exportToOriginalSheet() {
  const arch    = getArchetype();
  const derived = calculateDerived();
  const skills  = getCurrentSkills();

  // Era display name
  const eraLabel = state.age === 'jazz' ? 'Jazz Age'
    : state.age === 'coldwar'     ? 'Cold War'
    : state.age === 'victorian'   ? 'Victorian Age'
    : state.age === 'ww1'         ? 'World War I'
    : state.age === 'ww2'         ? 'World War II'
    : state.age === 'medieval'    ? 'Medieval Era'
    : state.age === 'classical'   ? 'Classical Era'
    : state.age === 'sails'       ? 'Age of Sails'
    : state.age === 'revolutions' ? 'Age of Revolutions'
    : state.age === 'elizabethan' ? 'Elizabethan Age'
    : state.age === 'alazrad'     ? 'Age of Al-Azrad'
    : state.age === 'future'      ? 'The Future'
    : 'Modern Age';

  // All skills sorted alphabetically, including 0% values
  const allSkills = [
    ...Object.keys(skills)
      .sort((a, b) => a.localeCompare(b))
      .map(s => {
        const final   = getFinalSkillValue(s);
        const editAdj = state.skillEditAdjust[s] || 0;
        const val = Math.min(99, Math.max(0, final + editAdj));
        return { displayName: getSkillDisplayName(s), val };
      }),
    ...(state.customSkills || [])
      .filter(cs => (cs.customName || '').trim())
      .map(cs => {
        const editAdj = state.skillEditAdjust[`custom_${cs.id}`] || 0;
        return {
          displayName: getCustomSkillDisplayName(cs),
          val: Math.min(99, Math.max(0, getFinalCustomSkillValue(cs) + editAdj)),
        };
      }),
  ].sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Bonds
  const bonds = state.bonds
    .filter(b => b && b.name && b.name.trim() && b.type)
    .map(b => ({
      name: b.name,
      type: b.type === 'community' ? 'Community' : 'Personal',
      score: getBondPlayScore(b),
    }));

  // Motivations
  const motivations = Array.isArray(state.identity.motivations)
    ? state.identity.motivations
    : makeDefaultMotivations();

  // Derived stats
  const hp  = derived ? getEffectiveHP() : '—';
  const maxHP  = derived ? derived.HP : '—';
  const wp  = derived ? getEffectiveWP() : '—';
  const maxWP  = derived ? derived.WP : '—';
  const san = derived ? getEffectiveSAN() : '—';
  const maxSAN = derived ? derived.MaxSAN : '—';
  const bp  = derived ? (derived.BP + (state.bpAdjust || 0)) : '—';
  const dmg = derived ? (derived.DMG > 0 ? `+${derived.DMG}` : `${derived.DMG}`) : '—';
  const recSAN = derived ? derived.RecoverySAN : '—';

  // Resources
  const resRating = getDisplayedResources();
  const resCap    = getResourcesCapacity(resRating);

  // Attributes
  const attrRows = ATTRIBUTES.map(a => {
    const v = getDisplayedAttrValue(a);
    return { name: a, val: v ?? '—', x5: v ? `${v * 5}%` : '—' };
  });

  // Helper: escape HTML
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Attribute full names
  const ATTR_FULL = { STR:'Strength', CON:'Constitution', DEX:'Dexterity', INT:'Intelligence', POW:'Power', CHA:'Charisma' };

  // HP grid helpers
  const currentHPNum = (hp !== '—') ? Number(hp) : -1;
  const maxHPNum = (maxHP !== '—') ? Number(maxHP) : 20;
  function hpCell(n) {
    const isCurr = (n === currentHPNum);
    const isOver = (n > maxHPNum);
    return `<span class="hn${isCurr?' hn-curr':''}${isOver?' hn-over':''}">${String(n).padStart(2,'0')}</span>`;
  }

  // SAN grid helpers
  const currentSANNum = (san !== '—') ? Number(san) : -1;
  const maxSANNum = (maxSAN !== '—') ? Number(maxSAN) : 99;
  function sanCell(n) {
    const isCurr = (n === currentSANNum);
    const isOver = (n > maxSANNum);
    return `<span class="sn${isCurr?' sn-curr':''}${isOver?' sn-over':''}">${String(n).padStart(2,'0')}</span>`;
  }
  // SAN main grid: 10 rows of 10 (00–09, 10–19, …, 90–99)
  const sanMainRows = (() => {
    const rows = [];
    for (let s = 0; s <= 90; s += 10) {
      const r = [];
      for (let i = s; i <= s + 9; i++) r.push(sanCell(i));
      rows.push(`<div class="san-row">${r.join('')}</div>`);
    }
    return rows.join('');
  })();

  // SAN incidents checkboxes
  function cbBox(c) {
    return `<span class="cb-box${c?' cb-checked':''}">${c?'✕':''}</span>`;
  }

  // Skills with base% and calculated value (2-column)
  const skillsSheet = Object.keys(skills)
    .sort((a, b) => a.localeCompare(b))
    .map(s => {
      const base = skills[s] || 0;
      const editAdj = state.skillEditAdjust[s] || 0;
      const val = Math.min(99, Math.max(0, getFinalSkillValue(s) + editAdj));
      return { name: s, displayName: getSkillDisplayName(s), base, val };
    });
  (state.customSkills || [])
    .filter(cs => (cs.customName || '').trim())
    .forEach(cs => {
      const editAdj = state.skillEditAdjust[`custom_${cs.id}`] || 0;
      skillsSheet.push({
        name: `custom_${cs.id}`,
        displayName: getCustomSkillDisplayName(cs),
        base: cs.baseValue || 0,
        val: Math.min(99, Math.max(0, getFinalCustomSkillValue(cs) + editAdj)),
      });
    });
  skillsSheet.sort((a, b) => a.displayName.localeCompare(b.displayName));

  function skillRowHtml(s) {
    const checked = !!(state.skillChecked && state.skillChecked[s.name]);
    return `<div class="sk-row">
      <span class="sk-name">${esc(s.displayName)} [${s.base}%]</span>
      <span class="sk-score">${s.val}%</span>
      <span class="sk-cb">${checked ? '✕' : '□'}</span>
    </div>`;
  }
  const skillHalf = Math.ceil(skillsSheet.length / 2);
  const skillRowsHtml = `<div class="sk-col">${skillsSheet.slice(0, skillHalf).map(skillRowHtml).join('')}</div>`
    + `<div class="sk-col">${skillsSheet.slice(skillHalf).map(skillRowHtml).join('')}</div>`;

  // Split bonds by type
  const indivBonds = bonds.filter(b => b.type === 'Personal');
  const commBonds  = bonds.filter(b => b.type === 'Community');

  function bondLineHtml(b) {
    return `<div class="bond-line">
      <span class="bond-lname">${b ? esc(b.name) : ''}</span>
      <span class="bond-lscore">${b ? b.score : ''}</span>
    </div>`;
  }
  const indivBondRows = Array.from({ length: Math.max(indivBonds.length, 3) }, (_, i) => bondLineHtml(indivBonds[i] || null)).join('');
  const commBondRows  = Array.from({ length: Math.max(commBonds.length, 3) }, (_, i) => bondLineHtml(commBonds[i] || null)).join('');

  // Motivations
  const motivationsHtml = motivations.map(m => {
    const crossed = m.crossed ? ' style="text-decoration:line-through;color:#888;"' : '';
    return `<div class="motiv-item"${crossed}>${esc(m.text) || ''}</div>`;
  }).join('');

  // Disorders — always show at least 5 rows
  const disorderItems = state.disorders || [];
  const disordersHtml = Array.from({ length: Math.max(disorderItems.length, 5) }, (_, i) => {
    const d = disorderItems[i];
    return `<div class="disord-item">${d ? esc(d.text) : ''}</div>`;
  }).join('');

  // Upbringing label
  const upbringingLabel = state.upbringing === 'very_harsh' ? 'Very Harsh' : state.upbringing === 'harsh' ? 'Harsh' : 'Normal';

  // Era-specific heading fonts
  const ERA_FONT_MAP = {
    jazz:        { name: 'Josefin Sans',       url: 'Josefin+Sans:wght@700' },
    modern:      { name: 'Raleway',             url: 'Raleway:wght@700' },
    coldwar:     { name: 'Special Elite',       url: 'Special+Elite' },
    victorian:   { name: 'Sancreek',            url: 'Sancreek' },
    ww1:         { name: 'Marcellus SC',        url: 'Marcellus+SC' },
    ww2:         { name: 'Special Elite',       url: 'Special+Elite' },
    future:      { name: 'Orbitron',            url: 'Orbitron:wght@700;900' },
    medieval:    { name: 'Uncial Antiqua',      url: 'Uncial+Antiqua' },
    classical:   { name: 'Cinzel',             url: 'Cinzel:wght@700;900' },
    revolutions: { name: 'Libre Baskerville',  url: 'Libre+Baskerville:wght@700' },
    sails:       { name: 'Pirata One',          url: 'Pirata+One' },
    elizabethan: { name: 'IM Fell English',     url: 'IM+Fell+English:ital@0;1' },
    alazrad:     { name: 'Almendra SC',         url: 'Almendra+SC:wght@700' },
  };
  const eraFontCfg  = ERA_FONT_MAP[state.age] || ERA_FONT_MAP.modern;
  const eraFontName = eraFontCfg.name;
  const eraFontUrl  = eraFontCfg.url;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(state.identity.name) || 'Character Sheet'} — ${esc(eraLabel)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Caveat:wght@400;600&family=${eraFontUrl}&display=swap" rel="stylesheet"/>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --era-font: '${eraFontName}', serif; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; background: #fff; }

/* ── page ── */
.page { width: 210mm; min-height: 297mm; padding: 6mm 7mm; page-break-after: always; page-break-inside: avoid; }
.page:last-child { page-break-after: auto; }

/* ── section helpers ── */
.sec { border: 1.5px solid #555; margin-bottom: 3px; }
.sec-hdr {
  background: #4a7fa0; color: #fff;
  font-family: var(--era-font); font-weight: bold; font-size: 8pt; text-transform: uppercase; letter-spacing: .1em;
  padding: 1px 4px;
}
.sec-body { padding: 3px 4px; }

/* ── top row (identity | stats | other attrs) ── */
.top-row { display: grid; grid-template-columns: 34mm 1fr 44mm; gap: 3px; margin-bottom: 3px; }

/* identity block */
.id-title-box {
  background: #4a7fa0; color: #fff; font-family: var(--era-font); font-weight: bold; font-size: 8pt;
  text-transform: uppercase; letter-spacing: .1em; text-align: center;
  padding: 1px 4px;
}
.id-block { border: 1.5px solid #555; }
.id-inner { padding: 2px 3px; }
.id-line { margin-bottom: 2px; padding-bottom: 1px; font-size: 7.5pt; }
.id-lbl { color: #555; font-size: 6.5pt; text-transform: uppercase; display: block; }
.id-val { font-weight: bold; }
.id-inline { display: flex; gap: 6px; }
.id-inline .id-line { flex: 1; }

/* statistics table */
.stats-hdr { background: #4a7fa0; color: #fff; font-family: var(--era-font); font-weight: bold; font-size: 8pt; text-align: center; text-transform: uppercase; letter-spacing: .1em; padding: 1px 4px; }
.stats-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
.stats-table th { background: #c8dce8; font-weight: bold; text-align: center; border: 1px solid #bbb; padding: 1px 2px; font-size: 7pt; }
.stats-table td { border: 1px solid #bbb; padding: 1px 3px; }
.stats-table tr:nth-child(even) td { background: #eaf3f8; }
.st-name { font-weight: bold; }
.st-score { text-align: center; font-weight: bold; font-size: 9pt; }
.st-x5 { text-align: center; font-style: italic; }
.st-feat { min-width: 30mm; }

/* other attributes */
.oa-block { border: 1.5px solid #555; }
.oa-hdr { background: #4a7fa0; color: #fff; font-family: var(--era-font); font-weight: bold; font-size: 8pt; text-transform: uppercase; letter-spacing: .1em; padding: 1px 4px; }
.oa-body { padding: 3px; }
.wp-title { font-weight: bold; font-size: 7.5pt; margin-bottom: 2px; padding-bottom: 1px; }
.wp-row { display: flex; gap: 4px; align-items: flex-end; margin-bottom: 2px; }
.wp-box-grp { display: flex; flex-direction: column; align-items: center; }
.wp-box { width: 14mm; height: 7mm; border: 2px solid #333; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10pt; }
.wp-lbl { font-size: 6pt; text-transform: uppercase; text-align: center; margin-top: 1px; }
.wp-exhausted { margin-left: 3px; }
.wp-exbox { width: 8px; height: 8px; border: 1px solid #333; display: inline-flex; align-items: center; justify-content: center; margin-right: 2px; font-size: 6pt; font-weight: bold; ${state.exhausted?'':''}}
.wp-exlbl { font-size: 6pt; }
.wp-note { font-size: 5.5pt; color: #444; line-height: 1.3; margin-bottom: 3px; }
.oa-field { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #bbb; padding: 2px 0; font-size: 7.5pt; }
.oa-field:last-child { border-bottom: none; }
.oa-flbl { font-weight: bold; }
.oa-fval { font-weight: bold; min-width: 16mm; text-align: right; font-size: 9pt; padding-right: 2px; }
.oa-fval-sm { font-size: 7pt; min-width: auto; }

/* ── middle row (HP | SAN grid | BP notes) ── */
.mid-row { display: grid; grid-template-columns: 34mm 1fr 44mm; gap: 3px; margin-bottom: 3px; }

/* HP block */
.hp-block { border: 1.5px solid #555; }
.hp-top { display: flex; align-items: baseline; justify-content: space-between; padding: 1px 3px; font-size: 6.5pt; font-weight: bold; border-bottom: 1px solid #888; background: #eaf3f8; }
.hp-maxval { min-width: 10mm; text-align: center; font-size: 9pt; }
.hp-wrapper { display: flex; align-items: flex-start; }
.hp-vlabel { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 6pt; text-transform: uppercase; letter-spacing: .1em; padding: 2px; color: #444; }
.hp-grid { flex: 1; padding: 2px 0 2px 2px; }
.hp-row { display: flex; flex-wrap: wrap; gap: 1px; margin-bottom: 2px; }
.hn { font-size: 6.5pt; border: 1px solid #ccc; padding: 0 1px; min-width: 12px; text-align: center; }
.hn-curr { background: #000; color: #fff; font-weight: bold; border-color: #000; }
.hn-over { color: #ccc; border-color: #eee; }

/* SAN grid */
.san-block { border: 1.5px solid #555; }
.san-top { display: flex; gap: 6px; align-items: baseline; padding: 1px 3px; font-size: 6.5pt; font-weight: bold; border-bottom: 1px solid #888; background: #eaf3f8; }
.san-topval { min-width: 12mm; text-align: center; font-size: 9pt; }
.san-wrapper { display: flex; align-items: flex-start; }
.san-vlabel { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 6pt; text-transform: uppercase; letter-spacing: .1em; padding: 2px; color: #444; }
.san-grid { flex: 1; padding: 2px 0 2px 2px; }
.san-row { display: flex; flex-wrap: nowrap; gap: 1px; margin-bottom: 1px; align-items: center; }
.sn { font-size: 6pt; border: 1px solid #ccc; padding: 0 1px; min-width: 11px; text-align: center; }
.sn-curr { background: #000; color: #fff; font-weight: bold; border-color: #000; }
.sn-over { color: #ccc; border-color: #eee; text-decoration: line-through; }

/* BP notes */
.bp-block { border: 1.5px solid #555; padding: 3px; font-size: 5.5pt; line-height: 1.4; color: #222; }
.bp-block p { margin-bottom: 3px; }
.bp-block p:last-child { margin-bottom: 0; }

/* ── era banner (top of page) ── */
.era-banner { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #e8f0f6; border: 1.5px solid #555; padding: 3px 6px; margin-bottom: 3px; }
.era-banner-title { font-family: var(--era-font); font-size: 14pt; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; line-height: 1; }
.era-banner-sub { font-size: 8pt; font-weight: bold; letter-spacing: .3em; text-transform: uppercase; }
.era-banner-era { font-family: var(--era-font); font-size: 10pt; font-weight: bold; letter-spacing: .2em; text-transform: uppercase; color: #333; }

/* ── perm injuries + incidents combined row ── */
.perm-inc-row { display: grid; grid-template-columns: 50mm 1fr; gap: 3px; margin-bottom: 3px; }
.perm-block { border: 1.5px solid #555; }
.perm-text { padding: 2px 3px; font-size: 7.5pt; min-height: 12mm; white-space: pre-wrap; }
.inc-block { border: 1.5px solid #555; }
.inc-body { padding: 2px 4px; }
.inc-line { display: flex; align-items: center; gap: 4px; font-size: 7.5pt; margin-bottom: 1px; }
.inc-lbl { min-width: 72px; font-weight: bold; }
.cb-box { display: inline-flex; align-items: center; justify-content: center; width: 10px; height: 10px; border: 1px solid #333; font-size: 7pt; font-weight: bold; }
.cb-checked { }

/* ── bottom row (skills | bonds) ── */
.bot-row { display: grid; grid-template-columns: 1fr 52mm; gap: 3px; }

/* skills */
.skills-block { border: 1.5px solid #555; }
.skills-note { font-size: 5.5pt; color: #555; padding: 1px 3px; border-bottom: 1px solid #ddd; }
.skills-2col { display: flex; gap: 0 4px; padding: 2px 3px; }
.sk-col { flex: 1; min-width: 0; }
.sk-row { display: flex; align-items: baseline; gap: 2px; border-bottom: 1px solid #ddd; padding: 0.5px 0; font-size: 7pt; break-inside: avoid; }
.sk-cb { flex-shrink: 0; font-size: 8pt; line-height: 1; }
.sk-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-score { flex-shrink: 0; font-weight: bold; font-size: 7pt; min-width: 18px; text-align: right; margin-left: 2px; }

/* bonds */
.bonds-block { border: 1.5px solid #555; display: flex; flex-direction: column; }
.bonds-sub-hdr { display: flex; justify-content: space-between; font-size: 6.5pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #888; padding: 1px 3px; background: #d0e8f0; }
.bond-line { display: flex; align-items: baseline; border-bottom: 1px solid #ddd; padding: 1px 3px; font-size: 7.5pt; min-height: 5mm; }
.bond-lname { flex: 1; }
.bond-lscore { min-width: 12mm; text-align: right; font-weight: bold; }
.motiv-dis-block { border-top: 1.5px solid #555; }
.motiv-item, .disord-item { font-size: 7.5pt; padding: 1px 3px; border-bottom: 1px solid #ddd; min-height: 5mm; }
.res-block { border-top: 1.5px solid #555; padding: 2px 3px; font-size: 7pt; }
.res-hdr { font-weight: bold; font-size: 7pt; text-transform: uppercase; margin-bottom: 2px; }
.res-checks { display: flex; gap: 3px; align-items: center; font-size: 7pt; margin-bottom: 2px; }
.res-caps { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2px; text-align: center; font-size: 6pt; }
.res-cap-item { border: 1px solid #888; padding: 1px; }
.res-cap-val { font-weight: bold; font-size: 7pt; }

/* ── page 2 ── */
.story-block { border: 1.5px solid #555; margin-bottom: 3px; }
.story-text { padding: 3px 4px; font-size: 8pt; line-height: 1.5; white-space: pre-wrap; min-height: 55mm; }
.story-lines { padding: 0 4px 2px; }
.story-line { border-bottom: 1px solid #aaa; height: 6mm; }
.story-line:last-child { border-bottom: none; }

.tomes-gear-row { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin-bottom: 3px; }
.tomes-block, .gear-block { border: 1.5px solid #555; }
.gear-hdr-row { display: flex; justify-content: space-between; align-items: baseline; }
.gear-cond-note { font-size: 6pt; color: #fff; padding-right: 3px; }
.generic-text { padding: 3px 4px; font-size: 7.5pt; white-space: pre-wrap; min-height: 28mm; }
.gear-line { border-bottom: 1px solid #aaa; height: 5.5mm; }
.gear-line:last-child { border-bottom: none; }
.lined-wrap { position: relative; overflow: hidden; }
.lined-rows { padding: 2px 3px; }
.lined-row { height: 5.5mm; border-bottom: 1px solid #aaa; }
.lined-row:last-child { border-bottom: none; }
.lined-row-lg { height: 6mm; border-bottom: 1px solid #aaa; }
.lined-row-lg:last-child { border-bottom: none; }
.lined-text-sm {
  position: absolute; top: 0; left: 0; right: 0;
  padding: 2px 3px 0;
  font-family: 'Caveat', cursive;
  font-size: 9pt;
  line-height: 5.5mm;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.lined-text-lg {
  position: absolute; top: 0; left: 0; right: 0;
  padding: 2px 3px 0;
  font-family: 'Caveat', cursive;
  font-size: 9pt;
  line-height: 6mm;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.wpns-block { border: 1.5px solid #555; margin-bottom: 3px; }
.wpns-hdr-row { display: flex; justify-content: space-between; align-items: baseline; }
.wpns-note { font-size: 6pt; color: #fff; padding-right: 3px; }
.wpns-table { width: 100%; border-collapse: collapse; font-size: 6.5pt; }
.wpns-table th { background: #c8dce8; font-weight: bold; border: 1px solid #ccc; padding: 1px 2px; text-align: center; font-size: 6pt; }
.wpns-table th:first-child { border-left: none; }
.wpns-table th:last-child { border-right: none; }
.wpns-table td { border: 1px solid #ccc; padding: 1px 2px; height: 6mm; }
.wpns-table td:first-child { border-left: none; }
.wpns-table td:last-child { border-right: none; }
.wpns-table tr:last-child td { border-bottom: none; }
.wpns-table tr:nth-child(even) td { background: #f5f9fc; }
.wpn-cond { display: flex; gap: 2px; justify-content: center; }

.bot-p2 { display: grid; grid-template-columns: 55mm 1fr 45mm; gap: 3px; }
.cheat-block, .notes-block, .fellows-block { border: 1.5px solid #555; }
.cheat-body { padding: 3px; font-size: 5.5pt; line-height: 1.4; }
.cheat-body p { margin-bottom: 3px; }
.notes-body { padding: 2px; }
.notes-line { border-bottom: 1px solid #aaa; height: 5.5mm; }
.notes-line:last-child { border-bottom: none; }
.fellows-body { padding: 2px 3px; }
.fellow-item { border-bottom: 1px solid #aaa; height: 5.5mm; font-size: 7.5pt; }
.fellow-item:last-child { border-bottom: none; }

@page { size: A4; margin: 0; }
@media print {
  body { background: #fff; }
  .page { border: none; padding: 6mm 7mm; width: 100%; min-height: 0; }
}
</style>
</head>
<body>

<!-- ═══════════════════════════ PAGE 1 ═══════════════════════════ -->
<div class="page">

  <!-- ── ERA BANNER ── -->
  <div class="era-banner">
    <div class="era-banner-title">Cthulhu Eternal</div>
    <div class="era-banner-era">${esc(eraLabel.toUpperCase())}</div>
  </div>

  <!-- ── TOP ROW: Identity | Statistics | Other Attributes ── -->
  <div class="top-row">

    <!-- Identity block -->
    <div class="id-block">
      <div class="id-title-box">Protagonist</div>
      <div class="id-inner">
        <div class="id-line"><span class="id-lbl">Name</span><span class="id-val">${esc(state.identity.name) || ''}</span></div>
        <div class="id-line"><span class="id-lbl">Setting</span><span class="id-val">${esc(eraLabel)}</span></div>
        <div class="id-line"><span class="id-lbl">Archetype</span><span class="id-val">${arch ? esc(arch.name) : ''}</span></div>
        <div class="id-inline">
          <div class="id-line"><span class="id-lbl">Age</span><span class="id-val">${esc(state.identity.characterAge)}</span></div>
          <div class="id-line"><span class="id-lbl">Gender</span><span class="id-val">${esc(state.identity.gender) || ''}</span></div>
        </div>
        <div class="id-line"><span class="id-lbl">Occupation</span><span class="id-val">${esc(state.identity.profession) || ''}</span></div>
        <div class="id-line"><span class="id-lbl">Birthplace</span><span class="id-val">${esc(state.identity.birthplace) || ''}</span></div>
        <div class="id-line"><span class="id-lbl">Upbringing</span><span class="id-val">${esc(upbringingLabel)}</span></div>
      </div>
    </div>

    <!-- Statistics table -->
    <div class="stats-block">
      <div class="stats-hdr">Statistics</div>
      <table class="stats-table">
        <thead>
          <tr>
            <th>Statistic</th>
            <th>Score</th>
            <th>×5</th>
            <th>Distinguishing Feature</th>
          </tr>
        </thead>
        <tbody>
          ${attrRows.map(a => {
            const feat = (a.val !== '—') ? getDistinguishingFeature(a.name, Number(a.val)) : null;
            return `<tr>
            <td class="st-name">${esc(ATTR_FULL[a.name])} (${esc(a.name)})</td>
            <td class="st-score">${a.val}</td>
            <td class="st-x5">${a.x5}</td>
            <td class="st-feat">${feat ? esc(feat) : ''}</td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Other Attributes -->
    <div class="oa-block">
      <div class="oa-hdr">Other Attributes</div>
      <div class="oa-body">
        <div class="wp-title">Willpower Points</div>
        <div class="wp-row">
          <div class="wp-box-grp"><div class="wp-box">${maxWP}</div><div class="wp-lbl">MAX</div></div>
          <div class="wp-box-grp"><div class="wp-box">${wp}</div><div class="wp-lbl">Current</div></div>
          <div class="wp-exhausted">
            <span class="wp-exbox">${state.exhausted ? '✕' : ''}</span><span class="wp-exlbl">Exhausted<br>(-20%)</span>
          </div>
        </div>
        <div class="wp-note">WP 2 or less = emotional breakdown (-20%), WP 0 = incapacitated</div>
        <div class="oa-field"><span class="oa-flbl">Damage Bonus</span><span class="oa-fval">${dmg}</span></div>
        <div class="oa-field"><span class="oa-flbl">Body Armor</span><span class="oa-fval">${state.bodyArmour || 0}</span></div>
        ${(() => {
          if (!hasSocietalClass()) return '';
          const sc = calculateSocietalClass();
          if (!sc) return '';
          return `<div class="oa-field"><span class="oa-flbl">Societal Class</span><span class="oa-fval oa-fval-sm">${esc(sc.label)} (${sc.score})</span></div>`;
        })()}
      </div>
    </div>

  </div><!-- /top-row -->

  <!-- ── MIDDLE ROW: HP tracking | SAN grid | BP notes ── -->
  <div class="mid-row">

    <!-- HP tracking -->
    <div class="hp-block">
      <div class="hp-top"><span>Max/Starting HP</span><span class="hp-maxval">${maxHP}</span></div>
      <div class="hp-wrapper">
        <div class="hp-vlabel">Current HP</div>
        <div class="hp-grid">
          <div class="hp-row">${[0,1,2,3].map(hpCell).join('')}</div>
          <div class="hp-row">${[4,5,6,7].map(hpCell).join('')}</div>
          <div class="hp-row">${[8,9,10,11].map(hpCell).join('')}</div>
          <div class="hp-row">${[12,13,14,15].map(hpCell).join('')}</div>
          <div class="hp-row">${[16,17,18,19].map(hpCell).join('')}</div>
        </div>
      </div>
    </div>

    <!-- SAN grid -->
    <div class="san-block">
      <div class="san-top">
        <span>Max SAN <span class="san-topval">${maxSAN}</span></span>
        <span>Recovery SAN <span class="san-topval">${recSAN}</span></span>
        <span>BP <span class="san-topval">${bp}</span></span>
      </div>
      <div class="san-wrapper">
        <div class="san-vlabel">Current SAN</div>
        <div class="san-grid">${sanMainRows}</div>
      </div>
    </div>

    <!-- Breaking Point notes -->
    <div class="bp-block">
      <p>● Circle current SAN on meter. Black out numbers above MAX SAN. Draw box around Breaking Point.</p>
      <p>● Third checkbox filled, character is adapted.</p>
      <p>● &gt;5 SAN lost in one roll, temporary insanity. If SAN reaches Breaking Point, acquire a Disorder and reset BP.</p>
      <p>● HP 2 or less = unconscious AND roll for permanent injury. HP of 0 = dead.</p>
    </div>

  </div><!-- /mid-row -->

  <!-- ── PERMANENT INJURIES + INCIDENTS OF SAN LOSS ── -->
  <div class="perm-inc-row">
    <div class="perm-block">
      <div class="sec-hdr">Permanent Injuries</div>
      <div class="perm-text">${esc(state.identity.permanentInjuries) || ''}</div>
    </div>
    <div class="inc-block">
      <div class="sec-hdr">Incidents of SAN Loss Without Insanity</div>
      <div class="inc-body">
      <div class="inc-line">
        <span class="inc-lbl">Violence</span>
        ${(state.violenceChecked || [false,false,false]).map(c => `<span class="cb-box${c?' cb-checked':''}">${c?'✕':''}</span>`).join('')}
      </div>
      <div class="inc-line">
        <span class="inc-lbl">Helplessness</span>
        ${(state.helplessnessChecked || [false,false,false]).map(c => `<span class="cb-box${c?' cb-checked':''}">${c?'✕':''}</span>`).join('')}
      </div>
      </div>
    </div>
  </div>

  <!-- ── BOTTOM: Skills | Bonds ── -->
  <div class="bot-row">

    <!-- Skills -->
    <div class="skills-block">
      <div class="sec-hdr">Skills</div>
      <div class="skills-note">Base ratings shown in [square brackets]. Skills with fill-in spaces for specializations have a base rating of 0%.</div>
      <div class="skills-2col">${skillRowsHtml}</div>
    </div>

    <!-- Bonds + Motivation + Resources -->
    <div class="bonds-block">
      <div class="sec-hdr">Bonds</div>
      <div class="bonds-sub-hdr"><span>Individual Bond</span><span>Score</span></div>
      ${indivBondRows}
      <div class="bonds-sub-hdr"><span>Community Bond</span><span>Score</span></div>
      ${commBondRows}
      <div class="motiv-dis-block">
        <div class="sec-hdr">Motivations</div>
        ${motivationsHtml}
      </div>
      <div class="motiv-dis-block">
        <div class="sec-hdr">Disorders</div>
        ${disordersHtml || ''}
      </div>
      <div class="motiv-dis-block">
        <div class="sec-hdr">Permanent Resources</div>
        <div class="res-block">
          <div class="res-hdr">Total Resources <strong>${resRating}</strong></div>
          <div class="res-checks">Resource Checks: ${Array.from({length: resCap.checkboxes}, (_, i) => `<span class="cb-box${(state.resourceChecked||[])[i]?' cb-checked':''}">${(state.resourceChecked||[])[i]?'✕':''}</span>`).join('')}</div>
          <div class="res-caps">
            <div class="res-cap-item"><div class="res-cap-val">${resCap.atHand}</div><div>AT HAND</div></div>
            <div class="res-cap-item"><div class="res-cap-val">${resCap.stowed}</div><div>STOWED</div></div>
            <div class="res-cap-item"><div class="res-cap-val">${resCap.inStorage === 999 ? '∞' : resCap.inStorage}</div><div>IN STORAGE</div></div>
          </div>
        </div>
      </div>
    </div>

  </div><!-- /bot-row -->

</div><!-- /page 1 -->

<!-- ═══════════════════════════ PAGE 2 ═══════════════════════════ -->
<div class="page">

  <!-- ── STORY SO FAR (full width) ── -->
  <div class="story-block">
    <div class="sec-hdr" style="font-size:10pt;text-align:center;letter-spacing:.2em;">Protagonist's Story So Far</div>
    <div class="lined-wrap">
      <div class="lined-rows">${Array(12).fill('<div class="lined-row-lg"></div>').join('')}</div>
      <div class="lined-text-lg">${esc(state.identity.backstory || '')}</div>
    </div>
  </div>

  <!-- ── DISORDERS + GEAR ── -->
  <div class="tomes-gear-row">
    <div class="tomes-block">
      <div class="sec-hdr">Terrible Tomes &amp; Arcane Rituals</div>
      <div class="lined-wrap">
        <div class="lined-rows">${Array(8).fill('<div class="lined-row"></div>').join('')}</div>
        <div class="lined-text-sm">${esc(state.identity.terribleTomes || '')}</div>
      </div>
    </div>
    <div class="gear-block">
      <div class="sec-hdr">
        <div class="gear-hdr-row"><span>Gear</span><span class="gear-cond-note">Record Pristine/Worn/Junk</span></div>
      </div>
      <div class="lined-wrap">
        <div class="lined-rows">${Array(8).fill('<div class="lined-row"></div>').join('')}</div>
        <div class="lined-text-sm">${esc(state.identity.gear || '')}</div>
      </div>
    </div>
  </div>

  <!-- ── WEAPONS ── -->
  <div class="wpns-block">
    <div class="sec-hdr">
      <div class="wpns-hdr-row"><span>Weapons</span><span class="wpns-note">(db) = damage bonus &nbsp; (ap) = armor piercing</span></div>
    </div>
    <table class="wpns-table">
      <thead>
        <tr>
          <th style="width:15%">Weapon</th>
          <th style="width:16%">Skill %</th>
          <th style="width:10%">Base Range</th>
          <th style="width:10%">Damage</th>
          <th style="width:5%">(db)</th>
          <th style="width:5%">(ap)</th>
          <th style="width:13%">Pristine/Worn/Junk</th>
          <th style="width:10%">Lethality %</th>
          <th style="width:9%">Kill Radius</th>
          <th style="width:7%">Ammo</th>
        </tr>
      </thead>
      <tbody>
        ${(() => {
          const weaponRows = Array.isArray(state.identity.weapons) ? state.identity.weapons : [];
          // Filter out the trailing blank row; pad to at least 8 rows for a readable sheet
          const dataRows = weaponRows.filter(r => r && Object.keys(makeEmptyWeaponRow()).some(k => r[k]));
          const totalRows = Math.max(dataRows.length + 1, 8);
          const dmgBonus = derived ? derived.DMG : 0;
          const dmgBonusStr = dmgBonus > 0 ? `+${dmgBonus}` : `${dmgBonus}`;
          return Array.from({ length: totalRows }, (_, i) => {
            const row = dataRows[i] || {};
            const skillName = row.skill || '';
            const skillVal  = skillName ? Math.min(99, Math.max(0, getDisplayedSkillValue(skillName))) : '';
            const skillDisp = skillName ? `${skillName} ${skillVal}%` : '';
            const showDb    = skillName === 'Melee Weapons' || skillName === 'Unarmed Combat';
            const dbDisp    = showDb ? dmgBonusStr : '';
            const condP = (row.condition || '') === 'pristine';
            const condW = (row.condition || '') === 'worn';
            const condJ = (row.condition || '') === 'junk';
            return `<tr>
              <td>${esc(row.weapon || '')}</td>
              <td>${esc(skillDisp)}</td>
              <td>${esc(row.baseRange || '')}</td>
              <td>${esc(row.damage || '')}</td>
              <td>${esc(dbDisp)}</td>
              <td>${esc(row.ap || '')}</td>
              <td><div class="wpn-cond">${cbBox(condP)}${cbBox(condW)}${cbBox(condJ)}</div></td>
              <td>${esc(row.lethality || '')}</td>
              <td>${esc(row.killRadius || '')}</td>
              <td>${esc(row.ammo || '')}</td>
            </tr>`;
          }).join('');
        })()}
      </tbody>
    </table>
  </div>

  <!-- ── BOTTOM: Cheat Sheet | Notes | Fellow Characters ── -->
  <div class="bot-p2">
    <div class="cheat-block">
      <div class="sec-hdr">Cthulhu Eternal Rules Cheat Sheet</div>
      <div class="cheat-body">
        <p><strong>Test Outcomes:</strong> Roll d100. If under test → <em>Success</em>; if digits match (or roll 01) → <em>Critical</em>. Roll over test → <em>Failure</em>; if digits match (or roll 00) → <em>Fumble</em>.</p>
        <p><strong>Opposed Tests:</strong> Both sides roll and compare results. Critical beats Success beats any failure. If both succeed or crit, whoever rolled HIGHER wins.</p>
        <p><strong>Combat Options:</strong> Aim, Attack, Called Shot, Disarm, Dodge, Escape Pin, Fight Back, Move, Pin, Wait.</p>
        <p><strong>Resisting Insanity:</strong> Project SAN loss onto Bond. Use Bond to Repress Temp Insanity / episode of Disorder.</p>
      </div>
    </div>
    <div class="notes-block">
      <div class="sec-hdr" style="text-align:center;letter-spacing:.2em;">Notes</div>
      <div class="notes-body">
        <div class="lined-wrap">
          <div class="lined-rows">${Array(10).fill('<div class="notes-line"></div>').join('')}</div>
          <div class="lined-text-sm">${esc(state.identity.notes || '')}</div>
        </div>
      </div>
    </div>
    <div class="fellows-block">
      <div class="sec-hdr">Fellow Characters</div>
      <div class="fellows-body">
        ${Array(10).fill('<div class="fellow-item"></div>').join('')}
      </div>
    </div>
  </div>

</div><!-- /page 2 -->

</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups for this site to use the Original Character Sheet export.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  // Close settings dropdown after export
  const dropdown = document.getElementById('sheet-settings-dropdown');
  if (dropdown) dropdown.classList.remove('open');
}

function printCharacter() {
  const characterName = (state.identity && state.identity.name) ? state.identity.name.trim() : '';
  const originalTitle = document.title;
  if (characterName) {
    document.title = characterName;
  }
  try {
    window.print();
  } finally {
    document.title = originalTitle;
  }
}

function triggerImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const data = JSON.parse(ev.target.result);
        importFromJson(data);
      } catch (_err) {
        console.error('Failed to parse character JSON:', _err);
        alert('Invalid file. Please select a valid character JSON export.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Converts a motivations value from any format to the canonical array format.
// Handles: array of {text,crossed}, plain string (legacy), undefined/null.
function importMotivations(raw) {
  if (Array.isArray(raw)) {
    // Ensure all 5 slots exist and each has the correct shape
    const arr = makeDefaultMotivations();
    raw.forEach((item, i) => {
      if (i < 5) {
        arr[i] = {
          text:    (item && typeof item.text    === 'string') ? item.text    : '',
          crossed: (item && typeof item.crossed === 'boolean') ? item.crossed : false,
        };
      }
    });
    return arr;
  }
  if (typeof raw === 'string' && raw.trim()) {
    // Legacy: one string per line → fill first slots
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const arr = makeDefaultMotivations();
    lines.forEach((line, i) => { if (i < 5) arr[i] = { text: line, crossed: false }; });
    return arr;
  }
  return makeDefaultMotivations();
}

function importWeapons(raw) {
  const fields = ['weapon', 'skill', 'baseRange', 'damage', 'ap', 'lethality', 'killRadius', 'ammo'];
  const validConditions = ['', 'pristine', 'worn', 'junk'];
  let rows = Array.isArray(raw)
    ? raw.map(item => {
        const row = {};
        fields.forEach(f => { row[f] = (item && typeof item[f] === 'string') ? item[f] : ''; });
        row.condition = (item && validConditions.includes(item.condition)) ? item.condition : '';
        return row;
      })
    : [{}];
  // Enforce trailing blank row invariant
  if (rows.length === 0) rows = [{}];
  const last = rows[rows.length - 1];
  const isBlank = fields.every(f => !last[f]) && !last.condition;
  if (!isBlank) rows.push({});
  return rows;
}


function importFromJson(data) {
  if (!data || typeof data !== 'object') {
    alert('Invalid character data.');
    return;
  }

  const VALID_ERAS = ['jazz', 'modern', 'coldwar', 'victorian', 'ww1', 'ww2', 'future', 'medieval', 'classical', 'revolutions', 'sails', 'elizabethan', 'alazrad'];
  if (!data.age || !VALID_ERAS.includes(data.age)) {
    alert('Invalid character data: missing or unknown era (age).');
    return;
  }

  if ((data.version || 1) >= 2) {
    importFromJsonV2(data);
  } else {
    importFromJsonV1(data);
  }
}

// Imports a v2 (outcome-only) character export.
// Reconstructs the minimal synthetic internal state so all rendering functions
// return the correct final values without replaying the creation process.
function importFromJsonV2(data) {
  // ── Identity & character meta ────────────────────────────
  state.age = data.age;
  state.upbringing = data.upbringing || null;
  // harshStatChoice is not stored in v2; attribute values already include the bonus.
  // Setting it to null makes getUpbringingBonus() return 0, so synthetic roll totals
  // can equal the exported attribute values directly.
  state.harshStatChoice = null;
  state.archetype = data.archetype || null;
  // selectedOptional is not stored in v2; the archetype bonus for optional skills is
  // already baked into the exported final values via skillEditAdjust reconstruction below.
  state.selectedOptional = [];

  state.identity = {
    name:              data.identity.name || '',
    profession:        data.identity.profession || '',
    birthplace:        data.identity.birthplace || data.identity.nationality || '',
    gender:            data.identity.gender || '',
    characterAge:      data.identity.characterAge || 25,
    backstory:         data.identity.backstory || '',
    motivations:       importMotivations(data.identity.motivations),
    gear:              data.identity.gear || '',
    terribleTomes:     data.identity.terribleTomes || '',
    permanentInjuries: data.identity.permanentInjuries || '',
    notes:             data.identity.notes || '',
    weapons:           importWeapons(data.identity.weapons),
  };
  // Each roll set has a total equal to the exported final attribute value.
  // Since harshStatChoice = null, getUpbringingBonus() = 0 for all attrs,
  // so getAttrValue(a) = rolledSet.total = exported value.
  const attrs = data.attributes || {};
  state.rolledSets = ATTRIBUTES.map((a, i) => ({
    id: i,
    values: [attrs[a] || 1, 1, 1, 1],
    total: attrs[a] || 1,
  }));
  ATTRIBUTES.forEach((a, i) => { state.attrAssign[a] = i; });

  // ── Skills ───────────────────────────────────────────────
  // Zero out all pick-based contributions; store the delta between the exported
  // final value and the archetype-only base in skillEditAdjust so that
  // getDisplayedSkillValue() returns the correct value.
  state.skillPoints = {};
  state.adversityPoints = {};
  state.skillTypes = data.skillTypes || {};

  // Compute adjustments: getFinalSkillValue uses state.archetype (now set) with
  // empty skillPoints/adversityPoints, so it returns base + archetypeBonus.
  const baseSkills = data.age === 'jazz' ? JAZZ_SKILLS : data.age === 'coldwar' ? COLD_WAR_SKILLS : data.age === 'victorian' ? VICTORIAN_SKILLS : data.age === 'ww1' ? WWI_SKILLS : data.age === 'ww2' ? WWII_SKILLS : data.age === 'future' ? FUTURE_SKILLS : data.age === 'medieval' ? MEDIEVAL_SKILLS : data.age === 'classical' ? CLASSICAL_SKILLS : data.age === 'sails' ? AGE_OF_SAILS_SKILLS : data.age === 'revolutions' ? REVOLUTIONS_SKILLS : data.age === 'elizabethan' ? ELIZABETHAN_SKILLS : data.age === 'alazrad' ? AL_AZRAD_SKILLS : MODERN_SKILLS;
  state.skillEditAdjust = {};
  Object.keys(baseSkills).forEach(s => {
    const skillData = data.skills || {};
    const exported = s in skillData ? skillData[s] : getFinalSkillValue(s);
    const computed = getFinalSkillValue(s);
    const adj = exported - computed;
    if (adj !== 0) state.skillEditAdjust[s] = adj;
  });

  // ── Custom skills ────────────────────────────────────────
  state.customSkills = (data.customSkills || []).map((cs, i) => ({
    id: i,
    // Cap at 80: getFinalCustomSkillValue = min(80, baseValue + points * 20).
    // With points = 0, setting baseValue = min(80, value) ensures the correct
    // display value without any edit adjustment needed.
    baseValue: Math.min(80, cs.value || 0),
    customName: cs.name || '',
    points: 0,
  }));
  _customSkillIdCounter = state.customSkills.length > 0 ? state.customSkills.length : 0;

  // ── Resources ────────────────────────────────────────────
  state.resourcesBonusSpent = 0;
  state.resourcesSetToZero  = false;
  // getEffectiveResources() = arch.resources (archetype now set, bonusSpent = 0).
  // Store remaining delta in resourcesEditAdjust so getDisplayedResources() is correct.
  const effectiveRes = getEffectiveResources();
  state.resourcesEditAdjust = (data.resources || 0) - effectiveRes;

  // ── Bonds ────────────────────────────────────────────────
  state.bonds = (data.bonds || []).map(b => ({
    name: b.name || '',
    type: b.type || 'individual',
    bonusSpent: 0,
    currentScore: (b.currentScore !== undefined && b.currentScore !== null) ? b.currentScore : null,
    setToOne: false,
  }));

  // ── Play state & tracking ────────────────────────────────
  state.resourceChecked = data.resourceChecked || [];
  state.skillChecked = data.skillChecked || {};
  state.violenceChecked = data.violenceChecked || [false, false, false];
  state.helplessnessChecked = data.helplessnessChecked || [false, false, false];
  // currentHP/WP/SAN are stored as final numbers in v2; null falls back to derived max.
  state.currentHP  = (data.currentHP  !== undefined && data.currentHP  !== null) ? data.currentHP  : null;
  state.currentWP  = (data.currentWP  !== undefined && data.currentWP  !== null) ? data.currentWP  : null;
  state.currentSAN = (data.currentSAN !== undefined && data.currentSAN !== null) ? data.currentSAN : null;
  // breakingPoint is the final value; reconstruct bpAdjust as delta from the base BP so
  // the in-play BP display remains correct even after a re-import.
  if (data.breakingPoint !== undefined && data.breakingPoint !== null) {
    const d = calculateDerived();
    state.bpAdjust = d ? data.breakingPoint - d.BP : 0;
  } else {
    state.bpAdjust = data.bpAdjust || 0; // graceful fallback for partial v2 files
  }
  state.disorders = (data.disorders || []).map((d, i) => ({ id: i, text: d.text || '' }));
  _disorderIdCounter = state.disorders.length;
  state.showAllSkills = data.showAllSkills || false;
  state.bodyArmour = data.bodyArmour || 0;
  state.exhausted = data.exhausted || false;
  state.temporaryInsanity = data.temporaryInsanity || false;
  // attrEditAdjust is zeroed on import: attribute values are already baked into roll sets.
  state.attrEditAdjust = { STR: 0, CON: 0, DEX: 0, INT: 0, POW: 0, CHA: 0 };

  state.editMode = false;
  state.playMode = false;
  state.currentStep = 6;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Imports a v1 (process-based) character export for backward compatibility.
function importFromJsonV1(data) {
  state.age = data.age;
  state.rolledSets = data.rolledSets || [];
  ATTRIBUTES.forEach(a => {
    state.attrAssign[a] = (data.attrAssign && data.attrAssign[a] !== undefined) ? data.attrAssign[a] : null;
  });
  state.upbringing = data.upbringing || null;
  state.harshStatChoice = data.harshStatChoice || null;
  state.adversityPoints = data.adversityPoints || {};
  state.archetype = data.archetype || null;
  state.selectedOptional = data.selectedOptional || [];
  state.skillPoints = data.skillPoints || {};
  state.skillTypes = data.skillTypes || {};
  state.customSkills = data.customSkills || [];
  state.bonds = (data.bonds || []).map(b => ({
    name: b.name || '',
    type: b.type || null,
    bonusSpent: b.bonusSpent || 0,
    currentScore: b.currentScore !== undefined ? b.currentScore : null,
    setToOne: b.setToOne || false,
  }));
  state.resources = data.resources || 0;
  state.resourcesBonusSpent = data.resourcesBonusSpent || 0;
  state.resourcesSetToZero  = data.resourcesSetToZero  || false;
  state.resourceChecked = data.resourceChecked || [];
  state.skillChecked = data.skillChecked || {};
  state.violenceChecked = data.violenceChecked || [false, false, false];
  state.helplessnessChecked = data.helplessnessChecked || [false, false, false];
  state.currentHP  = (data.currentHP  !== undefined && data.currentHP  !== null) ? data.currentHP  : null;
  state.currentWP  = (data.currentWP  !== undefined && data.currentWP  !== null) ? data.currentWP  : null;
  state.currentSAN = (data.currentSAN !== undefined && data.currentSAN !== null) ? data.currentSAN : null;
  state.bpAdjust = data.bpAdjust || 0;
  state.disorders = data.disorders || [];
  state.showAllSkills = data.showAllSkills || false;
  state.bodyArmour = data.bodyArmour || 0;
  state.exhausted = data.exhausted || false;
  state.temporaryInsanity = data.temporaryInsanity || false;
  state.skillEditAdjust = data.skillEditAdjust || {};
  state.resourcesEditAdjust = data.resourcesEditAdjust || 0;
  state.attrEditAdjust = { STR: 0, CON: 0, DEX: 0, INT: 0, POW: 0, CHA: 0 };
  state.editMode = false;
  state.playMode = false;
  state.identity = {
    name:              data.identity.name || '',
    profession:        data.identity.profession || '',
    birthplace:        data.identity.birthplace || data.identity.nationality || '',
    gender:            data.identity.gender || '',
    characterAge:      data.identity.characterAge || 25,
    backstory:         data.identity.backstory || '',
    motivations:       importMotivations(data.identity.motivations),
    gear:              data.identity.gear || '',
    terribleTomes:     data.identity.terribleTomes || '',
    permanentInjuries: data.identity.permanentInjuries || '',
    notes:             data.identity.notes || '',
    weapons:           importWeapons(data.identity.weapons),
  };

  _customSkillIdCounter = state.customSkills.length > 0
    ? Math.max(...state.customSkills.map(cs => cs.id)) + 1
    : 0;
  _disorderIdCounter = state.disorders.length > 0
    ? Math.max(...state.disorders.map(d => d.id)) + 1
    : 0;

  state.currentStep = 6;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSheetSettings(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('sheet-settings-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', dropdown.classList.contains('open'));
  }
}

function confirmReset() {
  if (confirm('Start over? All character data will be lost.')) {
    resetState();
    render();
  }
}

function enterPlayMode() {
  state.playMode = true;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitPlayMode() {
  state.playMode = false;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetState() {
  state.currentStep = 1;
  state.playMode    = false;
  state.age         = null;
  state.attrMode    = 'rolling';
  ATTRIBUTES.forEach(a => { state.pointsAttr[a] = 12; });
  state.rolledSets  = [];
  ATTRIBUTES.forEach(a => { state.attrAssign[a] = null; });
  state.upbringing       = null;
  state.harshStatChoice  = null;
  state.adversityPoints  = {};
  state.archetype        = null;
  state.selectedOptional = [];
  state.skillPoints      = {};
  state.skillTypes       = {};
  state.customSkills     = [];
  state.bonds            = [];
  state.resources        = 0;
  state.resourcesBonusSpent = 0;
  state.resourcesSetToZero  = false;
  state.resourcesEditAdjust = 0;
  state.resourceChecked       = [];
  state.skillChecked          = {};
  state.violenceChecked       = [false, false, false];
  state.helplessnessChecked   = [false, false, false];
  state.skillEditAdjust       = {};
  state.attrEditAdjust        = { STR: 0, CON: 0, DEX: 0, INT: 0, POW: 0, CHA: 0 };
  state.identity         = { name: '', profession: '', birthplace: '', gender: '', characterAge: 25, backstory: '', motivations: makeDefaultMotivations(), gear: '', terribleTomes: '', permanentInjuries: '', notes: '', weapons: [{}] };
  state.currentHP        = null;
  state.currentWP        = null;
  state.currentSAN       = null;
  state.bpAdjust         = 0;
  state.disorders        = [];
  state.editMode         = false;
  state.showAllSkills    = false;
  state.exhausted        = false;
  state.temporaryInsanity = false;
  // Upbringing effects step
  state.harshD4Rolls         = null;
  state.harshBondChoice1     = null;
  state.harshBondChoice2     = null;
  state.vhPowTestRoll        = null;
  state.vhPowDisorderId      = null;
  state.vhAdaptedTo          = null;
  state.vhAdaptRoll          = null;
  state.upbringingChaReduction = 0;
  state.upbringingPowReduction = 0;
}

// ── RENDER: Play Mode ────────────────────────────────────────

function renderPlayMode() {
  const charSheetHtml = buildCharSheetHtml();
  return `
  ${state.notification ? renderNotification() : ''}
  <div class="play-mode-view">
    <div class="play-mode-bar no-print">
      <span class="play-mode-heading">Cthulhu Forever</span>
      <button class="btn btn-outline" onclick="exitPlayMode()">
        ← Back to Builder
      </button>
    </div>
    <div class="play-mode-sheet">
      ${charSheetHtml}
    </div>
  </div>`;
}

// ── RENDER: Nav Buttons ─────────────────────────────────────

function renderNavButtons() {
  const isFirst = state.currentStep === 1;
  const isLast  = state.currentStep === 6;
  const proceed = canProceed(state.currentStep);
  const stepLabel = state.currentStep === 4.5
    ? 'Upbringing Effects'
    : `Step ${state.currentStep} of 6`;

  return `
  <div class="nav-row no-print">
    <button class="btn btn-outline" onclick="prevStep()" ${isFirst ? 'disabled' : ''}>
      ← Previous
    </button>
    <span style="font-size:0.78rem;color:var(--text-secondary);">
      ${stepLabel}
    </span>
    ${isLast
      ? `<button class="btn btn-gold" onclick="confirmReset()">✦ Start Over</button>`
      : isFirst
        ? `<span></span>`
        : `<button class="btn btn-gold" id="next-btn" onclick="nextStep()" ${proceed ? '' : 'disabled'}>
            Continue →
          </button>`
    }
  </div>`;
}

// ── RENDER: Main ────────────────────────────────────────────

function renderCurrentStep() {
  switch (state.currentStep) {
    case 1:   return renderStep1();
    case 2:   return renderStep2();
    case 3:   return renderStep3();
    case 4:   return renderStep4();
    case 4.5: return renderUpbringingEffects();
    case 5:   return renderStep5();
    case 6:   return renderStep6();
    default:  return '<p>Unknown step.</p>';
  }
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;

  if (state.playMode) {
    app.innerHTML = renderPlayMode();
    return;
  }

  app.innerHTML = `
    ${state.notification ? renderNotification() : ''}
    <div class="app-header no-print">
      <h1>Cthulhu Forever</h1>
      <div class="subtitle">Cthulhu Eternal Character Creator</div>
    </div>
    ${renderStepper()}
    <div id="main-content">
      ${renderCurrentStep()}
      ${renderNavButtons()}
    </div>
    <footer class="app-footer no-print">
      <div class="app-footer__credits">
        <span><strong>Cthulhu Eternal</strong> is a horror TTRPG published by
          <a href="https://cthulhueternal.com/" target="_blank" rel="noopener noreferrer">Cthulhu Reborn</a>
           - <a href="https://github.com/jonassode/cthulhu-forever/blob/main/Credits.md" target="_blank" rel="noopener noreferrer">Clear Credits</a>
        </span>
      </div>
      <div class="app-footer__issues">
        <span><strong>Cthulhu Forever</strong> is a fan project. Found a bug or have a suggestion?
          <a href="https://github.com/jonassode/cthulhu-forever/issues" target="_blank" rel="noopener noreferrer">Raise a ticket on GitHub</a>
           or <a href="https://jonassoderstrom.itch.io/cthulhu-forever" target="_blank" rel="noopener noreferrer">Check out the project on Itch</a>
        </span>
      </div>
    </footer>`;

  // Attach drag listeners after DOM is updated
  attachDragListeners();
}

// ── Helpers ────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Tooltip ─────────────────────────────────────────────────
// Handles all [data-tooltip] elements with a JS-positioned `position:fixed`
// element so tooltips are never clipped by CSS overflow containers or section
// headers (e.g. the character sheet's overflow:hidden border).

function initTooltip() {
  const tip = document.createElement('div');
  tip.className = 'skill-tooltip-popup';
  tip.style.display = 'none';
  document.body.appendChild(tip);

  let active = null;

  function show(target, cx, cy) {
    tip.textContent = target.dataset.tooltip;
    tip.style.display = 'block';
    place(cx, cy);
  }

  function hide() {
    active = null;
    tip.style.display = 'none';
  }

  function place(cx, cy) {
    // Reset position so offsetWidth/Height are measured correctly
    tip.style.left = '0';
    tip.style.top  = '0';

    const GAP = 14; // px gap between cursor and tooltip edge
    const tw  = tip.offsetWidth;
    const th  = tip.offsetHeight;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;

    // Prefer: appear to the right of cursor, above it
    let x = cx + GAP;
    let y = cy - th - GAP;

    // Flip left if it would overflow right edge
    if (x + tw > vw - GAP) x = cx - tw - GAP;
    // Clamp to left edge
    if (x < GAP) x = GAP;

    // Flip below cursor if it would overflow top
    if (y < GAP) y = cy + GAP;
    // Clamp to bottom edge
    if (y + th > vh - GAP) y = vh - th - GAP;

    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  document.addEventListener('mouseover', function (e) {
    const target = e.target.closest('[data-tooltip]');
    if (target === active) return;
    if (!target) {
      active = null;
      tip.style.display = 'none';
      return;
    }
    active = target;
    show(target, e.clientX, e.clientY);
  });

  document.addEventListener('mousemove', function (e) {
    if (!active) return;
    place(e.clientX, e.clientY);
  });

  document.addEventListener('mouseout', function (e) {
    if (!active) return;
    // Only hide when leaving the active target entirely
    if (!e.relatedTarget || !active.contains(e.relatedTarget)) {
      hide();
    }
  });
}

// ── Init ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  render();
  initTooltip();
  document.addEventListener('click', (e) => {
    const settings = document.getElementById('sheet-settings');
    if (settings && !settings.contains(e.target)) {
      const dropdown = document.getElementById('sheet-settings-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    }
  });
});

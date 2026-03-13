/* ============================================================
   CTHULHU ETERNAL — APPLICATION LOGIC
   ============================================================ */

// ── State ──────────────────────────────────────────────────

const state = {
  currentStep: 1,
  age: null,          // 'jazz' | 'modern'

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
  bonds: [],                     // array of {name, type ('individual'|'community'), bonusSpent}
  resources: 0,                  // final resources rating
  resourcesBonusSpent: 0,        // bonus pts spent on +resource

  identity: {
    name: '',
    profession: '',
    characterAge: 25,
    backstory: '',
  },
};

// Drag state (module-level, not persisted)
let _dragRollId  = null;  // roll id being dragged
let _dragFromAttr = null; // attr key if dragging from a slot

// ── Utility ────────────────────────────────────────────────

function rollD6() { return Math.floor(Math.random() * 6) + 1; }

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

// Ensure state.bonds array has the correct length
function ensureBondsCount() {
  const count = getEffectiveBondsCount();
  while (state.bonds.length < count) state.bonds.push({ name: '', type: null, bonusSpent: 0 });
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

function getAttrValue(attrKey) {
  const id = state.attrAssign[attrKey];
  if (id === null || id === undefined) return null;
  const rs = state.rolledSets.find(r => r.id === id);
  if (!rs) return null;
  return rs.total + getUpbringingBonus(attrKey);
}

function getAttrValues() {
  const out = {};
  ATTRIBUTES.forEach(a => { out[a] = getAttrValue(a); });
  return out;
}

function allAttributesAssigned() {
  return ATTRIBUTES.every(a => state.attrAssign[a] !== null && state.attrAssign[a] !== undefined);
}

function assignedRollIds() {
  return new Set(Object.values(state.attrAssign).filter(v => v !== null && v !== undefined));
}

function calculateDerived() {
  const v = getAttrValues();
  if (!v.STR || !v.CON || !v.POW) return null;
  const SAN = (state.upbringing === 'harsh' || state.upbringing === 'very_harsh')
    ? v.POW * 4
    : v.POW * 5;
  let DMG;
  if      (v.STR <= 4)  DMG = -2;
  else if (v.STR <= 8)  DMG = -1;
  else if (v.STR <= 12) DMG =  0;
  else if (v.STR <= 16) DMG = +1;
  else                  DMG = +2;
  return {
    HP:  Math.ceil((v.STR + v.CON) / 2),
    WP:  v.POW,
    SAN: SAN,
    BP:  SAN - v.POW,
    DMG: DMG,
  };
}

function getCurrentSkills() {
  return state.age === 'jazz' ? JAZZ_SKILLS : MODERN_SKILLS;
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

function initSkills() {
  const skills = getCurrentSkills();
  const fresh = {};
  Object.keys(skills).forEach(s => { fresh[s] = 0; });
  state.skillPoints = fresh;
  state.resourcesBonusSpent = 0;
  state.adversityPoints = {};
  ADVERSITY_SKILLS.forEach(s => { state.adversityPoints[s] = 0; });
  // Reset community bond bonus picks
  state.bonds.forEach(b => { if (b && typeof b === 'object') b.bonusSpent = 0; });
}

function getBonusPointsTotal() {
  // Fixed at 10 per SKILL.md: "Every Protagonist starts with 10 Bonus Picks"
  return 10;
}

function getBonusPointsSpent() {
  const skillPicks = Object.values(state.skillPoints).reduce((s, v) => s + v, 0);
  const bondPicks  = state.bonds.reduce((s, b) => s + (b && b.bonusSpent ? b.bonusSpent : 0), 0);
  return skillPicks + state.resourcesBonusSpent + bondPicks;
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
  const base = arch.resources;
  // Per SKILL.md: first Bonus Pick on Resources adds +5; each subsequent pick adds +2
  let bonus = 0;
  if (state.resourcesBonusSpent > 0) {
    bonus = 5 + (state.resourcesBonusSpent - 1) * 2;
  }
  return Math.min(20, base + bonus);
}

// Returns the Resources capacity for a given rating per SKILL.md table.
function getResourcesCapacity(rating) {
  if (rating <= 0)  return { atHand: 0, stowed: 0, inStorage: 0, checkboxes: 0 };
  if (rating <= 6)  return { atHand: rating, stowed: 0, inStorage: 0, checkboxes: 1 };
  if (rating <= 12) return { atHand: 6, stowed: rating - 6, inStorage: 0, checkboxes: 2 };
  return { atHand: 6, stowed: 6, inStorage: rating - 12, checkboxes: 3 };
}

// Returns the effective numeric value of a bond object.
// Individual bonds are tied to CHA; Community bonds are Resources÷2 plus bonus from picks.
function getBondEffectiveValue(bond) {
  if (!bond || !bond.type) return null;
  if (bond.type === 'individual') {
    return getAttrValue('CHA');
  }
  // Community bond: base is Resources÷2, bonus per SKILL.md
  const base = Math.floor(getEffectiveResources() / 2);
  const n = bond.bonusSpent || 0;
  const bonus = n > 0 ? 5 + (n - 1) * 2 : 0;
  return base + bonus;
}

// ── Adversity Picks ─────────────────────────────────────────

const ADVERSITY_SKILLS = ['First Aid', 'Military Training (Type)', 'Regional Lore (Type)', 'Survival (Type)'];

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
    case 5: return state.identity.name.trim() !== '';
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
    goToStep(state.currentStep + 1);
  }
}

function prevStep() {
  if (state.currentStep > 1) {
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

function renderStep1() {
  return `
  <div class="step-content">
    <h2 class="step-title">Choose Your Era</h2>
    <p class="step-subtitle">The age in which your story unfolds shapes every skill, contact, and shadow that will haunt you.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;" class="sm:grid-cols-1">

      <div class="sel-card ${state.age === 'jazz' ? 'selected' : ''}"
           onclick="selectAge('jazz')" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')selectAge('jazz')">
        <div class="card-check">${checkIcon()}</div>
        <div class="card-tag">Jazz Age</div>
        <div class="card-title">The Roaring Twenties</div>
        <div class="card-desc">
          Prohibition and Jazz, the aftermath of the Great War, and the first whispers of worse things to come. 
          Investigators work with telegrams, motorcar chases, and revolvers as they peel back the gilded surface 
          of the 1920s to expose the ancient horrors lurking beneath.
        </div>
        <ul class="card-detail-list mt-3">
          <li>Setting: 1920–1939</li>
          <li>Technology: Motor cars, telegraphs, early radio</li>
          <li>Tone: Gothic mystery, colonial horror</li>
          <li>Archetypes: 11 classic occupations available</li>
        </ul>
      </div>

      <div class="sel-card ${state.age === 'modern' ? 'selected' : ''}"
           onclick="selectAge('modern')" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')selectAge('modern')">
        <div class="card-check">${checkIcon()}</div>
        <div class="card-tag">Modern Age</div>
        <div class="card-title">Present Day</div>
        <div class="card-desc">
          The twenty-first century offers every comfort of civilization—and new vectors for the ancient evil 
          that has always watched from the dark. Investigators use smartphones, forensic labs, and the internet 
          to chase shadows that predate recorded history.
        </div>
        <ul class="card-detail-list mt-3">
          <li>Setting: Present Day</li>
          <li>Technology: Computers, the internet, forensics</li>
          <li>Tone: Conspiracy, urban dread, digital horror</li>
          <li>Archetypes: 11 contemporary occupations available</li>
        </ul>
      </div>
    </div>

    ${state.age ? `<div class="notice mt-4">
      <strong>${state.age === 'jazz' ? 'Jazz Age' : 'Modern Age'}</strong> selected.
      You may proceed to the next step.
    </div>` : ''}
  </div>`;
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
  render();
}

// ── RENDER: Step 2 — Attributes ─────────────────────────────

function renderStep2() {
  const poolRollIds = assignedRollIds();
  const unassigned  = state.rolledSets.filter(r => !poolRollIds.has(r.id));
  const hasRolled   = state.rolledSets.length > 0;
  const allAssigned = allAttributesAssigned();
  const derived     = allAssigned ? calculateDerived() : null;

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

  const sanFormula = (state.upbringing === 'harsh' || state.upbringing === 'very_harsh') ? 'POW × 4' : 'POW × 5';
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
      <div class="derived-stat" data-tooltip="${sanFormula} (Normal = ×5, Harsh/Very Harsh = ×4)">
        <div class="ds-label">Sanity</div>
        <div class="ds-value">${derived.SAN}</div>
      </div>
      <div class="derived-stat" data-tooltip="SAN − POW (Breaking Point)">
        <div class="ds-label">Break. Point</div>
        <div class="ds-value">${derived.BP}</div>
      </div>
      <div class="derived-stat" data-tooltip="STR 1–4: −2 | 5–8: −1 | 9–12: 0 | 13–16: +1 | 17+: +2">
        <div class="ds-label">Dmg Bonus</div>
        <div class="ds-value">${derived.DMG > 0 ? '+' + derived.DMG : derived.DMG}</div>
      </div>
    </div>` : '';

  return `
  <div class="step-content">
    <h2 class="step-title">Roll Your Attributes</h2>
    <p class="step-subtitle">Roll 4d6 six times, keeping the highest three dice each time. Assign each result to an attribute by dragging or using the dropdowns below.</p>

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
      Adversity skill picks can only improve: <strong>First Aid, Military Training (Type), Regional Lore (Type), Survival (Type)</strong>.
    </p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;" class="sm:grid-cols-1">
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
          <div>${selected.archetypeSkills.map(s => `<span class="skill-pill">${s.name} <strong>${s.value}%</strong></span>`).join('')}</div>
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
                ${s.name} <strong>${s.value}%</strong>
              </label>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:2rem;flex-wrap:wrap;font-size:0.8rem;color:var(--text-secondary);">
        <span>Bonds: <strong style="color:var(--text-primary);">${selected.bonds}</strong></span>
        <span>Starting Resources: <strong style="color:var(--text-primary);">${selected.resources}</strong> / 20</span>
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

    return `<tr>
      <td class="skill-name ${isBonus ? 'bonus-skill' : ''}" style="width:45%">
        ${skillName}${isBonus ? ` <span style="font-size:0.65rem;color:var(--accent-greenl);">+${archBon}%</span>` : ''}
        ${isUnnat ? ` <span style="font-size:0.62rem;color:var(--text-secondary);font-style:italic;">(cannot boost)</span>` : ''}
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

  // Adversity picks section (only for harsh / very harsh upbringing)
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
          ${ADVERSITY_SKILLS.map(skillName => {
            const base     = skills[skillName] || 0;
            const archBon  = getArchetypeSkillBonus(skillName);
            const advPicks = state.adversityPoints[skillName] || 0;
            const bpPicks  = state.skillPoints[skillName] || 0;
            const final    = getFinalSkillValue(skillName);
            const canAdd = advLeft > 0 && (base + archBon + (bpPicks + advPicks + 1) * 20) <= 80;
            const canSub = advPicks > 0;
            return `<tr>
              <td class="skill-name" style="width:45%">${skillName}</td>
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
        const nextPickGain = (b.bonusSpent || 0) === 0 ? 5 : 2;
        const canAdd = isCommunity && getBonusPointsRemaining() > 0;
        const canSub = isCommunity && (b.bonusSpent || 0) > 0;
        return `<div class="bond-row">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <span style="font-size:0.72rem;color:var(--text-secondary);font-family:var(--font-head);text-transform:uppercase;letter-spacing:0.06em;min-width:3.5rem;">Bond ${i + 1}</span>
            <button class="bond-type-btn${isIndividual ? ' active-personal' : ''}" onclick="updateBondType(${i},'individual')">Personal</button>
            <button class="bond-type-btn${isCommunity ? ' active-community' : ''}" onclick="updateBondType(${i},'community')">Community</button>
            ${b.type ? `
              <input class="bond-input" type="text" placeholder="${isIndividual ? 'Name a person…' : 'Name an organization, church, or neighborhood…'}"
                     value="${escapeHtml(b.name)}"
                     oninput="updateBond(${i},this.value)" style="flex:1;min-width:10rem;" />
              <span style="font-size:1rem;font-family:var(--font-head);color:var(--accent-gold);min-width:2rem;text-align:right;">${val !== null ? val : '—'}</span>
              ${isCommunity ? `
                <button class="skill-adj-btn" onclick="adjustBond(${i},-1)" ${canSub ? '' : 'disabled'}>−</button>
                <span style="font-size:0.72rem;color:var(--text-secondary);">+${nextPickGain}</span>
                <button class="skill-adj-btn plus" onclick="adjustBond(${i},1)" ${canAdd ? '' : 'disabled'}>+</button>
              ` : ''}
            ` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // Resources: show 0-20 value; display what the next pick adds
  const nextPickGain = state.resourcesBonusSpent === 0 ? 5 : 2;
  const resourcesHtml = `
    <div class="section-header" style="margin-top:2rem;"><h3>Resources (0–20 scale)</h3></div>
    <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
      <span style="font-size:1.5rem;font-family:var(--font-head);color:var(--accent-gold);min-width:2.5rem;text-align:center;">${effectiveResources}</span>
      <span style="font-size:0.82rem;color:var(--text-secondary);">
        / 20 &nbsp;|&nbsp; base: ${arch ? arch.resources : 0}
        ${state.resourcesBonusSpent > 0 ? ` + ${state.resourcesBonusSpent === 1 ? 5 : 5 + (state.resourcesBonusSpent - 1) * 2} from picks` : ''}
      </span>
      <button class="skill-adj-btn" onclick="adjustResources(-1)"
              ${state.resourcesBonusSpent > 0 ? '' : 'disabled'}>−</button>
      <span style="font-size:0.78rem;color:var(--text-secondary);">1 pick → +${nextPickGain}</span>
      <button class="skill-adj-btn plus" onclick="adjustResources(1)"
              ${bpLeft >= 1 && effectiveResources < 20 ? '' : 'disabled'}>+</button>
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
        <tbody>${skillRows}</tbody>
      </table>
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
    if (getEffectiveResources() >= 20) return;
    state.resourcesBonusSpent++;
  } else {
    if (state.resourcesBonusSpent <= 0) return;
    state.resourcesBonusSpent--;
  }
  render();
}

function adjustAdversity(skillName, delta) {
  if (!ADVERSITY_SKILLS.includes(skillName)) return;
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

function updateBond(index, value) {
  state.bonds[index].name = value;
  // Don't re-render (would lose focus), just update canProceed state silently
  // Update the next button disabled state
  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) nextBtn.disabled = !canProceed(4);
}

function updateBondType(index, type) {
  const bond = state.bonds[index];
  if (!bond || typeof bond !== 'object') return;
  // If switching away from community, refund bonus picks
  if (bond.type === 'community' && type !== 'community') {
    bond.bonusSpent = 0;
  }
  bond.type = type;
  render();
}

function adjustBond(index, delta) {
  const bond = state.bonds[index];
  if (!bond || bond.type !== 'community') return;
  if (delta > 0) {
    if (getBonusPointsRemaining() < 1) return;
    bond.bonusSpent = (bond.bonusSpent || 0) + 1;
  } else {
    if ((bond.bonusSpent || 0) <= 0) return;
    bond.bonusSpent--;
  }
  render();
}

// ── RENDER: Step 5 — Identity & Export ──────────────────────

function renderStep5() {
  const arch    = getArchetype();
  const derived = calculateDerived();
  const skills  = getCurrentSkills();

  const canShow = state.identity.name.trim() !== '';

  const skillsForSheet = Object.keys(skills)
    .sort((a, b) => a.localeCompare(b))
    .map(s => {
      const base    = skills[s];
      const archBon = getArchetypeSkillBonus(s);
      const final   = getFinalSkillValue(s);
      return { name: s, base, archBon, final, boosted: archBon > 0 };
    })
    .filter(s => s.final > 0 || s.name === 'Unnatural');

  const charSheetHtml = canShow ? `
  <div class="character-sheet" id="character-sheet">
    <div class="sheet-header">
      <div>
        <div class="sheet-name">${escapeHtml(state.identity.name)}</div>
        ${state.identity.profession ? `<div style="font-size:0.9rem;color:var(--text-secondary);margin-top:3px;">${escapeHtml(state.identity.profession)}</div>` : ''}
      </div>
      <div class="sheet-meta">
        <span><strong>${arch ? arch.name : '—'}</strong> Archetype</span>
        <span>Age <strong>${state.identity.characterAge}</strong></span>
        <span><strong>${state.age === 'jazz' ? 'Jazz Age' : 'Modern Age'}</strong></span>
        ${state.upbringing ? `<span>Upbringing: <strong>${state.upbringing === 'very_harsh' ? 'Very Harsh' : state.upbringing === 'harsh' ? 'Harsh' : 'Normal'}</strong></span>` : ''}
      </div>
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Attributes</div>
      <div class="attrs-row">
        ${ATTRIBUTES.map(a => {
          const v = getAttrValue(a);
          return `<div class="attr-box">
            <div class="ab-name">${a}</div>
            <div class="ab-val">${v}</div>
            <div class="ab-x5">${v * 5}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Derived Statistics</div>
      <div class="derived-row">
        <div class="derived-box" data-tooltip="⌈(STR + CON) ÷ 2⌉">
          <span class="db-name">HP</span><span class="db-val">${derived ? derived.HP : '—'}</span>
        </div>
        <div class="derived-box" data-tooltip="Equal to POW">
          <span class="db-name">WP</span><span class="db-val">${derived ? derived.WP : '—'}</span>
        </div>
        <div class="derived-box" data-tooltip="${(state.upbringing === 'harsh' || state.upbringing === 'very_harsh') ? 'POW × 4 (Harsh/Very Harsh upbringing)' : 'POW × 5 (Normal upbringing)'}">
          <span class="db-name">SAN</span><span class="db-val">${derived ? derived.SAN : '—'}</span>
        </div>
        <div class="derived-box" data-tooltip="Breaking Point = SAN − POW">
          <span class="db-name">BP</span><span class="db-val">${derived ? derived.BP : '—'}</span>
        </div>
        <div class="derived-box" data-tooltip="STR 1–4: −2 | 5–8: −1 | 9–12: 0 | 13–16: +1 | 17+: +2">
          <span class="db-name">Dmg Bonus</span><span class="db-val">${derived ? (derived.DMG > 0 ? '+' + derived.DMG : derived.DMG) : '—'}</span>
        </div>
      </div>
    </div>

      <div class="sheet-section">
      <div class="sheet-section-title">Resources</div>
      ${(() => {
        const resRating = getEffectiveResources();
        const cap = getResourcesCapacity(resRating);
        const checkboxHtml = Array(cap.checkboxes).fill(0).map(() =>
          '<span class="resource-checkbox">□</span>'
        ).join('');
        return `
        <div class="resource-row">
          <div class="resource-block">
            <span class="resource-label">Rating</span>
            <span class="resource-rating-val">${resRating}</span>
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
      <div class="skills-grid-sheet">
        ${skillsForSheet.map(s => `
          <div class="skill-row-sheet">
            <span class="sr-name ${s.boosted ? 'boosted' : ''}">${s.name}</span>
            <span class="sr-val">${s.final}%</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Bonds</div>
      <div class="bonds-sheet-list">
        ${state.bonds.filter(b => b.name && b.name.trim()).map(b => {
          const val = getBondEffectiveValue(b);
          const typeLabel = b.type === 'community' ? 'Community' : 'Personal';
          return `<div class="bond-sheet-row">
            <span class="bond-type-badge bond-type-${b.type}">${typeLabel}</span>
            <span class="bond-sheet-name">${escapeHtml(b.name)}</span>
            <span class="bond-sheet-val">${val !== null ? val : '—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    ${state.identity.backstory.trim() ? `
    <div class="sheet-section">
      <div class="sheet-section-title">Backstory</div>
      <div class="sheet-backstory">${escapeHtml(state.identity.backstory)}</div>
    </div>` : ''}
  </div>` : '';

  return `
  <div class="step-content">
    <h2 class="step-title">Forge Your Identity</h2>
    <p class="step-subtitle">Give your investigator a name and history. The cosmos is indifferent to your existence, but your allies are not.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;" class="sm:grid-cols-1">
      <div>
        <div class="form-group">
          <label class="form-label">Character Name <span style="color:var(--danger-light);">*</span></label>
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
      </div>
      <div>
        <div class="form-group">
          <label class="form-label">Age</label>
          <input class="form-input" type="number" id="char-age"
                 min="18" max="80" placeholder="18–80"
                 value="${state.identity.characterAge}"
                 oninput="updateIdentity('characterAge',parseInt(this.value)||25)" />
        </div>
        <div class="form-group">
          <label class="form-label">Backstory</label>
          <textarea class="form-textarea" id="char-backstory" rows="4"
                    placeholder="What drove you to investigate the unknown? What do you stand to lose?"
                    oninput="updateIdentity('backstory',this.value)">${escapeHtml(state.identity.backstory)}</textarea>
        </div>
      </div>
    </div>

    ${!canProceed(5) ? `<p class="validation-msg">A character name is required.</p>` : ''}

    <div class="ornament-divider">✦</div>

    ${canShow ? `
    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;">
      <button class="btn btn-gold" onclick="window.print()">
        <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24">
          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Print Character Sheet
      </button>
      <button class="btn btn-danger" onclick="confirmReset()">
        ↺ Start Over
      </button>
    </div>
    ${charSheetHtml}
    ` : `<div class="notice">Enter a character name above to reveal the complete character sheet.</div>`}
  </div>`;
}

function updateIdentity(field, value) {
  const prevName = state.identity.name;
  state.identity[field] = value;

  if (field === 'name') {
    const wasEmpty = prevName.trim() === '';
    const isEmpty  = value.trim() === '';

    if (wasEmpty !== isEmpty) {
      // Transitioning between empty/non-empty: need full re-render to show/hide sheet
      render();
      const el = document.getElementById('char-name');
      if (el) {
        const pos = value.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    } else {
      // Just update next button and the name display inside the sheet header
      const nextBtn = document.getElementById('next-btn');
      if (nextBtn) nextBtn.disabled = !canProceed(5);
      const nameEl = document.querySelector('.sheet-name');
      if (nameEl) nameEl.textContent = value;
    }
  } else {
    // Just update next button
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.disabled = !canProceed(5);
  }
}

function confirmReset() {
  if (confirm('Start over? All character data will be lost.')) {
    resetState();
    render();
  }
}

function resetState() {
  state.currentStep = 1;
  state.age         = null;
  state.rolledSets  = [];
  ATTRIBUTES.forEach(a => { state.attrAssign[a] = null; });
  state.upbringing       = null;
  state.harshStatChoice  = null;
  state.adversityPoints  = {};
  state.archetype        = null;
  state.selectedOptional = [];
  state.skillPoints      = {};
  state.bonds            = [];
  state.resources        = 0;
  state.resourcesBonusSpent = 0;
  state.identity         = { name: '', profession: '', characterAge: 25, backstory: '' };
}

// ── RENDER: Nav Buttons ─────────────────────────────────────

function renderNavButtons() {
  const isFirst = state.currentStep === 1;
  const isLast  = state.currentStep === 5;
  const proceed = canProceed(state.currentStep);

  return `
  <div class="nav-row no-print">
    <button class="btn btn-outline" onclick="prevStep()" ${isFirst ? 'disabled' : ''}>
      ← Previous
    </button>
    <span style="font-size:0.78rem;color:var(--text-secondary);">
      Step ${state.currentStep} of 5
    </span>
    ${isLast
      ? `<button class="btn btn-gold" onclick="confirmReset()">✦ Start Over</button>`
      : `<button class="btn btn-gold" id="next-btn" onclick="nextStep()" ${proceed ? '' : 'disabled'}>
          Continue →
        </button>`
    }
  </div>`;
}

// ── RENDER: Main ────────────────────────────────────────────

function renderCurrentStep() {
  switch (state.currentStep) {
    case 1: return renderStep1();
    case 2: return renderStep2();
    case 3: return renderStep3();
    case 4: return renderStep4();
    case 5: return renderStep5();
    default: return '<p>Unknown step.</p>';
  }
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="app-header no-print">
      <h1>Cthulhu Eternal</h1>
      <div class="subtitle">Character Generator</div>
    </div>
    ${renderStepper()}
    <div id="main-content">
      ${renderCurrentStep()}
      ${renderNavButtons()}
    </div>`;

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

// ── Init ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  render();
});

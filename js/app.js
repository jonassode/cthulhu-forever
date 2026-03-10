/* ============================================================
   CTHULHU ETERNAL — APPLICATION LOGIC
   ============================================================ */

// ── State ──────────────────────────────────────────────────

const state = {
  currentStep: 1,
  age: null,          // 'jazz' | 'modern'
  harshness: null,    // 'standard' | 'gritty'

  rolledSets: [],     // [{id:N, values:[d1,d2,d3,d4], total:N}]
  attrAssign: {       // attribute -> rolledSet.id (or null)
    STR: null, CON: null, DEX: null, SIZ: null,
    INT: null, POW: null, CHA: null,
  },

  archetype: null,               // archetype id
  selectedOptional: [],          // chosen optional skill names

  skillPoints: {},               // skillName -> bonus pts added (from bonus pool)
  bonds: [],                     // array of strings
  resources: 0,                  // final resources rating
  resourcesBonusSpent: 0,        // bonus pts spent on +resource

  harshEdges: [],                // array of purchased edge ids
  harshEdgeBondsExtra: 0,        // extra bonds from 'contacts' edge

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
  state.rolledSets = Array.from({ length: 7 }, (_, i) => {
    const values = rollDice4d6();
    return { id: i, values, total: keepHighest3(values) };
  });
  // Clear assignments
  ATTRIBUTES.forEach(a => { state.attrAssign[a] = null; });
}

function getAttrValue(attrKey) {
  const id = state.attrAssign[attrKey];
  if (id === null || id === undefined) return null;
  const rs = state.rolledSets.find(r => r.id === id);
  return rs ? rs.total : null;
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
  return {
    HP:  Math.floor((v.STR + v.CON) / 2),
    WP:  v.POW,
    SAN: v.POW * 5,
    BP:  v.POW * 5 - v.POW,
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
  const allBonusSkills = [...arch.bonusSkills, ...state.selectedOptional];
  return allBonusSkills.includes(skillName) ? arch.bonusAmount : 0;
}

function getFinalSkillValue(skillName) {
  const base = (getCurrentSkills()[skillName] || 0);
  const archBonus = getArchetypeSkillBonus(skillName);
  const bpAdded = state.skillPoints[skillName] || 0;
  return Math.min(99, base + archBonus + bpAdded);
}

function initSkills() {
  const skills = getCurrentSkills();
  const fresh = {};
  Object.keys(skills).forEach(s => { fresh[s] = 0; });
  state.skillPoints = fresh;
  state.resourcesBonusSpent = 0;
}

function getBonusPointsTotal() {
  return getAttrValue('INT') || 0;
}

function getBonusPointsSpent() {
  const skillPts = Object.values(state.skillPoints).reduce((s, v) => s + v, 0);
  return skillPts + (state.resourcesBonusSpent * 10);
}

function getBonusPointsRemaining() {
  return getBonusPointsTotal() - getBonusPointsSpent();
}

function getHarshnessPointsTotal()    { return state.harshness === 'gritty' ? 8 : 0; }
function getHarshnessPointsSpent() {
  return GRITTY_EDGES
    .filter(e => state.harshEdges.includes(e.id))
    .reduce((s, e) => s + e.cost, 0);
}
function getHarshnessPointsRemaining() { return getHarshnessPointsTotal() - getHarshnessPointsSpent(); }

function getEffectiveBondsCount() {
  const arch = getArchetype();
  if (!arch) return 0;
  const contactsEdge = state.harshEdges.includes('contacts') ? 1 : 0;
  return arch.bonds + contactsEdge;
}

function getEffectiveResources() {
  const arch = getArchetype();
  if (!arch) return 0;
  const resourcefulEdge = state.harshEdges.includes('resourceful') ? 1 : 0;
  return Math.min(4, arch.resources + state.resourcesBonusSpent + resourcefulEdge);
}

// ── Validation ─────────────────────────────────────────────

function canProceed(step) {
  switch (step) {
    case 1: return !!state.age;
    case 2: return !!state.harshness;
    case 3: return allAttributesAssigned();
    case 4: {
      if (!state.archetype) return false;
      const arch = getArchetype();
      return arch && state.selectedOptional.length === arch.optionalCount;
    }
    case 5: {
      const bpOk = getBonusPointsRemaining() === 0;
      const bondsOk = state.bonds.length > 0 && state.bonds.every(b => b.trim() !== '');
      return bpOk && bondsOk;
    }
    case 6: return state.identity.name.trim() !== '';
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
      // Entering step 4 — reset archetype if age changed
    }
    if (state.currentStep === 4) {
      // Entering step 5 — init skills & bonds
      initSkills();
      const arch = getArchetype();
      const bondCount = getEffectiveBondsCount();
      if (state.bonds.length !== bondCount) {
        state.bonds = Array(bondCount).fill('');
      }
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
          <li>Archetypes: 16 classic occupations available</li>
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
          <li>Archetypes: 12 contemporary occupations available</li>
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

// ── RENDER: Step 2 — Harshness ──────────────────────────────

function renderStep2() {
  return `
  <div class="step-content">
    <h2 class="step-title">Set the Tone</h2>
    <p class="step-subtitle">Choose how unforgiving your world will be. This affects special abilities available to your character.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;">

      <div class="sel-card ${state.harshness === 'standard' ? 'selected' : ''}"
           onclick="selectHarshness('standard')" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')selectHarshness('standard')">
        <div class="card-check">${checkIcon()}</div>
        <div class="card-tag">Standard</div>
        <div class="card-title">Standard Rules</div>
        <div class="card-desc">
          The baseline Cthulhu Eternal experience. 
          Characters are capable investigators facing extraordinary odds, with a reasonable chance of survival 
          if they keep their wits about them.
        </div>
        <ul class="card-detail-list mt-3">
          <li>No Harshness Points</li>
          <li>Standard recovery rates</li>
          <li>Recommended for new players</li>
          <li>Focus on investigation and story</li>
        </ul>
      </div>

      <div class="sel-card ${state.harshness === 'gritty' ? 'selected' : ''}"
           onclick="selectHarshness('gritty')" role="button" tabindex="0"
           onkeydown="if(event.key==='Enter'||event.key===' ')selectHarshness('gritty')">
        <div class="card-check">${checkIcon()}</div>
        <div class="card-tag" style="background:rgba(122,28,28,0.5);color:#fca5a5;border:1px solid rgba(163,48,48,0.5);">Gritty</div>
        <div class="card-title">Gritty Rules</div>
        <div class="card-desc">
          A darker, more punishing version of the rules where every encounter carries lasting consequences. 
          In exchange for greater danger, characters receive <strong>8 Harshness Points</strong> 
          to spend on powerful special edges.
        </div>
        <ul class="card-detail-list mt-3">
          <li>Gain 8 Harshness Points to spend</li>
          <li>Unlock special Gritty Edges</li>
          <li>Harsher consequences for failure</li>
          <li>Recommended for experienced groups</li>
        </ul>
      </div>
    </div>

    ${state.harshness === 'gritty' ? `<div class="notice mt-4">
      <strong>Gritty Mode</strong> selected. You will receive <strong>8 Harshness Points</strong> to spend 
      on special edges in Step 5.
    </div>` : ''}
  </div>`;
}

function selectHarshness(val) {
  state.harshness = val;
  render();
}

// ── RENDER: Step 3 — Attributes ─────────────────────────────

function renderStep3() {
  const poolRollIds = assignedRollIds();
  const unassigned  = state.rolledSets.filter(r => !poolRollIds.has(r.id));
  const hasRolled   = state.rolledSets.length > 0;
  const allAssigned = allAttributesAssigned();
  const derived     = allAssigned ? calculateDerived() : null;

  // Build roll pool chips
  const poolHtml = hasRolled ? unassigned.map(rs => {
    const sorted  = [...rs.values].sort((a, b) => b - a);
    const dropped = rs.values.indexOf(Math.min(...rs.values));
    const diceLabels = rs.values.map((v, i) => {
      const isDropped = (rs.values.filter((x, j) => j < i && x === v).length + 
                         sorted.filter((x, j) => j >= 3 && x === v).length > 0) ||
                        (i === rs.values.indexOf(Math.min(...rs.values)) && 
                         rs.values.filter(x => x === Math.min(...rs.values)).length === 1);
      return `<span class="${isDropped ? 'dropped' : ''}">${v}</span>`;
    });
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
      const sorted = [...rs.values].sort((a, b) => b - a);
      const diceLabels = rs.values.map((v, i) => {
        const isDropped = (rs.values.filter((x, j) => j < i && x === v).length +
                           sorted.filter((x, j) => j >= 3 && x === v).length > 0) ||
                          (i === rs.values.indexOf(Math.min(...rs.values)) &&
                           rs.values.filter(x => x === Math.min(...rs.values)).length === 1);
        return `<span class="${isDropped ? 'dropped' : ''}">${v}</span>`;
      });
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

  const derivedHtml = derived ? `
    <div class="derived-stats">
      <div class="derived-stat" data-tooltip="(STR + CON) ÷ 2">
        <div class="ds-label">Hit Points</div>
        <div class="ds-value">${derived.HP}</div>
      </div>
      <div class="derived-stat" data-tooltip="Equal to POW">
        <div class="ds-label">Willpower</div>
        <div class="ds-value">${derived.WP}</div>
      </div>
      <div class="derived-stat" data-tooltip="POW × 5">
        <div class="ds-label">Sanity</div>
        <div class="ds-value">${derived.SAN}</div>
      </div>
      <div class="derived-stat" data-tooltip="SAN − POW (Breaking Point)">
        <div class="ds-label">Break. Point</div>
        <div class="ds-value">${derived.BP}</div>
      </div>
    </div>` : '';

  return `
  <div class="step-content">
    <h2 class="step-title">Roll Your Attributes</h2>
    <p class="step-subtitle">Roll 4d6 seven times, keeping the highest three dice each time. Assign each result to an attribute by dragging or using the dropdowns below.</p>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">
      <span style="font-size:0.8rem;color:var(--text-secondary);">
        ${hasRolled ? `${7 - Object.values(state.attrAssign).filter(v=>v!==null&&v!==undefined).length} value(s) remaining to assign` : 'No rolls yet'}
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

    ${!allAttributesAssigned() && hasRolled ? `<p class="validation-msg">Assign all 7 attribute values to continue.</p>` : ''}
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

// ── RENDER: Step 4 — Archetype ──────────────────────────────

function renderStep4() {
  const filtered = ARCHETYPES.filter(a => a.ages.includes(state.age));
  const selected  = getArchetype();

  const archetypeCards = filtered.map(arch => `
    <div class="archetype-card ${state.archetype === arch.id ? 'selected' : ''}"
         onclick="selectArchetype('${arch.id}')" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter'||event.key===' ')selectArchetype('${arch.id}')">
      <div class="arch-name">${arch.name}</div>
      <div class="arch-desc">${arch.description.slice(0, 80)}…</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;">
        <span style="font-size:0.68rem;color:var(--text-secondary);">Bonds: ${arch.bonds}</span>
        ${resourcePips(4, arch.resources)}
      </div>
    </div>`).join('');

  let detailHtml = '';
  if (selected) {
    const optDone = state.selectedOptional.length === selected.optionalCount;
    detailHtml = `
    <div class="archetype-detail" id="archetype-detail">
      <h3>${selected.name}</h3>
      <p class="flavor">${selected.flavor}</p>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:1rem;line-height:1.6;">${selected.description}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;" class="sm:grid-cols-1">
        <div>
          <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-secondary);font-family:var(--font-head);margin-bottom:6px;">Bonus Skills (+${selected.bonusAmount}%)</div>
          <div>${selected.bonusSkills.map(s => `<span class="skill-pill">${s}</span>`).join('')}</div>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-secondary);font-family:var(--font-head);">Choose ${selected.optionalCount} Optional Skill${selected.optionalCount > 1 ? 's' : ''}</span>
            <span style="font-size:0.7rem;color:${optDone ? '#4ade80' : 'var(--accent-gold)'};">(${state.selectedOptional.length}/${selected.optionalCount} chosen)</span>
          </div>
          <div id="optional-skills-container">
            ${selected.optionalSkills.map(s => {
              const checked = state.selectedOptional.includes(s);
              return `<label class="optional-checkbox-label ${checked ? 'checked' : ''}" onclick="toggleOptional('${s}',${selected.optionalCount})">
                <input type="checkbox" ${checked ? 'checked' : ''} onclick="event.preventDefault();" style="pointer-events:none;"/>
                ${s}
              </label>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:2rem;flex-wrap:wrap;font-size:0.8rem;color:var(--text-secondary);">
        <span>Bonds: <strong style="color:var(--text-primary);">${selected.bonds}</strong></span>
        <span>Resources:
          <span class="resources-pips" style="display:inline-flex;gap:3px;vertical-align:middle;">
            ${[1,2,3,4].map(i => `<span class="pip ${i <= selected.resources ? 'filled' : ''}"></span>`).join('')}
          </span>
          (${selected.resources}/4)
        </span>
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

// ── RENDER: Step 5 — Point Distribution ─────────────────────

function renderStep5() {
  const arch      = getArchetype();
  const bpTotal   = getBonusPointsTotal();
  const bpSpent   = getBonusPointsSpent();
  const bpLeft    = bpTotal - bpSpent;
  const hpTotal   = getHarshnessPointsTotal();
  const hpLeft    = getHarshnessPointsRemaining();
  const isGritty  = state.harshness === 'gritty';
  const skills    = getCurrentSkills();
  const bondCount = getEffectiveBondsCount();

  // Ensure bonds array is right length
  while (state.bonds.length < bondCount) state.bonds.push('');
  while (state.bonds.length > bondCount) state.bonds.pop();

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
    const base     = skills[skillName] || 0;
    const archBon  = getArchetypeSkillBonus(skillName);
    const bpAdded  = state.skillPoints[skillName] || 0;
    const final    = getFinalSkillValue(skillName);
    const isBonus  = archBon > 0;
    const canAdd   = bpLeft > 0 && bpAdded < 20;
    const canSub   = bpAdded > 0;

    return `<tr>
      <td class="skill-name ${isBonus ? 'bonus-skill' : ''}" style="width:45%">
        ${skillName}${isBonus ? ` <span style="font-size:0.65rem;color:var(--accent-greenl);">+${archBon}</span>` : ''}
      </td>
      <td class="skill-base">${base}%</td>
      <td style="text-align:center;white-space:nowrap;">
        <button class="skill-adj-btn" onclick="adjustSkill('${skillName}',-1)" ${canSub ? '' : 'disabled'}>−</button>
        <span class="skill-bonus-added" style="display:inline-block;min-width:32px;text-align:center;">${bpAdded > 0 ? '+'+bpAdded : '—'}</span>
        <button class="skill-adj-btn plus" onclick="adjustSkill('${skillName}',1)" ${canAdd ? '' : 'disabled'}>+</button>
      </td>
      <td class="skill-final">${final}%</td>
    </tr>`;
  }).join('');

  const edgesHtml = isGritty ? `
    <div class="section-header" style="margin-top:2rem;"><h3>Gritty Edges — Harshness Points: ${hpLeft} / ${hpTotal} remaining</h3></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;" class="sm:grid-cols-1">
      ${GRITTY_EDGES.map(edge => {
        const owned   = state.harshEdges.includes(edge.id);
        const canBuy  = !owned && hpLeft >= edge.cost;
        return `<div class="edge-card ${owned ? 'purchased' : ''}">
          <div class="edge-info">
            <div class="edge-name">${edge.name}</div>
            <div class="edge-desc">${edge.description}</div>
            <div class="edge-cost">Cost: ${edge.cost} HP${owned ? ' ✓ Purchased' : ''}</div>
          </div>
          ${owned
            ? `<button class="edge-btn refund" onclick="refundEdge('${edge.id}')">Refund</button>`
            : `<button class="edge-btn buy" onclick="buyEdge('${edge.id}')" ${canBuy ? '' : 'disabled'}>Buy</button>`
          }
        </div>`;
      }).join('')}
    </div>` : '';

  const bondsHtml = `
    <div class="section-header" style="margin-top:2rem;">
      <h3>Bonds (${bondCount} — name each person your character values most)</h3>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;" class="sm:grid-cols-1">
      ${state.bonds.map((b, i) => `
        <div>
          <label style="font-size:0.72rem;color:var(--text-secondary);display:block;margin-bottom:3px;font-family:var(--font-head);text-transform:uppercase;letter-spacing:0.06em;">
            Bond ${i + 1}
          </label>
          <input class="bond-input" type="text" placeholder="Name a person…"
                 value="${escapeHtml(b)}"
                 oninput="updateBond(${i},this.value)" />
        </div>`).join('')}
    </div>`;

  const resourcesHtml = `
    <div class="section-header" style="margin-top:2rem;"><h3>Resources</h3></div>
    <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
      <div class="resources-pips" style="gap:6px;">
        ${[1,2,3,4].map(i => `<div class="pip ${i <= effectiveResources ? 'filled' : ''}" style="width:20px;height:20px;"></div>`).join('')}
      </div>
      <span style="font-size:0.82rem;color:var(--text-secondary);">
        Rating: <strong style="color:var(--text-primary);">${effectiveResources}/4</strong>
        (base: ${arch ? arch.resources : 0}${state.resourcesBonusSpent > 0 ? ` +${state.resourcesBonusSpent} purchased` : ''})
      </span>
      <button class="skill-adj-btn" onclick="adjustResources(-1)"
              ${state.resourcesBonusSpent > 0 ? '' : 'disabled'}>−</button>
      <span style="font-size:0.78rem;color:var(--text-secondary);">+1 costs 10 BP</span>
      <button class="skill-adj-btn plus" onclick="adjustResources(1)"
              ${bpLeft >= 10 && effectiveResources < 4 ? '' : 'disabled'}>+</button>
    </div>`;

  const bpClass = bpLeft === 0 ? 'good' : bpLeft < 0 ? 'warn' : '';
  const allBondsNamed = state.bonds.length > 0 && state.bonds.every(b => b.trim() !== '');

  return `
  <div class="step-content">
    <h2 class="step-title">Distribute Your Points</h2>
    <p class="step-subtitle">You have <strong style="color:var(--accent-gold);">${bpTotal}</strong> bonus points (equal to your INT score) to improve skills, bonds, and resources.</p>

    <div class="points-bar">
      <div class="points-counter">
        <span class="pts-val ${bpClass}">${bpLeft}</span>
        <span class="pts-label">Bonus Points Remaining</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text-secondary);">
        Spent: ${bpSpent} / ${bpTotal}
      </div>
      ${isGritty ? `<div class="points-counter">
        <span class="pts-val ${hpLeft === 0 ? 'good' : ''}">${hpLeft}</span>
        <span class="pts-label">Harshness Points Remaining</span>
      </div>` : ''}
    </div>

    ${bpLeft === 0 ? `<div class="notice mb-4"><strong>All bonus points spent.</strong> Scroll down to name your bonds, then proceed.</div>` : ''}

    <div class="section-header"><h3>Skills — max +20 per skill from bonus points</h3></div>
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

    ${edgesHtml}
    ${bondsHtml}
    ${resourcesHtml}

    ${!canProceed(5) ? `<p class="validation-msg">
      ${bpLeft !== 0 ? `Spend all ${bpLeft > 0 ? bpLeft + ' remaining' : 'over-budget'} bonus points. ` : ''}
      ${!allBondsNamed ? 'Name all bonds. ' : ''}
    </p>` : ''}
  </div>`;
}

function adjustSkill(skillName, delta) {
  const current = state.skillPoints[skillName] || 0;
  const newVal  = current + delta;
  if (newVal < 0 || newVal > 20) return;
  if (delta > 0 && getBonusPointsRemaining() < delta) return;
  state.skillPoints[skillName] = newVal;
  render();
}

function adjustResources(delta) {
  const arch = getArchetype();
  if (!arch) return;
  if (delta > 0) {
    if (getBonusPointsRemaining() < 10) return;
    if (getEffectiveResources() >= 4) return;
    state.resourcesBonusSpent++;
  } else {
    if (state.resourcesBonusSpent <= 0) return;
    state.resourcesBonusSpent--;
  }
  render();
}

function buyEdge(id) {
  const edge = GRITTY_EDGES.find(e => e.id === id);
  if (!edge) return;
  if (getHarshnessPointsRemaining() < edge.cost) return;
  if (state.harshEdges.includes(id)) return;
  state.harshEdges.push(id);
  // Special effects
  if (id === 'contacts') {
    state.bonds.push('');
  }
  render();
}

function refundEdge(id) {
  state.harshEdges = state.harshEdges.filter(e => e !== id);
  if (id === 'contacts' && state.bonds.length > getEffectiveBondsCount()) {
    state.bonds.pop();
  }
  render();
}

function updateBond(index, value) {
  state.bonds[index] = value;
  // Don't re-render (would lose focus), just update canProceed state silently
  // Update the next button disabled state
  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) nextBtn.disabled = !canProceed(5);
}

// ── RENDER: Step 6 — Identity & Export ──────────────────────

function renderStep6() {
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
    .filter(s => s.final > 0);

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
        <span><strong>${state.age === 'jazz' ? 'Jazz Age' : 'Modern Age'}</strong> · ${state.harshness === 'gritty' ? 'Gritty' : 'Standard'}</span>
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
        <div class="derived-box" data-tooltip="(STR + CON) ÷ 2">
          <span class="db-name">HP</span><span class="db-val">${derived ? derived.HP : '—'}</span>
        </div>
        <div class="derived-box" data-tooltip="Equal to POW">
          <span class="db-name">WP</span><span class="db-val">${derived ? derived.WP : '—'}</span>
        </div>
        <div class="derived-box" data-tooltip="POW × 5">
          <span class="db-name">SAN</span><span class="db-val">${derived ? derived.SAN : '—'}</span>
        </div>
        <div class="derived-box" data-tooltip="Breaking Point = SAN − POW">
          <span class="db-name">BP</span><span class="db-val">${derived ? derived.BP : '—'}</span>
        </div>
        <div class="derived-box">
          <span class="db-name">Resources</span><span class="db-val">${getEffectiveResources()}/4</span>
        </div>
      </div>
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
      <div>${state.bonds.filter(b => b.trim()).map(b => `<span class="bond-tag">${escapeHtml(b)}</span>`).join('')}</div>
    </div>

    ${state.harshEdges.length > 0 ? `
    <div class="sheet-section">
      <div class="sheet-section-title">Gritty Edges</div>
      <div>${state.harshEdges.map(id => {
        const e = GRITTY_EDGES.find(g => g.id === id);
        return e ? `<span class="bond-tag" style="background:rgba(122,28,28,0.2);border-color:rgba(163,48,48,0.4);">${e.name}</span>` : '';
      }).join('')}</div>
    </div>` : ''}

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

    ${!canProceed(6) ? `<p class="validation-msg">A character name is required.</p>` : ''}

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
  state.identity[field] = value;
  // Re-render if name (to show/hide sheet)
  if (field === 'name') {
    render();
  } else {
    // Just update next button
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.disabled = !canProceed(6);
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
  state.harshness   = null;
  state.rolledSets  = [];
  ATTRIBUTES.forEach(a => { state.attrAssign[a] = null; });
  state.archetype        = null;
  state.selectedOptional = [];
  state.skillPoints      = {};
  state.bonds            = [];
  state.resources        = 0;
  state.resourcesBonusSpent = 0;
  state.harshEdges       = [];
  state.identity         = { name: '', profession: '', characterAge: 25, backstory: '' };
}

// ── RENDER: Nav Buttons ─────────────────────────────────────

function renderNavButtons() {
  const isFirst = state.currentStep === 1;
  const isLast  = state.currentStep === 6;
  const proceed = canProceed(state.currentStep);

  return `
  <div class="nav-row no-print">
    <button class="btn btn-outline" onclick="prevStep()" ${isFirst ? 'disabled' : ''}>
      ← Previous
    </button>
    <span style="font-size:0.78rem;color:var(--text-secondary);">
      Step ${state.currentStep} of 6
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
    case 6: return renderStep6();
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

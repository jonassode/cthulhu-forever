# Cthulhu Eternal Jazz Age — App Review & Improvement Plan

## Overview

This document records the findings from comparing the Cthulhu Eternal Jazz Age SRD (v05) with the current character-creation application, along with a prioritised task list for bringing the app into alignment.

---

## Section A — Missing Character Creation Functionality

The following items exist in the Jazz Age SRD rules but are absent (or incomplete) in the current character-creation wizard.

| # | Gap | Notes |
|---|-----|-------|
| A1 | **Nationality / Birthplace field** | The Jazz Age setting is inherently cosmopolitan. A Protagonist's nationality affects social-encounter modelling. The step-6 identity form has no nationality field. |
| A2 | **Physical appearance description** | The SRD character sheet includes a free-text description block for physical appearance (height, build, hair colour, eye colour, notable features). |
| A3 | **Ideology / Beliefs section** | The SRD records up to five ideological statements that shape a Protagonist's world-view and motivations. This is distinct from the existing "Motivations" field. |
| A4 | **Significant People / Places / Possessions** | The standard SRD sheet has three separate fields listing people, locations, and objects of personal importance — separate from Bonds. |
| A5 | **Missing Jazz Age Archetypes** | A comparison of the SRD archetype chapter against the current `data.js` reveals up to five archetypes that are likely absent: **Entertainer / Musician**, **Explorer / Adventurer**, **Law Enforcement / Federal Agent**, **Military / Veteran**, and **Clergy / Religious**. Each requires full archetype skill lists, optional skills, resources, and bond counts transcribed from the PDF. |
| A6 | **Age-Effect Table** | The SRD notes that characters above certain age thresholds may have different starting stat distributions. The app currently uses a flat 4d6-drop-lowest for all ages. |

---

## Section B — Attributes / Values That Can Change During Play but Are Not Editable

The following derived values or tracked quantities change during actual play sessions but lack any edit / track mechanism in the current character sheet.

| # | Value | Current behaviour | Required behaviour |
|---|-------|-------------------|-------------------|
| B1 | **Individual Bond scores** | Always equals the Protagonist's CHA. No way to record damage. | Bond score must be independently adjustable (+/−) during play, since bonds are damaged when a Protagonist suffers SAN loss from a source involving that bond. |
| B2 | **Community Bond scores** | Correctly calculated at creation (Resources ÷ 2 + pick bonuses), but no in-play edit. | Same as B1 — bond scores must be trackable during play. |
| B3 | **Unnatural skill value** | Locked to 0 at creation (correct per rules). No tracking mechanism for in-play Mythos exposure increases. | The Unnatural skill increases as Protagonists accumulate Mythos knowledge. The character sheet must show the current Unnatural value with +/− buttons, and **Max SAN** (99 − Unnatural) must update accordingly. |
| B4 | **Mental Disorders / Conditions** | No field exists. | After a Breaking Point is crossed, Protagonists acquire Temporary or Indefinite Disorders (e.g., "Phobia: spiders", "Compulsion: check doors"). A free-text list of active disorders must be trackable on the sheet. |
| B5 | **Adapted to Violence / Helplessness** | Three checkboxes exist for each incident type, but no state change occurs when all three are checked. | When all three Violence boxes are ticked the Protagonist is **Adapted to Violence** (immune to further SAN loss from violence). Same for Helplessness. A visual "Adapted" badge should appear. |
| B6 | **Breaking Point** | Displayed as a static derived value (SAN − POW). Cannot be updated if permanent SAN loss has occurred. | When a Protagonist suffers permanent SAN loss the Breaking Point shifts. The field must be editable (double-click or +/−) to reflect the new threshold. |
| B7 | **Resources Rating** | Only the three-tier checkbox system exists. The rating number itself is not editable in play. | Resources can increase or decrease between sessions. The current rating must be adjustable during play without re-running the creation wizard. |

---

## Section C — Task List

Each task below corresponds to a gap identified in Sections A or B. Tasks are numbered, carry implementation suggestions, and include status checkboxes.

---

### Task 1 — Add Nationality / Birthplace Field
- [x] **Status:** Implemented

**What to change:**
- Add `nationality: ''` to `state.identity` in `js/app.js`.
- Add a labelled text-input for "Nationality / Birthplace" in the Step 6 identity form.
- Display nationality in the character sheet header alongside Profession and Gender.
- Handle the field in `updateIdentity()` for live DOM updates.
- Reset the field in `resetState()`.

---

### Task 2 — Add In-Play Unnatural Skill Tracking
- [x] **Status:** Implemented

**What to change:**
- Add `currentUnnatural: null` to `state` (`null` = use the creation value of 0).
- Add `getCurrentUnnaturalValue()` helper.
- Modify `calculateDerived()` to call `getCurrentUnnaturalValue()` instead of `getFinalSkillValue('Unnatural')`.
- In `buildCharSheetHtml()`, replace the hidden checkbox on the Unnatural skill row with **−/+** buttons that call `adjustUnnatural(delta)`.
- Update the skills-for-sheet array to display the in-play Unnatural value.
- Add `adjustUnnatural(delta)` function (clamped 0–99, triggers `render()`).
- Reset `currentUnnatural` in `resetState()`.

---

### Task 3 — Add Bond Score Damage / Tracking
- [x] **Status:** Implemented

**What to change:**
- Extend each bond object with `currentScore: null` (`null` = use calculated base).
- Update `ensureBondsCount()` to initialise `currentScore: null` for new bonds.
- Add `getBondPlayScore(bond)` helper (returns `bond.currentScore ?? getBondEffectiveValue(bond)`).
- Add `adjustBondPlayScore(idx, delta)` function.
- In `buildCharSheetHtml()`, replace the static bond score `<span>` with **−/+** buttons alongside the score.

---

### Task 4 — Add Mental Disorder / Condition Tracking
- [x] **Status:** Implemented

**What to change:**
- Add `disorders: []` to `state` (array of `{id, text}`).
- Add module-level `_disorderIdCounter`.
- Add `addDisorder()`, `removeDisorder(id)`, and `updateDisorderText(id, text)` functions.
- Add a **Disorders / Conditions** section in `buildCharSheetHtml()` (below Derived Statistics).
- Each entry shows an editable text input and a × remove button.
- Reset `disorders` in `resetState()`.

---

### Task 5 — Add "Adapted" Status Indicators
- [x] **Status:** Implemented

**What to change:**
- In `buildCharSheetHtml()`, check `state.violenceChecked.every(b => b)` and `state.helplessnessChecked.every(b => b)`.
- If adapted, render a styled **"Adapted"** badge next to the respective incident row.
- Add a CSS class `.adapted-badge` (gold/green variant) in `css/style.css`.

---

### Task 6 — Make Breaking Point Editable During Play
- [x] **Status:** Implemented

**What to change:**
- Add `bpAdjust: 0` to `state` (integer offset applied to the calculated BP).
- Add `adjustBP(delta)` function.
- In `buildCharSheetHtml()`, render BP with **−/+** adjustment buttons.
- Display the adjusted BP value (`derived.BP + state.bpAdjust`).
- Reset `bpAdjust` in `resetState()`.

---

### Task 7 — Add Missing Jazz Age Archetypes
- [ ] **Status:** Pending — requires transcription from PDF

**Archetypes likely absent (verify against the PDF before adding):**

| Archetype | Suggested recommended stats | Notes |
|-----------|----------------------------|-------|
| Entertainer / Musician | CHA, DEX | Jazz musicians, stage actors, film performers |
| Explorer / Adventurer | STR, CON | Field adventurers, big-game hunters |
| Law Enforcement / Federal Agent | CON, INT | Police, Treasury agents, Prohibition Bureau |
| Military / Veteran | STR, CON | WWI veterans now in civilian life |
| Clergy / Religious | POW, CHA | Priests, ministers, rabbis |

**How to add:**
- Each archetype requires: `id`, `name`, `ages: ['jazz']`, `recommendedStats`, `description`, `archetypeSkills[]`, `optionalSkills[]`, `optionalCount`, `resources`, `bonds`.
- Add each to `ARCHETYPES` array in `js/data.js`.
- Transcribe skill names from the SRD skill list; all must exist in `JAZZ_SKILLS`.

---

### Task 8 — Add Ideology / Beliefs Section
- [ ] **Status:** Pending

**What to change:**
- Add `beliefs: ''` (or `beliefs: []` for up to five entries) to `state.identity`.
- Add a labelled textarea in Step 5 (Motivations & Gear) or Step 6 (Identity), or create a new Step 5b.
- Render a **Ideology / Beliefs** section on the character sheet.

---

### Task 9 — Add Significant People / Places / Possessions
- [ ] **Status:** Pending

**What to change:**
- Add `significantPeople: ''`, `significantPlaces: ''`, `significantPossessions: ''` to `state.identity`.
- Add corresponding text-areas to the Motivations & Gear step (or Identity step).
- Render a three-column block on the character sheet.

---

### Task 10 — Resources Rating Editable During Play
- [ ] **Status:** Pending

**What to change:**
- Add `resourcesAdjust: 0` to `state` (integer offset applied to the creation-time rating).
- Render the Resources section on the character sheet with **−/+** buttons that call `adjustResourcesPlay(delta)`.
- The at-hand/stowed/in-storage breakdown should recalculate based on the adjusted rating.

---

*Last updated: auto-generated by Copilot agent review of Cthulhu Eternal Jazz Age SRD v05.*

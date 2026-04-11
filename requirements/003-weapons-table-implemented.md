# Requirement 003 – Weapons Table

## Status

Implemented: yes

## Summary

Add a new full-width **Weapons** table to the character sheet (step 6).
Each row captures one weapon's details.  The skill dropdown is populated from
the era's combat-relevant skills.  Damage bonus is auto-filled when a melee or
unarmed skill is selected.  Rows grow automatically so there is always one blank
row at the bottom.  The table round-trips through export/import correctly.

## Background

Players need a structured place to record their protagonist's weapons.  The
current sheet has no dedicated weapons section — gear is a single free-text
block.  Adding a dedicated, structured table makes play faster and the sheet
more readable.

## Acceptance Criteria

### Data Model

- [ ] `state.identity.weapons` is an array of weapon row objects.  Each object
      has the following string fields: `weapon`, `skill`, `baseRange`, `damage`,
      `ap`, `condition`, `lethality`, `killRadius`, `ammo`.
  - `condition` is one of `''` | `'pristine'` | `'worn'` | `'junk'`.
  - All other fields default to `''`.
- [ ] On initialisation (and when resetting) `state.identity.weapons` is
      `[{}]` — a single empty row — so there is always at least one blank row.

### Character Sheet UI (Step 6)

- [ ] A new full-width section titled **Weapons** appears on the character
      sheet, positioned above the Backstory/Gear row (or wherever the layout
      makes sense while keeping the section full-width).
- [ ] A legend in the top-right corner of the section header reads:
      `(db) = damage bonus` and `(ap) = armor piercing`, matching the reference
      image.
- [ ] The table has the following columns in order:

  | Column header | Input type | Notes |
  |---|---|---|
  | WEAPON | free-text input | — |
  | SKILL % | dropdown + read-only % display | Skill name chosen from dropdown; % auto-filled from character skill value |
  | BASE RANGE | free-text input | — |
  | DAMAGE | free-text input | — |
  | (db) | read-only display | Auto-filled with character's Damage Bonus when skill is Melee Weapons or Unarmed Combat (or era-equivalent); blank otherwise |
  | (ap) | free-text input | Armor Piercing value |
  | Pristine / Worn / Junk | 3 checkboxes, mutually exclusive per row | Checking one unchecks the other two in the same row |
  | LETHALITY % | free-text input | — |
  | KILL RADIUS | free-text input | — |
  | AMMO | free-text input | — |

- [ ] The skill dropdown for each row is populated based on `state.age` as
      follows:

  | Era | Skills offered |
  |---|---|
  | jazz | Athletics, Firearms, Melee Weapons, Military Training (Type), Unarmed Combat |
  | modern | Athletics, Firearms, Melee Weapons, Military Training (Type), Unarmed Combat |
  | coldwar | Athletics, Firearms, Martial Arts, Melee Weapons, Military Training (Type), Unarmed Combat |
  | victorian | Athletics, Firearms, Melee Weapons, Military Training (Type), Unarmed Combat |
  | ww1 | Artillery, Athletics, Firearms, Heavy Weapons, Melee Weapons, Military Science, Unarmed Combat |
  | ww2 | Artillery, Athletics, Firearms, Heavy Weapons, Melee Weapons, Military Science, Unarmed Combat |
  | future | Athletics, Firearms / Beam Weapons, Melee Weapons, Military Training (Type), Unarmed Combat |
  | medieval | Athletics, Melee Weapons, Ranged Weapons, Siege Weapons, Unarmed Combat |
  | classical | Athletics, Melee Weapons, Ranged Weapons, Siege Weapons, Unarmed Combat |

- [ ] The **Damage Bonus** `(db)` cell for a row is automatically populated
      with the character's current Damage Bonus value whenever the selected
      skill is Melee Weapons or Unarmed Combat.  The cell is blank for all
      other skills.
- [ ] The three condition checkboxes (Pristine / Worn / Junk) behave as a
      radio group: selecting one deselects the other two in the same row.
- [ ] When the user enters any value in the last (blank) row, a new empty row
      is appended automatically so there is always exactly one blank row at the
      bottom.
- [ ] Rows do **not** have an explicit delete button; the trailing blank row
      mechanism is sufficient.  (Clearing all fields of a row effectively makes
      it blank again.)

### Export / Import

- [ ] `exportToJson` includes `identity.weapons` as an array in the exported
      JSON object.
- [ ] `importFromJsonV2` restores `identity.weapons` from the JSON, defaulting
      to `[{}]` when the field is absent (backward-compatible with older saves).
- [ ] `importFromJsonV1` similarly defaults `identity.weapons` to `[{}]` when
      absent.
- [ ] After import the trailing-blank-row invariant is enforced: if the last
      row of the imported array is not fully blank, a new empty row is appended.

### Validation Scripts

- [ ] The `validate-import-export.mjs` script asserts that
      `identity.weapons` is present and is an array.
- [ ] The sample fixture `scripts/fixtures/sample-character.json` includes
      a `weapons` array on `identity` (at minimum one entry with all string
      fields).

## Implementation Notes

- The field key on `state.identity` is `weapons` (an array), matching
  camelCase conventions used for `motivations`, `gear`, etc.
- Each row object should be treated as a plain object; no class or prototype
  is needed.
- An empty row is defined as: all string fields are `''` and `condition` is
  `''`.
- The `getWeaponSkills()` helper (or equivalent inline logic) dispatches on
  `state.age` to return the correct array of skill names for the dropdown.
- The SKILL % display reads the character's effective skill value via the
  existing `getSkillValue(skillName)` function (or equivalent).  It updates
  reactively whenever the sheet is re-rendered.
- The `(db)` display reads `getDerivedStats().DmgBonus` (or equivalent) and is
  shown only when the row's skill is a melee or unarmed skill.
- No existing CSS class names, element IDs, state properties, or exported JSON
  keys are renamed as part of this change.
- The `startEditText` / `finishEditText` helpers are **not** relevant here;
  the weapons table uses inline `<input>` elements rather than the
  double-click-to-edit pattern.

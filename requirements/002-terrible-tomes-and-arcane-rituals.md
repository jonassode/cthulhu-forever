# Requirement 002 – Terrible Tomes & Arcane Rituals

## Status

Implemented: yes

## Summary

Add a new **Terrible Tomes & Arcane Rituals** free-text field to the character
sheet and original sheet export.  Restructure the character sheet so that
backstory occupies its own full-width row and the new field sits alongside
**Gear** in a two-column row beneath it.

## Background

Players need a dedicated place to record eldritch books and rituals their
investigator has encountered.  The original sheet already reserves space for
this section; the interactive character sheet and the export/import pipeline
must now support it.

## Acceptance Criteria

- [x] A new `terribleTomes` string property exists on `state.identity`.
- [x] The character sheet (step 6) displays **Backstory** as a full-width
      section above a two-column row containing **Terrible Tomes & Arcane
      Rituals** (left) and **Gear** (right).
- [x] The **Terrible Tomes & Arcane Rituals** box is double-click editable on
      the sheet, identical in behaviour to the existing Gear and Backstory boxes.
- [x] The original sheet export (`exportToOriginalSheet`) populates the
      *Terrible Tomes & Arcane Rituals* block with the field value when it is
      non-empty, and renders blank lines otherwise.
- [x] `exportToJson` includes `identity.terribleTomes` in the exported JSON.
- [x] `importFromJsonV2` and `importFromJsonV1` restore `terribleTomes` from
      the JSON (defaulting to `''` when absent for backward compatibility).
- [x] The `validate-import-export.mjs` script asserts that `identity.terribleTomes`
      is present and is a string.
- [x] The sample fixture `scripts/fixtures/sample-character.json` includes the
      `terribleTomes` field.

## Implementation Notes

- The field key is `terribleTomes` throughout (camelCase).
- No CSS class names, element IDs, or other existing keys are renamed.
- The `startEditText` / `finishEditText` helpers are reused unchanged.

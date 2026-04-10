# Requirement 001 – Rename "Gear & Weapons" to "Gear" on the Character Sheet

## Summary

The label for the gear section on the character sheet must be renamed from **"Gear & Weapons"** to **"Gear"**.

## Background

The current character sheet displays a section titled "Gear & Weapons". The weapons aspect is already implied by the gear section and the title should be simplified to just "Gear" for clarity and conciseness.

## Acceptance Criteria

- [ ] The section title on the printed/rendered character sheet reads **"Gear"** instead of **"Gear & Weapons"**.
- [ ] No other labels, field names, state properties, or export/import keys are changed.
- [ ] Existing character data (the `state.identity.gear` field) continues to load and save correctly.

## Implementation Notes

- The label is rendered in `js/app.js` inside the `buildCharSheetHtml()` function.
- Locate the following line (approximately line 2767):

  ```html
  <div class="sheet-section-title">Gear &amp; Weapons</div>
  ```

- Change it to:

  ```html
  <div class="sheet-section-title">Gear</div>
  ```

- Only the display text needs to change. Do **not** rename the CSS class `sheet-backstory`, the element id `sheet-gear`, the `state.identity.gear` property, or any exported JSON key.

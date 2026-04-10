# Requirement 004 – Original Sheet: Lined Text Sections with Handwritten Font

## Status

Implemented: yes

## Summary

The **Terrible Tomes & Arcane Rituals** and **Gear** sections on the original
sheet export must always show horizontal ruled lines — even when text has been
filled in — and the text must be rendered in a handwritten-style font aligned
line by line with the rules.  Currently, when content is present the plain
`generic-text` block replaces the lined block entirely, so all visible rules
disappear.

## Background

When those sections are empty, the original sheet renders a series of
`<div class="gear-line">` elements that produce the classic ruled-notebook
look.  As soon as any text value is stored the code switches to a
`generic-text` container that uses `white-space: pre-wrap` but has no lines,
causing the filled section to look plain and inconsistent with the rest of the
sheet.  The goal is to make filled sections look as if the protagonist has
written directly on the lined paper, matching the aesthetic of a hand-filled
physical sheet.

## Acceptance Criteria

### Ruled lines always visible

- [x] The **Gear** section on the original sheet always renders ruled lines
      underneath the content, whether the field is empty or contains text.
- [x] The **Terrible Tomes & Arcane Rituals** section on the original sheet
      always renders ruled lines underneath the content, whether the field is
      empty or contains text.
- [x] The **Protagonist's Story So Far** section applies the same treatment
      for consistency.
- [x] Ruled lines are not removed or hidden when a non-empty value is present;
      lines must be visible beneath each line of text.

### Line-by-line text layout

- [x] Text is rendered so that each line of content sits on top of one ruled
      line (i.e. the text baseline aligns with the bottom border of each ruled
      row).
- [x] The `line-height` of the text matches the height of each ruled line so
      that multi-line content flows across consecutive lines without overlap or
      gaps.
- [x] Lines that contain no text still display the visible ruled line (the
      section never collapses below its minimum ruled height).

### Handwritten font

- [x] Text in the lined sections is displayed using a handwritten-style
      typeface (for example *Caveat*, *Patrick Hand*, or *Indie Flower* from
      Google Fonts, or an equivalent web-safe cursive fallback).
- [x] The font is applied only to the filled-text portions of the Gear,
      Terrible Tomes, and Story So Far sections; section headers and other
      labels are unchanged.
- [x] A `cursive` generic font family is included as a fallback so the sheet
      renders acceptably without an internet connection.
- [x] The chosen font size keeps text legible at typical print scale (>= 7.5pt
      or equivalent).

### No regressions

- [x] Empty sections continue to display the same number of ruled lines as
      before (8 lines for Gear and Terrible Tomes, 12 lines for Story So Far).
- [x] No existing CSS class names, element IDs, state properties, or exported
      JSON keys are renamed.
- [x] The `validate-import-export.mjs` and `validate-skill-parity.mjs`
      validation scripts continue to pass without modification.

## Implementation Notes

- The lined background can be achieved with a CSS `repeating-linear-gradient`
  on the text container (e.g.
  `background: repeating-linear-gradient(transparent, transparent calc(6mm - 1px), #aaa calc(6mm - 1px), #aaa 6mm)`)
  where `6mm` matches the chosen `line-height`, so that the lines are always
  present regardless of content.
- Alternatively, the existing `gear-line` divs can be kept as a background
  layer and the text overlaid with `position: absolute` on top, though the
  gradient approach is simpler.
- The Google Fonts `<link>` tag (or `@import`) should be added inside the
  `<style>` block of the generated original-sheet HTML, not in the main
  `index.html`, so the font only loads when the sheet is exported.
- The font and `line-height` must be tuned together so that each text line
  aligns visually with the ruled lines.
- All changes are confined to the `exportToOriginalSheet()` function in
  `js/app.js`; no other functions need to change.

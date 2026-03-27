
## Repository Context

- This repository is a static web app. The main implementation lives in js/app.js and js/data.js, with styles in css/style.css.
- There is no package.json test runner. Validation is done through standalone Node scripts in scripts/.
- Keep changes minimal and focused. Avoid unrelated refactors unless they are required to complete the task safely.

## Validation Instructions

- Run the relevant validation scripts for the area you changed.
- For changes to skill tables, era data, archetypes, or base percentages in js/data.js, run: node scripts/validate-skill-parity.mjs
- For changes to character creation logic, derived stats, bonus pick handling, or sheet calculations in js/app.js, run: node scripts/validate-character-creation.mjs
- For changes to import/export behavior, save format, fixture compatibility, or JSON structure, run: node scripts/validate-import-export.mjs
- If a change touches more than one area, run every relevant validation script.
- Do not say validation passed unless the script completed successfully. If validation could not be run, state that explicitly.

## UI Change Instructions

- Preserve the existing visual style unless the task asks for a redesign.
- For UI or layout changes, verify behavior in the browser when practical.
- Include updated screenshots in the PR when practical, especially for visible sheet or workflow changes.
- Use screenshot-step6.html and the scripts in scripts/ when they are relevant to the change.

## Data And State Safety

- Treat exported character JSON as a compatibility surface. Avoid changing shape or field names without updating import/export handling and validation.
- Keep calculations and state transitions consistent between character creation and the printable sheet.
- When changing skill or archetype data, preserve parity expectations unless the task explicitly changes the game data.

## Code Review Instructions

- Review changes like a senior engineer: prioritize behavioral regressions, data compatibility, edge cases, and missing validation.
- Call out risks clearly if a change affects calculations, export/import, or character sheet rendering.

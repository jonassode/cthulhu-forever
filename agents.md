# agents.md

## What this repo is

- **Cthulhu Forever** is a static web app for building Cthulhu Eternal characters.
- The main implementation lives in `/js/app.js` and `/js/data.js`.
- Styling lives in `/css/style.css`.
- You can open `/index.html` directly in a browser to use the app.

## What to do

- Keep changes small, focused, and local to the issue you are fixing.
- Reuse the existing validation scripts in `/scripts` instead of adding new tooling.
- Run the validation script that matches your change:
  - `node scripts/validate-skill-parity.mjs` for skill tables, archetypes, eras, or base percentages in `/js/data.js`
  - `node scripts/validate-character-creation.mjs` for character creation logic, derived stats, bonus picks, or sheet calculations in `/js/app.js`
  - `node scripts/validate-import-export.mjs` for import/export behavior, save format, fixtures, or JSON structure
- If a change touches more than one area, run every relevant script.
- For UI changes, preserve the current visual style and verify the browser behavior when practical.

## What not to do

- Do **not** add a new package-based test runner or other tooling when the existing scripts already cover the change.
- Do **not** make broad refactors when a surgical fix will do.
- Do **not** change exported character JSON field names or shape casually.
- Do **not** redesign the UI unless the task explicitly asks for it.

## Gotchas

- There is **no** `package.json`-driven test flow here; validation is done with standalone Node scripts in `/scripts`.
- Exported character JSON is a compatibility surface, so import/export changes need extra care.
- Character creation calculations need to stay consistent with what the printable sheet shows.
- Skill and archetype data changes should preserve parity expectations unless the task intentionally changes game data.

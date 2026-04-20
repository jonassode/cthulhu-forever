# Changelog

All notable changes are listed here from newest to oldest.

0.5.4 - Rename matthew_flounders.json to matthew_flounders.json; Add files via upload  
0.5.3 - refactor: use array.includes() for era check in validate-import-export.mjs; fix: add 'sails' era to VALID_ERAS in importFromJson so Age of Sails characters can be imported  
0.5.2 - Bump version to 0.5.1  
0.4.3 - Fix duplicate weapon skills case statement and condense Apothecary description; Add Age of Sails era with skills, archetypes, descriptions, and Societal Class support  
0.4.2 - chore: bump version to 0.4.1  
0.3.9 - Stretch exhausted-col to fill attrs-row so Societal Class reaches the right edge; Right-align Societal Class box and remove its border/background; Rename john_t__boots.json to pre-gens/AoR/john_t__boots.json; Place Societal Class box to the right of Exhausted/Temp. Insanity checkboxes; Move Societal Class block directly below checkboxes in attrs column; Address code review: move inline styles to CSS class, add comment for Medicine skill; Add Age of Revolutions era with skills, archetypes, and Societal Class feature  
0.3.8 - Added new pre-gen for AoR  
0.3.7 - Apply reviewer feedback: fill fixture blanks, add custom skills, set bodyArmour=1; Improve sample character fixture and import/export validation  
0.3.6 - Add CONTRIBUTING.md and update Credits.md with attribution section  
0.3.5 - Add itch/index.html redirect page  
0.3.4 - feat: add Import Character option to character sheet settings  
0.3.3 - fix: scope scrollbar styling to root scroll container  
0.3.1 - Change version to 0.3.1  
0.2.74 - Add Notes field with inline editing, export, and original sheet support  
0.2.74 - Add Notes field for session notes and reminders with inline editing and export support  
0.2.73 - Add upbringing field to original sheet PROTAGONIST block  
0.2.72 - Remove space between LETHALITY and % in weapons table header; Add line breaks in BASE RANGE and KILL RADIUS headers; align headers to bottom  
0.2.71 - align weapon/skill column widths consistently across builder and export tables; adjust weapons and skill column widths in weapons table  
0.2.70 - Fix weapons table: append new rows without full re-render to preserve focus; Fix first-character re-render in weapons table; Fix weapons table: no re-render on text input, styled checkboxes, populated original sheet; Add trailing blank row validation to validate-import-export.mjs; Implement weapons table (requirement 003)  
0.2.69 - Change print button text to 'Print', remove Export to Original Character Sheet, add View as Character Sheet button  
0.2.68 - Remove 'unofficial' from project description  
0.2.67 - Update footer text for Cthulhu Forever project  
0.2.66 - Move Backstory section below Tomes/Gear on the character sheet  
0.2.65 - fix: remove left, right, and bottom borders from weapons table on original sheet  
0.2.64 - Fix lined sections: no bottom line, inset lines matching fellow-item style; Implement requirement 004: lined text sections with handwritten font on original sheet  
0.2.63 - docs(003): add military training skills to weapons table skill dropdown spec  
0.2.62 - Remove empty .stats-block CSS rule; Remove border-top line above statistics section in original sheet export  
0.2.61 - fix: tidy requirements/004 wording per code review feedback; feat: add requirements/004-original-sheet-lined-text-sections.md  
0.2.60 - Fix weapons table header border color to match data rows (#ccc)  
0.2.59 - feat: implement Terrible Tomes & Arcane Rituals field (requirement 002)  
0.2.58 - Implement character sheet gear description changes  
0.2.57 - feat: rename Gear & Weapons to Gear on character sheet; mark requirement 001 implemented  
0.2.57 - Rename "Gear & Weapons" to "Gear" on character sheet; mark requirement 001 as implemented  
0.2.56 - fix: remove original sheet export references from weapons table requirements; feat: add requirements/003-weapons-table.md  
0.2.55 - Add Terrible Tomes & Arcane Rituals field to character sheet; Update acceptance criteria for terribleTomes feature; Change implementation status to 'no' for requirement 002; revert: remove code changes, keep only requirements file 002; feat: add Terrible Tomes & Arcane Rituals field and restructure character sheet  
0.2.54 - Add implementation status to gear description requirement  
0.2.53 - Add requirements folder and 001-character-sheet-change-gear-description.md  
0.2.52 - Replace gear & weapons with backstory in step 5; realign step 6 fields  
0.2.51 - Reorder derived stat boxes in step 2: HP, WP, Dmg Bonus, Body Armour, SAN, Recovery SAN, BP, Max SAN, Luck; Make derived stat boxes half-width in step 2 by switching to 4-column grid  
0.2.50 - Update ROADMAP to remove character sheet improvements  
0.2.49 - Update ROADMAP.md  
0.2.48 - Match stats-table header row border colour to data rows (#bbb); Remove border-bottom from Statistics box on character sheet; Remove bottom line from story, gear, notes, and fellow-characters boxes  
0.2.47 - Fix exported sheet: remove stats table side borders, willpower underline, and fix text colors  
0.2.46 - Change font of Original Sheet heading to Cinzel to match character sheet  
0.2.45 - Fix alignment: match mid-row column widths to top-row  
0.2.44 - fix: align Current HP and Current SAN labels to top of wrapper; fix: remove vlabel backgrounds and protagonist card border lines; Remove border-right from hp-vlabel and san-vlabel to fix extra visual border; Remove padding-right from hp-grid and san-grid to eliminate extra right border; Fix PROTAGONIST heading height and gap: move heading inside border wrapper, remove line-height/margin/border from id-title-box; Unify PROTAGONIST, STATISTICS, OTHER ATTRIBUTES heading styles to 8pt/1px 4px/.1em; Fix Fellow Characters line colour/count and Terrible Tomes line count in export sheet; Match inc-block header style and fix checkbox alignment in Original Sheet export; Fix resource check boxes count in Original Sheet export to match rating; Add 'Total Resources' label before resource rating in Original Sheet export; Fix Bonds Box: ensure minimum empty rows in Original Sheet export  
0.2.43 - feat: chain workflows to run in sequence: Tests → Changelog → Pages → Release  
0.2.42 - feat: Add Classical Era with skills, descriptions, archetypes, and import/export support  
0.2.41 - Revise roadmap with new export and character sheet features  
0.2.40 - Update roadmap with new features and eras  
0.2.39 - Revise ROADMAP.md with new features and timelines  
0.2.38 - Format additional eras in the roadmap  
0.2.37 - Refine ERAs list in ROADMAP.md  
0.2.36 - Update era selection description in README  
0.2.35 - Add Medieval Era: skills, skill descriptions, archetypes, adversity skills, and UI  
0.2.34 - Fix upbringing selection layout on mobile - stack cards vertically  
0.2.33 - feat: empty tomes section, permanent resources gets blue sec-hdr; feat: move skill checkbox to right of score, rename tomes section, split motivation/disorder; fix: change all checked checkboxes to × crossout style; fix: SAN grid - vertical Current SAN label, 00 added, 10/row, remove Insane/Dead labels; fix: HP grid - remove dotted divider, rename Stunned to Dead, 5 rows of 4 cells; fix: remove value underlines, rename title to Protagonist, leave fellow characters empty; fix: move era banner to top, merge perm injuries + incidents row, remove BP display box; fix: restructure SAN block - BP in header, Current SAN label inside grid; fix: integrate Insane/01-07 into main SAN grid and add Current SAN header label; fix: populate Distinguishing Feature column in exported sheet statistics table; feat: restructure exported sheet layout to match original Cthulhu Eternal sheet; fix: remove auto-print on load from original character sheet export; fix: remove redundant Max SAN in derived-sub label; fix: address code review issues in exportToOriginalSheet; feat: add Export to Original Character Sheet option to settings menu  
0.2.32 - Fix Future era showing as Modern Age on character sheet; Add Future era: skills, archetypes, adversity skills, import/export support  
0.2.31 - fix: wrap stepper into 2 rows on mobile screens  
0.2.30 - fix: remove error when importing character without a name  
0.2.29 - fix: allow ww1 and ww2 eras to be imported  
0.2.28 - ux: clear era selection when navigating back to step 1; ui: move era dates from header into expander as Setting bullet point; style: add btn-primary with gold border for Select This Era button; UX: era order, select advances step, hide continue on step 1; Remove icons from era accordion timeline; feat: replace era card grid with interactive timeline accordion on Step 1  
0.2.27 - Fix typo in Quality of Life Improvements section  
0.2.26 - Update ROADMAP with new game themes  
0.2.25 - Update roadmap with new game additions  
0.2.24 - Mark WWII as completed in the roadmap  
0.2.23 - Add World War II era with skills, archetypes, and 3+3 layout  
0.2.22 - Update ROADMAP with temporary values for Attributes  
0.2.21 - Mark WWI as completed in the roadmap  
0.2.20 - fix: correct Alertness skill description typo in WWI_SKILL_DESCRIPTIONS; feat: Add World War I era with skills, archetypes, adversity skills, and 3+2 era grid layout  
0.2.19 - fix: age not updated in character sheet preview  
0.2.18 - Add skill tooltips to Step 3 Archetypal and Optional Skills  
0.2.16 - feat: update footer - move Clear Credits next to Cthulhu Reborn, add Itch.io link  
0.2.15 - fix: make release workflow run after changelog workflow succeeds on main; Update system title to Cthulhu Forever and Cthulhu Eternal Character Generator; Update project name from 'Character Builder' to 'Cthulhu Forever'; Update roadmap with new playing and dice rolling sections; Update ROADMAP.md with new features; Revise roadmap with new eras and completion status; Fix remove-bond tooltip: use data-tooltip instead of native title attribute; feat: add release ZIP workflow and releases folder; Add Remove Bond tooltip and UNDO notification (#remove-bond-improvements)  
0.2.14 - fix: extend JS tooltip to all [data-tooltip] elements to prevent overflow clipping  
0.2.13 - feat: add Temporary Insanity checkbox below Exhausted on character sheet  
0.2.12 - Set document.title to character name during print for correct PDF filename  
0.2.11 - refactor: make notification system generic (showNotification/closeNotification); feat: add floating notification when raising personal bond above CHA; Cap personal bond score at CHA in adjustBondPlayScore
0.2.10 - Update titles and descriptions for age cards  
0.2.9 - Remove era card badges and reduce card padding/grid gap  
0.2.8 - Fix WP-0 badge label to Lose Control and add tooltips to all status badges; Move HP/WP status badges under Exhausted label; Add HP/WP status colour change and badges at ≤2 and 0  
0.2.7 - Cap Resources capacity breakdown at 6/6/8 for ratings above 20; Remove max-20 cap from Resources rating  
0.2.6 - align bond type badges: add min-width and text-align: center to .bond-type-badge  
0.2.5 - Trim era card descriptions to 1 sentence and remove Archetypes bullet  
0.2.4 - feat: double-click to edit motivation text on character sheet; feat: replace motivations textarea with 5 individual fields + cross-out feature  
0.2.3 - Add Suite 5b: Adversity Skills by Era verification tests  
0.2.2 - feat: change versioning to MAJOR.MINOR.PATCH (0.2.1)  
0.1.194 - Update era selection in features list  
0.1.193 - feat: add Victorian Age era with skills, archetypes, and adversity picks  
0.1.192 - Add Luck static value (50) to Derived Statistics section  
0.1.191 - fix: exhausted attr % colour, label colour, and base-value exports  
0.1.190 - fix: use .attr-box .ab-x5-exhausted for correct CSS specificity  
0.1.189 - Exhausted: tooltip, SAN parenthetical penalty, attr x5 blue, CSS variable  
0.1.188 - Add Exhausted tick box to character sheet with -20% skill display and light blue coloring  
0.1.187 - Add Cold War era skills, archetypes, and descriptions  
0.1.186 - Move Permanent Injuries into Derived Statistics section as compact field  
0.1.185 - Add Permanent Injuries text field to character sheet  
0.1.184 - feat: add ability to establish a new bond on character sheet in edit mode  
0.1.183 - Change nationality to Birthplace on character sheet and export  
0.1.182 - Add Broken bond status for score of 0 with light red badge and strikethrough  
0.1.181 - Add Body Armour field to character sheet with edit mode +/- controls and export/import support  
0.1.180 - Cap bond values at maximum of 20  
0.1.179 - Show character sheet on step 6 without requiring a name  
0.1.178 - Fix: deselecting a bond in harsh upbringing step no longer keeps continue active  
0.1.177 - Fix: prevent selecting the same bond twice in Harsh Upbringing step 4.5  
0.1.176 - fix: show original bond value in stage 4.5 reduction dropdown  
0.1.175 - Add screenshots section to README  
0.1.174 - Fix formatting issues in README.md  
0.1.173 - Enhance character sheet export options  
0.1.172 - Add mobile responsiveness to roadmap  
0.1.171 - Change bond reduction display from −n to 'reduced by n' in step 4.5  
0.1.170 - Enhance Cloudflare Web Analytics script section  
0.1.169 - feat: add Cloudflare Web Analytics snippet to index.html  
0.1.168 - fix: add .form-select CSS to style bond dropdowns on Upbringing Effects step  
0.1.167 - fix: resolve suite numbering conflict and add missing closing brace in validate-character-creation.mjs  
0.1.166 - feat: add mental disorders step for Harsh and Very Harsh upbringing  
0.1.165 - Remove screenshots from PR  
0.1.164 - Swap motivations and disorders layout on character sheet  
0.1.163 - Improve Copilot workspace instructions  
0.1.162 - Update README.md  
0.1.161 - Fix: clamp displayed attribute values to min 3 / max 18 (was 1–20)  
0.1.160 - Fix: RecoverySAN should use displayed (edited) POW, not base POW  
0.1.159 - Fix: SAN and BP should not change when POW is edited in attribute edit mode  
0.1.158 - Fix: BP should not change when POW is edited in attribute edit mode  
0.1.157 - Fix attribute edit bounds: clamp to min 3, max 18  
0.1.156 - Changes before error encountered  
0.1.155 - Reorganize README to highlight project access  
0.1.154 - Disallow community bond sacrifice when resources are sacrificed to 0  
0.1.153 - Address code review: add typeof check, simplify bonusSpent condition, clarify test comment  
0.1.152 - Add sacrifice toggles for Resources (set to 0) and community bonds (set to 1) for extra bonus picks  
0.1.151 - Add min-width: 260px to CSS tooltip so it actually renders wider  
0.1.150 - Double tooltip max-width from 220px to 440px  
0.1.149 - Fix Add Disorder tooltip: use data-tooltip instead of title attribute  
0.1.148 - Reorder character sheet sections: Bonds first, 2-col Disorders/Motivations and Backstory/Gear  
0.1.147 - Add 'What Else?' section to ROADMAP.md  
0.1.146 - Revise roadmap with new features and clarifications  
0.1.145 - Add ROADMAP.md with high level roadmap for Character Builder  
0.1.144 - fix: move minus button to right side of bond status badge in edit mode  
0.1.143 - fix: tooltip font/case and badge colour style  
0.1.142 - fix: capitalise tooltip text and add trailing periods  
0.1.141 - feat: add community bond status badge and tooltip based on rating  
0.1.140 - refactor: address code review - use constants, fix color variable  
0.1.139 - feat: add points-based attribute allocation mode  
0.1.138 - fix: revert checkout to v4 in update-changelog.yml (matches original, consistent with static.yml fix)  
0.1.137 - fix: revert checkout to v4 in static.yml (v5 previously broke Pages deploy)  
0.1.136 - fix: update GitHub Actions to resolve Node.js 20 deprecation warnings  
0.1.135 - Delete plan.md  
0.1.134 - Fix MaxSAN calculation and clamp SAN/RecoverySAN to MaxSAN  
0.1.132 - Add character creation validation tests and wire into CI  
0.1.131 - fix: reset violenceChecked, helplessnessChecked, editMode, showAllSkills on Start Over  
0.1.128 - Fix: reset resourcesEditAdjust and skillEditAdjust in resetState()  
0.1.127 - Export final HP/WP/SAN/BP/MaxSAN/RecoverySAN values in v2 format  
0.1.126 - Simplify JSON export to outcome-only v2 format  
0.1.125 - Add Import/Export character JSON feature with tests  
0.1.123 - Enhance copilot instructions with new sections  
0.1.122 - Add CHANGELOG.md with PR-based version entries from newest to oldest  
0.1.120 - Fix invalid actions/checkout@v5 to v4 in static.yml  
0.1.119 - Fix pages workflow: downgrade configure-pages to v5 and deploy-pages to v4  
0.1.117 - fix: update GitHub Actions to Node.js 24 compatible versions  
0.1.115 - Update Credits.md link to use full GitHub URL on main branch  
0.1.113 - Add test workflow to run validate-skill-parity.mjs on PRs and main  
0.1.111 - style: replace globe icon with octopus icon for cthulhueternal.com link  
0.1.110 - fix: replace broken OGL link with Wikipedia OGL page in Credits.md  
0.1.109 - Move Add Custom Skill out of advanced mode, remove advanced mode, use skill tooltip  
0.1.108 - fix: update DriveThruRPG link for Cthulhu Reborn in Credits.md  
0.1.107 - Remove clone skill button and functionality from the builder  
0.1.106 - feat: add Credits.md and Clear Credits footer link  
0.1.105 - Fixed invalid `actions/checkout` version in static workflow  
0.1.104 - Fixed GitHub Pages deployment workflow by downgrading actions versions  
0.1.100 - Updated GitHub Actions to use Node.js 24 compatible versions  
0.1.98 - Updated Credits.md link to use the full GitHub URL pointing to the main branch  
0.1.96 - Added GitHub Actions workflow to run skill parity validation tests on PRs and main  
0.1.94 - Added Credits.md file and a footer link to clear credits; replaced globe icon with octopus icon  
0.1.93 - Removed clone skill button and moved Add Custom Skill out of advanced mode  
0.1.87 - Added age-specific skill descriptions sourced from cheat sheets  
0.1.85 - Added skill description tooltips to the Builder and Character Sheet  
0.1.82 - Removed box styling from the Incidents of SAN Loss section  
0.1.81 - Removed clone button from Character Sheet Edit Mode  
0.1.78 - Extended Edit Mode with clone skill, add custom skill, and Unnatural +/- controls  
0.1.76 - Fixed formatting of Profession, Gender, and Nationality on the character sheet header  
0.1.74 - Fixed bond value colour incorrectly turning red when the value was lowered  
0.1.72 - Added Edit Mode to the Character Sheet with a pen icon toggle button  
0.1.70 - Hidden + and - buttons when printing the character sheet  
0.1.68 - Changed Adapted and Community badge colours from bright green to a subtle muted tone  
0.1.66 - Added nationality, bond tracking, Unnatural, disorders, Adapted, and BP editing to character creation  
0.1.63 - Added Play Mode button and view to the character sheet; removed print button from Play Mode  
0.1.62 - Added double-click inline editing for Backstory, Motivations, Gear & Weapons, and Bond Names  
0.1.60 - Removed the tickbox next to the Unnatural Skill on the character sheet  
0.1.57 - Added interactive HP, WP, and SAN editing to the Character Sheet  
0.1.55 - Removed repeating-linear-gradient background lines from the character sheet  
0.1.53 - Added Recovery SAN, Max SAN, two-column derived stats layout, and Incidents of SAN Loss  
0.1.52 - Sorted skills column by column on the Character Sheet  
0.1.50 - Added a settings cog with a Show All Skills toggle to the character sheet  
0.1.49 - Added Advanced Mode toggle for clone and custom skill controls  
0.1.47 - Added clone and custom skill functionality during character creation; fixed XSS in clone button  
0.1.45 - Added Distinguishing Features field to the character sheet and SKILL.md  
0.1.44 - Updated footer text to reference Cthulhu Eternal  
0.1.43 - Added credits and a link to the repository in the footer  
0.1.41 - Added Gender field to the identity form and character sheet; fixed Profession/Occupation formatting  
0.1.40 - Fixed boosted skill green colour override being incorrectly applied on the Character Sheet  
0.1.38 - Added a new Motivations and Gear step; displayed Backstory, Motivations, and Gear in three columns  
0.1.27 - Renamed Job to Profession/Occupation and Background to Backstory; added live field updates  
0.1.26 - Added ability to name typed skills (e.g. Art (Type)) during character creation  
0.1.25 - Styled checkboxes to match the page theme; added interactive checkboxes to resources and skills  
0.1.24 - Improved resources: removed /20 display, added At Hand/Stowed/In Storage labels and checkboxes  
0.1.23 - Added Resources Capacity Table to SKILL.md  
0.1.22 - Added damage bonus as a derived attribute per SKILL.md rules  
0.1.18 - Improved bonds: added type selection, derived values, and community bond improvements  
0.1.16 - Fixed full page re-render occurring on every keystroke in the name input box  
0.1.15 - Replaced Jazz Age and Modern Age skills and archetypes to match the issue specification  
0.1.11 - Removed gritty rules: deleted the Set the Tone step and Gritty Edges  
0.1.10 - Fixed character generation rules to match the SKILL.md specification  
0.1.9 - Added SKILL.md with the full Cthulhu Eternal character creation reference  
0.1.1 - Initial release of the Cthulhu Eternal Character Generator with all 6 steps implemented  

# Changelog

All notable changes are listed here from newest to oldest.

0.176 - fix: show original bond value in stage 4.5 reduction dropdown  
0.175 - Add screenshots section to README  
0.174 - Fix formatting issues in README.md  
0.173 - Enhance character sheet export options  
0.172 - Add mobile responsiveness to roadmap  
0.171 - Change bond reduction display from −n to 'reduced by n' in step 4.5  
0.170 - Enhance Cloudflare Web Analytics script section  
0.169 - feat: add Cloudflare Web Analytics snippet to index.html  
0.168 - fix: add .form-select CSS to style bond dropdowns on Upbringing Effects step  
0.167 - fix: resolve suite numbering conflict and add missing closing brace in validate-character-creation.mjs  
0.166 - feat: add mental disorders step for Harsh and Very Harsh upbringing  
0.165 - Remove screenshots from PR  
0.164 - Swap motivations and disorders layout on character sheet  
0.163 - Improve Copilot workspace instructions  
0.162 - Update README.md  
0.161 - Fix: clamp displayed attribute values to min 3 / max 18 (was 1–20)  
0.160 - Fix: RecoverySAN should use displayed (edited) POW, not base POW  
0.159 - Fix: SAN and BP should not change when POW is edited in attribute edit mode  
0.158 - Fix: BP should not change when POW is edited in attribute edit mode  
0.157 - Fix attribute edit bounds: clamp to min 3, max 18  
0.156 - Changes before error encountered  
0.155 - Reorganize README to highlight project access  
0.154 - Disallow community bond sacrifice when resources are sacrificed to 0  
0.153 - Address code review: add typeof check, simplify bonusSpent condition, clarify test comment  
0.152 - Add sacrifice toggles for Resources (set to 0) and community bonds (set to 1) for extra bonus picks  
0.151 - Add min-width: 260px to CSS tooltip so it actually renders wider  
0.150 - Double tooltip max-width from 220px to 440px  
0.149 - Fix Add Disorder tooltip: use data-tooltip instead of title attribute  
0.148 - Reorder character sheet sections: Bonds first, 2-col Disorders/Motivations and Backstory/Gear  
0.147 - Add 'What Else?' section to ROADMAP.md  
0.146 - Revise roadmap with new features and clarifications  
0.145 - Add ROADMAP.md with high level roadmap for Character Builder  
0.144 - fix: move minus button to right side of bond status badge in edit mode  
0.143 - fix: tooltip font/case and badge colour style  
0.142 - fix: capitalise tooltip text and add trailing periods  
0.141 - feat: add community bond status badge and tooltip based on rating  
0.140 - refactor: address code review - use constants, fix color variable  
0.139 - feat: add points-based attribute allocation mode  
0.138 - fix: revert checkout to v4 in update-changelog.yml (matches original, consistent with static.yml fix)  
0.137 - fix: revert checkout to v4 in static.yml (v5 previously broke Pages deploy)  
0.136 - fix: update GitHub Actions to resolve Node.js 20 deprecation warnings  
0.135 - Delete plan.md  
0.134 - Fix MaxSAN calculation and clamp SAN/RecoverySAN to MaxSAN  
0.133 - Initial plan  
0.132 - Add character creation validation tests and wire into CI  
0.131 - fix: reset violenceChecked, helplessnessChecked, editMode, showAllSkills on Start Over  
0.130 - Initial plan  
0.129 - Initial plan  
0.128 - Fix: reset resourcesEditAdjust and skillEditAdjust in resetState()  
0.127 - Export final HP/WP/SAN/BP/MaxSAN/RecoverySAN values in v2 format  
0.126 - Simplify JSON export to outcome-only v2 format  
0.125 - Add Import/Export character JSON feature with tests  
0.124 - Initial plan  
0.123 - Enhance copilot instructions with new sections  
0.122 - Add CHANGELOG.md with PR-based version entries from newest to oldest  
0.121 - Initial plan  
0.120 - Fix invalid actions/checkout@v5 to v4 in static.yml  
0.119 - Fix pages workflow: downgrade configure-pages to v5 and deploy-pages to v4  
0.118 - Initial plan  
0.117 - fix: update GitHub Actions to Node.js 24 compatible versions  
0.116 - Initial plan  
0.115 - Update Credits.md link to use full GitHub URL on main branch  
0.114 - Initial plan  
0.113 - Add test workflow to run validate-skill-parity.mjs on PRs and main  
0.112 - Initial plan  
0.111 - style: replace globe icon with octopus icon for cthulhueternal.com link  
0.110 - fix: replace broken OGL link with Wikipedia OGL page in Credits.md  
0.109 - Move Add Custom Skill out of advanced mode, remove advanced mode, use skill tooltip  
0.108 - fix: update DriveThruRPG link for Cthulhu Reborn in Credits.md  
0.107 - Remove clone skill button and functionality from the builder  
0.106 - feat: add Credits.md and Clear Credits footer link  
0.105 - Fixed invalid `actions/checkout` version in static workflow  
0.104 - Fixed GitHub Pages deployment workflow by downgrading actions versions  
0.100 - Updated GitHub Actions to use Node.js 24 compatible versions  
0.98 - Updated Credits.md link to use the full GitHub URL pointing to the main branch  
0.96 - Added GitHub Actions workflow to run skill parity validation tests on PRs and main  
0.94 - Added Credits.md file and a footer link to clear credits; replaced globe icon with octopus icon  
0.93 - Removed clone skill button and moved Add Custom Skill out of advanced mode  
0.87 - Added age-specific skill descriptions sourced from cheat sheets  
0.85 - Added skill description tooltips to the Builder and Character Sheet  
0.82 - Removed box styling from the Incidents of SAN Loss section  
0.81 - Removed clone button from Character Sheet Edit Mode  
0.78 - Extended Edit Mode with clone skill, add custom skill, and Unnatural +/- controls  
0.76 - Fixed formatting of Profession, Gender, and Nationality on the character sheet header  
0.74 - Fixed bond value colour incorrectly turning red when the value was lowered  
0.72 - Added Edit Mode to the Character Sheet with a pen icon toggle button  
0.70 - Hidden + and - buttons when printing the character sheet  
0.68 - Changed Adapted and Community badge colours from bright green to a subtle muted tone  
0.66 - Added nationality, bond tracking, Unnatural, disorders, Adapted, and BP editing to character creation  
0.63 - Added Play Mode button and view to the character sheet; removed print button from Play Mode  
0.62 - Added double-click inline editing for Backstory, Motivations, Gear & Weapons, and Bond Names  
0.60 - Removed the tickbox next to the Unnatural Skill on the character sheet  
0.57 - Added interactive HP, WP, and SAN editing to the Character Sheet  
0.55 - Removed repeating-linear-gradient background lines from the character sheet  
0.53 - Added Recovery SAN, Max SAN, two-column derived stats layout, and Incidents of SAN Loss  
0.52 - Sorted skills column by column on the Character Sheet  
0.50 - Added a settings cog with a Show All Skills toggle to the character sheet  
0.49 - Added Advanced Mode toggle for clone and custom skill controls  
0.47 - Added clone and custom skill functionality during character creation; fixed XSS in clone button  
0.45 - Added Distinguishing Features field to the character sheet and SKILL.md  
0.44 - Updated footer text to reference Cthulhu Eternal  
0.43 - Added credits and a link to the repository in the footer  
0.41 - Added Gender field to the identity form and character sheet; fixed Profession/Occupation formatting  
0.40 - Fixed boosted skill green colour override being incorrectly applied on the Character Sheet  
0.38 - Added a new Motivations and Gear step; displayed Backstory, Motivations, and Gear in three columns  
0.27 - Renamed Job to Profession/Occupation and Background to Backstory; added live field updates  
0.26 - Added ability to name typed skills (e.g. Art (Type)) during character creation  
0.25 - Styled checkboxes to match the page theme; added interactive checkboxes to resources and skills  
0.24 - Improved resources: removed /20 display, added At Hand/Stowed/In Storage labels and checkboxes  
0.23 - Added Resources Capacity Table to SKILL.md  
0.22 - Added damage bonus as a derived attribute per SKILL.md rules  
0.18 - Improved bonds: added type selection, derived values, and community bond improvements  
0.16 - Fixed full page re-render occurring on every keystroke in the name input box  
0.15 - Replaced Jazz Age and Modern Age skills and archetypes to match the issue specification  
0.11 - Removed gritty rules: deleted the Set the Tone step and Gritty Edges  
0.10 - Fixed character generation rules to match the SKILL.md specification  
0.9 - Added SKILL.md with the full Cthulhu Eternal character creation reference  
0.1 - Initial release of the Cthulhu Eternal Character Generator with all 6 steps implemented  

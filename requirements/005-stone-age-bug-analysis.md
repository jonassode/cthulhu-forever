# Requirement 005 – Stone Age Bug Analysis

## Status

Implemented: no

## Summary

This document records Stone Age-specific mismatches found by comparing the
current implementation against **Cthulhu Eternal – Stone Age Localization:
System Reference Document v1.6**. It is an analysis-only spec: no runtime code
or validation behavior is changed here.

## Findings

### REQ-1. Community Bonds round down instead of up

Implementation status:
Implemented: yes

SRD reference:
Section `2.8.2 Community Bonds` says a starting Community Bond "typically
begins with a default rating of half the Protagonist's Permanent Resources
rating, rounded up." Section `2.2.6 Step 5` also defines the starting value as
half the Resources rating.

Current implementation:
`js/app.js:708` calculates the base Community Bond with
`Math.floor(getEffectiveResources() / 2)`. The player-facing copy in
`js/app.js:2482` also describes Community Bonds as `Resources ÷ 2`, and the
current validation suite codifies the same behavior in
`scripts/validate-character-creation.mjs:1236-1237`.

Impact:
Any Stone Age or non-Stone-Age Community Bond built from an odd Resources value
starts 1 point lower than the SRD intends. Because the validation script
expects the rounded-down value, the mismatch is currently locked in by tests.

### REQ-2. Agricultural `Leader / Elder` special bond rule is missing

Implementation status:
Not implemented

SRD reference:
The `Leader / Elder` archetype says: "If Protagonist is from an agricultural
lifestyle, one of their bonds will be a Community Bond with a starting score of
12." Section `2.8.2 Community Bonds` further says fixed-rating archetype bonds
should use "either that value or half the Permanent Resources rating, whichever
is higher."

Current implementation:
The Stone Age archetype data in `js/data.js:6481-6510` only records
`resources: 5` and `bonds: 3`. There is no Stone Age `Leader / Elder`
special-case in bond setup or validation, and the generic bond flow in
`js/app.js:2478-2524` allows all three bonds to be created as personal bonds or
as lower-valued Community Bonds.

Impact:
Agricultural Stone Age leaders can be created without the required Community
Bond, and when a Community Bond is chosen it does not receive the SRD's fixed
minimum starting rating.

### REQ-3. `Other Tribe (Type)` is collapsed into an untyped `Other Tribe` skill

Implementation status:
Implemented: yes

SRD reference:
The skill description section names the skill `Other Tribe (Type)` with a base
rating of `0%`. Stone Age archetypes also use the typed form, including
`Leader / Elder`, `Scout / Pathfinder`, and `Shaman / Mystic`.

Current implementation:
The Stone Age skill table defines `Other Tribe` instead of
`Other Tribe (Type)` in `js/data.js:719` and `js/data.js:1439`. Stone Age
archetypes use the same untyped key in `js/data.js:6503`, `js/data.js:6523`,
and `js/data.js:6568`. Meanwhile, the type-substitution UI only activates for
skill names that literally contain `(Type)` in `js/app.js:161-165`.

Impact:
Players cannot record which outside tribe the skill applies to, cannot model
multiple separate tribe specializations, and lose the typed distinction the SRD
expects for Stone Age character sheets and saved data.

### REQ-4. Stone Age lifestyle timing and scope differ from the SRD

Implementation status:
Partially implemented with SRD divergence

SRD reference:
Section `2.2.1 Step 0` requires the group to establish lifestyle before the
rest of character creation and ties valid lifestyles and default upbringing
harshness to Paleolithic, Mesolithic, and Neolithic context.

Current implementation:
The app exposes only a single `stone` era and asks for lifestyle during Step 3,
after attributes and upbringing have already been chosen. This is enforced in
`js/app.js:1338-1344`, rendered in `js/app.js:2102-2173`, and validated in
`scripts/validate-character-creation.mjs:1774-1806`.

Impact:
The current flow cannot represent period-specific Stone Age restrictions such
as "Paleolithic is always hunter/gatherer" or the SRD's default harshness rules
for each sub-era. It also means Stone Age lifestyle does not actually guide the
upbringing step the way the SRD describes.

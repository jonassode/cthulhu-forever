# Cthulhu Eternal: Character Creation Reference

This document contains the core logic and data for creating Protagonists in the Cthulhu Eternal system. Use this as a schema/reference for character generation logic.

---

## 1. Core Statistics (Stats)

Protagonists have six core statistics.

| Stat | Name | Description |
|------|------|-------------|
| STR | Strength | Physical power. |
| CON | Constitution | Health and resilience. |
| DEX | Dexterity | Agility and coordination. |
| INT | Intelligence | Memory and reasoning. |
| POW | Power | Willpower and psychic resilience. |
| CHA | Charisma | Charm and leadership. |

**Generation:** Roll 4D6 (drop lowest) for each stat.

---

## 2. Derived Attributes

| Attribute | Calculation |
|-----------|-------------|
| Hit Points (HP) | `ceil((STR + CON) / 2)` |
| Willpower (WP) | `POW` |
| Sanity (SAN) | `POW × 5` (Normal) or `POW × 4` (Harsh/Very Harsh) |
| Breaking Point | `SAN - POW` |
| Damage Bonus | STR 1–4: −2; 5–8: −1; 9–12: 0; 13–16: +1; 17–18: +2 |

---

## 3. Upbringing & Adversity

Upbringing dictates starting skill modifiers and SAN.

| Upbringing | Stat Bonus | SAN | Adversity Skill Picks |
|------------|------------|-----|-----------------------|
| Normal(-ish) | None | `POW × 5` | 0 |
| Harsh | +1 to STR **or** CON | `POW × 4` | 1 pick (+20%) |
| Very Harsh | +1 to **both** STR and CON | `POW × 4` | 2 picks (+20%) |

> **Adversity Skills** can **only** be used to increase: First Aid, Military Training, Regional Lore, Survival.

---

## 4. Skills & Bonus Picks

Every Protagonist starts with **10 Bonus Picks**.

| Use | Effect |
|-----|--------|
| Standard | Each pick adds +20% to a skill (max 80% at character creation). |
| Resource | Sacrifice a Bonus Pick to increase Resources (see below). |
| Bond | Sacrifice a Bonus Pick to increase a Community Bond (see below). |

### Special Skills

- **Unnatural:** Base 0%. Cannot be increased with Bonus Picks.

---

## 5. Resources & Bonds

### Resources (Rating 0–20)

Starting value is defined by the Archetype:

| Starting Level | Resources Value |
|----------------|----------------|
| Poor | 5 |
| Average | 10 |
| Wealthy | 15 |

**Improving Resources with Bonus Picks:**

- **First Pick:** +5 to Resources.
- **Subsequent Picks:** +2 to Resources.
- **Hard Cap:** Resources cannot exceed 20 at character creation.

#### Resources Capacity Table

This table dictates how many items of significant cost/rarity a Protagonist can maintain.

| Resource Rating | At Hand / Stowed / In Storage | Check Boxes |
|-----------------|-------------------------------|-------------|
| 0               | 0 / 0 / 0                     | 0           |
| 1               | 1 / 0 / 0                     | 1           |
| 2               | 2 / 0 / 0                     | 1           |
| 3               | 3 / 0 / 0                     | 1           |
| 4               | 4 / 0 / 0                     | 1           |
| 5               | 5 / 0 / 0                     | 1           |
| 6               | 6 / 0 / 0                     | 1           |
| 7               | 6 / 1 / 0                     | 2           |
| 8               | 6 / 2 / 0                     | 2           |
| 9               | 6 / 3 / 0                     | 2           |
| 10              | 6 / 4 / 0                     | 2           |
| 11              | 6 / 5 / 0                     | 2           |
| 12              | 6 / 6 / 0                     | 2           |
| 13              | 6 / 6 / 1                     | 3           |
| 14              | 6 / 6 / 2                     | 3           |
| 15              | 6 / 6 / 3                     | 3           |
| 16              | 6 / 6 / 4                     | 3           |
| 17              | 6 / 6 / 5                     | 3           |
| 18              | 6 / 6 / 6                     | 3           |
| 19              | 6 / 6 / 7                     | 3           |
| 20+             | 6 / 6 / 8+                    | 3           |

### Bonds

Number of Bonds is defined by the Archetype.

| Bond Type | Starting Rating | Represents |
|-----------|----------------|------------|
| Individual Bond | CHA | Specific people. |
| Community Bond | `Resources / 2` | Organizations, churches, or neighborhoods. |

**Improving Community Bonds with Bonus Picks:**

- **First Pick:** +5 to a Community Bond.
- **Subsequent Picks:** +2 to a Community Bond.

> **Note:** Individual Bonds **cannot** be increased with Bonus Picks — they are tied to CHA.

/**
 * Shape Strikers - Game Configuration
 * A tactical auto-battler with elemental synergies
 */

// =============================================================================
// ELEMENTS & REACTIONS
// =============================================================================

export enum Element {
    FIRE = 'fire',
    ICE = 'ice',
    LIGHTNING = 'lightning',
    EARTH = 'earth',
    ARCANE = 'arcane',
    VOID = 'void'  // Enemy exclusive (unlockable after game completion)
}

// Element Synergies - bonuses for having multiple units of same element
interface ElementSynergy {
    element: Element;
    requiredCount: number;
    bonus: {
        stat: 'attack' | 'defense' | 'speed' | 'hp';
        multiplier: number;  // e.g., 1.2 = +20%
    };
    description: string;
}

export const ELEMENT_SYNERGIES: ElementSynergy[] = [
    { element: Element.FIRE, requiredCount: 2, bonus: { stat: 'attack', multiplier: 1.15 }, description: '2🔥: +15% ATK' },
    { element: Element.FIRE, requiredCount: 3, bonus: { stat: 'attack', multiplier: 1.30 }, description: '3🔥: +30% ATK' },
    { element: Element.ICE, requiredCount: 2, bonus: { stat: 'defense', multiplier: 1.15 }, description: '2🧊: +15% DEF' },
    { element: Element.ICE, requiredCount: 3, bonus: { stat: 'defense', multiplier: 1.30 }, description: '3🧊: +30% DEF' },
    { element: Element.LIGHTNING, requiredCount: 2, bonus: { stat: 'speed', multiplier: 1.20 }, description: '2⚡: +20% SPD' },
    { element: Element.LIGHTNING, requiredCount: 3, bonus: { stat: 'speed', multiplier: 1.40 }, description: '3⚡: +40% SPD' },
    { element: Element.EARTH, requiredCount: 2, bonus: { stat: 'hp', multiplier: 1.20 }, description: '2🌍: +20% HP' },
    { element: Element.EARTH, requiredCount: 3, bonus: { stat: 'hp', multiplier: 1.40 }, description: '3🌍: +40% HP' },
    { element: Element.ARCANE, requiredCount: 2, bonus: { stat: 'attack', multiplier: 1.10 }, description: '2✨: +10% ATK' },
    { element: Element.ARCANE, requiredCount: 3, bonus: { stat: 'speed', multiplier: 1.25 }, description: '3✨: +25% SPD' },
    { element: Element.VOID, requiredCount: 2, bonus: { stat: 'attack', multiplier: 1.25 }, description: '2🕳️: +25% ATK' },
    { element: Element.VOID, requiredCount: 3, bonus: { stat: 'hp', multiplier: 1.20 }, description: '3🕳️: +20% HP' },
];

// =============================================================================
// UPGRADES SYSTEM
// =============================================================================

export interface Upgrade {
    id: string;
    name: string;
    description: string;
    cost: number;
    maxLevel: number;
    effect: {
        type: 'maxUnits' | 'shopRefresh' | 'goldPerWave' | 'interestRate' | 'healingRate' | 'refreshesPerRound';
        value: number;  // Added per level
    };
}

export const UPGRADES: Upgrade[] = [
    {
        id: 'army_expansion',
        name: '🏰 Army Expansion',
        description: '+1 max unit slot',
        cost: 8,
        maxLevel: 5,
        effect: { type: 'maxUnits', value: 1 }
    },
    {
        id: 'field_medic',
        name: '💚 Field Medic',
        description: '+15% post-battle healing',
        cost: 5,
        maxLevel: 3,
        effect: { type: 'healingRate', value: 0.15 }
    },
    {
        id: 'bargain_hunter',
        name: 'Hovs Handouts',
        description: '-1 shop refresh cost',
        cost: 4,
        maxLevel: 2,
        effect: { type: 'shopRefresh', value: -1 }
    },
    {
        id: 'war_chest',
        name: '📈 War Chest',
        description: '+10% interest on gold (max 5g)',
        cost: 6,
        maxLevel: 3,
        effect: { type: 'interestRate', value: 0.1 }
    },
    {
        id: 'victory_bonus',
        name: '🏆 Victory Bonus',
        description: '+2 gold per wave won',
        cost: 5,
        maxLevel: 3,
        effect: { type: 'goldPerWave', value: 2 }
    },
    {
        id: 'refresh_master',
        name: '🔄 Refresh Master',
        description: '+1 refresh per round',
        cost: 6,
        maxLevel: 2,
        effect: { type: 'refreshesPerRound', value: 1 }
    }
];

// =============================================================================
// UNIT DEFINITIONS
// =============================================================================

export interface UnitStats {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;  // Determines action order
    range: number;  // Attack range in tiles (1 = melee)
}

export interface UnitDefinition {
    id: string;
    name: string;
    element: Element;
    cost: number;
    tier: 1 | 2 | 3 | 4;  // Rarity/power tier (4 = boss)
    stats: UnitStats;
    ability: {
        name: string;
        description: string;
        cooldown: number;  // Turns between uses
        healAmount?: number;  // For healer units
        freezeDuration?: number;  // How many turns freeze lasts (default 1)
        maxTargets?: number;  // For limited AoE abilities
    };
    sprite: {
        path: string;
        frameWidth: number;
        frameHeight: number;
        scale: number;
        idleFrames: number;
        attackFrames: number;
    };
    visual?: {
        color: string;   // Body color: red, blue, green, yellow, purple, orange, cyan, pink, white, dark
        shape: string;   // Body shape: circle, rhombus, square, squircle, triangle, hexagon, star, pentagon, oval
    };
    isBoss?: boolean;  // Boss units have special mechanics
    isVoid?: boolean;  // Void units - enemy exclusive (unlockable after game completion)
    bossPhases?: BossPhase[];  // Multi-phase boss mechanics
}

// Boss phase definitions for epic boss fights
export interface BossPhase {
    hpThreshold: number;  // Trigger when HP drops below this percentage (0.0-1.0)
    phaseHp?: number;     // Optional: If set, boss gets this much HP for this phase (3-bar system)
    name: string;
    statModifiers: {
        attackMult?: number;
        defenseMult?: number;
        speedMult?: number;
    };
    specialAbility?: string;
    description: string;
}

// Chaos Overlord phases for wave 15 - 3 SEPARATE HEALTH BARS
const CHAOS_OVERLORD_PHASES: BossPhase[] = [
    {
        hpThreshold: 1.0,
        phaseHp: 300,  // Phase 1: 300 HP
        name: 'Awakening',
        statModifiers: {},
        specialAbility: 'Elemental Shield',
        description: 'The Chaos Overlord awakens with an elemental shield!'
    },
    {
        hpThreshold: 0.66,
        phaseHp: 350,  // Phase 2: 350 HP
        name: 'Corruption',
        statModifiers: { attackMult: 1.3, speedMult: 1.2 },
        specialAbility: 'Void Corruption',
        description: 'Phase 2: CORRUPTION! (+30% ATK, +20% SPD)'
    },
    {
        hpThreshold: 0.33,
        phaseHp: 400,  // Phase 3: 400 HP (total across phases: 1050 HP)
        name: 'Cataclysm',
        statModifiers: { attackMult: 1.6, speedMult: 1.5, defenseMult: 0.7 },
        specialAbility: 'Elemental Cataclysm',
        description: 'FINAL PHASE: CATACLYSM! Full power unleashed!'
    }
];

// Flame Tyrant phases for wave 5
const FLAME_TYRANT_PHASES: BossPhase[] = [
    {
        hpThreshold: 1.0,
        name: 'Burning Fury',
        statModifiers: {},
        description: 'The Flame Tyrant burns with fury!'
    },
    {
        hpThreshold: 0.5,
        name: 'Inferno',
        statModifiers: { attackMult: 1.4 },
        description: 'ENRAGED! Attack increased by 40%!'
    }
];

// Frost Colossus phases for wave 10
const FROST_COLOSSUS_PHASES: BossPhase[] = [
    {
        hpThreshold: 1.0,
        name: 'Frozen Fortress',
        statModifiers: {},
        description: 'The Frost Colossus raises its icy defenses!'
    },
    {
        hpThreshold: 0.5,
        name: 'Glacier\'s Wrath',
        statModifiers: { defenseMult: 1.5, speedMult: 0.8 },
        description: 'FORTIFIED! Defense increased by 50%!'
    }
];

// =============================================================================
// UNIT DEFINITIONS
// =============================================================================
// CONVENTION: Unit IDs and display names MUST match!
// Format: id: 'element_role' → name: 'Element Role' (Title Case)
// Examples:
//   id: 'fire_imp'     → name: 'Fire Imp'
//   id: 'ice_guardian' → name: 'Ice Guardian'
// This ensures face mappings, ability cases, and wave references stay in sync.
// =============================================================================

export const UNIT_DEFINITIONS: UnitDefinition[] = [
    // ===== TIER 1 (Cost: 1-2) =====
    {
        id: 'fire_imp',
        name: 'Fire Imp',
        element: Element.FIRE,
        cost: 1,
        tier: 1,
        visual: { color: 'red', shape: 'circle' },
        stats: { hp: 80, maxHp: 80, attack: 15, defense: 5, speed: 8, range: 1 },  // Melee
        ability: {
            name: 'Ember Strike',
            description: 'Deals fire damage and applies burn',
            cooldown: 2
        },
        sprite: {
            path: 'characters/demon_imp',
            frameWidth: 64,
            frameHeight: 64,
            scale: 1.5,
            idleFrames: 4,
            attackFrames: 6
        }
    },
    {
        id: 'ice_slime',
        name: 'Ice Slime',
        element: Element.ICE,
        cost: 1,
        tier: 1,
        visual: { color: 'blue', shape: 'circle' },
        stats: { hp: 100, maxHp: 100, attack: 10, defense: 8, speed: 4, range: 1 },  // Tanky melee
        ability: {
            name: 'Frost Coat',
            description: 'Slows nearby enemies',
            cooldown: 3
        },
        sprite: {
            path: 'characters/slime_blue',
            frameWidth: 32,
            frameHeight: 32,
            scale: 2.5,
            idleFrames: 8,
            attackFrames: 8
        }
    },
    {
        id: 'earth_golem',
        name: 'Earth Golem',
        element: Element.EARTH,
        cost: 2,
        tier: 1,
        visual: { color: 'green', shape: 'square' },
        stats: { hp: 150, maxHp: 150, attack: 12, defense: 15, speed: 2, range: 1 },  // Tank
        ability: {
            name: 'Stone Skin',
            description: 'Reduces damage taken for 2 turns',
            cooldown: 4
        },
        sprite: {
            path: 'characters/forest_guard',
            frameWidth: 64,
            frameHeight: 64,
            scale: 1.2,
            idleFrames: 6,
            attackFrames: 6
        }
    },
    {
        id: 'lightning_sprite',
        name: 'Lightning Sprite',
        element: Element.LIGHTNING,
        cost: 2,
        tier: 1,
        visual: { color: 'yellow', shape: 'star' },
        stats: { hp: 60, maxHp: 60, attack: 18, defense: 3, speed: 12, range: 2 },  // Short ranged
        ability: {
            name: 'Chain Lightning',
            description: 'Bounces to 2 additional targets',
            cooldown: 3
        },
        sprite: {
            path: 'characters/wisp',
            frameWidth: 32,
            frameHeight: 32,
            scale: 2,
            idleFrames: 4,
            attackFrames: 4
        }
    },
    {
        id: 'earth_archer',
        name: 'Earth Archer',
        element: Element.EARTH,
        cost: 2,
        tier: 1,
        visual: { color: 'green', shape: 'triangle' },
        stats: { hp: 90, maxHp: 90, attack: 14, defense: 10, speed: 5, range: 2 },  // Ranged with defense
        ability: {
            name: 'Boulder Toss',
            description: 'Stuns target for 1 turn',
            cooldown: 3
        },
        sprite: {
            path: 'characters/witch',
            frameWidth: 32,
            frameHeight: 32,
            scale: 2.8,
            idleFrames: 6,
            attackFrames: 6
        }
    },
    {
        id: 'fire_scout',
        name: 'Fire Scout',
        element: Element.FIRE,
        cost: 1,
        tier: 1,
        visual: { color: 'orange', shape: 'triangle' },
        stats: { hp: 65, maxHp: 65, attack: 12, defense: 4, speed: 10, range: 2 },  // Fast ranged
        ability: {
            name: 'Fire Bolt',
            description: 'Quick ranged attack with minor burn',
            cooldown: 2
        },
        sprite: {
            path: 'characters/huntress',
            frameWidth: 100,
            frameHeight: 100,
            scale: 0.9,
            idleFrames: 8,
            attackFrames: 6
        }
    },

    // ===== TIER 2 (Cost: 3-4) =====
    {
        id: 'fire_warrior',
        name: 'Fire Warrior',
        element: Element.FIRE,
        cost: 3,
        tier: 2,
        visual: { color: 'red', shape: 'squircle' },
        stats: { hp: 180, maxHp: 180, attack: 25, defense: 12, speed: 6, range: 1 },  // Melee warrior
        ability: {
            name: 'Blazing Charge',
            description: 'Dash attack, damages all in path',
            cooldown: 3
        },
        sprite: {
            path: 'characters/fantasy_warrior',
            frameWidth: 162,
            frameHeight: 162,
            scale: 0.8,
            idleFrames: 6,
            attackFrames: 6
        }
    },
    {
        id: 'ice_archer',
        name: 'Ice Archer',
        element: Element.ICE,
        cost: 3,
        tier: 2,
        visual: { color: 'blue', shape: 'hexagon' },
        stats: { hp: 120, maxHp: 120, attack: 22, defense: 8, speed: 9, range: 3 },  // Long ranged sniper
        ability: {
            name: 'Frost Arrow',
            description: 'Piercing shot that freezes target',
            cooldown: 2
        },
        sprite: {
            path: 'characters/huntress',
            frameWidth: 100,
            frameHeight: 100,
            scale: 1.0,
            idleFrames: 8,
            attackFrames: 6
        }
    },
    {
        id: 'arcane_mage',
        name: 'Arcane Mage',
        element: Element.ARCANE,
        cost: 4,
        tier: 2,
        visual: { color: 'purple', shape: 'hexagon' },
        stats: { hp: 100, maxHp: 100, attack: 30, defense: 5, speed: 7, range: 2 },  // Mid ranged mage
        ability: {
            name: 'Arcane Blast',
            description: 'High damage magic attack',
            cooldown: 2
        },
        sprite: {
            path: 'characters/witch',
            frameWidth: 32,
            frameHeight: 32,
            scale: 3.0,
            idleFrames: 6,
            attackFrames: 6
        }
    },
    {
        id: 'lightning_knight',
        name: 'Lightning Knight',
        element: Element.LIGHTNING,
        cost: 3,
        tier: 2,
        visual: { color: 'yellow', shape: 'hexagon' },
        stats: { hp: 160, maxHp: 160, attack: 20, defense: 14, speed: 8, range: 1 },  // Fast tank
        ability: {
            name: 'Thunder Strike',
            description: 'Stuns target and deals bonus damage',
            cooldown: 3
        },
        sprite: {
            path: 'characters/fantasy_warrior',
            frameWidth: 162,
            frameHeight: 162,
            scale: 0.75,
            idleFrames: 6,
            attackFrames: 6
        }
    },
    {
        id: 'ice_guardian',
        name: 'Ice Guardian',
        element: Element.ICE,
        cost: 4,
        tier: 2,
        visual: { color: 'cyan', shape: 'square' },
        stats: { hp: 200, maxHp: 200, attack: 15, defense: 18, speed: 3, range: 1 },  // Heavy tank
        ability: {
            name: 'Frozen Wall',
            description: 'Shields self and slows attackers',
            cooldown: 4
        },
        sprite: {
            path: 'characters/forest_guard',
            frameWidth: 64,
            frameHeight: 64,
            scale: 1.4,
            idleFrames: 6,
            attackFrames: 6
        }
    },
    {
        id: 'arcane_assassin',
        name: 'Arcane Assassin',
        element: Element.ARCANE,
        cost: 3,
        tier: 2,
        visual: { color: 'purple', shape: 'triangle' },
        stats: { hp: 85, maxHp: 85, attack: 35, defense: 4, speed: 11, range: 1 },  // Glass cannon
        ability: {
            name: 'Shadow Strike',
            description: 'Critical hit with bonus damage',
            cooldown: 2
        },
        sprite: {
            path: 'characters/martial_hero',
            frameWidth: 126,
            frameHeight: 126,
            scale: 0.9,
            idleFrames: 6,
            attackFrames: 8
        }
    },

    // ===== TIER 3 (Cost: 5) =====
    {
        id: 'fire_demon',
        name: 'Fire Demon',
        element: Element.FIRE,
        cost: 5,
        tier: 3,
        visual: { color: 'red', shape: 'star' },
        stats: { hp: 200, maxHp: 200, attack: 30, defense: 12, speed: 5, range: 2 },  // Nerfed
        ability: {
            name: 'Hellfire',
            description: 'Fire damage to up to 3 enemies in range',
            cooldown: 4,
            maxTargets: 3  // Limited AoE
        },
        sprite: {
            path: 'characters/evil_wizard',
            frameWidth: 128,
            frameHeight: 128,
            scale: 1.0,
            idleFrames: 8,
            attackFrames: 8
        }
    },
    {
        id: 'martial_master',
        name: 'Martial Master',
        element: Element.EARTH,
        cost: 5,
        tier: 3,
        visual: { color: 'green', shape: 'rhombus' },
        stats: { hp: 280, maxHp: 280, attack: 35, defense: 20, speed: 8, range: 1 },  // Melee master
        ability: {
            name: 'Thousand Fists',
            description: 'Multiple rapid strikes',
            cooldown: 3
        },
        sprite: {
            path: 'characters/martial_hero',
            frameWidth: 126,
            frameHeight: 126,
            scale: 1.0,
            idleFrames: 6,
            attackFrames: 8
        }
    },
    {
        id: 'lightning_lord',
        name: 'Lightning Lord',
        element: Element.LIGHTNING,
        cost: 5,
        tier: 3,
        visual: { color: 'yellow', shape: 'pentagon' },
        stats: { hp: 180, maxHp: 180, attack: 45, defense: 10, speed: 10, range: 3 },  // Fast ranged DPS
        ability: {
            name: 'Thunder Storm',
            description: 'Hits all enemies with chain lightning',
            cooldown: 4
        },
        sprite: {
            path: 'characters/evil_wizard',
            frameWidth: 128,
            frameHeight: 128,
            scale: 1.1,
            idleFrames: 8,
            attackFrames: 8
        }
    },
    {
        id: 'ice_empress',
        name: 'Ice Empress',
        element: Element.ICE,
        cost: 5,
        tier: 3,
        visual: { color: 'white', shape: 'rhombus' },
        stats: { hp: 220, maxHp: 220, attack: 32, defense: 16, speed: 6, range: 3 },  // Control mage
        ability: {
            name: 'Blizzard',
            description: 'Freezes and damages all enemies',
            cooldown: 5
        },
        sprite: {
            path: 'characters/witch',
            frameWidth: 32,
            frameHeight: 32,
            scale: 3.5,
            idleFrames: 6,
            attackFrames: 6
        }
    },
    
    // ===== SUPPORT/HEALER UNITS =====
    {
        id: 'frost_fairy',
        name: 'Frost Fairy',
        element: Element.ICE,
        cost: 2,
        tier: 1,
        visual: { color: 'cyan', shape: 'oval' },
        stats: { hp: 70, maxHp: 70, attack: 8, defense: 6, speed: 7, range: 2 },  // Healer
        ability: {
            name: 'Healing Frost',
            description: 'Heals lowest HP ally for 25 HP',
            cooldown: 2,
            healAmount: 25
        },
        sprite: {
            path: 'characters/wisp',
            frameWidth: 32,
            frameHeight: 32,
            scale: 2,
            idleFrames: 4,
            attackFrames: 4
        }
    },
    {
        id: 'nature_spirit',
        name: 'Nature Spirit',
        element: Element.EARTH,
        cost: 3,
        tier: 2,
        visual: { color: 'green', shape: 'oval' },
        stats: { hp: 120, maxHp: 120, attack: 10, defense: 12, speed: 5, range: 2 },  // Tank healer
        ability: {
            name: 'Rejuvenate',
            description: 'Heals all allies for 15 HP',
            cooldown: 3,
            healAmount: 15
        },
        sprite: {
            path: 'characters/forest_guard',
            frameWidth: 64,
            frameHeight: 64,
            scale: 1.2,
            idleFrames: 6,
            attackFrames: 6
        }
    },
    {
        id: 'arcane_priest',
        name: 'Arcane Priest',
        element: Element.ARCANE,
        cost: 4,
        tier: 2,
        visual: { color: 'purple', shape: 'oval' },
        stats: { hp: 100, maxHp: 100, attack: 15, defense: 8, speed: 6, range: 3 },  // Ranged healer
        ability: {
            name: 'Arcane Restoration',
            description: 'Heals ally for 25 HP + shields',
            cooldown: 2,
            healAmount: 25
        },
        sprite: {
            path: 'characters/evil_wizard',
            frameWidth: 128,
            frameHeight: 128,
            scale: 0.8,
            idleFrames: 8,
            attackFrames: 8
        }
    },
    {
        id: 'life_guardian',
        name: 'Life Guardian',
        element: Element.EARTH,
        cost: 5,
        tier: 3,
        visual: { color: 'green', shape: 'star' },
        stats: { hp: 200, maxHp: 200, attack: 12, defense: 18, speed: 4, range: 2 },  // Tank healer
        ability: {
            name: 'Guardian\'s Blessing',
            description: 'Heals all allies 30 HP + barrier',
            cooldown: 4,
            healAmount: 30
        },
        sprite: {
            path: 'characters/martial_hero',
            frameWidth: 126,
            frameHeight: 126,
            scale: 1.0,
            idleFrames: 6,
            attackFrames: 8
        }
    },
    
    // ===== BLOODTEARS FACTION (Lifesteal) =====
    {
        id: 'blood_sprite',
        name: 'Blood Sprite',
        element: Element.FIRE,
        cost: 2,
        tier: 1,
        visual: { color: 'pink', shape: 'circle' },
        stats: { hp: 75, maxHp: 75, attack: 14, defense: 5, speed: 7, range: 1 },  // Melee lifesteal
        ability: {
            name: 'Drain Touch',
            description: 'Drains enemy HP, healing self for 40% of damage',
            cooldown: 2
        },
        sprite: {
            path: 'characters/demon_imp',
            frameWidth: 64,
            frameHeight: 64,
            scale: 1.5,
            idleFrames: 4,
            attackFrames: 6
        }
    },
    {
        id: 'blood_knight',
        name: 'Blood Knight',
        element: Element.FIRE,
        cost: 4,
        tier: 2,
        visual: { color: 'pink', shape: 'hexagon' },
        stats: { hp: 170, maxHp: 170, attack: 24, defense: 10, speed: 6, range: 1 },  // AoE lifesteal warrior
        ability: {
            name: 'Crimson Cleave',
            description: 'Cleaves target + adjacent enemies, heals 30% of total damage',
            cooldown: 3,
            maxTargets: 3
        },
        sprite: {
            path: 'characters/fantasy_warrior',
            frameWidth: 162,
            frameHeight: 162,
            scale: 0.8,
            idleFrames: 6,
            attackFrames: 6
        }
    },

    // ===== KONJI FACTION (Poison) =====
    {
        id: 'konji_scout',
        name: 'Konji Scout',
        element: Element.EARTH,
        cost: 2,
        tier: 1,
        visual: { color: 'dark', shape: 'pentagon' },
        stats: { hp: 70, maxHp: 70, attack: 12, defense: 6, speed: 8, range: 2 },  // Ranged poison
        ability: {
            name: 'Toxic Dart',
            description: 'Ranged attack that poisons target for 3 turns',
            cooldown: 2
        },
        sprite: {
            path: 'characters/huntress',
            frameWidth: 100,
            frameHeight: 100,
            scale: 0.9,
            idleFrames: 8,
            attackFrames: 6
        }
    },
    {
        id: 'konji_shaman',
        name: 'Konji Shaman',
        element: Element.EARTH,
        cost: 4,
        tier: 2,
        visual: { color: 'dark', shape: 'hexagon' },
        stats: { hp: 130, maxHp: 130, attack: 18, defense: 9, speed: 5, range: 2 },  // AoE poison mage
        ability: {
            name: 'Plague Cloud',
            description: 'Poisons all enemies for 2 turns + minor damage',
            cooldown: 4
        },
        sprite: {
            path: 'characters/witch',
            frameWidth: 32,
            frameHeight: 32,
            scale: 3.0,
            idleFrames: 6,
            attackFrames: 6
        }
    },

    // ===== BOSS UNITS (Wave 5, 10, 15) =====
    {
        id: 'boss_flame_tyrant',
        name: '🔥 FLAME TYRANT',
        element: Element.FIRE,
        cost: 0,  // Enemy only
        tier: 4,
        visual: { color: 'orange', shape: 'star' },
        stats: { hp: 425, maxHp: 425, attack: 32, defense: 14, speed: 5, range: 2 },  // Nerfed
        ability: {
            name: 'Tyrant\'s Wrath',
            description: 'AoE fire damage to all enemies',
            cooldown: 4
        },
        sprite: {
            path: 'characters/evil_wizard',
            frameWidth: 128,
            frameHeight: 128,
            scale: 1.5,  // Larger than normal
            idleFrames: 8,
            attackFrames: 8
        },
        isBoss: true,
        bossPhases: FLAME_TYRANT_PHASES
    },
    {
        id: 'boss_frost_colossus',
        name: '🧊 FROST COLOSSUS',
        element: Element.ICE,
        cost: 0,  // Enemy only
        tier: 4,
        visual: { color: 'cyan', shape: 'star' },
        stats: { hp: 675, maxHp: 675, attack: 30, defense: 22, speed: 3, range: 2 },  // Nerfed HP
        ability: {
            name: 'Absolute Zero',
            description: 'Freezes all enemies for 2 turns + self-heal 80 HP',
            cooldown: 5,
            freezeDuration: 2,
            healAmount: 80    // Nerfed healing
        },
        sprite: {
            path: 'characters/evil_wizard',
            frameWidth: 128,
            frameHeight: 128,
            scale: 1.8,  // Even larger
            idleFrames: 8,
            attackFrames: 8
        },
        isBoss: true,
        bossPhases: FROST_COLOSSUS_PHASES
    },
    {
        id: 'boss_chaos_overlord',
        name: '⚡ CHAOS OVERLORD',
        element: Element.ARCANE,
        cost: 0,  // Enemy only
        tier: 4,
        visual: { color: 'purple', shape: 'star' },
        stats: { hp: 300, maxHp: 300, attack: 35, defense: 15, speed: 6, range: 3 },  // Phase 1 HP pool
        ability: {
            name: 'Elemental Cataclysm',
            description: 'Unleashes all elements + enrage at low HP',
            cooldown: 4
        },
        sprite: {
            path: 'characters/evil_wizard',
            frameWidth: 128,
            frameHeight: 128,
            scale: 2.0,  // Massive final boss
            idleFrames: 8,
            attackFrames: 8
        },
        isBoss: true,
        bossPhases: CHAOS_OVERLORD_PHASES
    },
    
    // ===== VOID UNITS (Enemy Exclusive - Unlockable after completion) =====
    {
        id: 'void_shade',
        name: 'Void Shade',
        element: Element.VOID,
        cost: 2,  // Enemy use / unlockable
        tier: 1,
        visual: { color: 'dark', shape: 'circle' },
        stats: { hp: 60, maxHp: 60, attack: 18, defense: 3, speed: 10, range: 1 },
        ability: {
            name: 'Shadow Phase',
            description: 'Becomes untargetable for 1 turn',
            cooldown: 3
        },
        sprite: {
            path: 'characters/wisp',
            frameWidth: 32,
            frameHeight: 32,
            scale: 2,
            idleFrames: 4,
            attackFrames: 4
        },
        isVoid: true  // Marks as enemy-exclusive (unlockable)
    },
    {
        id: 'void_knight',
        name: 'Void Knight',
        element: Element.VOID,
        cost: 3,
        tier: 2,
        visual: { color: 'dark', shape: 'squircle' },
        stats: { hp: 180, maxHp: 180, attack: 28, defense: 10, speed: 6, range: 1 },
        ability: {
            name: 'Corruption Strike',
            description: 'Deals bonus damage and weakens target',
            cooldown: 3
        },
        sprite: {
            path: 'characters/fantasy_warrior',
            frameWidth: 162,
            frameHeight: 162,
            scale: 0.85,
            idleFrames: 6,
            attackFrames: 6
        },
        isVoid: true
    },
    {
        id: 'void_horror',
        name: 'Void Horror',
        element: Element.VOID,
        cost: 5,
        tier: 3,
        visual: { color: 'dark', shape: 'rhombus' },
        stats: { hp: 300, maxHp: 300, attack: 38, defense: 12, speed: 4, range: 2 },
        ability: {
            name: 'Void Rupture',
            description: 'AoE dark damage that ignores defense',
            cooldown: 4
        },
        sprite: {
            path: 'characters/evil_wizard',
            frameWidth: 128,
            frameHeight: 128,
            scale: 1.2,
            idleFrames: 8,
            attackFrames: 8
        },
        isVoid: true
    },
    // === COUNTER-HEALER UNIT ===
    {
        id: 'void_blighter',
        name: 'Void Blighter',
        element: Element.VOID,
        cost: 4,
        tier: 2,
        visual: { color: 'dark', shape: 'triangle' },
        stats: { hp: 160, maxHp: 160, attack: 25, defense: 8, speed: 6, range: 2 },
        ability: {
            name: 'Cursed Wound',
            description: 'Applies Wound to enemies, reducing healing by 50%',
            cooldown: 3
        },
        sprite: {
            path: 'characters/zombie',
            frameWidth: 64,
            frameHeight: 64,
            scale: 1.4,
            idleFrames: 4,
            attackFrames: 4
        },
        isVoid: true
    }
];

// =============================================================================
// GRID & GAME SETTINGS
// =============================================================================

export const GRID_CONFIG = {
    cols: 6,
    rows: 5,
    tileSize: 90,
    // Player places units in bottom 2 rows (rows 3-4)
    playerZoneRows: 2,
    // Enemy spawns in top 2 rows (rows 0-1)
    enemyZoneRows: 2,
    // Battle line row where units meet (row 2)
    battleLineRow: 2,
    offsetX: 270,  // Centered in playable area (left of shop panel)
    offsetY: 80
};

// =============================================================================
// MAP LAYOUTS
// =============================================================================

export interface MapLayout {
    id: string;
    name: string;
    description: string;
}

// Simplified map - no obstacles in lane-based combat
export const MAP_LAYOUTS: MapLayout[] = [
    {
        id: 'arena',
        name: 'Battle Arena',
        description: 'Classic arena - units meet at the battle line'
    }
];

export const GAME_CONFIG = {
    width: 1280,
    height: 720,
    startingGold: 10,
    goldPerWave: 7,   // Increased from 6 for smoother economy
    maxUnits: 7,      // Base max units (upgradeable to 12 via Army Expansion)
    shopSize: 5,      // Units offered per shop refresh
    shopRefreshCost: 2,       // Base refresh cost
    refreshCostPerWave: 1,    // Additional cost per wave (scaling economy)
    maxRefreshCost: 3,        // Cap for scaled refresh cost (nerfed from 5)
    maxRefreshesPerRound: 1,  // Base refreshes allowed per round (upgradeable to 3)
    sellRefundPercent: 0.5,
    minSellValue: 1,  // Minimum gold from selling any unit
    waveCount: 15,
    battleSpeed: 1.0, // Animation speed multiplier
    interestRate: 0,  // Base interest rate (upgradeable)
    maxInterest: 5,   // Max gold from interest per round
    healingRate: 0.25 // Base post-battle healing (25% of max HP, upgradeable)
};

// =============================================================================
// WAVE DEFINITIONS
// =============================================================================

interface WaveEnemy {
    unitId: string;
    count: number;
    row?: number;  // Preferred spawn row (0-2 for enemy zone)
}

export interface WaveDefinition {
    waveNumber: number;
    enemies: WaveEnemy[];
    bonusGold: number;
}

export const WAVES: WaveDefinition[] = [
    {
        waveNumber: 1,
        enemies: [
            { unitId: 'fire_imp', count: 2 },
            { unitId: 'ice_slime', count: 1 }
        ],
        bonusGold: 4
    },
    {
        waveNumber: 2,
        enemies: [
            { unitId: 'fire_imp', count: 2 },
            { unitId: 'ice_slime', count: 2 },
            { unitId: 'lightning_sprite', count: 1 }
        ],
        bonusGold: 5
    },
    {
        waveNumber: 3,
        enemies: [
            { unitId: 'earth_golem', count: 2 },
            { unitId: 'fire_imp', count: 2 },
            { unitId: 'void_shade', count: 1 }  // First void unit appearance!
        ],
        bonusGold: 6
    },
    {
        waveNumber: 4,
        enemies: [
            { unitId: 'fire_warrior', count: 1 },
            { unitId: 'ice_slime', count: 2 },
            { unitId: 'void_shade', count: 2 },
            { unitId: 'lightning_sprite', count: 1 }
        ],
        bonusGold: 6
    },
    {
        waveNumber: 5,
        enemies: [
            { unitId: 'boss_flame_tyrant', count: 1 },  // BOSS WAVE!
            { unitId: 'fire_imp', count: 3 }
        ],
        bonusGold: 15
    },
    {
        waveNumber: 6,
        enemies: [
            { unitId: 'void_knight', count: 1 },  // Void knight debut
            { unitId: 'blood_sprite', count: 1 },  // Bloodtears debut!
            { unitId: 'void_shade', count: 2 },
            { unitId: 'fire_imp', count: 2 }
        ],
        bonusGold: 12
    },
    {
        waveNumber: 7,
        enemies: [
            { unitId: 'arcane_mage', count: 2 },
            { unitId: 'konji_scout', count: 2 },  // Konji debut!
            { unitId: 'lightning_sprite', count: 2 },
            { unitId: 'ice_archer', count: 1 },
            { unitId: 'void_shade', count: 1 }
        ],
        bonusGold: 10
    },
    {
        waveNumber: 8,
        enemies: [
            { unitId: 'void_blighter', count: 1 },  // Counter-healer debut!
            { unitId: 'blood_sprite', count: 2 },  // Bloodtears lifesteal
            { unitId: 'void_knight', count: 2 },
            { unitId: 'fire_warrior', count: 1 },
            { unitId: 'earth_golem', count: 1 }
        ],
        bonusGold: 12
    },
    {
        waveNumber: 9,
        enemies: [
            { unitId: 'martial_master', count: 1 },
            { unitId: 'void_horror', count: 1 },  // Void horror debut
            { unitId: 'void_knight', count: 2 },
            { unitId: 'ice_archer', count: 2 }
        ],
        bonusGold: 14
    },
    {
        waveNumber: 10,
        enemies: [
            { unitId: 'boss_frost_colossus', count: 1 },  // BOSS WAVE!
            { unitId: 'ice_slime', count: 3 },
            { unitId: 'ice_archer', count: 2 },
            { unitId: 'frost_fairy', count: 1 }  // Healer support
        ],
        bonusGold: 25
    },
    {
        waveNumber: 11,
        enemies: [
            { unitId: 'void_horror', count: 1 },
            { unitId: 'blood_knight', count: 1 },  // Bloodtears T2 debut
            { unitId: 'void_blighter', count: 1 },  // Counter-healer
            { unitId: 'void_knight', count: 2 },
            { unitId: 'fire_demon', count: 1 },
            { unitId: 'void_shade', count: 2 }
        ],
        bonusGold: 15
    },
    {
        waveNumber: 12,
        enemies: [
            { unitId: 'martial_master', count: 2 },
            { unitId: 'konji_shaman', count: 1 },  // Konji T2 debut
            { unitId: 'lightning_lord', count: 1 },
            { unitId: 'void_knight', count: 2 },
            { unitId: 'konji_scout', count: 2 },
            { unitId: 'arcane_mage', count: 1 }
        ],
        bonusGold: 16
    },
    {
        waveNumber: 13,
        enemies: [
            { unitId: 'void_horror', count: 2 },
            { unitId: 'blood_knight', count: 1 },  // Bloodtears lifesteal
            { unitId: 'konji_shaman', count: 1 },  // Konji poison
            { unitId: 'void_blighter', count: 1 },  // Counter-healer
            { unitId: 'void_knight', count: 2 },
            { unitId: 'fire_demon', count: 1 },
            { unitId: 'ice_empress', count: 1 }
        ],
        bonusGold: 18
    },
    {
        waveNumber: 14,
        enemies: [
            { unitId: 'void_horror', count: 2 },
            { unitId: 'void_blighter', count: 1 },  // Counter-healer
            { unitId: 'lightning_lord', count: 1 },
            { unitId: 'martial_master', count: 2 },
            { unitId: 'void_knight', count: 3 },
            { unitId: 'void_shade', count: 4 }
        ],
        bonusGold: 20
    },
    {
        waveNumber: 15,
        enemies: [
            { unitId: 'boss_chaos_overlord', count: 1 },  // FINAL BOSS!
            { unitId: 'void_blighter', count: 2 },  // Counter-healers
            { unitId: 'void_horror', count: 2 },
            { unitId: 'void_knight', count: 2 },
            { unitId: 'void_shade', count: 3 }
        ],
        bonusGold: 50
    }
];

// =============================================================================
// ELEMENTAL COLORS
// =============================================================================

export const ELEMENT_COLORS: Record<Element, number> = {
    [Element.FIRE]: 0xff4400,
    [Element.ICE]: 0x44ccff,
    [Element.LIGHTNING]: 0xffff00,
    [Element.EARTH]: 0x88aa44,
    [Element.ARCANE]: 0xaa44ff,
    [Element.VOID]: 0x332244  // Dark purple/black
};

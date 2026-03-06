/**
 * Unit System - Game units with stats, elements, and abilities
 */

import Phaser from 'phaser';
import { 
    Element, 
    UnitDefinition, 
    UnitStats, 
    ELEMENT_COLORS,
    UNIT_DEFINITIONS 
} from '../config/GameConfig';

export type UnitTeam = 'player' | 'enemy';

export interface StatusEffect {
    type: 'burn' | 'freeze' | 'slow' | 'weaken' | 'shield' | 'wound' | 'poison' | 'untargetable';
    duration: number;
    value: number;
}

// Sprite mapping: element → color, tier → shape
export const ELEMENT_TO_COLOR: Record<Element, string> = {
    [Element.FIRE]: 'red',
    [Element.ICE]: 'blue',
    [Element.LIGHTNING]: 'yellow',
    [Element.EARTH]: 'green',
    [Element.ARCANE]: 'purple',
    [Element.VOID]: 'purple'  // Uses purple body with darker tint
};

export const TIER_TO_SHAPE: Record<1 | 2 | 3 | 4, string> = {
    1: 'circle',    // Small critters
    2: 'squircle',  // Medium units
    3: 'rhombus',   // Powerful units
    4: 'rhombus'    // Bosses (same as tier 3, but larger)
};

// POSITIVE FACES for PLAYER units (happy, friendly expressions)
// Available positive faces: 'a'=smile, 'j'=winking smile, 'k'=silly/tongue, 'h'=cool sunglasses
// IMPORTANT: 'b' looks like a frown - do NOT use for players!
export const GOOD_FACES: Record<string, string> = {
    // Tier 1 - cute, happy vibes
    'fire_imp': 'a',           // Happy smile
    'ice_slime': 'j',          // Winking
    'earth_golem': 'a',        // Happy smile
    'lightning_sprite': 'k',   // Silly/playful
    'earth_archer': 'j',       // Winking
    'fire_scout': 'k',         // Silly/playful
    // Tier 2 - confident heroes
    'fire_warrior': 'a',       // Happy smile
    'ice_archer': 'j',         // Winking
    'arcane_mage': 'a',        // Happy smile
    'lightning_knight': 'a',   // Happy smile
    'ice_guardian': 'a',       // Happy smile  
    'arcane_assassin': 'h',    // Cool sunglasses
    // Tier 3 - powerful but friendly
    'fire_demon': 'h',         // Cool sunglasses
    'martial_master': 'a',     // Happy smile
    'lightning_lord': 'h',     // Cool sunglasses
    'ice_empress': 'j',        // Winking
    // Healers/Support - caring, kind
    'frost_fairy': 'k',        // Silly/cute
    'nature_spirit': 'a',      // Happy smile
    'arcane_priest': 'j',      // Winking
    'life_guardian': 'a',      // Happy smile
    // Void (if players unlock them) - mysterious but friendly
    'void_shade': 'h',         // Cool sunglasses
    'void_knight': 'a',        // Happy smile
    'void_horror': 'h',        // Cool sunglasses
    'void_blighter': 'j',      // Winking
    // Bloodtears (lifesteal faction)
    'blood_sprite': 'k',       // Silly/playful
    'blood_knight': 'h',       // Cool sunglasses
    // Konji (poison faction)
    'konji_scout': 'j',        // Winking
    'konji_shaman': 'a',       // Happy smile
    // Bosses (rare case of player having them)
    'boss_flame_tyrant': 'h',
    'boss_frost_colossus': 'h',
    'boss_chaos_overlord': 'h',
    'default': 'a'             // Default happy smile
};

// Evil faces (negative expressions) for enemy units
// All enemy units get angry/negative faces for good vs evil narrative
const EVIL_FACES: Record<string, string> = {
    // Tier 1
    'fire_imp': 'c',           // Angry
    'ice_slime': 'f',          // Smug
    'earth_golem': 'i',        // Grumpy
    'lightning_sprite': 'g',   // Shocked/menacing
    'earth_archer': 'c',       // Angry
    'fire_scout': 'c',         // Angry
    // Tier 2
    'fire_warrior': 'i',       // Grumpy
    'ice_archer': 'c',         // Angry
    'arcane_mage': 'c',        // Angry
    'lightning_knight': 'i',   // Grumpy
    'ice_guardian': 'i',       // Grumpy
    'arcane_assassin': 'c',    // Angry
    // Tier 3
    'fire_demon': 'c',         // Angry
    'martial_master': 'i',     // Grumpy
    'lightning_lord': 'c',     // Angry
    'ice_empress': 'i',        // Grumpy
    // Healers/Support (enemies can have these too)
    'frost_fairy': 'f',        // Smug
    'nature_spirit': 'i',      // Grumpy
    'arcane_priest': 'c',      // Angry
    'life_guardian': 'i',      // Grumpy
    // Void (enemy exclusive)
    'void_shade': 'c',         // Angry
    'void_knight': 'i',        // Grumpy
    'void_horror': 'c',        // Angry
    'void_blighter': 'f',      // Smug
    // Bloodtears (lifesteal faction)
    'blood_sprite': 'c',       // Angry
    'blood_knight': 'i',       // Grumpy
    // Konji (poison faction)
    'konji_scout': 'f',        // Smug
    'konji_shaman': 'c',       // Angry
    // Bosses
    'boss_flame_tyrant': 'c',  // Angry
    'boss_frost_colossus': 'i', // Grumpy
    'boss_chaos_overlord': 'c', // Angry
    'default': 'c'             // Default angry
};

export class Unit {
    public id: string;
    public definition: UnitDefinition;
    public stats: UnitStats;
    public team: UnitTeam;
    public gridPosition: { col: number; row: number };
    public statusEffects: StatusEffect[] = [];
    public abilityCooldown: number = 0;
    public isAlive: boolean = true;
    public deathReported: boolean = false;  // Track if death callback was fired
    
    // Synergy bonuses (set by GameScene before battle)
    public synergyMultipliers: { attack: number; defense: number; speed: number; hp: number } = {
        attack: 1, defense: 1, speed: 1, hp: 1
    };
    
    // Visuals
    public sprite: Phaser.GameObjects.Sprite | null = null;
    public container: Phaser.GameObjects.Container | null = null;
    public healthBar: Phaser.GameObjects.Graphics | null = null;
    private statusIcons: Phaser.GameObjects.Container | null = null;
    private shieldRing: Phaser.GameObjects.Graphics | null = null;
    
    private scene: Phaser.Scene | null = null;

    constructor(definition: UnitDefinition, team: UnitTeam, col: number, row: number) {
        this.id = `${definition.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.definition = definition;
        this.team = team;
        this.gridPosition = { col, row };
        
        // Clone stats so each unit has independent values
        this.stats = { ...definition.stats };
    }

    // =========================================================================
    // VISUAL CREATION
    // =========================================================================

    public createVisuals(scene: Phaser.Scene, x: number, y: number): void {
        this.scene = scene;
        
        // Container holds all unit visuals
        this.container = scene.add.container(x, y);
        
        // Get sprite keys — use per-unit visual if defined, else fall back to element/tier mapping
        const bodyColor = this.definition.visual?.color ?? ELEMENT_TO_COLOR[this.definition.element];
        const bodyShape = this.definition.visual?.shape ?? TIER_TO_SHAPE[this.definition.tier];
        
        // Choose face based on team: good faces for players, evil faces for enemies
        const faceMap = this.team === 'player' ? GOOD_FACES : EVIL_FACES;
        const faceKey = faceMap[this.definition.id] || faceMap['default'];
        
        const bodyKey = `${bodyColor}_${bodyShape}`;
        const faceKeyFull = `face_${faceKey}`;
        
        // Sizes based on tier
        const tierSizes: Record<1 | 2 | 3 | 4, number> = { 1: 50, 2: 58, 3: 65, 4: 80 };
        const baseSize = tierSizes[this.definition.tier] || 65;
        const scale = baseSize / 64;  // Assuming 64px base sprite size
        
        // Shadow
        if (scene.textures.exists('shadow')) {
            const shadow = scene.add.image(2, 5, 'shadow');
            shadow.setScale(scale * 1.1);
            shadow.setAlpha(0.4);
            this.container.add(shadow);
        }
        
        // Body sprite - apply dark tint for void units
        let body: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
        if (scene.textures.exists(bodyKey)) {
            body = scene.add.image(0, 0, bodyKey);
            body.setScale(scale);
            // Void units get darker tint
            if (this.definition.element === Element.VOID) {
                body.setTint(0x442266);
            }
        } else {
            // Fallback to colored rectangle
            const color = ELEMENT_COLORS[this.definition.element];
            body = scene.add.rectangle(0, 0, baseSize, baseSize, color, 0.9);
            (body as Phaser.GameObjects.Rectangle).setStrokeStyle(3, 0xffffff);
        }
        this.container.add(body);
        
        // Face sprite - different sprites for player vs enemy (no flipping needed)
        if (scene.textures.exists(faceKeyFull)) {
            const face = scene.add.image(0, -3, faceKeyFull);
            face.setScale(scale * 0.65);
            // No flip needed - players use happy faces (a,j,k,h), enemies use angry faces (c,f,g,i)
            this.container.add(face);
        }
        
        // Tier indicator (stars) - positioned above
        const tierText = '★'.repeat(this.definition.tier);
        const tierLabel = scene.add.text(0, -baseSize/2 - 12, tierText, {
            fontSize: '10px',
            color: '#ffdd00',
            fontStyle: 'bold',
            fontFamily: 'Rajdhani, sans-serif',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.container.add(tierLabel);
        
        // Unit name - positioned below
        const nameLabel = scene.add.text(0, baseSize/2 + 8, this.definition.name, {
            fontSize: '11px',
            color: '#ffffff',
            fontFamily: 'Rajdhani, sans-serif',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        this.container.add(nameLabel);
        

        
        // Health bar background
        const hpBarBg = scene.add.rectangle(0, -baseSize/2 - 3, baseSize + 6, 6, 0x222222);
        hpBarBg.setStrokeStyle(1, 0x444444);
        this.container.add(hpBarBg);
        
        // Health bar
        this.healthBar = scene.add.graphics();
        this.container.add(this.healthBar);
        this.updateHealthBar();
        
        // Container depth
        this.container.setDepth(10);
    }

    public updateHealthBar(): void {
        if (!this.healthBar || !this.scene) return;
        
        this.healthBar.clear();
        
        // Size based on tier
        const baseSize = this.definition.tier === 1 ? 50 : this.definition.tier === 2 ? 58 : 65;
        const width = baseSize + 4;
        const height = 4;
        const healthPercent = this.stats.hp / this.stats.maxHp;
        
        // Health color: green > yellow > red
        let color = 0x44ff44;
        if (healthPercent < 0.6) color = 0xffff44;
        if (healthPercent < 0.3) color = 0xff4444;
        
        this.healthBar.fillStyle(color, 1);
        this.healthBar.fillRect(-width/2, -baseSize/2 - 4, width * healthPercent, height);
    }

    // =========================================================================
    // COMBAT
    // =========================================================================

    public takeDamage(amount: number, _source?: Unit): number {
        // Apply defense reduction
        const effectiveDefense = this.getEffectiveDefense();
        const damageReduction = effectiveDefense / (effectiveDefense + 50); // Diminishing returns
        const actualDamage = Math.max(1, Math.floor(amount * (1 - damageReduction)));
        
        this.stats.hp = Math.max(0, this.stats.hp - actualDamage);
        this.updateHealthBar();
        
        // Visual feedback
        if (this.container && this.scene) {
            this.scene.tweens.add({
                targets: this.container,
                x: this.container.x + (Math.random() - 0.5) * 10,
                duration: 50,
                yoyo: true,
                repeat: 2
            });
            
            // Damage number popup
            this.showDamageNumber(actualDamage);
        }
        
        if (this.stats.hp <= 0) {
            this.die();
        }
        
        return actualDamage;
    }

    public heal(amount: number): void {
        const healAmount = Math.floor(amount);
        const oldHp = this.stats.hp;
        this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + healAmount);
        this.updateHealthBar();
        
        const healed = this.stats.hp - oldHp;
        if (healed > 0 && this.container && this.scene) {
            this.showHealNumber(healed);
        }
    }

    public showDamageNumber(damage: number): void {
        if (!this.scene || !this.container) return;
        
        // Bigger text for bigger hits
        const isBigHit = damage >= 20;
        const fontSize = isBigHit ? '24px' : '18px';
        
        const text = this.scene.add.text(
            this.container.x,
            this.container.y - 30,
            `-${damage}`,
            { 
                fontSize, 
                fontFamily: 'Rajdhani, sans-serif',
                color: isBigHit ? '#ff2222' : '#ff4444', 
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: isBigHit ? 3 : 2
            }
        ).setOrigin(0.5).setDepth(50);
        
        // Scale-bounce for anime-style hit feel  
        text.setScale(isBigHit ? 1.5 : 1.2);
        
        this.scene.tweens.add({
            targets: text,
            scaleX: 1,
            scaleY: 1,
            duration: 150,
            ease: 'Back.easeOut'
        });
        
        this.scene.tweens.add({
            targets: text,
            y: text.y - (isBigHit ? 50 : 40),
            alpha: 0,
            duration: 900,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }

    private showHealNumber(amount: number): void {
        if (!this.scene || !this.container) return;
        
        const text = this.scene.add.text(
            this.container.x,
            this.container.y - 30,
            `+${amount}`,
            { fontSize: '18px', fontFamily: 'Rajdhani, sans-serif', color: '#44ff44', fontStyle: 'bold' }
        ).setOrigin(0.5);
        
        this.scene.tweens.add({
            targets: text,
            y: text.y - 40,
            alpha: 0,
            duration: 800,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }

    private die(): void {
        this.isAlive = false;
        
        if (this.container && this.scene) {
            const cx = this.container.x;
            const cy = this.container.y;
            const elemColor = ELEMENT_COLORS[this.getElement()] || 0xffffff;
            
            // === ANIME DEATH EXPLOSION ===
            // Burst particles in element color
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                const dist = 25 + Math.random() * 30;
                const size = 3 + Math.random() * 5;
                const particle = this.scene.add.circle(cx, cy, size, elemColor, 0.8);
                particle.setDepth(42);
                
                this.scene.tweens.add({
                    targets: particle,
                    x: cx + Math.cos(angle) * dist,
                    y: cy + Math.sin(angle) * dist - 10,
                    alpha: 0,
                    scale: 0.2,
                    duration: 350 + Math.random() * 150,
                    ease: 'Cubic.easeOut',
                    onComplete: () => particle.destroy()
                });
            }
            
            // White core flash
            const flash = this.scene.add.circle(cx, cy, 12, 0xffffff, 0.7);
            flash.setDepth(43);
            this.scene.tweens.add({
                targets: flash,
                scale: 3,
                alpha: 0,
                duration: 250,
                ease: 'Cubic.easeOut',
                onComplete: () => flash.destroy()
            });
            
            // Unit shrink + fade (faster than before for snappier feel)
            this.scene.tweens.add({
                targets: this.container,
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: 300,
                ease: 'Back.easeIn',
                onComplete: () => {
                    this.container?.destroy();
                    this.container = null;
                }
            });
        }
    }

    // =========================================================================
    // STATS & STATUS EFFECTS
    // =========================================================================

    public getEffectiveAttack(): number {
        let attack = this.stats.attack * this.synergyMultipliers.attack;
        
        for (const effect of this.statusEffects) {
            if (effect.type === 'weaken') {
                attack *= (1 - effect.value / 100);
            }
        }
        
        return Math.floor(attack);
    }

    public getEffectiveDefense(): number {
        let defense = this.stats.defense * this.synergyMultipliers.defense;
        
        for (const effect of this.statusEffects) {
            if (effect.type === 'shield') {
                defense += effect.value;
            }
        }
        
        return Math.floor(defense);
    }

    public getEffectiveSpeed(): number {
        let speed = this.stats.speed * this.synergyMultipliers.speed;
        
        for (const effect of this.statusEffects) {
            if (effect.type === 'slow' || effect.type === 'freeze') {
                speed *= (1 - effect.value / 100);
            }
        }
        
        return Math.floor(speed);
    }

    /**
     * Apply synergy multipliers to this unit. Must be called before battle.
     * HP synergy modifies maxHp and heals proportionally.
     */
    public applySynergyBonuses(multipliers: { attack: number; defense: number; speed: number; hp: number }): void {
        this.synergyMultipliers = { ...multipliers };
        
        // HP synergy modifies actual maxHp and scales current HP proportionally
        if (multipliers.hp !== 1) {
            const newMaxHp = Math.floor(this.definition.stats.maxHp * multipliers.hp);
            const hpRatio = this.stats.hp / this.stats.maxHp;
            this.stats.maxHp = newMaxHp;
            this.stats.hp = Math.floor(newMaxHp * hpRatio);
            this.updateHealthBar();
        }
    }

    /**
     * Reset synergy multipliers (call between waves or when recalculating)
     */
    public resetSynergyBonuses(): void {
        // Restore HP to base max if synergy changed it
        if (this.synergyMultipliers.hp !== 1) {
            const hpRatio = this.stats.hp / this.stats.maxHp;
            this.stats.maxHp = this.definition.stats.maxHp;
            this.stats.hp = Math.floor(this.stats.maxHp * hpRatio);
            this.updateHealthBar();
        }
        this.synergyMultipliers = { attack: 1, defense: 1, speed: 1, hp: 1 };
    }

    public applyStatusEffect(effect: StatusEffect): void {
        // Check if effect already exists - refresh duration if so
        const existing = this.statusEffects.find(e => e.type === effect.type);
        if (existing) {
            existing.duration = Math.max(existing.duration, effect.duration);
            existing.value = Math.max(existing.value, effect.value);
        } else {
            this.statusEffects.push({ ...effect });
        }
        
        this.updateStatusVisuals();
    }

    public tickStatusEffects(): void {
        const effects = [...this.statusEffects];
        
        for (const effect of effects) {
            // Apply per-turn effects
            if (effect.type === 'burn') {
                this.takeDamage(effect.value);
            }
            if (effect.type === 'poison') {
                this.takeDamage(effect.value);
            }
            
            effect.duration--;
            
            if (effect.duration <= 0) {
                const index = this.statusEffects.indexOf(effect);
                if (index > -1) {
                    this.statusEffects.splice(index, 1);
                }
            }
        }
        
        this.updateStatusVisuals();
    }

    private updateStatusVisuals(): void {
        if (!this.container || !this.scene) return;
        
        // Clear existing status icons
        if (this.statusIcons) {
            this.statusIcons.destroy();
        }
        
        // Clear existing shield ring
        if (this.shieldRing) {
            this.shieldRing.destroy();
            this.shieldRing = null;
        }
        
        if (this.statusEffects.length === 0) {
            this.statusIcons = null;
            return;
        }
        
        // Create container for status icons (positioned to the right of unit)
        const tierSizes: Record<1 | 2 | 3 | 4, number> = { 1: 50, 2: 58, 3: 65, 4: 80 };
        const baseSize = tierSizes[this.definition.tier] || 65;
        
        this.statusIcons = this.scene.add.container(baseSize/2 + 8, -baseSize/2);
        this.container.add(this.statusIcons);
        
        // Shield ring visual - glowing border around the unit
        const hasShield = this.statusEffects.some(e => e.type === 'shield');
        if (hasShield) {
            this.shieldRing = this.scene.add.graphics();
            const ringRadius = baseSize / 2 + 6;
            // Outer glow
            this.shieldRing.lineStyle(4, 0xffdd00, 0.3);
            this.shieldRing.strokeCircle(0, 0, ringRadius + 3);
            // Main ring
            this.shieldRing.lineStyle(2, 0xffdd00, 0.7);
            this.shieldRing.strokeCircle(0, 0, ringRadius);
            this.container.add(this.shieldRing);
            
            // Pulse animation
            this.scene.tweens.add({
                targets: this.shieldRing,
                alpha: { from: 0.7, to: 0.3 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        
        // Status effect colors
        const STATUS_COLORS: Record<string, number> = {
            'burn': 0xff4400,
            'freeze': 0x00ccff,
            'slow': 0x8844ff,
            'weaken': 0x666666,
            'shield': 0xffdd00,
            'wound': 0x880088,  // Purple for healing reduction
            'poison': 0x44aa00, // Green for poison
            'untargetable': 0x8888ff  // Ghost blue
        };
        
        const STATUS_ICONS: Record<string, string> = {
            'burn': '🔥',
            'freeze': '❄️',
            'slow': '🐌',
            'weaken': '⬇️',
            'shield': '🛡️',
            'wound': '💜',
            'poison': '☠️',
            'untargetable': '👻'
        };
        
        // Create icon for each active effect
        let yOffset = 0;
        for (const effect of this.statusEffects) {
            const color = STATUS_COLORS[effect.type] || 0xffffff;
            const icon = STATUS_ICONS[effect.type];
            
            // Small colored circle background (interactive for tooltip)
            const bg = this.scene.add.circle(0, yOffset, 10, color, 0.85);
            bg.setStrokeStyle(1, 0x000000);
            this.statusIcons.add(bg);
            
            if (icon) {
                // Emoji icon
                const iconText = this.scene.add.text(0, yOffset, icon, {
                    fontSize: '12px'
                }).setOrigin(0.5);
                this.statusIcons.add(iconText);
            }
            
            // Duration text (offset to the right)
            const durationText = this.scene.add.text(16, yOffset, `${effect.duration}`, {
                fontSize: '9px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);
            this.statusIcons.add(durationText);
            
            yOffset += 20;
        }
    }

    public canUseAbility(): boolean {
        return this.abilityCooldown === 0;
    }

    public isUntargetable(): boolean {
        return this.statusEffects.some(e => e.type === 'untargetable');
    }

    public useAbility(): void {
        this.abilityCooldown = this.definition.ability.cooldown;
    }

    public tickCooldown(): void {
        if (this.abilityCooldown > 0) {
            this.abilityCooldown--;
        }
    }

    // =========================================================================
    // MOVEMENT
    // =========================================================================

    public moveTo(scene: Phaser.Scene, newX: number, newY: number, col: number, row: number): Promise<void> {
        return new Promise((resolve) => {
            if (!this.container) {
                this.gridPosition = { col, row };
                resolve();
                return;
            }
            
            scene.tweens.add({
                targets: this.container,
                x: newX,
                y: newY,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    this.gridPosition = { col, row };
                    resolve();
                }
            });
        });
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    public getElement(): Element {
        return this.definition.element;
    }

    public destroy(): void {
        this.container?.destroy();
        this.container = null;
        this.sprite = null;
        this.healthBar = null;
    }
}

// =============================================================================
// UNIT FACTORY
// =============================================================================

export class UnitFactory {
    public static create(unitId: string, team: UnitTeam, col: number, row: number): Unit | null {
        const definition = UNIT_DEFINITIONS.find(d => d.id === unitId);
        if (!definition) {
            console.warn(`Unknown unit ID: ${unitId}`);
            return null;
        }
        return new Unit(definition, team, col, row);
    }

    public static getWinCount(): number {
        try {
            const count = localStorage.getItem('shape_strikers_win_count');
            if (count !== null) return parseInt(count, 10) || 0;
            // Legacy support: if old void flag is set, count as at least 2 wins
            if (localStorage.getItem('shape_strikers_void_unlocked') === 'true') return 2;
            return 0;
        } catch {
            return 0;
        }
    }

    /**
     * Increment win count (call after each game completion)
     */
    public static incrementWinCount(): void {
        try {
            const current = this.getWinCount();
            localStorage.setItem('shape_strikers_win_count', String(current + 1));
            // Keep legacy flag in sync
            if (current + 1 >= 2) {
                localStorage.setItem('shape_strikers_void_unlocked', 'true');
            }
        } catch {
            // localStorage not available
        }
    }

    /**
     * Check if arcane units are unlocked (1+ wins)
     */
    public static isArcaneUnlocked(): boolean {
        return this.getWinCount() >= 1;
    }

    /**
     * Check if void units are unlocked (2+ wins)
     */
    public static isVoidUnlocked(): boolean {
        try {
            // Legacy support
            if (localStorage.getItem('shape_strikers_void_unlocked') === 'true') return true;
            return this.getWinCount() >= 2;
        } catch {
            return false;
        }
    }

    public static getRandomUnitForShop(maxTier: 1 | 2 | 3 = 3): UnitDefinition {
        // Weight by tier (tier 1 most common, tier 3 rarest)
        const weights = { 1: 60, 2: 30, 3: 10 };
        const roll = Math.random() * 100;
        
        let tier: 1 | 2 | 3 = 1;
        if (roll > weights[1]) tier = 2;
        if (roll > weights[1] + weights[2]) tier = 3;
        tier = Math.min(tier, maxTier) as 1 | 2 | 3;
        
        // Filter: exclude bosses, gate arcane (1 win) and void (2 wins)
        const arcaneUnlocked = this.isArcaneUnlocked();
        const voidUnlocked = this.isVoidUnlocked();
        const unitsOfTier = UNIT_DEFINITIONS.filter(d => 
            d.tier === tier && 
            !d.isBoss && 
            (!d.isVoid || voidUnlocked) &&
            (d.element !== Element.ARCANE || arcaneUnlocked)
        );
        return unitsOfTier[Math.floor(Math.random() * unitsOfTier.length)];
    }
}

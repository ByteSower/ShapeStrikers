/**
 * Battle System - Auto-battle logic with elemental synergies
 */

import Phaser from 'phaser';
import { Unit, UnitTeam } from '../entities/Unit';
import { Grid, GridTile } from '../grid/Grid';
import { 
    Element, 
    ELEMENT_COLORS,
    BossPhase 
} from '../config/GameConfig';

type BattleState = 'idle' | 'battling' | 'victory' | 'defeat';

interface BattleAction {
    unit: Unit;
    target: Unit | null;
    type: 'attack' | 'ability' | 'move';
    priority: number;
}

// Track boss phase state
interface BossPhaseState {
    unit: Unit;
    currentPhaseIndex: number;
    phases: BossPhase[];
    baseStats: { attack: number; defense: number; speed: number };
    usesPhaseHp: boolean;  // True if boss uses separate HP pools per phase
    phaseHpThresholds: number[];  // Cumulative HP thresholds for phase transitions
}

export class BattleSystem {
    private scene: Phaser.Scene;
    private grid: Grid;
    private playerUnits: Unit[] = [];
    private enemyUnits: Unit[] = [];
    private state: BattleState = 'idle';
    private turnNumber: number = 0;
    private actionQueue: BattleAction[] = [];
    private isProcessingAction: boolean = false;
    
    // Track tiles that will be occupied this turn (prevents collision)
    private reservedTiles: Set<string> = new Set();
    
    // Boss phase tracking
    private bossPhaseStates: BossPhaseState[] = [];
    
    // Screen shake guard
    private isShaking: boolean = false;
    
    // Boss text queue guard
    private activeBossText: Phaser.GameObjects.Text | null = null;
    
    // Events
    public onBattleEnd: ((result: 'victory' | 'defeat') => void) | null = null;
    public onTurnStart: ((turn: number) => void) | null = null;
    public onUnitDeath: ((unit: Unit) => void) | null = null;
    public onBossPhaseChange: ((boss: Unit, phase: BossPhase, phaseIndex: number) => void) | null = null;

    constructor(scene: Phaser.Scene, grid: Grid) {
        this.scene = scene;
        this.grid = grid;
    }

    // =========================================================================
    // BATTLE FLOW
    // =========================================================================

    public startBattle(playerUnits: Unit[], enemyUnits: Unit[]): void {
        this.playerUnits = playerUnits.filter(u => u.isAlive);
        this.enemyUnits = enemyUnits.filter(u => u.isAlive);
        this.state = 'battling';
        this.turnNumber = 0;
        this.reservedTiles.clear();
        this.isShaking = false;
        this.activeBossText = null;
        
        // Initialize boss phase tracking
        this.initBossPhases();
        
        // Check for any pre-existing collisions at battle start
        this.resolveCollisions();
        
        console.log(`Battle started: ${this.playerUnits.length} vs ${this.enemyUnits.length}`);
        
        this.nextTurn();
    }
    
    /**
     * Initialize boss phase tracking for any bosses with phases
     */
    private initBossPhases(): void {
        this.bossPhaseStates = [];
        
        for (const enemy of this.enemyUnits) {
            if (enemy.definition.bossPhases && enemy.definition.bossPhases.length > 0) {
                const phases = enemy.definition.bossPhases;
                const usesPhaseHp = phases.some(p => p.phaseHp !== undefined);
                
                // Calculate HP thresholds for phase-HP based bosses
                let phaseHpThresholds: number[] = [];
                if (usesPhaseHp) {
                    // Sum all phase HP to get total boss HP
                    let totalHp = 0;
                    for (const phase of phases) {
                        totalHp += phase.phaseHp || 0;
                    }
                    
                    // Set boss HP to total of all phases
                    enemy.stats.maxHp = totalHp;
                    enemy.stats.hp = totalHp;
                    
                    // Calculate thresholds: cumulative HP from the end
                    // Phase 0 ends when HP drops to (total - phase0Hp)
                    // Phase 1 ends when HP drops to (total - phase0Hp - phase1Hp), etc.
                    let cumulativeHp = totalHp;
                    for (let i = 0; i < phases.length; i++) {
                        cumulativeHp -= phases[i].phaseHp || 0;
                        phaseHpThresholds.push(cumulativeHp);
                    }
                    
                    console.log(`Boss ${enemy.definition.name}: Total HP = ${totalHp}, thresholds = ${phaseHpThresholds}`);
                }
                
                this.bossPhaseStates.push({
                    unit: enemy,
                    currentPhaseIndex: 0,
                    phases: phases,
                    baseStats: {
                        attack: enemy.stats.attack,
                        defense: enemy.stats.defense,
                        speed: enemy.stats.speed
                    },
                    usesPhaseHp,
                    phaseHpThresholds
                });
                
                // Announce first phase
                const firstPhase = phases[0];
                if (this.onBossPhaseChange) {
                    this.scene.time.delayedCall(500, () => {
                        this.onBossPhaseChange!(enemy, firstPhase, 0);
                    });
                }
            }
        }
    }
    
    /**
     * Check if any boss has crossed a phase threshold
     */
    private checkBossPhaseTransitions(): void {
        for (const bossState of this.bossPhaseStates) {
            if (!bossState.unit.isAlive) continue;
            
            const currentHp = bossState.unit.stats.hp;
            const phases = bossState.phases;
            
            if (bossState.usesPhaseHp) {
                // Phase-HP based transition: check against absolute HP thresholds
                const currentPhase = bossState.currentPhaseIndex;
                const nextPhase = currentPhase + 1;
                
                // Check if HP dropped below current phase threshold
                if (nextPhase < phases.length && currentHp <= bossState.phaseHpThresholds[currentPhase]) {
                    // Transition to next phase!
                    bossState.currentPhaseIndex = nextPhase;
                    const newPhase = phases[nextPhase];
                    
                    // Apply stat modifiers
                    const mods = newPhase.statModifiers;
                    bossState.unit.stats.attack = Math.floor(bossState.baseStats.attack * (mods.attackMult || 1));
                    bossState.unit.stats.defense = Math.floor(bossState.baseStats.defense * (mods.defenseMult || 1));
                    bossState.unit.stats.speed = Math.floor(bossState.baseStats.speed * (mods.speedMult || 1));
                    
                    // Notify phase change with phase index
                    if (this.onBossPhaseChange) {
                        this.onBossPhaseChange(bossState.unit, newPhase, nextPhase);
                    }
                    
                    console.log(`Boss phase transition: ${bossState.unit.definition.name} -> ${newPhase.name} (Phase ${nextPhase + 1})`);
                }
            } else {
                // Original percentage-based transition
                const hpPercent = currentHp / bossState.unit.stats.maxHp;
                
                // Find the phase we should be in based on HP percentage
                for (let i = phases.length - 1; i >= 0; i--) {
                    if (hpPercent <= phases[i].hpThreshold && i > bossState.currentPhaseIndex) {
                        // Transition to new phase!
                        bossState.currentPhaseIndex = i;
                        const newPhase = phases[i];
                        
                        // Apply stat modifiers
                        const mods = newPhase.statModifiers;
                        bossState.unit.stats.attack = Math.floor(bossState.baseStats.attack * (mods.attackMult || 1));
                        bossState.unit.stats.defense = Math.floor(bossState.baseStats.defense * (mods.defenseMult || 1));
                        bossState.unit.stats.speed = Math.floor(bossState.baseStats.speed * (mods.speedMult || 1));
                        
                        // Notify phase change
                        if (this.onBossPhaseChange) {
                            this.onBossPhaseChange(bossState.unit, newPhase, i);
                        }
                        
                        console.log(`Boss phase transition: ${bossState.unit.definition.name} -> ${newPhase.name}`);
                        break;
                    }
                }
            }
        }
    }

    public stopBattle(): void {
        this.state = 'idle';
        this.actionQueue = [];
        this.isProcessingAction = false;
    }

    private nextTurn(): void {
        if (this.state !== 'battling') return;
        
        this.turnNumber++;
        this.reservedTiles.clear();  // Clear reserved tiles at start of each turn
        console.log(`=== Turn ${this.turnNumber} ===`);
        
        // DEBUG: Log all unit positions at turn start with visual verification
        const allAlive = [...this.playerUnits, ...this.enemyUnits].filter(u => u.isAlive);
        console.log('Unit positions at turn start:');
        allAlive.forEach(u => {
            const expectedWorld = this.grid.gridToWorld(u.gridPosition.col, u.gridPosition.row);
            const actualX = u.container?.x ?? 'N/A';
            const actualY = u.container?.y ?? 'N/A';
            const posMatch = u.container ? 
                (Math.abs(u.container.x - expectedWorld.x) < 5 && Math.abs(u.container.y - expectedWorld.y) < 5) : true;
            console.log(`  ${u.id}: ${u.definition.name} (${u.team}) grid=(${u.gridPosition.col},${u.gridPosition.row}) visual=(${actualX},${actualY}) ${posMatch ? '✓' : '⚠️ DESYNC'}`);
        });
        
        // Check for pre-existing collisions at turn start
        const posMap = new Map<string, string[]>();
        allAlive.forEach(u => {
            const key = `${u.gridPosition.col},${u.gridPosition.row}`;
            if (!posMap.has(key)) posMap.set(key, []);
            posMap.get(key)!.push(`${u.definition.name}[${u.id}]`);
        });
        for (const [pos, names] of posMap) {
            if (names.length > 1) {
                console.error(`COLLISION AT TURN START: ${pos} has ${names.join(', ')}`);
            }
        }
        
        if (this.onTurnStart) {
            this.onTurnStart(this.turnNumber);
        }
        
        // Show turn number banner
        this.showTurnBanner(this.turnNumber);
        
        // Check win/lose conditions
        const alivePlayerUnits = this.playerUnits.filter(u => u.isAlive);
        const aliveEnemyUnits = this.enemyUnits.filter(u => u.isAlive);
        
        if (aliveEnemyUnits.length === 0) {
            this.endBattle('victory');
            return;
        }
        
        if (alivePlayerUnits.length === 0) {
            this.endBattle('defeat');
            return;
        }
        
        // Tick status effects and cooldowns
        [...alivePlayerUnits, ...aliveEnemyUnits].forEach(unit => {
            unit.tickStatusEffects();
            unit.tickCooldown();
        });
        
        // Build action queue based on speed
        this.buildActionQueue();
        
        // Process actions
        this.processNextAction();
    }

    private buildActionQueue(): void {
        this.actionQueue = [];
        
        const allUnits = [
            ...this.playerUnits.filter(u => u.isAlive),
            ...this.enemyUnits.filter(u => u.isAlive)
        ];
        
        // Build raw actions per unit
        const rawActions: BattleAction[] = [];
        
        for (const unit of allUnits) {
            // Check if frozen (skip turn)
            if (unit.statusEffects.some(e => e.type === 'freeze' && e.value >= 100)) {
                continue;
            }
            
            // Healers target allies when ability is ready, otherwise attack enemies
            const isHealer = this.isHealerUnit(unit);
            let target: Unit | null;
            
            if (isHealer && unit.canUseAbility()) {
                target = this.findHealTarget(unit);
            } else {
                target = this.findTarget(unit);
            }
            
            const actionType = this.determineActionType(unit, target);
            
            rawActions.push({
                unit,
                target,
                type: actionType,
                priority: unit.getEffectiveSpeed()
            });
        }
        
        // Sort purely by speed — fastest units act first, picking their best action
        rawActions.sort((a, b) => b.priority - a.priority);
        
        this.actionQueue = rawActions;
    }

    private findTarget(unit: Unit): Unit | null {
        const enemies = unit.team === 'player' 
            ? this.enemyUnits.filter(u => u.isAlive && !u.isUntargetable())
            : this.playerUnits.filter(u => u.isAlive && !u.isUntargetable());
        
        if (enemies.length === 0) return null;
        
        // Lane-based targeting: prioritize same column, then by row distance
        const unitCol = unit.gridPosition.col;
        const unitRow = unit.gridPosition.row;
        
        let bestTarget: Unit | null = null;
        let bestScore = Infinity;  // Lower is better
        
        for (const enemy of enemies) {
            const rowDist = Math.abs(enemy.gridPosition.row - unitRow);
            const colDist = Math.abs(enemy.gridPosition.col - unitCol);
            
            // Score: prioritize same column (colDist * 10), then row distance
            const score = colDist * 10 + rowDist;
            
            // If in range (row distance), prefer lowest HP at same score
            if (rowDist <= unit.stats.range) {
                if (!bestTarget || score < bestScore || 
                    (score === bestScore && enemy.stats.hp < bestTarget.stats.hp)) {
                    bestTarget = enemy;
                    bestScore = score;
                }
            } else if (!bestTarget || score < bestScore) {
                // Track closest for movement
                bestTarget = enemy;
                bestScore = score;
            }
        }
        
        return bestTarget;
    }

    // Check if unit is a healer type
    private isHealerUnit(unit: Unit): boolean {
        const healerIds = ['frost_fairy', 'nature_spirit', 'arcane_priest', 'life_guardian'];
        return healerIds.includes(unit.definition.id);
    }

    // Find ally target for healers - prioritize lowest HP percentage
    private findHealTarget(unit: Unit): Unit | null {
        const allies = unit.team === 'player' 
            ? this.playerUnits.filter(u => u.isAlive)
            : this.enemyUnits.filter(u => u.isAlive);
        
        if (allies.length === 0) return null;
        
        // Find ally with lowest HP percentage that's actually damaged
        let bestTarget: Unit | null = null;
        let lowestHpPercent = 1.0;
        
        for (const ally of allies) {
            const hpPercent = ally.stats.hp / ally.stats.maxHp;
            // Only consider damaged allies
            if (hpPercent < 1.0 && hpPercent < lowestHpPercent) {
                lowestHpPercent = hpPercent;
                bestTarget = ally;
            }
        }
        
        // If no damaged allies, healers will attack instead - find an enemy
        if (!bestTarget) {
            return this.findTarget(unit);
        }
        
        return bestTarget;
    }

    private determineActionType(unit: Unit, target: Unit | null): 'attack' | 'ability' | 'move' {
        if (!target) return 'move';
        
        // Row-based range check
        const rowDistance = Math.abs(unit.gridPosition.row - target.gridPosition.row);
        
        // Use ability if available and target in range
        if (unit.canUseAbility() && rowDistance <= unit.stats.range) {
            return 'ability';
        }
        
        // If target is an ally (healer fallback from findHealTarget), don't attack them
        if (target.team === unit.team) {
            return 'move'; // Skip this turn, no valid action
        }
        
        // If target out of row range, move closer
        if (rowDistance > unit.stats.range) {
            return 'move';
        }
        
        return 'attack';
    }

    private async processNextAction(): Promise<void> {
        if (this.state !== 'battling' || this.isProcessingAction) return;
        
        if (this.actionQueue.length === 0) {
            // Turn complete - resolve any collisions before next turn
            this.resolveCollisions();
            this.scene.time.delayedCall(800, () => this.nextTurn());
            return;
        }
        
        this.isProcessingAction = true;
        const action = this.actionQueue.shift()!;
        
        // Skip if unit died during this turn
        if (!action.unit.isAlive) {
            this.isProcessingAction = false;
            this.processNextAction();
            return;
        }
        
        console.log(`${action.unit.definition.name} (${action.unit.team}) -> ${action.type}`);
        
        // Show action announcement
        this.showActionBanner(action);
        
        switch (action.type) {
            case 'attack':
                await this.executeAttack(action.unit, action.target!);
                break;
            case 'ability':
                await this.executeAbility(action.unit, action.target);
                break;
            case 'move':
                await this.executeMove(action.unit, action.target);
                break;
        }
        
        // Check for deaths
        this.checkDeaths();
        
        // Check for boss phase transitions
        this.checkBossPhaseTransitions();
        
        // Resolve any collisions that occurred
        this.resolveCollisions();
        
        this.isProcessingAction = false;
        
        // Slower pacing between actions for readability
        const actionDelay = action.type === 'move' ? 350 : 500;
        this.scene.time.delayedCall(actionDelay, () => this.processNextAction());
    }
    
    /**
     * Detects and resolves unit collisions (multiple units on same tile)
     */
    /**
     * Simplified collision resolution for lane-based combat.
     * Collisions should be rare since movement prevents overlap.
     * This is a safety net for spawn conflicts.
     */
    private resolveCollisions(): void {
        const allUnits = [...this.playerUnits, ...this.enemyUnits].filter(u => u.isAlive);
        const tileOccupants = new Map<string, Unit[]>();
        
        // Group units by tile
        for (const unit of allUnits) {
            const key = `${unit.gridPosition.col},${unit.gridPosition.row}`;
            if (!tileOccupants.has(key)) {
                tileOccupants.set(key, []);
            }
            tileOccupants.get(key)!.push(unit);
        }
        
        // Track all occupied positions
        const allOccupied = new Set(allUnits.map(u => `${u.gridPosition.col},${u.gridPosition.row}`));
        
        // Resolve any collisions
        for (const [tileKey, units] of tileOccupants) {
            if (units.length > 1) {
                console.warn(`COLLISION at ${tileKey}: ${units.map(u => u.definition.name).join(', ')}`);
                
                // Keep first unit, relocate others within their zone
                for (let i = 1; i < units.length; i++) {
                    const unit = units[i];
                    const emptyTile = this.findZoneEmptyTile(unit, allOccupied);
                    
                    if (emptyTile) {
                        unit.gridPosition = { col: emptyTile.col, row: emptyTile.row };
                        const worldPos = this.grid.gridToWorld(emptyTile.col, emptyTile.row);
                        if (unit.container) {
                            unit.container.setPosition(worldPos.x, worldPos.y);
                        }
                        this.grid.setOccupied(emptyTile.col, emptyTile.row, unit.id);
                        allOccupied.add(`${emptyTile.col},${emptyTile.row}`);
                        console.log(`  Relocated ${unit.definition.name} to (${emptyTile.col},${emptyTile.row})`);
                    }
                }
                this.grid.setOccupied(units[0].gridPosition.col, units[0].gridPosition.row, units[0].id);
            }
        }
    }
    
    /**
     * Find empty tile within unit's zone (respects lane-based boundaries)
     */
    private findZoneEmptyTile(unit: Unit, occupied: Set<string>): { col: number; row: number } | null {
        const battleLineRow = 2;
        
        // Define valid rows based on team
        let minRow: number, maxRow: number;
        if (unit.team === 'player') {
            minRow = battleLineRow;  // Row 2
            maxRow = 4;               // Rows 2-4
        } else {
            minRow = 0;               // Rows 0-2
            maxRow = battleLineRow;   // Row 2
        }
        
        // Search for empty tile in valid zone
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = 0; col < 6; col++) {  // 6 columns
                if (!occupied.has(`${col},${row}`)) {
                    const tile = this.grid.getTile(col, row);
                    if (tile) {
                        return { col, row };
                    }
                }
            }
        }
        return null;
    }

    // =========================================================================
    // ACTION EXECUTION
    // =========================================================================

    private async executeAttack(attacker: Unit, target: Unit): Promise<void> {
        if (!target.isAlive) return;
        
        const damage = attacker.getEffectiveAttack();
        
        // Visual: Flash attacker
        await this.animateAttack(attacker, target);
        
        // Deal damage
        target.takeDamage(damage, attacker);
    }

    private async executeAbility(unit: Unit, target: Unit | null): Promise<void> {
        unit.useAbility();
        
        const ability = unit.definition.ability;
        console.log(`  Using ability: ${ability.name}`);
        
        // Visual: Ability aura
        await this.animateAbility(unit);
        
        // Execute ability based on unit type
        switch (unit.definition.id) {
            case 'fire_imp':
                // Ember Strike - attack with burn
                if (target?.isAlive) {
                    const damage = unit.getEffectiveAttack() * 1.5;
                    target.takeDamage(damage, unit);
                    target.applyStatusEffect({ type: 'burn', duration: 2, value: 8 });
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.FIRE);
                }
                break;
                
            case 'ice_slime':
                // Frost Coat - slow nearby enemies
                const enemies = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                const unitTile = this.grid.getTile(unit.gridPosition.col, unit.gridPosition.row);
                if (unitTile) {
                    for (const enemy of enemies.filter(e => e.isAlive)) {
                        const enemyTile = this.grid.getTile(enemy.gridPosition.col, enemy.gridPosition.row);
                        if (enemyTile && this.grid.getDistance(unitTile, enemyTile) <= 2) {
                            enemy.applyStatusEffect({ type: 'slow', duration: 2, value: 30 });
                        }
                    }
                    this.createVFX(unit.gridPosition.col, unit.gridPosition.row, Element.ICE);
                }
                break;
                
            case 'earth_golem':
                // Stone Skin - shield self
                unit.applyStatusEffect({ type: 'shield', duration: 2, value: 15 });
                this.createVFX(unit.gridPosition.col, unit.gridPosition.row, Element.EARTH);
                break;
                
            case 'lightning_sprite':
                // Chain Lightning - hits multiple targets
                if (target?.isAlive) {
                    const chainTargets = this.getChainTargets(target, 2, unit.team);
                    const damage = unit.getEffectiveAttack();
                    
                    for (const chainTarget of chainTargets) {
                        chainTarget.takeDamage(damage, unit);
                        this.createVFX(chainTarget.gridPosition.col, chainTarget.gridPosition.row, Element.LIGHTNING);
                        await this.delay(100);
                    }
                }
                break;
                
            case 'fire_warrior':
                // Blazing Charge - dash through enemies
                if (target?.isAlive) {
                    await this.animateDash(unit, target);
                    const enemiesInLine = this.getUnitsInLine(unit, target);
                    for (const enemy of enemiesInLine) {
                        enemy.takeDamage(unit.getEffectiveAttack() * 0.8, unit);
                        enemy.applyStatusEffect({ type: 'burn', duration: 1, value: 5 });
                    }
                }
                break;
                
            case 'ice_archer':
                // Frost Arrow - freeze target
                if (target?.isAlive) {
                    target.takeDamage(unit.getEffectiveAttack() * 1.2, unit);
                    target.applyStatusEffect({ type: 'freeze', duration: 1, value: 100 });
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.ICE);
                }
                break;
                
            case 'arcane_mage':
                // Arcane Blast - high damage
                if (target?.isAlive) {
                    target.takeDamage(unit.getEffectiveAttack() * 2, unit);
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.ARCANE);
                }
                break;
            
            // ===== NEW TIER 1 UNITS =====
            case 'earth_archer':
                // Boulder Toss - stuns target
                if (target?.isAlive) {
                    target.takeDamage(unit.getEffectiveAttack() * 1.3, unit);
                    target.applyStatusEffect({ type: 'freeze', duration: 1, value: 100 }); // Stun = freeze
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.EARTH);
                }
                break;
                
            case 'fire_scout':
                // Fire Bolt - quick ranged attack with minor burn
                if (target?.isAlive) {
                    target.takeDamage(unit.getEffectiveAttack() * 1.4, unit);
                    target.applyStatusEffect({ type: 'burn', duration: 1, value: 5 });
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.FIRE);
                }
                break;
            
            // ===== NEW TIER 2 UNITS =====
            case 'lightning_knight':
                // Thunder Strike - stuns and bonus damage
                if (target?.isAlive) {
                    target.takeDamage(unit.getEffectiveAttack() * 1.6, unit);
                    target.applyStatusEffect({ type: 'freeze', duration: 1, value: 100 }); // Stun
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.LIGHTNING);
                }
                break;
                
            case 'ice_guardian':
                // Frozen Wall - shield self and slow attackers
                unit.applyStatusEffect({ type: 'shield', duration: 3, value: 25 });
                // Slow all enemies
                {
                    const enemies = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    for (const enemy of enemies.filter(e => e.isAlive)) {
                        enemy.applyStatusEffect({ type: 'slow', duration: 2, value: 25 });
                    }
                }
                this.createVFX(unit.gridPosition.col, unit.gridPosition.row, Element.ICE);
                break;
                
            case 'arcane_assassin':
                // Shadow Strike - critical hit
                if (target?.isAlive) {
                    // High crit chance (50%)
                    const isCrit = Math.random() < 0.5;
                    const damage = unit.getEffectiveAttack() * (isCrit ? 2.5 : 1.5);
                    target.takeDamage(damage, unit);
                    if (isCrit) {
                        this.showFloatingText(target.gridPosition.col, target.gridPosition.row, 'CRIT!', 0xff00ff);
                    }
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.ARCANE);
                }
                break;
            
            // ===== NEW TIER 3 UNITS =====
            case 'lightning_lord':
                // Thunder Storm - chain lightning to ALL enemies
                {
                    const enemies = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    for (const enemy of enemies.filter(e => e.isAlive)) {
                        enemy.takeDamage(unit.getEffectiveAttack() * 0.7, unit);
                        this.createVFX(enemy.gridPosition.col, enemy.gridPosition.row, Element.LIGHTNING);
                        await this.delay(80);
                    }
                }
                break;
                
            case 'ice_empress':
                // Blizzard - freeze and damage all
                {
                    const enemies = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    for (const enemy of enemies.filter(e => e.isAlive)) {
                        enemy.takeDamage(unit.getEffectiveAttack() * 0.5, unit);
                        enemy.applyStatusEffect({ type: 'freeze', duration: 1, value: 100 });
                        enemy.applyStatusEffect({ type: 'slow', duration: 2, value: 30 });
                        this.createVFX(enemy.gridPosition.col, enemy.gridPosition.row, Element.ICE);
                    }
                    this.createAoEVFX(Element.ICE);
                }
                break;
                
            case 'fire_demon':
                // Hellfire - AoE to up to 3 enemies within range 2
                {
                    const allEnemies = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    const maxTargets = unit.definition.ability.maxTargets || 3;
                    const range = unit.stats.range || 2;
                    
                    // Filter enemies within range
                    const inRangeEnemies = allEnemies.filter(e => {
                        if (!e.isAlive) return false;
                        const rowDist = Math.abs(e.gridPosition.row - unit.gridPosition.row);
                        return rowDist <= range;
                    });
                    
                    // Take up to maxTargets enemies (sorted by HP - focus weakest)
                    const targets = inRangeEnemies
                        .sort((a, b) => a.stats.hp - b.stats.hp)
                        .slice(0, maxTargets);
                    
                    for (const enemy of targets) {
                        enemy.takeDamage(unit.getEffectiveAttack() * 0.6, unit);
                        enemy.applyStatusEffect({ type: 'burn', duration: 2, value: 10 });
                    }
                    if (targets.length > 0) {
                        this.createAoEVFX(Element.FIRE);
                    }
                }
                break;
                
            case 'martial_master':
                // Thousand Fists - multiple strikes
                if (target?.isAlive) {
                    for (let i = 0; i < 4; i++) {
                        if (!target.isAlive) break;
                        target.takeDamage(unit.getEffectiveAttack() * 0.4, unit);
                        await this.delay(100);
                    }
                }
                break;
            
            // ===== HEALER UNITS =====
            case 'frost_fairy':
                // Healing Frost - heals lowest HP ally for 20 HP
                // Re-evaluate target at execution time to find CURRENT lowest HP ally
                {
                    const currentHealTarget = this.findHealTarget(unit);
                    if (currentHealTarget?.isAlive && currentHealTarget.team === unit.team) {
                        const healAmount = unit.definition.ability.healAmount || 20;
                        this.healUnit(currentHealTarget, healAmount, unit);
                        this.createHealVFX(currentHealTarget.gridPosition.col, currentHealTarget.gridPosition.row);
                    } else if (currentHealTarget?.isAlive) {
                        // Attack if no ally to heal
                        currentHealTarget.takeDamage(unit.getEffectiveAttack(), unit);
                        this.createVFX(currentHealTarget.gridPosition.col, currentHealTarget.gridPosition.row, Element.ICE);
                    }
                }
                break;
                
            case 'nature_spirit':
                // Rejuvenate - heals ALL allies for 15 HP
                {
                    const allies = unit.team === 'player' ? this.playerUnits : this.enemyUnits;
                    const healAmount = unit.definition.ability.healAmount || 15;
                    let healedAny = false;
                    for (const ally of allies.filter(a => a.isAlive)) {
                        if (ally.stats.hp < ally.stats.maxHp) {
                            this.healUnit(ally, healAmount, unit);
                            healedAny = true;
                        }
                    }
                    if (healedAny) {
                        this.createHealVFX(unit.gridPosition.col, unit.gridPosition.row);
                    }
                }
                break;
                
            case 'arcane_priest':
                // Arcane Restoration - heals ally for 25 HP + shields
                // Re-evaluate target at execution time to find CURRENT lowest HP ally
                {
                    const currentHealTarget = this.findHealTarget(unit);
                    if (currentHealTarget?.isAlive && currentHealTarget.team === unit.team) {
                        const healAmount = unit.definition.ability.healAmount || 25;
                        this.healUnit(currentHealTarget, healAmount, unit);
                        currentHealTarget.applyStatusEffect({ type: 'shield', duration: 2, value: 10 });
                        this.createHealVFX(currentHealTarget.gridPosition.col, currentHealTarget.gridPosition.row);
                        this.createVFX(currentHealTarget.gridPosition.col, currentHealTarget.gridPosition.row, Element.ARCANE);
                    } else if (currentHealTarget?.isAlive) {
                        // Attack if no ally to heal
                        currentHealTarget.takeDamage(unit.getEffectiveAttack() * 1.3, unit);
                        this.createVFX(currentHealTarget.gridPosition.col, currentHealTarget.gridPosition.row, Element.ARCANE);
                    }
                }
                break;
                
            case 'life_guardian':
                // Guardian's Blessing - heals ALL allies 30 HP + barrier
                {
                    const allies = unit.team === 'player' ? this.playerUnits : this.enemyUnits;
                    const healAmount = unit.definition.ability.healAmount || 30;
                    for (const ally of allies.filter(a => a.isAlive)) {
                        this.healUnit(ally, healAmount, unit);
                        ally.applyStatusEffect({ type: 'shield', duration: 2, value: 15 });
                    }
                    this.createHealVFX(unit.gridPosition.col, unit.gridPosition.row);
                    this.createVFX(unit.gridPosition.col, unit.gridPosition.row, Element.EARTH);
                }
                break;
            
            // ===== BLOODTEARS FACTION (Lifesteal) =====
            case 'blood_sprite':
                // Drain Touch - melee attack, heal for 40% of damage dealt
                if (target?.isAlive) {
                    const damage = unit.getEffectiveAttack() * 1.4;
                    target.takeDamage(damage, unit);
                    const lifestealAmount = Math.floor(damage * 0.4);
                    this.healUnit(unit, lifestealAmount, unit);
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.FIRE);
                    this.createLifestealVFX(target, unit);
                }
                break;
                
            case 'blood_knight':
                // Crimson Cleave - AoE lifesteal, hits target + nearby enemies
                {
                    const allEnemies = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    const maxTargets = unit.definition.ability.maxTargets || 3;
                    
                    // Get enemies in same or adjacent lanes
                    const inRange = allEnemies.filter(e => {
                        if (!e.isAlive) return false;
                        const colDist = Math.abs(e.gridPosition.col - unit.gridPosition.col);
                        const rowDist = Math.abs(e.gridPosition.row - unit.gridPosition.row);
                        return colDist <= 1 && rowDist <= 2;
                    }).slice(0, maxTargets);
                    
                    let totalDamage = 0;
                    for (const enemy of inRange) {
                        const damage = unit.getEffectiveAttack() * 1.2;
                        enemy.takeDamage(damage, unit);
                        totalDamage += damage;
                        this.createVFX(enemy.gridPosition.col, enemy.gridPosition.row, Element.FIRE);
                        await this.delay(80);
                    }
                    // Heal for 30% of total damage
                    if (totalDamage > 0) {
                        const lifestealAmount = Math.floor(totalDamage * 0.3);
                        this.healUnit(unit, lifestealAmount, unit);
                        this.createLifestealVFX(inRange[0] || target!, unit);
                    }
                }
                break;
            
            // ===== KONJI FACTION (Poison) =====
            case 'konji_scout':
                // Toxic Dart - ranged attack + 3-turn poison
                if (target?.isAlive) {
                    target.takeDamage(unit.getEffectiveAttack() * 1.2, unit);
                    target.applyStatusEffect({ type: 'poison', duration: 3, value: 6 });
                    this.createPoisonVFX(target.gridPosition.col, target.gridPosition.row);
                }
                break;
                
            case 'konji_shaman':
                // Plague Cloud - AoE poison to all enemies + minor damage
                {
                    const enemies = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    for (const enemy of enemies.filter(e => e.isAlive)) {
                        enemy.takeDamage(unit.getEffectiveAttack() * 0.3, unit);
                        enemy.applyStatusEffect({ type: 'poison', duration: 2, value: 8 });
                        this.createPoisonVFX(enemy.gridPosition.col, enemy.gridPosition.row);
                        await this.delay(60);
                    }
                    // Show ability text
                    const pos = this.grid.gridToWorld(unit.gridPosition.col, unit.gridPosition.row);
                    const abilityText = this.scene.add.text(pos.x, pos.y - 40, '☠️ PLAGUE!', {
                        fontSize: '14px',
                        color: '#44aa00',
                        fontStyle: 'bold',
                        stroke: '#000000',
                        strokeThickness: 2
                    }).setOrigin(0.5);
                    this.scene.tweens.add({
                        targets: abilityText,
                        y: pos.y - 70,
                        alpha: 0,
                        duration: 1200,
                        ease: 'Cubic.easeOut',
                        onComplete: () => abilityText.destroy()
                    });
                }
                break;

            // ===== BOSS ABILITIES =====
            case 'boss_flame_tyrant':
                // Tyrant's Wrath - AoE fire + burn
                {
                    const targets = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    for (const enemy of targets.filter(e => e.isAlive)) {
                        enemy.takeDamage(unit.getEffectiveAttack() * 0.6, unit);
                        enemy.applyStatusEffect({ type: 'burn', duration: 2, value: 10 });
                        this.createVFX(enemy.gridPosition.col, enemy.gridPosition.row, Element.FIRE);
                        await this.delay(100);
                    }
                    this.createAoEVFX(Element.FIRE);
                    this.showBossAbilityText('🔥 TYRANT\'S WRATH! 🔥');
                }
                break;
                
            case 'boss_frost_colossus':
                // Absolute Zero - freeze + minor damage + self-heal (nerfed)
                {
                    const targets = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    const freezeDuration = unit.definition.ability.freezeDuration || 1;
                    for (const enemy of targets.filter(e => e.isAlive)) {
                        enemy.applyStatusEffect({ type: 'freeze', duration: freezeDuration, value: 100 });
                        enemy.takeDamage(unit.getEffectiveAttack() * 0.3, unit);
                        this.createVFX(enemy.gridPosition.col, enemy.gridPosition.row, Element.ICE);
                    }
                    // Self heal (uses config value, now 50)
                    const healAmount = unit.definition.ability.healAmount || 50;
                    this.healUnit(unit, healAmount, unit);
                    this.createHealVFX(unit.gridPosition.col, unit.gridPosition.row);
                    this.showBossAbilityText('🧊 ABSOLUTE ZERO! 🧊');
                }
                break;
                
            case 'boss_chaos_overlord':
                // Elemental Cataclysm - multi-element (nerfed)
                {
                    const targets = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    const elements = [Element.FIRE, Element.ICE, Element.LIGHTNING, Element.ARCANE];
                    
                    // Check for enrage (below 30% HP)
                    const hpPercent = unit.stats.hp / unit.stats.maxHp;
                    const enraged = hpPercent < 0.3;
                    const damageMultiplier = enraged ? 1.2 : 1.0;
                    
                    if (enraged) {
                        this.showBossAbilityText('💀 ENRAGED! CATACLYSM! 💀');
                    } else {
                        this.showBossAbilityText('⚡ ELEMENTAL CATACLYSM! ⚡');
                    }
                    
                    for (const enemy of targets.filter(e => e.isAlive)) {
                        // Random element per target
                        const element = elements[Math.floor(Math.random() * elements.length)];
                        enemy.takeDamage(unit.getEffectiveAttack() * 0.4 * damageMultiplier, unit);
                        
                        // Apply element-specific effect
                        if (element === Element.FIRE) {
                            enemy.applyStatusEffect({ type: 'burn', duration: 2, value: 6 });
                        } else if (element === Element.ICE) {
                            enemy.applyStatusEffect({ type: 'slow', duration: 2, value: 30 });
                        }
                        
                        this.createVFX(enemy.gridPosition.col, enemy.gridPosition.row, element);
                        await this.delay(80);
                    }
                    
                    // If enraged, minor heal
                    if (enraged) {
                        this.healUnit(unit, 30, unit);
                    }
                }
                break;
                
            // === VOID UNITS ===
            case 'void_shade':
                // Shadow Phase - becomes untargetable for 1 turn, deal stealth damage
                unit.applyStatusEffect({ type: 'untargetable', duration: 1, value: 1 });
                if (target?.isAlive) {
                    // Stealth strike from shadows
                    target.takeDamage(unit.getEffectiveAttack() * 1.8, unit);
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.VOID);
                }
                break;
                
            case 'void_knight':
                // Corruption Strike - bonus damage and weakens target
                if (target?.isAlive) {
                    const corruptionDamage = unit.getEffectiveAttack() * 2.0;
                    target.takeDamage(corruptionDamage, unit);
                    target.applyStatusEffect({ type: 'weaken', duration: 2, value: 25 });
                    this.createVFX(target.gridPosition.col, target.gridPosition.row, Element.VOID);
                }
                break;
                
            case 'void_horror':
                // Void Rupture - AoE dark damage that ignores defense
                {
                    const enemies = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    const aliveEnemies = enemies.filter(e => e.isAlive);
                    
                    // === Void Rupture VFX: dark pulse from caster ===
                    const casterPos = this.grid.gridToWorld(unit.gridPosition.col, unit.gridPosition.row);
                    
                    // Dark screen flash (respects settings)
                    if (localStorage.getItem('ss_screen_flash') !== 'false') {
                        const darkFlash = this.scene.add.rectangle(this.scene.scale.width / 2, this.scene.scale.height / 2, this.scene.scale.width, this.scene.scale.height, 0x220033, 0.4);
                        darkFlash.setDepth(50);
                        this.scene.tweens.add({
                            targets: darkFlash,
                            alpha: 0,
                            duration: 600,
                            onComplete: () => darkFlash.destroy()
                        });
                    }
                    
                    // Expanding dark ring from caster
                    const ring = this.scene.add.circle(casterPos.x, casterPos.y, 10, 0x332244, 0);
                    ring.setStrokeStyle(4, 0x8844aa, 0.9);
                    this.scene.tweens.add({
                        targets: ring,
                        scaleX: 8,
                        scaleY: 8,
                        alpha: 0,
                        duration: 500,
                        ease: 'Cubic.easeOut',
                        onComplete: () => ring.destroy()
                    });
                    
                    await this.delay(150);
                    
                    for (const enemy of aliveEnemies) {
                        // Ignores defense - deal flat damage based on attack
                        const rawDamage = Math.floor(unit.getEffectiveAttack() * 0.8);
                        // Bypass defense but still show damage number
                        enemy.stats.hp = Math.max(0, enemy.stats.hp - rawDamage);
                        enemy.updateHealthBar();
                        enemy.showDamageNumber(rawDamage);
                        
                        // Dark impact burst on each target
                        this.createVoidRuptureImpact(enemy.gridPosition.col, enemy.gridPosition.row);
                        await this.delay(80);
                    }
                }
                break;
                
            case 'void_blighter':
                // Cursed Wound - applies Wound to enemies, reducing healing by 50%
                {
                    const enemies = unit.team === 'player' ? this.enemyUnits : this.playerUnits;
                    const aliveEnemies = enemies.filter(e => e.isAlive);
                    
                    for (const enemy of aliveEnemies) {
                        // Deal some damage
                        enemy.takeDamage(unit.getEffectiveAttack() * 0.6, unit);
                        // Apply wound - 50% healing reduction
                        enemy.applyStatusEffect({ type: 'wound', duration: 3, value: 50 });
                        this.createVFX(enemy.gridPosition.col, enemy.gridPosition.row, Element.VOID);
                        await this.delay(50);
                    }
                    
                    // Show ability text
                    const pos = this.grid.gridToWorld(unit.gridPosition.col, unit.gridPosition.row);
                    const abilityText = this.scene.add.text(pos.x, pos.y - 40, '💀 CURSED!', {
                        fontSize: '14px',
                        color: '#aa44ff',
                        fontStyle: 'bold',
                        stroke: '#000000',
                        strokeThickness: 2
                    }).setOrigin(0.5);
                    
                    this.scene.tweens.add({
                        targets: abilityText,
                        y: pos.y - 70,
                        alpha: 0,
                        duration: 1200,
                        ease: 'Cubic.easeOut',
                        onComplete: () => abilityText.destroy()
                    });
                }
                break;
                
            default:
                // Default ability - just enhanced attack
                if (target?.isAlive) {
                    target.takeDamage(unit.getEffectiveAttack() * 1.5, unit);
                }
        }
    }

    private async executeMove(unit: Unit, target: Unit | null): Promise<void> {
        if (!target) return;
        
        // Lane-based movement: move toward battle line (row 2)
        // Player units move UP (row--), enemy units move DOWN (row++)
        
        // Determine the best tile to move to
        const bestTile = this.findBestMoveTileLaneBased(unit, target);
        
        if (!bestTile) {
            console.log(`  ${unit.definition.name} found no valid move tile`);
            return;
        }
        
        // Collision check - shouldn't happen often in lane-based but be safe
        const allUnits = [...this.playerUnits, ...this.enemyUnits];
        const collision = allUnits.find(u => 
            u !== unit && 
            u.isAlive && 
            u.gridPosition.col === bestTile.col && 
            u.gridPosition.row === bestTile.row
        );
        
        if (collision) {
            console.log(`  ${unit.definition.name} blocked by ${collision.definition.name}`);
            return;
        }
        
        // Store old position
        const oldCol = unit.gridPosition.col;
        const oldRow = unit.gridPosition.row;
        
        // Update unit's logical position
        unit.gridPosition = { col: bestTile.col, row: bestTile.row };
        
        // Update grid state
        this.grid.setOccupied(oldCol, oldRow, null);
        this.grid.setOccupied(bestTile.col, bestTile.row, unit.id);
        
        // Move unit visually
        const worldPos = this.grid.gridToWorld(bestTile.col, bestTile.row);
        await unit.moveTo(this.scene, worldPos.x, worldPos.y, bestTile.col, bestTile.row);
        
        console.log(`${unit.definition.name} moved from ${oldCol},${oldRow} to ${bestTile.col},${bestTile.row}`);
    }

    private findBestMoveTileLaneBased(unit: Unit, target: Unit): GridTile | null {
        const battleLineRow = 2;  // GRID_CONFIG.battleLineRow
        const currentCol = unit.gridPosition.col;
        const currentRow = unit.gridPosition.row;
        
        // Get occupied positions
        const allUnits = [...this.playerUnits, ...this.enemyUnits];
        const occupied = new Set<string>();
        for (const u of allUnits) {
            if (u !== unit && u.isAlive) {
                occupied.add(`${u.gridPosition.col},${u.gridPosition.row}`);
            }
        }
        for (const reserved of this.reservedTiles) {
            occupied.add(reserved);
        }
        
        // Determine movement direction and limits
        let preferredRow: number;
        if (unit.team === 'player') {
            // Player moves UP (toward lower row numbers), min = battleLineRow
            preferredRow = Math.max(currentRow - 1, battleLineRow);
        } else {
            // Enemy moves DOWN (toward higher row numbers), max = battleLineRow  
            preferredRow = Math.min(currentRow + 1, battleLineRow);
        }
        
        // If already at the limit row, can't move forward
        if (preferredRow === currentRow) {
            // Try horizontal movement toward target's column
            const colDir = target.gridPosition.col > currentCol ? 1 : 
                          target.gridPosition.col < currentCol ? -1 : 0;
            
            if (colDir !== 0) {
                const newCol = currentCol + colDir;
                const tile = this.grid.getTile(newCol, currentRow);
                if (tile && !occupied.has(`${newCol},${currentRow}`)) {
                    this.reservedTiles.add(`${newCol},${currentRow}`);
                    return tile;
                }
            }
            return null;  // Can't move
        }
        
        // Priority 1: Move forward in same column
        let tile = this.grid.getTile(currentCol, preferredRow);
        if (tile && !occupied.has(`${currentCol},${preferredRow}`)) {
            this.reservedTiles.add(`${currentCol},${preferredRow}`);
            return tile;
        }
        
        // Priority 2: Move diagonally toward target's column while moving forward
        const colDir = target.gridPosition.col > currentCol ? 1 : 
                      target.gridPosition.col < currentCol ? -1 : 0;
        
        if (colDir !== 0) {
            const diagCol = currentCol + colDir;
            tile = this.grid.getTile(diagCol, preferredRow);
            if (tile && !occupied.has(`${diagCol},${preferredRow}`)) {
                this.reservedTiles.add(`${diagCol},${preferredRow}`);
                return tile;
            }
        }
        
        // Priority 3: Move diagonally away from target (just to advance)
        if (colDir !== 0) {
            const oppDiagCol = currentCol - colDir;
            tile = this.grid.getTile(oppDiagCol, preferredRow);
            if (tile && !occupied.has(`${oppDiagCol},${preferredRow}`)) {
                this.reservedTiles.add(`${oppDiagCol},${preferredRow}`);
                return tile;
            }
        }
        
        return null;  // No valid move
    }

    // =========================================================================
    // ANIMATIONS & VFX
    // =========================================================================

    private async animateAttack(attacker: Unit, target: Unit): Promise<void> {
        if (!attacker.container || !target.container) return;
        
        const originalX = attacker.container.x;
        const originalY = attacker.container.y;
        
        // Lunge toward target
        const dx = (target.container.x - originalX) * 0.3;
        const dy = (target.container.y - originalY) * 0.3;
        
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: attacker.container,
                x: originalX + dx,
                y: originalY + dy,
                duration: 80,
                ease: 'Power3',
                onComplete: () => {
                    // === HIT-STOP: freeze briefly on impact ===
                    this.createImpactFX(target.container!.x, target.container!.y, attacker.getElement());
                    
                    // Brief camera shake proportional to damage
                    if (localStorage.getItem('ss_screen_shake') !== 'false' && !this.isShaking) {
                        this.isShaking = true;
                        this.scene.cameras.main.shake(120, 0.005);
                        this.scene.time.delayedCall(120, () => { this.isShaking = false; });
                    }
                    
                    // Hit-stop pause then return
                    this.scene.time.delayedCall(60, () => {
                        this.scene.tweens.add({
                            targets: attacker.container,
                            x: originalX,
                            y: originalY,
                            duration: 80,
                            ease: 'Power2',
                            onComplete: () => resolve()
                        });
                    });
                }
            });
        });
    }

    private async animateAbility(unit: Unit): Promise<void> {
        if (!unit.container) return;
        
        const color = ELEMENT_COLORS[unit.getElement()];
        const cx = unit.container.x;
        const cy = unit.container.y;
        
        const flashEnabled = localStorage.getItem('ss_screen_flash') !== 'false';
        
        // === DRAMATIC ABILITY ACTIVATION ===
        // Screen-wide flash (subtle) - only if enabled
        if (flashEnabled) {
            const flash = this.scene.add.rectangle(this.scene.scale.width / 2, this.scene.scale.height / 2, this.scene.scale.width, this.scene.scale.height, color, 0.15);
            flash.setDepth(180);
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 300,
                onComplete: () => flash.destroy()
            });
        }
        
        // Inner aura ring (expanding)
        const ring = this.scene.add.circle(cx, cy, 15, 0, 0);
        ring.setStrokeStyle(3, color);
        ring.setDepth(35);
        
        // Outer glow burst
        const glow = this.scene.add.circle(cx, cy, 20, color, 0.5);
        glow.setDepth(34);
        
        // Rising energy particles
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const p = this.scene.add.circle(cx, cy, 4, color, 0.8);
            p.setDepth(36);
            this.scene.tweens.add({
                targets: p,
                x: cx + Math.cos(angle) * 45,
                y: cy + Math.sin(angle) * 45 - 20,
                alpha: 0,
                scale: 0.3,
                duration: 400,
                delay: i * 30,
                ease: 'Cubic.easeOut',
                onComplete: () => p.destroy()
            });
        }
        
        return new Promise(resolve => {
            // Pulse the unit
            this.scene.tweens.add({
                targets: unit.container,
                scaleX: 1.15,
                scaleY: 1.15,
                duration: 150,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
            
            this.scene.tweens.add({
                targets: ring,
                radius: { from: 15, to: 55 },
                alpha: { from: 1, to: 0 },
                duration: 350,
                onComplete: () => ring.destroy()
            });
            
            this.scene.tweens.add({
                targets: glow,
                alpha: 0,
                scale: 3,
                duration: 450,
                onComplete: () => {
                    glow.destroy();
                    resolve();
                }
            });
        });
    }

    private async animateDash(unit: Unit, target: Unit): Promise<void> {
        if (!unit.container) return;
        
        // Store original position to return to (this is a dash ATTACK, not a move)
        const originalPos = {
            x: unit.container.x,
            y: unit.container.y
        };
        
        const targetPos = this.grid.gridToWorld(target.gridPosition.col, target.gridPosition.row);
        
        // Create trail effect
        const trail = this.scene.add.graphics();
        trail.fillStyle(ELEMENT_COLORS[unit.getElement()], 0.5);
        
        return new Promise(resolve => {
            // Dash TO target
            this.scene.tweens.add({
                targets: unit.container,
                x: targetPos.x,
                y: targetPos.y,
                duration: 150,
                ease: 'Power2',
                onUpdate: () => {
                    if (unit.container) {
                        trail.fillCircle(unit.container.x, unit.container.y, 15);
                    }
                },
                onComplete: () => {
                    // Dash BACK to original position
                    this.scene.tweens.add({
                        targets: unit.container,
                        x: originalPos.x,
                        y: originalPos.y,
                        duration: 150,
                        ease: 'Power2',
                        onComplete: () => {
                            this.scene.tweens.add({
                                targets: trail,
                                alpha: 0,
                                duration: 200,
                                onComplete: () => trail.destroy()
                            });
                            resolve();
                        }
                    });
                }
            });
        });
    }

    // =========================================================================
    // ANIME VFX SYSTEM
    // =========================================================================

    /**
     * Impact flash + speed lines at point of contact (anime-style hit)
     */
    private createImpactFX(x: number, y: number, element: Element): void {
        const color = ELEMENT_COLORS[element];
        
        // White impact flash (small, centered on target)
        const flash = this.scene.add.circle(x, y, 8, 0xffffff, 0.9);
        flash.setDepth(40);
        this.scene.tweens.add({
            targets: flash,
            scale: 4,
            alpha: 0,
            duration: 200,
            ease: 'Cubic.easeOut',
            onComplete: () => flash.destroy()
        });
        
        // Radial speed lines (anime impact streaks)
        const lineCount = 8;
        for (let i = 0; i < lineCount; i++) {
            const angle = (i / lineCount) * Math.PI * 2 + Math.random() * 0.3;
            const len = 20 + Math.random() * 25;
            const startR = 12;
            const line = this.scene.add.graphics();
            line.lineStyle(2, color, 0.8);
            line.lineBetween(
                x + Math.cos(angle) * startR,
                y + Math.sin(angle) * startR,
                x + Math.cos(angle) * (startR + len),
                y + Math.sin(angle) * (startR + len)
            );
            line.setDepth(39);
            
            this.scene.tweens.add({
                targets: line,
                alpha: 0,
                duration: 250,
                delay: 30,
                onComplete: () => line.destroy()
            });
        }
        
        // Small colored sparks
        for (let i = 0; i < 4; i++) {
            const spark = this.scene.add.circle(
                x + (Math.random() - 0.5) * 10,
                y + (Math.random() - 0.5) * 10,
                3, color, 1
            );
            spark.setDepth(41);
            const sAngle = Math.random() * Math.PI * 2;
            this.scene.tweens.add({
                targets: spark,
                x: x + Math.cos(sAngle) * (30 + Math.random() * 20),
                y: y + Math.sin(sAngle) * (30 + Math.random() * 20),
                alpha: 0,
                scale: 0.2,
                duration: 300,
                ease: 'Cubic.easeOut',
                onComplete: () => spark.destroy()
            });
        }
    }

    /**
     * Dramatic kill confirmation effect — burst + text
     */
    public createKillEffect(x: number, y: number): void {
        // Expanding shockwave ring
        const ring = this.scene.add.circle(x, y, 10, 0, 0);
        ring.setStrokeStyle(3, 0xff4444);
        ring.setDepth(45);
        this.scene.tweens.add({
            targets: ring,
            radius: { from: 10, to: 60 },
            alpha: { from: 1, to: 0 },
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => ring.destroy()
        });
        
        // Scatter debris particles
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 40;
            const size = 3 + Math.random() * 4;
            const debris = this.scene.add.rectangle(x, y, size, size, 0xffffff, 0.7);
            debris.setAngle(Math.random() * 360);
            debris.setDepth(44);
            
            this.scene.tweens.add({
                targets: debris,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist - 15,
                alpha: 0,
                angle: debris.angle + (Math.random() - 0.5) * 360,
                duration: 400 + Math.random() * 200,
                ease: 'Cubic.easeOut',
                onComplete: () => debris.destroy()
            });
        }
        
        // Camera shake
        if (localStorage.getItem('ss_screen_shake') !== 'false' && !this.isShaking) {
            this.isShaking = true;
            this.scene.cameras.main.shake(200, 0.008);
            this.scene.time.delayedCall(200, () => { this.isShaking = false; });
        }
    }

    private createVFX(col: number, row: number, element: Element): void {
        const pos = this.grid.gridToWorld(col, row);
        const color = ELEMENT_COLORS[element];
        
        // Burst particles
        for (let i = 0; i < 8; i++) {
            const particle = this.scene.add.circle(pos.x, pos.y, 8, color, 1);
            const angle = (i / 8) * Math.PI * 2;
            
            this.scene.tweens.add({
                targets: particle,
                x: pos.x + Math.cos(angle) * 50,
                y: pos.y + Math.sin(angle) * 50,
                alpha: 0,
                scale: 0,
                duration: 400,
                onComplete: () => particle.destroy()
            });
        }
    }

    // Dark void impact VFX for Void Rupture ability
    private createVoidRuptureImpact(col: number, row: number): void {
        const pos = this.grid.gridToWorld(col, row);
        
        // Dark imploding particles
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const startX = pos.x + Math.cos(angle) * 40;
            const startY = pos.y + Math.sin(angle) * 40;
            const particle = this.scene.add.circle(startX, startY, 6, 0x8844aa, 0.9);
            
            this.scene.tweens.add({
                targets: particle,
                x: pos.x,
                y: pos.y,
                alpha: 0,
                scale: 0.2,
                duration: 300,
                ease: 'Cubic.easeIn',
                onComplete: () => particle.destroy()
            });
        }
        
        // Central dark burst (delayed)
        this.scene.time.delayedCall(200, () => {
            const burst = this.scene.add.circle(pos.x, pos.y, 5, 0x332244, 0.9);
            this.scene.tweens.add({
                targets: burst,
                scale: 4,
                alpha: 0,
                duration: 350,
                ease: 'Cubic.easeOut',
                onComplete: () => burst.destroy()
            });
        });
    }

    // Heal a unit and show floating text
    private healUnit(target: Unit, amount: number, healer: Unit): void {
        // Check for wound status - reduces healing by 50% per stack
        const woundEffect = target.statusEffects.find(e => e.type === 'wound');
        let healAmount = amount;
        if (woundEffect) {
            const reduction = Math.min(woundEffect.value / 100, 0.9); // Max 90% reduction
            healAmount = Math.floor(amount * (1 - reduction));
            console.log(`  Wound reduces healing by ${Math.round(reduction * 100)}%`);
        }
        
        const oldHp = target.stats.hp;
        target.stats.hp = Math.min(target.stats.hp + healAmount, target.stats.maxHp);
        const actualHeal = target.stats.hp - oldHp;
        
        if (actualHeal > 0) {
            target.updateHealthBar();
            console.log(`  ${healer.definition.name} heals ${target.definition.name} for ${actualHeal} HP`);
            
            // Show floating heal text
            const pos = this.grid.gridToWorld(target.gridPosition.col, target.gridPosition.row);
            const healText = this.scene.add.text(pos.x, pos.y - 30, `+${actualHeal}`, {
                fontSize: '18px',
                color: '#44ff88',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            
            this.scene.tweens.add({
                targets: healText,
                y: pos.y - 70,
                alpha: 0,
                duration: 1000,
                ease: 'Cubic.easeOut',
                onComplete: () => healText.destroy()
            });
        }
    }

    // Green healing VFX
    private createHealVFX(col: number, row: number): void {
        const pos = this.grid.gridToWorld(col, row);
        const healColor = 0x44ff88;
        
        // Rising heal particles
        for (let i = 0; i < 6; i++) {
            const particle = this.scene.add.circle(
                pos.x + (Math.random() - 0.5) * 40, 
                pos.y + 20, 
                6, 
                healColor, 
                0.8
            );
            
            this.scene.tweens.add({
                targets: particle,
                y: pos.y - 50 - Math.random() * 30,
                alpha: 0,
                scale: 0.5,
                duration: 600 + Math.random() * 200,
                delay: i * 50,
                onComplete: () => particle.destroy()
            });
        }
        
        // Heal ring
        const ring = this.scene.add.circle(pos.x, pos.y, 10, 0, 0);
        ring.setStrokeStyle(3, healColor);
        
        this.scene.tweens.add({
            targets: ring,
            radius: { from: 10, to: 50 },
            alpha: { from: 1, to: 0 },
            duration: 400,
            onComplete: () => ring.destroy()
        });
    }

    // Blood-red particles flying from victim to healer
    private createLifestealVFX(from: Unit, to: Unit): void {
        const fromPos = this.grid.gridToWorld(from.gridPosition.col, from.gridPosition.row);
        const toPos = this.grid.gridToWorld(to.gridPosition.col, to.gridPosition.row);
        
        for (let i = 0; i < 5; i++) {
            const particle = this.scene.add.circle(
                fromPos.x + (Math.random() - 0.5) * 20,
                fromPos.y + (Math.random() - 0.5) * 20,
                5, 0xcc0000, 0.9
            );
            particle.setDepth(30);
            
            this.scene.tweens.add({
                targets: particle,
                x: toPos.x + (Math.random() - 0.5) * 10,
                y: toPos.y + (Math.random() - 0.5) * 10,
                alpha: 0,
                scale: 0.3,
                duration: 400 + i * 80,
                delay: i * 60,
                ease: 'Cubic.easeIn',
                onComplete: () => particle.destroy()
            });
        }
    }

    // Green poison cloud particles
    private createPoisonVFX(col: number, row: number): void {
        const pos = this.grid.gridToWorld(col, row);
        
        // Green toxic cloud particles
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const dist = 15 + Math.random() * 20;
            const particle = this.scene.add.circle(
                pos.x + Math.cos(angle) * 5,
                pos.y + Math.sin(angle) * 5,
                5 + Math.random() * 4,
                0x44aa00,
                0.7
            );
            
            this.scene.tweens.add({
                targets: particle,
                x: pos.x + Math.cos(angle) * dist,
                y: pos.y + Math.sin(angle) * dist,
                alpha: 0,
                scale: 1.5,
                duration: 500 + Math.random() * 200,
                delay: i * 30,
                ease: 'Cubic.easeOut',
                onComplete: () => particle.destroy()
            });
        }
        
        // Skull icon flash
        const skull = this.scene.add.text(pos.x, pos.y - 20, '☠️', {
            fontSize: '18px'
        }).setOrigin(0.5).setDepth(35);
        
        this.scene.tweens.add({
            targets: skull,
            y: pos.y - 50,
            alpha: 0,
            scale: 1.5,
            duration: 700,
            ease: 'Cubic.easeOut',
            onComplete: () => skull.destroy()
        });
    }

    private createAoEVFX(element: Element): void {
        const color = ELEMENT_COLORS[element];
        
        // Screen-wide flash (brief, intense) - only if enabled
        if (localStorage.getItem('ss_screen_flash') !== 'false') {
            const flash = this.scene.add.rectangle(this.scene.scale.width / 2, this.scene.scale.height / 2, this.scene.scale.width, this.scene.scale.height, color, 0.35);
            flash.setDepth(180);
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 400,
                onComplete: () => flash.destroy()
            });
        }
        
        // Screen shake for AoE impact
        if (localStorage.getItem('ss_screen_shake') !== 'false' && !this.isShaking) {
            this.isShaking = true;
            this.scene.cameras.main.shake(250, 0.012);
            this.scene.time.delayedCall(250, () => { this.isShaking = false; });
        }
        
        // Radial shockwave ring from center
        const ring = this.scene.add.circle(this.scene.scale.width / 2, this.scene.scale.height / 2, 20, 0, 0);
        ring.setStrokeStyle(4, color);
        ring.setDepth(181);
        this.scene.tweens.add({
            targets: ring,
            radius: { from: 20, to: 300 },
            alpha: { from: 0.8, to: 0 },
            duration: 500,
            ease: 'Cubic.easeOut',
            onComplete: () => ring.destroy()
        });
    }

    private showBossAbilityText(text: string): void {
        // Destroy previous boss text if still visible
        if (this.activeBossText) {
            this.activeBossText.destroy();
            this.activeBossText = null;
        }
        
        // Dramatic boss ability announcement
        const bossText = this.scene.add.text(640, 200, text, {
            fontSize: '32px',
            color: '#ff4444',
            fontStyle: 'bold',
            backgroundColor: '#000000dd',
            padding: { x: 24, y: 12 },
            stroke: '#ffff00',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(200);
        
        this.activeBossText = bossText;
        
        // Guarded shake effect — skip if already shaking or disabled
        if (localStorage.getItem('ss_screen_shake') !== 'false' && !this.isShaking) {
            this.isShaking = true;
            this.scene.cameras.main.shake(300, 0.01);
            this.scene.time.delayedCall(300, () => { this.isShaking = false; });
        }
        
        // Animate out
        this.scene.tweens.add({
            targets: bossText,
            y: 150,
            alpha: 0,
            scale: 1.3,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => {
                bossText.destroy();
                if (this.activeBossText === bossText) {
                    this.activeBossText = null;
                }
            }
        });
    }

    /**
     * Show phase transition banner (⚔️ MOVE PHASE / ✨ ABILITY PHASE / 🗡️ ATTACK PHASE)
     */
    /**
     * Show small action banner at top of screen: "Unit → Action (Target)"
     */
    private showActionBanner(action: BattleAction): void {
        const teamColor = action.unit.team === 'player' ? '#4488ff' : '#ff4444';
        const teamIcon = action.unit.team === 'player' ? '🔵' : '🔴';
        
        let actionText = '';
        switch (action.type) {
            case 'move':
                actionText = `${teamIcon} ${action.unit.definition.name} repositions`;
                break;
            case 'ability':
                actionText = `${teamIcon} ${action.unit.definition.name} → ${action.unit.definition.ability.name}`;
                if (action.target && action.target.team !== action.unit.team) {
                    actionText += ` → ${action.target.definition.name}`;
                }
                break;
            case 'attack':
                actionText = `${teamIcon} ${action.unit.definition.name} attacks ${action.target?.definition.name || ''}`;
                break;
        }
        
        const banner = this.scene.add.text(640, 72, actionText, {
            fontSize: '16px',
            color: teamColor,
            fontStyle: 'bold',
            backgroundColor: '#0a0a1acc',
            padding: { x: 14, y: 5 },
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5).setDepth(180);
        
        this.scene.tweens.add({
            targets: banner,
            alpha: 0,
            y: 62,
            duration: 800,
            delay: 500,
            ease: 'Cubic.easeIn',
            onComplete: () => banner.destroy()
        });
    }

    /**
     * Show turn number banner at the start of each turn
     */
    private showTurnBanner(turnNumber: number): void {
        const banner = this.scene.add.text(640, 35, `— Turn ${turnNumber} —`, {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
            backgroundColor: '#1a1a2ecc',
            padding: { x: 16, y: 4 },
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(190).setAlpha(0);
        
        this.scene.tweens.add({
            targets: banner,
            alpha: 1,
            duration: 200,
            onComplete: () => {
                this.scene.tweens.add({
                    targets: banner,
                    alpha: 0,
                    duration: 300,
                    delay: 600,
                    onComplete: () => banner.destroy()
                });
            }
        });
    }

    private showFloatingText(col: number, row: number, text: string, color: number): void {
        const worldPos = this.grid.gridToWorld(col, row);
        
        const floatText = this.scene.add.text(worldPos.x, worldPos.y - 30, text, {
            fontSize: '18px',
            color: Phaser.Display.Color.IntegerToColor(color).rgba,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(150);
        
        this.scene.tweens.add({
            targets: floatText,
            y: floatText.y - 40,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => floatText.destroy()
        });
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    private getChainTargets(startTarget: Unit, chainCount: number, attackerTeam: UnitTeam): Unit[] {
        const targets: Unit[] = [startTarget];
        const enemies = attackerTeam === 'player' ? this.enemyUnits : this.playerUnits;
        
        let lastTarget = startTarget;
        for (let i = 0; i < chainCount; i++) {
            const nearbyEnemies = enemies.filter(e => 
                e.isAlive && 
                !targets.includes(e) &&
                Math.abs(e.gridPosition.col - lastTarget.gridPosition.col) <= 2 &&
                Math.abs(e.gridPosition.row - lastTarget.gridPosition.row) <= 2
            );
            
            if (nearbyEnemies.length === 0) break;
            
            const nextTarget = nearbyEnemies[Math.floor(Math.random() * nearbyEnemies.length)];
            targets.push(nextTarget);
            lastTarget = nextTarget;
        }
        
        return targets;
    }

    private getUnitsInLine(from: Unit, to: Unit): Unit[] {
        // Get all units between from and to positions
        const enemies = from.team === 'player' ? this.enemyUnits : this.playerUnits;
        
        return enemies.filter(e => {
            if (!e.isAlive) return false;
            
            // Simple line check (same row or column)
            if (from.gridPosition.row === to.gridPosition.row) {
                const minCol = Math.min(from.gridPosition.col, to.gridPosition.col);
                const maxCol = Math.max(from.gridPosition.col, to.gridPosition.col);
                return e.gridPosition.row === from.gridPosition.row &&
                       e.gridPosition.col >= minCol &&
                       e.gridPosition.col <= maxCol;
            }
            
            if (from.gridPosition.col === to.gridPosition.col) {
                const minRow = Math.min(from.gridPosition.row, to.gridPosition.row);
                const maxRow = Math.max(from.gridPosition.row, to.gridPosition.row);
                return e.gridPosition.col === from.gridPosition.col &&
                       e.gridPosition.row >= minRow &&
                       e.gridPosition.row <= maxRow;
            }
            
            return false;
        });
    }

    private checkDeaths(): void {
        for (const unit of [...this.playerUnits, ...this.enemyUnits]) {
            // Only report death ONCE (check !isAlive AND not already reported)
            if (!unit.isAlive && !unit.deathReported) {
                unit.deathReported = true;  // Mark as reported
                
                // Anime kill effect at death position
                if (unit.container) {
                    this.createKillEffect(unit.container.x, unit.container.y);
                }
                
                this.grid.setOccupied(unit.gridPosition.col, unit.gridPosition.row, null);
                if (this.onUnitDeath) {
                    this.onUnitDeath(unit);
                }
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => this.scene.time.delayedCall(ms, resolve));
    }

    private endBattle(result: 'victory' | 'defeat'): void {
        this.state = result;
        console.log(`Battle ended: ${result}`);
        
        if (this.onBattleEnd) {
            this.onBattleEnd(result);
        }
    }

    // =========================================================================
    // GETTERS
    // =========================================================================

    public getState(): BattleState {
        return this.state;
    }

    public getTurnNumber(): number {
        return this.turnNumber;
    }

    public getAlivePlayerUnits(): Unit[] {
        return this.playerUnits.filter(u => u.isAlive);
    }

    public getAliveEnemyUnits(): Unit[] {
        return this.enemyUnits.filter(u => u.isAlive);
    }
}

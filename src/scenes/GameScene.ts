/**
 * Game Scene - Main gameplay scene (v4.0 lane-based combat)
 * Units meet at the battle line and fight within their lanes.
 * Grid: 6 cols × 5 rows. Battle line at row 2.
 */

import Phaser from 'phaser';
import { Grid, GridTile } from '../grid/Grid';
import { Unit, UnitFactory, ELEMENT_TO_COLOR, TIER_TO_SHAPE, GOOD_FACES } from '../entities/Unit';
import { BattleSystem } from '../battle/BattleSystem';
import { 
    GAME_CONFIG,
    UnitDefinition,
    UNIT_DEFINITIONS,
    WAVES,
    ELEMENT_COLORS,
    ELEMENT_SYNERGIES,
    UPGRADES,
    Upgrade,
    Element,
    MAP_LAYOUTS,
    MapLayout,
    BossPhase
} from '../config/GameConfig';

type GamePhase = 'tutorial' | 'shop' | 'positioning' | 'battle' | 'reward' | 'gameover';

// Game font
const FONT = 'Rajdhani, sans-serif';

// Keyword color map for ability descriptions
const KEYWORD_COLORS: Record<string, string> = {
    'burn': '#ff6644',
    'fire': '#ff6644',
    'poison': '#44cc44',
    'poisons': '#44cc44',
    'freeze': '#66bbff',
    'freezes': '#66bbff',
    'frozen': '#66bbff',
    'ice': '#66bbff',
    'slow': '#66bbff',
    'slows': '#66bbff',
    'stun': '#ffcc44',
    'stuns': '#ffcc44',
    'heal': '#44ff88',
    'heals': '#44ff88',
    'shield': '#aacc44',
    'shields': '#aacc44',
    'barrier': '#aacc44',
    'critical': '#ff44ff',
    'damage': '#ff8866',
    'lightning': '#ffff66',
    'chain': '#ffff66',
    'piercing': '#ff88ff',
    'dash': '#ffaa44',
    'buff': '#44ffaa',
    'void': '#aa88cc',
};

export class GameScene extends Phaser.Scene {
    // Core systems
    private grid!: Grid;
    private battleSystem!: BattleSystem;
    
    // Game state
    private phase: GamePhase = 'tutorial';
    private currentWave: number = 1;
    private gold: number = GAME_CONFIG.startingGold;
    private playerUnits: Unit[] = [];
    private enemyUnits: Unit[] = [];
    private score: number = 0;
    private totalKills: number = 0;
    
    // Boss text overlap guard
    private activeBossOverlay: Phaser.GameObjects.Container | null = null;
    private activeBossOverlayBg: Phaser.GameObjects.Rectangle | null = null;
    
    // Synergy tooltip persistence fix
    private activeSynergyTooltip: Phaser.GameObjects.Container | null = null;
    
    // Upgrade state
    private upgradeLevels: Map<string, number> = new Map();
    private currentMaxUnits: number = GAME_CONFIG.maxUnits;
    private currentShopRefreshCost: number = GAME_CONFIG.shopRefreshCost;
    private currentGoldPerWave: number = GAME_CONFIG.goldPerWave;
    private currentInterestRate: number = GAME_CONFIG.interestRate;
    private currentHealingRate: number = GAME_CONFIG.healingRate;
    private refreshesThisRound: number = 0;
    private maxRefreshesPerRound: number = GAME_CONFIG.maxRefreshesPerRound;
    
    // Map state
    private currentMap: MapLayout = MAP_LAYOUTS[0];
    
    // Shop
    private shopUnits: UnitDefinition[] = [];
    private pendingUnit: UnitDefinition | null = null;
    private selectedUnit: Unit | null = null;  // For selling
    private shopOverlayContainer: Phaser.GameObjects.Container | null = null;
    private shopOverlayMask: Phaser.GameObjects.Graphics | null = null;
    
    // UI elements
    private phaseText!: Phaser.GameObjects.Text;
    private goldText!: Phaser.GameObjects.Text;
    private waveText!: Phaser.GameObjects.Text;
    private scoreText!: Phaser.GameObjects.Text;
    private unitCountText!: Phaser.GameObjects.Text;
    private enemyCountText!: Phaser.GameObjects.Text;
    private unitTrackerContainer!: Phaser.GameObjects.Container;
    private unitInfoPanel!: Phaser.GameObjects.Container;
    private actionButtons!: Phaser.GameObjects.Container;
    private turnIndicator!: Phaser.GameObjects.Text;
    private tutorialPanel!: Phaser.GameObjects.Container;
    private placementIndicator!: Phaser.GameObjects.Text;
    private synergyDisplay!: Phaser.GameObjects.Container;
    private upgradePanel!: Phaser.GameObjects.Container;
    private upgradeStatusContainer!: Phaser.GameObjects.Container;
    
    // Background rotation
    private backgroundImage!: Phaser.GameObjects.Image;
    private backgroundKeys: string[] = ['bg_game', 'bg_castles', 'bg_forest', 'bg_empty'];
    private currentBackgroundIndex: number = 0;
    
    // Onboarding state  
    private _onboardingStep: number = 0; // Prefixed - stored for potential future use
    private onboardingTooltip: Phaser.GameObjects.Container | null = null;
    private onboardingOverlay: Phaser.GameObjects.Rectangle | null = null;
    private _isOnboarding: boolean = true; // Prefixed - stored for potential future use

    constructor() {
        super({ key: 'GameScene' });
    }

    init(): void {
        // Reset all state on scene start/restart
        this.phase = 'tutorial';
        this.currentWave = 1;
        this.gold = GAME_CONFIG.startingGold;
        this.playerUnits = [];
        this.enemyUnits = [];
        this.score = 0;
        this.totalKills = 0;
        this.shopUnits = [];
        this.pendingUnit = null;
        this.selectedUnit = null;
        
        // Reset upgrades
        this.upgradeLevels = new Map();
        this.currentMaxUnits = GAME_CONFIG.maxUnits;
        this.currentShopRefreshCost = GAME_CONFIG.shopRefreshCost;
        this.currentGoldPerWave = GAME_CONFIG.goldPerWave;
        this.currentInterestRate = GAME_CONFIG.interestRate;
        this.currentHealingRate = GAME_CONFIG.healingRate;
        
        // Reset onboarding
        this._onboardingStep = 0;
        this._isOnboarding = true;
        
        // Reset background rotation
        this.currentBackgroundIndex = 0;
        
        // Random map for variety!
        this.currentMap = MAP_LAYOUTS[Math.floor(Math.random() * MAP_LAYOUTS.length)];
    }

    create(): void {
        // Get viewport dimensions
        const width = this.scale.width;
        const height = this.scale.height;
        
        // Create layered background (always fills viewport)
        this.createBackground(width, height);
        
        // Create grid with map layout
        this.grid = new Grid(this);
        
        // Reposition grid to center in viewport
        this.grid.reposition(width, height, width < 900 ? 0 : 300);
        
        // Show map name
        this.showMapName();
        
        // Create battle system
        this.battleSystem = new BattleSystem(this, this.grid);
        this.setupBattleCallbacks();
        
        // Create UI
        this.createUI();
        
        // Grid interaction
        this.grid.onTileClick = (tile) => this.handleTileClick(tile);
        
        // Handle viewport resize
        this.scale.on('resize', this.handleResize, this);
        
        // Start guided onboarding for new players
        this.startOnboarding();
    }
    
    private createBackground(width: number, height: number): void {
        // Solid background color
        this.cameras.main.setBackgroundColor('#0d1526');
        
        // Create gradient overlay using graphics (fills entire viewport)
        const gradientBg = this.add.graphics();
        gradientBg.setDepth(-200);
        
        // Radial gradient-like effect with colored rectangles
        // Dark blue base
        gradientBg.fillStyle(0x0d1526, 1);
        gradientBg.fillRect(0, 0, width, height);
        
        // Subtle top-to-bottom gradient band
        gradientBg.fillStyle(0x162033, 0.5);
        gradientBg.fillRect(0, 0, width, height * 0.3);
        
        // Bottom ground gradient
        gradientBg.fillStyle(0x1a2840, 0.4);
        gradientBg.fillRect(0, height * 0.7, width, height * 0.3);
        
        // Optional: Add tiled image background on top (semi-transparent)
        try {
            this.backgroundImage = this.add.image(width / 2, height / 2, 'bg_game');
            // Scale to cover viewport while maintaining aspect ratio
            const scaleX = width / this.backgroundImage.width;
            const scaleY = height / this.backgroundImage.height;
            const scale = Math.max(scaleX, scaleY);
            this.backgroundImage.setScale(scale);
            this.backgroundImage.setAlpha(0.3);
            this.backgroundImage.setDepth(-100);
        } catch (e) {
            // Fallback - no background image, gradient only
        }
        
        // Add atmospheric particles for visual interest
        this.createAtmosphericParticles(width, height);
    }
    
    private createAtmosphericParticles(width: number, height: number): void {
        // Create floating particle effect using simple shapes
        const particleGraphics = this.add.graphics();
        particleGraphics.setDepth(-50);
        particleGraphics.setAlpha(0.15);
        
        // Draw random dots/circles for ambient atmosphere
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = 1 + Math.random() * 2;
            particleGraphics.fillStyle(0x4488cc, 0.3 + Math.random() * 0.3);
            particleGraphics.fillCircle(x, y, radius);
        }
        
        // Animate a subtle drift (optional - can be disabled if performance is a concern)
        this.tweens.add({
            targets: particleGraphics,
            alpha: 0.1,
            duration: 3000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    private handleResize(gameSize: Phaser.Structs.Size): void {
        const width = gameSize.width;
        const height = gameSize.height;
        
        // Update background image to fill new viewport (if exists)
        if (this.backgroundImage) {
            this.backgroundImage.setPosition(width / 2, height / 2);
            const scaleX = width / this.backgroundImage.width;
            const scaleY = height / this.backgroundImage.height;
            const scale = Math.max(scaleX, scaleY);
            this.backgroundImage.setScale(scale);
        }
        
        // Use smaller panel reservation on narrow screens
        const shopPanelWidth = width < 900 ? 0 : 300;
        
        // Reposition grid to center in new viewport
        if (this.grid) {
            this.grid.reposition(width, height, shopPanelWidth);
            
            // Kill any active tweens on units and reposition to correct grid cells
            const repositionUnit = (unit: Unit) => {
                if (unit.container) {
                    this.tweens.killTweensOf(unit.container);
                    const pos = this.grid.gridToWorld(unit.gridPosition.col, unit.gridPosition.row);
                    unit.container.setPosition(pos.x, pos.y);
                }
            };
            
            for (const unit of this.playerUnits) repositionUnit(unit);
            for (const unit of this.enemyUnits) repositionUnit(unit);
        }
        
        // Update unit info panel position
        if (this.unitInfoPanel) {
            this.unitInfoPanel.setPosition(width - 150, 600);
        }
        
        // Update action buttons position
        if (this.actionButtons) {
            const buttonX = (width - shopPanelWidth) / 2;
            this.actionButtons.setPosition(buttonX, height - 90);
        }
        
    }
    
    private showMapName(): void {
        // Show current map name at bottom-left (less intrusive)
        const height = this.scale.height;
        const mapNameText = this.add.text(20, height - 32, ` ${this.currentMap.name}`, {
            fontSize: '25px',
            color: '#888888',
            fontStyle: 'italic bold'
        }).setOrigin(0, 0.5);
        
        // Fade in effect
        mapNameText.setAlpha(0);
        
        this.tweens.add({
            targets: mapNameText,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
    }

    // =========================================================================
    // TUTORIAL SYSTEM
    // =========================================================================

    private showTutorial(): void {
        const previousPhase = this.phase;
        this.phase = 'tutorial';
        
        const W = this.scale.width;
        const H = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;
        
        // Darken background
        const overlay = this.add.rectangle(cx, cy, W, H, 0x000000, 0.85);
        overlay.setDepth(100).setInteractive();
        
        this.tutorialPanel = this.add.container(cx, cy);
        this.tutorialPanel.setDepth(101);
        
        const panelW = 900;
        const panelH = 580;
        
        // Panel background
        const panelBg = this.add.rectangle(0, 0, panelW, panelH, 0x16213e, 1);
        panelBg.setStrokeStyle(2, 0x4488ff);
        const innerGlow = this.add.rectangle(0, 0, panelW - 4, panelH - 4, 0x1a2744, 1);
        
        // Title bar
        const titleY = -panelH / 2 + 28;
        const titleBar = this.add.rectangle(0, titleY, panelW, 56, 0x0d1526, 1);
        const title = this.add.text(0, titleY, '📖 GUIDEBOOK', {
            fontSize: '28px', color: '#4488ff', fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Tab system
        const tabs = ['Basics', 'Combat', 'Elements', 'Tips'];
        let currentTab = 0;
        const tabButtons: Phaser.GameObjects.Container[] = [];
        const tabContents: Phaser.GameObjects.Container[] = [];
        
        tabs.forEach((tabName, i) => {
            const tabX = -270 + i * 180;
            const tabBtn = this.add.container(tabX, -panelH / 2 + 75);
            
            const tabBg = this.add.rectangle(0, 0, 160, 40, i === 0 ? 0x2a4a7a : 0x1a2744, 1);
            tabBg.setStrokeStyle(1, 0x4488ff);
            tabBg.setInteractive({ useHandCursor: true });
            
            const tabText = this.add.text(0, 0, tabName, {
                fontSize: '16px', color: i === 0 ? '#ffffff' : '#999999', fontStyle: 'bold'
            }).setOrigin(0.5);
            
            tabBg.on('pointerdown', () => {
                currentTab = i;
                tabButtons.forEach((btn, j) => {
                    const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
                    const txt = btn.getAt(1) as Phaser.GameObjects.Text;
                    bg.setFillStyle(j === i ? 0x2a4a7a : 0x1a2744);
                    txt.setColor(j === i ? '#ffffff' : '#999999');
                });
                tabContents.forEach((ct, j) => ct.setVisible(j === i));
            });
            tabBg.on('pointerover', () => tabBg.setFillStyle(0x3a5a8a));
            tabBg.on('pointerout', () => tabBg.setFillStyle(i === currentTab ? 0x2a4a7a : 0x1a2744));
            
            tabBtn.add([tabBg, tabText]);
            tabButtons.push(tabBtn);
        });
        
        const bodyStyle = { fontSize: '16px', color: '#cccccc', lineSpacing: 8, align: 'left' as const };
        const headStyle = { fontSize: '18px', color: '#88ddff', fontStyle: 'bold' as const };
        
        // Tab 0: Basics
        const basicsContent = this.add.container(0, 40);
        basicsContent.add(this.add.text(-380, -100, '🎯 OBJECTIVE', headStyle));
        basicsContent.add(this.add.text(-380, -72, 'Defeat all 15 waves to save the realm!\nBoss battles at Waves 5, 10, and 15.', bodyStyle));
        basicsContent.add(this.add.text(-380, -20, '📌 GAME FLOW', headStyle));
        basicsContent.add(this.add.text(-380, 8, '① SHOP — Buy units from the shop panel\n② PLACE — Click blue tiles to deploy your army\n③ BATTLE — Press "Start Battle" when ready\n④ VICTORY — Earn gold, upgrade, repeat!', bodyStyle));
        basicsContent.add(this.add.text(-380, 100, '💰 ECONOMY', headStyle));
        basicsContent.add(this.add.text(-380, 128, '• Earn gold each wave (+ interest on savings)\n• Sell units for 50% value (click unit → Sell)\n• Buy upgrades after Wave 1 for bonuses', bodyStyle));
        tabContents.push(basicsContent);
        
        // Tab 1: Combat
        const combatContent = this.add.container(0, 40);
        combatContent.setVisible(false);
        combatContent.add(this.add.text(-380, -100, '⚔️ LANE COMBAT', headStyle));
        combatContent.add(this.add.text(-380, -72, 'Units fight in their LANE (vertical column).\nBoth armies clash at the BATTLE LINE (row 2).', bodyStyle));
        combatContent.add(this.add.text(-380, -20, '📏 RANGE TYPES', headStyle));
        combatContent.add(this.add.text(-380, 8, '  Melee (1) — Must be adjacent to attack\n  Mid-range (2) — Can hit 2 rows away\n  Ranged (3+) — Strikes across the field', bodyStyle));
        combatContent.add(this.add.text(-380, 80, '🛡️ POSITIONING TIPS', headStyle));
        combatContent.add(this.add.text(-380, 108, '• Place Tanks in FRONT (row 3) to absorb hits\n• Damage dealers in BACK (rows 4–5)\n• Healers behind your front line\n• Check unit roles in the 📚 Glossary', bodyStyle));
        tabContents.push(combatContent);
        
        // Tab 2: Elements
        const elementsContent = this.add.container(0, 30);
        elementsContent.setVisible(false);
        elementsContent.add(this.add.text(-380, -100, '🌀 ELEMENT TYPES', headStyle));
        const elemLines = [
            '🔥 FIRE — High damage, aggressive',
            '🧊 ICE — Defensive, slows enemies',
            '⚡ LIGHTNING — Fast strikers, chain attacks',
            '🌍 EARTH — Tanky, high HP walls',
            '✨ ARCANE — Penetrates defenses',
            '🕳️ VOID — Enemy-exclusive dark power'
        ].join('\n');
        elementsContent.add(this.add.text(-380, -72, elemLines, { ...bodyStyle, lineSpacing: 10 }));
        
        elementsContent.add(this.add.text(-380, 56, '🔗 SYNERGIES', { ...headStyle, color: '#88ff88' }));
        elementsContent.add(this.add.text(-380, 84, '2+ same element → stat bonus!\n3+ same element → even stronger bonus!', bodyStyle));
        elementsContent.add(this.add.text(-380, 132, '🔥 +ATK    🧊 +DEF    ⚡ +SPD    🌍 +HP', {
            fontSize: '16px', color: '#aaaaaa'
        }));
        elementsContent.add(this.add.text(-380, 168, 'Hover the icons on the left to see active bonuses.', {
            fontSize: '14px', color: '#777777', fontStyle: 'italic'
        }));
        tabContents.push(elementsContent);
        
        // Tab 3: Tips
        const tipsContent = this.add.container(0, 40);
        tipsContent.setVisible(false);
        tipsContent.add(this.add.text(-380, -100, '👹 BOSS WAVES', headStyle));
        tipsContent.add(this.add.text(-380, -72, 'Wave 5:  🔥 Flame Tyrant\nWave 10: 🧊 Frost Colossus\nWave 15: ⚡ Chaos Overlord (3 phases!)', bodyStyle));
        tipsContent.add(this.add.text(-380, -4, '🎲 SHOP STRATEGY', headStyle));
        tipsContent.add(this.add.text(-380, 24, '• Refresh costs gold (limited per round)\n• Higher tier units appear in later waves\n• Save 10+ gold for interest bonus!', bodyStyle));
        tipsContent.add(this.add.text(-380, 100, '⚡ PRO TIPS', headStyle));
        tipsContent.add(this.add.text(-380, 128, '• Fill lanes to block enemy paths\n• Stack same-element synergies for big boosts\n• Use 📚 Glossary to learn abilities and roles', bodyStyle));
        tabContents.push(tipsContent);
        
        // Close button
        const closeBtnY = panelH / 2 - 30;
        const closeBtn = this.add.rectangle(0, closeBtnY, 180, 44, 0x44aa44);
        closeBtn.setStrokeStyle(2, 0x66cc66);
        closeBtn.setInteractive({ useHandCursor: true });
        const closeText = this.add.text(0, closeBtnY, previousPhase === 'tutorial' ? '▶ START GAME' : '✕ CLOSE', {
            fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x55bb55));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x44aa44));
        closeBtn.on('pointerdown', () => {
            this.tutorialPanel.destroy();
            overlay.destroy();
            if (previousPhase === 'tutorial') {
                this.startShopPhase();
            } else {
                this.phase = previousPhase;
            }
        });
        
        this.tutorialPanel.add([
            panelBg, innerGlow, titleBar, title,
            ...tabButtons, ...tabContents,
            closeBtn, closeText
        ]);
    }

    // =========================================================================
    // UNIT GLOSSARY SYSTEM
    // =========================================================================
    
    private showGlossary(): void {
        const previousPhase = this.phase;
        this.phase = 'tutorial';
        
        const W = this.scale.width;
        const H = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;
        
        // Darken background
        const overlay = this.add.rectangle(cx, cy, W, H, 0x000000, 0.9);
        overlay.setDepth(100).setInteractive();
        
        const glossaryPanel = this.add.container(cx, cy);
        glossaryPanel.setDepth(101);
        
        const panelW = Math.min(1100, W - 40);
        const panelH = Math.min(660, H - 30);
        
        // Panel background
        const panelBg = this.add.rectangle(0, 0, panelW, panelH, 0x0d1526, 1);
        panelBg.setStrokeStyle(2, 0x4488ff);
        
        // Title bar
        const titleY = -panelH / 2 + 28;
        const titleBar = this.add.rectangle(0, titleY, panelW, 56, 0x0a1020, 1);
        const title = this.add.text(0, titleY, '📖 UNIT GLOSSARY', {
            fontSize: '26px', fontFamily: FONT, color: '#4488ff', fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Element tabs + Boss tab
        const elements = [
            { name: 'Fire', element: Element.FIRE, emoji: '🔥', color: 0xff4444 },
            { name: 'Ice', element: Element.ICE, emoji: '🧊', color: 0x44aaff },
            { name: 'Zap', element: Element.LIGHTNING, emoji: '⚡', color: 0xffff44 },
            { name: 'Earth', element: Element.EARTH, emoji: '🌍', color: 0x88aa44 },
            { name: 'Arcane', element: Element.ARCANE, emoji: '✨', color: 0xaa44ff },
            { name: 'Void', element: Element.VOID, emoji: '🕳️', color: 0x8844aa },
            { name: 'Bosses', element: null as any, emoji: '💀', color: 0xff6600 }
        ];
        
        let currentElement = 0;
        const tabButtons: Phaser.GameObjects.Container[] = [];
        const contentContainers: Phaser.GameObjects.Container[] = [];
        
        // Content area dimensions
        const contentTop = -panelH / 2 + 105;
        const contentBottom = panelH / 2 - 50;
        const contentAreaH = contentBottom - contentTop;
        
        // Tabs — evenly spread
        const tabW = Math.min(110, (panelW - 40) / elements.length);
        const tabGap = 4;
        const totalTabW = elements.length * (tabW + tabGap) - tabGap;
        const tabStartX = -totalTabW / 2 + tabW / 2;
        
        elements.forEach((elem, i) => {
            const tabX = tabStartX + i * (tabW + tabGap);
            const tabBtn = this.add.container(tabX, -panelH / 2 + 76);
            
            const tabBg = this.add.rectangle(0, 0, tabW, 32, i === 0 ? elem.color : 0x1a2744, 0.85);
            tabBg.setStrokeStyle(1, elem.color, 0.6);
            tabBg.setInteractive({ useHandCursor: true });
            
            const tabText = this.add.text(0, 0, `${elem.emoji}${elem.name}`, {
                fontSize: '12px', fontFamily: FONT, color: i === 0 ? '#ffffff' : '#888888', fontStyle: 'bold'
            }).setOrigin(0.5);
            
            tabBg.on('pointerdown', () => {
                currentElement = i;
                // Reset all tab visuals
                tabButtons.forEach((btn, j) => {
                    const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
                    const txt = btn.getAt(1) as Phaser.GameObjects.Text;
                    bg.setFillStyle(j === i ? elements[j].color : 0x1a2744, 0.85);
                    txt.setColor(j === i ? '#ffffff' : '#888888');
                });
                // Show/hide content + reset scroll
                contentContainers.forEach((ct, j) => {
                    ct.setVisible(j === i);
                    ct.y = contentTop + 10; // Reset scroll position
                });
                // Update scrollbar
                updateScrollbar();
            });
            tabBg.on('pointerover', () => {
                if (i !== currentElement) tabBg.setFillStyle(elem.color, 0.4);
            });
            tabBg.on('pointerout', () => {
                tabBg.setFillStyle(i === currentElement ? elem.color : 0x1a2744, 0.85);
            });
            
            tabBtn.add([tabBg, tabText]);
            tabButtons.push(tabBtn);
        });
        
        // Scroll mask for content (absolute screen coords)
        const maskX = cx - panelW / 2 + 15;
        const maskY = cy + contentTop;
        const maskW = panelW - 50; // leave room for scrollbar
        const maskH = contentAreaH;
        const maskShape = this.make.graphics({});
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(maskX, maskY, maskW, maskH);
        const mask = maskShape.createGeometryMask();
        
        // Scrollbar track + thumb
        const scrollTrackX = panelW / 2 - 16;
        const scrollTrack = this.add.rectangle(scrollTrackX, contentTop + contentAreaH / 2, 6, contentAreaH, 0x222244, 0.5);
        const scrollThumb = this.add.rectangle(scrollTrackX, contentTop + 20, 6, 40, 0x4488cc, 0.8);
        scrollThumb.setOrigin(0.5, 0);
        
        const updateScrollbar = () => {
            const activeContent = contentContainers[currentElement];
            if (!activeContent || activeContent.list.length === 0) {
                scrollThumb.setVisible(false);
                return;
            }
            const bounds = activeContent.getBounds();
            const totalH = bounds.height;
            if (totalH <= contentAreaH) {
                scrollThumb.setVisible(false);
                return;
            }
            scrollThumb.setVisible(true);
            const ratio = contentAreaH / totalH;
            const thumbH = Math.max(20, contentAreaH * ratio);
            scrollThumb.setSize(6, thumbH);
            
            const baseY = contentTop + 10;
            const maxScroll = totalH - contentAreaH + 30;
            const scrolled = baseY - activeContent.y;
            const pct = Phaser.Math.Clamp(scrolled / maxScroll, 0, 1);
            scrollThumb.y = contentTop + pct * (contentAreaH - thumbH);
        };
        
        // Create content per tab
        elements.forEach((elemData, elemIndex) => {
            const content = this.add.container(0, contentTop + 10);
            content.setVisible(elemIndex === 0);
            content.setMask(mask);
            
            const isBossTab = elemIndex === elements.length - 1;
            const cardH = isBossTab ? 140 : 100;
            const cardGap = 8;
            const usableW = panelW - 60;
            
            if (isBossTab) {
                const bosses = UNIT_DEFINITIONS.filter(u => u.isBoss);
                bosses.forEach((boss, bi) => {
                    const cardY = bi * (cardH + cardGap);
                    const bossColor = ELEMENT_COLORS[boss.element];
                    
                    // Card bg
                    const cardBg = this.add.graphics();
                    cardBg.fillStyle(0x0d1526, 0.95);
                    cardBg.fillRoundedRect(-usableW / 2, cardY, usableW, cardH, 8);
                    cardBg.lineStyle(2, bossColor, 0.6);
                    cardBg.strokeRoundedRect(-usableW / 2, cardY, usableW, cardH, 8);
                    content.add(cardBg);
                    
                    // Boss icon
                    const px = -usableW / 2 + 45;
                    const cy2 = cardY + cardH / 2;
                    const portraitBg = this.add.rectangle(px, cy2, 58, 58, bossColor, 0.25);
                    portraitBg.setStrokeStyle(2, bossColor);
                    const bossIcon = this.add.text(px, cy2, '💀', { fontSize: '30px' }).setOrigin(0.5);
                    content.add([portraitBg, bossIcon]);
                    
                    const waveNum = boss.id === 'boss_flame_tyrant' ? 5 : boss.id === 'boss_frost_colossus' ? 10 : 15;
                    
                    // Info text
                    const nx = px + 50;
                    const nameT = this.add.text(nx, cardY + 12, `${boss.name}  (Wave ${waveNum})`, {
                        fontSize: '17px', fontFamily: FONT, color: '#ffffff', fontStyle: 'bold'
                    });
                    content.add(nameT);
                    
                    const totalHp = boss.bossPhases?.reduce((sum, p) => sum + (p.phaseHp || 0), 0) || boss.stats.hp;
                    const statsT = this.add.text(nx, cardY + 34, `❤️${totalHp}  ⚔️${boss.stats.attack}  🛡️${boss.stats.defense}  ⚡${boss.stats.speed}`, {
                        fontSize: '13px', fontFamily: FONT, color: '#aaaaaa'
                    });
                    content.add(statsT);
                    
                    const abilT = this.add.text(nx, cardY + 54, `${boss.ability.name}: ${boss.ability.description}`, {
                        fontSize: '12px', fontFamily: FONT, color: '#88aaff', wordWrap: { width: usableW - 140 }
                    });
                    content.add(abilT);
                    
                    if (boss.bossPhases && boss.bossPhases.length > 0) {
                        const phasesStr = boss.bossPhases.map((p, pi) => `P${pi + 1}: ${p.name}${p.phaseHp ? ` (${p.phaseHp}HP)` : ''}`).join(' → ');
                        const phaseT = this.add.text(nx, cardY + cardH - 24, `📋 ${phasesStr}`, {
                            fontSize: '11px', fontFamily: FONT, color: '#ffaa44', wordWrap: { width: usableW - 140 }
                        });
                        content.add(phaseT);
                    }
                });
                
                contentContainers.push(content);
                return;
            }
            
            // Regular element tab
            const elementUnits = UNIT_DEFINITIONS.filter(u => 
                u.element === elemData.element && !u.isBoss
            ).sort((a, b) => a.tier - b.tier);
            
            elementUnits.forEach((unit, ui) => {
                const cardY = ui * (cardH + cardGap);
                
                // Card bg
                const cardBg = this.add.graphics();
                cardBg.fillStyle(0x0d1526, 0.95);
                cardBg.fillRoundedRect(-usableW / 2, cardY, usableW, cardH, 8);
                cardBg.lineStyle(1, elemData.color, 0.4);
                cardBg.strokeRoundedRect(-usableW / 2, cardY, usableW, cardH, 8);
                content.add(cardBg);
                
                // Portrait
                const px = -usableW / 2 + 45;
                const cy2 = cardY + cardH / 2;
                const portraitBg = this.add.rectangle(px, cy2, 58, 58, elemData.color, 0.2);
                portraitBg.setStrokeStyle(2, elemData.color);
                content.add(portraitBg);
                
                // Tier badge
                const tierColors = [0x888888, 0x44aa44, 0x4488ff, 0xaa44ff];
                const tierBadge = this.add.rectangle(px, cy2 - 22, 34, 18, tierColors[unit.tier - 1] || 0x888888);
                const tierText = this.add.text(px, cy2 - 22, `T${unit.tier}`, {
                    fontSize: '11px', fontFamily: FONT, color: '#ffffff', fontStyle: 'bold'
                }).setOrigin(0.5);
                const shapeEmoji = this.add.text(px, cy2 + 8, elemData.emoji, { fontSize: '24px' }).setOrigin(0.5);
                content.add([tierBadge, tierText, shapeEmoji]);
                
                // Unit info - left column
                const nx = px + 48;
                const nameT = this.add.text(nx, cardY + 10, unit.name, {
                    fontSize: '17px', fontFamily: FONT, color: '#ffffff', fontStyle: 'bold'
                });
                const costT = this.add.text(nx, cardY + 30, `💰 ${unit.cost}g`, {
                    fontSize: '13px', fontFamily: FONT, color: '#ffcc44'
                });
                content.add([nameT, costT]);
                
                // Stats
                const statsStr = `❤️${unit.stats.hp}  ⚔️${unit.stats.attack}  🛡️${unit.stats.defense}  ⚡${unit.stats.speed}  📏${unit.stats.range === 1 ? 'Melee' : unit.stats.range === 2 ? 'Mid' : 'Ranged'}`;
                const statsT = this.add.text(nx, cardY + 50, statsStr, {
                    fontSize: '12px', fontFamily: FONT, color: '#8899aa'
                });
                content.add(statsT);
                
                // Ability — right column
                const ax = 120;
                const abilNameT = this.add.text(ax, cardY + 10, unit.ability.name, {
                    fontSize: '14px', fontFamily: FONT, color: '#88bbff', fontStyle: 'bold'
                });
                const abilDescT = this.add.text(ax, cardY + 30, unit.ability.description, {
                    fontSize: '12px', fontFamily: FONT, color: '#888888', wordWrap: { width: 300 }
                });
                const abilCdT = this.add.text(ax, cardY + 64, `⏱️ ${unit.ability.cooldown}t cooldown`, {
                    fontSize: '11px', fontFamily: FONT, color: '#666666'
                });
                content.add([abilNameT, abilDescT, abilCdT]);
                
                // Role tag
                const role = this.getUnitRole(unit);
                const roleColors: Record<string, number> = {
                    'Tank': 0x44aa44, 'DPS': 0xff4444, 'Support': 0x44aaff, 'Healer': 0x44ff88, 'Assassin': 0xaa44ff
                };
                const roleBgX = usableW / 2 - 50;
                const rBg = this.add.rectangle(roleBgX, cardY + 14, 70, 20, roleColors[role] || 0x666666, 0.7);
                const rText = this.add.text(roleBgX, cardY + 14, role, {
                    fontSize: '11px', fontFamily: FONT, color: '#ffffff', fontStyle: 'bold'
                }).setOrigin(0.5);
                content.add([rBg, rText]);
                
                if (unit.isVoid) {
                    const voidBadge = this.add.text(roleBgX, cardY + 36, '🕳️ Enemy Only', {
                        fontSize: '10px', fontFamily: FONT, color: '#8844aa'
                    }).setOrigin(0.5);
                    content.add(voidBadge);
                }
            });
            
            if (elementUnits.length === 0) {
                const noUnits = this.add.text(0, 40, `No ${elemData.name} units`, {
                    fontSize: '16px', fontFamily: FONT, color: '#555555'
                }).setOrigin(0.5);
                content.add(noUnits);
            }
            
            contentContainers.push(content);
        });
        
        // Scroll via scene-level wheel event (container-local scrollZones don't receive wheel reliably)
        const wheelHandler = (_pointer: Phaser.Input.Pointer, _gameObjects: any[], _dx: number, _dy: number, dz: number) => {
            const activeContent = contentContainers[currentElement];
            if (!activeContent) return;
            const baseY = contentTop + 10;
            const bounds = activeContent.getBounds();
            const totalH = bounds.height;
            const maxScroll = Math.max(0, totalH - contentAreaH + 30);
            activeContent.y = Phaser.Math.Clamp(activeContent.y - dz * 0.6, baseY - maxScroll, baseY);
            updateScrollbar();
        };
        this.input.on('wheel', wheelHandler);
        
        // Initial scrollbar state
        this.time.delayedCall(50, () => updateScrollbar());
        
        // Close button
        const closeBtn = this.add.rectangle(0, panelH / 2 - 26, 150, 38, 0x44aa44);
        closeBtn.setStrokeStyle(2, 0x66cc66);
        closeBtn.setInteractive({ useHandCursor: true });
        const closeText = this.add.text(0, panelH / 2 - 26, '✕ CLOSE', {
            fontSize: '16px', fontFamily: FONT, color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x55bb55));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x44aa44));
        closeBtn.on('pointerdown', () => {
            // Proper cleanup
            this.input.off('wheel', wheelHandler);
            contentContainers.forEach(c => {
                c.clearMask(false);
            });
            maskShape.destroy();
            glossaryPanel.destroy();
            overlay.destroy();
            this.phase = previousPhase;
        });
        
        glossaryPanel.add([
            panelBg, titleBar, title,
            ...tabButtons, ...contentContainers,
            scrollTrack, scrollThumb,
            closeBtn, closeText
        ]);
    }
    
    private getUnitRole(unit: UnitDefinition): string {
        // Determine role based on stats
        if (unit.ability.healAmount) return 'Healer';
        if (unit.stats.defense >= 12 && unit.stats.hp >= 130) return 'Tank';
        if (unit.stats.speed >= 10 && unit.stats.attack >= 20) return 'Assassin';
        if (unit.stats.attack >= 15) return 'DPS';
        return 'Support';
    }

    // =========================================================================
    // GUIDED ONBOARDING SYSTEM
    // =========================================================================
    
    private readonly ONBOARDING_STEPS = [
        {
            title: 'Welcome to ShapeStrikers!',
            text: 'A game of strategy and\nsurvival!\nCreated By ByteSower.',
            x: 625, y: 300,
            arrow: null
        },
        
        {
            title: '🧐 Can You Survive?',
            text: 'Survive 15 waves of enemies!\nBosses at Waves 5, 10, and 15!',
            x: 200, y: 130,
            arrow: 'up' as const
        },
        
        {
            title: '⚡ Battle Line',
            text: 'Units auto-fight in lanes.\nGold row = Clash For Frontline.',
            x: 200, y: 350,
            arrow: 'right' as const
        },
        {
            title: '📦 Shop',
            text: 'Buy units from shop, and\nplace them on blue tiles.',
            x: 1050, y: 250,
            arrow: 'right' as const
        },
        {  
            title: 'Passive Synergy Buffs',
            text: 'Place Same element units\nSynergy Buffs will appear\nHere!',
            x: 300, y: 130,
            arrow: 'left' as const
        },
        {
            title: '💎 Purchase Upgrades',
            text: 'Upgrades Will Help You\n Survive Longer!',
            x: 800, y: 500,
            arrow: 'down' as const
        },
        {
            title:'Start Battle',
            text: 'After Arranging Units\nPress "Start Battle"\nto begin the fight!',
            x: 450, y: 500,
            arrow: 'down' as const
        }

    ];
    
    private startOnboarding(): void {
        this._onboardingStep = 0;
        this._isOnboarding = true;
        this.phase = 'shop';
        this.phaseText.setText('PREP');
        
        // Generate initial shop
        this.refreshShopUnits();
        
        // Update displays
        this.updateUnitCount();
        this.updateGoldDisplay();
        this.updateSynergyDisplay();
        
        // Show action buttons
        this.actionButtons.setVisible(true);
        
        // Create blocking overlay (transparent, only blocks clicks during tutorial)
        const width = this.scale.width;
        const height = this.scale.height;
        this.onboardingOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
        this.onboardingOverlay.setDepth(199);
        this.onboardingOverlay.setInteractive(); // Blocks clicks through to game
        
        // Start with first step
        this.showOnboardingStep(0);
    }
    
    private showOnboardingStep(step: number): void {
        // Remove previous tooltip
        if (this.onboardingTooltip) {
            this.onboardingTooltip.destroy();
            this.onboardingTooltip = null;
        }
        
        // Check if onboarding is complete
        if (step >= this.ONBOARDING_STEPS.length) {
            this._isOnboarding = false;
            // Remove overlay
            if (this.onboardingOverlay) {
                this.onboardingOverlay.destroy();
                this.onboardingOverlay = null;
            }
            return;
        }
        
        const stepData = this.ONBOARDING_STEPS[step];
        this._onboardingStep = step;
        
        this.onboardingTooltip = this.add.container(stepData.x, stepData.y);
        this.onboardingTooltip.setDepth(200);
        
        // Background box - larger for better readability
        const boxWidth = 300;
        const boxHeight = 130;
        const bg = this.add.rectangle(0, 0, boxWidth, boxHeight, 0x1a1a3e, 0.98);
        bg.setStrokeStyle(3, 0x4488ff);
        
        // Title - larger
        const title = this.add.text(0, -38, stepData.title, {
            fontSize: '20px',
            fontFamily: FONT,
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Content - larger and better spacing
        const content = this.add.text(0, 8, stepData.text, {
            fontSize: '16px',
            fontFamily: FONT,
            color: '#dddddd',
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5);
        
        // Arrow pointer based on direction - larger and repositioned
        let arrow: Phaser.GameObjects.Text | null = null;
        if (stepData.arrow) {
            const arrows: Record<string, { char: string; ox: number; oy: number }> = {
                'up': { char: '▲', ox: 0, oy: -80 },
                'down': { char: '▼', ox: 0, oy: 80 },
                'left': { char: '◀', ox: -165, oy: 0 },
                'right': { char: '▶', ox: 165, oy: 0 }
            };
            const a = arrows[stepData.arrow];
            arrow = this.add.text(a.ox, a.oy, a.char, {
                fontSize: '32px',
                color: '#4488ff'
            }).setOrigin(0.5);
        }
        
        // Step counter and Next button - larger
        const stepCounter = this.add.text(-70, 52, `${step + 1}/${this.ONBOARDING_STEPS.length}`, {
            fontSize: '14px',
            fontFamily: FONT,
            color: '#aaaaaa'
        }).setOrigin(0.5);
        
        const nextBtn = this.add.text(70, 52, step < this.ONBOARDING_STEPS.length - 1 ? 'Next →' : 'Got it! ✓', {
            fontSize: '16px',
            fontFamily: FONT,
            color: '#44dd44',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        nextBtn.setInteractive({ useHandCursor: true });
        nextBtn.on('pointerover', () => nextBtn.setColor('#66cc66'));
        nextBtn.on('pointerout', () => nextBtn.setColor('#44aa44'));
        nextBtn.on('pointerdown', () => {
            if (step < this.ONBOARDING_STEPS.length - 1) {
                this.showOnboardingStep(step + 1);
            } else {
                this.endOnboarding();
            }
        });
        
        // Skip all link 
        const skipBtn = this.add.text(0, 80, '⏩ Skip Tutorial', {
            fontSize: '14px',
            fontFamily: FONT,
            color: '#d2dee8',
            fontStyle: 'bold italic'
        }).setOrigin(0.5);
        skipBtn.setInteractive({ useHandCursor: true });
        skipBtn.on('pointerover', () => skipBtn.setColor('#aaccff'));
        skipBtn.on('pointerout', () => skipBtn.setColor('#88aacc'));
        skipBtn.on('pointerdown', () => this.endOnboarding());
        
        const elements = [bg, title, content, stepCounter, nextBtn, skipBtn];
        if (arrow) elements.push(arrow);
        this.onboardingTooltip.add(elements);
        
        // Animate in
        this.onboardingTooltip.setAlpha(0);
        this.onboardingTooltip.setScale(0.8);
        this.tweens.add({
            targets: this.onboardingTooltip,
            alpha: 1,
            scale: 1,
            duration: 200,
            ease: 'Back.easeOut'
        });
    }
    
    private endOnboarding(): void {
        if (this.onboardingTooltip) {
            this.onboardingTooltip.destroy();
            this.onboardingTooltip = null;
        }
        if (this.onboardingOverlay) {
            this.onboardingOverlay.destroy();
            this.onboardingOverlay = null;
        }
        // Log completion for debugging (silences unused warnings)
        console.log(`Onboarding ended at step ${this._onboardingStep}, was active: ${this._isOnboarding}`);
        this._isOnboarding = false;
        
        // Show shop overlay so players can buy units and start
        this.showShopOverlay();
    }

    // =========================================================================
    // UI CREATION
    // =========================================================================

    private createUI(): void {
        // Top bar - larger for better visibility (scaled up ~30%)
        const topBarGraphics = this.add.graphics();
        topBarGraphics.fillGradientStyle(0x0a1220, 0x0a1220, 0x0a1220, 0x0a1220, 0.95, 0.95, 0, 0);
        topBarGraphics.fillRect(0, 0, this.scale.width, 60);
        
        // Subtle bottom edge glow
        topBarGraphics.lineStyle(2, 0x3366aa, 0.5);
        topBarGraphics.lineBetween(0, 60, this.scale.width, 60);
        
        // Consistent HUD text style - larger, cleaner
        const hudStyle = {
            fontSize: '18px',
            fontFamily: FONT,
            color: '#ccddee',
            stroke: '#000000',
            strokeThickness: 2
        };
        
        // Phase indicator - rounded pill style (larger)
        const phaseGraphics = this.add.graphics();
        phaseGraphics.fillStyle(0x1a3355, 0.9);
        phaseGraphics.fillRoundedRect(12, 12, 100, 36, 18);
        phaseGraphics.lineStyle(2, 0x4488cc, 0.6);
        phaseGraphics.strokeRoundedRect(12, 12, 100, 36, 18);
        
        this.phaseText = this.add.text(62, 30, 'PREP', {
            ...hudStyle,
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#88ddff'
        }).setOrigin(0.5);
        
        // Wave counter
        this.waveText = this.add.text(130, 30, '', {
            ...hudStyle,
            color: '#aabbcc'
        }).setOrigin(0, 0.5);
        this.updateWaveDisplay();
        
        // Gold display
        this.goldText = this.add.text(250, 30, `💰 ${this.gold}`, {
            ...hudStyle,
            color: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        
        // Score display
        this.scoreText = this.add.text(340, 30, `🏆 ${this.score}`, {
            ...hudStyle,
            color: '#88dd88'
        }).setOrigin(0, 0.5);
        
        // Unit tracker container (centered between score and turn indicator)
        this.unitTrackerContainer = this.add.container(1000, 30);
        
        const trackerBg = this.add.graphics();
        trackerBg.fillStyle(0x1a2d45, 0.9);
        trackerBg.fillRoundedRect(-100, -18, 200, 36, 10);
        trackerBg.lineStyle(1, 0x3366aa, 0.5);
        trackerBg.strokeRoundedRect(-100, -18, 200, 36, 10);
        
        this.unitCountText = this.add.text(-80, 0, `👤 0/${GAME_CONFIG.maxUnits}`, {
            ...hudStyle,
            fontSize: '15px',
            color: '#66aaff'
        }).setOrigin(0, 0.5);
        
        this.enemyCountText = this.add.text(20, 0, '👹 0', {
            ...hudStyle,
            fontSize: '15px',
            color: '#ff6666'
        }).setOrigin(0, 0.5);
        
        this.unitTrackerContainer.add([trackerBg, this.unitCountText, this.enemyCountText]);
        
        // Turn indicator (shown during battle) - positioned after tracker
        this.turnIndicator = this.add.text(640, 30, '', {
            ...hudStyle,
            color: '#ff8888'
        }).setOrigin(0, 0.5);
        
        // Placement indicator - larger rounded pill
        this.placementIndicator = this.add.text(540, 630, '', {
            fontSize: '20px',
            color: '#ffff00',
            fontStyle: 'bold',
            backgroundColor: '#000000dd',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setVisible(false);
        
        // Create unit info panel
        this.createUnitInfoPanel();
        
        // Create action buttons (bottom)
        this.createActionButtons();
        
        // Create synergy display (left edge)
        this.createSynergyDisplay();
        
        // Create upgrade panel (hidden by default)
        this.createUpgradePanel();
        
        // Help text removed - using onboarding instead
        
        // Glossary button - larger rounded circle (📚)
        const glossaryGraphics = this.add.graphics();
        glossaryGraphics.fillStyle(0x2a3a5a, 0.85);
        glossaryGraphics.fillCircle(1210, 30, 18);
        
        const glossaryHitArea = this.add.circle(1210, 30, 18, 0x000000, 0);
        glossaryHitArea.setInteractive({ useHandCursor: true });
        
        this.add.text(1210, 30, '📚', {
            fontSize: '18px'
        }).setOrigin(0.5);
        
        glossaryHitArea.on('pointerover', () => {
            glossaryGraphics.clear();
            glossaryGraphics.fillStyle(0x3a5a7a, 1);
            glossaryGraphics.fillCircle(1210, 30, 18);
        });
        glossaryHitArea.on('pointerout', () => {
            glossaryGraphics.clear();
            glossaryGraphics.fillStyle(0x2a3a5a, 0.85);
            glossaryGraphics.fillCircle(1210, 30, 18);
        });
        glossaryHitArea.on('pointerdown', () => this.showGlossary());
        
        // Help button - larger rounded circle
        const helpGraphics = this.add.graphics();
        helpGraphics.fillStyle(0x2a3a5a, 0.85);
        helpGraphics.fillCircle(1255, 30, 18);
        
        const helpHitArea = this.add.circle(1255, 30, 18, 0x000000, 0);
        helpHitArea.setInteractive({ useHandCursor: true });
        
        this.add.text(1255, 30, '?', {
            fontSize: '20px',
            color: '#88aacc',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        helpHitArea.on('pointerover', () => {
            helpGraphics.clear();
            helpGraphics.fillStyle(0x3a5a7a, 1);
            helpGraphics.fillCircle(1255, 30, 18);
        });
        helpHitArea.on('pointerout', () => {
            helpGraphics.clear();
            helpGraphics.fillStyle(0x2a3a5a, 0.85);
            helpGraphics.fillCircle(1255, 30, 18);
        });
        helpHitArea.on('pointerdown', () => this.showTutorial());
        
        // Upgrade status display (below top bar, right side)
        this.upgradeStatusContainer = this.add.container(1270, 68);
        this.updateUpgradeStatusDisplay();
    }

    private createSynergyDisplay(): void {
        // Synergy tracker along left edge
        this.synergyDisplay = this.add.container(40, 100);
        this.updateSynergyDisplay();
    }

    private updateSynergyDisplay(): void {
        // Remove old synergy elements
        this.synergyDisplay.removeAll(true);
        
        // Destroy any lingering synergy tooltip
        if (this.activeSynergyTooltip) {
            this.activeSynergyTooltip.destroy();
            this.activeSynergyTooltip = null;
        }
        
        // Count elements
        const elementCounts = new Map<Element, number>();
        for (const unit of this.playerUnits.filter(u => u.isAlive)) {
            const elem = unit.definition.element;
            elementCounts.set(elem, (elementCounts.get(elem) || 0) + 1);
        }
        
        // Element colors and emoji
        const elementEmoji: Record<Element, string> = {
            [Element.FIRE]: '🔥',
            [Element.ICE]: '🧊',
            [Element.LIGHTNING]: '⚡',
            [Element.EARTH]: '🌍',
            [Element.ARCANE]: '☪️',
            [Element.VOID]: '🕳️'
        };
        
        // Synergy bonus descriptions
        const synergyInfo: Record<Element, { stat: string; t2: string; t3: string }> = {
            [Element.FIRE]: { stat: 'ATK', t2: '+15% ATK', t3: '+30% ATK' },
            [Element.ICE]: { stat: 'DEF', t2: '+15% DEF', t3: '+30% DEF' },
            [Element.LIGHTNING]: { stat: 'SPD', t2: '+20% SPD', t3: '+40% SPD' },
            [Element.EARTH]: { stat: 'HP', t2: '+20% HP', t3: '+40% HP' },
            [Element.ARCANE]: { stat: 'ATK/SPD', t2: '+10% ATK', t3: '+25% SPD' },
            [Element.VOID]: { stat: 'ATK/HP', t2: '+25% ATK', t3: '+20% HP' }
        };
        
        // Display synergy icons — bigger with clear count badges
        let yOffset = 0;
        for (const [elem, count] of elementCounts) {
            const synergy2 = count >= 2;
            const synergy3 = count >= 3;
            
            // Background card for each synergy row
            const rowBg = this.add.graphics();
            rowBg.fillStyle(synergy3 ? 0x443300 : synergy2 ? 0x1a3322 : 0x0a1220, 0.85);
            rowBg.fillRoundedRect(-28, yOffset - 24, 56, 48, 8);
            if (synergy2) {
                rowBg.lineStyle(2, synergy3 ? 0xffff00 : 0x88ff88, 0.6);
                rowBg.strokeRoundedRect(-28, yOffset - 24, 56, 48, 8);
            }
            this.synergyDisplay.add(rowBg);
            
            // Element icon — large
            const icon = this.add.text(0, yOffset - 6, elementEmoji[elem], {
                fontSize: '32px'
            }).setOrigin(0.5);
            
            // Count badge — prominent
            const countText = this.add.text(0, yOffset + 16, `×${count}`, {
                fontSize: '14px',
                fontFamily: FONT,
                color: synergy3 ? '#ffff00' : synergy2 ? '#88ff88' : '#aaaaaa',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
            
            // Invisible hit area for hover
            const hitArea = this.add.rectangle(0, yOffset, 56, 50, 0x000000, 0);
            hitArea.setInteractive({ useHandCursor: true });
            
            const info = synergyInfo[elem];
            const currentY = yOffset;
            
            hitArea.on('pointerover', () => {
                if (this.activeSynergyTooltip) this.activeSynergyTooltip.destroy();
                
                this.activeSynergyTooltip = this.add.container(130, 120 + currentY);
                this.activeSynergyTooltip.setDepth(200);
                
                const bg = this.add.rectangle(80, 0, 200, 80, 0x1a2744, 0.95);
                bg.setStrokeStyle(2, synergy3 ? 0xffff00 : synergy2 ? 0x88ff88 : 0x4488ff);
                
                let statusText: string;
                let statusColor: string;
                if (synergy3) {
                    statusText = `✓ ${info.t3}`;
                    statusColor = '#ffff00';
                } else if (synergy2) {
                    statusText = `✓ ${info.t2}`;
                    statusColor = '#88ff88';
                } else {
                    statusText = `Need 2 for ${info.t2}`;
                    statusColor = '#888888';
                }
                
                const title = this.add.text(80, -18, `${elementEmoji[elem]} ${info.stat} Synergy`, {
                    fontSize: '16px',
                    fontFamily: FONT,
                    color: '#ffffff',
                    fontStyle: 'bold'
                }).setOrigin(0.5);
                
                const status = this.add.text(80, 10, statusText, {
                    fontSize: '15px',
                    fontFamily: FONT,
                    color: statusColor
                }).setOrigin(0.5);
                
                this.activeSynergyTooltip.add([bg, title, status]);
            });
            
            hitArea.on('pointerout', () => {
                if (this.activeSynergyTooltip) {
                    this.activeSynergyTooltip.destroy();
                    this.activeSynergyTooltip = null;
                }
            });
            
            this.synergyDisplay.add([icon, countText, hitArea]);
            yOffset += 58;
        }
    }

    /**
     * Calculate and apply elemental synergy bonuses to all player units.
     * Called right before battle starts.
     */
    private applySynergyBonusesToUnits(): void {
        // Count elements among living player units
        const elementCounts = new Map<Element, number>();
        const aliveUnits = this.playerUnits.filter(u => u.isAlive);
        
        for (const unit of aliveUnits) {
            const elem = unit.definition.element;
            elementCounts.set(elem, (elementCounts.get(elem) || 0) + 1);
        }
        
        // For each unit, compute the synergy multipliers from their element
        for (const unit of aliveUnits) {
            const elem = unit.definition.element;
            const count = elementCounts.get(elem) || 0;
            
            // Find the highest matching synergy threshold for this element
            const multipliers = { attack: 1, defense: 1, speed: 1, hp: 1 };
            
            // Get all synergy tiers for this element, sorted by requiredCount descending
            const applicableSynergies = ELEMENT_SYNERGIES
                .filter(s => s.element === elem && count >= s.requiredCount)
                .sort((a, b) => b.requiredCount - a.requiredCount);
            
            // Apply the highest matching synergy (only one per element)
            if (applicableSynergies.length > 0) {
                const best = applicableSynergies[0];
                multipliers[best.bonus.stat] = best.bonus.multiplier;
            }
            
            unit.applySynergyBonuses(multipliers);
        }
        
        console.log('Synergy bonuses applied to player units');
    }

    private createUpgradePanel(): void {
        this.upgradePanel = this.add.container(this.scale.width / 2, this.scale.height / 2);
        this.upgradePanel.setVisible(false);
        this.upgradePanel.setDepth(90);
        
        // Will be populated when shown
    }

    private showUpgradePanel(): void {
        // Prevent upgrades on wave 1 to avoid soft lock
        if (this.currentWave <= 1) {
            this.showMessage('Upgrades unlock after Wave 1!', 0xffaa00);
            return;
        }
        
        this.upgradePanel.removeAll(true);
        this.upgradePanel.setPosition(this.scale.width / 2, this.scale.height / 2);
        
        const overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7);
        overlay.setInteractive(); // Block clicks
        
        const panelW = 660;
        const rowH = 58;
        const rowGap = 6;
        const upgradeCount = UPGRADES.length;
        const contentH = upgradeCount * (rowH + rowGap);
        const panelH = Math.min(this.scale.height - 40, contentH + 160); // header(80) + content + footer(80)
        
        // Panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x0d1526, 0.97);
        panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 14);
        panelBg.lineStyle(2, 0xffaa00, 0.6);
        panelBg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 14);
        
        // Title bar
        const titleY = -panelH / 2 + 26;
        const titleBar = this.add.graphics();
        titleBar.fillStyle(0x0a1020, 0.9);
        titleBar.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, 52, { tl: 14, tr: 14, bl: 0, br: 0 });
        const title = this.add.text(0, titleY, '🏪 UPGRADES', {
            fontSize: '24px', fontFamily: FONT, color: '#ffaa00', fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const goldDisplay = this.add.text(panelW / 2 - 30, titleY, `💰 ${this.gold}`, {
            fontSize: '18px', fontFamily: FONT, color: '#ffd700', fontStyle: 'bold'
        }).setOrigin(1, 0.5);
        
        this.upgradePanel.add([overlay, panelBg, titleBar, title, goldDisplay]);
        
        // Upgrade rows
        const startY = -panelH / 2 + 70;
        UPGRADES.forEach((upgrade, i) => {
            const level = this.upgradeLevels.get(upgrade.id) || 0;
            const maxed = level >= upgrade.maxLevel;
            const cost = upgrade.cost + (level * 5);
            const yPos = startY + i * (rowH + rowGap);
            
            const rowBg = this.add.graphics();
            rowBg.fillStyle(maxed ? 0x1a2235 : 0x141e30, 0.9);
            rowBg.fillRoundedRect(-panelW / 2 + 20, yPos, panelW - 40, rowH, 8);
            rowBg.lineStyle(1, maxed ? 0x334455 : 0x3366aa, 0.5);
            rowBg.strokeRoundedRect(-panelW / 2 + 20, yPos, panelW - 40, rowH, 8);
            if (!maxed) {
                const rowHit = this.add.rectangle(0, yPos + rowH / 2, panelW - 40, rowH, 0x000000, 0);
                rowHit.setInteractive({ useHandCursor: true });
                rowHit.on('pointerover', () => {
                    rowBg.clear();
                    rowBg.fillStyle(0x1a2a44, 0.95);
                    rowBg.fillRoundedRect(-panelW / 2 + 20, yPos, panelW - 40, rowH, 8);
                    rowBg.lineStyle(2, 0x4488cc, 0.8);
                    rowBg.strokeRoundedRect(-panelW / 2 + 20, yPos, panelW - 40, rowH, 8);
                });
                rowHit.on('pointerout', () => {
                    rowBg.clear();
                    rowBg.fillStyle(0x141e30, 0.9);
                    rowBg.fillRoundedRect(-panelW / 2 + 20, yPos, panelW - 40, rowH, 8);
                    rowBg.lineStyle(1, 0x3366aa, 0.5);
                    rowBg.strokeRoundedRect(-panelW / 2 + 20, yPos, panelW - 40, rowH, 8);
                });
                rowHit.on('pointerdown', () => this.buyUpgrade(upgrade, cost));
                this.upgradePanel.add(rowHit);
            }
            
            // Name + description (left)
            const nameText = this.add.text(-panelW / 2 + 36, yPos + 10, upgrade.name, {
                fontSize: '16px', fontFamily: FONT, color: maxed ? '#556677' : '#ffffff', fontStyle: 'bold'
            });
            const descText = this.add.text(-panelW / 2 + 36, yPos + 32, upgrade.description, {
                fontSize: '12px', fontFamily: FONT, color: maxed ? '#445566' : '#889999'
            });
            
            // Level pips (center-right)
            const pipX = 100;
            for (let p = 0; p < upgrade.maxLevel; p++) {
                const filled = p < level;
                const pip = this.add.circle(pipX + p * 16, yPos + 16, 5, filled ? 0x44ff44 : 0x222244);
                pip.setStrokeStyle(1, filled ? 0x66ff66 : 0x445566);
                this.upgradePanel.add(pip);
            }
            
            // Level label
            const lvText = this.add.text(pipX + upgrade.maxLevel * 16 + 6, yPos + 10, `${level}/${upgrade.maxLevel}`, {
                fontSize: '12px', fontFamily: FONT, color: maxed ? '#66aa66' : '#aaaaaa'
            });
            
            // Cost (right side)
            const costText = this.add.text(panelW / 2 - 36, yPos + rowH / 2, maxed ? '✅ MAX' : `💰 ${cost}g`, {
                fontSize: '14px', fontFamily: FONT, color: maxed ? '#446644' : '#ffd700', fontStyle: 'bold'
            }).setOrigin(1, 0.5);
            
            this.upgradePanel.add([rowBg, nameText, descText, lvText, costText]);
        });
        
        // Close button
        const closeBtnY = panelH / 2 - 30;
        const closeBtn = this.createRoundedButton(0, closeBtnY, '✕ CLOSE', () => {
            this.upgradePanel.setVisible(false);
        }, 0x333344, 0x444466, 140, 36);
        
        this.upgradePanel.add(closeBtn);
        this.upgradePanel.setVisible(true);
    }

    private buyUpgrade(upgrade: Upgrade, cost: number): void {
        if (this.gold < cost) {
            this.showMessage('Not enough gold!', 0xff4444);
            return;
        }
        
        const level = this.upgradeLevels.get(upgrade.id) || 0;
        if (level >= upgrade.maxLevel) return;
        
        this.gold -= cost;
        this.upgradeLevels.set(upgrade.id, level + 1);
        
        // Apply upgrade effect
        switch (upgrade.effect.type) {
            case 'maxUnits':
                this.currentMaxUnits += upgrade.effect.value;
                break;
            case 'shopRefresh':
                this.currentShopRefreshCost = Math.max(0, this.currentShopRefreshCost + upgrade.effect.value);
                break;
            case 'goldPerWave':
                this.currentGoldPerWave += upgrade.effect.value;
                break;
            case 'interestRate':
                this.currentInterestRate += upgrade.effect.value;
                break;
            case 'healingRate':
                this.currentHealingRate += upgrade.effect.value;
                break;
            case 'refreshesPerRound':
                this.maxRefreshesPerRound += upgrade.effect.value;
                break;
        }
        
        this.updateGoldDisplay();
        this.updateUnitCount();
        this.updateUpgradeStatusDisplay();
        this.showMessage(`Upgraded ${upgrade.name}!`, 0x44ff44);
        
        // Refresh the panel
        this.showUpgradePanel();
    }

    private updateUpgradeStatusDisplay(): void {
        this.upgradeStatusContainer.removeAll(true);
        
        const labels: Record<string, string> = {
            'army_expansion': '🏰',
            'field_medic': '💚',
            'bargain_hunter': '🏷️',
            'war_chest': '📈',
            'victory_bonus': '🏆',
            'refresh_master': '🔄'
        };
        
        let xOff = 0;
        for (const upgrade of UPGRADES) {
            const level = this.upgradeLevels.get(upgrade.id) || 0;
            if (level > 0) {
                const icon = labels[upgrade.id] || '⬆️';
                
                // Badge background
                const badgeBg = this.add.graphics();
                badgeBg.fillStyle(0x1a2744, 0.9);
                badgeBg.fillRoundedRect(xOff - 44, -14, 42, 28, 8);
                badgeBg.lineStyle(1, 0x4488cc, 0.5);
                badgeBg.strokeRoundedRect(xOff - 44, -14, 42, 28, 8);
                
                const emoji = this.add.text(xOff - 34, 0, icon, {
                    fontSize: '16px'
                }).setOrigin(0, 0.5);
                
                const lvl = this.add.text(xOff - 8, 0, `${level}`, {
                    fontSize: '14px', fontFamily: FONT, color: '#88ddff', fontStyle: 'bold'
                }).setOrigin(0.5);
                
                this.upgradeStatusContainer.add([badgeBg, emoji, lvl]);
                xOff -= 48;
            }
        }
    }

    /**
     * Show the full-screen shop overlay with unit cards, army roster, and controls.
     * Called at start of each prep phase (after wave 1) and after refresh.
     */
    private showShopOverlay(): void {
        // Clean up previous overlay
        this.hideShopOverlay();
        
        const W = this.scale.width;
        const H = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;
        
        this.shopOverlayContainer = this.add.container(0, 0);
        this.shopOverlayContainer.setDepth(80);
        
        // Dark overlay background
        const dimBg = this.add.rectangle(cx, cy, W, H, 0x000000, 0.85);
        dimBg.setInteractive(); // blocks clicks to game behind
        this.shopOverlayContainer.add(dimBg);
        
        // Main panel
        const panelW = Math.min(1100, W - 40);
        const panelH = Math.min(640, H - 40);
        const panelX = cx;
        const panelY = cy;
        
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x0d1526, 0.97);
        panelBg.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 16);
        panelBg.lineStyle(2, 0x3366aa, 0.8);
        panelBg.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 16);
        this.shopOverlayContainer.add(panelBg);
        
        // ── HEADER BAR ──
        const headerY = panelY - panelH / 2 + 35;
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x0a1020, 0.9);
        headerBg.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, 70, { tl: 16, tr: 16, bl: 0, br: 0 });
        this.shopOverlayContainer.add(headerBg);
        
        // Shop title
        const shopTitle = this.add.text(panelX - panelW / 2 + 30, headerY, `⚔️ SHOP`, {
            fontSize: '26px', color: '#88bbff', fontStyle: 'bold', fontFamily: FONT
        }).setOrigin(0, 0.5);
        this.shopOverlayContainer.add(shopTitle);
        
        // Wave indicator
        const waveLabel = this.add.text(panelX - panelW / 2 + 180, headerY, `Wave ${this.currentWave}/${GAME_CONFIG.waveCount}`, {
            fontSize: '16px', color: '#888888', fontFamily: FONT
        }).setOrigin(0, 0.5);
        this.shopOverlayContainer.add(waveLabel);
        
        // Gold display (right side of header)
        const goldLabel = this.add.text(panelX + panelW / 2 - 180, headerY, `💰 ${this.gold}`, {
            fontSize: '22px', color: '#ffd700', fontStyle: 'bold', fontFamily: FONT
        }).setOrigin(0, 0.5);
        goldLabel.setName('shopGoldLabel');
        this.shopOverlayContainer.add(goldLabel);
        
        // Unit count
        const unitCount = this.add.text(panelX + panelW / 2 - 30, headerY, `👤 ${this.playerUnits.filter(u => u.isAlive).length}/${this.currentMaxUnits}`, {
            fontSize: '16px', color: '#66aaff', fontFamily: FONT
        }).setOrigin(1, 0.5);
        this.shopOverlayContainer.add(unitCount);
        
        // ── CONTENT AREA ──
        const contentTop = panelY - panelH / 2 + 80;
        const contentBottom = panelY + panelH / 2 - 70;
        const shopAreaW = panelW * 0.62;  // Left ~62% for shop cards
        const detailAreaW = panelW * 0.35; // Right ~35% for unit detail
        
        // ── LEFT: SHOP CARDS (Compact) ──
        const shopLeft = panelX - panelW / 2 + 20;
        
        // Section header
        const shopHeader = this.add.text(shopLeft + 10, contentTop + 5, 'AVAILABLE UNITS', {
            fontSize: '14px', color: '#556688', fontStyle: 'bold', fontFamily: FONT
        });
        this.shopOverlayContainer.add(shopHeader);
        
        // Refresh button
        const remaining = this.maxRefreshesPerRound - this.refreshesThisRound;
        const refreshBtnX = shopLeft + shopAreaW - 110;
        const isRefreshDisabled = this.currentWave <= 1;
        const refreshBtn = this.createRoundedButton(refreshBtnX, contentTop + 8, 
            `🔄 Refresh $${this.currentShopRefreshCost} [${remaining}]`, 
            () => {
                if (!isRefreshDisabled) this.refreshShop();
            }, isRefreshDisabled ? 0x222222 : 0x1a3355, isRefreshDisabled ? 0x333333 : 0x2a5577, 180, 32);
        if (isRefreshDisabled) {
            refreshBtn.setAlpha(0.4);
            const hitArea = refreshBtn.list[1] as Phaser.GameObjects.Rectangle;
            if (hitArea) hitArea.disableInteractive();
        }
        this.shopOverlayContainer.add(refreshBtn);
        
        // Compact shop unit cards (grid: max 3 per row, 2 rows)
        const cardW = Math.min(200, (shopAreaW - 40) / 3);
        const cardH = 140; // Compact height — no ability text or buy button
        const cardGap = 12;
        const cardsPerRow = 3;
        const cardStartX = shopLeft + 15;
        const cardStartY = contentTop + 40;
        
        // Track selected card for highlighting
        let selectedCardIndex = -1;
        const cardContainers: Phaser.GameObjects.Container[] = [];
        const cardBgs: Phaser.GameObjects.Graphics[] = [];
        
        // ── RIGHT: UNIT DETAIL PANEL ──
        const detailLeft = panelX + panelW / 2 - detailAreaW;
        
        // Divider line
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x334466, 0.5);
        divider.lineBetween(detailLeft - 10, contentTop, detailLeft - 10, contentBottom);
        this.shopOverlayContainer.add(divider);
        
        // Detail container — will be rebuilt when a card is clicked
        const detailContainer = this.add.container(detailLeft, contentTop);
        detailContainer.setName('shopDetailContainer');
        this.shopOverlayContainer.add(detailContainer);
        
        // Show default "select a unit" prompt
        const showDetailPrompt = () => {
            detailContainer.removeAll(true);
            const promptText = this.add.text(detailAreaW / 2 - 5, (contentBottom - contentTop) / 2, '👆 Click a unit card\nto view details', {
                fontSize: '16px', fontFamily: FONT, color: '#445566', align: 'center', lineSpacing: 6
            }).setOrigin(0.5);
            detailContainer.add(promptText);
        };
        
        // Show full unit detail for a definition
        const showUnitDetail = (def: UnitDefinition, shopIndex: number) => {
            detailContainer.removeAll(true);
            
            const dw = detailAreaW - 15;
            
            // Element emoji mapping
            const elementEmoji: Record<Element, string> = {
                [Element.FIRE]: '🔥', [Element.ICE]: '🧊', [Element.LIGHTNING]: '⚡',
                [Element.EARTH]: '🌍', [Element.ARCANE]: '✨', [Element.VOID]: '🕳️'
            };
            
            // Element color names
            const elementColorHex: Record<Element, string> = {
                [Element.FIRE]: '#ff6644', [Element.ICE]: '#66bbff', [Element.LIGHTNING]: '#ffff66',
                [Element.EARTH]: '#88cc44', [Element.ARCANE]: '#cc66ff', [Element.VOID]: '#8866aa'
            };
            
            // ── Unit Portrait ──
            const bodyColor = def.visual?.color ?? (ELEMENT_TO_COLOR[def.element] || 'purple');
            const bodyShape = def.visual?.shape ?? (TIER_TO_SHAPE[def.tier] || 'circle');
            const faceKey = GOOD_FACES[def.id] || GOOD_FACES['default'];
            const bodyTexKey = `${bodyColor}_${bodyShape}`;
            const faceTexKey = `face_${faceKey}`;
            const portraitScale = 1.6;
            
            // Portrait background circle
            const portraitBg = this.add.graphics();
            portraitBg.fillStyle(ELEMENT_COLORS[def.element], 0.12);
            portraitBg.fillCircle(dw / 2, 48, 44);
            portraitBg.lineStyle(2, ELEMENT_COLORS[def.element], 0.3);
            portraitBg.strokeCircle(dw / 2, 48, 44);
            detailContainer.add(portraitBg);
            
            // Body sprite
            if (this.textures.exists(bodyTexKey)) {
                const bodyImg = this.add.image(dw / 2, 48, bodyTexKey);
                bodyImg.setScale(portraitScale);
                if (def.element === Element.VOID) bodyImg.setTint(0x442266);
                detailContainer.add(bodyImg);
            }
            // Face sprite
            if (this.textures.exists(faceTexKey)) {
                const faceImg = this.add.image(dw / 2, 44, faceTexKey);
                faceImg.setScale(portraitScale * 0.65);
                detailContainer.add(faceImg);
            }
            
            // ── Name + Tier below portrait ──
            const emoji = elementEmoji[def.element] || '';
            const nameText = this.add.text(dw / 2, 100, `${emoji} ${def.name}`, {
                fontSize: '20px', fontFamily: FONT, color: elementColorHex[def.element] || '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5, 0);
            detailContainer.add(nameText);
            
            const tierStars = this.add.text(dw / 2, 123, '★'.repeat(def.tier), {
                fontSize: '14px', fontFamily: FONT, color: '#ffdd00'
            }).setOrigin(0.5, 0);
            detailContainer.add(tierStars);
            
            // Role badge
            const role = this.getUnitRole(def);
            const roleColors: Record<string, number> = {
                'Tank': 0x44aa44, 'DPS': 0xff4444, 'Support': 0x44aaff, 'Healer': 0x44ff88, 'Assassin': 0xaa44ff
            };
            const roleBg = this.add.graphics();
            roleBg.fillStyle(roleColors[role] || 0x666666, 0.7);
            roleBg.fillRoundedRect(dw / 2 - 36, 138, 72, 20, 6);
            const roleText = this.add.text(dw / 2, 148, role, {
                fontSize: '12px', fontFamily: FONT, color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);
            detailContainer.add([roleBg, roleText]);
            
            // ── Stats section ──
            const statsTopY = 168;
            const statsDivider = this.add.graphics();
            statsDivider.lineStyle(1, 0x334466, 0.4);
            statsDivider.lineBetween(10, statsTopY, dw - 10, statsTopY);
            detailContainer.add(statsDivider);
            
            const statsTitle = this.add.text(dw / 2, statsTopY + 6, 'STATS', {
                fontSize: '11px', fontFamily: FONT, color: '#556688', fontStyle: 'bold'
            }).setOrigin(0.5, 0);
            detailContainer.add(statsTitle);
            
            // 2-column stat layout
            const statPairs = [
                { label: '❤️ HP', value: `${def.stats.hp}`, color: '#ff8888' },
                { label: '⚔️ ATK', value: `${def.stats.attack}`, color: '#ffaa66' },
                { label: '🛡️ DEF', value: `${def.stats.defense}`, color: '#66bbff' },
                { label: '⚡ SPD', value: `${def.stats.speed}`, color: '#ffff66' },
                { label: '📏 RNG', value: def.stats.range === 1 ? 'Melee' : def.stats.range >= 3 ? 'Ranged' : 'Mid', color: '#aaddaa' },
                { label: '💰 Cost', value: `${def.cost}g`, color: '#ffd700' }
            ];
            
            statPairs.forEach((stat, i) => {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const sx = col === 0 ? 16 : dw / 2 + 10;
                const sy = statsTopY + 24 + row * 22;
                
                const labelT = this.add.text(sx, sy, stat.label, {
                    fontSize: '13px', fontFamily: FONT, color: '#778899'
                });
                const valueT = this.add.text(sx + (col === 0 ? dw / 2 - 30 : dw / 2 - 30), sy, stat.value, {
                    fontSize: '13px', fontFamily: FONT, color: stat.color, fontStyle: 'bold'
                }).setOrigin(1, 0);
                detailContainer.add([labelT, valueT]);
            });
            
            // ── Ability section ──
            const abilTopY = statsTopY + 94;
            const abilDivider = this.add.graphics();
            abilDivider.lineStyle(1, 0x334466, 0.4);
            abilDivider.lineBetween(10, abilTopY, dw - 10, abilTopY);
            detailContainer.add(abilDivider);
            
            const abilTitle = this.add.text(dw / 2, abilTopY + 6, 'ABILITY', {
                fontSize: '16px', fontFamily: FONT, color: '#556688', fontStyle: 'bold'
            }).setOrigin(0.5, 0);
            detailContainer.add(abilTitle);
            
            const abilName = this.add.text(dw / 2, abilTopY + 24, def.ability.name, {
                fontSize: '20px', fontFamily: FONT, color: '#88ccff', fontStyle: 'bold'
            }).setOrigin(0.5, 0);
            detailContainer.add(abilName);
            
            // Colorized ability description — full text, no truncation
            const abilDescContainer = this.createColorizedText(dw / 2, abilTopY + 46, def.ability.description, 13, '#aabbcc', dw - 30);
            detailContainer.add(abilDescContainer);
            
            // Cooldown
            const cooldownY = abilTopY + 90;
            const cooldownText = this.add.text(dw / 2, cooldownY, `⏱️ Cooldown: ${def.ability.cooldown} turns`, {
                fontSize: '16px', fontFamily: FONT, color: '#667788'
            }).setOrigin(0.5, 0);
            detailContainer.add(cooldownText);
            
            // ── Element synergy hint ──
            const synergyInfo: Record<Element, string> = {
                [Element.FIRE]: '🔥 2+ Fire: +15% ATK',
                [Element.ICE]: '🧊 2+ Ice: +15% DEF',
                [Element.LIGHTNING]: '⚡ 2+ Lightning: +20% SPD',
                [Element.EARTH]: '🌍 2+ Earth: +20% HP',
                [Element.ARCANE]: '✨ 2+ Arcane: +10% ATK/DEF',
                [Element.VOID]: '🕳️ 2+ Void: +25% ATK'
            };
            const synergyHint = this.add.text(dw / 2, cooldownY + 22, synergyInfo[def.element] || '', {
                fontSize: '16px', fontFamily: FONT, color: '#555566'
            }).setOrigin(0.5, 0);
            detailContainer.add(synergyHint);
            
            // ── BUY BUTTON ──
            const buyBtnY = contentBottom - contentTop - 20;
            const canAfford = this.gold >= def.cost;
            const aliveCount = this.playerUnits.filter(u => u.isAlive).length;
            const atCap = aliveCount >= this.currentMaxUnits;
            const canBuy = canAfford && !atCap;
            
            const buyBg = this.add.graphics();
            buyBg.fillStyle(canBuy ? 0x2a5530 : 0x332222, 0.95);
            buyBg.fillRoundedRect(10, buyBtnY - 22, dw - 20, 44, 10);
            buyBg.lineStyle(2, canBuy ? 0x44aa44 : 0x553333, 0.7);
            buyBg.strokeRoundedRect(10, buyBtnY - 22, dw - 20, 44, 10);
            detailContainer.add(buyBg);
            
            let buyText = canBuy ? `💰 BUY $${def.cost}` : atCap ? '🚫 Army Full' : `💰 $${def.cost} (need more gold)`;
            const buyLabel = this.add.text(dw / 2, buyBtnY, buyText, {
                fontSize: '18px', fontFamily: FONT, color: canBuy ? '#44ff44' : '#884444', fontStyle: 'bold'
            }).setOrigin(0.5);
            detailContainer.add(buyLabel);
            
            const buyHit = this.add.rectangle(dw / 2, buyBtnY, dw - 20, 44, 0x000000, 0);
            buyHit.setInteractive({ useHandCursor: canBuy });
            buyHit.on('pointerover', () => {
                if (!canBuy) return;
                buyBg.clear();
                buyBg.fillStyle(0x3a7740, 0.98);
                buyBg.fillRoundedRect(10, buyBtnY - 22, dw - 20, 44, 10);
                buyBg.lineStyle(2, 0x66cc66, 0.9);
                buyBg.strokeRoundedRect(10, buyBtnY - 22, dw - 20, 44, 10);
            });
            buyHit.on('pointerout', () => {
                buyBg.clear();
                buyBg.fillStyle(canBuy ? 0x2a5530 : 0x332222, 0.95);
                buyBg.fillRoundedRect(10, buyBtnY - 22, dw - 20, 44, 10);
                buyBg.lineStyle(2, canBuy ? 0x44aa44 : 0x553333, 0.7);
                buyBg.strokeRoundedRect(10, buyBtnY - 22, dw - 20, 44, 10);
            });
            buyHit.on('pointerdown', () => {
                if (canBuy) {
                    this.hideShopOverlay();
                    this.selectUnitToBuy(def, shopIndex);
                } else if (atCap) {
                    this.showMessage('Army is full! Sell or upgrade first.', 0xff4444);
                } else {
                    this.showMessage('Not enough gold!', 0xff4444);
                }
            });
            detailContainer.add(buyHit);
        };
        
        // Show default prompt
        showDetailPrompt();
        
        // ── Create compact shop cards ──
        this.shopUnits.forEach((unit, index) => {
            const row = Math.floor(index / cardsPerRow);
            const col = index % cardsPerRow;
            const cardX = cardStartX + col * (cardW + cardGap) + cardW / 2;
            const cardY = cardStartY + row * (cardH + cardGap) + cardH / 2;
            
            const card = this.createCompactShopCard(unit, index, cardX, cardY, cardW, cardH, (def, idx) => {
                // On card click: highlight selected, show detail
                if (selectedCardIndex === idx) return; // already selected
                
                // Reset previous highlight
                if (selectedCardIndex >= 0 && selectedCardIndex < cardBgs.length) {
                    const prevBg = cardBgs[selectedCardIndex];
                    const prevColor = ELEMENT_COLORS[this.shopUnits[selectedCardIndex].element];
                    prevBg.clear();
                    prevBg.fillStyle(0x101828, 0.95);
                    prevBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
                    prevBg.lineStyle(2, prevColor, 0.6);
                    prevBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
                }
                
                // Highlight new selection
                selectedCardIndex = idx;
                const selBg = cardBgs[idx];
                const selColor = ELEMENT_COLORS[def.element];
                selBg.clear();
                selBg.fillStyle(0x182838, 0.98);
                selBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
                selBg.lineStyle(3, selColor, 1);
                selBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
                
                // Show detail panel
                showUnitDetail(def, idx);
            });
            
            cardContainers.push(card.container);
            cardBgs.push(card.bg);
            this.shopOverlayContainer!.add(card.container);
        });
        
        // ── BOTTOM BAR ──
        const bottomY = panelY + panelH / 2 - 35;
        const bottomBg = this.add.graphics();
        bottomBg.fillStyle(0x0a1020, 0.9);
        bottomBg.fillRoundedRect(panelX - panelW / 2, bottomY - 35, panelW, 70, { tl: 0, tr: 0, bl: 16, br: 16 });
        this.shopOverlayContainer.add(bottomBg);
        
        // Start Battle button (primary action) — grey out when no units
        const hasUnits = this.playerUnits.filter(u => u.isAlive).length > 0;
        const battleBtn = this.createRoundedButton(panelX, bottomY, '⚔️ START BATTLE', () => {
            if (!hasUnits) return;
            this.hideShopOverlay();
            this.startBattlePhase();
        }, hasUnits ? 0x1a5530 : 0x222222, hasUnits ? 0x2a7745 : 0x333333, 200, 44);
        if (!hasUnits) {
            battleBtn.setAlpha(0.4);
            const hitArea = battleBtn.list[1] as Phaser.GameObjects.Rectangle;
            if (hitArea) hitArea.disableInteractive();
        }
        this.shopOverlayContainer.add(battleBtn);
        
        // Manage Army button — close overlay to interact with grid
        const manageBtn = this.createRoundedButton(panelX + 240, bottomY, '📋 MANAGE ARMY', () => {
            this.hideShopOverlay();
            this.enterManageMode();
        }, 0x1a3355, 0x2a5577, 170, 40);
        this.shopOverlayContainer.add(manageBtn);
        
        // Upgrades button
        const upgradesBtn = this.createRoundedButton(panelX - 240, bottomY, '🏪 UPGRADES', () => {
            this.showUpgradePanel();
        }, 0x443366, 0x665588, 150, 40);
        if (this.currentWave <= 1) upgradesBtn.setAlpha(0.4);
        this.shopOverlayContainer.add(upgradesBtn);
        
        // Fade in animation
        this.shopOverlayContainer.setAlpha(0);
        this.tweens.add({
            targets: this.shopOverlayContainer,
            alpha: 1,
            duration: 250,
            ease: 'Power2'
        });
    }
    
    /**
     * Create a compact shop card — shows quick stats only, click to view details in right panel
     */
    private createCompactShopCard(
        def: UnitDefinition, index: number, x: number, y: number, w: number, h: number,
        onSelect: (def: UnitDefinition, index: number) => void
    ): { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics } {
        const card = this.add.container(x, y);
        const elemColor = ELEMENT_COLORS[def.element];
        const radius = 10;
        
        // Card background
        const bg = this.add.graphics();
        bg.fillStyle(0x101828, 0.95);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
        bg.lineStyle(2, elemColor, 0.6);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
        card.add(bg);
        
        // Element accent strip at top
        const accent = this.add.graphics();
        accent.fillStyle(elemColor, 0.3);
        accent.fillRoundedRect(-w / 2, -h / 2, w, 30, { tl: radius, tr: radius, bl: 0, br: 0 });
        card.add(accent);
        
        // Element emoji + tier
        const elementEmoji: Record<Element, string> = {
            [Element.FIRE]: '🔥', [Element.ICE]: '🧊', [Element.LIGHTNING]: '⚡',
            [Element.EARTH]: '🌍', [Element.ARCANE]: '✨', [Element.VOID]: '🕳️'
        };
        
        const emoji = this.add.text(-w / 2 + 8, -h / 2 + 6, elementEmoji[def.element] || '', {
            fontSize: '15px'
        });
        card.add(emoji);
        
        const tierStars = this.add.text(w / 2 - 8, -h / 2 + 8, '★'.repeat(def.tier), {
            fontSize: '12px', color: '#ffcc00', fontFamily: FONT
        }).setOrigin(1, 0);
        card.add(tierStars);
        
        // Unit name
        const name = this.add.text(0, -h / 2 + 36, def.name, {
            fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
            fontFamily: FONT, wordWrap: { width: w - 16 }
        }).setOrigin(0.5, 0);
        card.add(name);
        
        // Role badge (small)
        const role = this.getUnitRole(def);
        const roleColors: Record<string, number> = {
            'Tank': 0x44aa44, 'DPS': 0xff4444, 'Support': 0x44aaff, 'Healer': 0x44ff88, 'Assassin': 0xaa44ff
        };
        const roleBg = this.add.graphics();
        roleBg.fillStyle(roleColors[role] || 0x666666, 0.6);
        roleBg.fillRoundedRect(-24, -h / 2 + 54, 48, 14, 4);
        const roleText = this.add.text(0, -h / 2 + 61, role, {
            fontSize: '9px', color: '#ffffff', fontStyle: 'bold', fontFamily: FONT
        }).setOrigin(0.5);
        card.add([roleBg, roleText]);
        
        // Quick stats (2 rows, compact)
        const statsY = -h / 2 + 76;
        const statsRow1 = `❤️${def.stats.hp}  ⚔️${def.stats.attack}  🛡️${def.stats.defense}`;
        const statsRow2 = `⚡${def.stats.speed}  💰${def.cost}g`;
        const statsText = this.add.text(0, statsY, statsRow1 + '\n' + statsRow2, {
            fontSize: '11px', color: '#bbd0e0', fontFamily: FONT, lineSpacing: 2, align: 'center'
        }).setOrigin(0.5, 0);
        card.add(statsText);
        
        // Cost indicator at bottom
        const canAfford = this.gold >= def.cost;
        const costBg = this.add.graphics();
        costBg.fillStyle(canAfford ? 0x1a3322 : 0x331a1a, 0.6);
        costBg.fillRoundedRect(-w / 2, h / 2 - 20, w, 20, { tl: 0, tr: 0, bl: radius, br: radius });
        card.add(costBg);
        
        const costLabel = this.add.text(0, h / 2 - 10, canAfford ? 'Click to view' : 'Can\'t afford', {
            fontSize: '10px', color: canAfford ? '#66aa66' : '#884444', fontFamily: FONT
        }).setOrigin(0.5);
        card.add(costLabel);
        
        // Full card interactive hitbox
        const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });
        card.add(hitArea);
        
        // Hover effects
        hitArea.on('pointerover', () => {
            card.setScale(1.03);
        });
        hitArea.on('pointerout', () => {
            card.setScale(1);
        });
        hitArea.on('pointerdown', () => {
            onSelect(def, index);
        });
        
        return { container: card, bg };
    }
    
    private hideShopOverlay(): void {
        if (!this.shopOverlayContainer) return;
        
        // Clean up mask if present
        if (this.shopOverlayMask) {
            this.shopOverlayMask.destroy();
            this.shopOverlayMask = null;
        }
        
        // Destroy all children and container
        this.shopOverlayContainer.destroy();
        this.shopOverlayContainer = null;
    }
    
    /**
     * Enter manage mode: close shop overlay so player can interact with the grid
     * to reposition or sell units, with a "Back to Shop" button visible.
     */
    private enterManageMode(): void {
        this.phase = 'shop'; // Keep phase as shop so handleTileClick works
        
        // Show manage mode UI at bottom
        const W = this.scale.width;
        const H = this.scale.height;
        
        const manageUI = this.add.container(W / 2, H - 50);
        manageUI.setDepth(60);
        manageUI.setName('manageUI');
        
        // Background bar
        const barBg = this.add.graphics();
        barBg.fillStyle(0x0a1020, 0.9);
        barBg.fillRoundedRect(-320, -30, 640, 60, 12);
        barBg.lineStyle(2, 0x3366aa, 0.5);
        barBg.strokeRoundedRect(-320, -30, 640, 60, 12);
        manageUI.add(barBg);
        
        // Instructions
        const instr = this.add.text(-200, 0, '🔧 Click unit to select → click empty tile to move', {
            fontSize: '13px', fontFamily: FONT, color: '#88aacc'
        }).setOrigin(0, 0.5);
        manageUI.add(instr);
        
        // Back to Shop button
        const backBtn = this.createRoundedButton(200, 0, '🛒 BACK TO SHOP', () => {
            this.selectedUnit = null;
            this.grid.clearHighlights();
            const sellBtn = this.actionButtons.getByName('sellBtn') as Phaser.GameObjects.Container;
            if (sellBtn) sellBtn.setVisible(false);
            manageUI.destroy();
            this.showShopOverlay();
        }, 0x1a5530, 0x2a7745, 170, 40);
        manageUI.add(backBtn);
    }

    private createUnitInfoPanel(): void {
        // Floating info panel (right side)
        const infoX = this.scale.width - 180;
        this.unitInfoPanel = this.add.container(infoX, 80);
        this.unitInfoPanel.setVisible(false);
        this.unitInfoPanel.setDepth(50);
        
        // Background will be created dynamically in showUnitInfo to fit content
    }

    private createActionButtons(): void {
        // Centered at bottom of screen — only sell + cancel for placement/manage mode
        // Battle and Upgrades are handled in the shop overlay
        const width = this.scale.width;
        const height = this.scale.height;
        const buttonX = width / 2;
        const buttonY = height - 90;
        this.actionButtons = this.add.container(buttonX, buttonY);
        
        // Sell unit button (hidden until unit selected)
        const sellBtn = this.createRoundedButton(-60, 0, '💰 SELL', () => this.sellSelectedUnit(), 0x552222, 0x773333, 110, 48);
        sellBtn.setName('sellBtn');
        sellBtn.setVisible(false);
        
        // Cancel placement button (shown during placement)
        const cancelBtn = this.createRoundedButton(60, 0, '❌ CANCEL', () => this.cancelPlacement(), 0x553333, 0x774444, 110, 48);
        cancelBtn.setName('cancelBtn');
        cancelBtn.setVisible(false);
        
        this.actionButtons.add([sellBtn, cancelBtn]);
    }

    private sellSelectedUnit(): void {
        if (!this.selectedUnit) {
            this.showMessage('Click a unit to select it first!', 0xffff44);
            return;
        }
        
        const unit = this.selectedUnit;
        const refund = Math.max(
            GAME_CONFIG.minSellValue,
            Math.floor(unit.definition.cost * GAME_CONFIG.sellRefundPercent)
        );
        
        // Remove from grid
        this.grid.setOccupied(unit.gridPosition.col, unit.gridPosition.row, null);
        
        // Remove from player units
        const idx = this.playerUnits.indexOf(unit);
        if (idx >= 0) {
            this.playerUnits.splice(idx, 1);
        }
        
        // Destroy visual
        unit.destroy();
        
        // Refund gold
        this.gold += refund;
        this.updateGoldDisplay();
        this.updateUnitCount();
        this.updateSynergyDisplay();
        
        this.showMessage(`Sold ${unit.definition.name} for $${refund}!`, 0x44ff44);
        
        // Deselect
        this.selectedUnit = null;
        const sellBtn = this.actionButtons.getByName('sellBtn') as Phaser.GameObjects.Container;
        if (sellBtn) sellBtn.setVisible(false);
    }

    /**
     * Create a button with rounded corners using graphics
     */
    private createRoundedButton(
        x: number, 
        y: number, 
        text: string, 
        callback: () => void,
        bgColor: number = 0x2244aa,
        hoverColor: number = 0x3366cc,
        width: number = 140,
        height: number = 36
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const radius = height / 2.5;
        
        // Create graphics for rounded button
        const graphics = this.add.graphics();
        graphics.fillStyle(bgColor, 1);
        graphics.fillRoundedRect(-width/2, -height/2, width, height, radius);
        graphics.lineStyle(1, hoverColor, 0.5);
        graphics.strokeRoundedRect(-width/2, -height/2, width, height, radius);
        
        // Invisible hitbox for interaction
        const hitArea = this.add.rectangle(0, 0, width, height, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });
        
        const label = this.add.text(0, 0, text, {
            fontSize: '17px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: FONT
        }).setOrigin(0.5);
        
        hitArea.on('pointerover', () => {
            graphics.clear();
            graphics.fillStyle(hoverColor, 1);
            graphics.fillRoundedRect(-width/2, -height/2, width, height, radius);
            graphics.lineStyle(1, 0xffffff, 0.3);
            graphics.strokeRoundedRect(-width/2, -height/2, width, height, radius);
            container.setScale(1.03);
        });
        
        hitArea.on('pointerout', () => {
            graphics.clear();
            graphics.fillStyle(bgColor, 1);
            graphics.fillRoundedRect(-width/2, -height/2, width, height, radius);
            graphics.lineStyle(1, hoverColor, 0.5);
            graphics.strokeRoundedRect(-width/2, -height/2, width, height, radius);
            container.setScale(1);
        });
        
        hitArea.on('pointerdown', callback);
        
        container.add([graphics, hitArea, label]);
        return container;
    }

    /**
     * Create a text container with keyword color-coding.
     * Words matching KEYWORD_COLORS get colored; others use defaultColor.
     */
    private createColorizedText(
        x: number, y: number, text: string, 
        fontSize: number, defaultColor: string, maxWidth: number,
        align: 'left' | 'center' = 'center'
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const words = text.split(/(\s+)/);
        const lineHeight = fontSize + 3;
        const spaceWidth = fontSize * 0.3;
        
        // Measure and layout words into lines
        const lines: { word: string; color: string }[][] = [[]];
        let currentLineWidth = 0;
        
        for (const word of words) {
            if (word.match(/^\s+$/)) {
                currentLineWidth += spaceWidth;
                continue;
            }
            // Approximate word width (rough: 0.55 * fontSize per char)
            const wordWidth = word.length * fontSize * 0.55;
            if (currentLineWidth > 0 && currentLineWidth + wordWidth > maxWidth) {
                lines.push([]);
                currentLineWidth = 0;
            }
            const lowerWord = word.toLowerCase().replace(/[^a-z]/g, '');
            const color = KEYWORD_COLORS[lowerWord] || defaultColor;
            lines[lines.length - 1].push({ word, color });
            currentLineWidth += wordWidth + spaceWidth;
        }
        
        // Render lines
        lines.forEach((line, lineIdx) => {
            let lineX = 0;
            // Calculate total line width for centering
            let totalWidth = 0;
            line.forEach((w, i) => {
                totalWidth += w.word.length * fontSize * 0.55;
                if (i < line.length - 1) totalWidth += spaceWidth;
            });
            
            const startX = align === 'center' ? -totalWidth / 2 : 0;
            lineX = startX;
            
            line.forEach((w) => {
                const t = this.add.text(lineX, lineIdx * lineHeight, w.word, {
                    fontSize: `${fontSize}px`, color: w.color, fontFamily: FONT
                });
                container.add(t);
                lineX += t.width + spaceWidth;
            });
        });
        
        return container;
    }

    // =========================================================================
    // SHOP SYSTEM
    // =========================================================================

    private startShopPhase(): void {
        this.phase = 'shop';
        this.phaseText.setText('PREP');
        this.pendingUnit = null;
        this.selectedUnit = null;
        this.placementIndicator.setVisible(false);
        
        // Show incoming boss warning if next wave is a boss wave
        const bossWaves = [5, 10, 15];
        if (bossWaves.includes(this.currentWave)) {
            this.showIncomingBossWarning();
        }
        
        // Cycle background between waves (not on first wave)
        if (this.currentWave > 1) {
            this.cycleBackground();
        }
        
        // Reset refresh count for new round
        this.refreshesThisRound = 0;
        
        // Calculate scaled refresh cost based on wave progression
        // Base cost + (wave - 1) * scaling, capped at max
        const scaledRefreshCost = Math.min(
            GAME_CONFIG.shopRefreshCost + (this.currentWave - 1) * GAME_CONFIG.refreshCostPerWave,
            GAME_CONFIG.maxRefreshCost
        );
        // Apply upgrade discount (if any)
        const upgradeDiscount = (this.upgradeLevels.get('shop_mastery') || 0);
        this.currentShopRefreshCost = Math.max(1, scaledRefreshCost - upgradeDiscount);
        
        // Apply interest gold
        if (this.currentInterestRate > 0) {
            const interest = Math.min(
                Math.floor(this.gold * this.currentInterestRate),
                GAME_CONFIG.maxInterest
            );
            if (interest > 0) {
                this.gold += interest;
                this.showMessage(`+${interest} gold interest!`, 0xffd700);
            }
        }
        
        // Update displays
        this.updateUnitCount();
        this.updateGoldDisplay();
        this.updateSynergyDisplay();
        
        // Generate new shop units
        this.refreshShopUnits();
        
        // Check for unwinnable state
        if (this.checkSoftLock()) {
            return; // Game over triggered
        }
        
        // Show action buttons
        this.actionButtons.setVisible(true);
        const battleBtn = this.actionButtons.getByName('battleBtn') as Phaser.GameObjects.Container;
        const cancelBtn = this.actionButtons.getByName('cancelBtn') as Phaser.GameObjects.Container;
        const sellBtn = this.actionButtons.getByName('sellBtn') as Phaser.GameObjects.Container;
        if (battleBtn) battleBtn.setVisible(true);
        if (cancelBtn) cancelBtn.setVisible(false);
        if (sellBtn) sellBtn.setVisible(false);
        
        // Clear grid highlights
        this.grid.clearHighlights();
        
        // Show full-screen shop overlay
        this.showShopOverlay();
    }

    private cancelPlacement(): void {
        this.pendingUnit = null;
        this.phase = 'shop';
        this.phaseText.setText('PREP');
        this.placementIndicator.setVisible(false);
        this.grid.clearHighlights();
        
        // Re-show shop overlay
        this.showShopOverlay();
    }

    private refreshShop(): void {
        // Disable refresh on Wave 1 to prevent soft-lock
        if (this.currentWave <= 1) {
            this.showMessage('Refresh disabled on Wave 1!', 0xffaa00);
            return;
        }
        
        // Check refresh limit per round
        if (this.refreshesThisRound >= this.maxRefreshesPerRound) {
            this.showMessage(`Max ${this.maxRefreshesPerRound} refresh(es) per round!`, 0xffaa00);
            return;
        }
        
        if (this.gold < this.currentShopRefreshCost) {
            this.showMessage('Your Broke Buddy!', 0xff4444);
            return;
        }
        
        this.gold -= this.currentShopRefreshCost;
        this.refreshesThisRound++;
        this.updateGoldDisplay();
        
        // Regenerate shop units and re-show overlay
        this.refreshShopUnits();
        this.showShopOverlay();
        
        // Check for soft-lock after refresh
        this.checkSoftLock();
    }
    
    /**
     * Check if player is in an unwinnable state and trigger game over if so
     * @returns true if game over was triggered
     */
    private checkSoftLock(): boolean {
        const aliveUnits = this.playerUnits.filter(u => u.isAlive);
        
        // If player has units, they can still try to battle
        if (aliveUnits.length > 0) return false;
        
        // No units - check if they can acquire any
        const cheapestShopUnit = this.shopUnits.length > 0 
            ? Math.min(...this.shopUnits.map(u => u.cost))
            : Infinity;
        const canAffordUnit = this.gold >= cheapestShopUnit;
        const canRefresh = this.currentWave > 1 && this.gold >= this.currentShopRefreshCost;
        
        if (!canAffordUnit && !canRefresh) {
            // Player is stuck - trigger game over
            this.showMessage('Your Stuck Buddy - Game Over!', 0xff4444);
            this.time.delayedCall(1500, () => {
                this.handleDefeat();
            });
            return true;
        }
        
        return false;
    }

    private refreshShopUnits(): void {
        this.shopUnits = [];
        const maxTier = Math.min(3, Math.ceil(this.currentWave / 3)) as 1 | 2 | 3;
        
        for (let i = 0; i < GAME_CONFIG.shopSize; i++) {
            this.shopUnits.push(UnitFactory.getRandomUnitForShop(maxTier));
        }
    }

    private selectUnitToBuy(def: UnitDefinition, shopIndex: number): void {
        // Count alive player units
        const aliveCount = this.playerUnits.filter(u => u.isAlive).length;
        
        if (this.gold < def.cost) {
            this.showMessage('Your broke!', 0xff4444);
            return;
        }
        
        if (aliveCount >= this.currentMaxUnits) {
            this.showMessage(`Max ${this.currentMaxUnits} units! Buy upgrades for more.`, 0xff4444);
            return;
        }
        
        const emptyTiles = this.grid.getEmptyPlayerTiles();
        if (emptyTiles.length === 0) {
            this.showMessage('No space on grid!', 0xff4444);
            return;
        }
        
        // Deselect any selected unit
        this.selectedUnit = null;
        const sellBtn = this.actionButtons.getByName('sellBtn') as Phaser.GameObjects.Container;
        if (sellBtn) sellBtn.setVisible(false);
        
        // Set pending unit and switch to placement mode
        this.pendingUnit = def;
        this.phase = 'positioning';
        this.phaseText.setText('PLACING');
        
        // Placement indicator removed - relying on green highlighted tiles
        
        // Highlight valid placement tiles
        this.grid.highlightTiles(emptyTiles, 0x44ff44);
        
        // Show cancel button, hide other buttons
        const cancelBtn = this.actionButtons.getByName('cancelBtn') as Phaser.GameObjects.Container;
        const battleBtn = this.actionButtons.getByName('battleBtn') as Phaser.GameObjects.Container;
        const upgradeBtn = this.actionButtons.getByName('upgradeBtn') as Phaser.GameObjects.Container;
        if (cancelBtn) cancelBtn.setVisible(true);
        if (battleBtn) battleBtn.setVisible(false);
        if (upgradeBtn) upgradeBtn.setVisible(false);
        
        // Store shop index for later removal
        (this.pendingUnit as UnitDefinition & { _shopIndex?: number })._shopIndex = shopIndex;
        
        this.showMessage(`Click a tile to place ${def.name}`, 0x44ff44);
    }

    private placeUnit(tile: { col: number; row: number }): void {
        if (!this.pendingUnit) return;
        
        const def = this.pendingUnit;
        const shopIndex = (def as UnitDefinition & { _shopIndex?: number })._shopIndex ?? -1;
        
        // SAFETY CHECK: Re-verify gold before placing (prevents negative gold bug)
        if (this.gold < def.cost) {
            this.showMessage('Not enough gold- Good Try Though!.', 0xff4444);
            this.cancelPlacement();
            return;
        }
        
        // SAFETY CHECK: Re-verify unit cap
        const aliveCount = this.playerUnits.filter(u => u.isAlive).length;
        if (aliveCount >= this.currentMaxUnits) {
            this.showMessage('Unit cap reached! Purchase cancelled.', 0xff4444);
            this.cancelPlacement();
            return;
        }
        
        // Deduct gold
        this.gold -= def.cost;
        this.updateGoldDisplay();
        
        // Create and place unit
        const unit = UnitFactory.create(def.id, 'player', tile.col, tile.row);
        if (unit) {
            const worldPos = this.grid.gridToWorld(tile.col, tile.row);
            unit.createVisuals(this, worldPos.x, worldPos.y);
            this.playerUnits.push(unit);
            this.grid.setOccupied(tile.col, tile.row, unit.id);
            
            this.showMessage(`Placed ${def.name}!`, 0x44ff44);
            
            // Add score for purchasing
            this.score += def.tier * 10;
            this.updateScoreDisplay();
        }
        
        // Remove from shop
        if (shopIndex >= 0 && shopIndex < this.shopUnits.length) {
            this.shopUnits.splice(shopIndex, 1);
        }
        
        // Update displays
        this.updateUnitCount();
        this.updateSynergyDisplay();
        
        // Return to shop phase (cancelPlacement will re-show shop overlay)
        this.cancelPlacement();
    }

    private hideUnitInfo(): void {
        this.unitInfoPanel.setVisible(false);
    }

    private showUnitInfo(def: UnitDefinition): void {
        this.unitInfoPanel.setVisible(true);
        
        // Clear ALL existing children for clean re-render
        this.unitInfoPanel.removeAll(true);
        
        // Element emoji mapping
        const elementEmoji: Record<Element, string> = {
            [Element.FIRE]: '🔥',
            [Element.ICE]: '🧊',
            [Element.LIGHTNING]: '⚡',
            [Element.EARTH]: '🌍',
            [Element.ARCANE]: '☪️',
            [Element.VOID]: '🕳️'
        };
        
        // Element colors
        const elementColors: Record<Element, string> = {
            [Element.FIRE]: '#ff6644',
            [Element.ICE]: '#66bbff',
            [Element.LIGHTNING]: '#ffff66',
            [Element.EARTH]: '#88cc44',
            [Element.ARCANE]: '#cc66ff',
            [Element.VOID]: '#8866aa'
        };
        
        // Calculate panel dimensions based on content
        const panelWidth = 300;  // Fixed width for better layout
        const panelHeight = 250;  // Fixed height for better layout
        
        // Background with rounded corners
        const bg = this.add.graphics();
        bg.fillStyle(0x0a1220, 0.95);
        bg.fillRoundedRect(-panelWidth/2, 0, panelWidth, panelHeight, 10);
        bg.lineStyle(1, 0x4488aa, 0.7);
        bg.strokeRoundedRect(-panelWidth/2, 0, panelWidth, panelHeight, 10);
        this.unitInfoPanel.add(bg);
        
        // Unit name with element icon
        const emoji = elementEmoji[def.element] || '';
        const nameText = this.add.text(0, 12, `${emoji} ${def.name}`, {
            fontSize: '20px',
            fontFamily: FONT,
            color: elementColors[def.element] || '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);
        this.unitInfoPanel.add(nameText);
        
        // Tier stars
        const tierStars = this.add.text(0, 30, '★'.repeat(def.tier), {
            fontSize: '18px',
            fontFamily: FONT,
            color: '#ffdd00'
        }).setOrigin(0.5, 0);
        this.unitInfoPanel.add(tierStars);
        
        // Stats in compact 2-column layout
        const statsLeft = this.add.text(-150, 48, [
            `HP: ${def.stats.hp}`,
            `ATK: ${def.stats.attack}`,
            `DEF: ${def.stats.defense}`
        ].join('\n'), {
            fontSize: '15px',
            fontFamily: FONT,
            color: '#cccccc',
            lineSpacing: 2
        });
        this.unitInfoPanel.add(statsLeft);
        
        const statsRight = this.add.text(80, 48, [
            `SPD: ${def.stats.speed}`,
            `RNG: ${def.stats.range}`,
            `Cost: ${def.cost}`
        ].join('\n'), {
            fontSize: '15px',
            fontFamily: FONT,
            color: '#cccccc',
            lineSpacing: 2
        });
        this.unitInfoPanel.add(statsRight);
        
        // Divider line
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x446688, 0.5);
        divider.lineBetween(-75, 150, 75, 150);
        this.unitInfoPanel.add(divider);
        
        // Ability section
        const abilityTitle = this.add.text(0, 125, ` ${def.ability.name}`, {
            fontSize: '15px',
            fontFamily: FONT,
            color: '#88ccff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);
        this.unitInfoPanel.add(abilityTitle);
        
        // Ability description with colorized keywords
        const abilityDescContainer = this.createColorizedText(0, 160, def.ability.description, 14, '#aaaaaa', 160, 'center');
        this.unitInfoPanel.add(abilityDescContainer);
        
        // Cooldown
        const cooldownText = this.add.text(0, 220, `Cooldown: ${def.ability.cooldown} turns`, {
            fontSize: '14px',
            fontFamily: FONT,
            color: '#888888'
        }).setOrigin(0.5, 0);
        this.unitInfoPanel.add(cooldownText);
    }

    // =========================================================================
    // BATTLE
    // =========================================================================

    private startBattlePhase(): void {
        const aliveUnits = this.playerUnits.filter(u => u.isAlive);
        
        if (aliveUnits.length === 0) {
            this.showMessage('Place some units first!', 0xff4444);
            return;
        }
        
        this.phase = 'battle';
        this.phaseText.setText('BATTLE');
        
        // Hide shop overlay
        this.hideShopOverlay();
        
        // Clean up manage mode UI if active
        const manageUI = this.children.getByName('manageUI') as Phaser.GameObjects.Container;
        if (manageUI) manageUI.destroy();
        
        // Hide UI
        this.unitInfoPanel.setVisible(false);
        this.actionButtons.setVisible(false);
        this.placementIndicator.setVisible(false);
        this.grid.clearHighlights();
        
        // Spawn enemy wave
        this.spawnEnemyWave();
        
        // Apply synergy bonuses to player units before battle
        this.applySynergyBonusesToUnits();
        
        // Start battle after short delay
        this.time.delayedCall(500, () => {
            this.battleSystem.startBattle(
                this.playerUnits.filter(u => u.isAlive),
                this.enemyUnits.filter(u => u.isAlive)
            );
        });
    }

    private spawnEnemyWave(): void {
        const wave = WAVES[this.currentWave - 1] || WAVES[WAVES.length - 1];
        
        // Clear old enemies and their grid occupation
        this.enemyUnits.forEach(u => {
            this.grid.setOccupied(u.gridPosition.col, u.gridPosition.row, null);
            u.destroy();
        });
        this.enemyUnits = [];
        
        // Check if this is a boss wave
        const isBossWave = wave.enemies.some(e => e.unitId.startsWith('boss_'));
        
        // Get fresh empty enemy tiles
        const emptyTiles = this.grid.getEmptyEnemyTiles();
        let tileIndex = 0;
        
        for (const enemyDef of wave.enemies) {
            for (let i = 0; i < enemyDef.count && tileIndex < emptyTiles.length; i++) {
                const tile = emptyTiles[tileIndex++];
                const unit = UnitFactory.create(enemyDef.unitId, 'enemy', tile.col, tile.row);
                
                if (unit) {
                    const worldPos = this.grid.gridToWorld(tile.col, tile.row);
                    unit.createVisuals(this, worldPos.x, worldPos.y);
                    this.enemyUnits.push(unit);
                    this.grid.setOccupied(tile.col, tile.row, unit.id);
                }
            }
        }
        
        // Boss wave announcement
        if (isBossWave) {
            this.showBossWaveAnnouncement();
        }
        
        // Update unit tracker to show enemy count
        this.updateUnitCount();
        
        console.log(`Spawned ${this.enemyUnits.length} enemies for wave ${this.currentWave}`);
    }
    
    private showBossWaveAnnouncement(): void {
        // Clean up any existing boss overlay to prevent overlap
        this.cleanupBossOverlay();
        
        // Dramatic boss announcement
        const bossNames: Record<number, string> = {
            5: '🔥 FLAME TYRANT 🔥',
            10: '🧊 FROST COLOSSUS 🧊',
            15: '⚡ CHAOS OVERLORD ⚡'
        };
        
        const bossName = bossNames[this.currentWave] || '💀 BOSS WAVE 💀';
        
        // Dark overlay
        const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.7);
        overlay.setDepth(100);
        
        // Container for all boss announcement elements
        const announcementContainer = this.add.container(0, 0).setDepth(101);
        
        // Boss text
        const bossText = this.add.text(this.scale.width / 2, this.scale.height / 2, bossName, {
            fontSize: '48px',
            color: '#ff4444',
            fontStyle: 'bold',
            stroke: '#ffff00',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        const subText = this.add.text(640, 420, 'PREPARE FOR BATTLE!', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        announcementContainer.add([bossText, subText]);
        
        // Store references for cleanup
        this.activeBossOverlayBg = overlay;
        this.activeBossOverlay = announcementContainer;
        
        // Guarded camera shake (respects settings)
        if (localStorage.getItem('ss_screen_shake') !== 'false' && !this.cameras.main.shakeEffect.isRunning) {
            this.cameras.main.shake(500, 0.015);
        }
        
        // Animate out after delay
        this.time.delayedCall(1500, () => {
            this.tweens.add({
                targets: [overlay, announcementContainer],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    announcementContainer.destroy();
                    if (this.activeBossOverlay === announcementContainer) {
                        this.activeBossOverlay = null;
                        this.activeBossOverlayBg = null;
                    }
                }
            });
        });
    }
    
    private showIncomingBossWarning(): void {
        // Boss info by wave
        const bossInfo: Record<number, { name: string; emoji: string; color: string; tip: string }> = {
            5: { 
                name: 'FLAME TYRANT', 
                emoji: '🔥', 
                color: '#ff4444',
                tip: 'Burns all units! Build defense!'
            },
            10: { 
                name: 'FROST COLOSSUS', 
                emoji: '🧊', 
                color: '#44aaff',
                tip: 'Freezes units for 2 turns! Stack damage!'
            },
            15: { 
                name: 'CHAOS OVERLORD', 
                emoji: '⚡', 
                color: '#aa44ff',
                tip: 'Has 3 PHASES! Prepare for a long fight!'
            }
        };
        
        const info = bossInfo[this.currentWave];
        if (!info) return;
        
        const width = this.scale.width;
        
        // Warning banner at top of screen
        const bannerHeight = 80;
        const banner = this.add.rectangle(width / 2, 100, width - 40, bannerHeight, 0x220000, 0.95)
            .setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(info.color).color)
            .setDepth(90);
        
        // Warning text
        const warningText = this.add.text(width / 2, 85, 
            `⚠️ BOSS INCOMING: ${info.emoji} ${info.name} ${info.emoji} ⚠️`, {
            fontSize: '28px',
            color: info.color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(91);
        
        // Tip text
        const tipText = this.add.text(width / 2, 118, info.tip, {
            fontSize: '16px',
            color: '#ffcc00',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(91);
        
        // Pulse animation
        this.tweens.add({
            targets: [banner, warningText],
            alpha: { from: 0.7, to: 1 },
            duration: 500,
            yoyo: true,
            repeat: 5,
            ease: 'Sine.easeInOut'
        });
        
        // Fade out after 4 seconds
        this.time.delayedCall(4000, () => {
            this.tweens.add({
                targets: [banner, warningText, tipText],
                alpha: 0,
                y: '-=30',
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    banner.destroy();
                    warningText.destroy();
                    tipText.destroy();
                }
            });
        });
    }

    private setupBattleCallbacks(): void {
        this.battleSystem.onTurnStart = (turn) => {
            this.turnIndicator.setText(`⚔️ Turn ${turn}`);
        };
        
        this.battleSystem.onUnitDeath = (unit) => {
            console.log(`${unit.definition.name} (${unit.team}) died!`);
            // Clear grid occupation on death
            this.grid.setOccupied(unit.gridPosition.col, unit.gridPosition.row, null);
            
            // Score for kills
            if (unit.team === 'enemy') {
                this.totalKills++;
                this.score += unit.definition.tier * 25;
                this.updateScoreDisplay();
            }
            
            // Real-time unit tracker update
            this.updateUnitCount();
        };
        
        this.battleSystem.onBossPhaseChange = (boss, phase, phaseIndex) => {
            // Create dramatic phase transition effect
            this.showBossPhaseTransition(boss, phase, phaseIndex);
        };
        
        this.battleSystem.onBattleEnd = (result) => {
            this.turnIndicator.setText('');
            
            if (result === 'victory') {
                this.handleVictory();
            } else {
                this.handleDefeat();
            }
        };
    }

    private handleVictory(): void {
        const wave = WAVES[this.currentWave - 1] || WAVES[WAVES.length - 1];
        const goldEarned = this.currentGoldPerWave + wave.bonusGold;
        const waveBonus = this.currentWave * 50;
        
        this.gold += goldEarned;
        this.score += waveBonus;
        this.updateGoldDisplay();
        this.updateScoreDisplay();
        
        this.showMessage(`Victory! +${goldEarned} gold, +${waveBonus} pts`, 0x44ff44);
        
        // Check if game won
        if (this.currentWave >= GAME_CONFIG.waveCount) {
            this.handleGameWin();
            return;
        }
        
        // Next wave
        this.currentWave++;
        this.updateWaveDisplay();
        
        // Clean up dead units from player roster
        this.playerUnits = this.playerUnits.filter(u => u.isAlive);
        
        // Reset synergy bonuses so healing uses base maxHp
        for (const unit of this.playerUnits) {
            unit.resetSynergyBonuses();
        }
        
        // Heal surviving units between waves
        if (this.currentHealingRate > 0 && this.playerUnits.length > 0) {
            let totalHealed = 0;
            for (const unit of this.playerUnits) {
                const healAmount = Math.floor(unit.definition.stats.maxHp * this.currentHealingRate);
                const oldHp = unit.stats.hp;
                unit.stats.hp = Math.min(unit.stats.hp + healAmount, unit.stats.maxHp);
                totalHealed += unit.stats.hp - oldHp;
                unit.updateHealthBar();
            }
            if (totalHealed > 0) {
                this.showMessage(`Units healed +${totalHealed} HP`, 0x44ff88);
            }
        }
        
        // Clear enemy corpses
        this.enemyUnits.forEach(u => {
            this.grid.setOccupied(u.gridPosition.col, u.gridPosition.row, null);
            if (u.container) u.container.destroy();
        });
        this.enemyUnits = [];
        
        // Reset grid completely
        this.grid.resetGrid();
        
        // Re-occupy player tiles
        for (const unit of this.playerUnits) {
            this.grid.setOccupied(unit.gridPosition.col, unit.gridPosition.row, unit.id);
        }
        
        // Update displays
        this.updateUnitCount();
        this.updateSynergyDisplay();
        
        // Back to shop
        this.time.delayedCall(1500, () => {
            this.startShopPhase();
        });
    }

    private handleDefeat(): void {
        this.phase = 'gameover';
        this.phaseText.setText('GAME OVER');
        
        // Calculate final score
        const finalScore = this.score + (this.currentWave - 1) * 100;
        
        // Darken background
        const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.7);
        overlay.setDepth(100);
        
        // Game over panel
        const panel = this.add.container(this.scale.width / 2, this.scale.height / 2);
        panel.setDepth(101);
        
        const panelBg = this.add.rectangle(0, 0, 400, 300, 0x1a1a3e, 0.95);
        panelBg.setStrokeStyle(3, 0xff4444);
        
        const gameOverText = this.add.text(0, -100, '💀 DEFEAT 💀', {
            fontSize: '36px',
            fontFamily: FONT,
            color: '#ff4444',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const statsText = this.add.text(0, -20, [
            `Wave Reached: ${this.currentWave}/${GAME_CONFIG.waveCount}`,
            `Enemies Killed: ${this.totalKills}`,
            ``,
            `FINAL SCORE: ${finalScore}`
        ].join('\n'), {
            fontSize: '18px',
            fontFamily: FONT,
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        const retryBtn = this.add.rectangle(0, 100, 180, 45, 0x44aa44);
        retryBtn.setStrokeStyle(2, 0x66cc66);
        retryBtn.setInteractive({ useHandCursor: true });
        
        const retryText = this.add.text(0, 100, '🔄 TRY AGAIN', {
            fontSize: '18px',
            fontFamily: FONT,
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        retryBtn.on('pointerover', () => retryBtn.setFillStyle(0x55bb55));
        retryBtn.on('pointerout', () => retryBtn.setFillStyle(0x44aa44));
        retryBtn.on('pointerdown', () => {
            this.scene.restart();
        });
        
        panel.add([panelBg, gameOverText, statsText, retryBtn, retryText]);
    }

    private handleGameWin(): void {
        this.phase = 'gameover';
        this.phaseText.setText('YOU WIN!');
        
        // Calculate final score with win bonus
        const winBonus = 1000;
        const finalScore = this.score + winBonus;
        
        // Track progressive unlocks via win count
        const winsBefore = UnitFactory.getWinCount();
        UnitFactory.incrementWinCount();
        const winsAfter = winsBefore + 1;
        
        // Determine unlock messages
        let unlockMessage = '';
        if (winsAfter === 1) {
            unlockMessage = '\n✨ ARCANE UNITS UNLOCKED! ✨\n(Win again to unlock Void!)';
        } else if (winsAfter === 2 && winsBefore < 2) {
            unlockMessage = '\n🕳️ VOID UNITS UNLOCKED! 🕳️';
        }
        
        // Darken background
        const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.7);
        overlay.setDepth(100);
        
        // Victory panel
        const panel = this.add.container(this.scale.width / 2, this.scale.height / 2);
        panel.setDepth(101);
        
        const panelBg = this.add.rectangle(0, 0, 450, 380, 0x1a1a3e, 0.95);
        panelBg.setStrokeStyle(3, 0xffd700);
        
        const victoryText = this.add.text(0, -150, '🏆 VICTORY! 🏆', {
            fontSize: '42px',
            fontFamily: FONT,
            color: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const statsText = this.add.text(0, -20, [
            `Conquered all ${GAME_CONFIG.waveCount} waves!`,
            ``,
            `Enemies Killed: ${this.totalKills}`,
            `Win Bonus: +${winBonus}`,
            `Total Wins: ${winsAfter}`,
            ``,
            `FINAL SCORE: ${finalScore}`,
            unlockMessage
        ].join('\n'), {
            fontSize: '18px',
            fontFamily: FONT,
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        const playAgainBtn = this.add.rectangle(0, 140, 180, 45, 0x4444aa);
        playAgainBtn.setStrokeStyle(2, 0x6666cc);
        playAgainBtn.setInteractive({ useHandCursor: true });
        
        const playAgainText = this.add.text(0, 140, '🎮 PLAY AGAIN', {
            fontSize: '18px',
            fontFamily: FONT,
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        playAgainBtn.on('pointerover', () => playAgainBtn.setFillStyle(0x5555bb));
        playAgainBtn.on('pointerout', () => playAgainBtn.setFillStyle(0x4444aa));
        playAgainBtn.on('pointerdown', () => {
            this.scene.restart();
        });
        
        panel.add([panelBg, victoryText, statsText, playAgainBtn, playAgainText]);
    }

    // =========================================================================
    // GRID INTERACTION
    // =========================================================================

    private handleTileClick(tile: GridTile): void {
        // Placement mode - place pending unit
        if (this.phase === 'positioning' && this.pendingUnit) {
            if (tile.isPlayerZone && !tile.isOccupied) {
                this.placeUnit(tile);
            } else if (!tile.isPlayerZone) {
                this.showMessage('Must place in YOUR ZONE (blue tiles)', 0xff4444);
            } else {
                this.showMessage('Tile already occupied!', 0xff4444);
            }
            return;
        }
        
        // Shop mode - select player unit for selling/repositioning
        if (this.phase === 'shop') {
            const unitOnTile = this.playerUnits.find(u => 
                u.isAlive && 
                u.gridPosition.col === tile.col && 
                u.gridPosition.row === tile.row
            );
            
            if (unitOnTile) {
                // Select unit for potential selling/moving
                this.selectedUnit = unitOnTile;
                this.showUnitInfo(unitOnTile.definition);
                
                // Highlight selected unit
                this.grid.highlightTiles([tile], 0xff8800);
                
                // Show sell button with price (minimum 1 gold)
                const refund = Math.max(
                    GAME_CONFIG.minSellValue,
                    Math.floor(unitOnTile.definition.cost * GAME_CONFIG.sellRefundPercent)
                );
                const sellBtn = this.actionButtons.getByName('sellBtn') as Phaser.GameObjects.Container;
                if (sellBtn) {
                    sellBtn.setVisible(true);
                    // Update button text (label is at index 2: [graphics, hitArea, label])
                    const label = sellBtn.list[2] as Phaser.GameObjects.Text;
                    if (label) label.setText(`💰 SELL ($${refund})`);
                }
                
                this.showMessage(`${unitOnTile.definition.name} selected - SELL or click empty tile to MOVE`, 0xff8800);
            } else if (tile.isPlayerZone && !tile.isOccupied) {
                // Clicked empty player tile
                if (this.selectedUnit) {
                    // Reposition selected unit to this tile
                    this.repositionUnit(this.selectedUnit, tile);
                } else {
                    // Nothing selected, just clear
                    this.grid.clearHighlights();
                    this.hideUnitInfo();
                }
            } else if (tile.isPlayerZone && tile.isOccupied) {
                // Clicked another occupied tile - switch selection
                // (handled by unitOnTile check above if it's a unit)
            } else {
                // Clicked non-player zone - deselect
                this.selectedUnit = null;
                this.grid.clearHighlights();
                const sellBtn = this.actionButtons.getByName('sellBtn') as Phaser.GameObjects.Container;
                if (sellBtn) sellBtn.setVisible(false);
                this.hideUnitInfo();
            }
        }
    }
    
    private repositionUnit(unit: Unit, targetTile: { col: number; row: number }): void {
        // Clear old position
        this.grid.setOccupied(unit.gridPosition.col, unit.gridPosition.row, null);
        
        // Update unit position
        const worldPos = this.grid.gridToWorld(targetTile.col, targetTile.row);
        unit.gridPosition = { col: targetTile.col, row: targetTile.row };
        if (unit.container) {
            unit.container.setPosition(worldPos.x, worldPos.y);
        }
        
        // Mark new position occupied
        this.grid.setOccupied(targetTile.col, targetTile.row, unit.id);
        
        // Clear selection
        this.selectedUnit = null;
        this.grid.clearHighlights();
        const sellBtn = this.actionButtons.getByName('sellBtn') as Phaser.GameObjects.Container;
        if (sellBtn) sellBtn.setVisible(false);
        
        this.showMessage(`Repositioned ${unit.definition.name}`, 0x44ff44);
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    private updateGoldDisplay(): void {
        this.goldText.setText(`💰 ${this.gold}`);
        // Also update shop overlay gold label if visible
        if (this.shopOverlayContainer) {
            const shopGold = this.shopOverlayContainer.getByName('shopGoldLabel') as Phaser.GameObjects.Text;
            if (shopGold) shopGold.setText(`💰 ${this.gold}`);
        }
    }

    private updateScoreDisplay(): void {
        this.scoreText.setText(`🏆 ${this.score}`);
    }

    private updateWaveDisplay(): void {
        const isBossWave = [5, 10, 15].includes(this.currentWave);
        if (isBossWave) {
            this.waveText.setText(`⚠️ BOSS WAVE ${this.currentWave}/${GAME_CONFIG.waveCount}`);
            this.waveText.setColor('#ff4444');
        } else {
            this.waveText.setText(`WAVE: ${this.currentWave}/${GAME_CONFIG.waveCount}`);
            this.waveText.setColor('#ffffff');
        }
    }

    private updateUnitCount(): void {
        const alivePlayer = this.playerUnits.filter(u => u.isAlive).length;
        const aliveEnemy = this.enemyUnits.filter(u => u.isAlive).length;
        
        this.unitCountText.setText(`👤 ${alivePlayer}/${this.currentMaxUnits}`);
        this.enemyCountText.setText(`👹 ${aliveEnemy}`);
        
        // Color based on status
        this.unitCountText.setColor(alivePlayer === 0 && this.phase === 'battle' ? '#ff4444' : '#66aaff');
        this.enemyCountText.setColor(aliveEnemy === 0 ? '#44ff44' : '#ff6666');
    }

    private cycleBackground(): void {
        // Cycle to next background
        this.currentBackgroundIndex = (this.currentBackgroundIndex + 1) % this.backgroundKeys.length;
        const newKey = this.backgroundKeys[this.currentBackgroundIndex];
        
        // Fade transition
        if (this.backgroundImage) {
            this.tweens.add({
                targets: this.backgroundImage,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    if (this.textures.exists(newKey)) {
                        this.backgroundImage.setTexture(newKey);
                        // Re-scale to cover viewport
                        const width = this.scale.width;
                        const height = this.scale.height;
                        const scaleX = width / this.backgroundImage.width;
                        const scaleY = height / this.backgroundImage.height;
                        const scale = Math.max(scaleX, scaleY);
                        this.backgroundImage.setScale(scale);
                    }
                    this.tweens.add({
                        targets: this.backgroundImage,
                        alpha: 0.3,
                        duration: 300
                    });
                }
            });
        }
    }

    // Message queue to prevent overlap
    private activeMessages: Phaser.GameObjects.Text[] = [];
    private messageBaseY: number = 580;

    private showMessage(text: string, color: number = 0xffffff): void {
        // Calculate Y position based on existing messages
        const yOffset = this.activeMessages.length * 35;
        const yPos = this.messageBaseY - yOffset;
        
        const message = this.add.text(640, yPos, text, {
            fontSize: '20px',
            fontFamily: FONT,
            color: Phaser.Display.Color.IntegerToColor(color).rgba,
            fontStyle: 'bold',
            backgroundColor: '#000000cc',
            padding: { x: 14, y: 6 }
        }).setOrigin(0.5).setDepth(50);
        
        this.activeMessages.push(message);
        
        this.tweens.add({
            targets: message,
            y: yPos - 30,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                const idx = this.activeMessages.indexOf(message);
                if (idx >= 0) {
                    this.activeMessages.splice(idx, 1);
                }
                message.destroy();
            }
        });
    }

    private showBossPhaseTransition(boss: Unit, phase: BossPhase, phaseIndex: number): void {
        // Clean up any existing boss overlay to prevent text overlap
        this.cleanupBossOverlay();
        
        // Full screen dark overlay flash
        const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.8)
            .setDepth(100);
        
        // Phase transition container
        const container = this.add.container(this.scale.width / 2, this.scale.height / 2).setDepth(101);
        
        // Boss title
        const bossTitle = this.add.text(0, -80, `⚔️ ${boss.definition.name} ⚔️`, {
            fontSize: '32px',
            fontFamily: FONT,
            color: '#ff4444',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Phase name with dramatic styling
        const phaseName = this.add.text(0, -20, `Phase ${phaseIndex + 1}: ${phase.name}`, {
            fontSize: '48px',
            fontFamily: FONT,
            color: '#ff6600',
            fontStyle: 'bold',
            stroke: '#330000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Phase description
        const phaseDesc = this.add.text(0, 50, phase.description || '', {
            fontSize: '20px',
            fontFamily: FONT,
            color: '#ffffff',
            fontStyle: 'italic'
        }).setOrigin(0.5);
        
        // Stat change indicators
        const statChanges: string[] = [];
        if (phase.statModifiers.attackMult && phase.statModifiers.attackMult !== 1) {
            const pct = Math.round((phase.statModifiers.attackMult - 1) * 100);
            statChanges.push(`ATK ${pct >= 0 ? '+' : ''}${pct}%`);
        }
        if (phase.statModifiers.defenseMult && phase.statModifiers.defenseMult !== 1) {
            const pct = Math.round((phase.statModifiers.defenseMult - 1) * 100);
            statChanges.push(`DEF ${pct >= 0 ? '+' : ''}${pct}%`);
        }
        if (phase.statModifiers.speedMult && phase.statModifiers.speedMult !== 1) {
            const pct = Math.round((phase.statModifiers.speedMult - 1) * 100);
            statChanges.push(`SPD ${pct >= 0 ? '+' : ''}${pct}%`);
        }
        
        const statsText = this.add.text(0, 100, statChanges.join('  |  '), {
            fontSize: '24px',
            fontFamily: FONT,
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        container.add([bossTitle, phaseName, phaseDesc, statsText]);
        
        // Store references for cleanup
        this.activeBossOverlayBg = overlay;
        this.activeBossOverlay = container;
        
        // Initial state - invisible and scaled down
        container.setScale(0.5);
        container.setAlpha(0);
        overlay.setAlpha(0);
        
        // Dramatic entrance animation
        this.tweens.add({
            targets: overlay,
            alpha: 0.8,
            duration: 200,
            ease: 'Power2'
        });
        
        this.tweens.add({
            targets: container,
            scale: 1,
            alpha: 1,
            duration: 400,
            ease: 'Back.easeOut'
        });
        
        // Pulse the boss unit
        if (boss.container) {
            this.tweens.add({
                targets: boss.container,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 300,
                yoyo: true,
                repeat: 2,
                ease: 'Sine.easeInOut'
            });
        }
        
        // Guarded screen shake (respects settings)
        if (localStorage.getItem('ss_screen_shake') !== 'false' && !this.cameras.main.shakeEffect.isRunning) {
            this.cameras.main.shake(500, 0.01);
        }
        
        // Fade out after delay
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: [overlay, container],
                alpha: 0,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    overlay.destroy();
                    container.destroy();
                    if (this.activeBossOverlay === container) {
                        this.activeBossOverlay = null;
                        this.activeBossOverlayBg = null;
                    }
                }
            });
        });
    }

    /**
     * Clean up any existing boss text overlay to prevent overlap.
     */
    private cleanupBossOverlay(): void {
        if (this.activeBossOverlay) {
            this.activeBossOverlay.destroy();
            this.activeBossOverlay = null;
        }
        if (this.activeBossOverlayBg) {
            this.activeBossOverlayBg.destroy();
            this.activeBossOverlayBg = null;
        }
    }
}

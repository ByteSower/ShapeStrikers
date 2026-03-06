/**
 * Preload Scene - Load assets
 */

import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload(): void {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBox = this.add.rectangle(width / 2, height / 2, 320, 50, 0x222222);
        const progressBar = this.add.rectangle(width / 2 - 150, height / 2, 0, 40, 0x44aaff);
        progressBar.setOrigin(0, 0.5);
        
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            fontSize: '20px',
            fontFamily: 'Rajdhani, sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        const percentText = this.add.text(width / 2, height / 2, '0%', {
            fontSize: '18px',
            fontFamily: 'Rajdhani, sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        this.load.on('progress', (value: number) => {
            progressBar.width = 300 * value;
            percentText.setText(`${Math.floor(value * 100)}%`);
        });
        
        this.load.on('complete', () => {
            progressBox.destroy();
            progressBar.destroy();
            loadingText.destroy();
            percentText.destroy();
        });
        
        // Load any assets here
        // Shape character sprites for units
        const colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        const shapes = ['circle', 'rhombus', 'square', 'squircle'];
        
        for (const color of colors) {
            for (const shape of shapes) {
                this.load.image(`${color}_${shape}`, `sprites/shapes/${color}_body_${shape}.png`);
            }
        }
        
        // Load faces (a-l = 12 faces)
        for (let i = 0; i < 12; i++) {
            const faceLetter = String.fromCharCode(97 + i); // a, b, c, ... l
            this.load.image(`face_${faceLetter}`, `sprites/shapes/face_${faceLetter}.png`);
        }
        
        // Load shadow and tiles
        this.load.image('shadow', 'sprites/shapes/shadow.png');
        this.load.image('tile_grey', 'sprites/shapes/tile_grey.png');
        
        // Load backgrounds
        this.load.image('bg_castles', 'backgrounds/backgroundCastles.png');
        this.load.image('bg_forest', 'backgrounds/backgroundColorForest.png');
        this.load.image('bg_empty', 'backgrounds/backgroundEmpty.png');
        this.load.image('bg_game', 'backgrounds/game_background.png');
        this.load.image('title_art', 'backgrounds/shape_strikers_title.png');
        
        // Create a minimal delay to show loading screen
        this.load.image('placeholder', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    }
    
    /**
     * Generate procedural shape textures and tinted color variants.
     * Called from create() after all PNG assets are loaded.
     * New shapes: triangle, hexagon, star, pentagon, oval
     * New colors: orange, cyan, pink, white, dark (tinted from existing PNGs)
     */
    private generateProceduralShapes(): void {
        const size = 64; // Base texture size matching existing PNGs
        const half = size / 2;
        const pad = 1; // Minimal padding — fill the texture like the original PNGs
        
        // ── Define shape drawing functions ──
        const shapeDrawers: Record<string, (g: Phaser.GameObjects.Graphics, fillColor: number) => void> = {
            triangle: (g, c) => {
                g.fillStyle(c, 1);
                g.fillTriangle(half, pad, pad, size - pad, size - pad, size - pad);
                g.lineStyle(2, 0xffffff, 0.3);
                g.strokeTriangle(half, pad, pad, size - pad, size - pad, size - pad);
            },
            hexagon: (g, c) => {
                g.fillStyle(c, 1);
                const pts: { x: number; y: number }[] = [];
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 2;
                    pts.push({ x: half + Math.cos(angle) * (half - pad), y: half + Math.sin(angle) * (half - pad) });
                }
                g.beginPath();
                g.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < 6; i++) g.lineTo(pts[i].x, pts[i].y);
                g.closePath();
                g.fillPath();
                g.lineStyle(2, 0xffffff, 0.3);
                g.beginPath();
                g.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < 6; i++) g.lineTo(pts[i].x, pts[i].y);
                g.closePath();
                g.strokePath();
            },
            star: (g, c) => {
                g.fillStyle(c, 1);
                const pts: { x: number; y: number }[] = [];
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI / 5) * i - Math.PI / 2;
                    const r = i % 2 === 0 ? half - pad : half * 0.5;
                    pts.push({ x: half + Math.cos(angle) * r, y: half + Math.sin(angle) * r });
                }
                g.beginPath();
                g.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < 10; i++) g.lineTo(pts[i].x, pts[i].y);
                g.closePath();
                g.fillPath();
                g.lineStyle(2, 0xffffff, 0.3);
                g.beginPath();
                g.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < 10; i++) g.lineTo(pts[i].x, pts[i].y);
                g.closePath();
                g.strokePath();
            },
            pentagon: (g, c) => {
                g.fillStyle(c, 1);
                const pts: { x: number; y: number }[] = [];
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                    pts.push({ x: half + Math.cos(angle) * (half - pad), y: half + Math.sin(angle) * (half - pad) });
                }
                g.beginPath();
                g.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < 5; i++) g.lineTo(pts[i].x, pts[i].y);
                g.closePath();
                g.fillPath();
                g.lineStyle(2, 0xffffff, 0.3);
                g.beginPath();
                g.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < 5; i++) g.lineTo(pts[i].x, pts[i].y);
                g.closePath();
                g.strokePath();
            },
            oval: (g, c) => {
                g.fillStyle(c, 1);
                g.fillEllipse(half, half, size - 2, size * 0.78);
                g.lineStyle(2, 0xffffff, 0.3);
                g.strokeEllipse(half, half, size - 2, size * 0.78);
            }
        };
        
        // Color hex values for procedural shapes
        const colorHex: Record<string, number> = {
            red: 0xdd3333, blue: 0x3388dd, green: 0x44aa44,
            yellow: 0xddcc33, purple: 0x8844cc,
            orange: 0xdd7722, cyan: 0x33bbbb, pink: 0xdd55aa,
            white: 0xccccdd, dark: 0x667799
        };
        
        const newShapes = ['triangle', 'hexagon', 'star', 'pentagon', 'oval'];
        const allColors = Object.keys(colorHex);
        
        // Generate all new shape+color combos as textures
        for (const color of allColors) {
            for (const shape of newShapes) {
                const key = `${color}_${shape}`;
                if (this.textures.exists(key)) continue;
                const g = this.add.graphics();
                shapeDrawers[shape](g, colorHex[color]);
                g.generateTexture(key, size, size);
                g.destroy();
            }
        }
        
        // Generate tinted variants of existing PNG shapes for new colors
        // We tint the 'red' base PNGs to create orange, cyan, pink, white, dark variants
        // of circle, rhombus, square, squircle
        const existingShapes = ['circle', 'rhombus', 'square', 'squircle'];
        const newColors = ['orange', 'cyan', 'pink', 'white', 'dark'];
        const tintMap: Record<string, number> = {
            orange: 0xee8833, cyan: 0x33cccc, pink: 0xee66bb, white: 0xddddee, dark: 0x7788aa
        };
        
        for (const color of newColors) {
            for (const shape of existingShapes) {
                const key = `${color}_${shape}`;
                if (this.textures.exists(key)) continue;
                // Use 'red' base and tint it — red base is neutral enough when tinted
                const baseKey = `red_${shape}`;
                if (!this.textures.exists(baseKey)) continue;
                const img = this.add.image(0, 0, baseKey);
                img.setTint(tintMap[color]);
                // Render to texture
                const rt = this.add.renderTexture(0, 0, size, size);
                rt.draw(img, size / 2, size / 2);
                rt.saveTexture(key);
                img.destroy();
                rt.destroy();
            }
        }
    }

    create(): void {
        // Generate procedural shapes & tinted color variants now that PNGs are loaded
        this.generateProceduralShapes();
        
        // Show title screen
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        this.cameras.main.setBackgroundColor('#0a0a1a');
        
        // Title artwork background - scale to fit
        const titleArt = this.add.image(width / 2, height / 2, 'title_art');
        const scaleX = width / titleArt.width;
        const scaleY = height / titleArt.height;
        const scale = Math.max(scaleX, scaleY);  // Cover the screen
        titleArt.setScale(scale);
        titleArt.setAlpha(0.9);
        
        // Scale font sizes based on viewport
        const baseFontSize = Math.max(32, Math.min(56, width / 22));
        const subFontSize = Math.max(14, Math.min(20, width / 60));
        const btnFontSize = Math.max(18, Math.min(24, width / 50));
        
        // Title text — positioned at ~8% from top
        const titleY = height * 0.08;
        const title = this.add.text(width / 2, titleY, 'SHAPE STRIKERS', {
            fontSize: `${baseFontSize}px`,
            fontFamily: 'Rajdhani, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Subtitle — directly below title
        this.add.text(width / 2, titleY + baseFontSize * 0.9, 'Tactical Auto-Battler', {
            fontSize: `${subFontSize}px`,
            fontFamily: 'Rajdhani, sans-serif',
            color: '#88ccff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Start button — positioned at ~84% from top
        const btnY = height * 0.84;
        const btnWidth = Math.max(200, Math.min(260, width * 0.2));
        const btnHeight = Math.max(45, Math.min(55, height * 0.075));
        
        const startBtn = this.add.rectangle(width / 2, btnY, btnWidth, btnHeight, 0x44aa44);
        startBtn.setStrokeStyle(4, 0x66dd66);
        startBtn.setInteractive({ useHandCursor: true });
        
        const startText = this.add.text(width / 2, btnY, '▶ START GAME', {
            fontSize: `${btnFontSize}px`,
            fontFamily: 'Rajdhani, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        startBtn.on('pointerover', () => {
            startBtn.setFillStyle(0x55cc55);
            startBtn.setScale(1.05);
            startText.setScale(1.05);
        });
        
        startBtn.on('pointerout', () => {
            startBtn.setFillStyle(0x44aa44);
            startBtn.setScale(1);
            startText.setScale(1);
        });
        
        startBtn.on('pointerdown', () => {
            this.cameras.main.fadeOut(500);
            this.time.delayedCall(500, () => {
                this.scene.start('GameScene');
            });
        });
        
        // Options button — below start button
        const optBtnY = btnY + btnHeight + 16;
        const optBtnW = Math.max(160, Math.min(200, width * 0.15));
        const optBtnH = Math.max(36, Math.min(44, height * 0.06));
        
        const optBtn = this.add.rectangle(width / 2, optBtnY, optBtnW, optBtnH, 0x334466);
        optBtn.setStrokeStyle(2, 0x5588aa);
        optBtn.setInteractive({ useHandCursor: true });
        
        const optText = this.add.text(width / 2, optBtnY, '⚙ OPTIONS', {
            fontSize: `${Math.max(14, btnFontSize - 4)}px`,
            fontFamily: 'Rajdhani, sans-serif',
            color: '#ccddee',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        optBtn.on('pointerover', () => { optBtn.setFillStyle(0x446688); optBtn.setScale(1.05); optText.setScale(1.05); });
        optBtn.on('pointerout', () => { optBtn.setFillStyle(0x334466); optBtn.setScale(1); optText.setScale(1); });
        
        // Options panel (hidden by default)
        const optPanel = this.add.container(width / 2, height / 2).setDepth(20).setVisible(false);
        
        const panelDim = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
        panelDim.setInteractive(); // block clicks behind
        optPanel.add(panelDim);
        
        const panelW = 360;
        const panelH = 340;
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x0d1526, 0.97);
        panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 14);
        panelBg.lineStyle(2, 0x4488aa, 0.8);
        panelBg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 14);
        optPanel.add(panelBg);
        
        const optTitle = this.add.text(0, -panelH / 2 + 26, '⚙ OPTIONS', {
            fontSize: '22px', fontFamily: 'Rajdhani, sans-serif', color: '#88bbff', fontStyle: 'bold'
        }).setOrigin(0.5);
        optPanel.add(optTitle);
        
        // Initialize settings from localStorage (default: on)
        let shakeEnabled = localStorage.getItem('ss_screen_shake') !== 'false';
        let flashEnabled = localStorage.getItem('ss_screen_flash') !== 'false';
        
        // Toggle helper
        const createToggle = (y: number, label: string, initial: boolean, onChange: (val: boolean) => void) => {
            const labelT = this.add.text(-panelW / 2 + 30, y, label, {
                fontSize: '16px', fontFamily: 'Rajdhani, sans-serif', color: '#cccccc'
            }).setOrigin(0, 0.5);
            optPanel.add(labelT);
            
            const toggleW = 52;
            const toggleH = 26;
            const toggleX = panelW / 2 - 50;
            
            const toggleBg = this.add.graphics();
            const toggleKnob = this.add.circle(0, y, 10, 0xffffff);
            let isOn = initial;
            
            const drawToggle = () => {
                toggleBg.clear();
                toggleBg.fillStyle(isOn ? 0x44aa44 : 0x444444, 1);
                toggleBg.fillRoundedRect(toggleX - toggleW / 2, y - toggleH / 2, toggleW, toggleH, toggleH / 2);
                toggleKnob.setPosition(isOn ? toggleX + toggleW / 2 - 14 : toggleX - toggleW / 2 + 14, y);
            };
            drawToggle();
            
            const toggleHit = this.add.rectangle(toggleX, y, toggleW, toggleH, 0x000000, 0);
            toggleHit.setInteractive({ useHandCursor: true });
            toggleHit.on('pointerdown', () => {
                isOn = !isOn;
                drawToggle();
                onChange(isOn);
            });
            
            optPanel.add([toggleBg, toggleKnob, toggleHit]);
        };
        
        createToggle(-30, 'Screen Shake', shakeEnabled, (val) => {
            shakeEnabled = val;
            localStorage.setItem('ss_screen_shake', val ? 'true' : 'false');
        });
        
        createToggle(20, 'Screen Flash Effects', flashEnabled, (val) => {
            flashEnabled = val;
            localStorage.setItem('ss_screen_flash', val ? 'true' : 'false');
        });
        
        // Divider line
        const dividerY = 58;
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x4488aa, 0.4);
        divider.lineBetween(-panelW / 2 + 20, dividerY, panelW / 2 - 20, dividerY);
        optPanel.add(divider);
        
        // Feedback / Discord section
        const feedbackText = this.add.text(0, 76, 'Found a bug or have feedback?', {
            fontSize: '13px', fontFamily: 'Rajdhani, sans-serif', color: '#8899aa'
        }).setOrigin(0.5);
        optPanel.add(feedbackText);
        
        const discordText = this.add.text(0, 98, '💬  Discord: ByteSower', {
            fontSize: '15px', fontFamily: 'Rajdhani, sans-serif', color: '#7289da', fontStyle: 'bold'
        }).setOrigin(0.5);
        optPanel.add(discordText);
        
        // Close button
        const closeBtnY = panelH / 2 - 36;
        const closeBtn = this.add.rectangle(0, closeBtnY, 120, 36, 0x334466);
        closeBtn.setStrokeStyle(1, 0x5588aa);
        closeBtn.setInteractive({ useHandCursor: true });
        const closeText = this.add.text(0, closeBtnY, 'CLOSE', {
            fontSize: '16px', fontFamily: 'Rajdhani, sans-serif', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x446688));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x334466));
        closeBtn.on('pointerdown', () => optPanel.setVisible(false));
        optPanel.add([closeBtn, closeText]);
        
        optBtn.on('pointerdown', () => optPanel.setVisible(true));
        
        // Animate title with subtle glow effect
        this.tweens.add({
            targets: title,
            scale: { from: 1, to: 1.03 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Fade in
        this.cameras.main.fadeIn(800);
    }
}

/**
 * Grid System - Manages the tactical game board
 */

import Phaser from 'phaser';
import { GRID_CONFIG } from '../config/GameConfig';

export interface GridTile {
    col: number;
    row: number;
    x: number;
    y: number;
    isPlayerZone: boolean;
    isOccupied: boolean;
    occupantId: string | null;
    isObstacle: boolean;  // Impassable tiles
}

export class Grid {
    private scene: Phaser.Scene;
    private tiles: GridTile[][] = [];
    private tileSprites: Phaser.GameObjects.Rectangle[][] = [];
    private selectedTile: GridTile | null = null;
    private gridContainer: Phaser.GameObjects.Container;
    
    // Dynamic positioning (can be updated on resize)
    private currentOffsetX: number = GRID_CONFIG.offsetX;
    private currentOffsetY: number = GRID_CONFIG.offsetY;
    
    // Visual layers
    private baseLayer: Phaser.GameObjects.Container;
    private hazardLayer: Phaser.GameObjects.Container;
    private highlightLayer: Phaser.GameObjects.Container;
    private obstacleLayer: Phaser.GameObjects.Container;
    
    // Event callbacks
    public onTileClick: ((tile: GridTile) => void) | null = null;
    public onTileHover: ((tile: GridTile | null) => void) | null = null;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.gridContainer = scene.add.container(GRID_CONFIG.offsetX, GRID_CONFIG.offsetY);
        
        // Create visual layers
        this.baseLayer = scene.add.container(0, 0);
        this.obstacleLayer = scene.add.container(0, 0);
        this.hazardLayer = scene.add.container(0, 0);
        this.highlightLayer = scene.add.container(0, 0);
        
        this.gridContainer.add([this.baseLayer, this.obstacleLayer, this.hazardLayer, this.highlightLayer]);
        
        this.createGrid();
    }

    private createGrid(): void {
        const { cols, rows, tileSize, battleLineRow } = GRID_CONFIG;

        for (let row = 0; row < rows; row++) {
            this.tiles[row] = [];
            this.tileSprites[row] = [];

            for (let col = 0; col < cols; col++) {
                const x = col * tileSize + tileSize / 2;
                const y = row * tileSize + tileSize / 2;
                
                // Determine zone type
                const isBattleLine = row === battleLineRow;
                const isPlayerZone = row > battleLineRow;

                // Create tile data
                const tile: GridTile = {
                    col,
                    row,
                    x: GRID_CONFIG.offsetX + x,
                    y: GRID_CONFIG.offsetY + y,
                    isPlayerZone,
                    isOccupied: false,
                    occupantId: null,
                    isObstacle: false
                };
                this.tiles[row][col] = tile;

                // Improved zone colors - more vibrant and distinct
                let tileColor = 0x552233;  // Enemy zone - deep maroon
                let strokeColor = 0x773344;
                
                if (isBattleLine) {
                    tileColor = 0x554433;   // Battle line - warm neutral
                    strokeColor = 0xbb9944;
                } else if (isPlayerZone) {
                    tileColor = 0x223355;   // Player zone - deep blue
                    strokeColor = 0x445588;
                }
                
                
                const rect = this.scene.add.rectangle(x, y, tileSize - 4, tileSize - 4, tileColor, 0.75);
                rect.setStrokeStyle(2, strokeColor);
                rect.setInteractive();
                
                // Hover effects
                rect.on('pointerover', () => this.handleTileHover(tile, rect));
                rect.on('pointerout', () => this.handleTileOut(rect));
                rect.on('pointerdown', () => this.handleTileClick(tile));

                this.baseLayer.add(rect);
                this.tileSprites[row][col] = rect;
            }
        }
        
        // Add zone labels
        this.addZoneLabels();
    }

    private addZoneLabels(): void {
        const gridWidth = GRID_CONFIG.cols * GRID_CONFIG.tileSize;
        const gridHeight = GRID_CONFIG.rows * GRID_CONFIG.tileSize;
        
        // Enemy zone - small indicator on the side
        const enemyLabel = this.scene.add.text(
            -10,
            GRID_CONFIG.tileSize,  // Position at row 1
            '👾',
            { fontSize: '18px' }
        ).setOrigin(1, 0.5);
        
        // Player zone - small indicator on the side
        const playerLabel = this.scene.add.text(
            -10,
            gridHeight - GRID_CONFIG.tileSize,  // Position at row 3
            '⚔️',
            { fontSize: '18px' }
        ).setOrigin(1, 0.5);
        
        // Battle line indicator (both sides)
        const battleLineY = GRID_CONFIG.battleLineRow * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
        
        const battleLabelLeft = this.scene.add.text(
            -10,
            battleLineY,
            '⚡',
            { fontSize: '16px' }
        ).setOrigin(1, 0.5);
        
        const battleLabelRight = this.scene.add.text(
            gridWidth + 10,
            battleLineY,
            '⚡',
            { fontSize: '16px' }
        ).setOrigin(0, 0.5);
        
        // Add subtle divider lines at battle line boundaries
        const divider1Y = GRID_CONFIG.battleLineRow * GRID_CONFIG.tileSize;
        const divider2Y = (GRID_CONFIG.battleLineRow + 1) * GRID_CONFIG.tileSize;
        
        const divider1 = this.scene.add.rectangle(
            gridWidth / 2, divider1Y,
            gridWidth, 2,
            0xddaa44, 0.4
        );
        
        const divider2 = this.scene.add.rectangle(
            gridWidth / 2, divider2Y,
            gridWidth, 2,
            0xddaa44, 0.4
        );
        
        this.gridContainer.add([enemyLabel, playerLabel, battleLabelLeft, battleLabelRight, divider1, divider2]);
    }

    private handleTileHover(tile: GridTile, sprite: Phaser.GameObjects.Rectangle): void {
        // Highlight color based on zone - brighter version
        const isBattleLine = tile.row === GRID_CONFIG.battleLineRow;
        let highlightColor = tile.isPlayerZone ? 0x3355aa : 0x773355;  // Blue or maroon
        if (isBattleLine) highlightColor = 0x776644;  // Tan
        
        sprite.setFillStyle(highlightColor, 0.9);
        sprite.setStrokeStyle(3, 0xffffff);
        
        if (this.onTileHover) {
            this.onTileHover(tile);
        }
    }

    private handleTileOut(sprite: Phaser.GameObjects.Rectangle): void {
        // Find the tile for this sprite and restore its color
        for (let row = 0; row < GRID_CONFIG.rows; row++) {
            for (let col = 0; col < GRID_CONFIG.cols; col++) {
                if (this.tileSprites[row][col] === sprite) {
                    const tile = this.tiles[row][col];
                    const isBattleLine = row === GRID_CONFIG.battleLineRow;
                    
                    // Match the colors from createGrid
                    let baseColor = 0x552233;  // Enemy zone
                    let strokeColor = 0x773344;
                    
                    if (isBattleLine) {
                        baseColor = 0x554433;
                        strokeColor = 0xbb9944;
                    } else if (tile.isPlayerZone) {
                        baseColor = 0x223355;
                        strokeColor = 0x445588;
                    }
                    
                    sprite.setFillStyle(baseColor, 0.75);
                    sprite.setStrokeStyle(2, strokeColor);
                    
                    // Re-apply selection if this was selected
                    if (this.selectedTile === tile) {
                        sprite.setStrokeStyle(3, 0xffff00);
                    }
                }
            }
        }
        
        if (this.onTileHover) {
            this.onTileHover(null);
        }
    }

    private handleTileClick(tile: GridTile): void {
        // Clear previous selection
        if (this.selectedTile) {
            const prevSprite = this.tileSprites[this.selectedTile.row][this.selectedTile.col];
            prevSprite.setStrokeStyle(2, 0x444444);
        }
        
        // Set new selection
        this.selectedTile = tile;
        const sprite = this.tileSprites[tile.row][tile.col];
        sprite.setStrokeStyle(3, 0xffff00);
        
        if (this.onTileClick) {
            this.onTileClick(tile);
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    public getTile(col: number, row: number): GridTile | null {
        if (row >= 0 && row < GRID_CONFIG.rows && col >= 0 && col < GRID_CONFIG.cols) {
            return this.tiles[row][col];
        }
        return null;
    }

    public clearSelection(): void {
        if (this.selectedTile) {
            const sprite = this.tileSprites[this.selectedTile.row][this.selectedTile.col];
            sprite.setStrokeStyle(2, 0x444444);
            this.selectedTile = null;
        }
    }

    public setOccupied(col: number, row: number, unitId: string | null): void {
        const tile = this.getTile(col, row);
        if (tile) {
            tile.isOccupied = unitId !== null;
            tile.occupantId = unitId;
            
            // Visual feedback
            const sprite = this.tileSprites[row][col];
            if (unitId) {
                sprite.setAlpha(0.4);
            } else {
                sprite.setAlpha(1);
            }
        }
    }

    public getEmptyPlayerTiles(): GridTile[] {
        const empty: GridTile[] = [];
        for (let row = GRID_CONFIG.rows - GRID_CONFIG.playerZoneRows; row < GRID_CONFIG.rows; row++) {
            for (let col = 0; col < GRID_CONFIG.cols; col++) {
                const tile = this.tiles[row][col];
                if (!tile.isOccupied && !tile.isObstacle) {
                    empty.push(tile);
                }
            }
        }
        return empty;
    }

    public getEmptyEnemyTiles(): GridTile[] {
        const empty: GridTile[] = [];
        for (let row = 0; row < GRID_CONFIG.enemyZoneRows; row++) {
            for (let col = 0; col < GRID_CONFIG.cols; col++) {
                const tile = this.tiles[row][col];
                if (!tile.isOccupied && !tile.isObstacle) {
                    empty.push(tile);
                }
            }
        }
        return empty;
    }

    public highlightTiles(tiles: GridTile[], color: number = 0x00ff00): void {
        this.clearHighlights();
        
        for (const tile of tiles) {
            const x = tile.col * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
            const y = tile.row * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
            
            const highlight = this.scene.add.rectangle(
                x, y,
                GRID_CONFIG.tileSize - 2,
                GRID_CONFIG.tileSize - 2,
                color, 0.3
            );
            highlight.setStrokeStyle(2, color);
            this.highlightLayer.add(highlight);
        }
    }

    public clearHighlights(): void {
        this.highlightLayer.removeAll(true);
    }

    // Manhattan distance (still useful for some calculations)
    public getDistance(tile1: GridTile, tile2: GridTile): number {
        return Math.abs(tile1.col - tile2.col) + Math.abs(tile1.row - tile2.row);
    }
    
    // Row distance - used for range calculations in lane-based combat
    public getRowDistance(tile1: GridTile, tile2: GridTile): number {
        return Math.abs(tile1.row - tile2.row);
    }

    public gridToWorld(col: number, row: number): { x: number; y: number } {
        return {
            x: this.currentOffsetX + col * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2,
            y: this.currentOffsetY + row * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2
        };
    }
    
    /**
     * Reposition the grid based on viewport size
     * Centers grid horizontally (accounting for shop panel on right)
     */
    public reposition(viewportWidth: number, viewportHeight: number, shopPanelWidth: number = 300): void {
        const gridWidth = GRID_CONFIG.cols * GRID_CONFIG.tileSize;
        const gridHeight = GRID_CONFIG.rows * GRID_CONFIG.tileSize;
        
        // Available width is viewport minus shop panel
        const availableWidth = viewportWidth - shopPanelWidth;
        
        // Center grid horizontally in available area
        this.currentOffsetX = (availableWidth - gridWidth) / 2 + GRID_CONFIG.tileSize / 2;
        
        // Center grid vertically with some top margin for UI
        const topMargin = 80;  // Space for top bar
        const bottomMargin = 120;  // Space for buttons
        const availableHeight = viewportHeight - topMargin - bottomMargin;
        this.currentOffsetY = topMargin + (availableHeight - gridHeight) / 2;
        
        // Clamp to minimum values
        this.currentOffsetX = Math.max(50, this.currentOffsetX);
        this.currentOffsetY = Math.max(80, this.currentOffsetY);
        
        // Update grid container position
        this.gridContainer.setPosition(this.currentOffsetX, this.currentOffsetY);
        
        // Update tile data positions
        for (let row = 0; row < GRID_CONFIG.rows; row++) {
            for (let col = 0; col < GRID_CONFIG.cols; col++) {
                const tile = this.tiles[row][col];
                tile.x = this.currentOffsetX + col * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
                tile.y = this.currentOffsetY + row * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
            }
        }
    }
    
    public getOffsets(): { offsetX: number; offsetY: number } {
        return { offsetX: this.currentOffsetX, offsetY: this.currentOffsetY };
    }

    public resetGrid(): void {
        // Clear all occupants
        for (let row = 0; row < GRID_CONFIG.rows; row++) {
            for (let col = 0; col < GRID_CONFIG.cols; col++) {
                const tile = this.tiles[row][col];
                tile.isOccupied = false;
                tile.occupantId = null;
                this.tileSprites[row][col].setAlpha(1);
            }
        }
        this.hazardLayer.removeAll(true);
        this.clearHighlights();
        this.clearSelection();
    }
}

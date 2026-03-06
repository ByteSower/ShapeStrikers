/**
 * Shape Strikers - Main Entry Point
 * A tactical auto-battler with elemental synergies
 */

import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { GAME_CONFIG } from './config/GameConfig';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_CONFIG.width,
    height: GAME_CONFIG.height,
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.EXPAND, // Fills viewport by expanding one axis (no letterboxing, no crop)
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PreloadScene, GameScene]
};

// Create game instance
const game = new Phaser.Game(config);

// Export for debugging
(window as unknown as { game: Phaser.Game }).game = game;

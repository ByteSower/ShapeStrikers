# Shape Strikers ⚔️

**A tactical auto-battler where geometric shapes wage war.** Build your army, master elemental synergies, and conquer 15 waves of increasingly dangerous enemies — culminating in epic multi-phase boss fights.

⚠️ THIS VERSION OF SHAPE SRIKERS IS NOT BEING MAINTAINED ANYMORE PLEASE VISIT THE NEW REPO @https://github.com/ByteSower/ShapeStrikers-no-phaser- ⚠️

> 🎮 **[Play Now](https://bytesower.github.io/ShapeStrikers/)** — runs in any modern browser, no install needed.

---

## 🕹️ How to Play

1. **Buy units** from the shop using gold
2. **Place them** on your side of the battlefield (blue tiles)
3. **Battle** — units auto-fight in their lanes when you start a wave
4. **Win** to earn gold, interest, and bonuses
5. **Repeat** through 15 waves, upgrading your army along the way

### Controls

| Action | How |
|--------|-----|
| Buy a unit | Click a unit card in the shop |
| Place a unit | Click a blue tile on the grid |
| Move a unit | Click a placed unit, then click another tile |
| Sell a unit | Select a unit, then click the sell button |
| Refresh shop | Click the refresh button (costs gold) |

---

## ⚔️ Features

### Core Gameplay
- **Lane-based auto-combat** on a 6×5 grid — units fight within their column
- **15-wave campaign** with hand-crafted enemy compositions
- **Shop economy** — buy, sell, refresh, earn interest on unspent gold
- **4 upgrades** — Army Expansion, Field Medic, War Chest, and more

### 6 Elements
| Element | Synergy Bonus | Color |
|---------|--------------|-------|
| 🔥 Fire | +ATK | Red |
| 🧊 Ice | +DEF | Blue |
| ⚡ Lightning | +SPD | Yellow |
| 🌍 Earth | +HP | Green |
| ✨ Arcane | +ATK / +SPD | Purple |
| 🕳️ Void | +ATK / +HP | Dark (enemy-exclusive*) |

> *Void units unlock for players after completing the game*

**Stack 2+ units of the same element** to activate synergy bonuses. Stack 3 for even stronger effects.

### 3 Boss Fights
| Wave | Boss | Mechanic |
|------|------|----------|
| 5 | 🔥 **Flame Tyrant** | Enrages at 50% HP — +40% ATK |
| 10 | 🧊 **Frost Colossus** | Glacial fortress with massive DEF scaling |
| 15 | ⚡ **Chaos Overlord** | **3 phases** — Awakening → Corruption → Cataclysm |

### 30+ Unique Units
Every unit has a distinct shape, color, face, and ability. Units range from Tier 1 critters (Fire Imp, Ice Slime) to Tier 3 powerhouses (Lightning Lord, Ice Empress) — each with procedurally generated geometric bodies.

### Good vs. Evil
**Player units** have happy, friendly faces 😊. **Enemy units** have angry, hostile faces 😠. The battlefield tells a story.

---

## 🧠 Strategy Tips

- **Diversify early, specialize late** — buy cheap units initially, then build toward 2-3 element synergies
- **Save gold for interest** — unspent gold earns bonus income each wave
- **Position matters** — units only fight enemies in the same lane (column)
- **Upgrade wisely** — Army Expansion lets you field more units; Field Medic heals between waves
- **Boss waves** require focused lanes — don't spread too thin

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [Phaser 3](https://phaser.io/) | Game engine |
| TypeScript | Game logic |
| Vite | Build tool |
| GitHub Actions | CI/CD deployment |
| GitHub Pages | Hosting |

### Architecture
```
src/
├── config/GameConfig.ts    # All game data: units, waves, upgrades, elements
├── entities/Unit.ts        # Unit rendering, stats, face expressions
├── battle/BattleSystem.ts  # Auto-battle logic, boss phases
├── grid/Grid.ts            # Lane-based 6×5 grid system
└── scenes/
    ├── PreloadScene.ts     # Asset loading + procedural shape generation
    └── GameScene.ts        # Main game loop, shop, UI, battle flow
```

The game uses **procedural graphics** — most unit visuals are generated at runtime from geometric shapes and tinted colors, demonstrating that engaging gameplay doesn't require elaborate art assets.

---

## 💻 Development

### Prerequisites
- Node.js 18+

### Run Locally
```bash
git clone https://github.com/ByteSower/ShapeStrikers.git
cd ShapeStrikers
npm install
npm run dev
```
Opens at `http://localhost:3000`

### Build for Production
```bash
npm run build
```
Outputs to `dist/` — a self-contained static site ready for any web host.

---

## 📜 License

See [LICENSE](LICENSE) for details.

---

**Designed and developed by [ByteSower](https://github.com/ByteSower)**

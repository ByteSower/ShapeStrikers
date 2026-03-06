# Contributing to Shape Strikers

## Branch Workflow

**Never push directly to `main`.** The `main` branch is the live production build — every push auto-deploys to GitHub Pages.

### How to make changes

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b fix/description-of-change
   ```

2. **Branch naming conventions:**
   | Prefix | Use for |
   |--------|---------|
   | `fix/` | Bug fixes |
   | `feature/` | New features |
   | `balance/` | Gameplay balance changes |
   | `ui/` | UI/UX improvements |
   | `chore/` | Cleanup, docs, CI changes |

3. **Develop and test locally:**
   ```bash
   npm run dev      # Test in browser at localhost:3000
   npx tsc --noEmit # Verify no type errors
   npm run build    # Verify production build works
   ```

4. **Push your branch and open a Pull Request:**
   ```bash
   git push -u origin fix/description-of-change
   ```
   Then open a PR on GitHub targeting `main`.

5. **CI runs automatically** — the PR must pass type-check + build before merging.

6. **Merge via GitHub** — use "Squash and merge" to keep history clean.

7. **Delete the branch** after merging (GitHub offers this automatically).

### Rules

- **One feature/fix per branch** — keep changes focused
- **Test on both desktop and mobile** before marking PR ready
- **No `--force` pushes to `main`** — ever
- **Build must pass** before merging

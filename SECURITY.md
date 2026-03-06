# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (main branch) | ✅ |

## Reporting a Vulnerability

If you discover a security issue in Shape Strikers, please report it responsibly:

1. **Do NOT open a public issue**
2. Email the maintainer or use [GitHub's private vulnerability reporting](https://github.com/ByteSower/ShapeStrikers/security/advisories/new)
3. Include a description of the vulnerability and steps to reproduce

We will respond within 72 hours and work toward a fix.

## Scope

Shape Strikers is a client-side browser game. The primary security concerns are:

- **XSS or injection** via any user-facing input
- **Supply chain attacks** via compromised dependencies
- **Unauthorized modifications** to the deployed game

## Practices

- Dependencies are kept minimal (Phaser 3 + TypeScript + Vite only)
- All changes to `main` require review before merge
- GitHub Actions deploys from `main` only — no manual deployment
- No user data is collected; only `localStorage` is used for save state

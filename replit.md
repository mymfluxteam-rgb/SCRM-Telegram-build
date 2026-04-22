# Telegram Web (tweb)

Telegram Web client built with Vite + SolidJS + TypeScript.

## Setup
- Package manager: pnpm
- Dev server: `pnpm start` (vite) — bound to `0.0.0.0:5000` for the Replit preview, with `allowedHosts: true` and HMR clientPort `443`.
- Workflow: "Start application" runs `pnpm start --port 5000 --host 0.0.0.0`.

## Deployment
- Target: static
- Build: `pnpm run build`
- Public dir: `dist`

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

## Custom features
- **Fast Messages sidebar** (`src/components/fastMessagesSidebar.ts`, SCSS in `src/scss/partials/_fastMessagesSidebar.scss`): right-side column with two tabs — "Fast Messages" (clickable, editable list of phrases) and "Language Format" (translation toggles + language selects). Header carries an Edit toggle plus a "Quick Auto Reply" pill toggle.
- **Cloud sync of fast messages** (`src/lib/fastMessagesCloudSync.ts`): persists the list as a hidden, silently pinned marker message in the user's Saved Messages so the list follows them across devices.
- **Quick Auto Reply** (`src/lib/fastMessagesAutoReply.ts`): when the toggle is on, listens to `history_multiappend` and, if an incoming message contains one of the saved fast messages (case-insensitive, longest-match), automatically replies with that phrase via `appMessagesManager.sendText`. Loop-prevention: ignores own/outgoing/Saved Messages, throttles per-peer (30 s), and skips text recently auto-sent.
- **State**: `autoReply: boolean` and `fastMessages: string[]` live under `StateSettings` in `src/config/state.ts` (defaults `false` and the bundled phrase list).
- The original Language Format icon was removed from the chat top bar (`src/components/chat/topbar.ts`); those settings are reachable only through the Language Format sidebar tab.

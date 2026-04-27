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
- **Fast Messages sidebar** (`src/components/fastMessagesSidebar.ts`, SCSS in `src/scss/partials/_fastMessagesSidebar.scss`): right-side column with two tabs — "Fast Messages" (clickable, editable list of rules) and "Language Format" (translation toggles + language selects). Header carries an Edit toggle plus a "Quick Auto Reply" pill toggle.
- **Rule shape**: each fast message is a `FastMessageRule = { trigger: string, reply: string, match: 'exact' | 'contains' | 'startsWith' }` (defined in `src/config/state.ts`). View mode shows the reply text and any trigger in a metadata line; edit mode exposes a trigger input + match-mode select + reply textarea per row. Click in view mode inserts the reply into the chat input.
- **Shared utils** (`src/lib/fastMessagesUtils.ts`): `normaliseFastMessages` migrates legacy `string[]` entries to rule objects (legacy reply ⇒ `{trigger:'', reply, match:'contains'}`), and `findMatchingRule` picks the longest-needle rule matching the incoming text.
- **Cloud sync of fast messages** (`src/lib/fastMessagesCloudSync.ts`): persists the list as a hidden, silently pinned marker in the user's Saved Messages. Marker payload is now `v: 2` carrying full rule objects; v1 markers (legacy `string[]`) are still parsed for back-compat and converted to rules on read.
- **Quick Auto Reply** (`src/lib/fastMessagesAutoReply.ts`): when the toggle is on, listens to `history_multiappend` and, for each incoming message, picks the longest matching rule (per its `match` mode) and sends `rule.reply` via `appMessagesManager.sendText`. Loop-prevention: ignores own/outgoing/Saved-Messages chats, throttles per-peer (30 s), and skips text we recently auto-sent.
- **Sidebar visibility (toggle)**: the Fast Messages column is hidden by default. The chat top bar's "More actions" (three-dots) menu has a custom **Toggle Fast Messages** entry (`src/components/chat/topbar.ts`) that opens a submenu (built via `createSubmenuTrigger`) with two items — **Fast Messages** and **Language Format**. Picking either calls `openFastMessagesSidebarTab(tab)` exported from `src/components/fastMessagesSidebar.ts`, which sets `appSettings.fastMessagesSidebarOpen = true` and switches the sidebar's active tab. A Solid effect in `src/components/fastMessagesSidebar.ts` mirrors `fastMessagesSidebarOpen` onto a `body.fast-sidebar-open` class. The SCSS in `_fastMessagesSidebar.scss` uses that class to slide `#column-fast` in/out via `transform: translateX(...)` and only reserves the right padding/inset for `#main-columns` and `#column-right` while open — so when closed the chat fills the full width. The column sits at `z-index: 3` so it stays underneath standard popups/menus and the More-actions menu is never overlapped. The class is also mirrored under `body[dir="rtl"]` so the slide direction is correct in RTL.
- **State**: `autoReply: boolean`, `fastMessages: FastMessageRule[]` and `fastMessagesSidebarOpen: boolean` live under `StateSettings` in `src/config/state.ts` (defaults `false`, a bundled set of rules with sensible triggers, and `false`).
- The original Language Format icon was removed from the chat top bar (`src/components/chat/topbar.ts`); those settings are reachable only through the Language Format sidebar tab.

# Headspace

A local workspace that stays at the top of the macOS / Windows screen. On Mac it collapses to the physical notch; click to expand. Tabs: **Home / Tasks / Notes / Links / Record / Vault**; Clipboard is off by default (enable from the menu bar or Settings). Also receives Codex / Claude Code / GPT local completion events and can focus related windows.

Single Electron architecture: collapsed strip, expanded panel, task-complete toasts, and Hover + Space summon all live in the main process and renderer. `npm start` is the only run path.

> **Source of truth:** Product behavior is defined by [README.md](README.md). If this file conflicts with README, README wins.

## Stack

- Desktop: Electron 44 + native HTML/CSS/JavaScript (no renderer build step)
- Website: React 19 + Vinext + native CSS in `website/`
- Data: LocalStorage + `userData/clipboard-images/` + `userData/recordings/` — no backend or cloud sync
- Package manager: npm
- Node: desktop 18+; website requires Node 22.13.0+

## Commands

- Desktop dev: `npm install && npm start`
- Desktop checks: `npm test`
- Desktop package: `npm run build` (only after explicit user confirmation)
- Website dev: `cd website && npm install && npm run dev`
- Website checks: `cd website && npm run lint && npm run build`

## Layout

```text
.
├── main.js                 # Electron main: window, tray, clipboard, media, notify
├── main-services.js        # Testable pure domain services (no Electron)
├── preload.js              # contextBridge
├── renderer/               # Desktop UI (index.html, styles, feature *-ui.js modules)
├── build/                  # DMG hooks, entitlements, icons
├── scripts/                # Codex / Claude Code notify relays
├── tests/                  # Node + Electron tests
├── docs/                   # Design notes, ADRs, acceptance media
├── website/                # React / Vinext marketing site
└── package.json
```

## Product constraints

- Identity (2.0.0+): product `Headspace`, appId `com.lioneltchami.headspace`, repo `lioneltchami/Headspace`, Pages `https://lioneltchami.github.io/Headspace/`. userData folder `Headspace`; one-time copy from legacy `Dynamic Panel` only when `Headspace` is missing (never overwrite; `--user-data-dir` wins). LocalStorage `notch-*` keys unchanged.
- Dual platform: macOS 13+ arm64 and Windows 10/11 x64 share code and version. Windows builds use `npm run build:win` (NSIS EXE). Release only after both platforms pass.
- Windows: collapsed 200 × 38 DIP, top-centered on the work area (avoid taskbar); hide Open windows and Soda Music without rewriting saved visibility prefs; clipboard is copy-only; alerts dismiss on click.
- Portable media paths: new recordings / clipboard images in LocalStorage / workspace.json use `/`-separated relative paths; encrypted vault keys are not guaranteed to migrate across machines.

- Collapsed: width 200px, height = menu bar height, never taller than the physical notch
- Expanded: content `1240 × 540`; window height `76 + 540`; keep 24px margin on narrow/short screens
- Tasks: 2 × 2 layout, Enter to add, colors red / orange / green / blue. Storage keys stay `P0`–`P3` (`notch-todo-data` must not change). Default labels: Courses / Media & Writing / Vibe coding / Daily (renameable via `notch-todo-category-names-v1`). Default deadline today 23:30; remind one hour before
- Clipboard: off by default (`DEFAULT_FEATURES.clip = false`); enable from menu bar or Settings. History via main-process poll; no global shortcut (`clipboardServicePolicy`)
- Links: public http/https only; title fetch must block localhost, private nets, unsafe redirects
- Record: audio under `userData/recordings/`; transcript + metadata in LocalStorage; optional DashScope Qwen3-ASR; API keys via `safeStorage` or env
- Mirror: 1:1 square on Home; start only on click; release track when leaving Home or collapsing
- Open windows (macOS): Accessibility enumerate/focus; system app icons; number duplicate titles; hidden IDs in LocalStorage; focus IPC only accepts IDs from latest scan cache
- Notes: save from Home scratch into Notes tab; search, rename, edit, delete
- Motion: no OS window animation; renderer motion with `prefers-reduced-motion`
- Notify: separate `400 × 96` non-focusing window; HTTP only `127.0.0.1:43821` `/notify/<source>` whitelist `codex` / `claude` / `gpt`; relays in `scripts/codex-notify.js` and `scripts/claude-notify.js`; no toasts for subagents or cloud sessions

## Code rules

- Main-process files camelCase; constants `UPPER_SNAKE`
- Renderer logic under `renderer/`, isolated from main
- IPC only through `preload.js` contextBridge
- Visual values via CSS custom properties

## GitHub push & release

- Before pushing product updates: align version, `CHANGELOG.md`, README stable version + download links, GitHub Pages download buttons.
- Formal release: `package.json` / `package-lock.json` versions match; push `v*.*.*` tag; verify Release DMG / EXE + SHA-256 and Pages download targets after Actions.
- Website download buttons resolve `arm64.dmg` and `windows-x64-setup.exe` from `releases/latest` — no stale fixed links or cross-platform mix-ups.

## NEVER

- NEVER `require('electron')` in the renderer — use preload
- NEVER let the window leave the top-center notch position
- NEVER keep the camera running; release track when leaving Home or collapsing
- NEVER start the mic without an explicit click; release audio tracks when recording ends or the app quits
- NEVER store clipboard image dataURLs in LocalStorage
- NEVER commit `node_modules` or `dist`
- NEVER package or publish the desktop app without explicit user confirmation

## Compact instruction

When running `/compact`, keep:

- Current window behavior and style details
- LocalStorage data shapes
- Known macOS, multi-display, menu-bar, and camera issues

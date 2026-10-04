# Headspace

A monochrome glass **dashboard** that lives in the macOS notch: collapses to notch size by default, expands downward on click. Tabs: **Home / Tasks / Notes / Links / Record / Vault**. Home includes a centered 1:1 Mirror, Markdown scratch note, Commands, Quick record, Soda Music, Pomodoro, and Open windows. Clipboard is off by default (enable from the menu bar). Codex / Claude Code / GPT completion events show as toasts and Home task status.

Single Electron architecture: collapsed strip, expanded panel, completion toasts, and Hover + Space summon are implemented in the Electron main process and renderer. `npm start` is the only run path.

> **Source of truth:** Product behavior is defined by [README.md](README.md). If this file conflicts with README, README wins.

## Stack

- Framework: Electron (no React/Vue — plain HTML/CSS/JS)
- Styles: native CSS (Apple-like glass + radii)
- Language: JavaScript (no build step)
- Backend: none (metadata in LocalStorage; recordings and legacy clipboard images in userData)
- Package manager: npm
- Node: >=18

## Commands

- Dev: `npm start`
- Install: `npm install`
- Package: `npm run build` (electron-builder; only after explicit user confirmation)
- Website: `cd website && npm install && npm run dev`
- Website checks: `cd website && npm run lint && npm run build`

## Layout

```text
Headspace/
 package.json
 main.js                 # Main process: window, placement, always-on-top, IPC
 main-services.js
 preload.js
 platform.js
 renderer/
   index.html
   styles.css
   ui-shared.js / *-ui.js / app.js / workspace*.js
   notification.*
   assets/
 docs/
 website/
```

## Key design parameters

- Identity (2.0.0+): product `Headspace`, appId `com.lioneltchami.headspace`, repo `lioneltchami/Headspace`; userData `Headspace` with one-time copy from legacy `Dynamic Panel` (never overwrite an existing `Headspace`); LocalStorage keys unchanged
- Collapsed size: width 200px, height = **menu bar height** (= physical notch height, ~37pt; fallback min 38px) — must never exceed the native notch; no lip; `screen-saver` always-on-top so the strip stays clickable inside the menu bar
- Expanded: visible tabs share `1240 × 540` content; window from y=0; total height `EXPANDED_CHROME_Y(76) + panelHeight(540)`; clamp width on narrow screens
- Expanded chrome: black panel from screen top covering the menu bar; top bar `padding-top` = menu bar + 4; product name “Headspace”; tabs clear the physical notch
- Window morphing: **main-process `setBounds` is always instantaneous** (no OS animation); expand grows window then plays panel entrance; collapse plays exit then shrinks. Tab switches change content only
- Multi-display: mode / tab / blur-collapse anchor to the **window’s current display** (`getDisplayMatching`), never the cursor — except launch / tray recenter / show
- Expand/collapse: click collapsed strip to expand; collapse via top-bar blank (except tabs/controls), Escape (main `before-input-event`), or blur
- Visible tabs: Home bento + Tasks 2×2 (`P0`–`P3`) + Notes + Links + Record + Vault. Clipboard optional
- Motion: Linear-like 100–180ms micro-interactions; grow-from-top expand/collapse; window itself has zero animation; honor `prefers-reduced-motion`
- Task toasts: `400 × 96` no-focus window; queue max 5; HTTP only `127.0.0.1:43821` `/notify/<source>` whitelist `codex` / `claude` / `gpt`
- Clipboard: main polls every 500ms when enabled; skip ConcealedType; images under userData with path whitelist; FIFO 100; no global shortcut
- Colors: pure black `#000000`, white text scale; accent only on P0–P3 dots
- Radii: notch `--r-notch` 10px bottom; panel `--r-panel` 16px bottom; tops flush
- Todo Enter submits once; IME composing / keyCode 229 does not submit
- Todo inbox: workspace `todo-inbox/*.json`, 2s poll, merge append-only via `mergeTodoImport`

## Code rules

- Main-process files camelCase; constants `UPPER_SNAKE`
- All renderer logic under `renderer/`
- IPC via preload contextBridge only — no `nodeIntegration`
- Styles use CSS custom properties

## NEVER

- NEVER `require('electron')` in the renderer
- NEVER let the window leave the notch top-center position
- NEVER hardcode colors/sizes outside CSS variables
- NEVER commit `node_modules` / `dist`
- NEVER package without user confirmation
- NEVER leave the camera running off Home / when collapsed

## Compact instruction

When running `/compact`, keep:

- Current window behavior or style details under edit
- LocalStorage task model
- Known macOS adaptation issues

# Changelog

Notable features, fixes, and releases for Headspace (named TO-DO Panel before 2.0.0). Unreleased work goes under `[Unreleased]` and is archived into a version section when a tag is cut.

## [Unreleased]

## [2.0.1] - 2026-10-04

### Changed

- App icon, tray icon, website favicon, and share image use the new Headspace mark (glossy black notch cutout).


## [2.0.0] - 2026-10-04

### Changed

- **Breaking — renamed to Headspace.** New app identity `com.lioneltchami.headspace`, product name `Headspace`, installers `Headspace-<version>-arm64.dmg` and `Headspace-<version>-windows-x64-setup.exe`. The repository and website moved to [lioneltchami/Headspace](https://github.com/lioneltchami/Headspace) and <https://lioneltchami.github.io/Headspace/>.
- Data folder is now `Headspace` (macOS `~/Library/Application Support/Headspace`, Windows `%APPDATA%\Headspace`). On first launch the old `Dynamic Panel` folder is copied once if `Headspace` does not exist yet; an existing `Headspace` folder is never overwritten and `--user-data-dir` still wins. LocalStorage keys are unchanged.
- Because the identity changed: macOS re-prompts for Camera / Microphone / Accessibility / Automation; Vault entries and the DashScope key encrypted with `safeStorage` may need re-entry; Windows installs side by side — uninstall the old “TO-DO Panel” after confirming data.
- Full English UI, menus, notifications, website copy, and docs for global use. Default task category names are Courses / Media & Writing / Vibe coding / Daily. Locales and live transcription default to English (`en-US` / `en`).
- Split monolithic renderer scripts into classic feature modules (`todo-ui`, `notes-ui`, `home-ui`, `clipboard-ui`, workspace modules, thin orchestrators) with no bundler.

## [1.2.0] - 2026-09-30

### Added

- Todo inbox: local scripts or AI assistants drop JSON into workspace `todo-inbox/`; checked about every 2s while running and on launch; appends by `P0`–`P3` or category display name without restart; never edits existing todos. Processed files move to `processed/` with per-item skip reports; same file / same id is not imported twice.

### Fixed

- Mirror failed when Filteronme, OBS, Shangjing, and similar virtual cameras ranked first: unspecified device picked a virtual cam that never produced frames. Prefer built-in camera, then external / Continuity Camera, virtual last; auto-advance if no frame within 3s.
- Canceling mid-mirror start no longer falsely reports “Can’t open the camera” and releases the camera immediately.

## [1.1.2] - 2026-09-12

### Fixed

- After staying open across midnight, new todos still used yesterday or the last default date. Deadline refresh is independent of the home clock; wake, expand, return to Tasks, input, and submit recalibrate to today 23:30 while keeping a manually chosen date for the current draft.

## [1.1.1] - 2026-09-11

### Fixed

- Live transcription stopped updating after disconnect, errors, or session end: auto-reconnect, heartbeat, and up to 30s of outbound audio buffer; keep text from before the drop.
- Existing transcript text no longer hides connection-error feedback; fixed cleanup and trailing text save when stopping during reconnect.

### Website

- Download buttons stacked full-width: macOS above, Windows below; same styling and dynamic release URLs.

## [1.1.0] - 2026-09-07

### Added

- Windows 10/11 x64 installer sharing version and business code with the macOS DMG; Windows tray, launch at login, top work-area placement, and system encryption.
- Windows Home hides Open windows and Soda Music by capability while keeping saved widget prefs; clipboard is copy then Ctrl+V.
- Windows runner verifies install, real app launch, core IPC, mock A/V device release, data retention, and uninstall; dual-platform gate before one Release.
- Website “Download for Windows” button resolves the latest Release asset separately from macOS.

### Fixed

- Restoring a workspace backup no longer fails own reload via navigation guard; recording workspace init and sticky-note overwrite bugs fixed; still blocks external navigation and opening other local files.

## [1.0.7] - 2026-09-04

### Fixed

- First mic/camera permission sheets on macOS were covered by the always-on-top panel; temporarily lower z-order and activate the app during the prompt, then restore.
- Overlapping camera/mic prompts no longer restore always-on-top too early.
- Spam-clicking record while waiting for permission no longer starts many requests; one in-flight start with clear permission status.

## [1.0.6] - 2026-09-04

### Added

- Settings “Default expand tab” — pick Home, Tasks, or any visible tab as the page shown each summon.

### Fixed

- After creating a todo, deadline resets to today 23:30 instead of keeping the previous manual date.

## [1.0.5] - 2026-08-31

### Fixed

- Very long todo reminders were clamped to 1ms by Node timer overflow (`TimeoutOverflowWarning`); long delays now check in segments.
- Home widget size changes no longer flash large black regions or stack animations; cancellable real-card FLIP with content visible.
- Less cold-open composite work: no full content-layer scale plus staggered seven-tile entrance replay.

## [1.0.4] - 2026-08-30

### Fixed

- Vault selection could not be toggled off; bulk delete hides immediately when cleared.
- Vault bulk Delete sat under the search field; stays on the same row to the right when selecting.

## [1.0.3] - 2026-08-30

### Desktop

- Enabling clipboard history no longer imports pre-enable content; alternating text/image no longer re-imports the same image; fresh profiles have no preset history.
- Clipboard image dedupe uses content hash so same dimensions/length no longer collide.
- Reuse Electron 44 `ClipboardItem` PNG bytes; image probe every 3s to avoid re-encoding 4K images every poll.
- Mirror image and workspace folder pickers attach to the main panel and do not blur-collapse the panel.
- Less GPU on expand/collapse and idle Home: content layer not heavily clipped; WebGL only on hover.
- Multi-tab layout no longer covers the whole top bar with a transparent hit target blocking collapse-on-blank; Tab click and Space collapse unchanged.
- Renderer sandbox on; deny local window navigation and child windows.
- Electron 44 + electron-builder 26.15.7; minimum macOS 13; dependency audit cleanups.
- Tighter macOS entitlements; startup checks do not touch screen-capture APIs before consent.
- Destroy the notification window when the queue empties so a hidden renderer does not linger.

### Website

- Auto Loading wake animation inside the Mac screen: wait for second-screen shots and first tab video; static cover after 8s.
- Tab demos: silent faststart H.264 MP4 with WebP posters instead of GIF.
- Second-screen product shots as WebP; updated clipboard screenshot.
- Loading breath, copy size, full-bleed radius, and wallpaper handoff polish.

## [1.0.2] - 2026-08-29

### Added

- In-panel Settings for APIs, Mirror, feature visibility, shortcut, data folder, and launch at login.
- Per-credential delete.

### Fixed

- Todo deadlines: month navigation, natural year rollover, and correct sort.

## [1.0.1] - 2026-08-28

### Fixed

- Record page controls restored: start, pause, and stop.

## [1.0.0] - 2026-08-26

### Release

- First stable release with a fixed-name Apple Silicon DMG pipeline.

[Unreleased]: https://github.com/lioneltchami/Headspace/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/lioneltchami/Headspace/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/lioneltchami/Headspace/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.0.7...v1.1.0
[1.0.7]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/xiaopu-ai/TO-DO-Panel/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/xiaopu-ai/TO-DO-Panel/releases/tag/v1.0.0

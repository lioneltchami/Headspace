# Package managers (Homebrew + winget)

GitHub Releases remain the source of truth. Homebrew and winget wrap those assets.

## Homebrew (macOS, Apple Silicon)

Tap: [lioneltchami/homebrew-tap](https://github.com/lioneltchami/homebrew-tap)

```bash
brew tap lioneltchami/tap
brew install --cask headspace
```

Cask: `Casks/headspace.rb` (arm64 DMG only).

### Release automation

After a `v*` Release publishes, the `homebrew` job in `.github/workflows/release-dmg.yml` downloads the arm64 DMG, hashes it, and runs `scripts/update-homebrew-cask.sh`.

Requires repo secret **`HOMEBREW_TAP_DEPLOY_KEY`**: deploy key with write access to `lioneltchami/homebrew-tap` (same pattern as Lamp-Light). If the secret is missing, the job skips.

Manual bump:

```bash
VERSION=2.0.0
ARM_SHA=$(curl -fsSL "https://github.com/lioneltchami/Headspace/releases/download/v${VERSION}/Headspace-${VERSION}-arm64.dmg.sha256" | awk '{print $1}')
bash scripts/update-homebrew-cask.sh "$VERSION" "$ARM_SHA"
```

## winget (Windows)

Package id: **`Lioneltchami.Headspace`**

Generate manifests from the published Windows SHA-256:

```bash
VERSION=2.0.0
WIN_SHA=$(curl -fsSL "https://github.com/lioneltchami/Headspace/releases/download/v${VERSION}/Headspace-${VERSION}-windows-x64-setup.exe.sha256" | awk '{print $1}')
bash scripts/generate-winget-manifests.sh "$VERSION" "$WIN_SHA"
```

Output: `packaging/winget/manifests/l/Lioneltchami/Headspace/<version>/`

### Publish to community repo

1. Fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs).
2. Copy the version folder into `manifests/l/Lioneltchami/Headspace/<version>/` on a new branch.
3. Validate: `winget validate --manifest manifests/l/Lioneltchami/Headspace/<version>`
4. Open a PR. First-time contributors accept the CLA.

Until the PR merges, users install from the DMG/EXE on GitHub Releases. After merge:

```powershell
winget install Lioneltchami.Headspace
```

## Chocolatey

Not shipped. Overlaps winget for this app; add later only if needed.

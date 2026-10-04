#!/usr/bin/env bash
# Generate winget manifests for a Headspace release.
# Usage: generate-winget-manifests.sh <version> <windows_sha256>
# Writes packaging/winget/manifests/l/Lioneltchami/Headspace/<version>/
set -euo pipefail

VERSION="${1:?version required (e.g. 2.0.0)}"
WIN_SHA="${2:?windows setup sha256 required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/packaging/winget/manifests/l/Lioneltchami/Headspace/${VERSION}"
ID="Lioneltchami.Headspace"
URL="https://github.com/lioneltchami/Headspace/releases/download/v${VERSION}/Headspace-${VERSION}-windows-x64-setup.exe"

mkdir -p "$OUT"

cat > "$OUT/${ID}.yaml" <<YAML
# yaml-language-server: \$schema=https://aka.ms/winget-manifest.version.1.9.0.schema.json
PackageIdentifier: ${ID}
PackageVersion: ${VERSION}
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.9.0
YAML

cat > "$OUT/${ID}.locale.en-US.yaml" <<YAML
# yaml-language-server: \$schema=https://aka.ms/winget-manifest.defaultLocale.1.9.0.schema.json
PackageIdentifier: ${ID}
PackageVersion: ${VERSION}
PackageLocale: en-US
Publisher: lioneltchami
PublisherUrl: https://github.com/lioneltchami
PublisherSupportUrl: https://github.com/lioneltchami/Headspace/issues
Author: lioneltchami
PackageName: Headspace
PackageUrl: https://github.com/lioneltchami/Headspace
License: MIT
LicenseUrl: https://github.com/lioneltchami/Headspace/blob/main/LICENSE
Copyright: Copyright (c) 2026 lioneltchami
ShortDescription: Top-edge workspace for tasks, notes, links, recordings, and local AI alerts
Description: |-
  Headspace is a local workspace that stays at the top of your screen.
  On Windows it shows as a thin top bar; click to expand Tasks, Notes, Links, Record, Vault, and Home tools.
  Data stays on your machine. Installers ship from GitHub Releases.
Moniker: headspace
Tags:
  - desktop
  - electron
  - notes
  - productivity
  - tasks
  - workspace
ReleaseNotesUrl: https://github.com/lioneltchami/Headspace/releases/tag/v${VERSION}
ManifestType: defaultLocale
ManifestVersion: 1.9.0
YAML

cat > "$OUT/${ID}.installer.yaml" <<YAML
# yaml-language-server: \$schema=https://aka.ms/winget-manifest.installer.1.9.0.schema.json
PackageIdentifier: ${ID}
PackageVersion: ${VERSION}
InstallerLocale: en-US
InstallerType: nullsoft
Scope: user
InstallModes:
  - interactive
  - silent
  - silentWithProgress
InstallerSwitches:
  Silent: /S
  SilentWithProgress: /S
UpgradeBehavior: install
ReleaseDate: $(date -u +%Y-%m-%d)
Installers:
  - Architecture: x64
    InstallerUrl: ${URL}
    InstallerSha256: ${WIN_SHA}
ManifestType: installer
ManifestVersion: 1.9.0
YAML

echo "Wrote winget manifests under $OUT"
echo "Next: copy into a microsoft/winget-pkgs fork and open a PR, or run:"
echo "  winget validate --manifest \"$OUT\""

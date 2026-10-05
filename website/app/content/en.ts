export const site = {
  name: "Headspace",
  title: "Headspace  -  top-edge workspace for Mac and Windows",
  description:
    "Local top-edge workspace for solo makers on macOS and Windows: Tasks, Notes, Links, Record, Vault, and local AI alerts. Free MIT download. Not the meditation app.",
  github: "https://github.com/lioneltchami/Headspace",
  releases: "https://github.com/lioneltchami/Headspace/releases/latest",
  brew: "brew tap lioneltchami/tap && brew install --cask headspace",
  macAssetHint: "Headspace-*-arm64.dmg",
  winAssetHint: "Headspace-*-windows-x64-setup.exe",
} as const;

export const nav = [
  { id: "features", label: "Features", href: "#workspace" },
  { id: "get", label: "Get it", href: "#get-it" },
  { id: "github", label: "GitHub", href: site.github, external: true },
] as const;

export const hero = {
  outcome: "A top-edge workspace for Mac and Windows.",
  expandHint: "Click the strip to expand",
  trust: ["MIT", "Local-only", "No account"],
  ctaMac: "Download macOS",
  ctaWin: "Download Windows",
  mobileNote: "Install on your Mac or Windows PC  -  open this page on desktop to download.",
} as const;

export const trust = {
  kicker: "Why it stays quiet",
  items: [
    ["Pinned, not pushy", "Collapses to the notch on Mac; thin top bar on Windows."],
    ["Devices on demand", "Camera and mic start only when you click."],
    ["Data stays local", "No backend. No cloud sync. Workspace folder is yours."],
    ["AI alerts, localhost only", "Codex, Claude, and GPT ping 127.0.0.1  -  nothing else."],
  ],
} as const;

export const workspace = {
  kicker: "Workspace",
  title: "One strip. Six jobs.",
  jobs: [
    { id: "home", title: "Home", blurb: "Bento tools: clock, scratch, commands, mirror, record.", image: "/brand/home.jpg" },
    { id: "tasks", title: "Tasks", blurb: "Four renameable workflows with deadline reminders.", image: "/brand/todo.webp" },
    { id: "notes", title: "Notes", blurb: "Markdown scratch into a searchable library.", image: "/brand/notes.webp" },
    { id: "links", title: "Links", blurb: "Public URLs with title and icon fill-in.", image: "/brand/links.webp" },
    { id: "record", title: "Record", blurb: "Mic on click; optional live transcription.", image: "/brand/recordings.webp" },
    { id: "vault", title: "Vault", blurb: "Credentials in system secure storage.", image: "/brand/credentials.webp" },
  ],
} as const;

export const alerts = {
  kicker: "Local AI",
  title: "When agents finish, you see it.",
  body: "Headspace listens only on 127.0.0.1:43821 for /notify/codex, /notify/claude, and /notify/gpt.",
  sources: ["codex", "claude", "gpt"],
} as const;

export const getIt = {
  kicker: "Get it",
  title: "Download and open.",
  gatekeeper:
    "macOS may say the app is from an unidentified developer (ad-hoc signature, not notarized). System Settings → Privacy & Security → Open Anyway. Windows may show SmartScreen  -  verify the GitHub Release checksum, then Run anyway.",
  brewLabel: "Homebrew (Apple Silicon)",
  issues: "Install help → GitHub Issues",
} as const;

export const footer = {
  platforms: "macOS 13+ Apple Silicon / Windows 10/11 x64 / MIT",
  copy: "© 2026 lioneltchami / Headspace",
} as const;

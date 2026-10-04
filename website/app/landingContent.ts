import { assetPath } from "./assetPath.mjs";

export const DOWNLOAD_URL = "https://github.com/lioneltchami/Headspace/releases/latest";
export const GITHUB_URL = "https://github.com/lioneltchami/Headspace";

export type MediaKind = "image" | "video";

export type MediaItem = {
  id: string;
  src: string;
  fallbackSrc: string;
  kind: MediaKind;
  alt: string;
};

export type TabItem = {
  id: "todo" | "clipboard" | "notes" | "links" | "recordings" | "credentials";
  eyebrow: string;
  title: string;
  description: string;
  capture: string;
  capturePoster: string;
  captureKind: MediaKind;
  accent: string;
};

export const NAV_ITEMS = [
  ["GITHUB", GITHUB_URL],
  ["FEATURES", "#features"],
  ["TABS", "#tabs"],
] as const;

export const MARQUEE_ITEMS: MediaItem[] = [
  { id: "todo", src: assetPath("/product-captures/todo.webp"), fallbackSrc: "", kind: "image", alt: "Headspace Tasks view" },
  { id: "clipboard", src: assetPath("/product-captures/clipboard.webp"), fallbackSrc: "", kind: "image", alt: "Headspace Clipboard view" },
  { id: "notes", src: assetPath("/product-captures/notes.webp"), fallbackSrc: "", kind: "image", alt: "Headspace Notes view" },
  { id: "links", src: assetPath("/product-captures/links.webp"), fallbackSrc: "", kind: "image", alt: "Headspace Links view" },
  { id: "recordings", src: assetPath("/product-captures/recordings.webp"), fallbackSrc: "", kind: "image", alt: "Headspace Record view" },
  { id: "credentials", src: assetPath("/product-captures/credentials.webp"), fallbackSrc: "", kind: "image", alt: "Headspace Vault view" },
];

export const CAPABILITIES = [
  ["01", "Pinned to the top", "Expand when you need it, collapse when you don’t."],
  ["02", "Task reminders", "Four workflows with clear deadlines."],
  ["03", "Capture as you go", "Notes, links, and clipboard in one place."],
  ["04", "Local recording", "Start on demand, with optional live transcription."],
  ["05", "AI completion alerts", "Codex, Claude, and GPT ping you when they finish."],
  ["06", "Data stays local", "Your work stays on your computer."],
] as const;

export const TAB_ITEMS: TabItem[] = [
  { id: "todo", eyebrow: "PLAN THE DAY", title: "Tasks", description: "Four renameable workflows, sorted by deadline, with a one-hour heads-up.", capture: assetPath("/tab-captures/todo.mp4"), capturePoster: assetPath("/product-captures/todo.webp"), captureKind: "video", accent: "red" },
  { id: "clipboard", eyebrow: "CAPTURE FAST", title: "Clip", description: "Optional local clipboard history for text, images, favorites, and quick copy.", capture: assetPath("/tab-captures/clipboard.mp4"), capturePoster: assetPath("/product-captures/clipboard.webp"), captureKind: "video", accent: "amber" },
  { id: "notes", eyebrow: "THINK IN TEXT", title: "Notes", description: "Write on Home, then edit, search, and rename in the library.", capture: assetPath("/tab-captures/notes.mp4"), capturePoster: assetPath("/product-captures/notes.webp"), captureKind: "video", accent: "green" },
  { id: "links", eyebrow: "SAVE THE WEB", title: "Links", description: "Paste a public URL — title, icon, and group fill in.", capture: assetPath("/tab-captures/links.mp4"), capturePoster: assetPath("/product-captures/links.webp"), captureKind: "video", accent: "blue" },
  { id: "recordings", eyebrow: "RECORD THE MOMENT", title: "Record", description: "Mic starts only on click; saved locally with optional live transcription.", capture: assetPath("/tab-captures/recordings.mp4"), capturePoster: assetPath("/product-captures/recordings.webp"), captureKind: "video", accent: "rose" },
  { id: "credentials", eyebrow: "KEEP IT SAFE", title: "Vault", description: "Accounts, passwords, and API keys encrypted with system secure storage.", capture: assetPath("/tab-captures/credentials.mp4"), capturePoster: assetPath("/product-captures/credentials.webp"), captureKind: "video", accent: "violet" },
];

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { assetPath } from "./assetPath.mjs";

const title = "Headspace — a top-edge workspace for Mac and Windows";
const description =
	"A local workspace for macOS and Windows: Home, Tasks, Notes, Links, Record, Vault, and optional Clipboard — data stays on your computer.";

export const metadata: Metadata = {
	metadataBase: new URL("https://lioneltchami.github.io/Headspace/"),
	title,
	description,
	applicationName: "Headspace",
	keywords: [
		"Headspace",
		"macOS notch",
		"Mac tasks",
		"Windows tasks",
		"Local workspace",
		"Apple Silicon",
	],
	icons: {
		icon: [{ url: assetPath("/favicon.png"), type: "image/png" }],
		shortcut: assetPath("/favicon.png"),
		apple: assetPath("/favicon.png"),
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: "Headspace",
		title,
		description,
		images: [
			{
				url: assetPath("/og.png"),
				width: 1200,
				height: 630,
				alt: "Headspace site share image",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title,
		description,
		images: [assetPath("/og.png")],
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	colorScheme: "dark",
	themeColor: "#000000",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}

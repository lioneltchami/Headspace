import type { Metadata, Viewport } from "next";
import "./globals.css";
import { assetPath } from "./assetPath.mjs";

const title = "Headspace  -  top-edge workspace for Mac and Windows";
const description =
	"Local top-edge workspace for solo makers on macOS and Windows: Tasks, Notes, Links, Record, Vault, and local AI alerts. Free MIT download. Not the meditation app.";

export const metadata: Metadata = {
	metadataBase: new URL("https://lioneltchami.github.io/Headspace/"),
	title,
	description,
	applicationName: "Headspace",
	keywords: [
		"Headspace desktop",
		"macOS notch workspace",
		"Windows top bar",
		"local AI alerts",
		"Apple Silicon",
		"Electron",
	],
	icons: {
		icon: [{ url: assetPath("/brand/favicon.png"), type: "image/png" }],
		shortcut: assetPath("/brand/favicon.png"),
		apple: assetPath("/brand/favicon.png"),
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: "Headspace",
		title,
		description,
		images: [
			{
				url: assetPath("/brand/og.png"),
				width: 1200,
				height: 630,
				alt: "Headspace mark",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title,
		description,
		images: [assetPath("/brand/og.png")],
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	colorScheme: "dark",
	themeColor: "#050505",
};

const jsonLd = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: "Headspace",
	applicationCategory: "ProductivityApplication",
	operatingSystem: "macOS 13+, Windows 10/11",
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD",
	},
	downloadUrl: "https://github.com/lioneltchami/Headspace/releases/latest",
	url: "https://lioneltchami.github.io/Headspace/",
	license: "https://opensource.org/licenses/MIT",
	description,
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<head>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
			</head>
			<body>{children}</body>
		</html>
	);
}

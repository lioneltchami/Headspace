// electron-builder afterPack hook
// electron-builder with identity:null skips signing, and asar:false disables integrity checks,
// so we ad-hoc sign the whole .app bundle inside-out for macOS 14+ launch validation.
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.default = async function afterPack(context) {
	if (context.electronPlatformName !== "darwin") return;

	const appPath = path.join(
		context.appOutDir,
		`${context.packager.appInfo.productFilename}.app`,
	);

	const projectRoot = path.resolve(__dirname, "..");
	const macOSDirectory = path.join(appPath, "Contents", "MacOS");
	const electronExecutablePath = path.join(
		macOSDirectory,
		context.packager.appInfo.productFilename,
	);

	if (!fs.existsSync(electronExecutablePath)) {
		throw new Error(
			`Electron main binary not found: ${electronExecutablePath}`,
		);
	}

	console.log(`  • ad-hoc signing ${appPath}`);

	// Order: dylibs → Framework Helpers → Framework binary → Helper apps → Frameworks → main bundle
	const entitlementsPath = path.join(
		projectRoot,
		"build",
		"entitlements.mac.plist",
	);
	// Record per-file failures without throwing; --verify --deep --strict is the gate.
	const signFailures = [];
	const cs = (file, executable = false) => {
		try {
			const args = ["--force", "--sign", "-", "--timestamp=none"];
			if (executable)
				args.push("--options", "runtime", "--entitlements", entitlementsPath);
			args.push(file);
			execFileSync("codesign", args, { stdio: "pipe" });
		} catch (e) {
			signFailures.push(`${file}: ${e.message}`);
			console.warn(`    codesign failed ${file}: ${e.message}`);
		}
	};

	const walk = (dir, predicate, cb) => {
		if (!fs.existsSync(dir)) return;
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (
				entry.isDirectory() &&
				!entry.name.endsWith(".app") &&
				!entry.name.endsWith(".framework")
			) {
				walk(full, predicate, cb);
			} else if (entry.isFile() && predicate(entry.name, full)) {
				cb(full);
			}
		}
	};

	const fwDir = path.join(appPath, "Contents", "Frameworks");

	// 1) all dylibs
	walk(fwDir, (n) => n.endsWith(".dylib"), cs);

	// 2) Electron Framework Helpers (chrome_crashpad_handler, etc.)
	const efw = path.join(
		fwDir,
		"Electron Framework.framework",
		"Versions",
		"A",
		"Helpers",
	);
	if (fs.existsSync(efw)) {
		for (const f of fs.readdirSync(efw)) cs(path.join(efw, f), true);
	}

	// 3) Electron Framework binary
	const efwBin = path.join(
		fwDir,
		"Electron Framework.framework",
		"Versions",
		"A",
		"Electron Framework",
	);
	if (fs.existsSync(efwBin)) cs(efwBin);

	// 4) each Helper.app inner binary
	for (const entry of fs.readdirSync(fwDir)) {
		if (entry.endsWith(".app")) {
			const macosDir = path.join(fwDir, entry, "Contents", "MacOS");
			if (fs.existsSync(macosDir)) {
				for (const f of fs.readdirSync(macosDir))
					cs(path.join(macosDir, f), true);
			}
		}
	}

	// 5) each Helper.app bundle
	for (const entry of fs.readdirSync(fwDir)) {
		if (entry.endsWith(".app")) cs(path.join(fwDir, entry), true);
	}

	// 6) each Framework bundle
	for (const entry of fs.readdirSync(fwDir)) {
		if (entry.endsWith(".framework")) cs(path.join(fwDir, entry));
	}

	// 7) Electron main executable
	cs(electronExecutablePath, true);

	// 8) main .app bundle
	cs(appPath, true);

	// Verify: fail the build if signing is broken but the DMG would otherwise look successful.
	try {
		execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
			stdio: "pipe",
		});
		console.log(`  ✓ signature verified`);
	} catch (e) {
		if (signFailures.length) {
			console.error(`  ✗ ${signFailures.length} file(s) failed to sign:`);
			for (const failure of signFailures) console.error(`      ${failure}`);
		}
		throw new Error(
			`ad-hoc signature verification failed; artifact not shippable: ${e.message}`,
		);
	}
};

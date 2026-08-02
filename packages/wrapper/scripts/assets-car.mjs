import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");
const iconSource = join(iconsDir, "Colibri.icon");
const carPath = join(iconsDir, "Assets.car");
const hashPath = join(iconsDir, "Assets.car.sha256");
const regenerateHint = "Run `pnpm --filter @colibri-social/wrapper assets-car` on macOS with Xcode 26 or newer and commit the result.";

function hashIconSource(dir, prefix, hash) {
	const entries = readdirSync(dir, { withFileTypes: true })
		.filter((entry) => !entry.name.startsWith("."))
		.sort((a, b) => (a.name < b.name ? -1 : 1));

	for (const entry of entries) {
		const path = join(dir, entry.name);
		const name = prefix ? `${prefix}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			hashIconSource(path, name, hash);
			continue;
		}

		hash.update(name);
		hash.update(readFileSync(path));
	}

	return hash;
}

function actoolVersion() {
	const output = execFileSync("actool", ["--version", "--output-format=human-readable-text"], {
		encoding: "utf8",
	});

	return output
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.startsWith("short-bundle-version:"))
		?.slice("short-bundle-version:".length)
		.trim();
}

if (!existsSync(iconSource)) {
	console.error(`missing Icon Composer source at ${iconSource}`);
	process.exit(1);
}

const expected = hashIconSource(iconSource, "", createHash("sha256")).digest("hex");

if (process.argv.includes("--check")) {
	if (!existsSync(carPath) || !existsSync(hashPath)) {
		console.error(`Assets.car is missing next to Colibri.icon. ${regenerateHint}`);
		process.exit(1);
	}

	const recorded = readFileSync(hashPath, "utf8").trim();

	if (recorded !== expected) {
		console.error(`Assets.car was compiled from a different Colibri.icon (recorded ${recorded}, current ${expected}). ${regenerateHint}`);
		process.exit(1);
	}

	console.log(`Assets.car matches Colibri.icon (${expected})`);
	process.exit(0);
}

if (process.platform !== "darwin") {
	console.error("Assets.car can only be compiled on macOS with Xcode 26 or newer.");
	process.exit(1);
}

const version = actoolVersion();

if (!version || Number.parseInt(version, 10) < 26) {
	console.error(`actool ${version ?? "of unknown version"} cannot compile Icon Composer icons, Xcode 26 or newer is required.`);
	process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), "colibri-assets-car-"));
const stagedIcon = join(workDir, "Icon.icon");
const outDir = join(workDir, "out");

try {
	cpSync(iconSource, stagedIcon, { recursive: true });
	mkdirSync(outDir);

	execFileSync(
		"actool",
		[
			stagedIcon,
			"--compile",
			outDir,
			"--output-format",
			"human-readable-text",
			"--notices",
			"--warnings",
			"--output-partial-info-plist",
			join(outDir, "assetcatalog_generated_info.plist"),
			"--app-icon",
			"Icon",
			"--include-all-app-icons",
			"--accent-color",
			"AccentColor",
			"--enable-on-demand-resources",
			"NO",
			"--development-region",
			"en",
			"--target-device",
			"mac",
			"--minimum-deployment-target",
			"26.0",
			"--platform",
			"macosx",
		],
		{ stdio: "inherit" },
	);

	const compiled = join(outDir, "Assets.car");

	if (!existsSync(compiled)) {
		console.error("actool did not produce an Assets.car");
		process.exit(1);
	}

	cpSync(compiled, carPath);
	writeFileSync(hashPath, `${expected}\n`);
	console.log(`compiled ${carPath} from Colibri.icon with actool ${version}`);
} finally {
	rmSync(workDir, { recursive: true, force: true });
}

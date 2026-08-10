import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const flags = new Map();
const positional = [];
for (const arg of argv) {
	const match = /^--([^=]+)=(.*)$/.exec(arg);
	if (match) flags.set(match[1], match[2]);
	else positional.push(arg);
}

const version = (positional[0] ?? "").replace(/^v/, "").trim();
if (!version) {
	console.error(
		"usage: set-version.mjs <version> [versionCode] [--bundle-version=<n>]",
	);
	process.exit(1);
}
const versionCode = positional[1]?.trim();
const bundleVersion = flags.get("bundle-version")?.trim();

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri");

const patch = (rel, fn) => {
	const path = join(src, rel);
	if (!existsSync(path)) {
		console.log(`skipping ${rel} (not present)`);
		return;
	}
	writeFileSync(path, fn(readFileSync(path, "utf8")));
};

patch("tauri.conf.json", (text) => {
	const conf = JSON.parse(text);
	conf.version = version;
	return `${JSON.stringify(conf, null, "\t")}\n`;
});

patch("Cargo.toml", (text) =>
	text.replace(/^version = "[^"]*"/m, `version = "${version}"`),
);

patch("gen/android/app/tauri.properties", (text) => {
	let out = text.replace(
		/^tauri\.android\.versionName=.*$/m,
		`tauri.android.versionName=${version}`,
	);
	if (versionCode) {
		out = out.replace(
			/^tauri\.android\.versionCode=.*$/m,
			`tauri.android.versionCode=${versionCode}`,
		);
	}
	return out;
});

const appleBundleVersion = bundleVersion || version;

patch("gen/apple/project.yml", (text) =>
	text
		.replace(/CFBundleShortVersionString: .*/, `CFBundleShortVersionString: ${version}`)
		.replace(/CFBundleVersion: ".*"/, `CFBundleVersion: "${appleBundleVersion}"`),
);

patch("gen/apple/colibri-social_iOS/Info.plist", (text) =>
	text
		.replace(
			/(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
			`$1${version}$2`,
		)
		.replace(
			/(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
			`$1${appleBundleVersion}$2`,
		),
);

if (bundleVersion) {
	patch("tauri.appstore.conf.json", (text) => {
		const conf = JSON.parse(text);
		conf.bundle ??= {};
		conf.bundle.macOS ??= {};
		conf.bundle.macOS.bundleVersion = bundleVersion;
		return `${JSON.stringify(conf, null, "\t")}\n`;
	});
}

console.log(
	`set version to ${version}${versionCode ? ` (versionCode ${versionCode})` : ""}${bundleVersion ? ` (App Store bundleVersion ${bundleVersion})` : ""}`,
);

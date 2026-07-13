import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = (process.argv[2] ?? "").replace(/^v/, "").trim();
if (!version) {
	console.error("usage: set-version.mjs <version> [versionCode]");
	process.exit(1);
}
const versionCode = process.argv[3]?.trim();

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

patch("gen/apple/project.yml", (text) =>
	text
		.replace(/CFBundleShortVersionString: .*/, `CFBundleShortVersionString: ${version}`)
		.replace(/CFBundleVersion: ".*"/, `CFBundleVersion: "${version}"`),
);

patch("gen/apple/colibri-social_iOS/Info.plist", (text) =>
	text
		.replace(
			/(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
			`$1${version}$2`,
		)
		.replace(
			/(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
			`$1${version}$2`,
		),
);

console.log(
	`set version to ${version}${versionCode ? ` (versionCode ${versionCode})` : ""}`,
);

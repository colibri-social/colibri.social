const input = (process.argv[2] ?? "").replace(/^v/, "").trim();
if (!input) {
	console.error("usage: appstore-version.mjs <release-version>");
	process.exit(1);
}

const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(input);
if (!match) {
	console.error(
		`cannot derive an App Store version from "${input}": expected <major>.<minor>.<patch>[-prerelease]`,
	);
	process.exit(1);
}

const [, major, minor, patch, prerelease] = match;

if (!prerelease) {
	console.log(`${major}.${minor}.${patch}`);
	process.exit(0);
}

const counter = /(\d+)$/.exec(prerelease);
if (!counter) {
	console.error(
		`cannot derive an App Store version from "${input}": prerelease "${prerelease}" has no trailing number to use as the patch component`,
	);
	process.exit(1);
}

if (patch !== "0") {
	console.error(
		`cannot derive an App Store version from "${input}": the patch component is ${patch}, not 0, so mapping the prerelease counter onto it would produce ${major}.${minor}.${counter[1]}, which may be lower than the release version itself. Set the App Store version explicitly instead.`,
	);
	process.exit(1);
}

console.log(`${major}.${minor}.${counter[1]}`);

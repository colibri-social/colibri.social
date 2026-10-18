import { spawnSync } from "node:child_process";
import {
	access,
	copyFile,
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FAMILY = "Colibri Emoji";
const UPEM = 2048;
const ADVANCE = 2560;
const ASCENDER = 1997;
const DESCENDER = -563;
const VARIATION_SELECTOR = 0xfe0f;
const KEYCAP = 0x20e3;
const EXCLUDED_FROM_RANGE = new Set([0x20, 0xa9, 0xae, 0x2122]);

const root = dirname(
	fileURLToPath(new URL("../package.json", import.meta.url)),
);
const clientPackage = JSON.parse(
	await readFile(join(root, "..", "client", "package.json"), "utf8"),
);
const version = (clientPackage.dependencies["@twemoji/api"] ?? "").replace(
	/^[^0-9]*/,
	"",
);
if (!version) {
	console.error("Could not resolve the @twemoji/api version from the client.");
	process.exit(1);
}

const work = join(tmpdir(), `colibri-emoji-font-${version}`);
const venv = join(tmpdir(), "colibri-nanoemoji-venv");
const python = join(venv, "bin", "python");
const svgDir = join(work, "svg");
const stageDir = join(work, "stage");
const buildDir = join(work, "build");
const fontOut = join(root, "src", "fonts", "ColibriEmoji.woff2");
const cssOut = join(root, "src", "styles", "emoji-font.css");

const run = (command, args, options = {}) => {
	const result = spawnSync(command, args, { stdio: "inherit", ...options });
	if (result.status !== 0) {
		console.error(`${command} ${args.slice(0, 3).join(" ")} failed`);
		process.exit(result.status ?? 1);
	}
};

const exists = async (path) => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

if (/\s/.test(tmpdir())) {
	console.error("nanoemoji's ninja build breaks on paths with spaces.");
	process.exit(1);
}

if (!(await exists(python))) {
	run("python3", ["-m", "venv", venv]);
	run(python, ["-m", "pip", "install", "--quiet", "nanoemoji", "brotli"]);
}

if (!(await exists(svgDir))) {
	await mkdir(svgDir, { recursive: true });
	const archive = join(work, "twemoji.tar.gz");
	const response = await fetch(
		`https://codeload.github.com/jdecked/twemoji/tar.gz/refs/tags/v${version}`,
	);
	if (!response.ok) {
		console.error(`Download failed: ${response.status}`);
		process.exit(1);
	}
	await writeFile(archive, Buffer.from(await response.arrayBuffer()));
	run("tar", [
		"-xzf",
		archive,
		"-C",
		svgDir,
		"--strip-components=3",
		`twemoji-${version}/assets/svg`,
	]);
}

const toPoints = (name) =>
	name
		.replace(/\.svg$/, "")
		.split("-")
		.map((part) => Number.parseInt(part, 16));

const keyOf = (points) => points.map((point) => point.toString(16)).join("_");

const variantsOf = (points) => {
	const variants = [points];
	const stripped = points.filter((point) => point !== VARIATION_SELECTOR);
	if (stripped.length !== points.length && stripped.length > 0) {
		variants.push(stripped);
	}
	if (points.length === 2 && points[1] === KEYCAP) {
		variants.push([points[0], VARIATION_SELECTOR, KEYCAP]);
	}
	return variants;
};

await rm(stageDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });

const files = (await readdir(svgDir)).filter((name) => name.endsWith(".svg"));
const sources = new Map();
for (const name of files) sources.set(keyOf(toPoints(name)), name);

const staged = new Map();
for (const name of files) {
	for (const variant of variantsOf(toPoints(name))) {
		const key = keyOf(variant);
		if (staged.has(key)) continue;
		if (key !== keyOf(toPoints(name)) && sources.has(key)) continue;
		staged.set(key, name);
	}
}

const stagedNames = [];
for (const [key, name] of staged) {
	const target = `emoji_u${key}.svg`;
	await copyFile(join(svgDir, name), join(stageDir, target));
	stagedNames.push(target);
}

await rm(buildDir, { recursive: true, force: true });
run(
	join(venv, "bin", "nanoemoji"),
	[
		"--color_format",
		"glyf_colr_0",
		"--family",
		FAMILY,
		"--upem",
		String(UPEM),
		"--width",
		String(ADVANCE),
		"--ascender",
		String(ASCENDER),
		"--descender",
		String(DESCENDER),
		"--output_file",
		"ColibriEmoji.ttf",
		"--build_dir",
		buildDir,
		...stagedNames,
	],
	{
		cwd: stageDir,
		env: { ...process.env, PATH: `${join(venv, "bin")}:${process.env.PATH}` },
	},
);

const finish = `
import json, sys
from fontTools.ttLib import TTFont
font = TTFont(sys.argv[1])
font.flavor = "woff2"
font.save(sys.argv[2])
print(json.dumps(sorted(font.getBestCmap().keys())))
`;
const result = spawnSync(
	python,
	["-c", finish, join(buildDir, "ColibriEmoji.ttf"), fontOut],
	{ encoding: "utf8" },
);
if (result.status !== 0) {
	console.error(result.stderr);
	process.exit(1);
}

const codepoints = JSON.parse(result.stdout).filter(
	(point) => !EXCLUDED_FROM_RANGE.has(point),
);
const ranges = [];
for (const point of codepoints) {
	const last = ranges.at(-1);
	if (last && point === last[1] + 1) last[1] = point;
	else ranges.push([point, point]);
}
const hex = (point) => point.toString(16).toUpperCase();
const unicodeRange = ranges
	.map(([start, end]) =>
		start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`,
	)
	.join(", ");

await writeFile(
	cssOut,
	`@font-face {
	font-family: "${FAMILY}";
	src: url("../fonts/ColibriEmoji.woff2") format("woff2");
	font-display: swap;
	font-weight: 100 900;
	font-style: normal;
	unicode-range: ${unicodeRange};
}
`,
);

const { size } = await stat(fontOut);
console.log(
	`Built ${FAMILY} from Twemoji ${version}: ${stagedNames.length} sequences, ${(size / 1024).toFixed(0)} KB`,
);

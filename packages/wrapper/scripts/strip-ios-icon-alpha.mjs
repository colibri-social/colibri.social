import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const iconDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"src-tauri",
	"gen",
	"apple",
	"Assets.xcassets",
	"AppIcon.appiconset",
);

const backgroundColor = process.argv[2] ?? "#0b0b0b";

const pngs = readdirSync(iconDir).filter((f) => f.endsWith(".png"));

for (const file of pngs) {
	const path = join(iconDir, file);
	await sharp(path)
		.flatten({ background: backgroundColor })
		.removeAlpha()
		.toBuffer()
		.then((buf) => sharp(buf).toFile(path));
	console.log(`stripped alpha: ${file}`);
}

console.log(`done (${pngs.length} files)`);

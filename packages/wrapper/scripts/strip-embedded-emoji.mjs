import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const distEmojiDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"dist",
	"twemoji",
);

rmSync(distEmojiDir, { recursive: true, force: true });
console.log(`Stripped embedded emoji from ${distEmojiDir}`);

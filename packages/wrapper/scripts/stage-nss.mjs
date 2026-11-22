import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULES = ["libsoftokn3.so", "libfreeblpriv3.so", "libfreebl3.so"];

const target = join(
	dirname(fileURLToPath(import.meta.url)),
	"../src-tauri/target/release/nss",
);

const cache = execFileSync("ldconfig", ["-p"], { encoding: "utf8" });
const nss3 = cache
	.split("\n")
	.map((line) => line.match(/^\s*libnss3\.so\b.*=>\s*(\S+)$/)?.[1])
	.find(Boolean);

if (!nss3) {
	console.error("stage-nss: libnss3.so is not installed on this machine");
	process.exit(1);
}

const source = dirname(nss3);
mkdirSync(target, { recursive: true });

for (const module of MODULES) {
	const path = join(source, module);
	if (!existsSync(path)) {
		console.error(`stage-nss: ${module} is missing next to ${nss3}`);
		process.exit(1);
	}
	copyFileSync(path, join(target, module));
}

console.log(`stage-nss: copied ${MODULES.length} NSS modules from ${source}`);

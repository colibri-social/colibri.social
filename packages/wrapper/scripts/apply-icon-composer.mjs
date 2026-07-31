import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const srcTauriDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri");
const source = join(srcTauriDir, "icons", "Colibri.icon");
const appleDir = join(srcTauriDir, "gen", "apple");
const legacyAppIconSet = join(appleDir, "Assets.xcassets", "AppIcon.appiconset");
const appIconComposer = join(appleDir, "AppIcon.icon");

if (existsSync(legacyAppIconSet)) {
	rmSync(legacyAppIconSet, { recursive: true, force: true });
	console.log("removed stale AppIcon.appiconset");
}

rmSync(appIconComposer, { recursive: true, force: true });
cpSync(source, appIconComposer, { recursive: true });
console.log(`applied Icon Composer source to ${appIconComposer}`);

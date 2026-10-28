import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

const RELEASE = "1-alpha-20251107-1";

const DIGESTS = {
	x86_64: "c20cd71e3a4e3b80c3483cef793cda3f4e990aca14014d23c544ca3ce1270b4d",
	aarch64: "620095110d693282b8ebeb244a95b5e911cf8f65f76c88b4b47d16ae6346fcff",
};

const NODE_ARCH_TO_LINUXDEPLOY = { x64: "x86_64", arm64: "aarch64" };

export const EXCLUDED_LIBRARIES = ["libpipewire-0.3.so*", "libspa-*"];

function tauriToolsDirectory() {
	const xdgCache = process.env.XDG_CACHE_HOME;
	const cache =
		xdgCache && isAbsolute(xdgCache) ? xdgCache : join(homedir(), ".cache");
	return join(cache, "tauri");
}

function sha256(data) {
	return createHash("sha256").update(data).digest("hex");
}

async function readVerified(file, digest) {
	try {
		const data = await readFile(file);
		return sha256(data) === digest ? data : undefined;
	} catch {
		return undefined;
	}
}

async function download(arch, digest) {
	const url = `https://github.com/linuxdeploy/linuxdeploy/releases/download/${RELEASE}/linuxdeploy-${arch}.AppImage`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Downloading ${url} failed with HTTP ${response.status}`);
	}
	const data = Buffer.from(await response.arrayBuffer());
	const actual = sha256(data);
	if (actual !== digest) {
		throw new Error(
			`linuxdeploy ${RELEASE} for ${arch} has SHA-256 ${actual}, expected ${digest}`,
		);
	}
	return data;
}

export async function installLinuxdeploy() {
	const arch = NODE_ARCH_TO_LINUXDEPLOY[process.arch];
	const digest = arch && DIGESTS[arch];
	if (!digest) {
		throw new Error(`No pinned linuxdeploy build for ${process.arch}`);
	}

	const toolsDirectory = tauriToolsDirectory();
	await mkdir(toolsDirectory, { recursive: true });

	const pinnedFile = join(
		toolsDirectory,
		`linuxdeploy-${RELEASE}-${arch}.AppImage`,
	);
	let data = await readVerified(pinnedFile, digest);
	if (!data) {
		data = await download(arch, digest);
		await writeFile(pinnedFile, data);
	}

	const tauriFile = join(toolsDirectory, `linuxdeploy-${arch}.AppImage`);
	await writeFile(tauriFile, data);
	await chmod(tauriFile, 0o755);
}

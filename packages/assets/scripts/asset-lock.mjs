import { mkdir, rm, stat } from "node:fs/promises";

const STALE_MS = 10 * 60 * 1000;
const POLL_MS = 200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const claim = async (lock) => {
	try {
		await mkdir(lock);
		return true;
	} catch (err) {
		if (err.code === "EEXIST") return false;
		throw err;
	}
};

const heldFor = async (lock) => {
	try {
		return Date.now() - (await stat(lock)).mtimeMs;
	} catch {
		return null;
	}
};

export const withAssetLock = async (lock, run) => {
	let waited = false;

	while (!(await claim(lock))) {
		const held = await heldFor(lock);
		if (held === null) continue;

		if (held > STALE_MS) {
			await rm(lock, { recursive: true, force: true });
			continue;
		}

		if (!waited) {
			waited = true;
			console.log("  … waiting for another asset fetch to finish");
		}
		await sleep(POLL_MS);
	}

	try {
		return await run();
	} finally {
		await rm(lock, { recursive: true, force: true });
	}
};

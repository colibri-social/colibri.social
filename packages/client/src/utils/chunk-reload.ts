import { createLogger } from "./logger";

export const CHUNK_RELOAD_KEY = "colibri:chunk-reload";

export type ChunkReloadStore = Pick<Storage, "getItem" | "setItem">;

export interface ChunkReloadGuard {
	store: ChunkReloadStore | undefined;
	reload: () => void;
}

const log = createLogger("chunk-reload");

const alreadyReloaded = (store: ChunkReloadStore | undefined): boolean => {
	if (!store) return false;
	try {
		return store.getItem(CHUNK_RELOAD_KEY) === "1";
	} catch {
		return false;
	}
};

const markReloaded = (store: ChunkReloadStore | undefined): boolean => {
	if (!store) return false;
	try {
		store.setItem(CHUNK_RELOAD_KEY, "1");
		return true;
	} catch {
		return false;
	}
};

export const reloadOnceForChunkFailure = (guard: ChunkReloadGuard): boolean => {
	if (alreadyReloaded(guard.store)) return false;
	if (!markReloaded(guard.store)) return false;

	try {
		guard.reload();
	} catch {
		return false;
	}
	return true;
};

const sessionStore = (): ChunkReloadStore | undefined => {
	try {
		return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
	} catch {
		return undefined;
	}
};

export const installChunkReloadGuard = (): void => {
	if (typeof window === "undefined") return;

	window.addEventListener("vite:preloadError", () => {
		const reloaded = reloadOnceForChunkFailure({
			store: sessionStore(),
			reload: () => window.location.reload(),
		});
		if (reloaded) {
			log.warn("reloading once after a chunk failed to load");
			return;
		}
		log.warn("chunk failed to load again, leaving the page as it is");
	});
};

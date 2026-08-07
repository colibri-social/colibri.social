import { createLogger } from "../utils/logger";

const log = createLogger("embed");

let mounts = 0;
let storagePrefix = "";
let appViewOverride: string | undefined;
let noiseAssetBaseOverride: string | undefined;

export const isEmbedded = (): boolean => mounts > 0;

export const embedStorageKey = (key: string): string =>
	mounts > 0 ? `${storagePrefix}${key}` : key;

export const embedAppViewUrl = (): string | undefined =>
	mounts > 0 ? appViewOverride : undefined;

export const embedNoiseAssetBase = (): string | undefined =>
	mounts > 0 ? noiseAssetBaseOverride : undefined;

export const activateEmbedRuntime = (options: {
	storagePrefix: string;
	appViewUrl: string | undefined;
	noiseAssetBase: string | undefined;
}): void => {
	if (mounts > 0) {
		if (options.storagePrefix !== storagePrefix) {
			log.warn(
				"a second embed asked for a different storage prefix, keeping the first",
				{ kept: storagePrefix },
			);
		}
		if (options.appViewUrl !== appViewOverride) {
			log.warn(
				"a second embed asked for a different AppView, keeping the first",
				{ kept: appViewOverride ?? "default" },
			);
		}
		if (options.noiseAssetBase !== noiseAssetBaseOverride) {
			log.warn(
				"a second embed asked for a different noise asset base, keeping the first",
				{ kept: noiseAssetBaseOverride ?? "default" },
			);
		}
		mounts += 1;
		return;
	}

	mounts = 1;
	storagePrefix = options.storagePrefix;
	appViewOverride = options.appViewUrl;
	noiseAssetBaseOverride = options.noiseAssetBase;
};

export const deactivateEmbedRuntime = (): void => {
	mounts = Math.max(0, mounts - 1);
	if (mounts > 0) return;
	storagePrefix = "";
	appViewOverride = undefined;
	noiseAssetBaseOverride = undefined;
};

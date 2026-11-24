import {
	classifyThrown,
	colibri,
	createLogger,
	LEGACY_SPACE_URIS_STORAGE_KEY,
	legacySpaceUrisFromFeatures,
	setLegacySpaceUris,
} from "@colibri-social/lib";
import { readStored, writeStored } from "../persist";
import type { Transport } from "./transport";

const log = createLogger("space-uri-format");

export const applyStoredSpaceUriFormat = () => {
	setLegacySpaceUris(readStored(LEGACY_SPACE_URIS_STORAGE_KEY) !== "false");
};

export const refreshSpaceUriFormat = async (
	transport: Pick<Transport, "query">,
) => {
	try {
		const described = await transport.query(colibri.server.describeServer.main);
		const features = (described as { features?: unknown }).features;
		const legacy = legacySpaceUrisFromFeatures(
			Array.isArray(features) ? features : undefined,
		);

		setLegacySpaceUris(legacy);
		writeStored(LEGACY_SPACE_URIS_STORAGE_KEY, String(legacy));
	} catch (error) {
		log.warn("could not read the space URI format", {
			code: classifyThrown(error, {
				method: colibri.server.describeServer.main.nsid,
			}).code,
		});
	}
};

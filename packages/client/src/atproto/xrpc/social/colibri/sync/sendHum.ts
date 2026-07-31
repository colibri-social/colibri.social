import type { ColibriEvent } from "@colibri-social/lib";
import { createLogger } from "../../../../../utils/logger";
import type { XrpcRequest } from "../../..";

const log = createLogger("hum");

export const sendHum: XrpcRequest<[ColibriEvent], Promise<boolean>> = async (
	fetch,
	event,
) => {
	try {
		const res = await fetch(`/xrpc/social.colibri.sync.sendHum`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({ event }),
		});

		return res.ok;
	} catch (err) {
		log.warn("could not send a hum", { error: err });
		return false;
	}
};

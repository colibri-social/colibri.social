import type { ColibriEvent } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";

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
		console.error(err);
		return false;
	}
};

import type { ActorData } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export const getData: XrpcRequest<
	[string],
	Promise<ActorData | undefined>
> = async (fetch, identifier) => {
	try {
		const getDataRes = await fetch(
			`/xrpc/social.colibri.actor.getData?identifier=${identifier}`,
		);

		if (!getDataRes.ok) {
			console.error(
				`getData failed (${getDataRes.status}):`,
				await getDataRes.text(),
			);
			return undefined;
		}

		return await readJson<ActorData>(getDataRes);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

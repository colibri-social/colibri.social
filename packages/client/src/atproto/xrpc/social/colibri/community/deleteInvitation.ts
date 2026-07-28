import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	code: string;
};

export const deleteInvitation: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, uri, code) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.deleteInvitation?uri=${uri}&code=${code}`,
			{
				method: "POST",
			},
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

import type { XrpcRequest } from "../../..";

type Response = {
	updated: number;
};

export const updateSeen: XrpcRequest<
	[string | undefined],
	Promise<Response | undefined>
> = async (fetch, seenAt) => {
	try {
		const params = new URLSearchParams();
		if (seenAt !== undefined) params.set("seenAt", seenAt);
		const qs = params.toString();

		const res = await fetch(
			`/xrpc/social.colibri.notification.updateSeen${qs ? `?${qs}` : ""}`,
			{
				method: "POST",
			},
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

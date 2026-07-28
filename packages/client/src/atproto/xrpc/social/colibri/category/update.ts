import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export const update: XrpcRequest<
	[string, string],
	Promise<Record<string, never> | undefined>
> = async (fetch, category, name) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.category.update?category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}`,
			{ method: "POST" },
		);
		return await readJson<Record<string, never>>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

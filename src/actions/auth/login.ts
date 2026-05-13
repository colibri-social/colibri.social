import { ActionError, defineAction } from "astro:actions";
import dns from "node:dns";
import { promisify } from "node:util";
import { serverPort } from "virtual:server-port";
import { z } from "astro/zod";
import { client, scopes } from "@/utils/atproto/oauth";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const resolveTxt = promisify(dns.resolveTxt);

const authorize = async (
	identity: string,
	signUp: string | undefined,
): Promise<URL> => {
	return await client.authorize(identity, {
		scope: scopes.join(" "),
		state: JSON.stringify("{}"),
		prompt: signUp ? "create" : "login",
		redirect_uri: import.meta.env.DEV
			? `http://127.0.0.1:${serverPort}/auth/callback`
			: (`${import.meta.env.SITE}/auth/callback` as any),
	});
};

const resolveDnsDID = async (handle: string): Promise<string> => {
	const txtRecords = await resolveTxt(`_atproto.${handle}`);

	const did = txtRecords.find((x) => x[0].startsWith("did=did:"));

	if (!did) throw new Error("Unable to resolve handle via DNS");

	return did[0].slice(4);
};

export const login = defineAction({
	accept: "form",
	input: z.object({
		handle: z.string(),
		signUp: z.string().optional(),
	}),
	handler: async ({ handle, signUp }) => {
		try {
			let authorizerHandle: string = handle;

			if (handle === "__bluesky__") {
				authorizerHandle = "https://bsky.social";
			} else if (handle === "__colibri__") {
				authorizerHandle = "https://colibri.social";
			}

			try {
				const url = await authorize(authorizerHandle, signUp);

				return url.toString();
			} catch {
				const didFromDNS = await resolveDnsDID(authorizerHandle);
				const url = await authorize(didFromDNS, signUp);

				return url.toString();
			}
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});

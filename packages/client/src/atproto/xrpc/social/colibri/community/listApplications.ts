import type { JsonBlobRef } from "@atproto/lexicon";
import type { OnlineState } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export type Applicant = {
	did: string;
	handle: string;
	membership: string;
	createdAt: string;
	data: {
		displayName: string;
		avatar?: JsonBlobRef;
		banner?: JsonBlobRef;
		description?: string;
		isBot: boolean;
		onlineState: OnlineState;
		status?: {
			emoji?: string;
			text: string;
		};
	};
};

type Response = {
	applications: Array<Applicant>;
	dismissedApplications: Array<Applicant>;
};

export const listApplications: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listApplications?community=${encodeURIComponent(community)}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

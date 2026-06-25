import type { JsonBlobRef } from "@atproto/lexicon";
import type { OnlineState } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";

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
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listApplications?community=${encodeURIComponent(community)}&auth=${auth}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

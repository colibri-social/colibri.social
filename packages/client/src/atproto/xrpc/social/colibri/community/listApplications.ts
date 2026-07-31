import type { JsonBlobRef } from "@atproto/lexicon";
import type { OnlineState } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

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
	Promise<XrpcResult<Response>>
> = async (fetch, community) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.listApplications",
		route: `/xrpc/social.colibri.community.listApplications?community=${encodeURIComponent(community)}`,
	});
};

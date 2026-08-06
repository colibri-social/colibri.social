import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type DeletedCounts = {
	recordData: number;
	communityRecords: number;
	notifications: number;
	pushSubscriptions: number;
	userState: number;
	invitations: number;
	dismissedApplications: number;
};

type Response = {
	deleted: DeletedCounts;
};

export const deleteAccount: XrpcRequest<[], Promise<XrpcResult<Response>>> = (
	fetch,
) =>
	request<Response>(fetch, {
		lxm: "social.colibri.actor.deleteAccount",
		route: "/xrpc/social.colibri.actor.deleteAccount",
		init: {
			method: "POST",
		},
		expected: ["InvalidState"],
	});

import { ActionError, defineAction } from "astro:actions";
import { APPVIEW_DOMAIN } from "astro:env/client";
import { INVITE_API_KEY } from "astro:env/server";
import { Agent } from "@atproto/api";
import { z } from "astro/zod";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import { client } from "@/utils/atproto/oauth";
import { ColibriSDK, type UnresolvedCommunityData } from "@/utils/sdk";
import type { InviteCodeInfo } from "../community/invite";

type JetstreamEvent = {
	did: string;
	kind: string;
	commit?: CommitData;
};

type CommitData = {
	operation: string;
	collection: string;
	rkey: string;
	record: any;
};

type JoinState = {
	state: "success" | "partial" | "failed";
	message: string;
};

export const acceptInvitation = defineAction({
	input: z.object({
		code: z.string({ message: "No code given." }),
	}),
	handler: async ({ code }, { session }): Promise<JoinState> => {
		try {
			if (!session || !session?.has("user")) {
				throw new ActionError({
					message: "Forbidden",
					code: "FORBIDDEN",
				});
			}

			const user = (await session.get("user"))!;
			const oauthSession = await client.restore(user.sub!);
			const agent = new Agent(oauthSession);
			const sdk = new ColibriSDK(agent);

			const communityData = (await (
				await fetch(`https://${APPVIEW_DOMAIN}/api/invite/${code}`, {
					method: "GET",
					headers: new Headers({
						Authorization: `Bearer ${INVITE_API_KEY}`,
					}),
				})
			).json()) as InviteCodeInfo & {
				community: UnresolvedCommunityData;
			};

			if (!communityData.active) {
				throw new ActionError({
					message: "Invite link has expired!",
					code: "BAD_REQUEST",
				});
			}

			const communityAtUri = `at://${communityData.community.owner_did}/${RECORD_IDs.COMMUNITY}/${communityData.community.rkey}`;

			const hasMembershipDeclaration = await sdk.findMembershipDeclaration(
				agent.did!,
				communityAtUri,
			);

			console.log(hasMembershipDeclaration);

			let result: Promise<JoinState> | undefined;
			let joinApprovalRkey: string | undefined;

			if (!hasMembershipDeclaration) {
				const socket = new WebSocket(
					`https://jetstream.colibri.social/subscribe?wantedCollections=social.colibri.membership&wantedCollections=social.colibri.approval`,
				);

				await new Promise((res) => {
					socket.addEventListener("open", res);
				});

				result = new Promise<JoinState>((res, rej) => {
					let membershipCreated = false;
					let membershipApproved = false;

					const timeout = setTimeout(() => {
						socket.close();

						if (!membershipCreated) {
							return rej({
								state: "failed",
								message: "Operation timed out.",
							});
						}

						if (
							membershipCreated &&
							!communityData.community.requires_approval_to_join
						) {
							res({
								state: "success",
								message: communityData.community.rkey,
							});
						}

						if (membershipCreated && !membershipApproved) {
							return rej({
								state: "partial",
								message: "Waiting for owner approval.",
							});
						}

						return rej({
							state: "failed",
							message: "Unknown error.",
						});
					}, 15_000);

					socket.addEventListener(
						"message",
						(message: MessageEvent<string>) => {
							const parsedMessage = JSON.parse(message.data) as JetstreamEvent;

							if (parsedMessage.kind !== "commit") return;

							if (parsedMessage.commit) {
								console.log(parsedMessage);

								if (
									parsedMessage.commit.collection === RECORD_IDs.MEMBERSHIP &&
									parsedMessage.commit.rkey === membershipRkey
								) {
									membershipCreated = true;
								}

								if (
									parsedMessage.commit.collection === RECORD_IDs.APPROVAL &&
									parsedMessage.commit.rkey === joinApprovalRkey
								) {
									membershipApproved = true;
								}

								if (
									membershipCreated &&
									!communityData.community.requires_approval_to_join
								) {
									clearTimeout(timeout);
									socket.close();
									res({
										state: "success",
										message: communityData.community.rkey,
									});
								}

								if (membershipCreated && membershipApproved) {
									clearTimeout(timeout);
									socket.close();
									res({
										state: "success",
										message: communityData.community.rkey,
									});
								}
							}
						},
					);
				});

				if (!communityData.community.requires_approval_to_join) {
					socket.close();
					return await result;
				}
			} else {
				socket.close();
				return {
					state: "success",
					message: communityData.community.rkey,
				};
			}

			const membershipRkey = await sdk.createMembershipDeclaration(
				agent.did!,
				communityAtUri,
			);

			try {
				const ownerSession = await client.restore(
					communityData.community.owner_did,
				);
				const owner = new Agent(ownerSession);

				joinApprovalRkey = await sdk.createJoinApproval(
					owner.did!,
					`at://${agent.did!}/${RECORD_IDs.MEMBERSHIP}/${membershipRkey}`,
					communityAtUri,
					owner,
				);
			} catch (e) {
				console.error(e);
				return {
					state: "partial",
					message: "Waiting for owner approval.",
				};
			}

			const res = await result;
			return res;
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});

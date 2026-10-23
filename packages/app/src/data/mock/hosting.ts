import { ColibriError } from "@colibri-social/lib";
import type {
	AuthorizeHostInput,
	HandOverResult,
	HostAuthorization,
	HostingSource,
	HostingView,
} from "../hosting";
import type { LiveEvent } from "../source";
import type { Did } from "../types";
import { createCommunityRecord } from "./communities";
import { withLatency } from "./latency";
import type { World } from "./world";

export const MOCK_SIGN_IN_MS = 1_500;
export const MOCK_HAND_OVER_MS = 60 * 60 * 1000;
export const MOCK_COLIBRI_SERVER = "https://spaces-alpha.colibri.social";

const slug = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "") || "space";

const outcomeFor = (identifier: string): HostAuthorization | null => {
	if (/unsupported/i.test(identifier)) {
		return { status: "failed", failure: "spacesUnsupported" };
	}
	if (/wrong/i.test(identifier)) {
		return {
			status: "failed",
			failure: "wrongAccount",
			signedInAs: "alex.example.com",
		};
	}
	if (/taken/i.test(identifier)) {
		return { status: "failed", failure: "alreadyHosts" };
	}
	if (/cancel/i.test(identifier)) {
		return { status: "failed", failure: "cancelled" };
	}
	return null;
};

export const createMockHosting = (input: {
	world: World;
	now: number;
	emit: (event: LiveEvent) => void;
	seed?: Readonly<Record<string, Partial<HostingView>>>;
}): HostingSource => {
	const overrides = new Map<string, Partial<HostingView>>(
		Object.entries(input.seed ?? {}),
	);
	const requests = new Map<string, HostAuthorization>();
	let nextRequest = 0;

	const hostingOf = (community: Did): HostingView => {
		const space = input.world.spaces.find((entry) => entry.did === community);
		if (!space)
			throw new ColibriError({ code: "CommunityNotFound", method: "mock" });
		const override = overrides.get(community) ?? {};
		const kind = override.kind ?? "colibri";
		return {
			kind,
			account:
				kind === "colibri"
					? `${slug(space.view.name)}.spaces-alpha.colibri.social`
					: `${slug(space.view.name)}.example.com`,
			server: kind === "colibri" ? MOCK_COLIBRI_SERVER : "https://example.com",
			connectedAt: new Date(input.now).toISOString(),
			needsSignIn: false,
			...override,
		};
	};

	const settle = (request: string, auth: AuthorizeHostInput) => {
		const failed = outcomeFor(auth.identifier);
		if (failed) {
			requests.set(request, failed);
			return;
		}
		if (auth.intent === "reconnect") {
			overrides.set(auth.community, {
				...overrides.get(auth.community),
				kind: "own",
				account: auth.identifier,
				server: "https://example.com",
				connectedBy: input.world.viewerDid,
				needsSignIn: false,
				needsSignInSince: undefined,
				handOverExpiresAt: undefined,
			});
			requests.set(request, { status: "done", community: auth.community });
			return;
		}
		const record = createCommunityRecord(
			input.world,
			{
				name: auth.name,
				description: auth.description,
				requiresApprovalToJoin: auth.requiresApprovalToJoin,
			},
			input.now,
		);
		input.world.spaces.push(record);
		overrides.set(record.did, {
			kind: "own",
			account: auth.identifier,
			server: "https://example.com",
			connectedBy: input.world.viewerDid,
		});
		input.emit({
			$type: "communityEvent",
			event: "create",
			community: record.view,
		});
		requests.set(request, { status: "done", community: record.did });
	};

	return {
		authorizeCommunityHost: (auth) =>
			withLatency(() => {
				if (auth.intent === "reconnect") hostingOf(auth.community);
				nextRequest += 1;
				const request = `mock-host-${nextRequest}`;
				requests.set(request, { status: "pending" });
				setTimeout(() => settle(request, auth), MOCK_SIGN_IN_MS);
				return { authorizeUrl: "about:blank", request };
			}),
		getCommunityHostAuthorization: (request) =>
			withLatency(() => {
				const found = requests.get(request);
				if (!found) {
					throw new ColibriError({ code: "RequestNotFound", method: "mock" });
				}
				return found;
			}),
		getCommunityHosting: (community) => withLatency(() => hostingOf(community)),
		handOverCommunityHost: ({ community }) =>
			withLatency((): HandOverResult => {
				const hosting = hostingOf(community);
				if (hosting.kind !== "colibri") {
					throw new ColibriError({
						code: "HandOverUnavailable",
						method: "mock",
					});
				}
				const expiresAt = new Date(
					Date.now() + MOCK_HAND_OVER_MS,
				).toISOString();
				overrides.set(community, {
					...overrides.get(community),
					handOverExpiresAt: expiresAt,
				});
				return {
					identifier: hosting.account,
					password: "tR8v-qK2m-Wz9p-Lx4c-Hn7d",
					expiresAt,
				};
			}),
	};
};

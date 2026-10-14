import {
	AccessError,
	type AccessSource,
	type ApplicationView,
	type BannedActorView,
	type InvitationView,
} from "../access";
import type { LiveEvent } from "../source";
import type { CommunityView, Did, MemberView } from "../types";
import { withLatency } from "./latency";
import { VIEWER_KEY } from "./people";
import { asDatetime } from "./refs";
import type { SpaceRecord, World } from "./world";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type ApplicationRecord = { did: Did; createdAt: number; dismissed: boolean };
type BanRecord = {
	did: Did;
	reason?: string;
	bannedBy: Did;
	bannedAt: number;
};
type InvitationRecord = {
	code: string;
	createdBy: Did;
	createdAt: number;
	expiresAt?: number;
	uses: number;
	maxUses?: number;
};

type InviteSeed = {
	code: string;
	by: string;
	daysAgo: number;
	expiresIn?: number;
	uses?: number;
	maxUses?: number;
};

const APPLICATION_SEEDS: Record<
	string,
	{ key: string; hoursAgo: number; dismissed?: boolean }[]
> = {
	trail: [
		{ key: "gen45", hoursAgo: 2 },
		{ key: "gen46", hoursAgo: 20 },
		{ key: "gen47", hoursAgo: 52 },
		{ key: "gen48", hoursAgo: 120, dismissed: true },
	],
	hq: [
		{ key: "gen50", hoursAgo: 5 },
		{ key: "gen51", hoursAgo: 30 },
	],
};

const BAN_SEEDS: Record<
	string,
	{ key: string; by: string; daysAgo: number; reason?: string }[]
> = {
	hq: [
		{
			key: "gen60",
			by: VIEWER_KEY,
			daysAgo: 3,
			reason: "Posted scam links in #general",
		},
		{ key: "gen61", by: "mira", daysAgo: 40 },
	],
	trail: [
		{
			key: "gen62",
			by: "omar",
			daysAgo: 12,
			reason: "Harassing members in DMs",
		},
	],
};

const INVITE_SEEDS: Record<string, InviteSeed[]> = {
	hq: [
		{ code: "colibri-hq", by: VIEWER_KEY, daysAgo: 120, uses: 41 },
		{
			code: "Rk7mQ2xa",
			by: "mira",
			daysAgo: 1,
			expiresIn: 6 * DAY,
			uses: 3,
			maxUses: 25,
		},
		{
			code: "design-review",
			by: "tomas",
			daysAgo: 9,
			uses: 10,
			maxUses: 10,
		},
		{
			code: "launch-week",
			by: VIEWER_KEY,
			daysAgo: 10,
			expiresIn: -3 * DAY,
			uses: 17,
		},
	],
	trail: [
		{
			code: "spring-hikes",
			by: "omar",
			daysAgo: 6,
			expiresIn: DAY,
			uses: 2,
			maxUses: 10,
		},
	],
	owls: [{ code: "night-owls", by: "hana", daysAgo: 200, uses: 388 }],
	pixel: [
		{ code: "pixel-garden", by: "gen200", daysAgo: 30, uses: 61 },
		{ code: "pixel-sprint", by: "gen201", daysAgo: 20, expiresIn: -13 * DAY },
	],
	readers: [{ code: "quiet-readers", by: "gen300", daysAgo: 45, uses: 12 }],
};

const CODE_ALPHABET =
	"abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const createMockAccess = (options: {
	world: World;
	now: number;
	emit: (event: LiveEvent) => void;
}): AccessSource & {
	recordBan: (input: { community: Did; subject: Did; reason?: string }) => void;
} => {
	const { world, now, emit } = options;
	const applications = new Map<Did, ApplicationRecord[]>();
	const bans = new Map<Did, BanRecord[]>();
	const invitations = new Map<Did, InvitationRecord[]>();
	let codeCounter = 0;

	for (const space of world.spaces) {
		const key = space.seed.key;
		applications.set(
			space.did,
			(APPLICATION_SEEDS[key] ?? []).map((seed) => ({
				did: world.people.didOf(seed.key),
				createdAt: now - seed.hoursAgo * HOUR,
				dismissed: !!seed.dismissed,
			})),
		);
		bans.set(
			space.did,
			(BAN_SEEDS[key] ?? []).map((seed) => ({
				did: world.people.didOf(seed.key),
				reason: seed.reason,
				bannedBy: world.people.didOf(seed.by),
				bannedAt: now - seed.daysAgo * DAY,
			})),
		);
		invitations.set(
			space.did,
			(INVITE_SEEDS[key] ?? []).map((seed) => {
				const createdAt = now - seed.daysAgo * DAY;
				return {
					code: seed.code,
					createdBy: world.people.didOf(seed.by),
					createdAt,
					expiresAt:
						seed.expiresIn === undefined ? undefined : now + seed.expiresIn,
					uses: seed.uses ?? 0,
					maxUses: seed.maxUses,
				};
			}),
		);
	}

	const spaceOf = (community: Did) => {
		const space = world.spaces.find((entry) => entry.did === community);
		if (!space) throw new Error(`Unknown community ${community}`);
		return space;
	};

	const require = (space: SpaceRecord, permission: string) => {
		const viewer = space.view.viewer;
		if (viewer.isOwner || viewer.permissions?.includes(permission)) return;
		throw new AccessError("Forbidden");
	};

	const changed = (
		community: Did,
		kind: "applications" | "bans" | "invitations",
	) => emit({ $type: "accessEvent", community, kind });

	const isActive = (record: InvitationRecord) =>
		(record.expiresAt === undefined || record.expiresAt > Date.now()) &&
		(record.maxUses === undefined || record.uses < record.maxUses);

	const invitationView = (record: InvitationRecord): InvitationView => {
		const view: InvitationView = {
			code: record.code,
			createdBy: record.createdBy,
			active: isActive(record),
			createdAt: asDatetime(record.createdAt),
			uses: record.uses,
		};
		if (record.expiresAt !== undefined)
			view.expiresAt = asDatetime(record.expiresAt);
		if (record.maxUses !== undefined) view.maxUses = record.maxUses;
		return view;
	};

	const setViewer = (
		space: SpaceRecord,
		change: Partial<CommunityView["viewer"]>,
	) => {
		space.view = {
			...space.view,
			viewer: { ...space.view.viewer, ...change },
		};
	};

	const admit = (space: SpaceRecord, did: Did): MemberView => {
		const member: MemberView = {
			actor: world.people.profile(did),
			roles: [],
			joinedAt: asDatetime(Date.now()),
		};
		space.members.push(member);
		space.view = {
			...space.view,
			memberCount: (space.view.memberCount ?? 0) + 1,
		};
		return member;
	};

	const takeApplication = (community: Did, subject: Did) => {
		const list = applications.get(community) ?? [];
		const index = list.findIndex((entry) => entry.did === subject);
		if (index < 0) throw new AccessError("ApplicationNotFound");
		return { list, index, record: list[index] as ApplicationRecord };
	};

	const nextCode = () => {
		codeCounter += 1;
		let seed = (now + codeCounter * 7919) % 2147483647;
		let code = "";
		for (let index = 0; index < 8; index++) {
			seed = (seed * 48271) % 2147483647;
			code += CODE_ALPHABET[seed % CODE_ALPHABET.length];
		}
		return code;
	};

	const findInvitation = (code: string) => {
		for (const space of world.spaces) {
			const record = invitations
				.get(space.did)
				?.find((entry) => entry.code === code);
			if (record) return { space, record };
		}
		return undefined;
	};

	return {
		recordBan: (input) => {
			const list = bans.get(input.community) ?? [];
			bans.set(input.community, [
				{
					did: input.subject,
					reason: input.reason,
					bannedBy: world.viewerDid,
					bannedAt: Date.now(),
				},
				...list.filter((entry) => entry.did !== input.subject),
			]);
			changed(input.community, "bans");
		},
		listApplications: (input) =>
			withLatency(() => {
				require(spaceOf(input.community), "approval.manage");
				return (applications.get(input.community) ?? [])
					.filter((entry) => input.includeDismissed || !entry.dismissed)
					.sort((a, b) => b.createdAt - a.createdAt)
					.map(
						(entry): ApplicationView => ({
							actor: world.people.profile(entry.did),
							createdAt: asDatetime(entry.createdAt),
							dismissed: entry.dismissed,
						}),
					);
			}),
		approveApplication: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				require(space, "approval.manage");
				const { list, index } = takeApplication(input.community, input.subject);
				list.splice(index, 1);
				const member = admit(space, input.subject);
				changed(input.community, "applications");
				return member;
			}),
		dismissApplication: (input) =>
			withLatency(() => {
				require(spaceOf(input.community), "approval.manage");
				takeApplication(input.community, input.subject).record.dismissed = true;
				changed(input.community, "applications");
			}),
		undismissApplication: (input) =>
			withLatency(() => {
				require(spaceOf(input.community), "approval.manage");
				takeApplication(input.community, input.subject).record.dismissed =
					false;
				changed(input.community, "applications");
			}),
		listBans: (community) =>
			withLatency(() => {
				require(spaceOf(community), "member.unban");
				return [...(bans.get(community) ?? [])]
					.sort((a, b) => b.bannedAt - a.bannedAt)
					.map((entry): BannedActorView => {
						const view: BannedActorView = {
							actor: world.people.profile(entry.did),
							bannedBy: entry.bannedBy,
							bannedAt: asDatetime(entry.bannedAt),
						};
						if (entry.reason) view.reason = entry.reason;
						return view;
					});
			}),
		unban: (input) =>
			withLatency(() => {
				require(spaceOf(input.community), "member.unban");
				const list = bans.get(input.community) ?? [];
				const index = list.findIndex((entry) => entry.did === input.subject);
				if (index < 0) throw new AccessError("NotBanned");
				list.splice(index, 1);
				changed(input.community, "bans");
			}),
		listInvitations: (community) =>
			withLatency(() => {
				require(spaceOf(community), "invitation.create");
				return [...(invitations.get(community) ?? [])]
					.sort((a, b) => b.createdAt - a.createdAt)
					.map(invitationView);
			}),
		createInvitation: (input) =>
			withLatency(() => {
				require(spaceOf(input.community), "invitation.create");
				const record: InvitationRecord = {
					code: nextCode(),
					createdBy: world.viewerDid,
					createdAt: Date.now(),
					expiresAt: input.expiresAt ? Date.parse(input.expiresAt) : undefined,
					uses: 0,
					maxUses: input.maxUses,
				};
				invitations.set(input.community, [
					record,
					...(invitations.get(input.community) ?? []),
				]);
				changed(input.community, "invitations");
				return invitationView(record);
			}),
		deleteInvitation: (input) =>
			withLatency(() => {
				require(spaceOf(input.community), "invitation.delete");
				const list = invitations.get(input.community) ?? [];
				const index = list.findIndex((entry) => entry.code === input.code);
				if (index < 0) throw new AccessError("InvitationNotFound");
				list.splice(index, 1);
				changed(input.community, "invitations");
			}),
		getInvitation: (code) =>
			withLatency(() => {
				const found = findInvitation(code);
				if (!found) throw new AccessError("InvitationNotFound");
				return {
					invitation: invitationView(found.record),
					community: found.space.view,
				};
			}),
		joinCommunity: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				const viewer = world.viewerDid;
				if (space.view.viewer.isMember) throw new AccessError("AlreadyMember");
				if ((bans.get(space.did) ?? []).some((entry) => entry.did === viewer))
					throw new AccessError("Banned");
				const record = input.invitation
					? invitations
							.get(space.did)
							?.find((entry) => entry.code === input.invitation)
					: undefined;
				if (input.invitation && (!record || !isActive(record)))
					throw new AccessError("InvitationNotFound");
				if (record) record.uses += 1;
				if (space.view.requiresApprovalToJoin) {
					const list = applications.get(space.did) ?? [];
					if (!list.some((entry) => entry.did === viewer)) {
						list.push({ did: viewer, createdAt: Date.now(), dismissed: false });
						applications.set(space.did, list);
					}
					setViewer(space, { applicationPending: true });
					emit({
						$type: "communityEvent",
						event: "update",
						community: space.view,
					});
					return { status: "pending" as const };
				}
				const member = admit(space, viewer);
				setViewer(space, { isMember: true, applicationPending: false });
				emit({
					$type: "communityEvent",
					event: "create",
					community: space.view,
				});
				return { status: "joined" as const, member };
			}),
	};
};

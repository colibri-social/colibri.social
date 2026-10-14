import { type Accessor, batch, createRoot, createSignal } from "solid-js";
import type {
	ApplicationView,
	BannedActorView,
	CreateInvitationInput,
	InvitationPreview,
	InvitationView,
	JoinResult,
} from "./access";
import type { DataSource } from "./source";
import type { Did, MemberView } from "./types";

export type AccessList<T> = {
	value: Accessor<T[] | undefined>;
	loading: Accessor<boolean>;
	error: Accessor<unknown>;
	refresh: () => Promise<void>;
	update: (change: (list: T[]) => T[]) => void;
};

type MemberLoad = {
	update: (change: (list: MemberView[]) => MemberView[]) => void;
};

const createAccessList = <T>(fetch: () => Promise<T[]>): AccessList<T> =>
	createRoot(() => {
		const [value, setValue] = createSignal<T[]>();
		const [loading, setLoading] = createSignal(true);
		const [error, setError] = createSignal<unknown>();
		let generation = 0;
		const refresh = async () => {
			const current = ++generation;
			setLoading(true);
			try {
				const next = await fetch();
				if (current !== generation) return;
				batch(() => {
					setValue(() => next);
					setError(undefined);
				});
			} catch (failure) {
				if (current === generation) setError(() => failure);
			} finally {
				if (current === generation) setLoading(false);
			}
		};
		void refresh();
		return {
			value,
			loading,
			error,
			refresh,
			update: (change) => {
				const current = value();
				if (current) setValue(() => change(current));
			},
		};
	});

export const createAccessStore = (options: {
	source: DataSource;
	memberLoads: Map<Did, MemberLoad>;
}) => {
	const { source, memberLoads } = options;
	const applicationLists = new Map<Did, AccessList<ApplicationView>>();
	const banLists = new Map<Did, AccessList<BannedActorView>>();
	const invitationLists = new Map<Did, AccessList<InvitationView>>();

	const cached = <T>(
		lists: Map<Did, AccessList<T>>,
		community: Did,
		fetch: () => Promise<T[]>,
	) => {
		const existing = lists.get(community);
		if (existing) return existing;
		const list = createAccessList(fetch);
		lists.set(community, list);
		return list;
	};

	const applications = (community: Did) =>
		cached(applicationLists, community, () =>
			source.listApplications({ community, includeDismissed: true }),
		);
	const bans = (community: Did) =>
		cached(banLists, community, () => source.listBans(community));
	const invitations = (community: Did) =>
		cached(invitationLists, community, () => source.listInvitations(community));

	source.subscribe((event) => {
		if (event.$type !== "accessEvent") return;
		const lists =
			event.kind === "applications"
				? applicationLists
				: event.kind === "bans"
					? banLists
					: invitationLists;
		void lists.get(event.community)?.refresh();
	});

	const optimistic = async <T>(
		list: AccessList<T> | undefined,
		change: (items: T[]) => T[],
		call: () => Promise<unknown>,
	) => {
		const before = list?.value();
		list?.update(change);
		try {
			await call();
		} catch (failure) {
			if (before) list?.update(() => before);
			throw failure;
		}
	};

	const setDismissed = (community: Did, subject: Did, dismissed: boolean) =>
		optimistic(
			applicationLists.get(community),
			(items) =>
				items.map((entry) =>
					entry.actor.did === subject ? { ...entry, dismissed } : entry,
				),
			() =>
				dismissed
					? source.dismissApplication({ community, subject })
					: source.undismissApplication({ community, subject }),
		);

	return {
		applications,
		bans,
		invitations,
		approve: async (community: Did, subject: Did) => {
			let member: MemberView | undefined;
			await optimistic(
				applicationLists.get(community),
				(items) => items.filter((entry) => entry.actor.did !== subject),
				async () => {
					member = await source.approveApplication({ community, subject });
				},
			);
			const admitted = member;
			if (admitted) {
				memberLoads
					.get(community)
					?.update((list) =>
						list.some((entry) => entry.actor.did === subject)
							? list
							: [...list, admitted],
					);
			}
		},
		dismiss: (community: Did, subject: Did) =>
			setDismissed(community, subject, true),
		restore: (community: Did, subject: Did) =>
			setDismissed(community, subject, false),
		unban: (community: Did, subject: Did) =>
			optimistic(
				banLists.get(community),
				(items) => items.filter((entry) => entry.actor.did !== subject),
				() => source.unban({ community, subject }),
			),
		createInvitation: async (input: CreateInvitationInput) => {
			const invitation = await source.createInvitation(input);
			invitationLists
				.get(input.community)
				?.update((items) =>
					items.some((entry) => entry.code === invitation.code)
						? items
						: [invitation, ...items],
				);
			return invitation;
		},
		deleteInvitation: (community: Did, code: string) =>
			optimistic(
				invitationLists.get(community),
				(items) => items.filter((entry) => entry.code !== code),
				() => source.deleteInvitation({ community, code }),
			),
		resolveInvitation: (code: string): Promise<InvitationPreview> =>
			source.getInvitation(code),
		join: (community: Did, invitation?: string): Promise<JoinResult> =>
			source.joinCommunity({ community, invitation }),
	};
};

export type AccessStore = ReturnType<typeof createAccessStore>;

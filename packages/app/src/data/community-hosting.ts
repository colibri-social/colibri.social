import { type Accessor, createSignal } from "solid-js";
import {
	type ExternalTab,
	type HandOverResult,
	type HostingSource,
	type HostingView,
	HostSignInError,
	waitForHostAuthorization,
} from "./hosting";
import type { Did } from "./types";

type Entry = {
	value: Accessor<HostingView | undefined>;
	set: (value: HostingView | undefined) => void;
	loading: Accessor<boolean>;
	setLoading: (loading: boolean) => void;
	pending?: Promise<HostingView | undefined>;
};

export type CommunityHosting = {
	get: (community: Did) => Accessor<HostingView | undefined>;
	loading: (community: Did) => boolean;
	refresh: (community: Did) => Promise<HostingView | undefined>;
	reconnect: (input: {
		community: Did;
		identifier: string;
		tab: ExternalTab;
		signal?: AbortSignal;
	}) => Promise<HostingView | undefined>;
	handOver: (input: {
		community: Did;
		email: string;
	}) => Promise<HandOverResult>;
};

export const createCommunityHosting = (
	source: HostingSource,
): CommunityHosting => {
	const entries = new Map<Did, Entry>();

	const entryOf = (community: Did): Entry => {
		const existing = entries.get(community);
		if (existing) return existing;
		const [value, set] = createSignal<HostingView>();
		const [loading, setLoading] = createSignal(false);
		const entry: Entry = { value, set, loading, setLoading };
		entries.set(community, entry);
		return entry;
	};

	const refresh = (community: Did) => {
		const entry = entryOf(community);
		if (entry.pending) return entry.pending;
		entry.setLoading(true);
		const pending = source
			.getCommunityHosting(community)
			.then(
				(value) => {
					entry.set(value);
					return value;
				},
				() => entry.value(),
			)
			.finally(() => {
				entry.pending = undefined;
				entry.setLoading(false);
			});
		entry.pending = pending;
		return pending;
	};

	return {
		get: (community) => {
			const entry = entryOf(community);
			if (!entry.value() && !entry.pending) void refresh(community);
			return entry.value;
		},
		loading: (community) => entryOf(community).loading(),
		refresh,
		reconnect: async ({ community, identifier, tab, signal }) => {
			const { authorizeUrl, request } = await source.authorizeCommunityHost({
				intent: "reconnect",
				identifier,
				community,
			});
			tab.go(authorizeUrl);
			const outcome = await waitForHostAuthorization(source, request, {
				signal,
			});
			if (outcome.status === "failed") {
				throw new HostSignInError(outcome.failure, outcome.signedInAs);
			}
			return refresh(community);
		},
		handOver: async (input) => {
			const result = await source.handOverCommunityHost(input);
			void refresh(input.community);
			return result;
		},
	};
};

const stores = new WeakMap<HostingSource, CommunityHosting>();

export const communityHostingFor = (
	source: HostingSource,
): CommunityHosting => {
	const existing = stores.get(source);
	if (existing) return existing;
	const created = createCommunityHosting(source);
	stores.set(source, created);
	return created;
};

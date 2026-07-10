import {
	createContext,
	createSignal,
	onCleanup,
	onMount,
	type ParentComponent,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import { removeMute, writeMute } from "../atproto/mutes";
import { AtURI } from "../utils/at-uri";
import { useSocketContext } from "./Socket";
import { useUserContext } from "./User";

const COMMUNITY_COLLECTION = "social.colibri.community";

const channelKey = (channelUri: string): string => {
	const { did, identifier } = AtURI.parseAtURI(channelUri);
	return `${did}/${identifier}`;
};

const communityDidOf = (uri: string): string => AtURI.parseAtURI(uri).did;

const isCommunitySubject = (subject: string): boolean =>
	AtURI.parseAtURI(subject).collection === COMMUNITY_COLLECTION;

type MutesContextValue = {
	isChannelMuted: (channelUri: string) => boolean;
	isChannelKeyMuted: (channelKey: string) => boolean;
	isCommunityMuted: (communityUri: string) => boolean;
	muteChannel: (channelUri: string) => Promise<void>;
	unmuteChannel: (channelUri: string) => Promise<void>;
	muteCommunity: (communityUri: string) => Promise<void>;
	unmuteCommunity: (communityUri: string) => Promise<void>;
};

const MutesContext = createContext<MutesContextValue>();

export const MutesContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();

	// Muted channel keys (`{communityDid}/{rkey}`) and muted community DIDs.
	// Replaced immutably so dependent accessors re-run.
	const [mutedChannels, setMutedChannels] = createSignal<Record<string, true>>(
		{},
	);
	const [mutedCommunities, setMutedCommunities] = createSignal<
		Record<string, true>
	>({});

	const addChannel = (key: string) =>
		setMutedChannels((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
	const removeChannel = (key: string) =>
		setMutedChannels((prev) => {
			if (!prev[key]) return prev;
			const next = { ...prev };
			delete next[key];
			return next;
		});
	const addCommunity = (did: string) =>
		setMutedCommunities((prev) =>
			prev[did] ? prev : { ...prev, [did]: true },
		);
	const removeCommunity = (did: string) =>
		setMutedCommunities((prev) => {
			if (!prev[did]) return prev;
			const next = { ...prev };
			delete next[did];
			return next;
		});

	const applySubject = (subject: string, muted: boolean) => {
		if (isCommunitySubject(subject)) {
			const did = communityDidOf(subject);
			if (muted) addCommunity(did);
			else removeCommunity(did);
		} else {
			const key = channelKey(subject);
			if (muted) addChannel(key);
			else removeChannel(key);
		}
	};

	// ---- Accessors ---------------------------------------------------------

	const isChannelKeyMuted = (key: string): boolean =>
		!!mutedCommunities()[key.split("/")[0]] || !!mutedChannels()[key];

	const isChannelMuted = (channelUri: string): boolean =>
		isChannelKeyMuted(channelKey(channelUri));

	const isCommunityMuted = (communityUri: string): boolean =>
		!!mutedCommunities()[communityDidOf(communityUri)];

	// ---- Mutators ----------------------------------------------------------

	const toggle = async (
		subject: string,
		muted: boolean,
		failureMessage: string,
	): Promise<void> => {
		applySubject(subject, muted);
		try {
			if (muted) await writeMute(user.atproto.agent, user.did, subject);
			else await removeMute(user.atproto.agent, user.did, subject);
		} catch (err) {
			console.error(err);
			applySubject(subject, !muted);
			toast.error(failureMessage);
		}
	};

	const muteChannel = (channelUri: string) =>
		toggle(channelUri, true, "Failed to mute channel.");
	const unmuteChannel = (channelUri: string) =>
		toggle(channelUri, false, "Failed to unmute channel.");
	const muteCommunity = (communityUri: string) =>
		toggle(communityUri, true, "Failed to mute community.");
	const unmuteCommunity = (communityUri: string) =>
		toggle(communityUri, false, "Failed to unmute community.");

	// ---- Seeding + live sync ----------------------------------------------

	onMount(() => {
		void (async () => {
			const res = await user.xrpc.social.colibri.actor.listMutes();
			if (!res?.mutes || !Array.isArray(res?.mutes)) return;
			for (const mute of res.mutes) applySubject(mute.subject, true);
		})();

		const cleanup = socket.onEvent((event) => {
			if (event.type !== "mute_event" || !event.data) return;
			applySubject(event.data.subject, event.data.event === "muted");
		});

		onCleanup(cleanup);
	});

	const value: MutesContextValue = {
		isChannelMuted,
		isChannelKeyMuted,
		isCommunityMuted,
		muteChannel,
		unmuteChannel,
		muteCommunity,
		unmuteCommunity,
	};

	return (
		<MutesContext.Provider value={value}>
			{props.children}
		</MutesContext.Provider>
	);
};

export const useMutes = (): MutesContextValue => {
	const ctx = useContext(MutesContext);
	if (!ctx) throw new Error("useMutes called outside MutesContextProvider");
	return ctx;
};

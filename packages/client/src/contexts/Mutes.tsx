import {
	createContext,
	createSignal,
	onCleanup,
	onMount,
	type ParentComponent,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import {
	decodeMuteSubject,
	type MuteSubject,
	muteSubjectKey,
	muteSubject as muteSubjectRecord,
	unmuteSubject as unmuteSubjectRecord,
} from "../atproto/mutes";
import { getPreferences } from "../atproto/notificationPreference";
import { frameIs } from "../atproto/sync-frames";
import type { Mute } from "../atproto/views";
import { createLogger } from "../utils/logger";
import { useSocketContext } from "./Socket";
import { useUserContext } from "./User";

const log = createLogger("mutes");

type MutesContextValue = {
	isMuted: (did: string) => boolean;
	isUserMuted: (did: string) => boolean;
	isCommunityMuted: (did: string) => boolean;
	isChannelMuted: (space: string) => boolean;
	muteUser: (did: string) => Promise<void>;
	unmuteUser: (did: string) => Promise<void>;
	muteCommunity: (did: string) => Promise<void>;
	unmuteCommunity: (did: string) => Promise<void>;
	muteChannel: (space: string) => Promise<void>;
	unmuteChannel: (space: string) => Promise<void>;
};

const MutesContext = createContext<MutesContextValue>();

export const MutesContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();

	const [mutedSubjects, setMutedSubjects] = createSignal<Record<string, true>>(
		{},
	);

	const addSubject = (key: string) =>
		setMutedSubjects((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

	const removeSubject = (key: string) =>
		setMutedSubjects((prev) => {
			if (!prev[key]) return prev;
			const next = { ...prev };
			delete next[key];
			return next;
		});

	const isMuted = (did: string): boolean => !!mutedSubjects()[did];
	const isChannelMuted = (space: string): boolean => !!mutedSubjects()[space];

	const applyMutes = (mutes: Array<Mute>) => {
		const next: Record<string, true> = {};
		for (const mute of mutes) {
			const subject = decodeMuteSubject(mute.subject);
			if (!subject) continue;
			next[muteSubjectKey(subject)] = true;
		}
		setMutedSubjects(next);
	};

	const toggle = async (
		subject: MuteSubject,
		muted: boolean,
		failureMessage: string,
	): Promise<void> => {
		const key = muteSubjectKey(subject);
		if (muted) addSubject(key);
		else removeSubject(key);

		const res = muted
			? await muteSubjectRecord(
					user.atproto.agent,
					user.xrpc,
					user.did,
					subject,
				)
			: await unmuteSubjectRecord(
					user.atproto.agent,
					user.xrpc,
					user.did,
					subject,
				);

		if (!res.ok) {
			log.error("mute write failed", { code: res.error.code });
			if (muted) removeSubject(key);
			else addSubject(key);
			toast.error(failureMessage);
			return;
		}

		applyMutes(res.data.preferences.mutes);
	};

	const muteUser = (did: string) =>
		toggle({ kind: "actor", did }, true, "Failed to mute user.");
	const unmuteUser = (did: string) =>
		toggle({ kind: "actor", did }, false, "Failed to unmute user.");
	const muteCommunity = (did: string) =>
		toggle({ kind: "actor", did }, true, "Failed to mute community.");
	const unmuteCommunity = (did: string) =>
		toggle({ kind: "actor", did }, false, "Failed to unmute community.");
	const muteChannel = (space: string) =>
		toggle(
			{ kind: "channel", channel: space },
			true,
			"Failed to mute channel.",
		);
	const unmuteChannel = (space: string) =>
		toggle(
			{ kind: "channel", channel: space },
			false,
			"Failed to unmute channel.",
		);

	onMount(() => {
		void (async () => {
			const res = await getPreferences(user.xrpc);
			if (!res.ok) {
				log.warn("failed to load mutes", { code: res.error.code });
				return;
			}
			applyMutes(res.data.preferences.mutes);
		})();
	});

	onMount(() => {
		const cleanup = socket.onEvent((event) => {
			if (!frameIs(event, "preferencesEvent")) return;
			applyMutes(event.preferences.mutes);
		});
		onCleanup(cleanup);
	});

	const value: MutesContextValue = {
		isMuted,
		isUserMuted: isMuted,
		isCommunityMuted: isMuted,
		isChannelMuted,
		muteUser,
		unmuteUser,
		muteCommunity,
		unmuteCommunity,
		muteChannel,
		unmuteChannel,
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

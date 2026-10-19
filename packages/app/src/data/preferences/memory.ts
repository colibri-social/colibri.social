import {
	DEFAULT_PREFERENCES,
	type Mute,
	type PreferenceBackend,
	type Preferences,
} from "./types";
import { muteKey } from "./wire";

export const createMemoryPreferenceBackend = (
	initial: Partial<Preferences> = {},
) => {
	let state: Preferences = { ...DEFAULT_PREFERENCES, ...initial };
	const records = new Map<string, Mute>(
		state.mutes.map((mute, index) => [`seed${index}`, mute]),
	);
	const backend: PreferenceBackend = {
		load: async () => state,
		putSettings: async (_current, change) => {
			state = { ...state, ...change };
			return state;
		},
		putSpaceLevel: async (community, level) => {
			const { [community]: _, ...rest } = state.spaceLevels;
			state = {
				...state,
				spaceLevels: level ? { ...rest, [community]: level } : rest,
			};
			return state;
		},
		putSpaceModeration: async (community, hideModeratedMessages) => {
			const { [community]: _, ...rest } = state.spaceModeration;
			state = {
				...state,
				spaceModeration:
					hideModeratedMessages === undefined
						? rest
						: { ...rest, [community]: hideModeratedMessages },
			};
			return state;
		},
		listMutes: async () => [...records].map(([rkey, mute]) => ({ rkey, mute })),
		createMute: async (rkey, mute) => {
			records.set(rkey, mute);
		},
		deleteMute: async (rkey) => {
			records.delete(rkey);
		},
		putMutes: async (mutes) => {
			state = { ...state, mutes: [...mutes] };
			return state;
		},
	};
	return {
		backend,
		state: () => state,
		records: () =>
			[...records].map(([rkey, mute]) => ({
				rkey,
				key: muteKey(mute.subject),
			})),
	};
};

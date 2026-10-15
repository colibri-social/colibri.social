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
		putSettings: async (_settings, change) => {
			state = { ...state, ...change };
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

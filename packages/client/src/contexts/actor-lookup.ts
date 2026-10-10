import type { ProfileView } from "../atproto/views";

export const ACTOR_RETRY_DELAYS: ReadonlyArray<number> = [
	1000, 2000, 4000, 8000,
];

export type ActorLookup = {
	request: (did: string) => void;
	dispose: () => void;
};

export const createActorLookup = (
	fetchProfile: (did: string) => Promise<ProfileView | undefined>,
	remember: (actor: ProfileView) => void,
	delays: ReadonlyArray<number> = ACTOR_RETRY_DELAYS,
): ActorLookup => {
	const inflight = new Set<string>();
	const timers = new Set<ReturnType<typeof setTimeout>>();
	let disposed = false;

	const attempt = (did: string, tries: number): void => {
		void fetchProfile(did)
			.catch(() => undefined)
			.then((profile) => {
				if (disposed) return;
				if (profile) {
					inflight.delete(did);
					remember(profile);
					return;
				}
				const delay = delays[tries];
				if (delay === undefined) {
					inflight.delete(did);
					return;
				}
				const timer = setTimeout(() => {
					timers.delete(timer);
					attempt(did, tries + 1);
				}, delay);
				timers.add(timer);
			});
	};

	return {
		request: (did) => {
			if (disposed || inflight.has(did)) return;
			inflight.add(did);
			attempt(did, 0);
		},
		dispose: () => {
			disposed = true;
			for (const timer of timers) clearTimeout(timer);
			timers.clear();
		},
	};
};

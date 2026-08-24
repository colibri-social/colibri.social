import { createContext, type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { colibri } from "../atproto/lexicons";
import type { ProfileView } from "../atproto/views";
import { useUserContext } from "./User";

type ActorCacheContextValue = {
	resolve: (did: string) => ProfileView | undefined;
	seed: (actor: ProfileView) => void;
};

const ActorCacheContext = createContext<ActorCacheContextValue>();

export const ActorCacheProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const [cache, setCache] = createStore<Record<string, ProfileView>>({});
	const inflight = new Set<string>();

	const seed = (actor: ProfileView): void => {
		if (actor?.did) setCache(actor.did, actor);
	};

	const resolve = (did: string): ProfileView | undefined => {
		if (did === user.did) return user as unknown as ProfileView;

		const cached = cache[did];

		if (cached) return cached;

		if (!inflight.has(did)) {
			inflight.add(did);
			user.xrpc
				.call(colibri.actor.getProfile.main, { params: { actor: did } })
				.then((res) => {
					if (res.ok && res.data?.profile) setCache(did, res.data.profile);
				})
				.catch(() => {})
				.finally(() => inflight.delete(did));
		}

		return undefined;
	};

	return (
		<ActorCacheContext.Provider value={{ resolve, seed }}>
			{props.children}
		</ActorCacheContext.Provider>
	);
};

export const useActorCache = (): ActorCacheContextValue => {
	const ctx = useContext(ActorCacheContext);
	if (!ctx) throw new Error("useActorCache called outside ActorCacheProvider");
	return ctx;
};

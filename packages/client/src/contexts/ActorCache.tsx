import type { ActorData } from "@colibri-social/lib";
import { createContext, type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { useUserContext } from "./User";

type ActorCacheContextValue = {
	resolve: (did: string) => ActorData | undefined;
	seed: (actor: ActorData) => void;
};

const ActorCacheContext = createContext<ActorCacheContextValue>();

export const ActorCacheProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const [cache, setCache] = createStore<Record<string, ActorData>>({});
	const inflight = new Set<string>();

	const seed = (actor: ActorData): void => {
		if (actor?.did) setCache(actor.did, actor);
	};

	const resolve = (did: string): ActorData | undefined => {
		if (did === user.did) return user as unknown as ActorData;

		const cached = cache[did];

		if (cached) return cached;

		if (!inflight.has(did)) {
			inflight.add(did);
			user.xrpc.social.colibri.actor
				.getData(did)
				.then((res) => {
					if (res.ok && res.data) setCache(did, res.data);
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

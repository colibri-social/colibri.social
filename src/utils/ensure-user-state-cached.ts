import type { GlobalContextData } from "@/components/solid/contexts/GlobalContext";
import type { UserOnlineState } from "@/components/solid/contexts/GlobalContext/events";
import type { OnlineStateInfo } from "@/components/solid/contexts/GlobalContext/types";

/**
 * Ensures that a user's online state is saved in the cache.
 * @param did The DID of the user.
 * @param state The online state of the user.
 * @param globalState The global context data.
 * @param updateUserOnlineState The function to cache the user online state.
 */
export const ensureUserStateCached = (
	did: string,
	state: UserOnlineState,
	globalState: GlobalContextData,
	updateUserOnlineState: (state: OnlineStateInfo) => void,
) => {
	if (!globalState.userOnlineStates.some((x) => x.did === did)) {
		updateUserOnlineState({
			did: did,
			state: state,
		});
	}
};

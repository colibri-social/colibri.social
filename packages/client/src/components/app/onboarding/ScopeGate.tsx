import { createMemo, type ParentComponent, Show } from "solid-js";
import { getMissingScopeSets } from "../../../atproto/scopes";
import { scopesRejectedByServer } from "../../../atproto/session-health";
import { useAuthContext } from "../../../contexts/Auth";
import { createLogger } from "../../../utils/logger";
import { ScopeRefreshModal } from "./ScopeRefreshModal";
import { clearScopeReauthAttempts, scopeReauthExhausted } from "./scope-reauth";

const log = createLogger("scopes");

export const ScopeGate: ParentComponent = (props) => {
	const auth = useAuthContext();

	if (!auth?.loggedIn) return <>{props.children}</>;

	const missing = createMemo(() => getMissingScopeSets(auth.grantedScopes()));

	const needsReauth = createMemo(() => {
		const rejected = scopesRejectedByServer();

		if (missing().length === 0 && !rejected) {
			clearScopeReauthAttempts();
			return false;
		}

		if (scopeReauthExhausted()) {
			log.warn("still missing scopes after re-auth attempts", {
				missing: missing().length,
				rejectedByServer: rejected,
			});
			return false;
		}

		return true;
	});

	return (
		<Show when={needsReauth()} fallback={props.children}>
			<ScopeRefreshModal
				client={auth.client}
				did={auth.agent.did!}
				missing={missing()}
			/>
		</Show>
	);
};

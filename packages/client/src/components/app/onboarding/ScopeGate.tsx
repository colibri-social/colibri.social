import { createMemo, type ParentComponent, Show } from "solid-js";
import { getMissingScopeSets } from "../../../atproto/scopes";
import { useAuthContext } from "../../../contexts/Auth";
import { createLogger } from "../../../utils/logger";
import { ScopeRefreshModal } from "./ScopeRefreshModal";
import { SCOPE_REAUTH_FLAG } from "./scope-reauth";

const log = createLogger("scopes");

export const ScopeGate: ParentComponent = (props) => {
	const auth = useAuthContext();

	if (!auth?.loggedIn) return <>{props.children}</>;

	const missing = createMemo(() => getMissingScopeSets(auth.grantedScopes));

	const needsReauth = createMemo(() => {
		if (missing().length === 0) {
			sessionStorage.removeItem(SCOPE_REAUTH_FLAG);
			return false;
		}
		if (sessionStorage.getItem(SCOPE_REAUTH_FLAG)) {
			log.warn(
				"still missing scopes after a re-auth attempt, letting the user in",
				{
					missing: missing().length,
				},
			);
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

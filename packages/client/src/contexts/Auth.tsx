import {
	createContext,
	createEffect,
	createResource,
	Match,
	type ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { type Client, getClient, hasStoredSession } from "../atproto/auth";
import { primeFromLocation } from "../atproto/channel-prefetch";
import { installQuitGuard } from "../atproto/quit-guard";
import { sessionDead } from "../atproto/session-health";
import { primaryClient } from "../atproto/xrpc";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { AppViewUnreachableModal } from "../components/app/AppViewUnreachableModal";
import { SessionExpiredRedirect } from "../components/app/SessionExpiredRedirect";
import {
	hasLeftoverPushRegistration,
	teardownNotifications,
} from "../notifications/teardown";
import { markBoot } from "../utils/perf";

export const AuthContext = createContext<Client>(undefined);

export const AuthContextProvider: ParentComponent = (props) => {
	const [client] = createResource(getClient);

	createEffect(() => {
		if (!client.loading) markBoot("auth:ready");
	});

	createEffect(() => {
		const resolved = client();
		if (!resolved?.loggedIn) return;
		primeFromLocation(primaryClient(resolved.agent));
	});

	createEffect(() => {
		const resolved = client();
		if (client.loading) return;
		installQuitGuard(resolved?.loggedIn ? resolved.agent.did : undefined);
	});

	createEffect(() => {
		const resolved = client();
		if (!resolved || resolved.loggedIn || hasStoredSession()) return;
		void hasLeftoverPushRegistration().then((leftover) => {
			if (leftover) return teardownNotifications();
		});
	});

	return (
		<Switch>
			<Match when={sessionDead()}>
				<SessionExpiredRedirect />
			</Match>
			<Match when={client.loading}>
				<AppLoadingScreen message="Logging in..." phase="connecting" />
			</Match>
			<Match when={client()}>
				{(resolvedClient) => (
					<AuthContext.Provider value={resolvedClient()}>
						{props.children}
					</AuthContext.Provider>
				)}
			</Match>
			<Match when={!client.loading && !client() && !import.meta.env.DEV}>
				<AppViewUnreachableModal />
			</Match>
		</Switch>
	);
};

export const useAuthContext = (): Client => {
	const ctx = useContext(AuthContext);

	if (!ctx) {
		throw new Error("Unable to get auth context.");
	}

	return ctx;
};

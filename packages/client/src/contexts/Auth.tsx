import type { Agent } from "@atproto/api";
import {
	createContext,
	createEffect,
	createResource,
	Match,
	type ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { type Client, createEmbeddedClient, getClient } from "../atproto/auth";
import { primeFromLocation } from "../atproto/channel-prefetch";
import { XrpcClient } from "../atproto/xrpc";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { AppViewUnreachableModal } from "../components/app/AppViewUnreachableModal";
import { isEmbedded } from "../embed/runtime";
import {
	getAppViewHost,
	getAppViewServiceRef,
	verifyColibriAppView,
} from "../utils/appview";
import { reportPdsStatus } from "../utils/dev-diagnostics";
import { markBoot } from "../utils/perf";

export const AuthContext = createContext<Client>(undefined);

export const AuthContextProvider: ParentComponent<{
	agent?: Agent;
	scope?: string;
}> = (props) => {
	const [client] = createResource(() =>
		props.agent
			? Promise.resolve(createEmbeddedClient(props.agent, props.scope))
			: getClient(),
	);

	createEffect(() => {
		if (!client.loading) markBoot("auth:ready");
	});

	createEffect(() => {
		const resolved = client();
		if (!resolved?.loggedIn) return;
		if (isEmbedded()) return;
		primeFromLocation(new XrpcClient(getAppViewServiceRef(), resolved.agent));
	});

	// An AppView with no usable PDS serves every read fine and fails every
	// write. Ask once at startup so that shows up before the first one does.
	if (import.meta.env.DEV) {
		void verifyColibriAppView(getAppViewHost("http")).then((description) =>
			reportPdsStatus(description?.pds),
		);
	}

	return (
		<Switch>
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

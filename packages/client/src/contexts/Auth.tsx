import {
	createContext,
	createEffect,
	createResource,
	Match,
	type ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { type Client, getClient } from "../atproto/auth";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { AppViewUnreachableModal } from "../components/app/AppViewUnreachableModal";
import { getAppViewHost, verifyColibriAppView } from "../utils/appview";
import { reportPdsStatus } from "../utils/dev-diagnostics";
import { markBoot } from "../utils/perf";

export const AuthContext = createContext<Client>(undefined);

export const AuthContextProvider: ParentComponent = (props) => {
	const [client] = createResource(getClient);

	createEffect(() => {
		if (!client.loading) markBoot("auth:ready");
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
				<AppLoadingScreen message="Logging in..." />
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

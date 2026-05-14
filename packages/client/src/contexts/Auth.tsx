import {
	createContext,
	createResource,
	Match,
	ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { Client, getClient } from "../atproto/auth";
import { AppLoadingScreen } from "../components/AppLoadingScreen";

export const AuthContext = createContext<Client>(undefined);

export const AuthContextProvider: ParentComponent = (props) => {
	const [client] = createResource(getClient);

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

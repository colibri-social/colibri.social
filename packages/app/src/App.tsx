import { classifyThrown, createLogger } from "@colibri-social/lib";
import { ErrorBoundary, lazy, Match, Show, Suspense, Switch } from "solid-js";
import { createAuth } from "./auth";
import { AccountActionsContext } from "./auth/account-actions";
import { LiveStatusContext } from "./data/live-context";
import { createMockSource } from "./data/mock/source";
import { createDataStore, DataContext, type DataStore } from "./data/store";
import { installNativeCall } from "./native/call";
import { Providers } from "./providers";
import { usePlatform } from "./screen/platform";
import { ProfileGate } from "./screens/onboarding/ProfileGate";
import { AuthGate } from "./screens/signin/AuthGate";
import { createSignedInSession } from "./session";
import { ColdStart } from "./shell/boot-gate";
import { LaunchScreen } from "./shell/launch/LaunchScreen";
import { StartupError } from "./shell/launch/StartupError";
import { MobileShell } from "./shell/MobileShell";
import { ThemeSync } from "./shell/theme-sync";

const DesktopShell = lazy(() =>
	import("./shell/desktop/DesktopShell").then((module) => ({
		default: module.DesktopShell,
	})),
);

const useMock = import.meta.env.VITE_COLIBRI_MOCK === "1";

const log = createLogger("app");

const Shells = (props: { store: DataStore }) => {
	const platform = usePlatform();
	return (
		<DataContext.Provider value={props.store}>
			<ThemeSync />
			<Show when={platform() === "desktop"} fallback={<MobileShell />}>
				<Suspense fallback={<LaunchScreen />}>
					<DesktopShell />
				</Suspense>
			</Show>
		</DataContext.Provider>
	);
};

const MockApp = () => {
	const store = createDataStore(createMockSource());
	installNativeCall(store);
	return <Shells store={store} />;
};

const SignedInApp = (props: {
	session: ReturnType<typeof createSignedInSession>;
}) => {
	const state = () => props.session.state();
	return (
		<Switch fallback={<LaunchScreen />}>
			<Match
				when={(() => {
					const current = state();
					return current.kind === "failed" ? current : undefined;
				})()}
			>
				{(failed) => (
					<StartupError error={failed().error} onRetry={props.session.retry} />
				)}
			</Match>
			<Match
				when={(() => {
					const current = state();
					return current.kind === "ready" ? current.session : undefined;
				})()}
				keyed
			>
				{(session) => (
					<LiveStatusContext.Provider value={session.live}>
						<ProfileGate store={session.store}>
							<Show
								when={session.warm}
								fallback={
									<ColdStart store={session.store}>
										<Shells store={session.store} />
									</ColdStart>
								}
							>
								<Shells store={session.store} />
							</Show>
						</ProfileGate>
					</LiveStatusContext.Provider>
				)}
			</Match>
		</Switch>
	);
};

const RemoteApp = () => {
	const platform = usePlatform();
	const auth = createAuth();
	const session = createSignedInSession(auth);
	return (
		<AuthGate auth={auth} platform={platform()}>
			<AccountActionsContext.Provider value={{ signOut: auth.signOut }}>
				<SignedInApp session={session} />
			</AccountActionsContext.Provider>
		</AuthGate>
	);
};

const AppCrashed = (props: { thrown: unknown }) => {
	const error = classifyThrown(props.thrown, { method: "app.render" });
	log.error("the app stopped rendering", { code: error.code });
	return (
		<StartupError error={error} onRetry={() => window.location.reload()} />
	);
};

export const App = () => (
	<Providers>
		<ErrorBoundary fallback={(thrown) => <AppCrashed thrown={thrown} />}>
			<Show when={useMock} fallback={<RemoteApp />}>
				<MockApp />
			</Show>
		</ErrorBoundary>
	</Providers>
);

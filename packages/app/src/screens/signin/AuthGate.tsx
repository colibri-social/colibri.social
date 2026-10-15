import type { OnboardingPlatform } from "@colibri-social/ui";
import { createEffect, type JSX, Match, onMount, Show, Switch } from "solid-js";
import type { Auth } from "../../auth/auth";
import type { AccountSuggestion } from "../../auth/identity";
import { WindowChrome } from "../../shell/desktop/TitleBar";
import { LaunchScreen } from "../../shell/launch/LaunchScreen";
import { StartupError } from "../../shell/launch/StartupError";
import { ReapproveScreen, SignInFlow, SigningInScreen } from "./SignIn";

export type AuthGateProps = {
	auth: Auth;
	platform: OnboardingPlatform;
	search?: (query: string, signal: AbortSignal) => Promise<AccountSuggestion[]>;
	signupPds?: string | null;
	checkSignup?: (pdsUrl: string) => Promise<boolean>;
	children: JSX.Element;
};

export const AuthGate = (props: AuthGateProps) => {
	onMount(() => void props.auth.init());

	createEffect(() => {
		const status = props.auth.status();
		if (status === "signedOut" || status === "expired") {
			props.auth.redirectToSignIn();
		}
	});

	const inApp = () =>
		props.auth.status() === "signedIn" &&
		props.auth.missingScopes().length === 0;

	return (
		<>
			<Show
				when={
					props.platform === "desktop" &&
					!inApp() &&
					props.auth.status() !== "failed"
				}
			>
				<WindowChrome />
			</Show>
			<Switch
				fallback={
					<SignInFlow
						auth={props.auth}
						platform={props.platform}
						search={props.search}
						signupPds={props.signupPds}
						checkSignup={props.checkSignup}
					/>
				}
			>
				<Match when={props.auth.status() === "loading"}>
					<LaunchScreen />
				</Match>
				<Match
					when={props.auth.status() === "failed" && props.auth.startupError()}
				>
					{(error) => (
						<StartupError error={error()} onRetry={props.auth.retryInit} />
					)}
				</Match>
				<Match when={props.auth.status() === "completing"}>
					<SigningInScreen platform={props.platform} />
				</Match>
				<Match
					when={
						props.auth.status() === "signedIn" &&
						props.auth.missingScopes().length > 0
					}
				>
					<ReapproveScreen auth={props.auth} platform={props.platform} />
				</Match>
				<Match when={props.auth.status() === "signedIn"}>
					{props.children}
				</Match>
			</Switch>
		</>
	);
};

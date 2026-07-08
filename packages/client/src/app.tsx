import "./sentry";

import "@arborium/arborium/themes/base.css";
import "@arborium/arborium/themes/tokyo-night.css";
import { ColorModeProvider } from "@kobalte/core/color-mode";
import * as Sentry from "@sentry/solid";

// The app is always dark-themed (no light mode toggle), but arborium's
// theme CSS otherwise falls back to `prefers-color-scheme`, which would
// pick the wrong palette for users on a light OS theme. Force it explicitly.
if (typeof document !== "undefined") {
	document.documentElement.dataset.theme = "dark";
}

import { withSentryRouterRouting } from "@sentry/solid/solidrouter";
import { Route, Router, useNavigate, useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	ErrorBoundary,
	onMount,
	type ParentComponent,
	Show,
} from "solid-js";
import { urlSegmentToUri } from "./atproto/community-uri-to-url-compatible";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { InviteModal } from "./components/app/community/InviteModal";
import { ScopeGate } from "./components/app/onboarding/ScopeGate";
import { VoiceChannelView } from "./components/app/VoiceChannelView";
import { LoginScreen } from "./components/LoginScreen";
import { Toaster } from "./components/ui/Sonner";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { AuthContextProvider } from "./contexts/Auth";
import { useCommunityContext } from "./contexts/Community";
import { SocketContextProvider } from "./contexts/Socket";
import { UserContextProvider } from "./contexts/User";
import { UserPreferencesContextProvider } from "./contexts/UserPreferences";
import { VoiceChatContextProvider } from "./contexts/VoiceChat";
import AppLayout from "./layouts/AppLayout";
import ChannelLayoutWithContext from "./layouts/ChannelLayout";
import CommunityLayoutWithContext from "./layouts/CommunityLayout";
import { AtURI } from "./utils/at-uri";
import { isMobileNow, useIsMobile } from "./utils/mobile-pane";

// Accepted forms of the `:channelType` URL segment. We accept both the
// short form (legacy records that store `"text"` / `"voice"`) and the full
// NSID (`"social.colibri.channel.text"` / `"social.colibri.channel.voice"`)
// — see the `props.channel.type === ...` checks in Category.tsx for the
// same dual-form handling. Add new variants here when introducing new
// channel kinds.
const TEXT_CHANNEL_TYPES = ["text", "social.colibri.channel.text"];
const VOICE_CHANNEL_TYPES = ["voice", "social.colibri.channel.voice"];

const AppRoute: ParentComponent = (props) => {
	return (
		<ScopeGate>
			<SocketContextProvider>
				<UserContextProvider>
					<VoiceChatContextProvider>
						<AppLayout>{props.children}</AppLayout>
					</VoiceChatContextProvider>
				</UserContextProvider>
			</SocketContextProvider>
		</ScopeGate>
	);
};

const RedirectToApp: Component = () => {
	const navigate = useNavigate();

	createEffect(() => {
		navigate("/app", { replace: true });
	});

	return <AppLoadingScreen message="Redirecting to app..." />;
};

const SentryErrorBoundary = Sentry.withSentryErrorBoundary(ErrorBoundary);
const SentryRouter = withSentryRouterRouting(Router);

const AppErrorScreen: Component<{ error: unknown; reset: () => void }> = (
	props,
) => {
	onMount(() => console.error("[App] Uncaught error:", props.error));
	return (
		<div class="w-full h-full absolute top-0 left-0 z-50 flex flex-col items-center justify-center gap-3 text-white select-none">
			<p class="text-base font-medium">
				Something went wrong. We've received a report and are working on a fix.
			</p>
			<button
				type="button"
				class="text-sm text-muted-foreground underline cursor-pointer"
				onClick={() => props.reset()}
			>
				Try again
			</button>
		</div>
	);
};

const App: ParentComponent = () => {
	const isMobile = useIsMobile();
	return (
		<SentryErrorBoundary
			fallback={(err: unknown, reset: () => void) => (
				<AppErrorScreen error={err} reset={reset} />
			)}
		>
			<UserPreferencesContextProvider>
				<AuthContextProvider>
					<ColorModeProvider>
						<Show
							when={isMobile()}
							fallback={<Toaster richColors position="bottom-right" />}
						>
							<Toaster richColors position="top-center" />
						</Show>
						<SentryRouter base="/">
							<Route path="/" component={RedirectToApp} />
							<Route path="/app/login" component={LoginScreen} />
							<Route path="/app" component={AppRoute}>
								<Route path="/" component={WelcomeScreen} />
								<Route path="/invite/:code" component={InviteModal} />
								<Route component={CommunityLayoutWithContext}>
									<Route
										path="/c/:community"
										component={() => {
											const params = useParams();
											const navigate = useNavigate();
											const c = useCommunityContext();
											const communityUrlSeg = () => params.community!;

											createEffect(() => {
												// On mobile the community placeholder IS the nav-root
												// pane, don't auto-redirect into a channel. The user
												// taps a channel to push into chat.
												if (isMobileNow()) return;

												if (
													c().community.uri !==
													urlSegmentToUri(communityUrlSeg())
												)
													return;

												const raw = localStorage.getItem(
													`${communityUrlSeg()}:last-viewed`,
												);

												if (raw) {
													try {
														const channel = JSON.parse(raw) as {
															uri: string;
															type: string;
														};
														if (
															c().channels.some((ch) => ch.uri === channel.uri)
														) {
															navigate(
																`/app/c/${communityUrlSeg()}/${channel.type}/${new AtURI(channel.uri).identifier}`,
															);
															return;
														}
													} catch {}
												}

												const firstChannel = c().channels[0];
												if (!firstChannel) return;

												navigate(
													`/app/c/${communityUrlSeg()}/${firstChannel.type}/${new AtURI(firstChannel.uri).identifier}`,
												);
											});

											return (
												<div class="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground select-none">
													<p class="text-base font-medium">
														Select a channel to get started
													</p>
												</div>
											);
										}}
									/>
									<Route component={ChannelLayoutWithContext}>
										<Route
											path="/c/:community/:channelType/:channel"
											matchFilters={{ channelType: TEXT_CHANNEL_TYPES }}
											component={() =>
												null
											} /* ChannelLayout renders the message list; leaf is empty until a TextChannelView is needed */
										/>
									</Route>
									<Route
										path="/c/:community/:channelType/:channel"
										matchFilters={{ channelType: VOICE_CHANNEL_TYPES }}
										component={VoiceChannelView}
									/>
								</Route>
							</Route>
						</SentryRouter>
					</ColorModeProvider>
				</AuthContextProvider>
			</UserPreferencesContextProvider>
		</SentryErrorBoundary>
	);
};

export default App;

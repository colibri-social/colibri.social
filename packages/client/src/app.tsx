import "@arborium/arborium/themes/base.css";
import "@arborium/arborium/themes/github-light.css";
import "@arborium/arborium/themes/tokyo-night.css";
import { withSentryRouterRouting } from "@sentry/solid/solidrouter";
import { Route, Router, useNavigate, useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createSignal,
	ErrorBoundary,
	onMount,
	type ParentComponent,
	Show,
} from "solid-js";
import { urlSegmentToUri } from "./atproto/community-uri-to-url-compatible";
import { OutboxController } from "./atproto/outbox/OutboxController";
import { initSessionDebug } from "./atproto/session-debug";
import { sessionDead } from "./atproto/session-health";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { AutoUpdater } from "./components/app/AutoUpdater";
import { DeleteAccountScreen } from "./components/app/account/DeleteAccountScreen";
import { InviteModal } from "./components/app/community/InviteModal";
import { ScopeGate } from "./components/app/onboarding/ScopeGate";
import { SessionExpiredRedirect } from "./components/app/SessionExpiredRedirect";
import { TitleBar } from "./components/app/titlebar";
import { VoiceChannelView } from "./components/app/VoiceChannelView";
import { DeepLinkListener } from "./components/DeepLinkListener";
import { ErrorDetails } from "./components/ErrorDetails";
import { BootOverlay } from "./components/hummingbird";
import { SectionBoundary } from "./components/SectionBoundary";
import { SignInScreen } from "./components/signin/SignInScreen";
import { ThemeController } from "./components/ThemeController";
import { Toaster } from "./components/ui/Sonner";
import { WaitlistScreen } from "./components/WaitlistScreen";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ActorCacheProvider } from "./contexts/ActorCache";
import { AuthContextProvider } from "./contexts/Auth";
import { useCommunityContext } from "./contexts/Community";
import { SocketContextProvider } from "./contexts/Socket";
import { SoundsContextProvider } from "./contexts/Sounds";
import { UserContextProvider } from "./contexts/User";
import { UserPreferencesContextProvider } from "./contexts/UserPreferences";
import { ViewportProvider } from "./contexts/Viewport";
import { VoiceChatContextProvider } from "./contexts/VoiceChat";
import NotFound from "./errors/404";
import { classifyThrown } from "./errors/classify";
import { describeError } from "./errors/copy";
import { reportError } from "./errors/report";
import AppLayout from "./layouts/AppLayout";
import ChannelLayoutWithContext from "./layouts/ChannelLayout";
import CommunityLayoutWithContext from "./layouts/CommunityLayout";
import { appShellMounted } from "./utils/app-shell";
import { AtURI } from "./utils/at-uri";
import { createLogger } from "./utils/logger";
import { isMobileNow, useIsMobile } from "./utils/mobile-pane";
import { trackNavHistory } from "./utils/nav-history";
import { isDesktopNative } from "./utils/platform";
import { initTheme } from "./utils/theme";
import { initTitleBar } from "./utils/titlebar";

initTheme();
initTitleBar();
initSessionDebug();

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
					<OutboxController>
						<ActorCacheProvider>
							<SoundsContextProvider>
								<VoiceChatContextProvider>
									<ViewportProvider>
										<AppLayout>{props.children}</AppLayout>
									</ViewportProvider>
								</VoiceChatContextProvider>
							</SoundsContextProvider>
						</ActorCacheProvider>
					</OutboxController>
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

const SignInRoute: Component = () => <SignInScreen />;

const SignUpRoute: Component = () => <SignInScreen mode="signup" />;

const log = createLogger("app");

const SentryRouter = withSentryRouterRouting(Router);

const AppErrorScreen: Component<{ error: unknown; reset: () => void }> = (
	props,
) => {
	const [eventId, setEventId] = createSignal<string | undefined>(undefined);

	const failure = () => classifyThrown(props.error);
	const copy = () => describeError(props.error);

	onMount(() => {
		if (sessionDead()) {
			log.warn("render failed after the session ended", {
				code: failure().code,
			});
			return;
		}
		log.error("uncaught render error", { code: failure().code });
		setEventId(
			reportError(props.error, { stage: "render", severity: "fatal" }).eventId,
		);
	});

	return (
		<Show when={!sessionDead()} fallback={<SessionExpiredRedirect />}>
			<div class="w-full h-full absolute top-0 left-0 z-50 flex flex-col items-center justify-center gap-3 px-6 text-foreground select-none">
				<p class="text-base font-medium m-0 text-center">{copy().title}</p>
				<Show when={copy().description}>
					<p class="text-sm text-muted-foreground m-0 text-center">
						{copy().description}
					</p>
				</Show>
				<button
					type="button"
					class="text-sm text-muted-foreground underline cursor-pointer"
					onClick={() => props.reset()}
				>
					Try again
				</button>
				<ErrorDetails code={failure().code} eventId={eventId()} />
			</div>
		</Show>
	);
};

// Rendered inside the router (so it has routing context) around every route,
// hosting global listeners like deep-link handling that must work regardless of
// the current screen (e.g. an invite link opened on the login screen)
const RootLayout: ParentComponent = (props) => {
	trackNavHistory();

	return (
		<>
			<DeepLinkListener />
			<AutoUpdater />
			<Show when={isDesktopNative() && !appShellMounted()}>
				<TitleBar variant="bare" />
			</Show>
			{props.children}
		</>
	);
};

const App: ParentComponent = () => {
	const isMobile = useIsMobile();
	return (
		<>
			<Show
				when={isMobile()}
				fallback={<Toaster richColors position="bottom-right" />}
			>
				<Toaster
					richColors
					position="top-center"
					offset="max(32px,var(--safe-area-top))"
				/>
			</Show>
			<BootOverlay />
			<ErrorBoundary
				fallback={(err: unknown, reset: () => void) => (
					<AppErrorScreen error={err} reset={reset} />
				)}
			>
				<UserPreferencesContextProvider>
					<ThemeController />
					<AuthContextProvider>
						<SentryRouter root={RootLayout} base="/">
							<Route path="/" component={RedirectToApp} />
							<Route path="/app/login" component={SignInRoute} />
							<Route path="/app/register" component={SignUpRoute} />
							<Route path="/app/waitlist" component={WaitlistScreen} />
							<Route path="/app" component={AppRoute}>
								<Route path="/" component={WelcomeScreen} />
								<Route path="/invite/:code" component={InviteModal} />
								<Route path="/delete-account" component={DeleteAccountScreen} />
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
																{ replace: true },
															);
															return;
														}
													} catch {}
												}

												const firstChannel = c().channels[0];
												if (!firstChannel) return;

												navigate(
													`/app/c/${communityUrlSeg()}/${firstChannel.type}/${new AtURI(firstChannel.uri).identifier}`,
													{ replace: true },
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
										component={() => (
											<SectionBoundary name="voice">
												<VoiceChannelView />
											</SectionBoundary>
										)}
									/>
								</Route>
							</Route>
							<Route path="*" component={NotFound} />
						</SentryRouter>
					</AuthContextProvider>
				</UserPreferencesContextProvider>
			</ErrorBoundary>
		</>
	);
};

export default App;

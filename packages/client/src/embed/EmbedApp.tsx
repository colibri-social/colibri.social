import {
	createMemoryHistory,
	MemoryRouter,
	Route,
	useLocation,
	useNavigate,
	useParams,
} from "@solidjs/router";
import {
	type Component,
	createEffect,
	ErrorBoundary,
	onMount,
	type ParentComponent,
	Show,
} from "solid-js";
import { OutboxController } from "../atproto/outbox/OutboxController";
import { ScopeGate } from "../components/app/onboarding/ScopeGate";
import { VoiceChannelView } from "../components/app/VoiceChannelView";
import { ErrorDetails } from "../components/ErrorDetails";
import { SectionBoundary } from "../components/SectionBoundary";
import { Toaster } from "../components/ui/Sonner";
import { ActorCacheProvider } from "../contexts/ActorCache";
import { AuthContextProvider } from "../contexts/Auth";
import { useCommunityContext } from "../contexts/Community";
import { SocketContextProvider } from "../contexts/Socket";
import { SoundsContextProvider } from "../contexts/Sounds";
import { UserContextProvider } from "../contexts/User";
import { UserPreferencesContextProvider } from "../contexts/UserPreferences";
import { ViewportProvider } from "../contexts/Viewport";
import { VoiceChatContextProvider } from "../contexts/VoiceChat";
import { classifyThrown } from "../errors/classify";
import { describeError } from "../errors/copy";
import AppLayout from "../layouts/AppLayout";
import ChannelLayoutWithContext from "../layouts/ChannelLayout";
import CommunityLayoutWithContext from "../layouts/CommunityLayout";
import { AtURI } from "../utils/at-uri";
import { createLogger } from "../utils/logger";
import { isMobileNow } from "../utils/mobile-pane";
import { type EmbedRuntime, EmbedRuntimeProvider } from "./context";
import { EmbedEventBridge } from "./EmbedEventBridge";

const log = createLogger("embed");

const TEXT_CHANNEL_TYPES = ["text", "social.colibri.channel.text"];
const VOICE_CHANNEL_TYPES = ["voice", "social.colibri.channel.voice"];

const CHANNEL_PATH = /^\/app\/c\/[^/]+\/[^/]+\/([^/]+)/;

const EmbedErrorScreen: Component<{ error: unknown; reset: () => void }> = (
	props,
) => {
	const failure = () => classifyThrown(props.error);
	const copy = () => describeError(props.error);

	onMount(() => {
		log.error("uncaught render error", { code: failure().code });
	});

	return (
		<div class="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center select-none">
			<p class="text-base font-medium m-0">{copy().title}</p>
			<Show when={copy().description}>
				<p class="text-sm text-muted-foreground m-0">{copy().description}</p>
			</Show>
			<button
				type="button"
				class="text-sm text-muted-foreground underline cursor-pointer"
				onClick={() => props.reset()}
			>
				Try again
			</button>
			<ErrorDetails code={failure().code} />
		</div>
	);
};

const NavigationBridge: Component<{ runtime: EmbedRuntime }> = (props) => {
	const navigate = useNavigate();
	const location = useLocation();

	props.runtime.goToChannel = (rkey, type = "text") => {
		navigate(`/app/c/${props.runtime.communitySegment}/${type}/${rkey}`);
	};

	createEffect(() => {
		const channel = CHANNEL_PATH.exec(location.pathname)?.[1];
		props.runtime.emitter.emit({
			kind: "navigation",
			community: props.runtime.communityUri,
			channel,
		});
	});

	return null;
};

const ChannelPicker: Component<{ runtime: EmbedRuntime }> = (props) => {
	const params = useParams();
	const community = useCommunityContext();

	createEffect(() => {
		if (isMobileNow()) return;
		if (!params.community) return;

		const channels = community().channels;
		if (channels.length === 0) return;

		const wanted = props.runtime.config.channel;
		const target =
			channels.find((c) => new AtURI(c.uri).identifier === wanted) ??
			channels[0];
		if (!target) return;

		props.runtime.goToChannel?.(new AtURI(target.uri).identifier, target.type);
	});

	return (
		<div class="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground select-none">
			<p class="text-base font-medium">Select a channel to get started</p>
		</div>
	);
};

const EmbedShell: ParentComponent<{ runtime: EmbedRuntime }> = (props) => (
	<ScopeGate>
		<SocketContextProvider>
			<UserContextProvider>
				<OutboxController>
					<ActorCacheProvider>
						<SoundsContextProvider>
							<VoiceChatContextProvider>
								<ViewportProvider>
									<EmbedEventBridge />
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

export const EmbedApp: Component<{ runtime: EmbedRuntime }> = (props) => {
	const base = `/app/c/${props.runtime.communitySegment}`;
	const channel = props.runtime.config.channel;

	const history = createMemoryHistory();
	history.set({
		value: channel ? `${base}/text/${channel}` : base,
		replace: true,
	});

	const shell: ParentComponent = (shellProps) => (
		<EmbedShell runtime={props.runtime}>{shellProps.children}</EmbedShell>
	);

	return (
		<EmbedRuntimeProvider runtime={props.runtime}>
			<Toaster richColors position="bottom-right" />
			<ErrorBoundary
				fallback={(err: unknown, reset: () => void) => (
					<EmbedErrorScreen error={err} reset={reset} />
				)}
			>
				<UserPreferencesContextProvider>
					<AuthContextProvider
						agent={props.runtime.config.agent}
						scope={props.runtime.config.scope}
					>
						<MemoryRouter
							history={history}
							root={(rootProps) => (
								<>
									<NavigationBridge runtime={props.runtime} />
									{rootProps.children}
								</>
							)}
						>
							<Route path="/app" component={shell}>
								<Route component={CommunityLayoutWithContext}>
									<Route
										path="/c/:community"
										component={() => <ChannelPicker runtime={props.runtime} />}
									/>
									<Route component={ChannelLayoutWithContext}>
										<Route
											path="/c/:community/:channelType/:channel"
											matchFilters={{ channelType: TEXT_CHANNEL_TYPES }}
											component={() => null}
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
						</MemoryRouter>
					</AuthContextProvider>
				</UserPreferencesContextProvider>
			</ErrorBoundary>
		</EmbedRuntimeProvider>
	);
};

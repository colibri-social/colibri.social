import { ColorModeProvider } from "@kobalte/core/color-mode";
import { Route, Router, useNavigate, useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	onMount,
	type ParentComponent,
} from "solid-js";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { VoiceChannelView } from "./components/app/VoiceChannelView";
import { LoginScreen } from "./components/LoginScreen";
import { Toaster } from "./components/ui/Sonner";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { AuthContextProvider } from "./contexts/Auth";
import { SocketContextProvider } from "./contexts/Socket";
import { UserContextProvider } from "./contexts/User";
import { VoiceChatContextProvider } from "./contexts/VoiceChat";
import AppLayout from "./layouts/AppLayout";
import ChannelLayoutWithContext from "./layouts/ChannelLayout";
import CommunityLayoutWithContext from "./layouts/CommunityLayout";
import { getCommunityParam } from "./utils/get-param";
import { urlSegmentToUri } from "./atproto/community-uri-to-url-compatible";
import { useCommunityContext } from "./contexts/Community";
import { AtURI } from "./utils/at-uri";

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
		<SocketContextProvider>
			<UserContextProvider>
				<VoiceChatContextProvider>
					<AppLayout>{props.children}</AppLayout>
				</VoiceChatContextProvider>
			</UserContextProvider>
		</SocketContextProvider>
	);
};

const RedirectToApp: Component = () => {
	const navigate = useNavigate();

	createEffect(() => {
		navigate("/app", { replace: true });
	});

	return <AppLoadingScreen message="Redirecting to app..." />;
};

const App: ParentComponent = () => {
	return (
		<AuthContextProvider>
			<ColorModeProvider>
				<Toaster richColors position="bottom-right" />
				<Router base="/">
					<Route path="/" component={RedirectToApp} />
					<Route path="/app/login" component={LoginScreen} />
					<Route path="/app" component={AppRoute}>
						<Route path="/" component={WelcomeScreen} />
						<Route component={CommunityLayoutWithContext}>
							<Route
								path="/c/:community"
								component={() => {
									const params = useParams();
									const navigate = useNavigate();
									const c = useCommunityContext();
									const communityUrlSeg = () => params.community!;

									onMount(() => {
										const mostRecentChannel = localStorage.getItem(
											`${communityUrlSeg()}:last-viewed`,
										);

										if (!mostRecentChannel) {
											const firstChannel = c().channels[0];

											navigate(
												`/app/c/${communityUrlSeg()}/${firstChannel.type}/${new AtURI(firstChannel.uri).identifier}`,
											);

											return;
										}

										const channel: { uri: string; type: string } =
											JSON.parse(mostRecentChannel);

										navigate(
											`/app/c/${communityUrlSeg()}/${channel.type}/${new AtURI(channel.uri).identifier}`,
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
				</Router>
			</ColorModeProvider>
		</AuthContextProvider>
	);
};

export default App;

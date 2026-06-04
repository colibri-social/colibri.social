import { Component, createEffect, ParentComponent } from "solid-js";
import { UserContextProvider } from "./contexts/User";
import { ColorModeProvider } from "@kobalte/core/color-mode";
import { Toaster } from "./components/ui/Sonner";
import { Route, Router, useLocation, useNavigate } from "@solidjs/router";
import AppLayout from "./layouts/AppLayout";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LoginScreen } from "./components/LoginScreen";
import { AuthContextProvider } from "./contexts/Auth";
import { SocketContextProvider } from "./contexts/Socket";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import CommunityLayoutWithContext from "./layouts/CommunityLayout";
import ChannelLayoutWithContext from "./layouts/ChannelLayout";
import { VoiceChannelView } from "./components/app/VoiceChannelView";

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
		<UserContextProvider>
			<SocketContextProvider>
				<AppLayout>{props.children}</AppLayout>
			</SocketContextProvider>
		</UserContextProvider>
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
					<Route path="/login" component={LoginScreen} />
					<Route path="/app" component={AppRoute}>
						<Route path="/" component={WelcomeScreen} />
						<Route component={CommunityLayoutWithContext}>
							<Route
								path="/c/:community"
								component={() => (
									<div class="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground select-none">
										<p class="text-base font-medium">Select a channel to get started</p>
									</div>
								)}
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

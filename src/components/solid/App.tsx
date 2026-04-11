import { ColorModeProvider } from "@kobalte/core";
import { Route, Router } from "@solidjs/router";
import type { CommunityData } from "@/utils/sdk";
import { DevelopmentPlaceholder } from "./components/DevelopmentPlaceholder";
import { GlobalContextProvider } from "./contexts/GlobalContext";
import { VoiceChatContextProvider } from "./contexts/VoiceChatContext";
import AppLayout from "./layouts/AppLayout";
import CommunityLayout from "./layouts/CommunityLayout";
import { Toaster } from "./shadcn-solid/Sonner";
import ChannelView from "./views/ChannelView";
import VoiceChannelView from "./views/VoiceChannelView";

/**
 * The entrypoint to the main solid app.
 */
export const App = ({
	communities,
	user,
}: {
	communities: Array<CommunityData>;
	user: App.SessionData["user"];
}) => {
	return (
		<ColorModeProvider>
			<Toaster richColors position="bottom-right" />
			<GlobalContextProvider
				contextData={{
					communities,
					user,
				}}
			>
				<VoiceChatContextProvider>
					<Router base="/app">
						<Route component={AppLayout}>
							<Route path="/" component={() => <DevelopmentPlaceholder />} />
							<Route component={CommunityLayout}>
								<Route
									path="/c/:community"
									component={() => (
										<div class="w-full h-full flex items-center justify-center">
											{/* TODO(app): Make this a page people can configure? */}
											Select a channel to get started!
										</div>
									)}
								/>
								<Route
									path="/c/:community/t/:channel"
									component={ChannelView}
								/>
								<Route
									path="/c/:community/v/:channel"
									component={VoiceChannelView}
								/>
							</Route>
						</Route>
					</Router>
				</VoiceChatContextProvider>
			</GlobalContextProvider>
		</ColorModeProvider>
	);
};

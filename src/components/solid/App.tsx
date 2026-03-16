import { ColorModeProvider } from "@kobalte/core";
import { Route, Router } from "@solidjs/router";
import type { CommunityData } from "@/utils/sdk";
import { DevelopmentPlaceholder } from "./components/DevelopmentPlaceholder";
import { GlobalContextProvider } from "./contexts/GlobalContext";
import AppLayout from "./layouts/AppLayout";
import CommunityLayout from "./layouts/CommunityLayout";
import { Toaster } from "./shadcn-solid/Sonner";
import ChannelView from "./views/ChannelView";
import VoiceChannelView from "./views/VoiceChannelView";
import { VoiceChatContextProvider } from "./contexts/VoiceChatContext";

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
											Placeholder community page
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

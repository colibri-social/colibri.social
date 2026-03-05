import { Route, Router } from "@solidjs/router";
import { ColorModeProvider } from "@kobalte/core";
import type { CommunityData } from "@/utils/sdk";
import { DevelopmentPlaceholder } from "./components/DevelopmentPlaceholder";
import { GlobalContextProvider } from "./contexts/GlobalContext";
import AppLayout from "./layouts/AppLayout";
import CommunityLayout from "./layouts/CommunityLayout";
import ChannelView from "./views/ChannelView";
import { Toaster } from "./shadcn-solid/Sonner";

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
							<Route path="/c/:community/:channel" component={ChannelView} />
						</Route>
					</Route>
				</Router>
			</GlobalContextProvider>
		</ColorModeProvider>
	);
};

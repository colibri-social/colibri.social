import { ParentComponent, Suspense } from "solid-js";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { UserContextProvider } from "./contexts/User";
import { ColorModeProvider } from "@kobalte/core";
import { Toaster } from "./components/ui/Sonner";
import { Route, Router } from "@solidjs/router";
import AppLayout from "./layouts/AppLayout";
import { WelcomeScreen } from "./components/WelcomeScreen";

const App: ParentComponent = () => {
	return (
		<UserContextProvider>
			<ColorModeProvider>
				<Toaster richColors position="bottom-right" />

				<Router base="/app">
					<Route component={AppLayout}>
						<Route path="/" component={WelcomeScreen} />
						{/*<Route component={CommunityLayout}>
								<Route
									path="/c/:community"
									component={() => (
										<div class="w-full h-full flex items-center justify-center">
											TODO(app): Make this a page people can configure?
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
							</Route>*/}
					</Route>
				</Router>
			</ColorModeProvider>
		</UserContextProvider>
	);
};

export default App;

import { ParentComponent } from "solid-js";
import { UserContextProvider } from "./contexts/User";
import { ColorModeProvider } from "@kobalte/core";
import { Toaster } from "./components/ui/Sonner";
import { Route, Router } from "@solidjs/router";
import AppLayout from "./layouts/AppLayout";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LoginScreen } from "./components/LoginScreen";
import { AuthContextProvider } from "./contexts/Auth";
import { SocketContextProvider } from "./contexts/Socket";

const App: ParentComponent = () => {
	return (
		<AuthContextProvider>
			<ColorModeProvider>
				<Toaster richColors position="bottom-right" />
				<Router base="/">
					<Route path="/login" component={LoginScreen} />
					<SocketContextProvider>
						<Route component={UserContextProvider}>
							<Route path="/app" component={AppLayout}>
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
						</Route>
					</SocketContextProvider>
				</Router>
			</ColorModeProvider>
		</AuthContextProvider>
	);
};

export default App;

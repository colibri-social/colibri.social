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
						{/* TODO: */}
						<Route component={CommunityLayoutWithContext}>
							<Route
								path="/c/:community"
								component={() => (
									<div class="w-full h-full flex items-center justify-center">
										TODO(app): Make this a page people can configure? Select a
										channel to get started!
									</div>
								)}
							/>
							<Route
								path="/c/:community/t/:channel"
								component={() => <div>TextChannelView</div>} /* ChannelView */
							/>
							<Route
								path="/c/:community/v/:channel"
								component={() => (
									<div>VoiceChannelView</div>
								)} /* VoiceChannelView */
							/>
						</Route>
					</Route>
				</Router>
			</ColorModeProvider>
		</AuthContextProvider>
	);
};

export default App;

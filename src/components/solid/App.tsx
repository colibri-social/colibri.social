import { Route, Router } from "@solidjs/router";
import type { CommunityData } from "@/utils/sdk";
import { GlobalContextProvider } from "./contexts/GlobalContext";
import AppLayout from "./layouts/AppLayout";
import CommunityLayout from "./layouts/CommunityLayout";
import ChannelView from "./views/ChannelView";

export const App = ({ communities }: { communities: Array<CommunityData> }) => {
	return (
		<GlobalContextProvider
			contextData={{ communities, categories: [], channels: [] }}
		>
			<Router base="/app">
				<Route component={AppLayout}>
					<Route path="/" component={() => <div>App page</div>} />
					<Route component={CommunityLayout}>
						<Route
							path="/c/:community"
							component={() => <div>Community page</div>}
						/>
						<Route path="/c/:community/:channel" component={ChannelView} />
					</Route>
				</Route>
			</Router>
		</GlobalContextProvider>
	);
};

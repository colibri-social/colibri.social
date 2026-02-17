import { Router, Route } from '@solidjs/router';

import AppLayout from './AppLayout';
import CommunityView from './views/CommunityView';
import ChannelView from './views/ChannelView';

// TODO: For some godforsaken reason this doesn't work without the span children
export const App = () => (
	<Router base='/app'>
		<Route path="/" component={AppLayout}>
			<span class='test'>Test</span>
			<Route path="/c/:community" component={CommunityView}>
				<span class='test'>Test</span>
				<Route path="/:channel" component={ChannelView}>
					<span>Test</span>
				</Route>
			</Route>
		</Route>
	</Router>
)

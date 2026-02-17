import { Router, Route } from '@solidjs/router';

import AppLayout from './AppLayout';
import CommunityView from './views/CommunityView';
import ChannelView from './views/ChannelView';

export const App = () => (
	<Router base='/app'>
		<Route path="*" component={() => <div>Test</div>} />
	</Router>
)

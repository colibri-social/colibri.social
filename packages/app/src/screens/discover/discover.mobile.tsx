import { discover } from "./discover.contract";

export default discover.view({
	render: ({ slots: s }) => (
		<div data-discover="" class="flex min-h-0 flex-1 flex-col bg-background">
			<s.Directory />
		</div>
	),
});

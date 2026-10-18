import { LargeModalContent } from "@colibri-social/ui";
import { discover } from "./discover.contract";

export default discover.view({
	render: ({ slots: s }) => (
		<LargeModalContent title="Discover Spaces">
			<div data-discover="">
				<s.Directory platform="desktop" />
			</div>
		</LargeModalContent>
	),
});

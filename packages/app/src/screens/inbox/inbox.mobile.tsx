import { CollapsingTitleLayout } from "@colibri-social/ui";
import { inbox } from "./inbox.contract";

export default inbox.view({
	omit: ["Popover"],
	render: ({ slots: s }) => (
		<CollapsingTitleLayout
			title="Inbox"
			actions={<s.MarkAll />}
			safeTop
			contentClass="px-4 pb-28"
		>
			<div class="flex flex-col gap-4">
				<s.Filters />
				<s.Groups />
			</div>
		</CollapsingTitleLayout>
	),
});

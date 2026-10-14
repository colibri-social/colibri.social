import { CollapsingTitleLayout } from "@colibri-social/ui";
import { settings } from "./settings.contract";

export default settings.view({
	omit: ["Voice"] as const,
	render: ({ slots: s }) => (
		<CollapsingTitleLayout title="Settings" safeTop contentClass="px-4 pb-28">
			<div class="flex flex-col gap-6">
				<s.Appearance />
				<s.Controls />
				<s.Developer />
				<s.Simulation />
			</div>
		</CollapsingTitleLayout>
	),
});

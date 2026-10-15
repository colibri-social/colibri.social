import { settings } from "./settings.contract";

export default settings.view({
	omit: ["Header"] as const,
	hidden: ["Index"] as const,
	render: ({ slots: s, args }) => (
		<div data-settings-page={args.page} class="flex flex-col gap-6">
			<s.Page platform="desktop" />
			{args.page === "advanced" ? <s.Simulation /> : null}
		</div>
	),
});

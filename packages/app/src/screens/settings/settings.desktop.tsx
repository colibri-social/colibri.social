import { settings } from "./settings.contract";
import { SETTINGS_CONTENT_CLASS } from "./unsaved-form";

export default settings.view({
	omit: ["Header"] as const,
	hidden: ["Index"] as const,
	render: ({ slots: s, args }) => (
		<div data-settings-page={args.page} class={SETTINGS_CONTENT_CLASS}>
			<s.Page platform="desktop" />
			{args.page === "advanced" ? <s.Simulation /> : null}
		</div>
	),
});

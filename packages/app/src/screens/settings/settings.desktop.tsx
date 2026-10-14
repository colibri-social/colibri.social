import { Match, Switch } from "solid-js";
import { settings } from "./settings.contract";

export default settings.view({
	omit: ["Controls"] as const,
	hidden: ["Appearance", "Voice", "Developer", "Simulation"] as const,
	render: ({ slots: s, args }) => (
		<Switch>
			<Match when={args.page === "appearance"}>
				<div data-settings-page="appearance" class="flex flex-col gap-6">
					<s.Appearance />
				</div>
			</Match>
			<Match when={args.page !== "appearance"}>
				<div data-settings-page="advanced" class="flex flex-col gap-6">
					<s.Voice />
					<s.Developer />
					<s.Simulation />
				</div>
			</Match>
		</Switch>
	),
});

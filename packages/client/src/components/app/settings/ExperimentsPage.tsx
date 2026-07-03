import { type Component, For, Show } from "solid-js";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { EXPERIMENTS } from "../../../experiments";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import { SettingsPage } from "../common/SettingsModal";

export const ExperimentsPage: Component = () => {
	const { preferences, setExperiment } = useUserPreferences();

	return (
		<SettingsPage
			loading={() => false}
			title="Experiments"
			description="Opt in to features still in testing. They're unstable and may change or break at any time."
		>
			<Show
				when={EXPERIMENTS.length > 0}
				fallback={
					<span class="text-sm text-muted-foreground">
						No experiments available right now.
					</span>
				}
			>
				<For each={EXPERIMENTS}>
					{(experiment) => (
						<Switch
							class="flex flex-row items-center justify-between gap-4"
							checked={
								preferences().experiments[experiment.id] ??
								experiment.default ??
								false
							}
							onChange={(enabled) => setExperiment(experiment.id, enabled)}
						>
							<div class="flex flex-col gap-1">
								<SwitchLabel>{experiment.name}</SwitchLabel>
								<SwitchDescription class="max-w-120">
									{experiment.description}
								</SwitchDescription>
							</div>
							<SwitchControl>
								<SwitchThumb />
							</SwitchControl>
						</Switch>
					)}
				</For>
			</Show>
		</SettingsPage>
	);
};

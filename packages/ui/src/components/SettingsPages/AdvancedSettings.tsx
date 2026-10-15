import { For, Show } from "solid-js";
import { ListGroup, ToggleRow } from "../List/List";
import { SettingsEmpty, SettingsPage } from "./shared";

export type AdvancedSettingsProps = {
	developerMode: boolean;
	onDeveloperModeChange?: (enabled: boolean) => void;
	includeAccountInReports?: boolean;
	onIncludeAccountInReportsChange?: (enabled: boolean) => void;
	systemWindowControls?: boolean;
	onSystemWindowControlsChange?: (enabled: boolean) => void;
	class?: string;
};

export const AdvancedSettings = (props: AdvancedSettingsProps) => (
	<SettingsPage class={props.class}>
		<ListGroup label="Developer">
			<ToggleRow
				title="Developer mode"
				description="Shows identifiers and links to inspect records on PDSls."
				checked={props.developerMode}
				onChange={(checked) => props.onDeveloperModeChange?.(checked)}
			/>
		</ListGroup>
		<Show when={props.includeAccountInReports !== undefined}>
			<ListGroup label="Error reports">
				<ToggleRow
					title="Include my account in error reports"
					description="Adds your account to automatic error reports, so we can see how many people a problem affects and follow up with you. Reports are still sent without it."
					checked={props.includeAccountInReports}
					onChange={(checked) =>
						props.onIncludeAccountInReportsChange?.(checked)
					}
				/>
			</ListGroup>
		</Show>
		<Show when={props.systemWindowControls !== undefined}>
			<ListGroup label="Window">
				<ToggleRow
					title="Use system window controls"
					description="Lets your computer draw the window frame. Takes effect after a restart."
					checked={props.systemWindowControls}
					onChange={(checked) => props.onSystemWindowControlsChange?.(checked)}
				/>
			</ListGroup>
		</Show>
	</SettingsPage>
);

export type Experiment = {
	id: string;
	name: string;
	description: string;
	enabled: boolean;
};

export type ExperimentsSettingsProps = {
	experiments: Experiment[];
	onExperimentChange?: (id: string, enabled: boolean) => void;
	class?: string;
};

export const ExperimentsSettings = (props: ExperimentsSettingsProps) => (
	<SettingsPage
		class={props.class}
		intro="Try features that are still being tested. They can change or break at any time."
	>
		<Show
			when={props.experiments.length > 0}
			fallback={
				<SettingsEmpty>
					No experiments right now. Check back after the next update.
				</SettingsEmpty>
			}
		>
			<ListGroup label="Experiments">
				<For each={props.experiments}>
					{(experiment) => (
						<ToggleRow
							title={experiment.name}
							description={experiment.description}
							checked={experiment.enabled}
							onChange={(checked) =>
								props.onExperimentChange?.(experiment.id, checked)
							}
						/>
					)}
				</For>
			</ListGroup>
		</Show>
	</SettingsPage>
);

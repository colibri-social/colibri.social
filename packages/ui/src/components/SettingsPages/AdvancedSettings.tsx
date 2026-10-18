import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { For, Match, Show, Switch } from "solid-js";
import { DestructiveRow, ListGroup, NavRow, ToggleRow } from "../List/List";
import { SettingsEmpty, SettingsPage } from "./shared";

export type UpdateState =
	| { status: "idle" }
	| { status: "checking" }
	| { status: "up-to-date" }
	| { status: "downloading"; version: string }
	| { status: "ready"; version: string }
	| { status: "managed"; version: string; command: string }
	| { status: "error" };

export type UpdatesSection = {
	version: string;
	state: UpdateState;
	onCheck?: () => void;
	onRestart?: () => void;
};

const UpdateStatus = (props: { state: UpdateState }) => (
	<Switch fallback="Colibri checks for updates in the background.">
		<Match when={props.state.status === "checking"}>
			Checking for updates...
		</Match>
		<Match when={props.state.status === "up-to-date"}>
			You're on the latest version.
		</Match>
		<Match when={props.state.status === "downloading" && props.state} keyed>
			{(state) => `Downloading version ${state.version}...`}
		</Match>
		<Match when={props.state.status === "ready" && props.state} keyed>
			{(state) => `Version ${state.version} is ready. Restart to finish.`}
		</Match>
		<Match when={props.state.status === "managed" && props.state} keyed>
			{(state) => (
				<>
					Version {state.version} is out. Run{" "}
					<code class="font-mono text-foreground">{state.command}</code> to
					update.
				</>
			)}
		</Match>
		<Match when={props.state.status === "error"}>
			Couldn't check for updates. Check your connection and try again.
		</Match>
	</Switch>
);

const Updates = (props: { updates: UpdatesSection }) => (
	<ListGroup label="Updates">
		<div class="flex w-full shrink-0 flex-col gap-0.5 px-3 py-2">
			<span data-search-label="" class="text-sm font-semibold text-foreground">
				Version {props.updates.version}
			</span>
			<span data-search-description="" class="text-xs text-muted-foreground">
				<UpdateStatus state={props.updates.state} />
			</span>
		</div>
		<Show
			when={props.updates.state.status === "ready"}
			fallback={
				<NavRow
					label="Check for updates"
					keywords={["update", "version", "upgrade"]}
					chevron={false}
					disabled={
						props.updates.state.status === "checking" ||
						props.updates.state.status === "downloading"
					}
					onClick={() => props.updates.onCheck?.()}
				/>
			}
		>
			<NavRow
				label="Restart to update"
				keywords={["update", "restart"]}
				chevron={false}
				onClick={() => props.updates.onRestart?.()}
			/>
		</Show>
	</ListGroup>
);

export type AdvancedSettingsProps = {
	updates?: UpdatesSection;
	developerMode: boolean;
	onDeveloperModeChange?: (enabled: boolean) => void;
	includeAccountInReports?: boolean;
	onIncludeAccountInReportsChange?: (enabled: boolean) => void;
	systemWindowControls?: boolean;
	onSystemWindowControlsChange?: (enabled: boolean) => void;
	onDeleteAccount?: () => void;
	class?: string;
};

export const AdvancedSettings = (props: AdvancedSettingsProps) => (
	<SettingsPage class={props.class}>
		<Show when={props.updates}>
			{(updates) => <Updates updates={updates()} />}
		</Show>
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
					description="Lets your computer draw the window frame and its buttons."
					checked={props.systemWindowControls}
					onChange={(checked) => props.onSystemWindowControlsChange?.(checked)}
				/>
			</ListGroup>
		</Show>
		<Show when={props.onDeleteAccount}>
			<ListGroup label="Danger zone">
				<DestructiveRow
					icon={<TrashBinTrashIcon />}
					label="Delete my Colibri data"
					keywords={["delete account", "remove"]}
					onClick={() => props.onDeleteAccount?.()}
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

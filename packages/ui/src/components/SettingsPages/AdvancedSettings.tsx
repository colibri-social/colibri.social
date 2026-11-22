import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import {
	createEffect,
	createSignal,
	For,
	Match,
	on,
	Show,
	Switch,
} from "solid-js";
import { Button } from "../Button/Button";
import {
	type ExplorerTemplateProblem,
	explorerTemplateProblem,
	isRecordExplorerChoice,
	RECORD_EXPLORER_IDS,
	RECORD_EXPLORER_LINKS,
	type RecordExplorerChoice,
	RecordExplorerLogo,
} from "../DeveloperMode/record-explorer";
import { DestructiveRow, ListGroup, NavRow, ToggleRow } from "../List/List";
import {
	Select,
	type SelectOption,
	type SelectPlatform,
} from "../Select/Select";
import { TextField } from "../TextField/TextField";
import { FEEDBACK_URL } from "./links";
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

const explorerOptions = (): SelectOption[] => {
	return [
		...RECORD_EXPLORER_IDS.map((id) => ({
			value: id,
			label: RECORD_EXPLORER_LINKS[id].name,
			icon: () => <RecordExplorerLogo explorer={id} class="size-4" />,
		})),
		{
			value: "custom",
			label: "Custom",
			icon: () => <RecordExplorerLogo explorer="custom" class="size-4" />,
		},
	];
};

const TEMPLATE_PROBLEM_COPY: Record<ExplorerTemplateProblem, string> = {
	empty: "Enter a link to use.",
	invalidUrl: "This isn't a full link. Start it with https://.",
	unsupportedProtocol: "Use a link that starts with https:// or http://.",
	missingIdentifier:
		"Add {uri}, {uri:bare}, {authority} or {repo} so the link can point somewhere.",
	unknownPlaceholder:
		"Use only {uri}, {uri:bare}, {authority}, {spaceType}, {spaceKey}, {repo}, {collection} and {rkey} in curly braces.",
};

const CustomExplorerTemplate = (props: {
	template: string;
	onSave: (template: string) => void;
}) => {
	const [draft, setDraft] = createSignal(props.template);
	const [problem, setProblem] = createSignal<ExplorerTemplateProblem>();

	createEffect(
		on(
			() => props.template,
			(saved) => setDraft(saved),
			{ defer: true },
		),
	);

	const changed = () => draft().trim() !== props.template.trim();

	const save = () => {
		const found = explorerTemplateProblem(draft());

		setProblem(found);

		if (!found && changed()) props.onSave(draft().trim());
	};

	return (
		<form
			class="flex flex-col"
			onSubmit={(event) => {
				event.preventDefault();
				save();
			}}
		>
			<TextField
				label="Explorer link"
				description="Use {uri}, {uri:bare}, {authority}, {spaceType}, {spaceKey}, {repo}, {collection} and {rkey} where the record goes. In a Space, {authority} is the Space owner and {repo} is the author."
				error={problem() && TEMPLATE_PROBLEM_COPY[problem() ?? "empty"]}
				value={draft()}
				onChange={(value) => {
					setDraft(value);
					setProblem(undefined);
				}}
				placeholder="https://pdsls.dev/{uri}"
				inputMode="url"
				autocomplete="off"
				trailingAction={
					<Button type="submit" variant="secondary" disabled={!changed()}>
						Save
					</Button>
				}
			/>
		</form>
	);
};

export type AdvancedSettingsProps = {
	updates?: UpdatesSection;
	developerMode: boolean;
	onDeveloperModeChange?: (enabled: boolean) => void;
	recordExplorer?: RecordExplorerChoice;
	onRecordExplorerChange?: (explorer: RecordExplorerChoice) => void;
	customExplorerTemplate?: string;
	onCustomExplorerTemplateSave?: (template: string) => void;
	platform?: SelectPlatform;
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
				description="Shows identifiers and links to inspect records."
				checked={props.developerMode}
				onChange={(checked) => props.onDeveloperModeChange?.(checked)}
			/>
		</ListGroup>
		<Show when={props.developerMode && props.onRecordExplorerChange}>
			<section data-record-explorer-settings="" class="flex flex-col gap-2">
				<Select
					platform={props.platform}
					options={explorerOptions()}
					value={props.recordExplorer ?? "pdsls"}
					onChange={(value) => {
						if (isRecordExplorerChoice(value)) {
							props.onRecordExplorerChange?.(value);
						}
					}}
					label="Open records in"
					description="The site that developer mode links open identifiers and records on."
				/>
				<Show when={props.recordExplorer === "custom"}>
					<CustomExplorerTemplate
						template={props.customExplorerTemplate ?? ""}
						onSave={(template) =>
							props.onCustomExplorerTemplateSave?.(template)
						}
					/>
				</Show>
				<p class="text-xs text-muted-foreground">
					Missing an explorer? Suggest it on the{" "}
					<a
						href={FEEDBACK_URL}
						target="_blank"
						rel="noreferrer"
						class="rounded-control-xs font-semibold text-primary-highlight hover:underline focus-ring"
					>
						feedback board
					</a>
					.
				</p>
			</section>
		</Show>
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

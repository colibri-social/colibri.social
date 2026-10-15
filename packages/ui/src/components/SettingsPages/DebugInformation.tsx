import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { For, Match, Show, Switch } from "solid-js";
import { Button } from "../Button/Button";
import { ListGroup } from "../List/List";
import { Spinner } from "../Spinner/Spinner";
import { createCopied, SettingsEmpty, SettingsPage } from "./shared";

export type DiagnosticsField =
	| { kind: "value"; label: string; value: string }
	| { kind: "list"; label: string; items: string[] };

export type DiagnosticsSection = {
	title: string;
	fields: DiagnosticsField[];
};

export type DebugInformationProps = {
	sections?: DiagnosticsSection[];
	copyValue?: string;
	onCopy?: () => void;
	class?: string;
};

const FieldRow = (props: { field: DiagnosticsField }) => (
	<div class="flex min-w-0 flex-col gap-0.5 px-3 py-2">
		<span class="text-xs text-muted-foreground">{props.field.label}</span>
		<Switch>
			<Match when={props.field.kind === "value" && props.field}>
				{(field) => (
					<code class="font-mono text-xs leading-relaxed break-all text-foreground">
						{field().value}
					</code>
				)}
			</Match>
			<Match when={props.field.kind === "list" && props.field}>
				{(field) => (
					<Show
						when={field().items.length > 0}
						fallback={<span class="text-xs text-foreground">None</span>}
					>
						<ul class="flex list-disc flex-col gap-0.5 pl-4">
							<For each={field().items}>
								{(item) => (
									<li class="font-mono text-xs break-all text-foreground">
										{item}
									</li>
								)}
							</For>
						</ul>
					</Show>
				)}
			</Match>
		</Switch>
	</div>
);

export const DebugInformation = (props: DebugInformationProps) => {
	const { copied, copy } = createCopied();

	return (
		<SettingsPage
			class={props.class}
			intro="Include this when you report a problem. It doesn't contain your messages."
		>
			<Button
				variant="secondary"
				class="w-full @min-[480px]/settings:w-fit"
				disabled={!props.copyValue}
				data-copied={copied() || undefined}
				icon={
					<Show when={copied()} fallback={<CopyIcon />}>
						<CheckCircleIcon class="text-success" />
					</Show>
				}
				onClick={(event) => {
					const value = props.copyValue;
					if (!value) return;
					void copy(value, event.currentTarget).then((done) => {
						if (done) props.onCopy?.();
					});
				}}
			>
				{copied() ? "Copied" : "Copy debug information"}
			</Button>
			<Show
				when={props.sections}
				fallback={
					<SettingsEmpty>
						<span class="inline-flex items-center gap-2">
							<Spinner size={16} />
							Gathering information...
						</span>
					</SettingsEmpty>
				}
			>
				{(sections) => (
					<For each={sections()}>
						{(section) => (
							<ListGroup label={section.title}>
								<For each={section.fields}>
									{(field) => <FieldRow field={field} />}
								</For>
							</ListGroup>
						)}
					</For>
				)}
			</Show>
			<span role="status" class="sr-only">
				{copied() ? "Copied" : ""}
			</span>
		</SettingsPage>
	);
};

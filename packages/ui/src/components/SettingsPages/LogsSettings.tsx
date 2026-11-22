import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { createMemo, createSignal, For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { ListGroup, ToggleRow } from "../List/List";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import { createCopied, SettingsEmpty, SettingsPage } from "./shared";

export type LogLineLevel = "debug" | "info" | "warn" | "error";

export type LogLine = {
	time: string;
	level: LogLineLevel;
	scope: string;
	message: string;
};

export type LogsFilter = "all" | "problems";

export type LogsSettingsProps = {
	lines: LogLine[];
	verbose: boolean;
	onVerboseChange?: (enabled: boolean) => void;
	copyValue?: string;
	onCopy?: () => void;
	class?: string;
};

const LEVEL_LABEL: Record<LogLineLevel, string> = {
	debug: "Detail",
	info: "Info",
	warn: "Warning",
	error: "Error",
};

const levelTone: Record<LogLineLevel, string> = {
	debug: "text-muted-foreground",
	info: "text-muted-foreground",
	warn: "text-warning",
	error: "text-destructive",
};

const isProblem = (line: LogLine) =>
	line.level === "warn" || line.level === "error";

export const LogsSettings = (props: LogsSettingsProps) => {
	const { copied, copy } = createCopied();
	const [filter, setFilter] = createSignal<LogsFilter>("all");
	const shown = createMemo(() => {
		const lines =
			filter() === "problems" ? props.lines.filter(isProblem) : props.lines;
		return [...lines].reverse();
	});

	return (
		<SettingsPage
			class={props.class}
			intro="Recent activity in the app, newest first. Copy them when someone helping you with a problem asks for them."
		>
			<ListGroup>
				<ToggleRow
					title="Detailed logging"
					description="Records more detail to help track down a problem. Turn it off when you're done."
					checked={props.verbose}
					onChange={(checked) => props.onVerboseChange?.(checked)}
				/>
			</ListGroup>
			<div class="flex flex-col gap-3 @min-[480px]/settings:flex-row @min-[480px]/settings:items-center @min-[480px]/settings:justify-between">
				<SegmentedControl
					aria-label="Show"
					size="sm"
					class="@min-[480px]/settings:w-80"
					value={filter()}
					onChange={(value) => setFilter(value as LogsFilter)}
					options={[
						{ value: "all", label: "Everything" },
						{ value: "problems", label: "Warnings and errors" },
					]}
				/>
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
					{copied() ? "Copied" : "Copy logs"}
				</Button>
			</div>
			<Show
				when={shown().length > 0}
				fallback={
					<SettingsEmpty>
						{filter() === "problems"
							? "No warnings or errors. Everything is running smoothly."
							: "Nothing logged yet."}
					</SettingsEmpty>
				}
			>
				<ol
					aria-label="Log"
					data-log-lines=""
					class="flex flex-col overflow-hidden rounded-control bg-secondary [&>li~li]:border-t [&>li~li]:border-border"
				>
					<For each={shown()}>
						{(line) => (
							<li
								data-level={line.level}
								class="flex min-w-0 flex-col gap-0.5 px-3 py-2"
							>
								<span class="flex min-w-0 items-center gap-2 text-xs">
									<span
										class={cx("shrink-0 font-semibold", levelTone[line.level])}
									>
										{LEVEL_LABEL[line.level]}
									</span>
									<span class="shrink-0 font-mono text-muted-foreground tabular-nums">
										{line.time}
									</span>
									<span class="min-w-0 truncate font-mono text-muted-foreground">
										{line.scope}
									</span>
								</span>
								<span class="font-mono text-xs leading-relaxed break-words text-foreground">
									{line.message}
								</span>
							</li>
						)}
					</For>
				</ol>
			</Show>
			<span role="status" class="sr-only">
				{copied() ? "Copied" : ""}
			</span>
		</SettingsPage>
	);
};

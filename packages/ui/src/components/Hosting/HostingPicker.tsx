import { Show } from "solid-js";
import { cx } from "../../utils/cx";
import {
	DropdownMenu,
	type DropdownMenuPlatform,
} from "../DropdownMenu/DropdownMenu";
import { TextField } from "../TextField/TextField";

export type HostingMode = "colibri" | "own";

export type HostingPickerProps = {
	mode: HostingMode;
	onModeChange: (mode: HostingMode) => void;
	account?: string;
	onAccountChange?: (account: string) => void;
	accountError?: string;
	disabled?: boolean;
	platform?: DropdownMenuPlatform;
	class?: string;
};

const summary: Record<HostingMode, { title: string; description: string }> = {
	colibri: {
		title: "Hosted by Colibri",
		description: "We run the account for your Space.",
	},
	own: {
		title: "Hosted on your account",
		description: "The Space lives on an account and server you own.",
	},
};

export const HostingPicker = (props: HostingPickerProps) => (
	<div
		data-hosting-picker={props.mode}
		class={cx("flex w-full flex-col gap-4", props.class)}
	>
		<div class="flex items-center gap-3 rounded-control border border-border bg-secondary py-3 pr-3 pl-4">
			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="font-semibold text-foreground text-sm">
					{summary[props.mode].title}
				</span>
				<span class="text-muted-foreground text-sm">
					{summary[props.mode].description}
				</span>
			</div>
			<DropdownMenu
				platform={props.platform}
				label="Who hosts this Space"
				title="Who hosts this Space"
				placement="bottom-end"
				triggerClass="pressable focus-ring inline-flex h-8 shrink-0 cursor-pointer items-center rounded-control-sm border border-border bg-secondary-highlight px-3 font-sans font-semibold text-foreground text-sm enabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
				triggerProps={{
					"data-hosting-change": "",
					"aria-label": "Change who hosts this Space",
					disabled: props.disabled,
				}}
				trigger="Change"
				items={[
					{
						kind: "radio",
						value: props.mode,
						onChange: (value) => props.onModeChange(value as HostingMode),
						options: [
							{
								value: "colibri",
								label: "Colibri hosts it",
								description: "Nothing to set up.",
							},
							{
								value: "own",
								label: "Use an account I own",
								description:
									"Sign in as an account on a server with Spaces support.",
							},
						],
					},
				]}
			/>
		</div>
		<Show when={props.mode === "own"}>
			<TextField
				label="Account"
				placeholder="space.example.com"
				autocomplete="username"
				value={props.account ?? ""}
				onChange={(value) => props.onAccountChange?.(value)}
				error={props.accountError}
				disabled={props.disabled}
				description="You'll sign in as this account next. Use an account made just for this Space."
			/>
		</Show>
	</div>
);

export const hostingSubmitLabel = (mode: HostingMode) =>
	mode === "own" ? "Sign in and create" : "Create Space";

import { createSignal, For } from "solid-js";
import EyeFillIcon from "~icons/ph/eye-fill";
import LockKeyFillIcon from "~icons/ph/lock-key-fill";
import ShieldWarningFillIcon from "~icons/ph/shield-warning-fill";
import { Button } from "../../ui/Button";
import {
	Checkbox,
	CheckboxControl,
	CheckboxInput,
	CheckboxLabel,
} from "../../ui/Checkbox";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";

const GUIDELINES = [
	{
		icon: EyeFillIcon,
		color: "bg-blue-500/10 text-blue-500",
		title: "Anyone can see it",
		body: "Messages on Colibri are broadcast to the entire world. Anyone with sufficient knowledge can and will read them.",
	},
	{
		icon: ShieldWarningFillIcon,
		color: "bg-amber-500/10 text-amber-500",
		title: "We don't monitor chats",
		body: "Colibri doesn't review conversations in real time and isn't responsible for what gets shared.",
	},
	{
		icon: LockKeyFillIcon,
		color: "bg-rose-500/10 text-rose-500",
		title: "Keep sensitive info out",
		body: "Skip passwords, financial details, or anything you wouldn't want literally anyone to see.",
	},
] as const;

export const ChatGuidelinesModal = (props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAccept: () => void;
}) => {
	const [acknowledged, setAcknowledged] = createSignal(false);

	const confirm = () => {
		props.onAccept();
		props.onOpenChange(false);
	};

	return (
		<ResponsiveDialog
			open={props.open}
			onOpenChange={props.onOpenChange}
			title="Chat guidelines"
			contentClass="max-w-lg"
		>
			<div class="flex flex-col gap-5">
				<p class="m-0 text-sm">
					Colibri is beta software, and as such, does not yet support private
					data. Please note that:
				</p>
				<For each={GUIDELINES}>
					{(item) => (
						<div class="flex flex-row items-start gap-3">
							<span
								class={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${item.color}`}
								aria-hidden="true"
							>
								<item.icon class="size-4.5" />
							</span>
							<div class="flex flex-col gap-0.5">
								<span class="text-sm font-medium leading-5">{item.title}</span>
								<span class="text-sm leading-5 text-muted-foreground">
									{item.body}
								</span>
							</div>
						</div>
					)}
				</For>
				<Checkbox
					class="flex items-center gap-2"
					checked={acknowledged()}
					onChange={setAcknowledged}
				>
					<CheckboxInput />
					<CheckboxControl />
					<CheckboxLabel>
						I understand chats are public and won't share sensitive information.
					</CheckboxLabel>
				</Checkbox>
				<Button onClick={confirm} disabled={!acknowledged()}>
					Continue
				</Button>
			</div>
		</ResponsiveDialog>
	);
};

import {
	Button,
	Modal,
	ModalClose,
	ModalContent,
	type StatusClearAfter,
	type StatusDraft,
	StatusField,
	statusExpiresAt,
	toast,
} from "@colibri-social/ui";
import { createSignal, Show } from "solid-js";
import type { StatusInput } from "../../data/source";
import { useData } from "../../data/store";
import type { Datetime, Status } from "../../data/types";

const draftFrom = (status: Status | undefined): StatusDraft => ({
	text: status?.text ?? "",
	emoji: status?.emoji,
	clearAfter: "never",
	showWhileOffline: !!status?.showWhileOffline,
});

export const statusInputFrom = (
	draft: StatusDraft,
	options: { keepExpiry: boolean; now?: Date },
): StatusInput => {
	const input: StatusInput = {
		text: draft.text.trim(),
		emoji: draft.emoji ?? "",
		showWhileOffline: !!draft.showWhileOffline,
	};
	const expiresAt = statusExpiresAt(draft.clearAfter, options.now);
	if (expiresAt) input.expiresAt = expiresAt.toISOString() as Datetime;
	else if (!options.keepExpiry) input.removeExpiresAt = true;
	return input;
};

export const CLEARED_STATUS: StatusInput = {
	text: "",
	emoji: "",
	removeExpiresAt: true,
	showWhileOffline: false,
};

export const StatusEditor = (props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	platform?: "mobile" | "desktop";
}) => {
	const data = useData();
	const current = () => data.presenceOf(data.viewer.did)?.status;
	const [draft, setDraft] = createSignal<StatusDraft>(draftFrom(current()));
	const [clearAfterTouched, setClearAfterTouched] = createSignal(false);
	const [saving, setSaving] = createSignal(false);

	const dirty = () => {
		const initial = draftFrom(current());
		const next = draft();
		return (
			next.text !== initial.text ||
			(next.emoji ?? "") !== (initial.emoji ?? "") ||
			!!next.showWhileOffline !== !!initial.showWhileOffline ||
			clearAfterTouched()
		);
	};

	const reset = () => {
		setDraft(draftFrom(current()));
		setClearAfterTouched(false);
	};

	const change = (open: boolean) => {
		if (open) reset();
		props.onOpenChange(open);
	};

	const run = async (input: StatusInput, done: string) => {
		setSaving(true);
		try {
			await data.setStatus(input);
			props.onOpenChange(false);
			toast.success(done);
		} catch {
			toast.error("Couldn't update your status");
		} finally {
			setSaving(false);
		}
	};

	const save = () =>
		run(
			statusInputFrom(draft(), {
				keepExpiry: !clearAfterTouched() && !!current()?.expiresAt,
			}),
			"Status updated",
		);

	return (
		<Modal
			open={props.open}
			onOpenChange={change}
			dirty={!saving() && dirty()}
			discardDescription="Your new status won't be saved."
		>
			<ModalContent
				title="Set your status"
				footer={
					<>
						<ModalClose disabled={saving()}>Cancel</ModalClose>
						<Show when={current()}>
							<Button
								variant="secondary"
								disabled={saving()}
								onClick={() => run(CLEARED_STATUS, "Status removed")}
							>
								Remove status
							</Button>
						</Show>
						<Button loading={saving()} onClick={save}>
							Save
						</Button>
					</>
				}
			>
				<StatusField
					platform={props.platform ?? "mobile"}
					value={draft()}
					onChange={({ text, emoji, clearAfter, showWhileOffline }) => {
						if (clearAfter !== draft().clearAfter) setClearAfterTouched(true);
						setDraft({
							text,
							emoji,
							clearAfter: clearAfter as StatusClearAfter,
							showWhileOffline,
						});
					}}
				/>
			</ModalContent>
		</Modal>
	);
};

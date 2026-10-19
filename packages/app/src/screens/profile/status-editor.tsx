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
import {
	customEmojiOf,
	type StatusEmojiLookup,
	statusCustomEmojiRef,
} from "../../data/adapters/status";
import type { StatusInput } from "../../data/source";
import { useData } from "../../data/store";
import type { Datetime, ReactionEmojiRef, Status } from "../../data/types";

const draftFrom = (
	status: Status | undefined,
	emoji: StatusEmojiLookup,
): StatusDraft => {
	const ref = statusCustomEmojiRef(status);
	const customEmoji = ref
		? (customEmojiOf(emoji.lookup(ref.uri)) ?? {
				id: ref.uri,
				name: "",
				src: "",
			})
		: undefined;
	return {
		text: status?.text ?? "",
		emoji: customEmoji ? undefined : status?.emoji,
		customEmoji,
		clearAfter: "never",
		showWhileOffline: !!status?.showWhileOffline,
	};
};

export const statusInputFrom = (
	draft: StatusDraft,
	options: { keepExpiry: boolean; now?: Date },
): StatusInput => {
	const input: StatusInput = {
		text: draft.text.trim(),
		emoji: draft.customEmoji ? "" : (draft.emoji ?? ""),
		showWhileOffline: !!draft.showWhileOffline,
	};
	if (draft.customEmoji)
		input.customEmoji = { uri: draft.customEmoji.id } as ReactionEmojiRef;
	else input.removeCustomEmoji = true;
	const expiresAt = statusExpiresAt(draft.clearAfter, options.now);
	if (expiresAt) input.expiresAt = expiresAt.toISOString() as Datetime;
	else if (!options.keepExpiry) input.removeExpiresAt = true;
	return input;
};

export const CLEARED_STATUS: StatusInput = {
	text: "",
	emoji: "",
	removeCustomEmoji: true,
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
	const [draft, setDraft] = createSignal<StatusDraft>(
		draftFrom(current(), data.emoji),
	);
	const packs = () => data.emoji.packs(undefined);
	const [clearAfterTouched, setClearAfterTouched] = createSignal(false);
	const [saving, setSaving] = createSignal(false);

	const dirty = () => {
		const initial = draftFrom(current(), data.emoji);
		const next = draft();
		return (
			next.text !== initial.text ||
			(next.emoji ?? "") !== (initial.emoji ?? "") ||
			next.customEmoji?.id !== initial.customEmoji?.id ||
			!!next.showWhileOffline !== !!initial.showWhileOffline ||
			clearAfterTouched()
		);
	};

	const reset = () => {
		setDraft(draftFrom(current(), data.emoji));
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
					packs={packs()}
					onChange={({
						text,
						emoji,
						customEmoji,
						clearAfter,
						showWhileOffline,
					}) => {
						if (clearAfter !== draft().clearAfter) setClearAfterTouched(true);
						setDraft({
							text,
							emoji,
							customEmoji,
							clearAfter: clearAfter as StatusClearAfter,
							showWhileOffline,
						});
					}}
				/>
			</ModalContent>
		</Modal>
	);
};

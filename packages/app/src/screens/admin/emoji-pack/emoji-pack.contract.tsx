import {
	Button,
	ConfirmDialog,
	SearchField,
	StatusScreen,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { EmojiFunnyCircleIcon } from "@solar-icons/solid/bold/emoji-funny-circle";
import { Show } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import { NEW_ENTRY } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { useUnsavedChanges } from "../../../shell/unsaved-changes";
import { createUnsavedForm, UnsavedBar } from "../../settings/unsaved-form";
import { AdminNavHeader } from "../desktop/page-header";
import { useEmojiAdmin } from "../emoji/emoji-shared";
import { createPackEditor, PackEmojis, PackNameField } from "./pack-editor";

export const adminEmojiPack = defineContract({
	id: "adminEmojiPack",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useEmojiAdmin(args.space);
		const editor = createPackEditor(admin, {
			packId: () => (args.id === NEW_ENTRY ? undefined : args.id),
			onCreated: () => stack.forcePop(),
			onDeleted: () => stack.forcePop(),
		});

		const depth = () =>
			stack
				.mounted()
				.findIndex(
					(layer) =>
						layer.kind === "admin" &&
						layer.page === "emoji-pack" &&
						layer.space === args.space &&
						layer.id === args.id,
				) + 1;

		if (editor.creating) {
			useUnsavedChanges({
				depth,
				dirty: () => editor.dirty() && !editor.saving(),
				description: () => "This pack hasn't been created yet.",
			});
		}

		const unsaved = editor.creating
			? undefined
			: createUnsavedForm({
					depth,
					dirty: editor.dirty,
					saving: editor.saving,
					save: editor.save,
					saveDisabled: () => !!editor.nameError(),
					reset: editor.reset,
				});

		return {
			...admin,
			...editor,
			editor,
			unsaved,
			back: () => stack.pop(),
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title={
					m.creating ? "Create new Pack" : (m.pack()?.name ?? "Emoji pack")
				}
				action={
					m.creating && m.canManage() && !m.gone()
						? {
								type: "text",
								label: "Create",
								onClick: () => void m.save(),
								disabled: !m.canSave(),
								loading: m.saving(),
							}
						: undefined
				}
			/>
		)),
		Bar: slot((m) => <UnsavedBar form={m.unsaved} />),
		Unavailable: slot((m) => (
			<Show when={m.missing() || m.gone() || !m.canManage()}>
				<StatusScreen
					tone={m.missing() ? "destructive" : "neutral"}
					icon={m.missing() ? <DangerTriangleIcon /> : <EmojiFunnyCircleIcon />}
					title={
						m.missing()
							? "This Space isn't available"
							: m.gone()
								? "This pack doesn't exist anymore"
								: "You can't edit emoji packs here"
					}
					description={
						m.missing()
							? "It may have been deleted, or you're no longer a member."
							: m.gone()
								? "Someone may have deleted it."
								: "Ask someone who manages this Space to make changes."
					}
					actions={
						<Button block variant="secondary" onClick={m.back}>
							Back to emoji packs
						</Button>
					}
				/>
			</Show>
		)),
		Name: slot((m) => <PackNameField editor={m.editor} />),
		Search: slot((m) => (
			<SearchField
				aria-label="Search emojis"
				placeholder="Search emojis"
				value={m.query()}
				onChange={m.setQuery}
			/>
		)),
		Upload: slot((m) => (
			<m.uploader.Picker>
				{(pick) => (
					<Button block onClick={pick}>
						Upload Emoji
					</Button>
				)}
			</m.uploader.Picker>
		)),
		Emojis: slot((m) => <PackEmojis owner={m} editor={m.editor} />),
		Danger: slot((m) => (
			<Show when={!m.creating}>
				<Button
					variant="destructive"
					block
					onClick={() => m.setDeleteOpen(true)}
				>
					Delete Pack
				</Button>
			</Show>
		)),
		Overlays: slot((m) => (
			<>
				<ConfirmDialog
					open={m.deleteOpen()}
					onOpenChange={m.setDeleteOpen}
					title={`Delete ${m.pack()?.name ?? "this pack"}?`}
					description="The emoji in it stay in this Space and move to Ungrouped unless another pack holds them."
					confirmLabel="Delete pack"
					tone="destructive"
					onConfirm={m.removePack}
				/>
			</>
		)),
	},
});

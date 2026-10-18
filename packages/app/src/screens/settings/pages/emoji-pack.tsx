import {
	Button,
	ConfirmDialog,
	SearchField,
	StatusScreen,
} from "@colibri-social/ui";
import { EmojiFunnyCircleIcon } from "@solar-icons/solid/bold/emoji-funny-circle";
import { Show } from "solid-js";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";
import {
	createPackEditor,
	PackEmojis,
	PackNameField,
} from "../../admin/emoji-pack/pack-editor";
import { useSettingsNav } from "../nav";
import { editingPack, ownEmoji, setEditingPack } from "./own-emoji";

export default function EmojiPackPage(_props: { platform: Platform }) {
	const data = useData();
	const nav = useSettingsNav();
	const owner = ownEmoji(data);
	const target = editingPack();
	const done = () => {
		setEditingPack(undefined);
		nav.back();
	};
	const editor = createPackEditor(owner, {
		packId: () => target,
		onCreated: done,
		onDeleted: done,
	});

	return (
		<Show
			when={!editor.gone()}
			fallback={
				<StatusScreen
					tone="neutral"
					icon={<EmojiFunnyCircleIcon />}
					title="This pack doesn't exist anymore"
					description="You may have deleted it on another device."
					actions={
						<Button block variant="secondary" onClick={done}>
							Back to my emoji packs
						</Button>
					}
				/>
			}
		>
			<div class="flex flex-col gap-6">
				<PackNameField editor={editor} />
				<div aria-hidden="true" class="h-px w-full bg-accent" />
				<SearchField
					aria-label="Search your emoji"
					placeholder="Search your emoji"
					value={editor.query()}
					onChange={editor.setQuery}
				/>
				<editor.uploader.Picker>
					{(pick) => (
						<Button block variant="secondary" onClick={pick}>
							Upload Emoji
						</Button>
					)}
				</editor.uploader.Picker>
				<PackEmojis owner={owner} editor={editor} />
				<div aria-hidden="true" class="h-px w-full bg-accent" />
				<Button
					block
					disabled={!editor.canSave()}
					loading={editor.saving()}
					onClick={() => void editor.save()}
				>
					{editor.creating ? "Create Pack" : "Save Pack"}
				</Button>
				<Show when={!editor.creating}>
					<Button
						variant="destructive"
						block
						onClick={() => editor.setDeleteOpen(true)}
					>
						Delete Pack
					</Button>
				</Show>
			</div>
			<ConfirmDialog
				open={editor.deleteOpen()}
				onOpenChange={editor.setDeleteOpen}
				title={`Delete ${editor.pack()?.name ?? "this pack"}?`}
				description="Its emoji stay with the rest of your emoji."
				confirmLabel="Delete pack"
				tone="destructive"
				onConfirm={editor.removePack}
			/>
		</Show>
	);
}

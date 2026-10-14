import { AttachmentDropzone } from "@colibri-social/ui";
import { threadDraft } from "./thread-draft.contract";

export default threadDraft.view({
	render: ({ slots: s, model: m }) => (
		<div
			data-thread-draft-view="desktop"
			class="flex min-h-0 flex-1 flex-col bg-card"
		>
			<s.Header platform="desktop" />
			<AttachmentDropzone
				scope="zone"
				channelName={m.parent()?.name}
				onFiles={(files) => m.conversation.attachments.addFiles(files)}
				footer={<s.Composer platform="desktop" />}
			>
				<div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
					<s.Name />
					<s.Anchor />
				</div>
			</AttachmentDropzone>
		</div>
	),
});

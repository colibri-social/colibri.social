import { AttachmentDropzone } from "@colibri-social/ui";
import { Show } from "solid-js";
import { Outlet, usePlacement } from "../../shell/desktop/context";
import { thread } from "./thread.contract";

export default thread.view({
	hidden: ["Unavailable", "LoadError"] as const,
	render: ({ slots: s, model: m }) => {
		const full = usePlacement() === "main";
		return (
			<div
				data-thread-view="desktop"
				data-presentation={full ? "full" : "split"}
				class="flex min-h-0 flex-1 flex-col bg-card"
			>
				<Show when={full} fallback={<s.Header platform="desktop" />}>
					<Outlet name="header">
						<s.Header platform="desktop" full />
					</Outlet>
				</Show>
				<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
					<Show when={!m.loadFailure()} fallback={<s.LoadError />}>
						<AttachmentDropzone
							scope="zone"
							channelName={m.options.label()}
							disabled={!m.writable() || m.selection.active()}
							onFiles={(files) => m.attachments.addFiles(files)}
							footer={<s.Composer platform="desktop" />}
						>
							<s.Messages platform="desktop" />
						</AttachmentDropzone>
					</Show>
				</Show>
				<s.Menu />
			</div>
		);
	},
});

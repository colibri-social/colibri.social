import { AttachmentDropzone } from "@colibri-social/ui";
import { Show } from "solid-js";
import { ConnectionSlot } from "../../shell/connection-slot";
import {
	Outlet,
	useOptionalDesktopShell,
	usePlacement,
} from "../../shell/desktop/context";
import { channel } from "./channel.contract";

export default channel.view({
	hidden: ["Unavailable", "LoadError"] as const,
	render: ({ slots: s, model: m }) => {
		const placement = usePlacement();
		const shell = useOptionalDesktopShell();
		const ownsHeader = () => placement === "main" && !shell?.fullThread();
		return (
			<div
				data-channel-view="desktop"
				class="flex min-h-0 flex-1 flex-col bg-card"
			>
				<Show when={placement === "pane"}>
					<s.Header platform="desktop" placement="pane" />
				</Show>
				<Show when={ownsHeader()}>
					<Outlet name="header">
						<s.Header platform="desktop" placement="main" />
					</Outlet>
				</Show>
				<Show when={!m.unavailable()} fallback={<s.Unavailable />}>
					<Show when={!m.loadFailure()} fallback={<s.LoadError />}>
						<AttachmentDropzone
							scope="zone"
							channelName={m.options.label()}
							disabled={
								m.view()?.viewer.canPost === false || m.selection.active()
							}
							onFiles={(files) => m.attachments.addFiles(files)}
							footer={
								<div data-chat-footer="">
									<s.Composer platform="desktop" />
								</div>
							}
						>
							<ConnectionSlot platform="desktop" />
							<s.Messages platform="desktop" />
						</AttachmentDropzone>
					</Show>
				</Show>
			</div>
		);
	},
});

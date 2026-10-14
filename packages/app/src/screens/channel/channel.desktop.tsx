import { AttachmentDropzone } from "@colibri-social/ui";
import { onMount, Show } from "solid-js";
import {
	Outlet,
	useOptionalDesktopShell,
	usePlacement,
} from "../../shell/desktop/context";
import { channel } from "./channel.contract";
import { liftToasts } from "./toast-offset";

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
								<div
									data-chat-footer=""
									ref={(element) => {
										if (placement === "main")
											onMount(() => liftToasts(element));
									}}
								>
									<s.Composer platform="desktop" />
								</div>
							}
						>
							<s.Messages platform="desktop" />
						</AttachmentDropzone>
					</Show>
				</Show>
			</div>
		);
	},
});

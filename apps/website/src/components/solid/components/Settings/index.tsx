import { createEffect, type ParentComponent } from "solid-js";
import { SettingsModal } from "../common/SettingsModal";
import { DebugPage } from "./DebugPage";
import { GeneralPage } from "./GeneralPage";
import { StatusPage } from "./StatusPage";
import { VideoPage } from "./VideoPage";
import { VoicePage } from "./VoicePage";

export const UserSettingsModal: ParentComponent = (props) => {
	return (
		<SettingsModal
			pages={[
				{
					title: "Profile",
					id: "general",
					component: GeneralPage,
					icon: "user-circle-icon",
				},
				{
					title: "Status",
					id: "status",
					component: StatusPage,
					icon: "smiley-icon",
				},
				{
					title: "Voice",
					id: "voice",
					component: VoicePage,
					icon: "microphone-icon",
				},
				{
					title: "Video",
					id: "video",
					component: VideoPage,
					icon: "camera-icon",
				},
			]}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: DebugPage,
				icon: "bug-icon",
			}}
			dangerPage={{
				title: "Log out",
				id: "logout",
				icon: "arrow-line-left-icon",
				component: () => {
					createEffect(() => (window.location.href = "/auth/logout"));

					// biome-ignore lint/complexity/noUselessFragments: Needed to make the redirect work
					return (<></>) as any;
				},
			}}
			contentClass="min-h-[min(48rem,calc(100vh-2rem))]"
		>
			{props.children}
		</SettingsModal>
	);
};

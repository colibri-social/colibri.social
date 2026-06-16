import { createEffect, type ParentComponent } from "solid-js";
import ArrowLineLeftIcon from "~icons/ph/arrow-line-left";
import BellIcon from "~icons/ph/bell";
import BugIcon from "~icons/ph/bug";
import CameraIcon from "~icons/ph/camera";
import MicrophoneIcon from "~icons/ph/microphone";
import SmileyIcon from "~icons/ph/smiley";
import UserCircleIcon from "~icons/ph/user-circle";
import { useAuthContext } from "../../../contexts/Auth";
import { useUserContext } from "../../../contexts/User";
import { isWebRuntime } from "../../../notifications";
import { unsubscribeWebPush } from "../../../notifications/push-web";
import { SettingsModal } from "../common/SettingsModal";
import { DebugPage } from "./DebugPage";
import { GeneralPage } from "./GeneralPage";
import { NotificationsPage } from "./NotificationsPage";
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
					icon: () => <UserCircleIcon />,
				},
				{
					title: "Status",
					id: "status",
					component: StatusPage,
					icon: () => <SmileyIcon />,
				},
				{
					title: "Notifications",
					id: "notifications",
					component: NotificationsPage,
					icon: () => <BellIcon />,
				},
				{
					title: "Voice",
					id: "voice",
					component: VoicePage,
					icon: () => <MicrophoneIcon />,
				},
				{
					title: "Video",
					id: "video",
					component: VideoPage,
					icon: () => <CameraIcon />,
				},
			]}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: DebugPage,
				icon: () => <BugIcon />,
			}}
			dangerPage={{
				title: "Log out",
				id: "logout",
				icon: () => <ArrowLineLeftIcon />,
				component: () => {
					const auth = useAuthContext();
					const user = useUserContext();

					createEffect(() => {
						(async () => {
							try {
								if (isWebRuntime()) {
									await unsubscribeWebPush((endpoint) =>
										user.xrpc.social.colibri.notification.unregisterPush(
											endpoint,
										),
									);
								}
								await auth?.client.revoke(user.did);
							} finally {
								localStorage.removeItem("sub");
								window.location.href = "/app/login";
							}
						})();
					});

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

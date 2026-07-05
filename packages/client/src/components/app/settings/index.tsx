import { createEffect, type ParentComponent } from "solid-js";
import ArrowLineLeftIcon from "~icons/ph/arrow-line-left";
import BellIcon from "~icons/ph/bell";
import BugIcon from "~icons/ph/bug";
import CameraIcon from "~icons/ph/camera";
import FlaskIcon from "~icons/ph/flask";
import MicrophoneIcon from "~icons/ph/microphone";
import SmileyIcon from "~icons/ph/smiley";
import UserCircleIcon from "~icons/ph/user-circle";
import WrenchIcon from "~icons/ph/wrench";
import { endSession } from "../../../atproto/session";
import { useAuthContext } from "../../../contexts/Auth";
import { useUserContext } from "../../../contexts/User";
import { EXPERIMENTS } from "../../../experiments";
import { isWebRuntime } from "../../../notifications";
import { unsubscribeWebPush } from "../../../notifications/push-web";
import { SettingsModal } from "../common/SettingsModal";
import { DebugPage } from "./DebugPage";
import { ExperimentsPage } from "./ExperimentsPage";
import { GeneralPage } from "./GeneralPage";
import { NotificationsPage } from "./NotificationsPage";
import { PreferencesPage } from "./PreferencesPage";
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
				{
					title: "Preferences",
					id: "preferences",
					component: PreferencesPage,
					icon: () => <WrenchIcon />,
				},
				{
					title: "Experiments",
					id: "experiments",
					component: ExperimentsPage,
					icon: () => <FlaskIcon />,
					visible: () => EXPERIMENTS.length > 0,
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
								await endSession();
							}
						})();
					});

					// biome-ignore lint/complexity/noUselessFragments: Needed to make the redirect work
					return (<></>) as any;
				},
			}}
			contentClass="min-h-[min(48rem,calc(100vh-2rem))] [&>div.max-h-144]:max-h-none"
		>
			{props.children}
		</SettingsModal>
	);
};

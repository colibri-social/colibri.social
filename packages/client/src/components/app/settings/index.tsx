import {
	type Accessor,
	createEffect,
	type ParentComponent,
	type Setter,
} from "solid-js";
import ArrowLineLeftIcon from "~icons/ph/arrow-line-left";
import BellIcon from "~icons/ph/bell";
import BugIcon from "~icons/ph/bug";
import CameraIcon from "~icons/ph/camera";
import FlaskIcon from "~icons/ph/flask";
import HandTapIcon from "~icons/ph/hand-tap";
import HeartIcon from "~icons/ph/heart";
import InfoIcon from "~icons/ph/info";
import MicrophoneIcon from "~icons/ph/microphone";
import SmileyIcon from "~icons/ph/smiley";
import UserCircleIcon from "~icons/ph/user-circle";
import WrenchIcon from "~icons/ph/wrench";
import { endSession } from "../../../atproto/session";
import { useAuthContext } from "../../../contexts/Auth";
import { useUserContext } from "../../../contexts/User";
import { EXPERIMENTS } from "../../../experiments";
import { unregisterAllPush } from "../../../notifications";
import { useIsTouch } from "../../../utils/touch";
import { SettingsModal } from "../common/SettingsModal";
import { AboutPage } from "./AboutPage";
import { ControlsPage } from "./ControlsPage";
import { DebugPage } from "./DebugPage";
import { ExperimentsPage } from "./ExperimentsPage";
import { GeneralPage } from "./GeneralPage";
import { NotificationsPage } from "./NotificationsPage";
import { PreferencesPage } from "./PreferencesPage";
import { StatusPage } from "./StatusPage";
import { SupportPage } from "./SupportPage";
import { VideoPage } from "./VideoPage";
import { VoicePage } from "./VoicePage";

export const UserSettingsModal: ParentComponent<{
	open?: Accessor<boolean>;
	setOpen?: Setter<boolean>;
}> = (props) => {
	const isTouch = useIsTouch();

	return (
		<SettingsModal
			open={props.open}
			setOpen={props.setOpen}
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
					title: "Controls",
					id: "controls",
					component: ControlsPage,
					icon: () => <HandTapIcon />,
					visible: isTouch,
				},
				{
					title: "Experiments",
					id: "experiments",
					component: ExperimentsPage,
					icon: () => <FlaskIcon />,
					visible: () => EXPERIMENTS.length > 0,
				},
				{
					title: "Support Colibri",
					id: "support",
					component: SupportPage,
					icon: () => <HeartIcon />,
				},
				{
					title: "About",
					id: "about",
					component: AboutPage,
					icon: () => <InfoIcon />,
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
								await unregisterAllPush((endpoint, provider) =>
									user.xrpc.social.colibri.notification.unregisterPush(
										endpoint,
										provider,
									),
								);
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

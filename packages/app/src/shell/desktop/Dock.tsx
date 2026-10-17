import {
	OwnProfilePopover,
	UserPanel,
	VoiceStatusPanelSkeleton,
} from "@colibri-social/ui";
import {
	createEffect,
	createMemo,
	createSignal,
	lazy,
	on,
	Show,
	Suspense,
} from "solid-js";
import { displayNameOf } from "../../data/adapters/authors";
import { uiPresence } from "../../data/adapters/presence";
import { useData } from "../../data/store";
import { voice } from "../../data/voice";
import { createBioRenderer } from "../../screens/profile/bio-links";
import { ownProfileData } from "../../screens/profile/own-profile";
import { useStack } from "../stack";
import { useDesktopShell } from "./context";

const VoiceDock = lazy(() => import("../../screens/voice/desktop-dock"));
const ProfileScreen = lazy(
	() => import("../../screens/profile/profile.screen"),
);

export const Dock = () => {
	const data = useData();
	const stack = useStack();
	const shell = useDesktopShell();
	const [profileOpen, setProfileOpen] = createSignal(false);
	const presence = () =>
		data.presenceOf(data.viewer.did) ?? data.viewer.presence;
	const bio = createBioRenderer();
	const profile = createMemo(() =>
		ownProfileData(
			data,
			shell.stack.route().root.space,
			bio.render,
			bio.openLink,
		),
	);
	createEffect(
		on(
			() => stack.mounted().length,
			() => setProfileOpen(false),
			{ defer: true },
		),
	);
	return (
		<>
			<OwnProfilePopover
				open={profileOpen()}
				onOpenChange={setProfileOpen}
				profile={profile()}
				actions={
					<Suspense>
						<ProfileScreen args={{}} />
					</Suspense>
				}
				renderTrigger={(trigger) => (
					<UserPanel
						name={displayNameOf(data.viewer)}
						avatarSeed={data.viewer.did}
						avatarSrc={data.viewer.avatar}
						presence={uiPresence(presence())}
						status={presence()?.status?.text || undefined}
						profileTrigger={trigger}
						voice={
							<Show when={voice.current()}>
								<Suspense fallback={<VoiceStatusPanelSkeleton />}>
									<VoiceDock />
								</Suspense>
							</Show>
						}
						onOpenSettings={() => stack.push({ kind: "settings" })}
					/>
				)}
			/>
			<bio.LinkWarningOutlet />
		</>
	);
};

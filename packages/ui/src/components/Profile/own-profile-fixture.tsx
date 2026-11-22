import { createSignal } from "solid-js";
import type { Presence } from "../Avatar/Avatar";
import { storyImages } from "../Banner/story-images";
import { UserPanel } from "../Shell/UserPanel";
import {
	OwnPresenceRow,
	OwnProfilePopover,
	OwnProfileRows,
	ownPresenceEntries,
} from "./OwnProfile";
import type { ProfileData } from "./ProfileContent";

export const ownProfileFixture = (
	overrides: Partial<ProfileData> = {},
): ProfileData => ({
	displayName: "Lou",
	handle: "lou.gg",
	accentColor: "#c4b5fd",
	avatarSrc: storyImages.violetIcon(),
	avatarSeed: "did:plc:lou",
	presence: "online",
	bannerSrc: storyImages.sunsetBanner(),
	status: "Building a nest",
	statusEmoji: "🪺",
	bio: "Watching crows on the canal and building Colibri.",
	roles: [
		{ name: "Team", color: "#8e51ff" },
		{ name: "Moderators", color: "#22c55e" },
	],
	...overrides,
});

export const OwnProfilePopoverFixture = (props: {
	profile?: ProfileData;
	defaultOpen?: boolean;
}) => {
	const base = () => props.profile ?? ownProfileFixture();
	const [presence, setPresence] = createSignal<Presence>(
		base().presence ?? "online",
	);
	const [open, setOpen] = createSignal(!!props.defaultOpen);
	const profile = (): ProfileData => ({ ...base(), presence: presence() });
	return (
		<OwnProfilePopover
			open={open()}
			onOpenChange={setOpen}
			profile={profile()}
			actions={
				<>
					<OwnPresenceRow
						presence={presence()}
						entries={ownPresenceEntries(presence(), setPresence)}
					/>
					<OwnProfileRows hasStatus={!!base().status} />
				</>
			}
			renderTrigger={(trigger) => (
				<UserPanel
					name={base().displayName}
					avatarSeed={base().avatarSeed}
					avatarSrc={base().avatarSrc}
					presence={presence()}
					status={base().status}
					profileTrigger={trigger}
				/>
			)}
		/>
	);
};

import { createResource, Match, type ParentComponent, Switch } from "solid-js";
import { useUserContext } from "../../../contexts/User";
import { AppLoadingScreen } from "../../AppLoadingScreen";
import { ProfileSetupModal } from "./ProfileSetupModal";

/**
 * Blocks app access on first login until the user has a
 * `social.colibri.actor.profile` record. We read the record straight from the
 * user's PDS (not via the AppView) so the check isn't subject to firehose
 * indexing lag. If it's missing, the (non-dismissible) {@link ProfileSetupModal}
 * is shown until the user completes setup.
 */
type GateState = { needsSetup: boolean; hasBluesky: boolean };

export const ProfileGate: ParentComponent = (props) => {
	const user = useUserContext();

	const recordExists = async (collection: string): Promise<boolean> => {
		try {
			await user.atproto.agent.com.atproto.repo.getRecord({
				repo: user.did,
				collection,
				rkey: "self",
			});
			return true;
		} catch {
			// 404 (or any read failure) — treat as "not present".
			return false;
		}
	};

	const [gate, { mutate }] = createResource(async (): Promise<GateState> => {
		const [hasColibri, hasBluesky] = await Promise.all([
			recordExists("social.colibri.actor.profile"),
			recordExists("app.bsky.actor.profile"),
		]);
		return { needsSetup: !hasColibri, hasBluesky };
	});

	return (
		<Switch>
			<Match when={gate.loading}>
				<AppLoadingScreen message="Checking your profile..." />
			</Match>
			<Match when={gate()?.needsSetup}>
				<ProfileSetupModal
					open
					hasBlueskyProfile={gate()?.hasBluesky ?? false}
					onComplete={() => mutate((prev) => ({ ...prev!, needsSetup: false }))}
				/>
			</Match>
			<Match when={gate() && !gate()!.needsSetup}>{props.children}</Match>
		</Switch>
	);
};

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
type GateState = {
	needsSetup: boolean;
	hasBluesky: boolean;
	returning: boolean;
};

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

	// Any `social.colibri.*` record (other than the profile, which we know is
	// absent when setup is showing) means the account used Colibri before, so we
	// can reassure them rather than treat them as brand new. Fails safe to false.
	const isReturning = async (): Promise<boolean> => {
		try {
			const res = await user.atproto.agent.com.atproto.repo.describeRepo({
				repo: user.did,
			});
			return res.data.collections.some((c) => c.startsWith("social.colibri."));
		} catch {
			return false;
		}
	};

	const [gate, { mutate }] = createResource(async (): Promise<GateState> => {
		const [hasColibri, hasBluesky, returning] = await Promise.all([
			recordExists("social.colibri.actor.profile"),
			recordExists("app.bsky.actor.profile"),
			isReturning(),
		]);
		return { needsSetup: !hasColibri, hasBluesky, returning };
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
					returning={gate()?.returning ?? false}
					onComplete={() => mutate((prev) => ({ ...prev!, needsSetup: false }))}
				/>
			</Match>
			<Match when={gate() && !gate()!.needsSetup}>{props.children}</Match>
		</Switch>
	);
};

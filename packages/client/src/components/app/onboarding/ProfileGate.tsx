import { createResource, Match, type ParentComponent, Switch } from "solid-js";
import { useUserContext } from "../../../contexts/User";
import { classifyThrown, isRecordNotFound } from "../../../errors/classify";
import { markBoot } from "../../../utils/perf";
import { AppLoadingScreen } from "../../AppLoadingScreen";
import { ErrorState } from "../../ErrorState";
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

const seenKey = (did: string) => `colibri:profile-ok:${did}`;

const hasSeenProfile = (did: string): boolean => {
	try {
		return localStorage.getItem(seenKey(did)) === "1";
	} catch {
		return false;
	}
};

const rememberProfile = (did: string, present: boolean): void => {
	try {
		if (present) localStorage.setItem(seenKey(did), "1");
		else localStorage.removeItem(seenKey(did));
	} catch {}
};

export const ProfileGate: ParentComponent = (props) => {
	const user = useUserContext();
	const skipBlocking = hasSeenProfile(user.did);

	const recordExists = async (collection: string): Promise<boolean> => {
		try {
			await user.atproto.agent.com.atproto.repo.getRecord({
				repo: user.did,
				collection,
				rkey: "self",
			});
			return true;
		} catch (err) {
			if (isRecordNotFound(err)) return false;
			throw classifyThrown(err, { method: "com.atproto.repo.getRecord" });
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

	const [gate, { mutate, refetch }] = createResource(
		async (): Promise<GateState> => {
			const [hasColibri, hasBluesky, returning] = await Promise.all([
				recordExists("social.colibri.actor.profile"),
				recordExists("app.bsky.actor.profile"),
				isReturning(),
			]);
			rememberProfile(user.did, hasColibri);
			markBoot("profilegate:ready");
			return { needsSetup: !hasColibri, hasBluesky, returning };
		},
	);

	const needsSetup = () => gate()?.needsSetup ?? false;

	return (
		<Switch>
			<Match when={gate.loading && !skipBlocking}>
				<AppLoadingScreen message="Checking your profile..." />
			</Match>
			<Match when={gate.error !== undefined && !skipBlocking}>
				<ErrorState error={gate.error} retry={() => void refetch()} />
			</Match>
			<Match when={needsSetup()}>
				<ProfileSetupModal
					open
					hasBlueskyProfile={gate()?.hasBluesky ?? false}
					returning={gate()?.returning ?? false}
					onComplete={() => {
						rememberProfile(user.did, true);
						mutate((prev) => ({ ...prev!, needsSetup: false }));
					}}
				/>
			</Match>
			<Match when={skipBlocking || (gate() && !gate()!.needsSetup)}>
				{props.children}
			</Match>
		</Switch>
	);
};

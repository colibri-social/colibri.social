import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	createEffect,
	createResource,
	createSignal,
	type JSX,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { readStored, writeStored } from "../../data/persist";
import type { ProfileSetup } from "../../data/source";
import type { DataStore } from "../../data/store";
import { usePlatform } from "../../screen/platform";
import { WindowChrome } from "../../shell/desktop/TitleBar";
import { GateShell } from "../../shell/gate-shell";
import { LaunchScreen } from "../../shell/launch/LaunchScreen";
import { StartupError } from "../../shell/launch/StartupError";
import { setOnboardingActive } from "./onboarding-state";
import { ProfileOnboarding } from "./ProfileOnboarding";

const log = createLogger("profile-gate");

export const profileCompleteKey = (did: string) =>
	`colibri:profile-complete:${did}`;

type Incomplete = Extract<ProfileSetup, { complete: false }>;

const joinDefaultCommunity = async (store: DataStore) => {
	try {
		const community = await store.source.defaultCommunity();
		if (!community) return;
		await store.access.join(community);
	} catch (thrown) {
		const error = classifyThrown(thrown, {
			method: "social.colibri.beta.community.join",
		});
		if (error.code === "AlreadyMember") return;
		log.warn("could not join the default community", { code: error.code });
	}
};

export const ProfileGate = (props: {
	store: DataStore;
	children: JSX.Element;
}) => {
	const platform = usePlatform();
	const key = profileCompleteKey(props.store.viewer.did);
	const [done, setDone] = createSignal(readStored(key) === "1");
	const [setup, { refetch }] = createResource(() =>
		props.store.source.loadProfileSetup(),
	);

	createEffect(() => {
		if (setup.state !== "ready") return;
		const current = setup();
		writeStored(key, current.complete ? "1" : undefined);
		setDone(current.complete);
	});

	createEffect(() => setOnboardingActive(!done()));
	onCleanup(() => setOnboardingActive(false));

	const incomplete = (): Incomplete | undefined => {
		if (done() || setup.state !== "ready") return undefined;
		const current = setup();
		return current.complete ? undefined : current;
	};

	const finish = () => {
		writeStored(key, "1");
		setDone(true);
		void joinDefaultCommunity(props.store);
	};

	return (
		<Switch fallback={<LaunchScreen />}>
			<Match when={done()}>{props.children}</Match>
			<Match when={setup.state === "errored"}>
				<StartupError
					error={classifyThrown(setup.error, { method: "profile.setup" })}
					onRetry={() => void refetch()}
				/>
			</Match>
			<Match when={incomplete()}>
				{(current) => (
					<>
						<Show when={platform() === "desktop"}>
							<WindowChrome />
						</Show>
						<GateShell platform={platform()}>
							<ProfileOnboarding
								store={props.store}
								setup={current()}
								platform={platform()}
								onDone={finish}
							/>
						</GateShell>
					</>
				)}
			</Match>
		</Switch>
	);
};

import {
	ColibriError,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
import {
	type Accessor,
	createEffect,
	createSignal,
	getOwner,
	on,
	onCleanup,
	runWithOwner,
	untrack,
} from "solid-js";
import { type Auth, appViewDid, appViewHost, appViewServiceRef } from "./auth";
import { withDeadline } from "./auth/deadline";
import {
	cacheNamespace,
	clearDeviceCache,
	createMessageCache,
} from "./data/message-cache";
import { createOutboxQueue } from "./data/outbox/queue";
import { appViewOrigin, emojiBlobLocator } from "./data/remote/emoji";
import { createLiveConnection, type LiveConnection } from "./data/remote/live";
import { createRemoteSource } from "./data/remote/source";
import { installResumeSync } from "./data/resume";
import { createSpaceCache } from "./data/space-cache";
import { createDataStore, type DataStore } from "./data/store";
import { installVoiceEngine } from "./data/voice/install";
import { installBadge } from "./native/badge";
import { installNativeCall } from "./native/call";
import { deviceNotifications } from "./native/notifications/device";
import { osNotifier } from "./native/notifications/index";
import {
	bindPush,
	createPush,
	createReadSweep,
	currentPush,
	pushActivations,
	readTargets,
	teardownLeftoverPush,
} from "./native/push/index";
import {
	oauthRefreshSettled,
	QUIT_DRAIN_MS,
	setBeforeExit,
} from "./native/quit-guard";
import { reportError } from "./sentry/report";

const log = createLogger("session");

export const SESSION_START_TIMEOUT_MS = 30_000;
export const SIGN_OUT_DRAIN_MS = 2_500;

export type SignedInSession = {
	store: DataStore;
	live: LiveConnection;
	warm: boolean;
};

export type SessionState =
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "ready"; session: SignedInSession }
	| { kind: "failed"; error: ColibriError };

export const createSignedInSession = (
	auth: Auth,
	options: { startTimeoutMs?: number } = {},
) => {
	const startTimeoutMs = options.startTimeoutMs ?? SESSION_START_TIMEOUT_MS;
	const [state, setState] = createSignal<SessionState>({ kind: "idle" });
	const [attempt, setAttempt] = createSignal(0);
	let activeStore: DataStore | undefined;

	createEffect(
		on([auth.agent, attempt], ([agent]) => {
			const did = agent?.did;
			if (!agent || !did || untrack(auth.status) !== "signedIn") {
				setState({ kind: "idle" });
				return;
			}
			const owner = getOwner();
			let cancelled = false;
			let session: SignedInSession | undefined;
			let clearBeforeExit: (() => void) | undefined;
			let uninstallCall: (() => void) | undefined;
			let uninstallResume: (() => void) | undefined;
			let uninstallVoice: (() => void) | undefined;
			let uninstallBadge: (() => void) | undefined;
			let uninstallPush: (() => void) | undefined;
			let stopPreferencesGrant: (() => void) | undefined;
			const live = createLiveConnection({
				agent,
				appViewHost: appViewHost("ws"),
				serviceRef: appViewServiceRef(),
				emojiBlobUrl: emojiBlobLocator(appViewOrigin(appViewDid())),
				onAuthFailure: (error) => {
					reportError(error, { stage: "socket" });
					auth.onAuthFailure(error.code);
				},
				isSessionDead: () => auth.health.dead(),
			});
			setState({ kind: "loading" });
			const namespace = cacheNamespace(appViewDid(), did);
			const spaces = createSpaceCache({ namespace });
			const starting = spaces
				.load()
				.catch(() => undefined)
				.then((snapshot) =>
					createRemoteSource({
						session: {
							did,
							accountHost: auth.accountHost,
							fetchHandler: (path, init) =>
								agent.fetchHandler(path, init ?? {}),
						},
						appViewDid: appViewDid(),
						live,
						cachedViewer:
							snapshot?.viewer?.did === did ? snapshot.viewer : undefined,
						onScopesRejected: () => auth.health.noteScopesRejected(),
					}).then((source) => ({ source, warm: !!snapshot })),
				);
			withDeadline(
				starting,
				startTimeoutMs,
				() => new ColibriError({ code: "Timeout", method: "session.start" }),
			).then(
				({ source, warm }) => {
					if (cancelled) return;
					const cache = createMessageCache({ namespace });
					const store = createDataStore(source, {
						cache,
						spaces,
						outbox: {
							queue: createOutboxQueue({ owner: namespace }),
							held: () => auth.health.dead(),
						},
						live,
					});
					activeStore = store;
					clearBeforeExit = setBeforeExit(() =>
						Promise.all([
							store.outbox.drain(QUIT_DRAIN_MS),
							oauthRefreshSettled(did),
						]),
					);
					runWithOwner(owner, () => {
						createEffect(
							on(
								[live.status, auth.health.dead],
								([status, dead]) => {
									if (status === "open" && !dead) store.outbox.flush();
								},
								{ defer: true },
							),
						);
					});
					stopPreferencesGrant = source.startPreferencesGrant();
					uninstallCall = installNativeCall(store);
					const push = createPush({
						source,
						device: deviceNotifications(),
					});
					const sweep = createReadSweep({
						targets: () => (push.active() ? readTargets(store) : []),
						dismiss: (channels) => void push.dismissRead(channels),
					});
					const unbindPush = bindPush(push);
					const stopPush = push.watch();
					uninstallPush = () => {
						sweep.cancel();
						stopPush();
						unbindPush();
					};
					uninstallResume = installResumeSync(
						{
							catchUp: () => {
								store.catchUp();
								store.outbox.flush();
								sweep.schedule();
							},
							pauseCatchUp: store.pauseCatchUp,
						},
						live,
					);
					uninstallBadge = installBadge(store);
					uninstallVoice = installVoiceEngine({
						agent,
						appViewHost: appViewHost("ws"),
						serviceRef: appViewServiceRef(),
						viewerDid: did,
					});
					session = { store, live, warm };
					setState({ kind: "ready", session });
				},
				(thrown: unknown) => {
					if (cancelled) return;
					const error = classifyThrown(thrown, { method: "session.start" });
					log.warn("starting the session failed", { code: error.code });
					live.close();
					setState({ kind: "failed", error });
				},
			);
			onCleanup(() => {
				cancelled = true;
				uninstallCall?.();
				uninstallResume?.();
				uninstallVoice?.();
				uninstallBadge?.();
				uninstallPush?.();
				stopPreferencesGrant?.();
				clearBeforeExit?.();
				if (activeStore === session?.store) activeStore = undefined;
				session?.store.dispose();
				live.close();
			});
		}),
	);

	createEffect(
		on(auth.status, (status, previous) => {
			if (status === "signedOut" && previous && previous !== "signedOut") {
				void clearDeviceCache();
				void osNotifier().then((notifier) => notifier.clearAll());
				void teardownLeftoverPush();
			}
		}),
	);

	return {
		state: state as Accessor<SessionState>,
		retry: () => setAttempt((value) => value + 1),
		beforeSignOut: async () => {
			pushActivations.discard();
			await Promise.all([
				currentPush()?.disable(),
				activeStore?.outbox.drain(SIGN_OUT_DRAIN_MS),
			]);
		},
	};
};

import {
	ColibriError,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
import {
	type Accessor,
	createEffect,
	createSignal,
	on,
	onCleanup,
	untrack,
} from "solid-js";
import { type Auth, appViewDid, appViewHost, appViewServiceRef } from "./auth";
import { withDeadline } from "./auth/deadline";
import {
	cacheNamespace,
	clearDeviceCache,
	createMessageCache,
} from "./data/message-cache";
import { createLiveConnection, type LiveConnection } from "./data/remote/live";
import { createRemoteSource } from "./data/remote/source";
import { installResumeSync } from "./data/resume";
import { createSpaceCache } from "./data/space-cache";
import { createDataStore, type DataStore } from "./data/store";
import { installNativeCall } from "./native/call";

const log = createLogger("session");

export const SESSION_START_TIMEOUT_MS = 30_000;

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

	createEffect(
		on([auth.agent, attempt], ([agent]) => {
			const did = agent?.did;
			if (!agent || !did || untrack(auth.status) !== "signedIn") {
				setState({ kind: "idle" });
				return;
			}
			let cancelled = false;
			let session: SignedInSession | undefined;
			let uninstallCall: (() => void) | undefined;
			let uninstallResume: (() => void) | undefined;
			const live = createLiveConnection({
				agent,
				appViewHost: appViewHost("ws"),
				serviceRef: appViewServiceRef(),
				onAuthFailure: (error) => auth.onAuthFailure(error.code),
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
					const store = createDataStore(source, { cache, spaces });
					uninstallCall = installNativeCall(store);
					uninstallResume = installResumeSync(store, live);
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
				session?.store.dispose();
				live.close();
			});
		}),
	);

	createEffect(
		on(auth.status, (status, previous) => {
			if (status === "signedOut" && previous && previous !== "signedOut") {
				void clearDeviceCache();
			}
		}),
	);

	return {
		state: state as Accessor<SessionState>,
		retry: () => setAttempt((value) => value + 1),
	};
};

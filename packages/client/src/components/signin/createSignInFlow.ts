import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, on, onMount } from "solid-js";
import { toast } from "somoto";
import { isAllowedDid } from "../../atproto/allowlist";
import {
	beginSignInAttempt,
	endSignInAttempt,
	noteSignInHandle,
	startOAuthSignIn,
} from "../../atproto/auth";
import {
	type CallbackState,
	classifyCallback,
	describeOAuthError,
	readCallbackParams,
} from "../../atproto/oauth-callback";
import {
	describeThrownError,
	normalizeHandle,
	resolveHandleToDid,
} from "../../atproto/resolve-handle";
import { pdsFaviconUrl, resolvePdsHost } from "../../atproto/resolve-pds";
import { buildScopes } from "../../atproto/scopes";
import {
	type ActorTypeaheadResult,
	searchActorsTypeahead,
} from "../../atproto/xrpc/app/bsky/actor/searchActorsTypeahead";
import { useAuthContext } from "../../contexts/Auth";
import { getAppViewDid } from "../../utils/appview";
import { createLogger } from "../../utils/logger";
import { type Provider, providerLogoForHost } from "./providers";

const log = createLogger("sign-in");

export type SignInMode = "signin" | "signup";

export type SignInStep = "handle" | "confirm" | "provider" | "handoff";

export type SignInIdentity = {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
};

export type SignInTarget = {
	host: string;
	icon?: string;
};

const FRAGMENT_BY_STEP: Record<SignInStep, string> = {
	handle: "handle",
	confirm: "account",
	provider: "provider",
	handoff: "continue",
};

const STEP_BY_FRAGMENT: Record<string, SignInStep> = {
	handle: "handle",
	account: "confirm",
	provider: "provider",
	continue: "handoff",
};

const NOT_ON_LIST =
	"Colibri is in limited early access and this account is not on the list yet.";

const MISSING_HANDLE =
	"Enter your handle to continue, for example alice.bsky.social.";

export const createSignInFlow = (config: { mode?: SignInMode } = {}) => {
	const auth = useAuthContext();
	const navigate = useNavigate();
	const location = useLocation();

	const [mode, setMode] = createSignal<SignInMode>(config.mode ?? "signin");
	const [step, setStep] = createSignal<SignInStep>(
		config.mode === "signup" ? "provider" : "handle",
	);
	const [handle, setHandle] = createSignal("");
	const [options, setOptions] = createSignal<Array<ActorTypeaheadResult>>([]);
	const [identity, setIdentity] = createSignal<SignInIdentity | null>(null);
	const [provider, setProvider] = createSignal<Provider | null>(null);
	const [target, setTarget] = createSignal<SignInTarget | null>(null);
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const callbackParams = readCallbackParams();
	const callback: CallbackState = classifyCallback(callbackParams);

	let suggestController: AbortController | undefined;

	onMount(() => {
		if (callback !== "failed" || !callbackParams) return;
		toast.error("Sign-in failed", {
			description: describeOAuthError(callbackParams),
		});
		history.replaceState(
			null,
			"",
			window.location.pathname + window.location.search,
		);
	});

	createEffect(() => {
		if (auth?.loggedIn) navigate("/app");
	});

	const entryStep = (): SignInStep =>
		mode() === "signup" ? "provider" : "handle";

	const goToStep = (next: SignInStep, replace = false) => {
		setStep(next);
		navigate(
			`${location.pathname}${location.search}#${FRAGMENT_BY_STEP[next]}`,
			{ replace, scroll: false },
		);
	};

	const fragment = () => location.hash.replace(/^#/, "");

	createEffect(
		on(fragment, (raw) => {
			if (callback) return;

			const target = STEP_BY_FRAGMENT[raw];
			if (!target) {
				goToStep(entryStep(), true);
				return;
			}
			if (target === step()) return;

			const reachable =
				target === "handle" ||
				target === "provider" ||
				(target === "confirm" && identity() !== null) ||
				(target === "handoff" && (identity() !== null || provider() !== null));

			if (!reachable) {
				goToStep(entryStep(), true);
				return;
			}

			if (target === "provider") setMode("signup");
			if (target === "handle" || target === "confirm") setMode("signin");

			setStep(target);
		}),
	);

	const stepCount = () => (mode() === "signin" ? 3 : 2);

	const stepIndex = () => {
		if (mode() === "signup") return step() === "provider" ? 1 : 2;
		if (step() === "handle") return 1;
		if (step() === "confirm") return 2;
		return 3;
	};

	const onHandleInput = async (value: string) => {
		setHandle(value);
		setError(null);

		suggestController?.abort();

		if (value.trim().length === 0) {
			setOptions([]);
			return;
		}

		const controller = new AbortController();
		suggestController = controller;

		const results = await searchActorsTypeahead(value, controller.signal);
		if (controller.signal.aborted) return;

		setOptions(results);
	};

	const lookupProfile = async (
		did: string,
		normalized: string,
	): Promise<SignInIdentity> => {
		const known = options().find(
			(o) => o.handle === normalized || o.did === did,
		);
		if (known) return known;

		const results = await searchActorsTypeahead(normalized).catch(() => []);
		const match = results.find((r) => r.handle === normalized || r.did === did);

		return match ?? { did, handle: normalized };
	};

	const submitHandle = async () => {
		if (busy()) return;

		const input = normalizeHandle(handle());
		if (input.length === 0) {
			setError(MISSING_HANDLE);
			return;
		}

		setBusy(true);
		setError(null);

		try {
			const did = await resolveHandleToDid(input);

			if (!isAllowedDid(did)) {
				setError(NOT_ON_LIST);
				return;
			}

			setIdentity(await lookupProfile(did, input));
			goToStep("confirm");
		} catch (err) {
			log.error("resolving handle failed", { error: err });
			setError(describeThrownError(err));
		} finally {
			setBusy(false);
		}
	};

	const pickAccount = (result: ActorTypeaheadResult) => {
		if (!isAllowedDid(result.did)) {
			setHandle(result.handle);
			setError(NOT_ON_LIST);
			return;
		}
		setHandle(result.handle);
		setIdentity(result);
		setError(null);
		goToStep("confirm");
	};

	const confirmIdentity = async () => {
		const account = identity();
		if (!account || busy()) return;

		setBusy(true);
		setError(null);

		try {
			const host = await resolvePdsHost(account.did);
			setTarget(
				host
					? { host, icon: providerLogoForHost(host) ?? pdsFaviconUrl(host) }
					: null,
			);
			goToStep("handoff");
		} finally {
			setBusy(false);
		}
	};

	const chooseProvider = (picked: Provider) => {
		if (busy()) return;

		setProvider(picked);
		setTarget({ host: picked.host, icon: picked.logo });
		setError(null);
		goToStep("handoff");
	};

	const openProvider = async () => {
		if (busy() || !auth) return;

		const signingUp = mode() === "signup";
		const picked = provider();
		const account = identity();
		if (signingUp ? !picked : !account) return;

		setBusy(true);
		setError(null);

		if (!signingUp && account) {
			beginSignInAttempt();
			noteSignInHandle(account.handle);
		}

		try {
			await startOAuthSignIn(
				auth.client,
				signingUp && picked ? `https://${picked.host}` : (account?.did ?? ""),
				{
					scope: buildScopes(getAppViewDid()).join(" "),
					...(signingUp ? { prompt: "create" as const } : {}),
				},
			);
		} catch (err) {
			log.error("handing off to the provider failed", { error: err });
			setError(describeThrownError(err));
		} finally {
			if (!signingUp) endSignInAttempt();
			setBusy(false);
		}
	};

	const switchMode = (next: SignInMode) => {
		setMode(next);
		setError(null);
		setProvider(null);
		setTarget(null);
		goToStep(next === "signin" ? "handle" : "provider");
	};

	const back = () => {
		setError(null);
		if (!canGoBack()) return;
		history.back();
	};

	const canGoBack = () => step() === "confirm" || step() === "handoff";

	const reset = () => {
		goToStep(entryStep(), true);
		setHandle("");
		setOptions([]);
		setIdentity(null);
		setProvider(null);
		setTarget(null);
		setError(null);
	};

	return {
		callback,
		mode,
		step,
		stepIndex,
		stepCount,
		handle,
		options,
		identity,
		provider,
		target,
		busy,
		error,
		onHandleInput,
		submitHandle,
		pickAccount,
		confirmIdentity,
		chooseProvider,
		openProvider,
		switchMode,
		back,
		canGoBack,
		reset,
	};
};

export type SignInFlow = ReturnType<typeof createSignInFlow>;

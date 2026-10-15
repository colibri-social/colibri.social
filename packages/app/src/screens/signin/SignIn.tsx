import type { ColibriError, ErrorCopy } from "@colibri-social/lib";
import {
	CreateAccountScreen,
	EntranceText,
	type HandleSuggestion,
	OnboardingActions,
	OnboardingFlow,
	type OnboardingPlatform,
	type OnboardingStepItem,
	onboardingStepItems,
	SignInScreen,
	Spinner,
	WelcomeScreen,
} from "@colibri-social/ui";
import {
	createSignal,
	type JSX,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import type { Auth } from "../../auth/auth";
import {
	type AccountSuggestion,
	cachedAccounts,
	cachedPrefixAccounts,
	searchAccounts,
} from "../../auth/identity";
import {
	signupHostLabel,
	signupPdsUrl,
	supportsSignup,
} from "../../auth/signup";
import { copyForCode, describeError } from "../../data/error-copy";

const SIGNUP_UNAVAILABLE: ErrorCopy = {
	title: "Sign-up isn't available right now",
	description: "You can still sign in with an account you already have.",
};

const PROVIDER_WITHOUT_SPACES: ErrorCopy = {
	title: "Your account's provider doesn't support Spaces yet",
	description:
		"Colibri keeps your Spaces with the provider that holds your account, and yours can't do that so far. Create an account with a provider that supports Spaces to use Colibri.",
};

const isSpacesUnsupported = (failure: ColibriError) =>
	failure.code === "SpacesUnsupported";

type SignedOutStep = "welcome" | "sign-in" | "create-account";

const TITLES: Record<SignedOutStep, string> = {
	welcome: "Welcome to Colibri Social",
	"sign-in": "Sign in",
	"create-account": "Create an account",
};

const SIGNED_OUT_PHASES = new Set(["welcome", "sign-in"]);

const NO_RECORDS = { colibriProfile: false, blueskyProfile: false };

const titleClass =
	"m-0 w-full text-center text-4xl leading-tight font-extrabold text-balance";
const descriptionClass =
	"m-0 w-full text-center text-base font-medium text-balance text-muted-foreground";

const ErrorMessage = (props: { copy: ErrorCopy }) => (
	<span data-sign-in-error="">
		{props.copy.description
			? `${props.copy.title}. ${props.copy.description}`
			: props.copy.title}
	</span>
);

const stepItems = (step: SignedOutStep): OnboardingStepItem[] =>
	onboardingStepItems(step, NO_RECORDS)
		.filter((item) => SIGNED_OUT_PHASES.has(item.id))
		.map((item) =>
			item.id === "welcome" && item.status === "completed"
				? { ...item, target: "welcome" }
				: item,
		);

export const createAccountSearch = (
	search: (query: string, signal: AbortSignal) => Promise<AccountSuggestion[]>,
	peek: (query: string) => AccountSuggestion[] | undefined = (value) =>
		cachedAccounts(value) ?? cachedPrefixAccounts(value),
) => {
	const [suggestions, setSuggestions] = createSignal<HandleSuggestion[]>([]);
	let controller: AbortController | undefined;
	const query = (value: string) => {
		controller?.abort();
		if (!value) {
			setSuggestions([]);
			return;
		}
		const early = peek(value);
		if (early) setSuggestions(early);
		const current = new AbortController();
		controller = current;
		void search(value, current.signal).then((results) => {
			if (!current.signal.aborted) setSuggestions(results);
		});
	};
	onCleanup(() => controller?.abort());
	return { suggestions, query };
};

export type SignInFlowProps = {
	auth: Auth;
	platform: OnboardingPlatform;
	search?: (query: string, signal: AbortSignal) => Promise<AccountSuggestion[]>;
	signupPds?: string | null;
	checkSignup?: (pdsUrl: string) => Promise<boolean>;
};

export const SignInFlow = (props: SignInFlowProps) => {
	const resumed = () =>
		props.auth.status() === "expired" || props.auth.error() !== undefined;
	const [step, setStep] = createSignal<SignedOutStep>(
		resumed() ? "sign-in" : "welcome",
	);
	const accounts = createAccountSearch(props.search ?? searchAccounts);
	const signupPds = () =>
		props.signupPds === null ? undefined : (props.signupPds ?? signupPdsUrl());
	const [checkingSignup, setCheckingSignup] = createSignal(false);
	const [signupBlocked, setSignupBlocked] = createSignal(false);

	const startSignup = async () => {
		const pds = signupPds();
		if (!pds || checkingSignup() || props.auth.phase()) return;
		props.auth.clearError();
		setSignupBlocked(false);
		setCheckingSignup(true);
		const supported = await (props.checkSignup ?? supportsSignup)(pds);
		setCheckingSignup(false);
		if (!supported) {
			setSignupBlocked(true);
			return;
		}
		await props.auth.signIn(pds, { create: true });
	};

	const signupHost = () => {
		const pds = signupPds();
		return pds ? signupHostLabel(pds) : undefined;
	};

	const signupNotice = (): ErrorCopy | undefined => {
		if (signupBlocked()) return SIGNUP_UNAVAILABLE;
		const failure = props.auth.error();
		if (failure && isSpacesUnsupported(failure)) return SIGNUP_UNAVAILABLE;
		return failure ? describeError(failure) : undefined;
	};

	const notice = (): ErrorCopy | undefined => {
		const failure: ColibriError | undefined = props.auth.error();
		if (failure && isSpacesUnsupported(failure)) return PROVIDER_WITHOUT_SPACES;
		if (failure) return describeError(failure);
		const expired = props.auth.status() === "expired";
		if (expired) return copyForCode(props.auth.expiredCode() ?? "ExpiredToken");
		return undefined;
	};

	const goTo = (next: SignedOutStep) => {
		props.auth.clearError();
		setSignupBlocked(false);
		setStep(next);
	};

	const back = (): (() => void) | undefined => {
		if (props.auth.phase()) return undefined;
		if (step() === "sign-in") return () => goTo("welcome");
		if (step() === "create-account") return () => goTo("sign-in");
		return undefined;
	};

	const browserWait = (): JSX.Element => (
		<div
			data-onboarding-screen="browser"
			class="flex w-full flex-col items-center gap-4"
		>
			<EntranceText
				as="h1"
				group={0}
				class={titleClass}
				lines="Finish signing in in your browser"
			/>
			<EntranceText
				group={1}
				class={descriptionClass}
				lines="We opened your browser. Sign in there, and Colibri picks up right where you left off."
			/>
			<OnboardingActions
				group={2}
				inline="grid"
				back={{ label: "Back", onClick: () => props.auth.cancelSignIn() }}
				primary={{
					label: "Try again",
					onClick: () => {
						props.auth.cancelSignIn();
						setStep("sign-in");
					},
				}}
			/>
		</div>
	);

	return (
		<OnboardingFlow
			platform={props.platform}
			title={TITLES[step()]}
			steps={stepItems(step())}
			onStepSelect={(target) => {
				if (target === "welcome" || target === "sign-in") goTo(target);
			}}
			onBack={back()}
		>
			<Switch>
				<Match when={props.auth.phase() === "browser"}>{browserWait()}</Match>
				<Match when={step() === "welcome"}>
					<WelcomeScreen onStart={() => goTo("sign-in")} />
				</Match>
				<Match when={step() === "sign-in"}>
					<SignInScreen
						handleSuggestions={accounts.suggestions()}
						onHandleQuery={accounts.query}
						onHandleChange={() => props.auth.clearError()}
						onSignIn={(handle, account) =>
							void props.auth.signIn(account?.did ?? handle)
						}
						onCreateAccount={
							signupPds() ? () => goTo("create-account") : undefined
						}
						loading={props.auth.phase() !== undefined}
						error={
							<Show when={notice()}>
								{(copy) => <ErrorMessage copy={copy()} />}
							</Show>
						}
					/>
				</Match>
				<Match when={step() === "create-account"}>
					<CreateAccountScreen
						host={signupHost()}
						onBack={() => goTo("sign-in")}
						onContinue={() => void startSignup()}
						loading={checkingSignup() || props.auth.phase() !== undefined}
						error={
							<Show when={signupNotice()}>
								{(copy) => <ErrorMessage copy={copy()} />}
							</Show>
						}
					/>
				</Match>
			</Switch>
		</OnboardingFlow>
	);
};

export const SigningInScreen = (props: { platform: OnboardingPlatform }) => (
	<OnboardingFlow platform={props.platform} title="Signing you in">
		<div
			data-onboarding-screen="completing"
			role="status"
			class="flex w-full flex-col items-center gap-6"
		>
			<Spinner size={32} label="Signing you in" />
			<EntranceText
				as="h1"
				group={0}
				class={titleClass}
				lines="Signing you in"
			/>
		</div>
	</OnboardingFlow>
);

export type ReapproveScreenProps = {
	auth: Auth;
	platform: OnboardingPlatform;
};

export const ReapproveScreen = (props: ReapproveScreenProps) => {
	const copy = () => copyForCode("ScopesMissing");
	return (
		<OnboardingFlow platform={props.platform} title={copy().title}>
			<div
				data-onboarding-screen="reapprove"
				class="flex w-full flex-col items-center gap-4"
			>
				<EntranceText
					as="h1"
					group={0}
					class={titleClass}
					lines={copy().title}
				/>
				<EntranceText
					group={1}
					class={descriptionClass}
					lines={copy().description ?? ""}
				/>
				<Show when={props.auth.error()}>
					{(failure) => (
						<p
							role="alert"
							class="m-0 text-center text-sm font-medium text-destructive"
						>
							<ErrorMessage copy={describeError(failure())} />
						</p>
					)}
				</Show>
				<OnboardingActions
					group={2}
					inline="grid"
					secondary={{
						label: "Sign out",
						onClick: () => void props.auth.signOut(),
					}}
					primary={{
						label: "Continue",
						loading: props.auth.phase() !== undefined,
						onClick: () => void props.auth.reauthorize(),
					}}
				/>
			</div>
		</OnboardingFlow>
	);
};

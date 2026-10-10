import { type Accessor, createMemo, createSignal } from "solid-js";
import type { NotificationPermissionResult } from "./OnboardingScreens";
import {
	firstProfileStep,
	nextProfileStep,
	type OnboardingStep,
	type OnboardingStepItem,
	onboardingDot,
	onboardingStepItems,
	previousProfileStep,
} from "./onboarding-steps";
import type {
	ProfileSetupRecords,
	ProfileSetupSource,
} from "./ProfileSetupPicker";

export type OnboardingProfile = {
	displayName: string;
	nameColor?: string;
	pronouns?: string;
	bio?: string;
	themeColors?: string[];
};

export type OnboardingResult = {
	source: ProfileSetupSource;
	profile?: OnboardingProfile;
	notifications: NotificationPermissionResult;
};

export type CreateOnboardingOptions = {
	records: Accessor<ProfileSetupRecords>;
	start?: OnboardingStep;
	onComplete?: (result: OnboardingResult) => void;
};

export type OnboardingController = {
	step: Accessor<OnboardingStep>;
	source: Accessor<ProfileSetupSource>;
	items: Accessor<OnboardingStepItem[]>;
	dot: Accessor<number | undefined>;
	result: Accessor<OnboardingResult | undefined>;
	canGoBack: Accessor<boolean>;
	goTo: (step: OnboardingStep) => void;
	setSource: (source: ProfileSetupSource) => void;
	signedIn: () => void;
	next: () => void;
	back: () => void;
	saveProfile: (profile: OnboardingProfile) => void;
	finish: (notifications: NotificationPermissionResult) => void;
};

const SIGNED_OUT_BACK: Partial<Record<OnboardingStep, OnboardingStep>> = {
	"sign-in": "welcome",
	"create-account": "sign-in",
};

export const defaultProfileSource = (
	records: ProfileSetupRecords,
): ProfileSetupSource =>
	records.colibriProfile
		? "existing"
		: records.blueskyProfile
			? "bluesky"
			: "scratch";

export const createOnboarding = (
	options: CreateOnboardingOptions,
): OnboardingController => {
	const [step, setStep] = createSignal<OnboardingStep>(
		options.start ?? "welcome",
	);
	const [chosen, setChosen] = createSignal<ProfileSetupSource>();
	const [profile, setProfile] = createSignal<OnboardingProfile>();
	const [result, setResult] = createSignal<OnboardingResult>();

	const source = createMemo(() => {
		const records = options.records();
		const wanted = chosen();
		if (wanted === "existing" && records.colibriProfile) return wanted;
		if (wanted === "bluesky" && records.blueskyProfile) return wanted;
		if (wanted === "scratch") return wanted;
		return defaultProfileSource(records);
	});

	const previous = () => {
		const current = step();
		return (
			SIGNED_OUT_BACK[current] ??
			previousProfileStep(current, options.records(), source())
		);
	};

	const next = () => {
		const following = nextProfileStep(step(), options.records(), source());
		if (following) setStep(following);
	};

	return {
		step,
		source,
		items: () => onboardingStepItems(step(), options.records()),
		dot: () => onboardingDot(step()),
		result,
		canGoBack: () => previous() !== undefined,
		goTo: setStep,
		setSource: setChosen,
		signedIn: () => setStep(firstProfileStep(options.records())),
		next,
		back: () => {
			const target = previous();
			if (target) setStep(target);
		},
		saveProfile: (value) => {
			setProfile(value);
			next();
		},
		finish: (notifications) => {
			const done: OnboardingResult = {
				source: source(),
				profile: source() === "existing" ? undefined : profile(),
				notifications,
			};
			setResult(done);
			options.onComplete?.(done);
		},
	};
};

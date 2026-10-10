import type {
	ProfileSetupRecords,
	ProfileSetupSource,
} from "./ProfileSetupPicker";

export type OnboardingStep =
	| "welcome"
	| "sign-in"
	| "create-account"
	| "profile-source"
	| "profile-editor"
	| "notifications";

export const SIGNED_OUT_STEPS: OnboardingStep[] = [
	"welcome",
	"sign-in",
	"create-account",
];

export const hasProfileChoice = (records: ProfileSetupRecords) =>
	records.colibriProfile || records.blueskyProfile;

export const profileSteps = (
	records: ProfileSetupRecords,
	source?: ProfileSetupSource,
): OnboardingStep[] => {
	if (!hasProfileChoice(records)) return ["profile-editor", "notifications"];
	if (source === "existing") return ["profile-source", "notifications"];
	return ["profile-source", "profile-editor", "notifications"];
};

export const firstProfileStep = (records: ProfileSetupRecords) =>
	profileSteps(records)[0];

export const nextProfileStep = (
	current: OnboardingStep,
	records: ProfileSetupRecords,
	source?: ProfileSetupSource,
): OnboardingStep | undefined => {
	const steps = profileSteps(records, source);
	const index = steps.indexOf(current);
	return index < 0 ? steps[0] : steps[index + 1];
};

export const previousProfileStep = (
	current: OnboardingStep,
	records: ProfileSetupRecords,
	source?: ProfileSetupSource,
): OnboardingStep | undefined => {
	const steps = profileSteps(records, source);
	const index = steps.indexOf(current);
	return index > 0 ? steps[index - 1] : undefined;
};

export const ONBOARDING_DOT_COUNT = 2;

export const onboardingDot = (step: OnboardingStep): number | undefined => {
	if (step === "profile-source" || step === "profile-editor") return 0;
	if (step === "notifications") return 1;
	return undefined;
};

export type OnboardingPhase =
	| "welcome"
	| "sign-in"
	| "profile"
	| "notifications";

export const ONBOARDING_PHASES: { id: OnboardingPhase; label: string }[] = [
	{ id: "welcome", label: "Welcome" },
	{ id: "sign-in", label: "Sign in" },
	{ id: "profile", label: "Profile" },
	{ id: "notifications", label: "Notifications" },
];

export const phaseOf = (step: OnboardingStep): OnboardingPhase => {
	if (step === "welcome") return "welcome";
	if (step === "sign-in" || step === "create-account") return "sign-in";
	if (step === "notifications") return "notifications";
	return "profile";
};

const SIGNED_IN_PHASES = new Set<OnboardingPhase>(["profile", "notifications"]);

export type OnboardingStepStatus = "completed" | "current" | "upcoming";

export type OnboardingStepItem = {
	id: OnboardingPhase;
	label: string;
	status: OnboardingStepStatus;
	target?: OnboardingStep;
};

export const onboardingStepItems = (
	step: OnboardingStep,
	records: ProfileSetupRecords,
): OnboardingStepItem[] => {
	const current = ONBOARDING_PHASES.findIndex(
		(phase) => phase.id === phaseOf(step),
	);
	const signedIn = SIGNED_IN_PHASES.has(phaseOf(step));
	const targets: Record<OnboardingPhase, OnboardingStep> = {
		welcome: "welcome",
		"sign-in": "sign-in",
		profile: firstProfileStep(records),
		notifications: "notifications",
	};
	return ONBOARDING_PHASES.map((phase, index) => {
		const status: OnboardingStepStatus =
			index < current
				? "completed"
				: index === current
					? "current"
					: "upcoming";
		const reachable =
			status === "completed" && SIGNED_IN_PHASES.has(phase.id) === signedIn;
		return {
			...phase,
			status,
			target: reachable ? targets[phase.id] : undefined,
		};
	});
};

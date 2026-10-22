import { createSignal } from "solid-js";

const [onboarding, setOnboarding] = createSignal(false);

export const onboardingActive = onboarding;

export const setOnboardingActive = (active: boolean) => setOnboarding(active);

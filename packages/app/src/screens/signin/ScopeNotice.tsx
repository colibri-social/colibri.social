import { type OnboardingPlatform, PermissionNotice } from "@colibri-social/ui";
import { createMemo } from "solid-js";
import type { Auth, ScopeNotice as ScopeNoticeState } from "../../auth/auth";
import { UNATTRIBUTED_REJECTION } from "../../auth/session-health";
import { describeError } from "../../data/error-copy";
import { onboardingActive } from "../onboarding/onboarding-state";

const featureList = new Intl.ListFormat("en", {
	style: "long",
	type: "conjunction",
});

const inSentence = (label: string) =>
	label.charAt(0).toLowerCase() + label.slice(1);

export const SCOPE_NOTICE_DESCRIPTION = "Review it to keep everything working.";

export const scopeNoticeTitle = (notice: ScopeNoticeState): string => {
	if (notice.features.length === 0) {
		return "Colibri needs another permission.";
	}
	const features = featureList.format(notice.features.map(inSentence));
	const named = notice.methods.filter(
		(method) => method !== UNATTRIBUTED_REJECTION,
	);
	return named.length > 1
		? `Colibri needs a few more permissions for ${features}.`
		: `Colibri needs one more permission for ${features}.`;
};

export const ScopeNotice = (props: {
	auth: Auth;
	platform: OnboardingPlatform;
}) => {
	let last: ScopeNoticeState | undefined;
	const shown = createMemo(() => {
		const current = props.auth.scopeNotice();
		if (current) last = current;
		return current ?? last;
	});
	const title = createMemo(() => {
		const current = shown();
		return current ? scopeNoticeTitle(current) : "";
	});
	const description = () => {
		const error = props.auth.error();
		return error ? describeError(error).title : SCOPE_NOTICE_DESCRIPTION;
	};
	return (
		<PermissionNotice
			platform={props.platform}
			visible={props.auth.scopeNotice() !== undefined && !onboardingActive()}
			title={title()}
			description={description()}
			reviewing={props.auth.phase() !== undefined}
			onReview={() => void props.auth.reauthorize()}
			onDismiss={() => {
				props.auth.clearError();
				props.auth.dismissScopeNotice();
			}}
		/>
	);
};

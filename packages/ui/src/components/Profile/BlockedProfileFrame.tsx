import { UserBlockIcon } from "@solar-icons/solid/bold/user-block";
import {
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	on,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import type { ProfileData } from "./ProfileContent";

export const BLOCKED_PROFILE_COPY = {
	notice: "You blocked this person",
	show: "Show profile",
	unblock: "Unblock",
} as const;

export type BlockedProfileFrameProps = {
	profile: ProfileData;
	open?: boolean;
	class?: string;
	children: JSX.Element;
};

const profileIdentity = (profile: ProfileData) => {
	return `${profile.avatarSeed ?? ""}|${profile.handle}`;
};

const focusLost = () => {
	const active = document.activeElement;

	return !active || active === document.body || !active.isConnected;
};

export const BlockedProfileFrame = (props: BlockedProfileFrameProps) => {
	const [revealed, setRevealed] = createSignal(false);
	const identity = createMemo(() => profileIdentity(props.profile));
	const blocked = createMemo(() => !!props.profile.blocked);
	const open = createMemo(() => props.open);
	const hidden = () => blocked() && !revealed();
	let root: HTMLDivElement | undefined;

	createEffect(
		on([identity, blocked, open], () => setRevealed(false), { defer: true }),
	);

	createEffect(
		on(hidden, (isHidden, wasHidden) => {
			if (isHidden || !wasHidden || !focusLost()) return;
			root?.focus({ preventScroll: true });
		}),
	);

	return (
		<div
			ref={root}
			tabIndex={-1}
			data-blocked-profile={blocked() ? "" : undefined}
			data-blocked-profile-hidden={hidden() ? "" : undefined}
			data-layout-clip={hidden() ? "" : undefined}
			class={cx(
				"relative outline-none",
				blocked() && "overflow-hidden",
				hidden() && "max-h-90",
				props.class,
			)}
		>
			<div
				inert={hidden()}
				aria-hidden={hidden() ? "true" : undefined}
				class={cx(
					"transition-[filter] duration-[calc(150ms*var(--motion-scale))] motion-reduce:transition-none reduced-motion:transition-none",
					hidden() && "blur-md select-none",
				)}
			>
				{props.children}
			</div>
			<Show when={hidden()}>
				<div
					data-blocked-profile-notice=""
					class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-popover/60 p-6 text-center"
				>
					<span class="flex text-muted-foreground [&>svg]:size-8">
						<UserBlockIcon />
					</span>
					<p class="m-0 text-base font-semibold text-foreground">
						{BLOCKED_PROFILE_COPY.notice}
					</p>
					<div class="flex flex-wrap items-center justify-center gap-2">
						<Button variant="secondary" onClick={() => setRevealed(true)}>
							{BLOCKED_PROFILE_COPY.show}
						</Button>
						<Show when={props.profile.onUnblock}>
							{(unblock) => (
								<Button variant="tertiary" onClick={() => unblock()()}>
									{BLOCKED_PROFILE_COPY.unblock}
								</Button>
							)}
						</Show>
					</div>
				</div>
			</Show>
		</div>
	);
};

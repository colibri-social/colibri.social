import { createSignal, type JSX, onCleanup, Show } from "solid-js";
import { PdslsLogo } from "../../icons/animated/brand";
import { AnimatedCopyIcon } from "../../icons/animated/icons";
import { copyText } from "../../utils/clipboard";
import { cx } from "../../utils/cx";
import { Button, buttonVariants } from "../Button/Button";

const COPIED_MS = 1500;

export type DeveloperModeCardProps = {
	label?: JSX.Element;
	copyLabel?: string;
	copyValue?: string;
	onCopy?: () => void;
	pdslsHref?: string;
	pdslsLabel?: string;
	class?: string;
};

export const DeveloperModeCard = (props: DeveloperModeCardProps) => {
	const [copied, setCopied] = createSignal(false);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(resetTimer));

	const markCopied = () => {
		clearTimeout(resetTimer);
		setCopied(true);
		resetTimer = setTimeout(() => setCopied(false), COPIED_MS);
	};

	const copy = async (anchor: HTMLElement) => {
		if (
			props.copyValue !== undefined &&
			!(await copyText(props.copyValue, anchor))
		)
			return;
		props.onCopy?.();
		markCopied();
	};

	return (
		<section
			aria-label={
				typeof props.label === "string" ? props.label : "Developer mode"
			}
			data-developer-mode=""
			class={cx(
				"flex flex-col gap-2 rounded-surface border border-border bg-popover p-3",
				props.class,
			)}
		>
			<p class="text-sm text-foreground">{props.label ?? "Developer mode"}</p>
			<div class="flex gap-2">
				<Button
					variant="secondary"
					class="min-w-0 flex-1 px-3"
					data-copied={copied() || undefined}
					icon={<AnimatedCopyIcon copied={copied()} />}
					onClick={(event) => void copy(event.currentTarget)}
				>
					<span class="truncate">{props.copyLabel ?? "Copy DID"}</span>
				</Button>
				<Show when={props.pdslsHref}>
					{(href) => (
						<a
							href={href()}
							target="_blank"
							rel="noreferrer"
							class={cx(
								buttonVariants({ variant: "secondary" }),
								"min-w-0 flex-1 px-3",
							)}
						>
							<PdslsLogo class="size-4 shrink-0" />
							<span class="truncate">
								{props.pdslsLabel ?? "Show on PDSls"}
							</span>
						</a>
					)}
				</Show>
			</div>
			<span role="status" class="sr-only">
				{copied() ? "Copied" : ""}
			</span>
		</section>
	);
};

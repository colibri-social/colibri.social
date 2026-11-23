import { createUniqueId, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { BridgeLinks, type BridgeLinksProps } from "./BridgeLinks";

export type BridgeLinkStepProps = Omit<
	BridgeLinksProps,
	"title" | "headingLevel" | "class"
> & {
	saving?: boolean;
	saveDisabled?: boolean;
	onSave?: () => void;
	onSkip?: () => void;
	class?: string;
};

export const BridgeLinkStep = (props: BridgeLinkStepProps) => {
	const headingId = createUniqueId();
	const [local, links] = splitProps(props, [
		"saving",
		"saveDisabled",
		"onSave",
		"onSkip",
		"class",
	]);
	const mobile = () => props.platform === "mobile";

	return (
		<section
			data-bridge-link-step=""
			aria-labelledby={headingId}
			class={cx("flex w-full min-w-0 flex-col gap-6", local.class)}
		>
			<div class="flex flex-col gap-1">
				<h2 id={headingId} class="m-0 text-lg font-semibold text-foreground">
					Choose channels to link
				</h2>
				<p class="m-0 text-sm leading-prose text-pretty text-muted-foreground">
					Channels stay unlinked until you pick a room for them, and you can
					change this any time in the bridge settings.
				</p>
			</div>
			<BridgeLinks {...links} title="Channels" headingLevel={3} />
			<div
				data-bridge-link-step-actions=""
				class={cx(
					"flex gap-2",
					mobile() ? "flex-col" : "flex-row-reverse justify-start",
				)}
			>
				<Button
					block={mobile()}
					loading={local.saving}
					disabled={local.saveDisabled || props.loading}
					onClick={() => local.onSave?.()}
				>
					Save
				</Button>
				<Button
					block={mobile()}
					variant="secondary"
					disabled={local.saving}
					onClick={() => local.onSkip?.()}
				>
					Skip
				</Button>
			</div>
		</section>
	);
};

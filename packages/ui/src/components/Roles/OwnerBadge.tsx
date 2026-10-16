import { CrownIcon } from "@solar-icons/solid/bold/crown";
import { Show } from "solid-js";
import { cx } from "../../utils/cx";
import { BadgeInfo } from "../Badge/BadgeInfo";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";

export const OWNER_BADGE_LABEL = "Space Owner";

export type OwnerBadgeProps = {
	interactive?: boolean;
	class?: string;
};

const glyphClass =
	"flex size-4 shrink-0 items-center justify-center text-warning [&>svg]:size-4";

export const OwnerBadge = (props: OwnerBadgeProps) => (
	<Show
		when={props.interactive ?? true}
		fallback={
			<Tooltip placement="top">
				<TooltipTrigger
					as="span"
					role="img"
					aria-label={OWNER_BADGE_LABEL}
					data-owner-badge=""
					class={cx(glyphClass, props.class)}
				>
					<CrownIcon />
				</TooltipTrigger>
				<TooltipContent>{OWNER_BADGE_LABEL}</TooltipContent>
			</Tooltip>
		}
	>
		<BadgeInfo
			name={OWNER_BADGE_LABEL}
			label={OWNER_BADGE_LABEL}
			class={props.class}
		>
			<span data-owner-badge="" class={glyphClass}>
				<CrownIcon />
			</span>
		</BadgeInfo>
	</Show>
);

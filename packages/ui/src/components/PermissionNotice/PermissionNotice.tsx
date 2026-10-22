import { ShieldKeyholeIcon } from "@solar-icons/solid/bold/shield-keyhole";
import { CloseIcon } from "@solar-icons/solid/linear/close";
import { createUniqueId, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { cx } from "../../utils/cx";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { Spinner } from "../Spinner/Spinner";

export type PermissionNoticePlatform = "mobile" | "desktop";

export type PermissionNoticeProps = {
	platform: PermissionNoticePlatform;
	visible: boolean;
	title: string;
	description?: string;
	reviewLabel?: string;
	dismissLabel?: string;
	reviewing?: boolean;
	onReview: () => void;
	onDismiss: () => void;
	animate?: boolean;
	mount?: Node;
	class?: string;
};

export const PERMISSION_NOTICE_INSET: Record<
	PermissionNoticePlatform,
	{ top: number; side: number }
> = {
	mobile: { top: 12, side: 12 },
	desktop: { top: 12, side: 16 },
};

const motion =
	"transition-[opacity,translate,filter] ease-out motion-reduce:transition-none reduced-motion:transition-none data-[visible]:duration-[calc(200ms*var(--motion-scale))] not-data-[visible]:duration-[calc(150ms*var(--motion-scale))] not-data-[visible]:blur-[4px]";

export const PermissionNotice = (props: PermissionNoticeProps) => {
	const titleId = createUniqueId();
	const descriptionId = createUniqueId();
	const mobile = () => props.platform === "mobile";
	const inset = () => PERMISSION_NOTICE_INSET[props.platform];
	return (
		<Portal mount={props.mount}>
			<div
				{...topLayerAttrs}
				ref={(element) => revealLayer(element)}
				data-permission-notice-slot=""
				data-platform={props.platform}
				data-visible={props.visible || undefined}
				inert={!props.visible || undefined}
				aria-hidden={props.visible ? undefined : "true"}
				class={cx(
					"pointer-events-none fixed inset-x-0 z-[85] flex justify-center",
					props.animate !== false && motion,
					props.visible ? "opacity-100" : "-translate-y-1 opacity-0",
					props.class,
				)}
				style={{
					top: `calc(${inset().top}px + var(--overlay-top, 0px))`,
					"padding-left": `calc(${inset().side}px + var(--safe-area-left, 0px))`,
					"padding-right": `calc(${inset().side}px + var(--safe-area-right, 0px))`,
				}}
			>
				<section
					data-permission-notice=""
					role="status"
					aria-live="polite"
					aria-labelledby={titleId}
					aria-describedby={props.description ? descriptionId : undefined}
					class={cx(
						"pointer-events-auto flex w-full min-w-0 flex-col gap-3 border border-border bg-popover p-3 text-foreground shadow-overlay",
						mobile() ? "rounded-sheet" : "max-w-sm rounded-surface",
					)}
				>
					<div class="flex min-w-0 items-start gap-3">
						<span
							aria-hidden="true"
							data-permission-notice-icon=""
							class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground [&>svg]:size-4"
						>
							<ShieldKeyholeIcon />
						</span>
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<p
								id={titleId}
								data-permission-notice-title=""
								class="m-0 text-sm leading-5 font-semibold text-pretty"
							>
								{props.title}
							</p>
							<Show when={props.description}>
								<p
									id={descriptionId}
									data-permission-notice-description=""
									class="m-0 text-xs leading-prose text-pretty text-muted-foreground"
								>
									{props.description}
								</p>
							</Show>
						</div>
						<button
							type="button"
							data-permission-notice-dismiss=""
							aria-label={props.dismissLabel ?? "Dismiss"}
							onClick={() => props.onDismiss()}
							class={cx(
								"pressable focus-ring relative inline-flex shrink-0 cursor-pointer items-center justify-center border border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground [&_svg]:size-5",
								mobile()
									? "-mt-1.5 -mr-2 size-11 rounded-control-lg"
									: "-mr-1 size-8 rounded-control-sm",
							)}
						>
							<CloseIcon strokeWidth={1.5} />
						</button>
					</div>
					<button
						type="button"
						data-permission-notice-review=""
						aria-busy={props.reviewing || undefined}
						disabled={props.reviewing}
						onClick={() => props.onReview()}
						class={cx(
							"pressable focus-ring relative inline-flex shrink-0 cursor-pointer items-center justify-center border border-border bg-primary-fill text-sm font-semibold whitespace-nowrap text-primary-foreground enabled:hover:bg-primary-fill-highlight disabled:cursor-default",
							mobile()
								? "h-11 w-full rounded-control-lg px-4"
								: "ml-11 h-8 self-start rounded-control-sm px-3",
						)}
					>
						<span class={cx(props.reviewing && "invisible")}>
							{props.reviewLabel ?? "Review"}
						</span>
						<Show when={props.reviewing}>
							<Spinner size={16} class="absolute" />
						</Show>
					</button>
				</section>
			</div>
		</Portal>
	);
};

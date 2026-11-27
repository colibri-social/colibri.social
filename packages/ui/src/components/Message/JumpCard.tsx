import { ArrowDownIcon } from "@solar-icons/solid/linear/arrow-down";
import { ArrowDownToLineIcon } from "@solar-icons/solid/linear/arrow-down-to-line";
import { createUniqueId, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { TableText } from "../Table/TableText";
import type { ChatPlatform } from "./layout";

export type JumpCardMode = "bottom" | "new" | "present";

export type JumpCardProps = {
	visible: boolean;
	animate: boolean;
	mode: JumpCardMode;
	count: number;
	platform: ChatPlatform;
	lift?: number;
	onJump: () => void;
};

const motion =
	"transition-[opacity,translate,filter] ease-out motion-reduce:transition-none reduced-motion:transition-none data-[visible]:duration-[calc(200ms*var(--motion-scale))] not-data-[visible]:duration-[calc(150ms*var(--motion-scale))] not-data-[visible]:blur-[4px]";

const newMessagesLabel = (count: number) =>
	count === 1 ? "1 new message" : `${count} new messages`;

const statusText = (mode: JumpCardMode, count: number) => {
	if (mode === "present") return "Viewing older messages";
	if (mode === "new") return newMessagesLabel(count);
	return "Viewing earlier messages";
};

export const JumpCard = (props: JumpCardProps) => {
	const textId = createUniqueId();
	const mobile = () => props.platform === "mobile";
	const text = () => statusText(props.mode, props.count);
	const lift = () => (mobile() ? 0 : (props.lift ?? 0));

	return (
		<div
			data-message-list-jump=""
			data-mode={props.mode}
			data-visible={props.visible || undefined}
			inert={!props.visible || undefined}
			class={cx(
				"pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center",
				mobile() ? "px-safe-offset-2" : "px-4",
				props.animate && motion,
				props.visible ? "opacity-100" : "translate-y-1 opacity-0",
			)}
		>
			<div
				data-jump-lift=""
				class={cx(
					"flex min-w-0 justify-center transition-transform duration-[calc(200ms*var(--motion-scale))] ease-[var(--ease-out-quick)] motion-reduce:transition-none reduced-motion:transition-none",
					mobile() && "w-full",
				)}
				style={{
					transform: lift() ? `translateY(${-lift()}px)` : undefined,
				}}
			>
				<div
					data-jump-card=""
					class={cx(
						"pointer-events-auto flex min-w-0 items-center gap-3 border border-border bg-popover p-1 pl-3.5 text-foreground shadow-overlay",
						mobile() ? "w-full rounded-sheet" : "max-w-md rounded-surface",
					)}
				>
					<Show when={props.mode === "new"}>
						<span
							aria-hidden="true"
							class="size-2 shrink-0 rounded-full bg-primary-highlight"
						/>
					</Show>
					<p
						id={textId}
						class={cx(
							"m-0 min-w-0 text-sm tabular-nums",
							mobile() ? "line-clamp-2 flex-1 leading-tight" : "truncate",
							props.mode === "new" ? "font-semibold" : "text-muted-foreground",
						)}
					>
						<Show when={!mobile()} fallback={text()}>
							<TableText text={text()} />
						</Show>
					</p>
					<button
						type="button"
						aria-describedby={textId}
						onClick={() => props.onJump()}
						class={cx(
							"pressable focus-ring inline-flex shrink-0 cursor-pointer items-center gap-1.5 border text-sm font-semibold whitespace-nowrap [&_svg]:size-4",
							mobile()
								? "h-11 rounded-control-lg pr-4 pl-3"
								: "h-8 rounded-control-sm pr-3 pl-2.5",
							props.mode === "new"
								? "border-border bg-primary-fill text-primary-foreground hover:bg-primary-fill-highlight"
								: "border-border bg-secondary text-foreground hover:bg-secondary-highlight",
						)}
					>
						<Show when={props.mode === "present"} fallback={<ArrowDownIcon />}>
							<ArrowDownToLineIcon />
						</Show>
						{props.mode === "present" ? "Jump to present" : "Jump to bottom"}
					</button>
				</div>
			</div>
		</div>
	);
};

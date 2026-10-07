import { type JSX, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { createDoubleTap } from "../../utils/gestures/double-tap";
import { createLongPress } from "../../utils/gestures/long-press";
import { type Haptics, useHaptics } from "../../utils/haptics";

export type DoubleTapAction = "react" | "editOrReply";

export type MessageGestureOptions = {
	longPress?: boolean;
	onLongPress?: (event: PointerEvent) => void;
	doubleTap?: boolean;
	doubleTapAction?: DoubleTapAction;
	doubleTapEmoji?: string;
	canEdit?: boolean;
	canReply?: boolean;
	onReact?: (emoji: string) => void;
	onEdit?: () => void;
	onReply?: () => void;
	onDoubleTap?: (event: PointerEvent) => void;
	ignoreSelector?: string;
};

const DEFAULT_IGNORE =
	"[data-reaction], [data-reaction-bar], [data-member-menu]";

export const createMessageGestures = (
	element: HTMLElement,
	options: () => MessageGestureOptions,
	haptics?: Haptics,
) => {
	createLongPress(element, {
		enabled: () => options().longPress ?? true,
		shouldStart: (event) => {
			const target = event.target as Element | null;
			return !target?.closest?.(options().ignoreSelector ?? DEFAULT_IGNORE);
		},
		onLongPress: (event) => {
			haptics?.impact("medium");
			options().onLongPress?.(event);
		},
	});

	createDoubleTap(element, {
		enabled: () => options().doubleTap ?? false,
		onDoubleTap: (event) => {
			const current = options();
			current.onDoubleTap?.(event);
			if ((current.doubleTapAction ?? "react") === "react") {
				current.onReact?.(current.doubleTapEmoji ?? "👍");
				return;
			}
			if (current.canEdit) {
				current.onEdit?.();
				return;
			}
			if (current.canReply ?? true) current.onReply?.();
		},
	});
};

export type MessageGesturesProps = MessageGestureOptions & {
	class?: string;
	children?: JSX.Element;
};

export const MessageGestures = (props: MessageGesturesProps) => {
	const [local, options] = splitProps(props, ["class", "children"]);
	const haptics = useHaptics();
	return (
		<div
			ref={(element) => createMessageGestures(element, () => options, haptics)}
			data-message-gestures=""
			class={cx("w-full", local.class)}
		>
			{local.children}
		</div>
	);
};

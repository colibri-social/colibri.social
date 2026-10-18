import type { JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";

export type ToastType =
	| "default"
	| "success"
	| "error"
	| "warning"
	| "info"
	| "loading";

export type ToastId = string | number;

export type ToastAction = {
	label: string;
	onClick?: (event: MouseEvent) => void;
	dismiss?: boolean;
};

export type ToastOptions = {
	id?: ToastId;
	description?: string;
	action?: ToastAction;
	duration?: number;
	onDismiss?: (id: ToastId) => void;
	onAutoClose?: (id: ToastId) => void;
};

export type CustomToastOptions = Omit<
	ToastOptions,
	"description" | "action"
> & {
	announce?: string;
};

export type ToastRecord = {
	id: ToastId;
	type: ToastType;
	title: string;
	description?: string;
	action?: ToastAction;
	duration: number;
	custom?: (id: ToastId) => JSX.Element;
	announce: string;
	version: number;
	dismissed: boolean;
	swiped: boolean;
	onDismiss?: (id: ToastId) => void;
	onAutoClose?: (id: ToastId) => void;
};

export const TOAST_DURATIONS: Record<ToastType, number> = {
	default: 4000,
	success: 4000,
	info: 4000,
	warning: 5000,
	error: 6000,
	loading: Number.POSITIVE_INFINITY,
};

export const TOAST_ACTION_MIN_DURATION = 6000;

const [state, setState] = createStore<{ toasts: ToastRecord[] }>({
	toasts: [],
});

export const toastState = state;

let counter = 0;

const nextId = () => {
	counter += 1;
	return `toast-${counter}`;
};

const durationFor = (
	type: ToastType,
	options: { duration?: number; action?: ToastAction },
) => {
	if (options.duration !== undefined) return options.duration;
	const base = TOAST_DURATIONS[type];
	if (options.action && Number.isFinite(base))
		return Math.max(base, TOAST_ACTION_MIN_DURATION);
	return base;
};

const announcementFor = (title: string, description?: string) =>
	description ? `${title}. ${description}` : title;

type ToastInput = {
	type: ToastType;
	title: string;
	description?: string;
	action?: ToastAction;
	duration?: number;
	custom?: (id: ToastId) => JSX.Element;
	announce?: string;
	onDismiss?: (id: ToastId) => void;
	onAutoClose?: (id: ToastId) => void;
};

const upsert = (id: ToastId | undefined, input: ToastInput): ToastId => {
	const key = id ?? nextId();
	const fields = {
		type: input.type,
		title: input.title,
		description: input.description,
		action: input.action,
		duration: durationFor(input.type, input),
		custom: input.custom,
		announce: input.announce ?? announcementFor(input.title, input.description),
		onDismiss: input.onDismiss,
		onAutoClose: input.onAutoClose,
	};
	setState(
		produce((draft) => {
			const index = draft.toasts.findIndex((toast) => toast.id === key);
			const existing = index >= 0 ? draft.toasts[index] : undefined;
			if (existing && !existing.dismissed) {
				Object.assign(existing, fields, { version: existing.version + 1 });
				return;
			}
			if (existing) draft.toasts.splice(index, 1);
			draft.toasts.push({
				id: key,
				...fields,
				version: 0,
				dismissed: false,
				swiped: false,
			});
		}),
	);
	return key;
};

const create =
	(type: ToastType) =>
	(title: string, options: ToastOptions = {}): ToastId =>
		upsert(options.id, { ...options, type, title });

const dismiss = (id?: ToastId, swiped = false) => {
	const dismissed: ToastRecord[] = [];
	setState(
		produce((draft) => {
			for (const toast of draft.toasts) {
				if (toast.dismissed) continue;
				if (id !== undefined && toast.id !== id) continue;
				toast.dismissed = true;
				toast.swiped = swiped;
				dismissed.push(toast);
			}
		}),
	);
	for (const toast of dismissed) toast.onDismiss?.(toast.id);
};

export type ToastPromiseMessages<T> = {
	loading: string;
	success: string | ((value: T) => string);
	error: string | ((error: unknown) => string);
	description?: string;
};

const promise = <T>(
	pending: Promise<T> | (() => Promise<T>),
	messages: ToastPromiseMessages<T>,
	options: Omit<ToastOptions, "description"> = {},
): ToastId => {
	const id = upsert(options.id, {
		...options,
		type: "loading",
		title: messages.loading,
		description: messages.description,
	});
	const run = typeof pending === "function" ? pending() : pending;
	run.then(
		(value) => {
			upsert(id, {
				...options,
				type: "success",
				title:
					typeof messages.success === "function"
						? messages.success(value)
						: messages.success,
			});
		},
		(error: unknown) => {
			upsert(id, {
				...options,
				type: "error",
				title:
					typeof messages.error === "function"
						? messages.error(error)
						: messages.error,
			});
		},
	);
	return id;
};

const custom = (
	render: (id: ToastId) => JSX.Element,
	options: CustomToastOptions = {},
): ToastId =>
	upsert(options.id, {
		...options,
		type: "default",
		title: options.announce ?? "",
		custom: render,
	});

export const removeToast = (id: ToastId) => {
	setState("toasts", (toasts) =>
		toasts.filter((toast) => !(toast.id === id && toast.dismissed)),
	);
};

export const clearToasts = () => {
	setState("toasts", []);
};

export const toast = Object.assign(create("default"), {
	success: create("success"),
	error: create("error"),
	warning: create("warning"),
	info: create("info"),
	loading: create("loading"),
	message: create("default"),
	custom,
	promise,
	dismiss: (id?: ToastId) => dismiss(id),
});

export const dismissToast = dismiss;

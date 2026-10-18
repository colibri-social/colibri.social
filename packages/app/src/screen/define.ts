import {
	type Component,
	createContext,
	type JSX,
	lazy,
	onMount,
	Suspense,
	useContext,
} from "solid-js";
import { createComponent, Dynamic } from "solid-js/web";
import type { Platform } from "./platform";
import { usePlatform } from "./platform";

type SlotFn<M, P> = (model: M, props: P) => JSX.Element;

type AnySlot<M> = SlotFn<M, never>;

const SlotRegistry = createContext<Set<string>>();

export const slot = <M, P = Record<string, never>>(fn: SlotFn<M, P>) => fn;

type SlotProps<F> = F extends (model: never, props: infer P) => JSX.Element
	? [P] extends [never]
		? Record<string, never>
		: P
	: never;

export type BoundSlots<M, S extends Record<string, AnySlot<M>>> = {
	[K in keyof S]: Component<SlotProps<S[K]>>;
};

export type ViewContext<A, M, S extends Record<string, AnySlot<M>>> = {
	slots: BoundSlots<M, S>;
	model: M;
	args: A;
};

export type ScreenView<A> = Component<{ args: A }> & {
	omitted: readonly string[];
	hidden: readonly string[];
};

export const defineContract = <
	A,
	M,
	S extends Record<string, AnySlot<M>>,
>(contract: {
	id: string;
	model: (args: A) => M;
	slots: S;
}) => ({
	...contract,
	slotNames: Object.keys(contract.slots) as (keyof S & string)[],
	view<
		O extends readonly (keyof S & string)[] = [],
		H extends readonly (keyof S & string)[] = [],
	>(view: {
		omit?: O;
		hidden?: H;
		render: (context: ViewContext<A, M, S>) => JSX.Element;
	}): ScreenView<A> {
		const omitted: readonly string[] = view.omit ?? [];
		const hidden: readonly string[] = view.hidden ?? [];
		const component = (props: { args: A }) => {
			const args = new Proxy({} as Record<PropertyKey, unknown>, {
				get: (_, key) => (props.args as Record<PropertyKey, unknown>)[key],
				has: (_, key) => key in (props.args as object),
				ownKeys: () => Reflect.ownKeys(props.args as object),
				getOwnPropertyDescriptor: (_, key) => ({
					enumerable: true,
					configurable: true,
					value: (props.args as Record<PropertyKey, unknown>)[key],
				}),
			}) as A;
			const model = contract.model(args);
			const seen = new Set<string>();
			const slots = Object.fromEntries(
				Object.entries(contract.slots).map(([name, fn]) => [
					name,
					(slotProps: unknown) => {
						useContext(SlotRegistry)?.add(name);
						return (fn as SlotFn<M, unknown>)(model, slotProps);
					},
				]),
			) as BoundSlots<M, S>;
			if (import.meta.env.DEV) {
				onMount(() =>
					queueMicrotask(() => {
						const missing = Object.keys(contract.slots).filter(
							(name) =>
								!seen.has(name) &&
								!omitted.includes(name) &&
								!hidden.includes(name),
						);
						if (missing.length) {
							console.warn(
								`[${contract.id}] view never mounted: ${missing.join(", ")}`,
							);
						}
					}),
				);
			}
			return createComponent(SlotRegistry.Provider, {
				value: seen,
				get children() {
					return view.render({ slots, model, args });
				},
			});
		};
		return Object.assign(component, { omitted, hidden });
	},
});

export type Contract = { id: string; slotNames: readonly string[] };

type ViewModule<A> = { default: ScreenView<A> };

export type Screen<A> = Component<{ args: A }> & {
	contract: Contract;
	variants: Partial<Record<Platform, () => Promise<ViewModule<A>>>>;
};

export const defineScreen = <A>(
	contract: Contract,
	variants: Partial<Record<Platform, () => Promise<ViewModule<A>>>>,
): Screen<A> => {
	const lazyViews = Object.fromEntries(
		Object.entries(variants).map(([platform, load]) => [
			platform,
			lazy(load as () => Promise<ViewModule<A>>),
		]),
	) as Partial<Record<Platform, Component<{ args: A }>>>;
	const component = (props: { args: A; fallback?: JSX.Element }) => {
		const platform = usePlatform();
		const view = () => lazyViews[platform()] ?? lazyViews.mobile;
		return createComponent(Suspense, {
			get fallback() {
				return props.fallback;
			},
			get children() {
				return createComponent(Dynamic, {
					get component() {
						return view();
					},
					get args() {
						return props.args;
					},
				});
			},
		});
	};
	return Object.assign(component, { contract, variants });
};

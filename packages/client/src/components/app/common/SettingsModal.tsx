import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	For,
	Match,
	type ParentComponent,
	type Setter,
	Show,
	Switch,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import CaretDownIcon from "~icons/ph/caret-down";
import XIcon from "~icons/ph/x";
import { cx } from "../../../utils/cva";
import { useIsMobile } from "../../../utils/mobile-pane";
import { Spinner } from "../../icons/Spinner";
import { SectionBoundary } from "../../SectionBoundary";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogPortal,
	DialogTrigger,
} from "../../ui/Dialog";
import { BottomSheet } from "../../ui/MenuDrawer";
import { ScrollFadeBottom } from "../../ui/ScrollFadeBottom";
import { settingsShellClass } from "./settings-modal-classes";

export const SettingsPage: ParentComponent<{
	loading: Accessor<boolean>;
	title: string;
	description?: string;
	onSave?: () => void;
	canReset?: boolean;
	onReset?: () => void;
}> = (props) => {
	const isMobile = useIsMobile();
	const hasFooter = () => !!(props.onSave || props.onReset);
	return (
		<div class="w-full min-w-0 flex flex-col h-auto min-h-0 relative">
			<Show when={!isMobile() || props.description}>
				<div class="px-4 py-4 border-b border-border h-auto shrink-0">
					<Show when={!isMobile()}>
						<h2 class="m-0">{props.title}</h2>
					</Show>
					<Show when={props.description}>
						<span
							class="text-sm leading-5 block"
							classList={{ "mt-2": !isMobile() }}
						>
							{props.description}
						</span>
					</Show>
				</div>
			</Show>
			<ScrollFadeBottom
				wrapperClass="flex-1"
				class="w-full flex flex-col gap-4 px-4 lg:max-w-137 pt-4"
				classList={{
					"pb-4": hasFooter(),
					"pb-[calc(1rem+var(--safe-area-bottom))]": !hasFooter(),
				}}
			>
				{props.children}
			</ScrollFadeBottom>
			<Show when={props.onSave || props.onReset}>
				<div class="w-full shrink-0 border-t border-border px-4 pt-4 pb-[calc(1rem+var(--safe-area-bottom))] flex flex-row items-center justify-end gap-2 min-h-16 bg-background rounded-br-xl">
					<Show when={props.canReset && props.onReset}>
						<Button
							variant="secondary"
							onClick={props.onReset}
							disabled={props.loading()}
						>
							Reset
						</Button>
					</Show>
					<Show when={props.onSave}>
						<Button
							onClick={props.onSave}
							disabled={props.loading() || !props.canReset}
						>
							<Spinner
								classList={{
									hidden: !props.loading(),
									block: props.loading(),
								}}
							/>
							Save
						</Button>
					</Show>
				</div>
			</Show>
		</div>
	);
};

type SettingsPage = "general" | "danger";

const SettingsPageSelector: ParentComponent<{
	onClick: Setter<SettingsPage>;
	danger?: boolean;
	activePage: boolean;
	icon: Component<{ variant: string }>;
	badge?: Accessor<number | undefined>;
}> = (props) => {
	return (
		<button
			type="button"
			class="w-full hover:bg-card px-2 py-1 rounded-sm cursor-pointer text-left flex flex-row items-center gap-2"
			classList={{
				"text-destructive hover:bg-destructive/15!": props.danger,
				"bg-muted! text-foreground!": props.activePage && !props.danger,
				"bg-destructive/10!": props.activePage && props.danger,
			}}
			onClick={props.onClick}
		>
			<props.icon variant={"fill"} />
			<span class="w-full">{props.children}</span>
			<Show when={props.badge?.()}>
				<span class="text-xs leading-none font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-5 text-center">
					{props.badge?.()}
				</span>
			</Show>
		</button>
	);
};

export type SettingsPageInfo = {
	title: string;
	id: string;
	component: Component<any>;
	icon: Component<{ variant: string }>;
	visible?: Accessor<boolean>;
	badge?: Accessor<number | undefined>;
};

export const SettingsModal: ParentComponent<{
	pages: Array<SettingsPageInfo>;
	debugPage?: SettingsPageInfo;
	dangerPages?: Array<SettingsPageInfo>;
	class?: string;
	contentClass?: string;
	open?: Accessor<boolean>;
	setOpen?: Setter<boolean>;
	page?: Accessor<string | undefined>;
	onPageConsumed?: () => void;
}> = (props) => {
	const [activePage, setActivePage] = createSignal<string>(
		props.pages.find((x) => x.visible?.() ?? true)?.id || "",
	);
	const [open, setOpen] = createSignal(false);
	const isMobile = useIsMobile();
	const isOpen = () => props.open?.() ?? open();
	const onOpenChange = props.setOpen ?? setOpen;

	createEffect(() => {
		const requested = props.page?.();
		if (!requested) return;
		if (props.pages.some((item) => item.id === requested)) {
			setActivePage(requested);
		}
		props.onPageConsumed?.();
	});

	// Shared page renderer for both the desktop sidebar layout and the mobile
	// select-driven drawer
	const PageContent = () => (
		<Switch fallback={<div>No settings page for this category found.</div>}>
			<For each={props.pages}>
				{(item) => (
					<Match when={activePage() === item.id}>
						<SectionBoundary name={`settings/${item.id}`}>
							<item.component />
						</SectionBoundary>
					</Match>
				)}
			</For>
			<Match when={props.debugPage && activePage() === props.debugPage.id}>
				<SectionBoundary name="settings/debug">
					<Dynamic component={props.debugPage!.component} />
				</SectionBoundary>
			</Match>
			<For each={props.dangerPages}>
				{(item) => (
					<Match when={activePage() === item.id}>
						<SectionBoundary name={`settings/${item.id}`}>
							<Dynamic component={item.component} />
						</SectionBoundary>
					</Match>
				)}
			</For>
		</Switch>
	);

	return (
		<Show
			when={isMobile()}
			fallback={
				<Dialog open={isOpen()} onOpenChange={onOpenChange}>
					<DialogTrigger class={props.class}>{props.children}</DialogTrigger>
					<DialogPortal>
						<DialogContent class={cx(settingsShellClass, props.contentClass)}>
							<div class="absolute top-5 right-5 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm z-50">
								<DialogCloseButton class="absolute cursor-pointer">
									<XIcon />
								</DialogCloseButton>
							</div>
							<div class="min-h-0 h-auto flex flex-col justify-between p-4 min-w-56 shrink-0 overflow-hidden border-r border-border">
								<div class="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-1">
									<For each={props.pages}>
										{(item) => (
											<Show when={item.visible?.() !== false}>
												<SettingsPageSelector
													icon={item.icon}
													activePage={activePage() === item.id}
													onClick={() => setActivePage(item.id)}
													badge={item.badge}
												>
													{item.title}
												</SettingsPageSelector>
											</Show>
										)}
									</For>
								</div>
								<div class="shrink-0 flex flex-col gap-1">
									<Show when={props.debugPage}>
										<SettingsPageSelector
											icon={props.debugPage!.icon}
											activePage={activePage() === props.debugPage!.id}
											onClick={() => setActivePage(props.debugPage!.id)}
										>
											{props.debugPage!.title}
										</SettingsPageSelector>
									</Show>
									<For each={props.dangerPages}>
										{(item) => (
											<Show when={item.visible?.() !== false}>
												<SettingsPageSelector
													icon={item.icon}
													activePage={activePage() === item.id}
													danger
													onClick={() => setActivePage(item.id)}
												>
													{item.title}
												</SettingsPageSelector>
											</Show>
										)}
									</For>
								</div>
							</div>
							<PageContent />
						</DialogContent>
					</DialogPortal>
				</Dialog>
			}
		>
			<button
				type="button"
				class={props.class}
				onClick={() => onOpenChange(true)}
			>
				{props.children}
			</button>
			<BottomSheet open={isOpen()} onOpenChange={onOpenChange} class="p-0">
				<div class="p-3 border-b border-border">
					<div class="relative">
						<select
							value={activePage()}
							onChange={(e) => setActivePage(e.currentTarget.value)}
							class="w-full appearance-none bg-muted/50 border border-border rounded-md pl-3 pr-9 py-2 text-base"
						>
							<For each={props.pages}>
								{(item) => (
									<Show when={item.visible?.() !== false}>
										<option value={item.id}>{item.title}</option>
									</Show>
								)}
							</For>
							<Show when={props.debugPage}>
								<option value={props.debugPage!.id}>
									{props.debugPage!.title}
								</option>
							</Show>
							<For each={props.dangerPages}>
								{(item) => (
									<Show when={item.visible?.() !== false}>
										<option value={item.id}>{item.title}</option>
									</Show>
								)}
							</For>
						</select>
						<CaretDownIcon class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
					</div>
				</div>
				<div class="flex-1 min-h-0 flex flex-col">
					<PageContent />
				</div>
			</BottomSheet>
		</Show>
	);
};

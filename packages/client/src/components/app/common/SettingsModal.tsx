import {
	type Accessor,
	type Component,
	createSignal,
	For,
	Match,
	type ParentComponent,
	type Setter,
	Show,
	Switch,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import XIcon from "~icons/ph/x";
import { cx } from "../../../utils/cva";
import { useIsMobile } from "../../../utils/mobile-pane";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogPortal,
	DialogTrigger,
} from "../../ui/Dialog";
import {
	Drawer,
	DrawerContent,
	DrawerPortal,
	DrawerTrigger,
} from "../../ui/Drawer";

export const SettingsPage: ParentComponent<{
	loading: Accessor<boolean>;
	title: string;
	description?: string;
	onSave?: () => void;
	canReset?: boolean;
	onReset?: () => void;
}> = (props) => {
	return (
		<div class="w-full flex flex-col h-auto relative max-h-144">
			<div class="px-4 py-4 border-b border-border h-auto">
				<h2 class="m-0">{props.title}</h2>
				<Show when={props.description}>
					<span class="text-sm leading-5 block mt-2">{props.description}</span>
				</Show>
			</div>
			<div class="flex flex-col gap-4 w-full flex-1 min-h-0">
				<div class="w-full flex flex-col gap-4 px-4 lg:max-w-137 h-full overflow-auto py-4">
					{props.children}
				</div>
			</div>
			<Show when={props.onSave || props.onReset}>
				<div class="w-full border-t border-border px-4 pt-4 pb-[calc(1rem+var(--safe-area-bottom))] flex flex-row items-center justify-end gap-2 min-h-16 bg-background rounded-br-xl">
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
	dangerPage?: SettingsPageInfo;
	class?: string;
	contentClass?: string;
	open?: Accessor<boolean>;
	setOpen?: Setter<boolean>;
}> = (props) => {
	const [activePage, setActivePage] = createSignal<string>(
		props.pages.find((x) => x.visible?.() ?? true)?.id || "",
	);
	const [open, setOpen] = createSignal(false);
	const isMobile = useIsMobile();
	const isOpen = () => props.open?.() ?? open();
	const onOpenChange = props.setOpen ?? setOpen;

	// Shared page renderer for both the desktop sidebar layout and the mobile
	// select-driven drawer
	const PageContent = () => (
		<Switch fallback={<div>No settings page for this category found.</div>}>
			<For each={props.pages}>
				{(item) => (
					<Match when={activePage() === item.id}>
						<item.component />
					</Match>
				)}
			</For>
			<Match when={props.debugPage && activePage() === props.debugPage.id}>
				<Dynamic component={props.debugPage!.component} />
			</Match>
			<Match when={props.dangerPage && activePage() === props.dangerPage.id}>
				<Dynamic component={props.dangerPage!.component} />
			</Match>
		</Switch>
	);

	return (
		<Show
			when={isMobile()}
			fallback={
				<Dialog open={isOpen()} onOpenChange={onOpenChange}>
					<DialogTrigger class={props.class}>{props.children}</DialogTrigger>
					<DialogPortal>
						<DialogContent
							class={cx(
								"w-[75vw] min-w-92 h-fit min-h-[min(36rem,calc(100vh-2rem))] max-w-3xl! p-0 flex flex-row gap-0 max-h-[min(48rem,calc(100vh-2rem))]! settings-modal",
								props.contentClass,
							)}
						>
							<div class="absolute top-5 right-5 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm z-50">
								<DialogCloseButton class="absolute cursor-pointer">
									<XIcon />
								</DialogCloseButton>
							</div>
							<div class="min-h-[min(36rem,calc(100vh-2rem))] h-auto flex flex-col justify-between p-4 min-w-56 border-r border-border">
								<div class="h-full flex flex-col gap-1">
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
								<div class="flex flex-col gap-1">
									<Show when={props.debugPage}>
										<SettingsPageSelector
											icon={props.debugPage!.icon}
											activePage={activePage() === props.debugPage!.id}
											onClick={() => setActivePage(props.debugPage!.id)}
										>
											{props.debugPage!.title}
										</SettingsPageSelector>
									</Show>
									<Show
										when={
											props.dangerPage && props.dangerPage.visible?.() !== false
										}
									>
										<SettingsPageSelector
											icon={props.dangerPage!.icon}
											activePage={activePage() === props.dangerPage!.id}
											danger
											onClick={() => setActivePage(props.dangerPage!.id)}
										>
											{props.dangerPage!.title}
										</SettingsPageSelector>
									</Show>
								</div>
							</div>
							<PageContent />
						</DialogContent>
					</DialogPortal>
				</Dialog>
			}
		>
			<Drawer open={isOpen()} onOpenChange={onOpenChange}>
				<DrawerTrigger class={props.class}>{props.children}</DrawerTrigger>
				<DrawerPortal>
					<DrawerContent class="max-h-[92dvh] p-0 overflow-hidden">
						<div class="p-3 border-b border-border">
							<select
								value={activePage()}
								onChange={(e) => setActivePage(e.currentTarget.value)}
								class="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-base"
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
								<Show
									when={
										props.dangerPage && props.dangerPage.visible?.() !== false
									}
								>
									<option value={props.dangerPage!.id}>
										{props.dangerPage!.title}
									</option>
								</Show>
							</select>
						</div>
						<div
							class="flex-1 min-h-0 overflow-y-auto"
							data-corvu-no-drag="true"
						>
							<PageContent />
						</div>
					</DrawerContent>
				</DrawerPortal>
			</Drawer>
		</Show>
	);
};

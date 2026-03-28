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
import { Icon, type IconName } from "@/components/solid/icons/Icon";
import { cn } from "@/utils/cn";
import { Spinner } from "../icons/Spinner";
import { Button } from "../shadcn-solid/Button";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogPortal,
	DialogTrigger,
} from "../shadcn-solid/Dialog";

export const SettingsPage: ParentComponent<{
	loading: Accessor<boolean>;
	title: string;
	onSave?: () => void;
	canReset?: boolean;
	onReset?: () => void;
}> = (props) => {
	return (
		<div class="w-full flex flex-col justify-between gap-4 min-h-108 h-auto overflow-auto">
			<div class="flex flex-col gap-4 py-4 w-full">
				<h2 class="m-0 px-4">{props.title}</h2>
				<div class="w-full h-full flex flex-col gap-4 px-4 max-w-[548px]">
					{props.children}
				</div>
			</div>
			<Show when={props.onSave || props.onReset}>
				<div class="w-full border-t border-border p-4 flex flex-row items-center justify-end gap-2">
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
	icon: IconName;
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
			<Icon variant="fill" name={props.icon} />
			{props.children}
		</button>
	);
};

export type SettingsPageInfo = {
	title: string;
	id: string;
	component: Component<any>;
	icon: IconName;
	visible?: boolean;
};

export const SettingsModal: ParentComponent<{
	pages: Array<SettingsPageInfo>;
	debugPage?: SettingsPageInfo;
	dangerPage?: SettingsPageInfo;
	class?: string;
	contentClass?: string;
}> = (props) => {
	const [activePage, setActivePage] = createSignal<string>(props.pages[0].id);
	const [open, setOpen] = createSignal(false);

	createEffect(() => {
		if (open() === false) return;

		setActivePage(props.pages[0].id);
	});

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger class={props.class}>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent
					class={cn(
						"w-[75vw] min-w-92 h-fit min-h-128 max-w-192! p-0 flex flex-row gap-0 max-h-[calc(100vh-4rem)]!",
						props.contentClass,
					)}
				>
					<div class="absolute top-4 right-4 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm">
						<DialogCloseButton class="absolute cursor-pointer">
							<Icon variant="regular" name="x-icon" />
						</DialogCloseButton>
					</div>
					<div class="min-h-128 h-auto flex flex-col justify-between p-4 min-w-52 border-r border-border">
						<div class="h-full flex flex-col gap-1">
							<For each={props.pages}>
								{(item) => (
									<Show when={item.visible !== false}>
										<SettingsPageSelector
											icon={item.icon}
											activePage={activePage() === item.id}
											onClick={() => setActivePage(item.id)}
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
							<Show when={props.dangerPage}>
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
					<Switch
						fallback={<div>No settings page for this category found.</div>}
					>
						<For each={props.pages}>
							{(item) => (
								<Match when={activePage() === item.id}>
									<item.component />
								</Match>
							)}
						</For>
						<Match
							when={props.debugPage && activePage() === props.debugPage.id}
						>
							<Dynamic component={props.debugPage!.component} />
						</Match>
						<Match
							when={props.dangerPage && activePage() === props.dangerPage.id}
						>
							<Dynamic component={props.dangerPage!.component} />
						</Match>
					</Switch>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

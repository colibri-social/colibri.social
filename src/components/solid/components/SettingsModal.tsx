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
import { Spinner } from "../icons/Spinner";
import { X } from "../icons/X";
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
		<div class="w-full flex flex-col justify-between gap-4 min-h-108">
			<div class=" flex flex-col gap-4 py-4">
				<h2 class="m-0 px-4">{props.title}</h2>
				<div class="w-full h-full flex flex-col gap-4 px-4">
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
}> = (props) => {
	return (
		<button
			type="button"
			class="w-full hover:bg-muted/25 px-2 py-1 rounded-sm cursor-pointer text-left"
			classList={{
				"text-destructive hover:bg-destructive/15!": props.danger,
				"bg-muted/25": props.activePage && !props.danger,
				"bg-destructive/10!": props.activePage && props.danger,
			}}
			onClick={props.onClick}
		>
			{props.children}
		</button>
	);
};

export type SettingsPageInfo = {
	title: string;
	id: string;
	component: Component<any>;
};

export const SettingsModal: ParentComponent<{
	pages: Array<SettingsPageInfo>;
	debugPage?: SettingsPageInfo;
	dangerPage: SettingsPageInfo;
	class?: string;
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
				<DialogContent class="w-[75vw] min-w-92 h-fit min-h-128 max-w-192! p-0 flex flex-row gap-0">
					<div class="absolute top-4 right-4 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm">
						<DialogCloseButton class="absolute cursor-pointer">
							<X />
						</DialogCloseButton>
					</div>
					<div class="h-full min-h-128 flex flex-col justify-between p-4 w-64 border-r border-border">
						<div class="h-full flex flex-col gap-1">
							<For each={props.pages}>
								{(item) => (
									<SettingsPageSelector
										activePage={activePage() === item.id}
										onClick={() => setActivePage(item.id)}
									>
										{item.title}
									</SettingsPageSelector>
								)}
							</For>
						</div>
						<div class="flex flex-col gap-1">
							<Show when={props.debugPage}>
								<SettingsPageSelector
									activePage={activePage() === props.debugPage!.id}
									onClick={() => setActivePage(props.debugPage!.id)}
								>
									{props.debugPage!.title}
								</SettingsPageSelector>
							</Show>
							<SettingsPageSelector
								activePage={activePage() === props.dangerPage.id}
								danger
								onClick={() => setActivePage(props.dangerPage.id)}
							>
								{props.dangerPage.title}
							</SettingsPageSelector>
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
						<Match when={activePage() === props.dangerPage.id}>
							<props.dangerPage.component />
						</Match>
					</Switch>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

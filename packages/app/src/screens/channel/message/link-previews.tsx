import {
	Button,
	Drawer,
	DrawerContent,
	Modal,
	ModalContent,
	Switch,
} from "@colibri-social/ui";
import { createEffect, createSignal, For, on, Show } from "solid-js";
import { embedHost } from "../../../data/adapters/attachments";

export const LINK_PREVIEWS_COPY = {
	title: "Link previews",
	description:
		"Choose which link previews show on this message, then save. Previews you hide can only be brought back by you, and previews a moderator hides can only be brought back by a moderator.",
	empty: "This message has no link previews.",
	disabled:
		"Link previews are off in this channel, so none of these show right now.",
	moderator:
		"You're acting as a moderator. The author can still hide previews you restore.",
	hiddenByModerator: "Hidden by a moderator.",
	hiddenByAuthor: "Hidden by the author.",
} as const;

export type LinkPreviewsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	platform: "mobile" | "desktop";
	uris: readonly string[];
	hidden: readonly string[];
	staged?: readonly string[];
	lockedBy: (uri: string) => "author" | "moderator" | undefined;
	enabled: boolean;
	moderator: boolean;
	onSave: (hidden: string[]) => Promise<void> | void;
};

export const LinkPreviewsDialog = (props: LinkPreviewsDialogProps) => {
	const [staged, setStaged] = createSignal<string[]>([]);
	const [saving, setSaving] = createSignal(false);

	createEffect(
		on(
			() => props.open,
			(open) => {
				if (!open) return;
				setStaged([...(props.staged ?? props.hidden)]);
				setSaving(false);
			},
		),
	);

	const locked = (uri: string) => !props.enabled || !!props.lockedBy(uri);
	const shows = (uri: string) =>
		!staged().includes(uri) && !props.lockedBy(uri);
	const toggle = (uri: string, show: boolean) =>
		setStaged((current) =>
			show
				? current.filter((entry) => entry !== uri)
				: [...current.filter((entry) => entry !== uri), uri],
		);
	const editable = () => props.uris.filter((uri) => !locked(uri));
	const allHidden = () => editable().every((uri) => staged().includes(uri));
	const noneHidden = () => editable().every((uri) => !staged().includes(uri));
	const dirty = () => {
		const current = staged();
		return (
			current.length !== props.hidden.length ||
			current.some((uri) => !props.hidden.includes(uri))
		);
	};

	const save = async () => {
		if (!dirty()) {
			props.onOpenChange(false);
			return;
		}
		setSaving(true);
		try {
			await props.onSave(staged());
			props.onOpenChange(false);
		} finally {
			setSaving(false);
		}
	};

	const body = () => (
		<div data-link-previews="" class="flex min-w-0 flex-col gap-3">
			<Show when={!props.enabled && props.uris.length > 0}>
				<p class="m-0 text-sm text-destructive">
					{LINK_PREVIEWS_COPY.disabled}
				</p>
			</Show>
			<Show
				when={props.uris.length > 0}
				fallback={
					<p class="m-0 text-sm text-muted-foreground">
						{LINK_PREVIEWS_COPY.empty}
					</p>
				}
			>
				<ul class="m-0 flex max-h-72 list-none flex-col gap-2 overflow-y-auto p-0 [&>*]:shrink-0">
					<For each={props.uris}>
						{(uri) => (
							<li
								data-link-preview-row=""
								class="flex min-w-0 items-center gap-3 rounded-control bg-secondary px-3 py-2.5"
							>
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm font-semibold">
										{embedHost(uri)}
									</span>
									<span class="truncate text-xs text-muted-foreground">
										{uri}
									</span>
									<Show when={props.lockedBy(uri)}>
										{(by) => (
											<span class="text-xs text-destructive">
												{by() === "moderator"
													? LINK_PREVIEWS_COPY.hiddenByModerator
													: LINK_PREVIEWS_COPY.hiddenByAuthor}
											</span>
										)}
									</Show>
								</span>
								<Switch
									class="shrink-0"
									aria-label={`Show the preview for ${embedHost(uri)}`}
									checked={shows(uri)}
									disabled={locked(uri)}
									onChange={(show) => toggle(uri, show)}
								/>
							</li>
						)}
					</For>
				</ul>
				<Show when={editable().length > 1}>
					<div class="grid grid-cols-2 gap-2">
						<Button
							variant="secondary"
							disabled={allHidden()}
							onClick={() =>
								setStaged((current) => [
									...new Set([...current, ...editable()]),
								])
							}
						>
							Hide all
						</Button>
						<Button
							variant="secondary"
							disabled={noneHidden()}
							onClick={() =>
								setStaged((current) =>
									current.filter((uri) => !editable().includes(uri)),
								)
							}
						>
							Show all
						</Button>
					</div>
				</Show>
			</Show>
			<Show when={props.moderator}>
				<p class="m-0 text-xs text-muted-foreground">
					{LINK_PREVIEWS_COPY.moderator}
				</p>
			</Show>
		</div>
	);

	const actions = () => (
		<>
			<Button
				variant="secondary"
				disabled={saving()}
				onClick={() => props.onOpenChange(false)}
			>
				Cancel
			</Button>
			<Button
				variant="primary"
				loading={saving()}
				disabled={!dirty()}
				onClick={() => void save()}
			>
				Save
			</Button>
		</>
	);

	return (
		<Show
			when={props.platform === "desktop"}
			fallback={
				<Drawer open={props.open} onOpenChange={props.onOpenChange}>
					<DrawerContent
						title={LINK_PREVIEWS_COPY.title}
						description={LINK_PREVIEWS_COPY.description}
						footer={<div class="grid grid-cols-2 gap-2">{actions()}</div>}
					>
						{body()}
					</DrawerContent>
				</Drawer>
			}
		>
			<Modal open={props.open} onOpenChange={props.onOpenChange}>
				<ModalContent
					title={LINK_PREVIEWS_COPY.title}
					description={LINK_PREVIEWS_COPY.description}
					class="md:w-[440px]"
					footer={actions()}
				>
					{body()}
				</ModalContent>
			</Modal>
		</Show>
	);
};

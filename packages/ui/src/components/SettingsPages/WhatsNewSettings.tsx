import { For, type JSX, Show } from "solid-js";
import { RELEASE_HISTORY_URL } from "./links";
import { SettingsEmpty, SettingsPage } from "./shared";

export type ReleaseNoteItemKind = "feature" | "fix";

export type ReleaseNoteItem = {
	title: string;
	body: JSX.Element;
	icon: JSX.Element;
	kind: ReleaseNoteItemKind;
};

export type ReleaseNoteView = {
	version: string;
	date: string;
	title?: string;
	heroImage?: string;
	items: ReleaseNoteItem[];
};

export type WhatsNewSettingsProps = {
	notes: ReleaseNoteView[];
	historyHref?: string;
	onOpenHistory?: (event: MouseEvent) => void;
	class?: string;
};

const KIND_LABELS: Record<ReleaseNoteItemKind, string> = {
	feature: "New",
	fix: "Fixed",
};

const KIND_ORDER: readonly ReleaseNoteItemKind[] = ["feature", "fix"];

const ReleaseNoteSection = (props: { note: ReleaseNoteView }) => {
	const groups = () =>
		KIND_ORDER.map((kind) => ({
			kind,
			items: props.note.items.filter((item) => item.kind === kind),
		})).filter((group) => group.items.length > 0);

	return (
		<article
			data-release-note={props.note.version}
			class="flex flex-col gap-4 rounded-control bg-secondary p-4"
		>
			<header class="flex flex-col gap-0.5">
				<h3 class="text-base font-semibold text-foreground">
					{props.note.title ?? `Version ${props.note.version}`}
				</h3>
				<span class="text-xs text-muted-foreground">
					{props.note.title
						? `Version ${props.note.version}, ${props.note.date}`
						: props.note.date}
				</span>
			</header>
			<Show when={props.note.heroImage}>
				{(src) => (
					<img
						src={src()}
						alt=""
						class="aspect-video w-full rounded-control-sm border border-border object-cover"
					/>
				)}
			</Show>
			<For each={groups()}>
				{(group) => (
					<section class="flex flex-col gap-3">
						<Show when={groups().length > 1}>
							<h4 class="text-xs font-semibold text-muted-foreground">
								{KIND_LABELS[group.kind]}
							</h4>
						</Show>
						<ul class="flex flex-col gap-3">
							<For each={group.items}>
								{(item) => (
									<li class="flex items-start gap-3">
										<span
											aria-hidden="true"
											class="flex size-8 shrink-0 items-center justify-center rounded-control-sm bg-primary/10 text-primary-highlight [&>svg]:size-5"
										>
											{item.icon}
										</span>
										<span class="flex min-w-0 flex-col gap-0.5">
											<span class="text-sm font-semibold text-foreground">
												{item.title}
											</span>
											<span class="text-sm text-muted-foreground">
												{item.body}
											</span>
										</span>
									</li>
								)}
							</For>
						</ul>
					</section>
				)}
			</For>
		</article>
	);
};

export const WhatsNewSettings = (props: WhatsNewSettingsProps) => {
	const href = () => props.historyHref ?? RELEASE_HISTORY_URL;
	return (
		<SettingsPage class={props.class}>
			<Show
				when={props.notes.length > 0}
				fallback={
					<SettingsEmpty>
						Nothing here yet. New features show up here as they ship.
					</SettingsEmpty>
				}
			>
				<For each={props.notes}>
					{(note) => <ReleaseNoteSection note={note} />}
				</For>
			</Show>
			<p class="text-sm text-muted-foreground">
				Looking for something older? The{" "}
				<a
					href={href()}
					target="_blank"
					rel="noreferrer"
					onClick={(event) => props.onOpenHistory?.(event)}
					class="rounded-control-xs font-semibold text-primary-highlight hover:underline focus-ring"
				>
					full release history
				</a>{" "}
				is on GitHub.
			</p>
		</SettingsPage>
	);
};

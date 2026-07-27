import { useLocation } from "@solidjs/router";
import { type Component, For, Show } from "solid-js";
import { useUserPreferences } from "../../contexts/UserPreferences";
import {
	type ClientReleaseNote,
	FALLBACK_RELEASE_NOTE_ICON,
	newestReleaseNote,
	RELEASE_NOTE_ICONS,
} from "../../release-notes";
import { blockingDialogCount } from "../../utils/blocking-dialog";
import { Button } from "../ui/Button";
import { ResponsiveDialog } from "../ui/ResponsiveDialog";

const HERO_IMAGES: Record<string, string> = {};

const KIND_LABELS = {
	feature: "New",
	fix: "Fixed",
} as const;

const KIND_ORDER = ["feature", "fix"] as const;

export const formatReleaseDate = (date: string): string => {
	const parsed = new Date(`${date}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return date;
	return parsed.toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});
};

export const ReleaseNoteBody: Component<{ note: ClientReleaseNote }> = (
	props,
) => {
	const hero = () =>
		props.note.heroImage ? HERO_IMAGES[props.note.heroImage] : undefined;

	const groups = () =>
		KIND_ORDER.map((kind) => ({
			kind,
			entries: props.note.entries.filter((entry) => entry.kind === kind),
		})).filter((group) => group.entries.length > 0);

	return (
		<div class="flex flex-col gap-5">
			<Show when={hero()}>
				{(src) => (
					<img
						src={src()}
						alt=""
						class="w-full rounded-lg border border-border object-cover"
					/>
				)}
			</Show>

			<For each={groups()}>
				{(group) => (
					<div class="flex flex-col gap-3">
						<Show when={groups().length > 1}>
							<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								{KIND_LABELS[group.kind]}
							</span>
						</Show>

						<For each={group.entries}>
							{(entry) => {
								const Icon =
									RELEASE_NOTE_ICONS[entry.icon] ??
									RELEASE_NOTE_ICONS[FALLBACK_RELEASE_NOTE_ICON];
								return (
									<div class="flex flex-row items-start gap-3">
										<span
											class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
											aria-hidden="true"
										>
											<Icon class="size-4.5" />
										</span>
										<div class="flex flex-col gap-0.5">
											<span class="text-sm font-medium leading-5">
												{entry.title}
											</span>
											<span class="text-sm leading-5 text-muted-foreground">
												{entry.body}
											</span>
										</div>
									</div>
								);
							}}
						</For>
					</div>
				)}
			</For>
		</div>
	);
};

export const ReleaseNotesModal: Component = () => {
	const { preferences, setLastSeenReleaseNote } = useUserPreferences();
	const location = useLocation();

	const note = () => newestReleaseNote();

	const open = () => {
		if (blockingDialogCount() > 0) return false;
		if (location.pathname.startsWith("/app/invite/")) return false;
		const current = note();
		if (!current) return false;
		return preferences().lastSeenReleaseNote !== current.version;
	};

	const dismiss = () => {
		const current = note();
		if (current) setLastSeenReleaseNote(current.version);
	};

	return (
		<Show when={open() && note()}>
			{(current) => (
				<ResponsiveDialog
					open
					onOpenChange={(next) => {
						if (!next) dismiss();
					}}
					title="What's New"
					contentClass="max-w-lg"
				>
					<div class="flex flex-col gap-5">
						<span class="text-sm text-muted-foreground">
							{current().title ?? `Version ${current().version}`} ·{" "}
							{formatReleaseDate(current().date)}
						</span>

						<ReleaseNoteBody note={current()} />

						<Button onClick={dismiss}>Got it</Button>
					</div>
				</ResponsiveDialog>
			)}
		</Show>
	);
};

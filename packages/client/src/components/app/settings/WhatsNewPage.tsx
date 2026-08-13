import { type Component, For, Show } from "solid-js";
import { visibleReleaseNotes } from "../../../release-notes";
import { openExternalLink } from "../../../utils/open-external-link";
import { Separator } from "../../ui/Separator";
import { SettingsPage } from "../common/SettingsModal";
import { formatReleaseDate, ReleaseNoteBody } from "../ReleaseNotes";

const RELEASES_URL =
	"https://github.com/colibri-social/colibri.social/releases";

export const WhatsNewPage: Component = () => {
	const notes = visibleReleaseNotes();

	return (
		<SettingsPage loading={() => false} title="What's New">
			<Show
				when={notes.length > 0}
				fallback={
					<span class="text-sm text-muted-foreground">
						Nothing here yet. New features will show up as they ship.
					</span>
				}
			>
				<div class="flex flex-col gap-6">
					<For each={notes}>
						{(note, index) => (
							<div class="flex flex-col gap-3">
								<Show when={index() > 0}>
									<Separator class="my-2" />
								</Show>
								<div class="flex flex-col gap-0.5">
									<span class="text-sm font-semibold">
										{note.title ?? `Version ${note.version}`}
									</span>
									<span class="text-xs text-muted-foreground">
										{note.title ? `${note.version} · ` : ""}
										{formatReleaseDate(note.date)}
									</span>
								</div>
								<ReleaseNoteBody note={note} />
							</div>
						)}
					</For>

					<Separator class="my-2" />

					<span class="text-sm text-muted-foreground">
						Looking for something older? The{" "}
						<a
							href={RELEASES_URL}
							target="_blank"
							rel="noreferrer"
							onClick={(event) => openExternalLink(RELEASES_URL, event)}
						>
							full release history
						</a>{" "}
						is on GitHub.
					</span>
				</div>
			</Show>
		</SettingsPage>
	);
};

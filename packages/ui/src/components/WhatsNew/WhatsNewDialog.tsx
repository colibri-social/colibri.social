import { type JSX, Show } from "solid-js";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { Modal, ModalContent } from "../Modal/Modal";
import {
	ReleaseNoteDetails,
	type ReleaseNoteView,
} from "../SettingsPages/WhatsNewSettings";

export type WhatsNewDialogPlatform = "mobile" | "desktop";

export type WhatsNewDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	note: ReleaseNoteView;
	platform?: WhatsNewDialogPlatform;
	onOpenAll?: () => void;
};

const WHATS_NEW_DIALOG_COPY = {
	title: "What's new",
	close: "Got it",
	openAll: "See all updates",
	details: "Update details",
} as const;

export const WhatsNewDialog = (props: WhatsNewDialogProps) => {
	const title = () => {
		return props.note.title ?? WHATS_NEW_DIALOG_COPY.title;
	};
	const description = () => {
		return `Version ${props.note.version}, ${props.note.date}`;
	};

	const body = (): JSX.Element => {
		return (
			<div data-whats-new="" class="flex flex-col gap-4">
				<ReleaseNoteDetails note={props.note} headingLevel={3} />
			</div>
		);
	};

	const actions = (block: boolean): JSX.Element => {
		return (
			<>
				<Show when={props.onOpenAll}>
					{(openAll) => (
						<Button
							variant="secondary"
							block={block}
							onClick={() => openAll()()}
						>
							{WHATS_NEW_DIALOG_COPY.openAll}
						</Button>
					)}
				</Show>
				<Button block={block} onClick={() => props.onOpenChange(false)}>
					{WHATS_NEW_DIALOG_COPY.close}
				</Button>
			</>
		);
	};

	return (
		<Show
			when={props.platform === "desktop"}
			fallback={
				<Drawer
					open={props.open}
					onOpenChange={props.onOpenChange}
					initialFocus="content"
				>
					<DrawerContent
						title={title()}
						description={description()}
						footer={
							<div
								class={
									props.onOpenAll ? "grid grid-cols-2 gap-2" : "grid gap-2"
								}
							>
								{actions(true)}
							</div>
						}
					>
						{body()}
					</DrawerContent>
				</Drawer>
			}
		>
			<Modal open={props.open} onOpenChange={props.onOpenChange}>
				<ModalContent
					title={title()}
					description={description()}
					footer={actions(false)}
					class="max-h-full md:w-[480px]"
				>
					<section
						data-whats-new-scroll=""
						aria-label={WHATS_NEW_DIALOG_COPY.details}
						// biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users scroll the release notes
						tabIndex={0}
						class="min-h-0 flex-1 overflow-y-auto rounded-control-sm outline-none focus-ring"
					>
						{body()}
					</section>
				</ModalContent>
			</Modal>
		</Show>
	);
};

import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { For, Show } from "solid-js";
import { Button } from "../Button/Button";
import { ListGroup } from "../List/List";
import { Modal, ModalContent } from "../Modal/Modal";
import {
	DiagnosticsFieldRow,
	type DiagnosticsSection,
} from "../SettingsPages/DebugInformation";
import { createCopied } from "../SettingsPages/shared";
import { Spinner } from "../Spinner/Spinner";

export type CallDebugDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sections?: DiagnosticsSection[];
	copyValue?: string;
	onCopy?: () => void;
};

export const CALL_DEBUG_COPY = {
	title: "Call details",
	description: "Live details about this call's connection.",
	copy: "Copy all",
	copied: "Copied",
	loading: "Gathering details...",
} as const;

export const CallDebugDialog = (props: CallDebugDialogProps) => {
	const { copied, copy } = createCopied();

	return (
		<Modal open={props.open} onOpenChange={props.onOpenChange}>
			<ModalContent
				title={CALL_DEBUG_COPY.title}
				description={CALL_DEBUG_COPY.description}
				footer={
					<Button
						variant="secondary"
						disabled={!props.copyValue}
						data-copied={copied() || undefined}
						icon={
							<Show when={copied()} fallback={<CopyIcon />}>
								<CheckCircleIcon class="text-success" />
							</Show>
						}
						onClick={(event) => {
							const value = props.copyValue;

							if (!value) return;

							void copy(value, event.currentTarget).then((done) => {
								if (done) props.onCopy?.();
							});
						}}
					>
						{copied() ? CALL_DEBUG_COPY.copied : CALL_DEBUG_COPY.copy}
					</Button>
				}
			>
				<section
					data-call-debug=""
					data-layout-clip=""
					aria-label={CALL_DEBUG_COPY.title}
					// biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users scroll the debug details
					tabIndex={0}
					class="flex max-h-[min(60dvh,520px)] min-w-0 flex-col gap-4 overflow-y-auto rounded-control-sm outline-none focus-ring"
				>
					<Show
						when={props.sections}
						fallback={
							<span class="inline-flex items-center gap-2 py-6 text-sm text-muted-foreground">
								<Spinner size={16} />
								{CALL_DEBUG_COPY.loading}
							</span>
						}
					>
						{(sections) => (
							<For each={sections()}>
								{(section) => (
									<ListGroup label={section.title}>
										<For each={section.fields}>
											{(field) => <DiagnosticsFieldRow field={field} />}
										</For>
									</ListGroup>
								)}
							</For>
						)}
					</Show>
				</section>
				<span role="status" class="sr-only">
					{copied() ? CALL_DEBUG_COPY.copied : ""}
				</span>
			</ModalContent>
		</Modal>
	);
};

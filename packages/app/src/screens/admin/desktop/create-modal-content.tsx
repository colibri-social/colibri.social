import { Button, ModalClose, ModalContent } from "@colibri-social/ui";
import { type JSX, Show } from "solid-js";

export type CreateModalContentProps = {
	title: string;
	step: 1 | 2;
	ready: boolean;
	saving: boolean;
	submitLabel: string;
	onSubmit: () => void;
	onBack: () => void;
	children: JSX.Element;
};

export const CreateModalContent = (props: CreateModalContentProps) => (
	<ModalContent
		title={props.title}
		class="md:w-[440px]"
		footer={
			<>
				<Show
					when={props.step === 2}
					fallback={
						<ModalClose disabled={props.saving}>
							{props.ready ? "Cancel" : "Close"}
						</ModalClose>
					}
				>
					<Button
						variant="secondary"
						data-modal-back=""
						disabled={props.saving}
						onClick={() => props.onBack()}
					>
						Back
					</Button>
				</Show>
				<Show when={props.ready}>
					<Button loading={props.saving} onClick={() => props.onSubmit()}>
						{props.submitLabel}
					</Button>
				</Show>
			</>
		}
	>
		<div
			data-create-step={props.step}
			class="-mx-4 max-h-[min(480px,60dvh)] overflow-y-auto px-4"
		>
			{props.children}
		</div>
	</ModalContent>
);

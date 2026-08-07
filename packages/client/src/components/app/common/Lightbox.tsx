import { createSignal, type ParentComponent, Show } from "solid-js";
import { Portal } from "solid-js/web";
import XIcon from "~icons/ph/x";
import { usePortalMount } from "../../../embed/context";
import { Button } from "../../ui/Button";

export const Lightbox: ParentComponent<{
	src: string;
	class?: string;
}> = (props) => {
	const [open, setOpen] = createSignal(false);
	const portalMount = usePortalMount();
	return (
		<>
			<div class={props.class} onClick={() => setOpen(true)}>
				{props.children}
			</div>
			<Show when={open()}>
				<Portal mount={portalMount}>
					<div
						class="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-8"
						id="lightbox"
						onClick={() => {
							setOpen(false);
						}}
					>
						<img
							src={props.src}
							alt=""
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
							class="max-w-full max-h-full rounded-sm z-40"
						/>
						<Button
							variant="outline"
							class="w-10 h-10 absolute top-8 right-8 bg-card! z-50"
							onClick={() => setOpen(false)}
						>
							<XIcon />
						</Button>
					</div>
				</Portal>
			</Show>
		</>
	);
};

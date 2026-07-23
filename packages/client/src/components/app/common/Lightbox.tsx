import { createSignal, type ParentComponent, Show } from "solid-js";
import { Portal } from "solid-js/web";
import XIcon from "~icons/ph/x";
import { Button } from "../../ui/Button";

export const Lightbox: ParentComponent<{
	src: string;
	class?: string;
}> = (props) => {
	const [open, setOpen] = createSignal(false);
	return (
		<>
			<div class={props.class} onClick={() => setOpen(true)}>
				{props.children}
			</div>
			<Show when={open()}>
				<Portal>
					<div
						class="absolute top-0 left-0 z-50 bg-background/95 w-screen h-screen flex items-center justify-center"
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
							class="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)] rounded-sm z-40"
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

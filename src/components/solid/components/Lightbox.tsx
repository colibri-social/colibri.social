import { createSignal, Show, type ParentComponent } from "solid-js";
import { Portal } from "solid-js/web";
import { Button } from "../shadcn-solid/Button";
import { X } from "../icons/X";

export const Lightbox: ParentComponent<{
	src: string;
}> = (props) => {
	const [open, setOpen] = createSignal(false);
	return (
		<>
			<div onClick={() => setOpen(true)}>{props.children}</div>
			<Show when={open()}>
				<Portal>
					<div
						class="absolute top-0 left-0 z-50 bg-background/95 w-screen h-screen flex items-center justify-center"
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
						/>
						<Button
							variant="outline"
							class="w-10 h-10 absolute top-8 right-8"
							onClick={() => setOpen(false)}
						>
							<X />
						</Button>
					</div>
				</Portal>
			</Show>
		</>
	);
};

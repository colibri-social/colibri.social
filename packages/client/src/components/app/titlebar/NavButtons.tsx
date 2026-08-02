import type { Component } from "solid-js";
import CaretLeftIcon from "~icons/ph/caret-left";
import CaretRightIcon from "~icons/ph/caret-right";
import {
	goBack,
	goForward,
	navCanGoBack,
	navCanGoForward,
} from "../../../utils/nav-history";

const BUTTON_CLASS =
	"inline-flex size-6 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground transition-colors duration-75 cursor-pointer not-disabled:hover:bg-muted not-disabled:hover:text-foreground not-disabled:active:bg-muted/70 disabled:cursor-default disabled:opacity-35";

export const NavButtons: Component = () => (
	<div
		data-tauri-drag-region="false"
		class="flex h-full shrink-0 items-center gap-0.5"
	>
		<button
			type="button"
			class={BUTTON_CLASS}
			aria-label="Back"
			title="Back"
			disabled={!navCanGoBack()}
			onClick={goBack}
		>
			<CaretLeftIcon class="size-3.5" />
		</button>
		<button
			type="button"
			class={BUTTON_CLASS}
			aria-label="Forward"
			title="Forward"
			disabled={!navCanGoForward()}
			onClick={goForward}
		>
			<CaretRightIcon class="size-3.5" />
		</button>
	</div>
);

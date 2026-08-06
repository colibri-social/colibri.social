import type { Component } from "solid-js";
import { DeleteAccountFlow } from "./DeleteAccountFlow";

export const DeleteAccountScreen: Component = () => (
	<div class="w-full h-full overflow-y-auto flex flex-col items-center px-6 py-12">
		<div class="w-full max-w-2xl flex flex-col gap-6">
			<div class="flex flex-col gap-2">
				<h1 class="m-0 text-2xl font-semibold">Delete your Colibri data</h1>
				<p class="m-0 text-sm text-muted-foreground">
					This removes everything Colibri holds about you. It does not touch the
					atproto account you sign in with.
				</p>
			</div>
			<DeleteAccountFlow />
		</div>
	</div>
);

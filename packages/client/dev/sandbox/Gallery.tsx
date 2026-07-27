import { ColorModeProvider } from "@kobalte/core/color-mode";
import { Toaster } from "../../src/components/ui/Sonner";
import { DEFAULT_ITEM, findItem } from "./sections";

export const Gallery = () => {
	const requested = new URLSearchParams(window.location.search).get("item");
	const item = findItem(requested) ?? DEFAULT_ITEM;

	return (
		<ColorModeProvider>
			<div class="bg-background text-foreground min-h-screen">
				<div class="flex flex-col gap-8 p-6 pb-16">
					<item.component />
				</div>
				<Toaster richColors position="bottom-right" />
			</div>
		</ColorModeProvider>
	);
};

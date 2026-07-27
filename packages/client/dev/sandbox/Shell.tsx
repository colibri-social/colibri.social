import { createSignal, For, onMount } from "solid-js";
import { Button } from "../../src/components/ui/Button";
import { CATEGORIES, DEFAULT_ITEM, findItem } from "./sections";

const applyTheme = (doc: Document, dark: boolean) => {
	doc.documentElement.classList.toggle("dark", dark);
	doc.documentElement.dataset.kbTheme = dark ? "dark" : "light";
	doc.documentElement.style.colorScheme = dark ? "dark" : "light";
};

export const Shell = () => {
	const initial =
		findItem(new URLSearchParams(window.location.search).get("item")) ??
		DEFAULT_ITEM;

	const [dark, setDark] = createSignal(true);
	const [mobile, setMobile] = createSignal(false);
	const [current, setCurrent] = createSignal(initial.id);

	let frame: HTMLIFrameElement | undefined;

	const syncTheme = () => {
		applyTheme(document, dark());
		const inner = frame?.contentDocument;
		if (inner) applyTheme(inner, dark());
	};

	onMount(syncTheme);

	const toggleTheme = () => {
		setDark((prev) => !prev);
		syncTheme();
	};

	const select = (id: string) => {
		setCurrent(id);
		const url = new URL(window.location.href);
		url.searchParams.set("item", id);
		history.replaceState(null, "", url);
	};

	return (
		<div class="bg-background text-foreground flex h-screen flex-col">
			<header class="border-border flex items-center gap-4 border-b px-4 py-2">
				<h1 class="font-bold text-sm">Colibri Component Sandbox</h1>
				<div class="ml-auto flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={toggleTheme}>
						{dark() ? "Dark" : "Light"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setMobile((prev) => !prev)}
					>
						{mobile() ? "Mobile (375px)" : "Desktop"}
					</Button>
				</div>
			</header>
			<div class="flex min-h-0 flex-1">
				<nav class="border-border flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r p-3">
					<For each={CATEGORIES}>
						{(category) => (
							<div class="flex flex-col gap-1">
								<span class="text-muted-foreground px-2 text-xs uppercase tracking-wide">
									{category.title}
								</span>
								<For each={category.items}>
									{(item) => (
										<Button
											variant={current() === item.id ? "secondary" : "ghost"}
											size="sm"
											class="justify-start"
											onClick={() => select(item.id)}
										>
											{item.title}
										</Button>
									)}
								</For>
							</div>
						)}
					</For>
				</nav>
				<main class="bg-muted/20 flex flex-1 justify-center overflow-hidden p-4">
					<iframe
						ref={frame}
						src={`/sandbox.html?embed=1&item=${current()}`}
						title="Component page"
						class="border-border h-full rounded-md border bg-transparent transition-all duration-300"
						style={{ width: mobile() ? "375px" : "100%" }}
						onLoad={syncTheme}
					/>
				</main>
			</div>
		</div>
	);
};

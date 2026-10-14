import { createEffect, createSignal, type JSX, on, Show } from "solid-js";
import { Button } from "../Button/Button";
import { Checkbox } from "../Checkbox/Checkbox";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { Modal, ModalContent } from "../Modal/Modal";

export type LinkWarningPlatform = "mobile" | "desktop";

export type LinkWarningProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	url: string;
	disguised?: boolean;
	platform?: LinkWarningPlatform;
	onConfirm: (options: { trustHost: boolean }) => void;
};

export const linkWarningHost = (url: string) => {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
};

const splitUrl = (url: string) => {
	try {
		const parsed = new URL(url);
		const start = url.indexOf(parsed.host);
		if (start < 0) return { before: "", host: parsed.host, after: url };
		return {
			before: url.slice(0, start),
			host: parsed.host,
			after: url.slice(start + parsed.host.length),
		};
	} catch {
		return { before: "", host: "", after: url };
	}
};

const UrlPreview = (props: { url: string }) => {
	const parts = () => splitUrl(props.url);
	return (
		<p
			data-link-warning-url=""
			class="m-0 rounded-control border border-border bg-secondary px-3 py-2.5 text-sm break-all text-muted-foreground select-text"
		>
			{parts().before}
			<span data-link-warning-host="" class="font-semibold text-foreground">
				{parts().host}
			</span>
			{parts().after}
		</p>
	);
};

export const LinkWarning = (props: LinkWarningProps) => {
	const [trust, setTrust] = createSignal(false);
	createEffect(
		on(
			() => props.open,
			(open) => {
				if (open) setTrust(false);
			},
		),
	);
	const host = () => linkWarningHost(props.url);
	const description = () =>
		props.disguised
			? "The link text shows a different address than where it goes. Check the real address before you continue."
			: "This link takes you to a site outside of Colibri. Check that you trust it before you continue.";

	const confirm = () => {
		props.onConfirm({ trustHost: trust() });
		props.onOpenChange(false);
	};

	const body = (): JSX.Element => (
		<div data-link-warning="" class="flex flex-col gap-4">
			<UrlPreview url={props.url} />
			<Show when={host()}>
				<Checkbox
					checked={trust()}
					onChange={setTrust}
					label={`Always trust ${host()}`}
				/>
			</Show>
		</div>
	);

	const actions = (block: boolean): JSX.Element => (
		<>
			<Button
				variant="secondary"
				block={block}
				onClick={() => props.onOpenChange(false)}
			>
				Cancel
			</Button>
			<Button block={block} onClick={confirm}>
				Open link
			</Button>
		</>
	);

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
						title="Open external link?"
						description={description()}
						footer={<div class="grid grid-cols-2 gap-2">{actions(true)}</div>}
					>
						{body()}
					</DrawerContent>
				</Drawer>
			}
		>
			<Modal open={props.open} onOpenChange={props.onOpenChange}>
				<ModalContent
					title="Open external link?"
					description={description()}
					footer={actions(false)}
				>
					{body()}
				</ModalContent>
			</Modal>
		</Show>
	);
};

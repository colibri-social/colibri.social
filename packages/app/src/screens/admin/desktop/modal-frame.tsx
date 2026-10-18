import {
	DeveloperNavSection,
	LargeModalContent,
	type ModalTrailItem,
	type NavHeaderProps,
} from "@colibri-social/ui";
import { children, createSignal, For, type JSX, Show } from "solid-js";
import { type AdminLayer, layerPath } from "../../../shell/layers";
import { AdminScreen } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { SETTINGS_CONTENT_CLASS } from "../../settings/unsaved-form";
import {
	type DeveloperTarget,
	ModalPageContext,
	PageAction,
} from "./page-header";

export type AdminModalFrameProps = {
	pages: AdminLayer[];
	baseDepth: number;
	fallbackTitle: string;
	label: (layer: AdminLayer) => string;
	rootBack?: boolean;
	sidebar?: JSX.Element;
	sidebarEnd?: JSX.Element;
	developer?: DeveloperTarget;
	missing?: boolean;
	missingView?: JSX.Element;
	children?: JSX.Element;
};

export const AdminModalFrame = (props: AdminModalFrameProps) => {
	const stack = useStack();
	const [headers, setHeaders] = createSignal<Record<string, NavHeaderProps>>(
		{},
	);
	const [developers, setDevelopers] = createSignal<
		Record<string, DeveloperTarget | undefined>
	>({});
	const sidebar = children(() => props.sidebar);
	const hasSidebar = () =>
		sidebar
			.toArray()
			.some((node) => node !== undefined && node !== null && node !== false);
	const keys = () => props.pages.map((layer) => layerPath(layer));
	const layerOf = (key: string) =>
		props.pages.find((layer) => layerPath(layer) === key);
	const topKey = () => keys().at(-1);
	const top = () => {
		const key = topKey();
		return key ? headers()[key] : undefined;
	};
	const titleOf = (layer: AdminLayer) => {
		const published = headers()[layerPath(layer)]?.title;
		return typeof published === "string" && published
			? published
			: props.label(layer);
	};
	const trail = (): ModalTrailItem[] =>
		props.pages.slice(0, -1).map((layer, index) => ({
			label: titleOf(layer),
			onSelect: () => stack.popTo(props.baseDepth + index + 1),
		}));
	const title = () => {
		const layer = props.pages.at(-1);
		return layer ? titleOf(layer) : props.fallbackTitle;
	};
	const developer = () => {
		for (const key of [...keys()].reverse()) {
			const target = developers()[key];
			if (target) return target;
		}
		return props.developer;
	};
	const back = () => {
		const header = top();
		if (header?.onNavigate) header.onNavigate();
		else stack.pop();
	};
	const showBack = () =>
		props.pages.length > 1 || (!!props.rootBack && top()?.kind === "back");

	return (
		<LargeModalContent
			title={title()}
			trail={trail()}
			onBack={showBack() ? back : undefined}
			backLabel={top()?.navigateLabel}
			sidebar={
				<Show when={hasSidebar()}>
					{sidebar()}
					<div class="mt-auto flex flex-col gap-6">
						<Show when={developer()}>
							{(target) => (
								<div data-developer-mode="">
									<DeveloperNavSection
										copyValue={target().copyValue}
										pdslsHref={target().pdslsHref}
									/>
								</div>
							)}
						</Show>
						{props.sidebarEnd}
					</div>
				</Show>
			}
			actions={
				<Show when={!props.missing}>
					<PageAction action={top()?.action} />
				</Show>
			}
		>
			<Show when={!props.missing} fallback={props.missingView}>
				<For each={keys()}>
					{(key) => (
						<Show when={layerOf(key)}>
							{(layer) => (
								<div
									data-modal-page={layer().page}
									hidden={key !== topKey()}
									class={SETTINGS_CONTENT_CLASS}
								>
									<ModalPageContext.Provider
										value={{
											publish: (header) =>
												setHeaders((current) => ({
													...current,
													[key]: header,
												})),
											developer: (target) =>
												setDevelopers((current) => ({
													...current,
													[key]: target,
												})),
										}}
									>
										<AdminScreen
											page={layer().page}
											args={{ space: layer().space, id: layer().id }}
										/>
									</ModalPageContext.Provider>
								</div>
							)}
						</Show>
					)}
				</For>
			</Show>
			{props.children}
		</LargeModalContent>
	);
};

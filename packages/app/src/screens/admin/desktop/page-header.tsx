import { Button, NavHeader, type NavHeaderProps } from "@colibri-social/ui";
import { createContext, Show, useContext } from "solid-js";

export type DeveloperTarget = {
	copyValue: string;
	pdslsHref?: string;
};

export type ModalPage = {
	publish: (header: NavHeaderProps) => void;
	developer: (target: DeveloperTarget | undefined) => void;
};

export const ModalPageContext = createContext<ModalPage>();

export const useModalPage = () => useContext(ModalPageContext);

export const PageAction = (props: { action?: NavHeaderProps["action"] }) => (
	<Show when={props.action}>
		{(action) => (
			<Button
				data-modal-page-action=""
				variant={action().type === "text" ? "primary" : "secondary"}
				class="h-8 rounded-control-sm px-3"
				icon={(() => {
					const current = action();
					return current.type === "icon" ? current.icon : undefined;
				})()}
				disabled={action().disabled}
				loading={(() => {
					const current = action();
					return current.type === "text" ? current.loading : undefined;
				})()}
				onClick={() => action().onClick?.()}
			>
				{action().label}
			</Button>
		)}
	</Show>
);

export const AdminNavHeader = (props: NavHeaderProps) => {
	const page = useModalPage();
	if (!page) return <NavHeader {...props} />;
	page.publish(props);
	return null;
};

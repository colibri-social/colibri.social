import { Button, NavHeader, type NavHeaderProps } from "@colibri-social/ui";
import { createContext, type JSX, Show, useContext } from "solid-js";

export type ModalPage = {
	publish: (header: NavHeaderProps) => void;
};

export const ModalPageContext = createContext<ModalPage>();

export const useModalPage = () => useContext(ModalPageContext);

export const PageHeading = (props: {
	title?: JSX.Element;
	action?: NavHeaderProps["action"];
}) => (
	<div
		data-modal-page-heading=""
		class="flex min-h-9 min-w-0 items-center justify-between gap-4"
	>
		<h3 class="m-0 min-w-0 truncate text-xl leading-tight font-bold text-foreground">
			{props.title}
		</h3>
		<Show when={props.action}>
			{(action) => (
				<Button
					variant={action().type === "text" ? "primary" : "secondary"}
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
	</div>
);

export const AdminNavHeader = (props: NavHeaderProps) => {
	const page = useModalPage();
	if (!page) return <NavHeader {...props} />;
	page.publish(props);
	return <PageHeading title={props.title} action={props.action} />;
};

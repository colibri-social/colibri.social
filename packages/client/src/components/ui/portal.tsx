import { type Component, type ComponentProps, mergeProps } from "solid-js";
import type { Portal } from "solid-js/web";
import { usePortalMount } from "../../embed/context";

type PortalProps = ComponentProps<typeof Portal>;

export const withEmbedPortal = <P extends PortalProps>(
	Base: Component<P>,
): Component<P> => {
	return (props) => {
		const mount = usePortalMount();
		const merged = mergeProps(props, {
			get mount() {
				return props.mount ?? mount;
			},
		}) as P;
		return <Base {...merged} />;
	};
};

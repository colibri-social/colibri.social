import type { ModalAreaProps } from "../../../shell/desktop/modal-areas";
import type { AdminLayer } from "../../../shell/layers";
import OverviewScreen from "../overview/overview.screen";
import { SpaceModalContext } from "./space-modal-context";

export default function SpaceSettingsModal(props: ModalAreaProps) {
	const first = () => props.layers[0] as AdminLayer;
	const hasOverview = () => first().page === "overview";
	const pages = () =>
		(hasOverview() ? props.layers.slice(1) : props.layers) as AdminLayer[];
	return (
		<SpaceModalContext.Provider
			value={{
				pages,
				baseDepth: () => props.depth + (hasOverview() ? 1 : 0),
				areaDepth: () => props.depth,
			}}
		>
			<OverviewScreen args={{ space: first().space }} />
		</SpaceModalContext.Provider>
	);
}

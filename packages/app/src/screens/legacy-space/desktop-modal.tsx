import type { ModalAreaProps } from "../../shell/desktop/modal-areas";
import LegacySpaceScreen from "./legacy-space.screen";

export default function LegacySpaceModal(props: ModalAreaProps) {
	const did = () => {
		const layer = props.layers[0];
		return layer?.kind === "legacySpace" ? layer.did : "";
	};
	return <LegacySpaceScreen args={{ did: did() }} />;
}

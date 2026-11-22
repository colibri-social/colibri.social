import type { ModalAreaProps } from "../../shell/desktop/modal-areas";
import PackScreen from "./pack.screen";

export default function PackModal(props: ModalAreaProps) {
	const target = () => {
		const layer = props.layers[0];
		return layer?.kind === "pack"
			? { did: layer.did, rkey: layer.rkey }
			: { did: "", rkey: "" };
	};
	return <PackScreen args={target()} />;
}

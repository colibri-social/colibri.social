import type { ModalAreaProps } from "../../shell/desktop/modal-areas";
import JoinScreen from "./join.screen";

export default function JoinModal(props: ModalAreaProps) {
	const code = () => {
		const layer = props.layers[0];
		return layer?.kind === "join" ? layer.code : "";
	};
	return <JoinScreen args={{ code: code() }} />;
}

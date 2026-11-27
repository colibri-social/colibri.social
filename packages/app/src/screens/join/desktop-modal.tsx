import type { ModalAreaProps } from "../../shell/desktop/modal-areas";
import JoinScreen from "./join.screen";

export default function JoinModal(props: ModalAreaProps) {
	const layer = () => {
		const top = props.layers[0];
		return top?.kind === "join" ? top : undefined;
	};
	return <JoinScreen args={layer() ?? { code: "" }} />;
}

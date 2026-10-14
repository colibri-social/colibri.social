import { type Accessor, createContext, useContext } from "solid-js";
import type { AdminLayer } from "../../../shell/layers";

export type SpaceModal = {
	pages: Accessor<AdminLayer[]>;
	baseDepth: Accessor<number>;
	areaDepth: Accessor<number>;
};

export const SpaceModalContext = createContext<SpaceModal>();

export const useSpaceModal = () => {
	const modal = useContext(SpaceModalContext);
	if (!modal) throw new Error("useSpaceModal needs the Space settings modal");
	return modal;
};

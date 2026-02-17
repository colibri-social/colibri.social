import { useParams } from "@solidjs/router";
import type { ParentComponent } from "solid-js";

const CommunityView: ParentComponent = (props) => {
  const params = useParams();

  return (
    <div>
			<h2>Community: {params.community}</h2>
			<div>{props.children}</div>
    </div>
  );
};

export default CommunityView;

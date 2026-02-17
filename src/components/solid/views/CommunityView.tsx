import { useParams } from "@solidjs/router";

const CommunityView = () => {
  const params = useParams();

  return (
    <div>
      <h2>Community: {params.community}</h2>
    </div>
  );
};

export default CommunityView;
